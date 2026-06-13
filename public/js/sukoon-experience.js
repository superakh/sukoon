/* ============================================================
   sukoon-experience.js
   The living layer of Sukoon: time-of-day scene, breath clock,
   ambient audio, souls counter, scroll reveal, language toggle.
   ------------------------------------------------------------
   Zero dependencies. Initialised by simply loading this file
   anywhere on a page (idempotent). Public API exposed on
   window.SukoonExperience for page-level hooks.
   ============================================================ */

(function () {
  'use strict';

  // ----------------------------------------------------------
  // 0. Environment guards & helpers
  // ----------------------------------------------------------
  const win  = typeof window !== 'undefined' ? window : null;
  const doc  = typeof document !== 'undefined' ? document : null;
  if (!win || !doc) return;

  const PREFERS_REDUCED_MOTION =
    win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SAVE_DATA =
    !!(win.navigator && win.navigator.connection && win.navigator.connection.saveData);

  // Tiny DOM builder so we never touch innerHTML with untrusted-shaped data.
  function el(tag, attrs, children) {
    const node = doc.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        const v = attrs[k];
        if (k === 'class')        node.className = v;
        else if (k === 'text')    node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.indexOf('data-') === 0 || k.indexOf('aria-') === 0)
          node.setAttribute(k, v);
        else if (k in node)       node[k] = v;
        else                       node.setAttribute(k, v);
      }
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(c => {
        if (c == null) return;
        node.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
      });
    }
    return node;
  }

  // localStorage helpers tolerant of private-mode failure.
  const storage = {
    get(key, fallback) {
      try { const v = win.localStorage.getItem(key); return v === null ? fallback : v; }
      catch (_) { return fallback; }
    },
    set(key, value) {
      try { win.localStorage.setItem(key, value); } catch (_) { /* noop */ }
    },
    remove(key) {
      try { win.localStorage.removeItem(key); } catch (_) { /* noop */ }
    }
  };

  // ----------------------------------------------------------
  // 1. Time-of-day scene picker
  // ----------------------------------------------------------
  function getTimeOfDay(now) {
    const h = (now || new Date()).getHours();
    if (h >= 4  && h < 8)  return 'dawn';
    if (h >= 8  && h < 18) return 'day';
    if (h >= 18 && h < 21) return 'dusk';
    if (h >= 21 || h < 1)  return 'night';
    return 'late'; // 01:00 - 03:59
  }

  function setTimeOfDayClass(force) {
    const html = doc.documentElement;
    const body = doc.body;
    if (!body) return null;

    let tod = force || getTimeOfDay();

    // Page-level overrides.
    const path = (win.location && win.location.pathname || '').toLowerCase();
    if (path.endsWith('sleep.html')) tod = 'night';
    if (path.endsWith('sos.html'))   tod = 'late';

    html.setAttribute('data-tod', tod);
    ['dawn','day','dusk','night','late'].forEach(t => body.classList.remove('scene-' + t));
    body.classList.add('scene-' + tod);
    return tod;
  }

  function watchTimeOfDay() {
    let current = setTimeOfDayClass();
    win.setInterval(() => {
      const next = setTimeOfDayClass();
      if (next !== current) current = next;
    }, 5 * 60 * 1000);
  }

  // ----------------------------------------------------------
  // 2. Global breath clock
  //    Publishes --sk-breath-phase (0→1→0) to :root on a 4-2-6
  //    cycle. Pattern is mutable so pages can retune it.
  // ----------------------------------------------------------
  const Breath = {
    pattern: { inhale: 4000, hold1: 2000, exhale: 6000, hold2: 0 },
    _running: false,
    _start: null,

    setPattern(p) {
      this.pattern = Object.assign({ inhale: 4000, hold1: 0, exhale: 4000, hold2: 0 }, p || {});
    },

    start() {
      if (this._running) return;
      this._running = true;
      this._start = performance.now();
      const tick = (t) => {
        if (!this._running) return;
        const { inhale, hold1, exhale, hold2 } = this.pattern;
        const cycle = Math.max(1, inhale + hold1 + exhale + hold2);
        const elapsed = (t - this._start) % cycle;
        let phase;
        if (elapsed < inhale) {
          phase = inhale ? elapsed / inhale : 1;
        } else if (elapsed < inhale + hold1) {
          phase = 1;
        } else if (elapsed < inhale + hold1 + exhale) {
          phase = exhale ? 1 - (elapsed - inhale - hold1) / exhale : 0;
        } else {
          phase = 0;
        }
        doc.documentElement.style.setProperty('--sk-breath-phase', phase.toFixed(3));
        win.requestAnimationFrame(tick);
      };
      win.requestAnimationFrame(tick);
    },

    stop() { this._running = false; }
  };

  // ----------------------------------------------------------
  // 3. Breath ball — JS-pulsed brand mark
  //    Accepts elementId + named pattern preset.
  // ----------------------------------------------------------
  const BREATH_PRESETS = {
    box:      { inhale: 4000, hold1: 4000, exhale: 4000, hold2: 4000 },
    '478':    { inhale: 4000, hold1: 7000, exhale: 8000, hold2: 0    },
    deep:     { inhale: 4000, hold1: 2000, exhale: 6000, hold2: 0    },
    free:     { inhale: 4000, hold1: 0,    exhale: 4000, hold2: 0    },
    bhramari: { inhale: 6000, hold1: 2000, exhale: 8000, hold2: 0    }
  };

  function BreathBall(elementId, patternName) {
    const host = typeof elementId === 'string' ? doc.getElementById(elementId) : elementId;
    if (!host) return null;

    const pattern = BREATH_PRESETS[patternName] || BREATH_PRESETS.deep;
    let ring = host.querySelector('.breath-ball__ring');
    if (!ring) {
      ring = el('span', { class: 'breath-ball__ring' });
      host.appendChild(ring);
    }

    let raf = 0;
    const start = performance.now();
    function step(t) {
      const cycle = pattern.inhale + pattern.hold1 + pattern.exhale + pattern.hold2;
      const e = (t - start) % cycle;
      let scale, opacity;
      if (e < pattern.inhale) {
        const p = pattern.inhale ? e / pattern.inhale : 1;
        scale = 0.85 + p * 0.25;
        opacity = 0.55 + p * 0.4;
      } else if (e < pattern.inhale + pattern.hold1) {
        scale = 1.10; opacity = 0.95;
      } else if (e < pattern.inhale + pattern.hold1 + pattern.exhale) {
        const p = (e - pattern.inhale - pattern.hold1) / pattern.exhale;
        scale = 1.10 - p * 0.25;
        opacity = 0.95 - p * 0.4;
      } else {
        scale = 0.85; opacity = 0.55;
      }
      ring.style.transform = 'scale(' + scale.toFixed(3) + ')';
      ring.style.opacity   = opacity.toFixed(3);
      raf = win.requestAnimationFrame(step);
    }
    raf = win.requestAnimationFrame(step);

    return {
      el: host, ring, pattern,
      stop() { if (raf) win.cancelAnimationFrame(raf); }
    };
  }

  // ----------------------------------------------------------
  // 4. Ambient audio controller
  //    - respects user mute persisted in localStorage
  //    - per-page <audio id="ambient"> tag
  //    - floating UI pill at bottom-left
  // ----------------------------------------------------------
  const AMBIENT_MUTE_KEY    = 'sukoon_ambient_mute';
  const AMBIENT_VOLUME_KEY  = 'sk:ambient:volume';
  const AMBIENT_TOOLTIP_KEY = 'sk:ambient:tooltip-seen';

  class AmbientAudio {
    constructor(opts) {
      opts = opts || {};
      this.audio = doc.getElementById(opts.audioId || 'ambient');
      if (!this.audio) return;

      this.muted  = storage.get(AMBIENT_MUTE_KEY, '1') === '1';
      this.volume = parseFloat(storage.get(AMBIENT_VOLUME_KEY, '0.3')) || 0.3;

      this.audio.loop    = true;
      this.audio.preload = 'metadata';
      this.audio.volume  = this.muted ? 0 : this.volume;

      this._buildPill();
      this._applyState();
    }

    _buildPill() {
      let pill = doc.querySelector('.ambient-audio__pill');
      if (!pill) {
        pill = el('button', {
          type: 'button',
          class: 'ambient-audio__pill',
          'aria-label': 'Toggle ambient sound'
        }, [
          el('span', { class: 'ambient-audio__icon', 'aria-hidden': 'true', text: '♫' }),
          el('span', { class: 'ambient-audio__label', text: 'Sound' })
        ]);
        Object.assign(pill.style, {
          position: 'fixed', left: '24px', bottom: '24px', zIndex: '60'
        });
        doc.body.appendChild(pill);
      }
      this.pill = pill;
      pill.addEventListener('click', () => this.toggle());

      // First-tap tooltip.
      if (!storage.get(AMBIENT_TOOLTIP_KEY)) {
        const tip = el('span', {
          class: 'ambient-audio__tip',
          text: 'Plays only on this page. Off everywhere by default.'
        });
        Object.assign(tip.style, {
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '0',
          background: 'rgba(15,27,61,0.92)', color: 'var(--sk-cream)',
          padding: '8px 12px', borderRadius: '12px', fontSize: '11px',
          whiteSpace: 'nowrap', pointerEvents: 'none', opacity: '0',
          transition: 'opacity 400ms'
        });
        pill.style.position = 'fixed';
        pill.appendChild(tip);
        requestAnimationFrame(() => { tip.style.opacity = '1'; });
        pill.addEventListener('click', () => {
          storage.set(AMBIENT_TOOLTIP_KEY, '1');
          tip.style.opacity = '0';
          setTimeout(() => tip.remove(), 500);
        }, { once: true });
      }
    }

    _applyState() {
      const state = this.muted ? 'off' : 'on';
      if (this.pill) this.pill.setAttribute('data-state', state);
      this.audio.volume = this.muted ? 0 : this.volume;
      if (this.muted) {
        this.audio.pause();
      } else {
        const p = this.audio.play();
        if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay blocked */ });
      }
    }

    toggle() {
      this.muted = !this.muted;
      storage.set(AMBIENT_MUTE_KEY, this.muted ? '1' : '0');
      this._applyState();
    }

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      storage.set(AMBIENT_VOLUME_KEY, String(this.volume));
      if (!this.muted) this.audio.volume = this.volume;
    }

    fadeOut(duration) {
      duration = duration || 800;
      const start = this.audio.volume;
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / duration);
        this.audio.volume = start * (1 - k);
        if (k < 1) win.requestAnimationFrame(step);
        else this.audio.pause();
      };
      win.requestAnimationFrame(step);
    }
  }

  // ----------------------------------------------------------
  // 5. Souls counter
  //    Privacy-preserving: no network. Drifts based on hour-of-day
  //    baseline plus localStorage anchor that ticks 1–3/min.
  // ----------------------------------------------------------
  const SOULS_KEY  = 'sukoon_active_souls';
  const SOULS_BASE = 187;

  function _soulsHourBaseline() {
    const hour = new Date().getHours();
    const table = [340,280,230,200,220,310,480,720,890,950,980,1020,
                   1100,1080,1050,1080,1140,1280,1420,1580,1640,1520,980,620];
    return table[hour] || SOULS_BASE;
  }

  function _readSoulsAnchor() {
    const raw = storage.get(SOULS_KEY);
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      if (typeof obj.value === 'number' && typeof obj.t === 'number') return obj;
    } catch (_) { /* corrupt */ }
    return null;
  }

  function _writeSoulsAnchor(value) {
    storage.set(SOULS_KEY, JSON.stringify({ value: value, t: Date.now() }));
  }

  function currentSoulsCount() {
    const baseline = _soulsHourBaseline();
    let anchor = _readSoulsAnchor();
    const now = Date.now();
    if (!anchor) {
      const seeded = Math.max(SOULS_BASE, baseline + Math.round((Math.random() - 0.5) * 40));
      _writeSoulsAnchor(seeded);
      return seeded;
    }
    // Drift 1–3 souls per minute since last anchor, biased to follow hourly baseline.
    const minutesElapsed = Math.max(0, (now - anchor.t) / 60000);
    const drift = Math.round(minutesElapsed * (1 + Math.random() * 2));
    let next = anchor.value + drift * (anchor.value < baseline ? 1 : (Math.random() < 0.6 ? -1 : 1));
    // Light pull toward baseline so we don't escape it.
    next = Math.round(next * 0.85 + baseline * 0.15);
    // Floor at SOULS_BASE.
    next = Math.max(SOULS_BASE, next);
    _writeSoulsAnchor(next);
    return next;
  }

  function SoulsCounter(elementId) {
    const host = typeof elementId === 'string' ? doc.getElementById(elementId) : elementId;
    if (!host) return null;

    let countEl = host.querySelector('.souls-counter__count');
    if (!countEl) {
      host.classList.add('souls-counter');
      // Build the structure with safe DOM nodes (no innerHTML).
      while (host.firstChild) host.removeChild(host.firstChild);
      host.appendChild(el('span', { class: 'souls-counter__dot', 'aria-hidden': 'true' }));
      countEl = el('span', { class: 'souls-counter__count', text: String(currentSoulsCount()) });
      host.appendChild(countEl);
      host.appendChild(el('span', { class: 'souls-counter__label', text: 'in sukoon right now' }));
    } else {
      countEl.textContent = String(currentSoulsCount());
    }

    const interval = win.setInterval(() => {
      const next = currentSoulsCount();
      countEl.classList.remove('is-ticking');
      // Force reflow then re-add to retrigger animation.
      void countEl.offsetWidth;
      countEl.classList.add('is-ticking');
      countEl.textContent = String(next);
    }, 30000);

    return {
      el: host, countEl,
      stop() { win.clearInterval(interval); }
    };
  }

  // ----------------------------------------------------------
  // 6. Scroll-reveal observer
  // ----------------------------------------------------------
  let _revealObserver = null;
  function revealOnScroll(selector) {
    selector = selector || '.sk-reveal, .reveal-up';
    const targets = Array.prototype.slice.call(doc.querySelectorAll(selector));
    if (!targets.length) return;

    // Set stagger index so CSS delay applies.
    targets.forEach((t, i) => {
      if (t.parentElement && t.parentElement.classList.contains('sk-stagger')) {
        t.style.setProperty('--i', i);
      }
    });

    if (!('IntersectionObserver' in win) || PREFERS_REDUCED_MOTION) {
      targets.forEach(t => {
        t.classList.add('is-visible');
        t.classList.add('is-revealed');
      });
      return;
    }

    if (!_revealObserver) {
      _revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            entry.target.classList.add('is-revealed');
            _revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
    }
    targets.forEach(t => _revealObserver.observe(t));
  }

  // ----------------------------------------------------------
  // 7. Language toggle (A · अ)
  // ----------------------------------------------------------
  const LANG_KEY = 'sukoon-lang';

  function _applyLang(lang) {
    doc.documentElement.setAttribute('lang', lang);
    doc.documentElement.setAttribute('data-lang', lang);

    const nodes = doc.querySelectorAll('[data-en], [data-hi]');
    nodes.forEach(node => {
      const text = node.getAttribute('data-' + lang);
      if (text == null) return;
      // Vertical-flip swap, batched (textContent only — never innerHTML).
      node.style.transition = 'opacity 200ms var(--sk-ease-calm, ease), transform 200ms var(--sk-ease-calm, ease)';
      node.style.opacity = '0';
      node.style.transform = 'translateY(-8px)';
      win.setTimeout(() => {
        node.textContent = text;
        node.style.transform = 'translateY(8px)';
        win.requestAnimationFrame(() => {
          node.style.opacity = '1';
          node.style.transform = 'translateY(0)';
        });
      }, 200);
    });

    const toggle = doc.querySelector('.lang-toggle, .sk-lang');
    if (toggle) {
      toggle.querySelectorAll('[data-lang-opt]').forEach(opt => {
        opt.setAttribute('aria-current', opt.getAttribute('data-lang-opt') === lang ? 'true' : 'false');
      });
    }
  }

  const LangToggle = {
    get current() {
      return storage.get(LANG_KEY, doc.documentElement.lang || 'en');
    },
    set(lang) {
      if (lang !== 'en' && lang !== 'hi') return;
      storage.set(LANG_KEY, lang);
      _applyLang(lang);
    },
    toggle() {
      this.set(this.current === 'en' ? 'hi' : 'en');
    },
    mount(selector) {
      const host = typeof selector === 'string' ? doc.querySelector(selector) : selector;
      if (!host) return;

      if (!host.querySelector('[data-lang-opt]')) {
        host.classList.add('lang-toggle');
        while (host.firstChild) host.removeChild(host.firstChild);
        host.appendChild(el('span', { class: 'lang-toggle__opt', 'data-lang-opt': 'en', text: 'A' }));
        host.appendChild(el('span', { class: 'lang-toggle__sep', text: '·' }));
        host.appendChild(el('span', { class: 'lang-toggle__opt', 'data-lang-opt': 'hi', text: 'अ' }));
      }
      host.addEventListener('click', (e) => {
        const opt = e.target.closest('[data-lang-opt]');
        if (opt) this.set(opt.getAttribute('data-lang-opt'));
        else this.toggle();
      });
      _applyLang(this.current);
    }
  };

  // ----------------------------------------------------------
  // 8. Diya streak (lightweight; safe defaults)
  //    Reads/writes sukoon.journey in localStorage.
  // ----------------------------------------------------------
  const JOURNEY_KEY = 'sukoon.journey';

  function readJourney() {
    const raw = storage.get(JOURNEY_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function writeJourney(j) {
    storage.set(JOURNEY_KEY, JSON.stringify(j));
  }

  function updateStreak() {
    const today = new Date().toISOString().slice(0, 10);
    let j = readJourney();
    if (!j) {
      j = {
        firstVisit: today, lastVisit: today, streakDays: 1,
        longestStreak: 1, totalSessions: 1,
        pagesVisited: [], moodHistory: [], achievements: []
      };
    } else {
      const last = j.lastVisit || today;
      const diff = Math.round((Date.parse(today) - Date.parse(last)) / 86400000);
      j.totalSessions = (j.totalSessions || 0) + 1;
      if (diff === 0) {
        // same day, no streak change
      } else if (diff === 1) {
        j.streakDays = (j.streakDays || 0) + 1;
      } else {
        j.streakDays = 1;
      }
      j.lastVisit = today;
      j.longestStreak = Math.max(j.longestStreak || 0, j.streakDays || 0);
    }
    writeJourney(j);
    return j;
  }

  // ----------------------------------------------------------
  // 9. Boot
  // ----------------------------------------------------------
  function boot() {
    setTimeOfDayClass();
    watchTimeOfDay();

    // Start the global breath clock unless explicitly opted out.
    if (!doc.documentElement.hasAttribute('data-no-breath')) {
      Breath.start();
    }

    // Auto-mount scroll reveal once DOM is ready.
    revealOnScroll();

    // Auto-mount souls counter / language toggle if matching nodes exist.
    const soulsEl = doc.querySelector('.souls-counter[data-auto], #souls-counter');
    if (soulsEl) SoulsCounter(soulsEl);

    const langEl = doc.querySelector('.lang-toggle[data-auto], #lang-toggle');
    if (langEl) LangToggle.mount(langEl);

    // Auto-mount ambient audio if a page declares <audio id="ambient"> or [data-audio].
    let ambientNode = doc.getElementById('ambient');
    if (!ambientNode) {
      const declMount = doc.querySelector('[data-audio]');
      if (declMount) {
        const src = declMount.getAttribute('data-audio');
        const created = doc.createElement('audio');
        created.id = 'ambient';
        created.src = src;
        created.loop = true;
        created.preload = 'none';
        declMount.appendChild(created);
        ambientNode = created;
      }
    }
    if (ambientNode) {
      try { new AmbientAudio(); } catch (_) { /* noop */ }
    }

    // Quietly update streak on every page load.
    try { updateStreak(); } catch (_) { /* noop */ }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // ----------------------------------------------------------
  // 10. Public API
  // ----------------------------------------------------------
  win.SukoonExperience = {
    // Time-of-day
    getTimeOfDay: getTimeOfDay,
    setTimeOfDayClass: setTimeOfDayClass,
    // Breath
    Breath: Breath,
    BreathBall: BreathBall,
    BREATH_PRESETS: BREATH_PRESETS,
    // Audio
    AmbientAudio: AmbientAudio,
    // Souls
    SoulsCounter: SoulsCounter,
    currentSoulsCount: currentSoulsCount,
    // Reveal
    revealOnScroll: revealOnScroll,
    // Language
    LangToggle: LangToggle,
    // Journey
    readJourney: readJourney,
    updateStreak: updateStreak,
    // Environment flags
    prefersReducedMotion: PREFERS_REDUCED_MOTION,
    saveData: SAVE_DATA
  };

})();
