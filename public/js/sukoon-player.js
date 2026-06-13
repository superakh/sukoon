/* sukoon-player.js
 * TrackPlayer: unified player overlay for library items (meditations + stories).
 *
 * Reads a library item's JSON script, drives SukoonTTS, renders a breath ring
 * (in-hold-out cycle), scrubber, chapter dots, and asks the user for a mood
 * checkin pre-session and post-session (saved via SukoonEngine if present).
 *
 * Zero deps. Vanilla ES2017+. Exports window.SukoonPlayer.
 *
 * Public API:
 *   const player = new SukoonPlayer({ tts, library, engine });
 *   player.open(item);            // item from library (meditation or story)
 *   player.close();
 *   player.playPause();
 *   player.seekChapter(idx);
 */
(function () {
  'use strict';

  function TrackPlayer(opts) {
    opts = opts || {};
    this.tts = opts.tts || (window.SukoonTTS ? new window.SukoonTTS() : null);
    this.library = opts.library || null;
    this.engine = opts.engine || window.SukoonEngine || null;
    this.lang = opts.lang || (document.documentElement.lang || 'en').slice(0, 2);
    this._root = null;
    this._item = null;
    this._chapters = [];
    this._chapterIdx = 0;
    this._playing = false;
    this._elapsed = 0;
    this._tick = null;
    this._breathPhase = 'in';
    this._breathTimer = null;
    this._moodPre = null;
  }

  function _h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    if (kids) for (var i = 0; i < kids.length; i++) if (kids[i]) el.appendChild(kids[i]);
    return el;
  }

  TrackPlayer.prototype.open = function (item) {
    this.close();
    if (!item) return;
    this._item = item;
    this._chapters = this._parseChapters(item);
    this._chapterIdx = 0;
    this._elapsed = 0;
    this._root = this._build();
    document.body.appendChild(this._root);
    document.body.classList.add('sukoon-player-open');
    this._showMoodCheck('pre');
  };

  TrackPlayer.prototype.close = function () {
    if (this._root && this._root.parentNode) this._root.parentNode.removeChild(this._root);
    this._root = null;
    document.body.classList.remove('sukoon-player-open');
    if (this.tts) this.tts.stop();
    this._stopTick();
    this._stopBreath();
  };

  TrackPlayer.prototype._parseChapters = function (item) {
    var lang = this.lang;
    var script = item['script_' + lang] || item.script || item.script_en || item.body_en || item.body || '';
    if (Array.isArray(item.chapters) && item.chapters.length) {
      return item.chapters.map(function (c, i) {
        return {
          title: c['title_' + lang] || c.title || ('Part ' + (i + 1)),
          text: c['text_' + lang] || c.text || ''
        };
      });
    }
    // Otherwise split script by double-newline into pseudo-chapters
    var parts = String(script).split(/\n{2,}/).filter(function (s) { return s.trim(); });
    if (!parts.length) parts = [String(script)];
    return parts.map(function (p, i) { return { title: 'Part ' + (i + 1), text: p }; });
  };

  TrackPlayer.prototype._build = function () {
    var self = this;
    var item = this._item;
    var lang = this.lang;
    var title = item['title_' + lang] || item.title || item.title_en || 'Sukoon';
    var author = item.voice_register === 'library-curator' ? 'library' : (item.__source === 'made-just-now' ? 'made-just-now' : 'library-curator');

    var root = _h('div', { class: 'sukoon-player', role: 'dialog', 'aria-modal': 'true' });
    var card = _h('div', { class: 'sukoon-player__card' });

    var head = _h('header', { class: 'sukoon-player__head' });
    head.appendChild(_h('span', { class: 'sukoon-player__source', text: author }));
    head.appendChild(_h('h2', { class: 'sukoon-player__title', text: title }));
    var closeBtn = _h('button', { class: 'sukoon-player__close', type: 'button', 'aria-label': 'close', text: '×' });
    closeBtn.addEventListener('click', function () { self.close(); });
    head.appendChild(closeBtn);
    card.appendChild(head);

    var ring = _h('div', { class: 'sukoon-player__ring' });
    var ringInner = _h('div', { class: 'sukoon-player__ring-inner' });
    var ringLabel = _h('span', { class: 'sukoon-player__ring-label', text: 'breathe' });
    ringInner.appendChild(ringLabel);
    ring.appendChild(ringInner);
    card.appendChild(ring);
    this._ringEl = ring;
    this._ringLabelEl = ringLabel;

    var body = _h('section', { class: 'sukoon-player__body', 'aria-live': 'polite' });
    card.appendChild(body);
    this._bodyEl = body;
    if (this.tts) this.tts.highlightInto(body);

    var dots = _h('div', { class: 'sukoon-player__dots' });
    for (var i = 0; i < this._chapters.length; i++) {
      (function (idx) {
        var d = _h('button', { class: 'sukoon-player__dot', type: 'button', 'aria-label': 'chapter ' + (idx + 1) });
        d.addEventListener('click', function () { self.seekChapter(idx); });
        dots.appendChild(d);
      })(i);
    }
    card.appendChild(dots);
    this._dotsEl = dots;

    var scrubWrap = _h('div', { class: 'sukoon-player__scrubwrap' });
    var scrub = _h('input', { class: 'sukoon-player__scrub', type: 'range', min: '0', max: '1000', value: '0', step: '1' });
    scrub.addEventListener('input', function () {
      var pct = parseInt(scrub.value, 10) / 1000;
      var chapter = Math.floor(pct * self._chapters.length);
      if (chapter !== self._chapterIdx) self.seekChapter(chapter);
    });
    scrubWrap.appendChild(scrub);
    card.appendChild(scrubWrap);
    this._scrubEl = scrub;

    var controls = _h('div', { class: 'sukoon-player__controls' });
    var prev = _h('button', { class: 'sukoon-player__btn sukoon-player__btn--prev', type: 'button', text: '‹' });
    prev.addEventListener('click', function () { self.seekChapter(self._chapterIdx - 1); });
    var play = _h('button', { class: 'sukoon-player__btn sukoon-player__btn--play', type: 'button', text: 'Play' });
    play.addEventListener('click', function () { self.playPause(); });
    var next = _h('button', { class: 'sukoon-player__btn sukoon-player__btn--next', type: 'button', text: '›' });
    next.addEventListener('click', function () { self.seekChapter(self._chapterIdx + 1); });
    controls.appendChild(prev);
    controls.appendChild(play);
    controls.appendChild(next);
    card.appendChild(controls);
    this._playBtn = play;

    root.appendChild(card);
    return root;
  };

  TrackPlayer.prototype.playPause = function () {
    if (!this._item) return;
    if (this._playing) {
      this._playing = false;
      if (this.tts) this.tts.pause();
      if (this._playBtn) this._playBtn.textContent = 'Play';
      this._stopTick();
      this._stopBreath();
      return;
    }
    this._playing = true;
    if (this._playBtn) this._playBtn.textContent = 'Pause';
    this._renderChapter();
    this._startTick();
    this._startBreath();
  };

  TrackPlayer.prototype.seekChapter = function (idx) {
    if (!this._chapters.length) return;
    idx = Math.max(0, Math.min(this._chapters.length - 1, idx));
    this._chapterIdx = idx;
    if (this._playing) this._renderChapter();
    this._updateDots();
  };

  TrackPlayer.prototype._renderChapter = function () {
    var c = this._chapters[this._chapterIdx];
    if (!c) return;
    var self = this;
    if (this.tts) {
      this.tts.onEnd = function () {
        if (self._chapterIdx < self._chapters.length - 1) self.seekChapter(self._chapterIdx + 1);
        else self._onComplete();
      };
      this.tts.speak(c.text, {
        lang: this.lang,
        register: (this._item && this._item.voice_register) || 'gentle'
      });
    } else if (this._bodyEl) {
      this._bodyEl.textContent = c.text;
    }
    this._updateDots();
  };

  TrackPlayer.prototype._updateDots = function () {
    if (!this._dotsEl) return;
    var kids = this._dotsEl.children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('is-current', i === this._chapterIdx);
    }
    if (this._scrubEl && this._chapters.length) {
      var pct = this._chapterIdx / Math.max(1, this._chapters.length - 1);
      this._scrubEl.value = String(Math.round(pct * 1000));
    }
  };

  TrackPlayer.prototype._startTick = function () {
    var self = this;
    this._stopTick();
    this._tick = setInterval(function () { self._elapsed += 1; }, 1000);
  };
  TrackPlayer.prototype._stopTick = function () {
    if (this._tick) { clearInterval(this._tick); this._tick = null; }
  };

  // Breath ring: simple 4-in / 6-out cycle visualized by toggling a CSS class
  TrackPlayer.prototype._startBreath = function () {
    var self = this;
    this._stopBreath();
    var phases = [
      { name: 'in', ms: 4000, label: this.lang === 'hi' ? 'अंदर' : 'breathe in' },
      { name: 'out', ms: 6000, label: this.lang === 'hi' ? 'बाहर' : 'breathe out' }
    ];
    var i = 0;
    function step() {
      var p = phases[i % phases.length];
      if (self._ringEl) {
        self._ringEl.setAttribute('data-phase', p.name);
      }
      if (self._ringLabelEl) self._ringLabelEl.textContent = p.label;
      self._breathTimer = setTimeout(function () { i++; step(); }, p.ms);
    }
    step();
  };
  TrackPlayer.prototype._stopBreath = function () {
    if (this._breathTimer) { clearTimeout(this._breathTimer); this._breathTimer = null; }
    if (this._ringEl) this._ringEl.removeAttribute('data-phase');
  };

  TrackPlayer.prototype._onComplete = function () {
    this._playing = false;
    if (this._playBtn) this._playBtn.textContent = 'Play';
    this._stopTick();
    this._stopBreath();
    this._showMoodCheck('post');
  };

  TrackPlayer.prototype._showMoodCheck = function (when) {
    if (!this._root) return;
    var self = this;
    var lang = this.lang;
    var prompt = when === 'pre'
      ? (lang === 'hi' ? 'अभी कैसा महसूस हो रहा है?' : 'How are you feeling right now?')
      : (lang === 'hi' ? 'अब कैसा है?' : 'How is it now?');
    var existing = this._root.querySelector('.sukoon-player__mood');
    if (existing) existing.parentNode.removeChild(existing);
    var moodEl = _h('div', { class: 'sukoon-player__mood' });
    moodEl.appendChild(_h('p', { text: prompt }));
    var row = _h('div', { class: 'sukoon-player__mood-row' });
    var emojis = ['😞', '😕', '😐', '🙂', '😊'];
    emojis.forEach(function (e, i) {
      var b = _h('button', { type: 'button', class: 'sukoon-player__mood-btn', text: e, 'data-val': String(i + 1) });
      b.addEventListener('click', function () {
        var val = i + 1;
        if (when === 'pre') self._moodPre = val;
        if (self.engine && typeof self.engine.recordMood === 'function') {
          try { self.engine.recordMood({ when: when, value: val, itemId: self._item && self._item.id, pre: self._moodPre }); }
          catch (_) {}
        }
        moodEl.parentNode.removeChild(moodEl);
      });
      row.appendChild(b);
    });
    moodEl.appendChild(row);
    this._root.firstChild.appendChild(moodEl);
  };

  window.SukoonPlayer = TrackPlayer;
})();
