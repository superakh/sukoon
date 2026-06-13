/* sukoon-pulse.js
 * PulseTicker: polls GET /api/pulse every 30s and renders a single-digit
 * animated slide-up "people calming with us right now" counter.
 *
 * Zero deps. Vanilla ES2017+. Exports window.SukoonPulse.
 *
 * One shared poller per page - multiple .mount() calls all read from the
 * same fetch loop so we never thunder the server.
 *
 * Public API:
 *   const p = new SukoonPulse({ apiBase, intervalMs: 30000 });
 *   p.mount(elem);                  // renders into elem
 *   p.unmount(elem);
 *   p.start(); p.stop();
 *   p.onUpdate(fn);                 // subscribe to raw payloads
 */
(function () {
  'use strict';

  var SHARED = null;

  function PulseTicker(opts) {
    opts = opts || {};
    this.apiBase = opts.apiBase || '';
    this.intervalMs = opts.intervalMs || 30000;
    this._mounts = [];
    this._subs = [];
    this._timer = null;
    this._last = null;
    this._stopped = true;
    if (SHARED && SHARED.apiBase === this.apiBase) return SHARED;
    SHARED = this;
  }

  PulseTicker.prototype.start = function () {
    if (!this._stopped) return;
    this._stopped = false;
    var self = this;
    var tick = function () {
      if (self._stopped) return;
      self._fetch().then(function () {
        if (self._stopped) return;
        self._timer = setTimeout(tick, self.intervalMs);
      });
    };
    tick();
  };

  PulseTicker.prototype.stop = function () {
    this._stopped = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  };

  PulseTicker.prototype._fetch = function () {
    var self = this;
    return fetch(this.apiBase + '/api/pulse', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        self._last = j;
        for (var i = 0; i < self._mounts.length; i++) self._render(self._mounts[i], j);
        for (var k = 0; k < self._subs.length; k++) {
          try { self._subs[k](j); } catch (_) {}
        }
      })
      .catch(function () { });
  };

  function _ensureSkeleton(el) {
    if (el.querySelector('.sukoon-pulse__count')) return;
    while (el.firstChild) el.removeChild(el.firstChild);

    var dot = document.createElement('span');
    dot.className = 'sukoon-pulse__dot';
    dot.setAttribute('aria-hidden', 'true');

    var count = document.createElement('span');
    count.className = 'sukoon-pulse__count';
    count.setAttribute('aria-live', 'polite');

    var digits = document.createElement('span');
    digits.className = 'sukoon-pulse__digits';
    count.appendChild(digits);

    var label = document.createElement('span');
    label.className = 'sukoon-pulse__label';
    label.textContent = 'finding sukoon right now';

    el.appendChild(dot);
    el.appendChild(count);
    el.appendChild(label);
  }

  PulseTicker.prototype.mount = function (el) {
    if (!el) return;
    if (this._mounts.indexOf(el) === -1) this._mounts.push(el);
    if (!el.classList.contains('sukoon-pulse')) el.classList.add('sukoon-pulse');
    _ensureSkeleton(el);
    if (this._last) this._render(el, this._last);
    if (this._stopped) this.start();
  };

  PulseTicker.prototype.unmount = function (el) {
    var i = this._mounts.indexOf(el);
    if (i !== -1) this._mounts.splice(i, 1);
    if (!this._mounts.length) this.stop();
  };

  PulseTicker.prototype.onUpdate = function (fn) {
    if (typeof fn === 'function') this._subs.push(fn);
  };

  PulseTicker.prototype._render = function (el, payload) {
    var n = Math.max(0, parseInt(payload.count || payload.live || 0, 10));
    var holder = el.querySelector('.sukoon-pulse__digits');
    if (!holder) return;
    var s = String(n);
    var prev = holder.getAttribute('data-val') || '';
    if (s === prev) return;
    holder.setAttribute('data-val', s);
    var maxLen = Math.max(s.length, holder.children.length);
    var padded = s;
    while (padded.length < maxLen) padded = ' ' + padded;
    while (holder.children.length < maxLen) holder.insertBefore(_makeCol(' '), holder.firstChild);
    while (holder.children.length > maxLen) holder.removeChild(holder.firstChild);
    for (var i = 0; i < maxLen; i++) {
      var col = holder.children[i];
      var oldDigit = col.getAttribute('data-d');
      var newDigit = padded.charAt(i);
      if (oldDigit !== newDigit) _slide(col, newDigit);
    }
  };

  function _makeCol(d) {
    var col = document.createElement('span');
    col.className = 'sukoon-pulse__col';
    col.setAttribute('data-d', d);
    var inner = document.createElement('span');
    inner.className = 'sukoon-pulse__col-inner';
    inner.textContent = d;
    col.appendChild(inner);
    return col;
  }
  function _slide(col, d) {
    var current = col.firstChild;
    var next = document.createElement('span');
    next.className = 'sukoon-pulse__col-inner is-incoming';
    next.textContent = d;
    col.appendChild(next);
    requestAnimationFrame(function () {
      if (current) current.classList.add('is-outgoing');
      next.classList.remove('is-incoming');
    });
    setTimeout(function () {
      if (current && current.parentNode === col) col.removeChild(current);
      col.setAttribute('data-d', d);
    }, 500);
  }

  window.SukoonPulse = PulseTicker;
})();
