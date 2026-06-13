/* sukoon-tts.js
 * BrowserTTS: thin wrapper over window.speechSynthesis with the niceties
 * Sukoon needs - EN-IN + HI-IN voice selection, play/pause/resume/skip,
 * current-word highlight via onboundary, and pause-on-visibilitychange.
 *
 * Zero deps. Vanilla ES2017+. Exports window.SukoonTTS (aka BrowserTTS).
 *
 * Public API:
 *   const tts = new SukoonTTS({ onWord, onEnd, onError });
 *   tts.speak(text, { lang:'hi', rate:0.9, pitch:1, register:'gentle' });
 *   tts.pause(); tts.resume(); tts.skip(); tts.stop();
 *   tts.highlightInto(elem);
 *   tts.voicesFor('hi')
 */
(function () {
  'use strict';

  var REGISTER_PRESETS = {
    'gentle':            { rate: 0.92, pitch: 1.0,  volume: 1.0 },
    'low-stim-calm':     { rate: 0.85, pitch: 0.95, volume: 0.95 },
    'grandmother-slow':  { rate: 0.78, pitch: 0.95, volume: 1.0 },
    'wise-elder':        { rate: 0.85, pitch: 0.9,  volume: 1.0 },
    'morning-bright':    { rate: 1.0,  pitch: 1.05, volume: 1.0 }
  };

  function BrowserTTS(opts) {
    opts = opts || {};
    this.synth = window.speechSynthesis || null;
    this.onWord = opts.onWord || null;
    this.onEnd = opts.onEnd || null;
    this.onError = opts.onError || null;
    this._utter = null;
    this._words = [];
    this._wordOffsets = [];
    this._highlightEl = null;
    this._currentText = '';
    this._currentOpts = null;
    this._cursor = 0;
    var self = this;

    document.addEventListener('visibilitychange', function () {
      if (!self.synth) return;
      if (document.hidden) { try { self.synth.pause(); } catch (_) {} }
      else { try { self.synth.resume(); } catch (_) {} }
    });

    if (this.synth && typeof this.synth.addEventListener === 'function') {
      this.synth.addEventListener('voiceschanged', function () { });
    }
  }

  BrowserTTS.prototype.available = function () { return !!this.synth; };

  BrowserTTS.prototype.voicesFor = function (lang) {
    if (!this.synth) return [];
    var all = this.synth.getVoices() || [];
    var want = (lang === 'hi') ? 'hi' : 'en';
    var preferred = (lang === 'hi') ? ['hi-IN'] : ['en-IN', 'en-GB', 'en-US'];
    var matches = all.filter(function (v) {
      var l = (v.lang || '').toLowerCase();
      return l.indexOf(want) === 0;
    });
    matches.sort(function (a, b) {
      var ai = preferred.indexOf(a.lang); if (ai < 0) ai = 999;
      var bi = preferred.indexOf(b.lang); if (bi < 0) bi = 999;
      return ai - bi;
    });
    return matches;
  };

  BrowserTTS.prototype._pickVoice = function (lang) {
    var vs = this.voicesFor(lang);
    return vs.length ? vs[0] : null;
  };

  BrowserTTS.prototype.highlightInto = function (el) {
    this._highlightEl = el || null;
  };

  function _esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  BrowserTTS.prototype._renderHighlight = function (text) {
    if (!this._highlightEl) return;
    this._words = [];
    this._wordOffsets = [];
    var re = /\S+/g, m;
    var html = '';
    var last = 0;
    while ((m = re.exec(text)) !== null) {
      var w = m[0];
      var i = m.index;
      html += _esc(text.slice(last, i));
      html += '<span data-w="' + this._words.length + '">' + _esc(w) + '</span>';
      this._words.push(w);
      this._wordOffsets.push(i);
      last = i + w.length;
    }
    html += _esc(text.slice(last));
    this._highlightEl.innerHTML = html;
  };

  BrowserTTS.prototype.speak = function (text, opts) {
    if (!this.synth || !text) return false;
    this.stop();
    opts = opts || {};
    var preset = REGISTER_PRESETS[opts.register] || REGISTER_PRESETS.gentle;
    var u = new SpeechSynthesisUtterance(text);
    u.lang = (opts.lang === 'hi') ? 'hi-IN' : 'en-IN';
    u.rate = opts.rate || preset.rate;
    u.pitch = opts.pitch || preset.pitch;
    u.volume = (opts.volume == null) ? preset.volume : opts.volume;
    var v = this._pickVoice(opts.lang || 'en');
    if (v) u.voice = v;
    this._currentText = text;
    this._currentOpts = opts;
    this._cursor = 0;
    this._renderHighlight(text);

    var self = this;
    u.onboundary = function (e) {
      if (e.name !== 'word' && e.name !== 'sentence') return;
      self._cursor = e.charIndex || 0;
      var idx = -1;
      for (var i = 0; i < self._wordOffsets.length; i++) {
        if (self._wordOffsets[i] <= e.charIndex) idx = i; else break;
      }
      if (self._highlightEl && idx >= 0) {
        var prev = self._highlightEl.querySelector('span[data-w].is-current');
        if (prev) prev.classList.remove('is-current');
        var cur = self._highlightEl.querySelector('span[data-w="' + idx + '"]');
        if (cur) cur.classList.add('is-current');
      }
      if (self.onWord) self.onWord({ index: idx, word: self._words[idx], charIndex: e.charIndex });
    };
    u.onend = function () { if (self.onEnd) self.onEnd(); };
    u.onerror = function (e) { if (self.onError) self.onError(e); };
    this._utter = u;
    try { this.synth.speak(u); return true; }
    catch (_) { return false; }
  };

  BrowserTTS.prototype.pause = function () { if (this.synth) try { this.synth.pause(); } catch (_) {} };
  BrowserTTS.prototype.resume = function () { if (this.synth) try { this.synth.resume(); } catch (_) {} };
  BrowserTTS.prototype.stop = function () {
    if (this.synth) try { this.synth.cancel(); } catch (_) {}
    this._utter = null;
  };

  BrowserTTS.prototype.skip = function (chars) {
    if (!this._currentText) return false;
    chars = chars || 200;
    var nextStart = Math.min(this._currentText.length, (this._cursor || 0) + chars);
    var snap = this._currentText.indexOf('.', nextStart);
    if (snap !== -1 && snap - nextStart < 120) nextStart = snap + 1;
    var rest = this._currentText.slice(nextStart).trim();
    if (!rest) { this.stop(); if (this.onEnd) this.onEnd(); return false; }
    var opts = this._currentOpts || {};
    return this.speak(rest, opts);
  };

  BrowserTTS.REGISTER_PRESETS = REGISTER_PRESETS;
  window.SukoonTTS = BrowserTTS;
  window.BrowserTTS = BrowserTTS;
})();
