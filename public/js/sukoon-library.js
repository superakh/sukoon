/* sukoon-library.js
 * LibraryClient: loads the curated JSON corpora from /public/content/* and
 * filters by tags (mood, situation, duration, language, time-of-day).
 *
 * Zero deps. Vanilla ES2017+. Exports window.SukoonLibrary.
 *
 * Corpora (loaded lazily, cached in memory for the page lifetime):
 *   meditations.json   - 40 guided meditations
 *   stories.json       - 50 sleep stories
 *   breath.json        - 25 breathing patterns
 *   soundscapes.json   - 15 ambient layers
 *   daily.json         - 365 daily mantras (cycled by day_of_year % 365)
 *   festivals.json     - 7 festival practices
 *   crisis.json        - 12 immediate tools
 *
 * Public API:
 *   const lib = new SukoonLibrary({ base: '/content' });
 *   await lib.load('meditations');                 // returns array
 *   lib.filter('stories', { mood:'tired', lang:'hi', maxDuration:900 });
 *   lib.byId('breath', 'breath-001');
 *   lib.today('daily');                            // today's daily mantra
 *   lib.festivalsActive(new Date());               // any festival in window
 *   lib.suggest({ kind, mood, situation, lang, duration })
 *      -> { strong: [...], weak: [...], shouldOfferGenerative: bool }
 */
(function () {
  'use strict';

  var FILES = {
    meditations: 'meditations.json',
    stories: 'stories.json',
    breath: 'breath.json',
    soundscapes: 'soundscapes.json',
    daily: 'daily.json',
    festivals: 'festivals.json',
    crisis: 'crisis.json'
  };

  function LibraryClient(opts) {
    opts = opts || {};
    this.base = opts.base || '/content';
    this._cache = {};      // kind -> array
    this._inflight = {};   // kind -> Promise
  }

  LibraryClient.prototype.load = function (kind) {
    if (!FILES[kind]) return Promise.reject(new Error('unknown kind: ' + kind));
    if (this._cache[kind]) return Promise.resolve(this._cache[kind]);
    if (this._inflight[kind]) return this._inflight[kind];
    var self = this;
    var url = this.base + '/' + FILES[kind];
    this._inflight[kind] = fetch(url, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error(kind + ' http ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!Array.isArray(data)) data = (data && data.items) || [];
        self._cache[kind] = data;
        delete self._inflight[kind];
        return data;
      })
      .catch(function (err) {
        delete self._inflight[kind];
        self._cache[kind] = [];  // negative cache so we don't refetch on every call
        return [];
      });
    return this._inflight[kind];
  };

  LibraryClient.prototype.loadAll = function () {
    var self = this;
    return Promise.all(Object.keys(FILES).map(function (k) { return self.load(k); }));
  };

  function _tagsOf(item) {
    // Collect all tag-like arrays into one flat lowercased set.
    var out = [];
    var keys = ['tags', 'ideal_for', 'trigger_moods', 'situations', 'time_of_day', 'mood'];
    for (var i = 0; i < keys.length; i++) {
      var v = item[keys[i]];
      if (Array.isArray(v)) for (var j = 0; j < v.length; j++) out.push(String(v[j]).toLowerCase());
      else if (typeof v === 'string') out.push(v.toLowerCase());
    }
    return out;
  }

  function _scoreItem(item, q) {
    var tags = _tagsOf(item);
    var score = 0;
    if (q.mood && tags.indexOf(String(q.mood).toLowerCase()) !== -1) score += 3;
    if (q.situation && tags.indexOf(String(q.situation).toLowerCase()) !== -1) score += 2;
    if (q.timeOfDay && tags.indexOf(String(q.timeOfDay).toLowerCase()) !== -1) score += 1;
    if (q.lang) {
      // Items with a *_<lang> field count as having that lang.
      var hasLang = false;
      for (var k in item) if (item.hasOwnProperty(k) && k.slice(-3) === '_' + q.lang) { hasLang = true; break; }
      if (hasLang) score += 1;
    }
    if (q.maxDuration && typeof item.duration_sec === 'number') {
      if (item.duration_sec <= q.maxDuration) score += 1;
      else score -= 2;
    }
    return score;
  }

  LibraryClient.prototype.filter = function (kind, q) {
    q = q || {};
    var arr = this._cache[kind] || [];
    var scored = [];
    for (var i = 0; i < arr.length; i++) {
      var s = _scoreItem(arr[i], q);
      if (s > 0) scored.push({ item: arr[i], score: s });
    }
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.map(function (s) { return s.item; });
  };

  LibraryClient.prototype.byId = function (kind, id) {
    var arr = this._cache[kind] || [];
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  };

  LibraryClient.prototype.today = function (kind) {
    var arr = this._cache[kind] || [];
    if (!arr.length) return null;
    // Day-of-year, 1..366
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    var diff = now - start;
    var oneDay = 1000 * 60 * 60 * 24;
    var doy = Math.floor(diff / oneDay);
    var idx = ((doy - 1) % arr.length + arr.length) % arr.length;
    // Prefer matching date_offset if present
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].date_offset === ((doy - 1) % 365) + 1) return arr[i];
    }
    return arr[idx];
  };

  LibraryClient.prototype.festivalsActive = function (when) {
    var arr = this._cache.festivals || [];
    var now = when || new Date();
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var f = arr[i];
      var dates = f.dates_2026 || f.dates || [];
      for (var j = 0; j < dates.length; j++) {
        var d = new Date(dates[j]);
        if (isNaN(d)) continue;
        var before = (f.window_before_days || 0) * 86400000;
        var after = (f.window_after_days || 0) * 86400000;
        if (now >= (d - before) && now <= (d.getTime() + after)) {
          out.push(f);
          break;
        }
      }
    }
    return out;
  };

  // Hybrid library + generative routing decision per spec:
  //   - 3+ strong matches  -> library only
  //   - <3 strong matches  -> library items + "make something fresh" option
  LibraryClient.prototype.suggest = function (q) {
    q = q || {};
    var self = this;
    var kind = q.kind || 'meditations';
    return this.load(kind).then(function () {
      var hits = self.filter(kind, q);
      var STRONG_MIN_SCORE = 4;
      var strong = [];
      for (var i = 0; i < hits.length; i++) {
        if (_scoreItem(hits[i], q) >= STRONG_MIN_SCORE) strong.push(hits[i]);
      }
      var weak = hits.filter(function (h) { return strong.indexOf(h) === -1; });
      return {
        strong: strong,
        weak: weak.slice(0, 6),
        shouldOfferGenerative: strong.length < 3
      };
    });
  };

  LibraryClient.scoreItem = _scoreItem;
  LibraryClient.tagsOf = _tagsOf;
  LibraryClient.FILES = FILES;

  window.SukoonLibrary = LibraryClient;
})();
