/**
 * Sukoon Engine — Unified progression, tracking, and recommendation system.
 * Import via <script src="/js/sukoon-engine.js"></script> on any page.
 *
 * API:
 *   sukoon.track(category, minutes)  — Log a completed session
 *   sukoon.level(category)           — Get level object {name, emoji, minutes, next}
 *   sukoon.streak()                  — Get {count, lastDate, isToday}
 *   sukoon.recommend(mood)           — Get personalized content suggestions (enhanced)
 *   sukoon.stats()                   — Get {totalMinutes, totalSessions, categories, streak}
 *   sukoon.log                       — Raw activity log array
 *   sukoon.mood(value)               — Save current mood
 *   sukoon.lastMood()                — Get last recorded mood
 *   sukoon.isZenMode()               — Check if zen mode is active
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

    /* ====== TIME OF DAY HELPER ====== */
    function getTimeOfDay() {
        var h = new Date().getHours();
        if (h >= 5 && h <= 11) return 'morning';
        if (h >= 12 && h <= 17) return 'afternoon';
        if (h >= 18 && h <= 21) return 'evening';
        return 'night'; // 22-4
    }

    /* ====== ZEN MODE ====== */
    function isZenMode() {
        try {
            return localStorage.getItem('sukoon_zen_mode') === '1';
        } catch (e) {
            return false;
        }
    }

    /**
     * Get personalized recommendations based on mood, goals, time of day, streak, category gaps, and experience.
     * @param {string} [mood] - Current mood (anxious, sad, stressed, tired, happy, calm)
     * @returns {Array<{title: string, href: string, tag: string, category: string, icon: string, desc: string}>}
     */
    function recommend(mood) {
        var moodLower = (mood || '').toLowerCase();

        // Map numeric/emoji moods to text
        var moodNames = { '1': 'sad', '2': 'anxious', '3': 'calm', '4': 'happy', '5': 'happy' };
        if (moodNames[moodLower]) moodLower = moodNames[moodLower];

        // Read user context from localStorage
        var goals = [];
        var experience = 'beginner';
        try {
            var goalsRaw = localStorage.getItem('sukoon_goals');
            if (goalsRaw) goals = JSON.parse(goalsRaw);
        } catch (e) {}
        try {
            var expRaw = localStorage.getItem('sukoon_experience');
            if (expRaw) experience = expRaw;
        } catch (e) {}

        var timeOfDay = getTimeOfDay();
        var currentStreak = streak();
        var result = [];

        // ---- 1. MOOD-BASED RECOMMENDATIONS ----
        var moodRecs = {
            'anxious': [
                { title: 'Calm Anxiety', href: '/meditate.html', tag: 'Because you feel anxious', category: 'meditation', icon: '\uD83C\uDF3F', desc: 'Gentle guidance to ease anxious thoughts' },
                { title: 'SOS Breathing', href: '/sos.html', tag: 'Instant calm for anxiety', category: 'breathing', icon: '\uD83D\uDCA8', desc: 'Quick grounding when anxiety peaks' },
                { title: 'Rain Sounds', href: '/sounds.html', tag: 'Soothing for anxious minds', category: 'sounds', icon: '\uD83C\uDF27\uFE0F', desc: 'Soothing rainfall for instant relief' }
            ],
            'sad': [
                { title: 'Loving Kindness', href: '/meditate.html', tag: 'Because you feel sad', category: 'meditation', icon: '\uD83D\uDC9C', desc: 'Wrap yourself in compassion' },
                { title: 'Talk It Out', href: '/friend.html', tag: 'Support when you need it', category: 'daily', icon: '\uD83D\uDCAC', desc: 'Share what\'s on your heart' },
                { title: 'Uplifting Quotes', href: '/quotes.html', tag: 'Words to lift your spirits', category: 'daily', icon: '\u2728', desc: 'Words that heal and inspire' }
            ],
            'stressed': [
                { title: 'Quick Calm', href: '/meditate.html', tag: 'Because you feel stressed', category: 'meditation', icon: '\uD83D\uDD4D\uFE0F', desc: 'A brief pause to reset' },
                { title: 'Rain Sounds', href: '/sounds.html', tag: 'Stress relief sounds', category: 'sounds', icon: '\uD83C\uDF27\uFE0F', desc: 'Soothing rainfall for relief' },
                { title: 'Deep Breathing', href: '/breathe.html', tag: 'Breathe away stress', category: 'breathing', icon: '\uD83D\uDCA8', desc: 'Slow your system down' }
            ],
            'tired': [
                { title: 'Sleep Stories', href: '/sleep.html', tag: 'Because you feel tired', category: 'sleep', icon: '\uD83C\uDF19', desc: 'Drift off with a soothing tale' },
                { title: 'Can\'t Sleep', href: '/sos.html', tag: 'Relaxation for rest', category: 'sleep', icon: '\uD83D\uDECC', desc: 'Progressive relaxation' },
                { title: 'Night Sounds', href: '/sounds.html', tag: 'Ambient sounds for rest', category: 'sounds', icon: '\uD83C\uDF0C', desc: 'Crickets and gentle wind' }
            ],
            'happy': [
                { title: 'Gratitude Practice', href: '/meditate.html', tag: 'Amplify your joy', category: 'meditation', icon: '\u2728', desc: 'Amplify this beautiful feeling' },
                { title: 'Journal This', href: '/journal.html', tag: 'Capture this happy moment', category: 'journal', icon: '\uD83D\uDCDD', desc: 'Capture what made you smile' },
                { title: 'Soul Wisdom', href: '/quotes.html?tab=wisdom', tag: 'Insights for a joyful mind', category: 'daily', icon: '\uD83D\uDCDC', desc: 'Insights for the still mind' }
            ],
            'calm': [
                { title: 'Deepen Your Peace', href: '/meditate.html', tag: 'Because you feel calm', category: 'meditation', icon: '\uD83C\uDF33', desc: 'A mindful awareness session' },
                { title: 'Soul Wisdom', href: '/quotes.html?tab=wisdom', tag: 'Wisdom for a peaceful mind', category: 'daily', icon: '\uD83D\uDCDC', desc: 'Timeless insights to explore' },
                { title: 'Daily Sukoon', href: '/daily.html', tag: 'Your guided daily ritual', category: 'daily', icon: '\u2618', desc: 'Your guided daily ritual' }
            ]
        };

        // Match mood
        Object.keys(moodRecs).forEach(function(key) {
            if (moodLower && (moodLower.indexOf(key) !== -1 || key.indexOf(moodLower) !== -1)) {
                result = moodRecs[key].slice();
            }
        });

        // If no mood match, start with defaults
        if (result.length === 0) {
            result = [
                { title: 'Daily Sukoon', href: '/daily.html', tag: 'Start here', category: 'daily', icon: '\u2618', desc: 'Your personalized daily ritual' },
                { title: 'Meditate', href: '/meditate.html', tag: 'Popular', category: 'meditation', icon: '\uD83D\uDD4D\uFE0F', desc: 'Guided sessions for every mood' }
            ];

            var lastCat = '';
            if (data.sessions.length > 0) {
                lastCat = data.sessions[data.sessions.length - 1].category;
            }
            if (lastCat === 'meditation') {
                result.push({ title: 'More Meditation', href: '/meditate.html', tag: 'Continue your practice', category: 'meditation', icon: '\uD83D\uDD4D\uFE0F', desc: 'Continue your practice' });
            } else if (lastCat === 'focus') {
                result.push({ title: 'Focus Again', href: '/focus.html', tag: 'Get back into flow', category: 'focus', icon: '\uD83C\uDFAF', desc: 'Get back into flow' });
            } else {
                result.push({ title: 'SOS Support', href: '/sos.html', tag: 'Here when you need it', category: 'daily', icon: '\uD83D\uDEA8', desc: 'Emotion-specific guided help' });
            }
        }

        // ---- 2. TIME-OF-DAY ADJUSTMENTS ----
        var timeRecs = {
            'morning': { title: 'Morning Intention', href: '/meditate.html', tag: 'Great way to start the morning', category: 'meditation', icon: '\uD83C\uDF05', desc: 'Set an intention for your day' },
            'afternoon': { title: 'Mindful Breathing', href: '/breathe.html', tag: 'Perfect for an afternoon reset', category: 'breathing', icon: '\uD83C\uDF43', desc: 'A quick reset to re-energize' },
            'evening': { title: 'Evening Wind Down', href: '/journal.html', tag: 'Good for winding down tonight', category: 'journal', icon: '\uD83C\uDF06', desc: 'Reflect on your day with gratitude' },
            'night': { title: 'Sleep Story', href: '/sleep.html', tag: 'Good for sleep at night', category: 'sleep', icon: '\uD83C\uDF19', desc: 'Drift off with a soothing tale' }
        };
        var timeRec = timeRecs[timeOfDay];
        if (timeRec) {
            // Avoid duplicating if similar already exists
            var hasTimeDuplicate = false;
            result.forEach(function(r) {
                if (r.href === timeRec.href && r.title === timeRec.title) hasTimeDuplicate = true;
            });
            if (!hasTimeDuplicate) {
                result.push(timeRec);
            }
        }

        // ---- 3. GOAL-BASED RECOMMENDATIONS ----
        var goalRecs = {
            'stress': { title: 'Stress Relief', href: '/meditate.html', tag: 'Aligned with your stress goal', category: 'meditation', icon: '\uD83C\uDF3F', desc: 'Targeted meditation for stress relief' },
            'sleep': { title: 'Better Sleep', href: '/sleep.html', tag: 'Aligned with your sleep goal', category: 'sleep', icon: '\uD83D\uDE34', desc: 'Guided session for deeper rest' },
            'focus': { title: 'Sharp Focus', href: '/focus.html', tag: 'Aligned with your focus goal', category: 'focus', icon: '\uD83C\uDFAF', desc: 'Train your concentration' },
            'anxiety': { title: 'Ease Anxiety', href: '/sos.html', tag: 'Aligned with your anxiety goal', category: 'breathing', icon: '\uD83D\uDCA8', desc: 'SOS breathing for anxious moments' },
            'growth': { title: 'Personal Growth', href: '/courses.html', tag: 'Aligned with your growth goal', category: 'courses', icon: '\uD83C\uDF31', desc: 'Structured wellness courses' },
            'peace': { title: 'Inner Peace', href: '/meditate.html', tag: 'Aligned with your peace goal', category: 'meditation', icon: '\u2618', desc: 'Deepen your sense of calm' }
        };
        if (goals && goals.length > 0) {
            // Pick a random goal rec not already in results
            var shuffledGoals = goals.slice().sort(function() { return Math.random() - 0.5; });
            for (var gi = 0; gi < shuffledGoals.length; gi++) {
                var goalKey = shuffledGoals[gi];
                if (goalRecs[goalKey]) {
                    var goalItem = goalRecs[goalKey];
                    var goalDup = false;
                    result.forEach(function(r) {
                        if (r.href === goalItem.href && r.title === goalItem.title) goalDup = true;
                    });
                    if (!goalDup) {
                        result.push(goalItem);
                        break;
                    }
                }
            }
        }

        // ---- 4. STREAK NUDGE ----
        if (currentStreak.count > 0 && !currentStreak.isToday) {
            // Streak is about to break -- last activity was yesterday
            result.push({
                title: 'Keep Your Streak',
                href: '/daily.html',
                tag: 'Keep your ' + currentStreak.count + '-day streak alive!',
                category: 'daily',
                icon: '\uD83D\uDD25',
                desc: 'Don\'t break your ' + currentStreak.count + '-day streak!'
            });
        }

        // ---- 5. CATEGORY GAPS — suggest something new ----
        var usedCategories = {};
        data.sessions.forEach(function(s) {
            usedCategories[s.category] = true;
        });

        var categoryContent = {
            'meditation': { title: 'Try Meditation', href: '/meditate.html', category: 'meditation', icon: '\uD83D\uDD4D\uFE0F', desc: 'Guided sessions for every mood' },
            'breathing': { title: 'Try Breathing', href: '/breathe.html', category: 'breathing', icon: '\uD83D\uDCA8', desc: 'Calming breath exercises' },
            'focus': { title: 'Try Focus Mode', href: '/focus.html', category: 'focus', icon: '\uD83C\uDFAF', desc: 'Boost your concentration' },
            'sleep': { title: 'Try Sleep Stories', href: '/sleep.html', category: 'sleep', icon: '\uD83C\uDF19', desc: 'Soothing tales for better sleep' },
            'sounds': { title: 'Try Ambient Sounds', href: '/sounds.html', category: 'sounds', icon: '\uD83C\uDF3A', desc: 'Peaceful background soundscapes' },
            'journal': { title: 'Try Journaling', href: '/journal.html', category: 'journal', icon: '\uD83D\uDCDD', desc: 'Write your way to clarity' },
            'courses': { title: 'Try a Course', href: '/courses.html', category: 'courses', icon: '\uD83C\uDF31', desc: 'Structured multi-day programs' }
        };

        var unexplored = [];
        Object.keys(categoryContent).forEach(function(cat) {
            if (!usedCategories[cat]) {
                unexplored.push(cat);
            }
        });

        if (unexplored.length > 0) {
            var randomCat = unexplored[Math.floor(Math.random() * unexplored.length)];
            var newItem = categoryContent[randomCat];
            newItem.tag = 'Try something new';
            result.push(newItem);
        }

        // ---- 6. EXPERIENCE LEVEL ADJUSTMENTS ----
        if (experience === 'beginner' && result.length > 0) {
            // Ensure at least one beginner-friendly item at the top
            var hasBeginner = false;
            result.forEach(function(r) {
                if (r.href === '/daily.html' || r.href === '/breathe.html' || r.title === 'Quick Calm') hasBeginner = true;
            });
            if (!hasBeginner) {
                result.unshift({
                    title: 'Start Simple',
                    href: '/breathe.html',
                    tag: 'Great for beginners',
                    category: 'breathing',
                    icon: '\uD83C\uDF3F',
                    desc: 'A gentle breathing exercise to begin'
                });
            }
        } else if (experience === 'advanced') {
            // Suggest deeper content for advanced users
            var hasAdvanced = false;
            result.forEach(function(r) {
                if (r.href === '/courses.html') hasAdvanced = true;
            });
            if (!hasAdvanced) {
                result.push({
                    title: 'Deep Practice',
                    href: '/courses.html',
                    tag: 'For your experience level',
                    category: 'courses',
                    icon: '\u26F0\uFE0F',
                    desc: 'Advanced multi-day programs'
                });
            }
        }

        // Limit to 5 recommendations max, avoid duplicates by href+title
        var seen = {};
        var filtered = [];
        for (var fi = 0; fi < result.length; fi++) {
            var key = result[fi].href + '|' + result[fi].title;
            if (!seen[key]) {
                seen[key] = true;
                filtered.push(result[fi]);
            }
            if (filtered.length >= 5) break;
        }

        return filtered;
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
        isZenMode: isZenMode,
        get log() { return data.sessions.slice(); },
        LEVELS: LEVELS,
        CATEGORIES: CATEGORIES
    };

})(window);
