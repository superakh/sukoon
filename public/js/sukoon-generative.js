/* sukoon-generative.js
 * Generative wrappers for on-the-fly meditation/story/breath scripts.
 *
 * Zero deps. Vanilla ES2017+. Exports:
 *   window.GenerativeMeditation
 *   window.GenerativeStory
 *   window.GenerativeBreath
 *
 * Each class fetches from its endpoint, renders via SukoonTTS, persists the
 * latest script in sessionStorage so a refresh doesn't lose the user's piece,
 * and emits loading/error states via callbacks.
 *
 * Endpoints (server.js will expose these):
 *   POST /api/generate-meditation { mood, duration, lang } -> { id, script, voice_register }
 *   POST /api/generate-story      { setting, duration, lang } -> { id, script, voice_register }
 *   POST /api/generate-breath     { goal, lang } -> { id, name, pattern, ratio, rounds, guidance }
 */
(function () {
  'use strict';

  var SS_KEYS = {
    meditation: 'sukoon.gen.meditation',
    story: 'sukoon.gen.story',
    breath: 'sukoon.gen.breath'
  };

  function _save(key, obj) {
    try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data: obj })); }
    catch (_) {}
  }
  function _load(key) {
    try {
      var raw = sessionStorage.getItem(key);
      if (!raw) return null;
      var p = JSON.parse(raw);
      return p && p.data ? p.data : null;
    } catch (_) { return null; }
  }

  function _Base(kind, endpoint, ssKey) {
    return function (opts) {
      opts = opts || {};
      this.apiBase = opts.apiBase || '';
      this.endpoint = endpoint;
      this.ssKey = ssKey;
      this.kind = kind;
      this.onLoading = opts.onLoading || null;
      this.onReady = opts.onReady || null;
      this.onError = opts.onError || null;
      this.tts = opts.tts || (window.SukoonTTS ? new window.SukoonTTS() : null);
      this._current = _load(ssKey);
      this._abort = null;
    };
  }

  function _generate(self, body) {
    if (self.onLoading) self.onLoading(true);
    if (self._abort && self._abort.abort) { try { self._abort.abort(); } catch (_) {} }
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    self._abort = ctrl;
    return fetch(self.apiBase + self.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error(self.kind + ' http ' + r.status);
      return r.json();
    }).then(function (j) {
      j.__source = 'made-just-now';
      self._current = j;
      _save(self.ssKey, j);
      if (self.onReady) self.onReady(j);
      if (self.onLoading) self.onLoading(false);
      return j;
    }).catch(function (err) {
      if (self.onLoading) self.onLoading(false);
      if (err && err.name === 'AbortError') return null;
      if (self.onError) self.onError(err);
      return null;
    });
  }

  // ---------- Meditation ----------
  var GenerativeMeditation = _Base('meditation', '/api/generate-meditation', SS_KEYS.meditation);
  GenerativeMeditation.prototype.generate = function (opts) {
    return _generate(this, {
      mood: opts && opts.mood,
      duration: (opts && opts.duration) || 300,
      lang: (opts && opts.lang) || 'en'
    });
  };
  GenerativeMeditation.prototype.play = function () {
    var c = this._current;
    if (!c || !this.tts) return false;
    var text = c.script_hi || c.script || c.script_en || '';
    var lang = c.lang || 'en';
    return this.tts.speak(text, { lang: lang, register: c.voice_register || 'gentle' });
  };
  GenerativeMeditation.prototype.current = function () { return this._current; };

  // ---------- Story ----------
  var GenerativeStory = _Base('story', '/api/generate-story', SS_KEYS.story);
  GenerativeStory.prototype.generate = function (opts) {
    return _generate(this, {
      setting: opts && opts.setting,
      duration: (opts && opts.duration) || 900,
      lang: (opts && opts.lang) || 'en'
    });
  };
  GenerativeStory.prototype.play = function () {
    var c = this._current;
    if (!c || !this.tts) return false;
    var text = c.script_hi || c.script || c.script_en || '';
    return this.tts.speak(text, {
      lang: c.lang || 'en',
      register: c.voice_register || 'grandmother-slow',
      rate: 0.85
    });
  };
  GenerativeStory.prototype.current = function () { return this._current; };

  // ---------- Breath ----------
  var GenerativeBreath = _Base('breath', '/api/generate-breath', SS_KEYS.breath);
  GenerativeBreath.prototype.generate = function (opts) {
    return _generate(this, {
      goal: opts && opts.goal,
      lang: (opts && opts.lang) || 'en'
    });
  };
  GenerativeBreath.prototype.play = function () {
    var c = this._current;
    if (!c || !this.tts) return false;
    var guidance = c.guidance_hi || c.guidance || c.guidance_en || c.name || '';
    return this.tts.speak(guidance, { lang: c.lang || 'en', register: 'low-stim-calm' });
  };
  GenerativeBreath.prototype.current = function () { return this._current; };

  window.GenerativeMeditation = GenerativeMeditation;
  window.GenerativeStory = GenerativeStory;
  window.GenerativeBreath = GenerativeBreath;
})();
