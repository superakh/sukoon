/* sukoon-router.js
 * EntryRouter: routes a user's natural-language entry phrase to the right
 * experience (meditation / story / breath / crisis / pulse).
 *
 * Zero dependencies. Vanilla ES2017+. Exports window.SukoonRouter.
 *
 * Responsibilities:
 *   - POST /api/route with the typed/spoken phrase + language + mood snapshot
 *   - Navigate via location.hash so back/forward works
 *   - HARD-CODED crisis-word interception BEFORE any network call
 *   - Web Speech API mic capture (EN-IN + HI-IN), with graceful fallback
 *
 * Public API:
 *   const r = new SukoonRouter({ apiBase, onRoute, onCrisis });
 *   r.bind(formEl, inputEl, micBtnEl);
 *   r.route(phrase);                  // programmatic
 *   r.startMic(); r.stopMic();
 *   SukoonRouter.CRISIS_PHRASES       // exposed for tests
 */
(function () {
  'use strict';

  // ~50 crisis trigger phrases. Lowercased, accent-stripped at compare time.
  // Kept INLINE per spec — sukoon-safety.js shares this list but router must
  // intercept before any /api/route call so we duplicate the minimum here.
  var CRISIS_PHRASES = [
    // English — direct
    'kill myself', 'killing myself', 'want to die', 'wanna die',
    'end my life', 'end it all', 'suicide', 'suicidal',
    'cant go on', "can't go on", 'cant do this anymore', "can't do this anymore",
    'no reason to live', 'no point living', 'better off dead',
    'hurt myself', 'cut myself', 'self harm', 'self-harm',
    'overdose', 'jump off', 'hang myself',
    'nobody would miss me', 'nobody cares if i die',
    // English — softer
    'i give up', 'i am done', "i'm done with life",
    "don't want to be here", 'dont want to be here',
    'tired of living', 'tired of being alive',
    // Hindi — Devanagari
    'मरना चाहता', 'मरना चाहती', 'मर जाऊं', 'मर जाऊँ',
    'जान दे', 'जान देना', 'खुदकुशी', 'आत्महत्या',
    'जीना नहीं', 'जीने का मन नहीं', 'जीने को मन नहीं',
    'खुद को मार', 'खुद को नुकसान',
    // Hindi — romanized
    'marna chahta', 'marna chahti', 'mar jaun', 'mar jaaun',
    'jaan de', 'jaan dena', 'khudkushi', 'aatmahatya', 'atmahatya',
    'jeena nahi', 'jeena nai', 'jeene ka mann nahi',
    'khud ko maar', 'apne aap ko maar',
    'bahut tang aa gaya', 'bahut thak gaya hoon'
  ];

  function _stripAccents(s) {
    try { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    catch (_) { return s; }
  }
  function _norm(s) {
    return _stripAccents(String(s || '').toLowerCase()).replace(/\s+/g, ' ').trim();
  }

  function detectCrisis(phrase) {
    var n = _norm(phrase);
    if (!n) return null;
    for (var i = 0; i < CRISIS_PHRASES.length; i++) {
      var p = _norm(CRISIS_PHRASES[i]);
      if (p && n.indexOf(p) !== -1) return CRISIS_PHRASES[i];
    }
    return null;
  }

  function EntryRouter(opts) {
    opts = opts || {};
    this.apiBase = opts.apiBase || '';
    this.onRoute = typeof opts.onRoute === 'function' ? opts.onRoute : null;
    this.onCrisis = typeof opts.onCrisis === 'function' ? opts.onCrisis : null;
    this.lang = opts.lang || (document.documentElement.lang || 'en').slice(0, 2);
    this._rec = null;
    this._listening = false;
    this._lastPhrase = '';
    this._abort = null;
  }

  EntryRouter.prototype.bind = function (formEl, inputEl, micBtnEl) {
    var self = this;
    if (formEl) {
      formEl.addEventListener('submit', function (e) {
        e.preventDefault();
        self.route(inputEl ? inputEl.value : '');
      });
    }
    if (micBtnEl) {
      micBtnEl.addEventListener('click', function () {
        if (self._listening) self.stopMic();
        else self.startMic(function (txt) {
          if (inputEl) inputEl.value = txt;
          self.route(txt);
        });
      });
    }
    // Restore deep-link on hash change
    window.addEventListener('hashchange', function () { self._applyHash(); });
    this._applyHash();
  };

  EntryRouter.prototype._applyHash = function () {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return;
    var parts = h.split('/');
    if (this.onRoute) {
      this.onRoute({ source: 'hash', kind: parts[0], id: parts[1] || null, params: {} });
    }
  };

  EntryRouter.prototype.route = function (phrase) {
    phrase = String(phrase || '').trim();
    if (!phrase) return Promise.resolve(null);
    this._lastPhrase = phrase;

    // HARD-CODED crisis interception BEFORE any network call
    var hit = detectCrisis(phrase);
    if (hit) {
      var payload = { phrase: phrase, match: hit, lang: this.lang, ts: Date.now() };
      if (this.onCrisis) this.onCrisis(payload);
      // Also fire global event so sukoon-safety can latch on regardless of order
      try {
        window.dispatchEvent(new CustomEvent('sukoon:crisis', { detail: payload }));
      } catch (_) { /* IE fallback unused */ }
      return Promise.resolve({ kind: 'crisis', match: hit });
    }

    var self = this;
    if (this._abort && typeof this._abort.abort === 'function') {
      try { this._abort.abort(); } catch (_) {}
    }
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    this._abort = ctrl;

    var body = JSON.stringify({
      phrase: phrase,
      lang: this.lang,
      mood: (window.SukoonEngine && window.SukoonEngine.lastMood) || null,
      ts: Date.now()
    });

    return fetch(this.apiBase + '/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error('route http ' + r.status);
      return r.json();
    }).then(function (j) {
      // Expected: { kind, id?, params? }  e.g. { kind:'meditation', id:'med-007' }
      if (j && j.kind) {
        var hash = '#' + j.kind + (j.id ? '/' + j.id : '');
        if (location.hash !== hash) location.hash = hash;
        if (self.onRoute) self.onRoute({ source: 'api', kind: j.kind, id: j.id || null, params: j.params || {} });
      }
      return j;
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return null;
      // Fallback: go to library "open" view, no crash
      if (self.onRoute) self.onRoute({ source: 'fallback', kind: 'library', id: null, params: { q: phrase } });
      return { kind: 'library', error: String(err && err.message || err) };
    });
  };

  EntryRouter.prototype.startMic = function (onFinal) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      if (this.onRoute) this.onRoute({ source: 'mic-unavailable', kind: 'noop', id: null, params: {} });
      return false;
    }
    if (this._listening) return true;
    var rec = new SR();
    rec.lang = (this.lang === 'hi') ? 'hi-IN' : 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    var self = this;
    rec.onresult = function (e) {
      var t = '';
      for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      if (typeof onFinal === 'function') onFinal(t.trim());
    };
    rec.onend = function () { self._listening = false; self._rec = null; };
    rec.onerror = function () { self._listening = false; self._rec = null; };
    try { rec.start(); this._rec = rec; this._listening = true; return true; }
    catch (_) { return false; }
  };

  EntryRouter.prototype.stopMic = function () {
    if (this._rec) { try { this._rec.stop(); } catch (_) {} }
    this._rec = null; this._listening = false;
  };

  EntryRouter.detectCrisis = detectCrisis;
  EntryRouter.CRISIS_PHRASES = CRISIS_PHRASES;

  window.SukoonRouter = EntryRouter;
})();
