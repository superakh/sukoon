/* sukoon-safety.js
 * CrisisOverlay: ambient safety net.
 *
 * Watches every text input/textarea on the page via a single MutationObserver
 * + delegated input events. When ~50 EN+HI trigger phrases are detected, it
 * opens a full-screen calm sheet with helplines + a 5-4-3-2-1 grounding
 * walkthrough. Also listens for the global 'sukoon:crisis' event dispatched
 * by sukoon-router so detection works regardless of which entry path fired.
 *
 * Zero deps. Vanilla ES2017+. Exports window.SukoonSafety.
 *
 * Public API:
 *   const s = new SukoonSafety({ lang });
 *   s.install();             // attaches observer + input listeners
 *   s.open(reason);          // open programmatically
 *   s.close();
 *   SukoonSafety.PHRASES     // exposed for tests / shared with router
 */
(function () {
  'use strict';

  var PHRASES = [
    // English direct
    'kill myself', 'killing myself', 'want to die', 'wanna die',
    'end my life', 'end it all', 'suicide', 'suicidal',
    'cant go on', "can't go on", 'cant do this anymore', "can't do this anymore",
    'no reason to live', 'no point living', 'better off dead',
    'hurt myself', 'cut myself', 'self harm', 'self-harm',
    'overdose', 'jump off', 'hang myself',
    'nobody would miss me', 'nobody cares if i die',
    // English softer
    'i give up', 'i am done', "i'm done with life",
    "don't want to be here", 'dont want to be here',
    'tired of living', 'tired of being alive',
    // Hindi Devanagari
    'मरना चाहता', 'मरना चाहती', 'मर जाऊं', 'मर जाऊँ',
    'जान दे', 'जान देना', 'खुदकुशी', 'आत्महत्या',
    'जीना नहीं', 'जीने का मन नहीं', 'जीने को मन नहीं',
    'खुद को मार', 'खुद को नुकसान',
    // Hindi romanized
    'marna chahta', 'marna chahti', 'mar jaun', 'mar jaaun',
    'jaan de', 'jaan dena', 'khudkushi', 'aatmahatya', 'atmahatya',
    'jeena nahi', 'jeena nai', 'jeene ka mann nahi',
    'khud ko maar', 'apne aap ko maar',
    'bahut tang aa gaya', 'bahut thak gaya hoon'
  ];

  var HELPLINES = [
    { name: 'iCall (Mumbai)', phone: '+91 9152987821', hours: 'Mon-Sat 8am-10pm', lang: 'EN/HI/regional' },
    { name: 'Vandrevala Foundation', phone: '1860-2662-345', hours: '24/7', lang: 'EN/HI' },
    { name: 'AASRA', phone: '+91 9820466726', hours: '24/7', lang: 'EN/HI' },
    { name: 'NIMHANS Helpline', phone: '080-46110007', hours: '24/7', lang: 'EN/HI/Kannada' },
    { name: 'Kiran (MoSJE)', phone: '1800-599-0019', hours: '24/7', lang: '13 Indian languages' }
  ];

  function _norm(s) {
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (_) {}
    return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function detect(text) {
    var n = _norm(text);
    if (!n) return null;
    for (var i = 0; i < PHRASES.length; i++) {
      var p = _norm(PHRASES[i]);
      if (p && n.indexOf(p) !== -1) return PHRASES[i];
    }
    return null;
  }

  function CrisisOverlay(opts) {
    opts = opts || {};
    this.lang = opts.lang || (document.documentElement.lang || 'en').slice(0, 2);
    this._installed = false;
    this._mo = null;
    this._sheet = null;
    this._lastFire = 0;
    this._cooldownMs = 60000; // don't re-pop within a minute
  }

  CrisisOverlay.prototype.install = function () {
    if (this._installed) return;
    this._installed = true;
    var self = this;

    document.addEventListener('input', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.tagName !== 'TEXTAREA' && !(t.tagName === 'INPUT' && /text|search/i.test(t.type || 'text'))) return;
      var hit = detect(t.value || '');
      if (hit) self.open({ reason: 'input', match: hit, source: t });
    }, true);

    window.addEventListener('sukoon:crisis', function (e) {
      var d = (e && e.detail) || {};
      self.open({ reason: 'router', match: d.match || 'router', source: null });
    });

    // MutationObserver: catch dynamically inserted textareas (chat-style UIs)
    if (typeof MutationObserver !== 'undefined') {
      this._mo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var n = added[j];
            if (n.nodeType !== 1) continue;
            if (n.value && detect(n.value)) self.open({ reason: 'mutation', match: 'auto', source: n });
          }
        }
      });
      this._mo.observe(document.body, { childList: true, subtree: true });
    }
  };

  CrisisOverlay.prototype.open = function (info) {
    var now = Date.now();
    if (now - this._lastFire < this._cooldownMs) return;
    this._lastFire = now;
    if (this._sheet) { this._sheet.parentNode && this._sheet.parentNode.removeChild(this._sheet); }
    this._sheet = this._build(info || {});
    document.body.appendChild(this._sheet);
    document.body.classList.add('sukoon-safety-open');
    try {
      var focusable = this._sheet.querySelector('button, a, [tabindex]');
      if (focusable) focusable.focus();
    } catch (_) {}
  };

  CrisisOverlay.prototype.close = function () {
    if (!this._sheet) return;
    if (this._sheet.parentNode) this._sheet.parentNode.removeChild(this._sheet);
    this._sheet = null;
    document.body.classList.remove('sukoon-safety-open');
  };

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

  CrisisOverlay.prototype._build = function (info) {
    var lang = this.lang;
    var t = lang === 'hi' ? {
      title: 'आप अकेले नहीं हैं।',
      sub: 'जो आपने अभी लिखा, हमने पढ़ा। एक पल रुकिए — आपके साथ हैं।',
      ground: '5-4-3-2-1 साँस लीजिए',
      steps: [
        '5 चीज़ें जो आप अभी देख सकते हैं — नाम लीजिए।',
        '4 चीज़ें जो आप छू सकते हैं।',
        '3 आवाज़ें जो आप सुन सकते हैं।',
        '2 खुशबू जो आप महसूस कर सकते हैं।',
        '1 स्वाद जो आपकी ज़बान पर है।'
      ],
      call: 'अभी किसी से बात कीजिए',
      close: 'मैं ठीक हूँ, बंद करें'
    } : {
      title: 'You are not alone.',
      sub: 'We saw what you wrote. Pause for a moment — we are here with you.',
      ground: 'Breathe with 5-4-3-2-1',
      steps: [
        'Name 5 things you can see right now.',
        'Name 4 things you can touch.',
        'Name 3 things you can hear.',
        'Name 2 things you can smell.',
        'Name 1 thing you can taste.'
      ],
      call: 'Talk to someone right now',
      close: "I'm okay, close this"
    };

    var root = _h('div', { class: 'sukoon-crisis', role: 'dialog', 'aria-modal': 'true', 'aria-label': t.title });
    var card = _h('div', { class: 'sukoon-crisis__card' });
    card.appendChild(_h('h2', { class: 'sukoon-crisis__title', text: t.title }));
    card.appendChild(_h('p', { class: 'sukoon-crisis__sub', text: t.sub }));

    var groundWrap = _h('section', { class: 'sukoon-crisis__ground' });
    groundWrap.appendChild(_h('h3', { text: t.ground }));
    var ol = _h('ol', { class: 'sukoon-crisis__steps' });
    for (var i = 0; i < t.steps.length; i++) ol.appendChild(_h('li', { text: t.steps[i] }));
    groundWrap.appendChild(ol);
    card.appendChild(groundWrap);

    var lines = _h('section', { class: 'sukoon-crisis__lines' });
    lines.appendChild(_h('h3', { text: t.call }));
    var ul = _h('ul', { class: 'sukoon-crisis__helplines' });
    for (var k = 0; k < HELPLINES.length; k++) {
      var hl = HELPLINES[k];
      var li = _h('li');
      var a = _h('a', { class: 'sukoon-crisis__call', href: 'tel:' + hl.phone.replace(/[^+0-9]/g, '') });
      a.appendChild(_h('strong', { text: hl.name }));
      a.appendChild(document.createTextNode(' - '));
      a.appendChild(_h('span', { text: hl.phone }));
      var meta = _h('small', { text: hl.hours + ' - ' + hl.lang });
      li.appendChild(a);
      li.appendChild(meta);
      ul.appendChild(li);
    }
    lines.appendChild(ul);
    card.appendChild(lines);

    var actions = _h('div', { class: 'sukoon-crisis__actions' });
    var closeBtn = _h('button', { class: 'sukoon-crisis__close', type: 'button', text: t.close });
    var self = this;
    closeBtn.addEventListener('click', function () { self.close(); });
    actions.appendChild(closeBtn);
    card.appendChild(actions);

    root.appendChild(card);
    return root;
  };

  CrisisOverlay.detect = detect;
  CrisisOverlay.PHRASES = PHRASES;
  CrisisOverlay.HELPLINES = HELPLINES;

  window.SukoonSafety = CrisisOverlay;
})();
