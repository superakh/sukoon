/**
 * Sukoon Engine — Unified progression, tracking, and recommendation system.
 * Import via <script src="/js/sukoon-engine.js"></script> on any page.
 *
 * API:
 *   sukoon.track(category, minutes)  — Log a completed session
 *   sukoon.level(category)           — Get level object {name, emoji, minutes, next}
 *   sukoon.streak()                  — Get {count, lastDate, isToday}
 *   sukoon.recommend(mood)           — Get 3 personalized content suggestions
 *   sukoon.stats()                   — Get {totalMinutes, totalSessions, categories, streak}
 *   sukoon.log                       — Raw activity log array
 *   sukoon.mood(value)               — Save current mood
 *   sukoon.lastMood()                — Get last recorded mood
 */
(function(global) {
    'use strict';

    var STORAGE_KEY = 'sukoon_engine';
    var STREAK_KEY = 'sukoon_daily_streak';
    var MOOD_KEY = 'sukoon_last_mood';

    /* ====== LEVELS ====== */
    var LEVELS = [
        { name: 'Seedling', emoji: '\uD83C\uDF31', min: 0 },    // 0 min
        { name: 'Sprout', emoji: '\uD83C\uDF3F', min: 30 },     // 30 min
        { name: 'Sapling', emoji: '\uD83C\uDF3E', min: 120 },   // 2 hours
        { name: 'Tree', emoji: '\uD83C\uDF33', min: 360 },      // 6 hours
        { name: 'Forest', emoji: '\uD83C\uDF32', min: 900 },    // 15 hours
        { name: 'Mountain', emoji: '\u26F0\uFE0F', min: 1800 }  // 30 hours
    ];

    var CATEGORIES = ['meditation', 'breathing', 'focus', 'sleep', 'sounds', 'courses', 'journal', 'daily'];

    /* ====== DATA STORE ====== */
    var data = { sessions: [], categoryMinutes: {} };

    function load() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                var parsed = JSON.parse(raw);
                data.sessions = parsed.sessions || [];
                data.categoryMinutes = parsed.categoryMinutes || {};
            }
            // Migrate from old scattered localStorage keys
            migrateOldData();
        } catch (e) { /* ignore */ }
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) { /* ignore */ }
    }

    function migrateOldData() {
        try {
            var oldLog = localStorage.getItem('sukoon_activity_log');
            if (oldLog && data.sessions.length === 0) {
                var entries = JSON.parse(oldLog);
                entries.forEach(function(entry) {
                    data.sessions.push({
                        category: entry.category || 'meditation',
                        minutes: entry.minutes || entry.duration || 0,
                        date: entry.date || entry.timestamp || new Date().toISOString(),
                        title: entry.title || ''
                    });
                    var cat = entry.category || 'meditation';
                    var mins = entry.minutes || entry.duration || 0;
                    data.categoryMinutes[cat] = (data.categoryMinutes[cat] || 0) + mins;
                });
                save();
            }

            // Migrate old progress stats
            var oldStats = localStorage.getItem('sukoon_progress_stats');
            if (oldStats) {
                var stats = JSON.parse(oldStats);
                Object.keys(stats).forEach(function(cat) {
                    if (stats[cat].totalMinutes && !data.categoryMinutes[cat]) {
                        data.categoryMinutes[cat] = stats[cat].totalMinutes;
                    }
                });
                save();
            }
        } catch (e) { /* ignore migration errors */ }
    }

    /* ====== PUBLIC API ====== */

    /**
     * Track a completed session.
     * @param {string} category - One of: meditation, breathing, focus, sleep, sounds, courses, journal, daily
     * @param {number} minutes - Duration in minutes
     * @param {string} [title] - Optional session title
     */
    function track(category, minutes, title) {
        if (!category || typeof minutes !== 'number' || minutes <= 0) return;

        var session = {
            category: category,
            minutes: Math.round(minutes * 10) / 10,
            date: new Date().toISOString(),
            title: title || ''
        };

        data.sessions.push(session);
        data.categoryMinutes[category] = (data.categoryMinutes[category] || 0) + session.minutes;

        // Update streak
        updateStreak();

        // Also write to old keys for backward compatibility with existing pages
        try {
            var today = new Date().toDateString();
            var dailyKey = 'sukoon_daily_' + today.replace(/\s/g, '_');
            var existing = JSON.parse(localStorage.getItem(dailyKey) || '{"minutes":0,"sessions":0}');
            existing.minutes += session.minutes;
            existing.sessions += 1;
            localStorage.setItem(dailyKey, JSON.stringify(existing));
        } catch (e) { /* ignore */ }

        save();
        return session;
    }

    /**
     * Get the level for a category (or overall).
     * @param {string} [category] - Category name, or omit for overall level
     * @returns {{name: string, emoji: string, minutes: number, next: {name: string, minutesNeeded: number}|null, progress: number}}
     */
    function level(category) {
        var totalMins = 0;
        if (category) {
            totalMins = data.categoryMinutes[category] || 0;
        } else {
            Object.keys(data.categoryMinutes).forEach(function(cat) {
                totalMins += data.categoryMinutes[cat] || 0;
            });
        }

        var currentLevel = LEVELS[0];
        var nextLevel = LEVELS[1];

        for (var i = LEVELS.length - 1; i >= 0; i--) {
            if (totalMins >= LEVELS[i].min) {
                currentLevel = LEVELS[i];
                nextLevel = LEVELS[i + 1] || null;
                break;
            }
        }

        var progress = 0;
        if (nextLevel) {
            var range = nextLevel.min - currentLevel.min;
            var done = totalMins - currentLevel.min;
            progress = Math.min(Math.round((done / range) * 100), 100);
        } else {
            progress = 100;
        }

        return {
            name: currentLevel.name,
            emoji: currentLevel.emoji,
            minutes: Math.round(totalMins),
            next: nextLevel ? { name: nextLevel.name, minutesNeeded: nextLevel.min - totalMins } : null,
            progress: progress
        };
    }

    /**
     * Get the current daily streak.
     * @returns {{count: number, lastDate: string, isToday: boolean}}
     */
    function streak() {
        try {
            var raw = localStorage.getItem(STREAK_KEY);
            if (!raw) return { count: 0, lastDate: '', isToday: false };
            var s = JSON.parse(raw);
            var today = new Date().toDateString();
            return {
                count: s.count || 0,
                lastDate: s.lastDate || '',
                isToday: s.lastDate === today
            };
        } catch (e) {
            return { count: 0, lastDate: '', isToday: false };
        }
    }

    function updateStreak() {
        try {
            var today = new Date().toDateString();
            var yesterday = new Date(Date.now() - 86400000).toDateString();
            var raw = localStorage.getItem(STREAK_KEY);
            var s = raw ? JSON.parse(raw) : { count: 0, lastDate: '' };

            if (s.lastDate === today) return; // Already tracked today

            if (s.lastDate === yesterday) {
                s.count = (s.count || 0) + 1;
            } else if (s.lastDate !== today) {
                s.count = 1; // Reset streak
            }
            s.lastDate = today;
            localStorage.setItem(STREAK_KEY, JSON.stringify(s));
        } catch (e) { /* ignore */ }
    }

    /**
     * Get personalized recommendations based on mood.
     * @param {string} [mood] - Current mood (anxious, sad, stressed, tired, happy, calm)
     * @returns {Array<{href: string, icon: string, title: string, desc: string, tag: string}>}
     */
    function recommend(mood) {
        var moodLower = (mood || '').toLowerCase();

        // Map numeric/emoji moods to text
        var moodNames = { '1': 'sad', '2': 'anxious', '3': 'calm', '4': 'happy', '5': 'happy' };
        if (moodNames[moodLower]) moodLower = moodNames[moodLower];

        var recs = {
            'anxious': [
                { href: '/meditate.html', icon: '\uD83C\uDF3F', title: 'Calm Anxiety', desc: 'Gentle guidance to ease anxious thoughts', tag: 'For anxiety' },
                { href: '/sos.html', icon: '\uD83D\uDCA8', title: 'SOS Breathing', desc: 'Quick grounding when anxiety peaks', tag: 'Instant calm' },
                { href: '/sounds.html', icon: '\uD83C\uDF27\uFE0F', title: 'Rain Sounds', desc: 'Soothing rainfall for instant relief', tag: 'Relaxation' }
            ],
            'sad': [
                { href: '/meditate.html', icon: '\uD83D\uDC9C', title: 'Loving Kindness', desc: 'Wrap yourself in compassion', tag: 'For sadness' },
                { href: '/friend.html', icon: '\uD83D\uDCAC', title: 'Talk It Out', desc: 'Share what\'s on your heart', tag: 'Support' },
                { href: '/quotes.html', icon: '\u2728', title: 'Uplifting Quotes', desc: 'Words that heal and inspire', tag: 'Comfort' }
            ],
            'stressed': [
                { href: '/meditate.html', icon: '\uD83D\uDD4D\uFE0F', title: 'Quick Calm', desc: 'A brief pause to reset', tag: 'For stress' },
                { href: '/sounds.html', icon: '\uD83C\uDF27\uFE0F', title: 'Rain Sounds', desc: 'Soothing rainfall for relief', tag: 'Relaxation' },
                { href: '/breathe.html', icon: '\uD83D\uDCA8', title: 'Deep Breathing', desc: 'Slow your system down', tag: 'Breathe' }
            ],
            'tired': [
                { href: '/sleep.html', icon: '\uD83C\uDF19', title: 'Sleep Stories', desc: 'Drift off with a soothing tale', tag: 'For rest' },
                { href: '/sos.html', icon: '\uD83D\uDECC', title: 'Can\'t Sleep', desc: 'Progressive relaxation', tag: 'Sleep help' },
                { href: '/sounds.html', icon: '\uD83C\uDF0C', title: 'Night Sounds', desc: 'Crickets and gentle wind', tag: 'Ambient' }
            ],
            'happy': [
                { href: '/meditate.html', icon: '\u2728', title: 'Gratitude Practice', desc: 'Amplify this beautiful feeling', tag: 'Joy' },
                { href: '/journal.html', icon: '\uD83D\uDCDD', title: 'Journal This', desc: 'Capture what made you smile', tag: 'Reflect' },
                { href: '/quotes.html?tab=wisdom', icon: '\uD83D\uDCDC', title: 'Soul Wisdom', desc: 'Insights for the still mind', tag: 'Wisdom' }
            ],
            'calm': [
                { href: '/meditate.html', icon: '\uD83C\uDF33', title: 'Deepen Your Peace', desc: 'A mindful awareness session', tag: 'Serenity' },
                { href: '/quotes.html?tab=wisdom', icon: '\uD83D\uDCDC', title: 'Soul Wisdom', desc: 'Timeless insights to explore', tag: 'Wisdom' },
                { href: '/daily.html', icon: '\u2618', title: 'Daily Sukoon', desc: 'Your guided daily ritual', tag: 'Practice' }
            ]
        };

        // Try to match mood
        var result = null;
        Object.keys(recs).forEach(function(key) {
            if (moodLower.indexOf(key) !== -1 || key.indexOf(moodLower) !== -1) {
                result = recs[key];
            }
        });

        // Default if no mood match
        if (!result) {
            // Look at recent activity to personalize
            var lastCat = '';
            if (data.sessions.length > 0) {
                lastCat = data.sessions[data.sessions.length - 1].category;
            }

            result = [
                { href: '/daily.html', icon: '\u2618', title: 'Daily Sukoon', desc: 'Your personalized daily ritual', tag: 'Start here' },
                { href: '/meditate.html', icon: '\uD83D\uDD4D\uFE0F', title: 'Meditate', desc: 'Guided sessions for every mood', tag: 'Popular' },
                { href: '/sos.html', icon: '\uD83D\uDEA8', title: 'SOS Support', desc: 'Emotion-specific guided help', tag: 'Crisis' }
            ];

            if (lastCat === 'meditation') {
                result[2] = { href: '/meditate.html', icon: '\uD83D\uDD4D\uFE0F', title: 'More Meditation', desc: 'Continue your practice', tag: 'Recent' };
            } else if (lastCat === 'focus') {
                result[2] = { href: '/focus.html', icon: '\uD83C\uDFAF', title: 'Focus Again', desc: 'Get back into flow', tag: 'Recent' };
            }
        }

        return result;
    }

    /**
     * Get overall stats.
     * @returns {{totalMinutes: number, totalSessions: number, categories: Object, streak: Object}}
     */
    function stats() {
        var totalMins = 0;
        Object.keys(data.categoryMinutes).forEach(function(cat) {
            totalMins += data.categoryMinutes[cat] || 0;
        });

        return {
            totalMinutes: Math.round(totalMins),
            totalSessions: data.sessions.length,
            categories: Object.assign({}, data.categoryMinutes),
            streak: streak(),
            level: level()
        };
    }

    /**
     * Save current mood.
     * @param {string} value - Mood value (e.g., 'happy', 'anxious', '3', etc.)
     */
    function saveMood(value) {
        try {
            localStorage.setItem(MOOD_KEY, value);
            localStorage.setItem('sukoon_daily_mood_pre', value);
        } catch (e) { /* ignore */ }
    }

    /**
     * Get last recorded mood.
     * @returns {string|null}
     */
    function lastMood() {
        try {
            return localStorage.getItem(MOOD_KEY) || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Get activity for a specific date range.
     * @param {number} [days=7] - Number of past days to include
     * @returns {Array}
     */
    function recentActivity(days) {
        days = days || 7;
        var cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        var cutoffStr = cutoff.toISOString();

        return data.sessions.filter(function(s) {
            return s.date >= cutoffStr;
        });
    }

    /**
     * Get minutes per day for the last N days (for charts).
     * @param {number} [days=7]
     * @returns {Array<{date: string, minutes: number}>}
     */
    function dailyBreakdown(days) {
        days = days || 7;
        var result = [];

        for (var i = days - 1; i >= 0; i--) {
            var d = new Date();
            d.setDate(d.getDate() - i);
            var dateStr = d.toDateString();
            var dayMins = 0;

            data.sessions.forEach(function(s) {
                if (new Date(s.date).toDateString() === dateStr) {
                    dayMins += s.minutes || 0;
                }
            });

            result.push({
                date: dateStr,
                label: d.toLocaleDateString('en', { weekday: 'short' }),
                minutes: Math.round(dayMins * 10) / 10
            });
        }

        return result;
    }

    /* ====== INITIALIZE ====== */
    load();

    /* ====== EXPORT ====== */
    global.sukoon = {
        track: track,
        level: level,
        streak: streak,
        recommend: recommend,
        stats: stats,
        mood: saveMood,
        lastMood: lastMood,
        recentActivity: recentActivity,
        dailyBreakdown: dailyBreakdown,
        get log() { return data.sessions.slice(); },
        LEVELS: LEVELS,
        CATEGORIES: CATEGORIES
    };

})(window);
