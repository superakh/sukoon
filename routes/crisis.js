/* ─── Crisis trigger-word detector ─────────────────────────────────────
   Conservative client/server matcher used by /api/chat and /api/route.
   This is intentionally simple substring matching on a normalized
   message. Cultural specificity: includes Hindi/Urdu transliterations
   commonly typed by Indian users in Roman script.

   Output:
     { hit: boolean, tier: 1|2|3|null, terms: string[] }
   Tiers mirror the existing chat.js safety override:
     1 — passive ideation
     2 — active ideation
     3 — imminent danger / overdose / specific method
*/

const TIER_3 = [
  'i have a plan', 'tonight i will', 'taking pills', 'overdose', 'overdosing',
  'jump off', 'jumping off', 'hanging myself', 'noose',
  'phasi', 'phaansi', 'phaasi'
];

const TIER_2 = [
  'kill myself', 'killing myself', 'kms', 'end my life', 'ending my life',
  'take my own life', 'commit suicide', 'i want to die', 'wanna die',
  'want to die', 'apni jaan', 'khud ko maar', 'khud-kushi', 'khudkushi',
  'atmahatya', 'aatmahatya'
];

const TIER_1 = [
  "don't want to exist", 'do not want to exist', 'wish i was dead',
  'wish i were dead', "wouldn't wake up", 'would not wake up',
  'tired of living', 'no point in living', "can't go on", 'cannot go on',
  'jeena nahi', 'nahi jeena', 'jeene ka mann nahi'
];

const NSSI = [
  'cut myself', 'cutting myself', 'burning myself', 'hitting myself',
  'self harm', 'self-harm'
];

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[​-‏]/g, '')   // zero-widths
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ') // strip emoji/punct except '-
    .replace(/\s+/g, ' ')
    .trim();
}

function scan(text) {
  const n = normalize(text);
  if (!n) return { hit: false, tier: null, terms: [], nssi: false };

  const terms = [];
  let tier = null;

  for (const t of TIER_3) if (n.includes(t)) { terms.push(t); tier = 3; }
  if (tier !== 3) for (const t of TIER_2) if (n.includes(t)) { terms.push(t); tier = 2; }
  if (tier === null) for (const t of TIER_1) if (n.includes(t)) { terms.push(t); tier = 1; }

  const nssi = NSSI.some(t => n.includes(t));

  return { hit: terms.length > 0 || nssi, tier, terms, nssi };
}

// Take the most recent user turn from a messages array.
function lastUserText(messages) {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === 'user' && typeof m.content === 'string') return m.content;
  }
  return '';
}

// Region helplines block — re-exported here so /api/route can return them
// without depending on chat.js internals.
const HELPLINES = {
  india: 'India: iCall 9152987821 • Vandrevala Foundation 1860-2662-345 • AASRA 9820466726',
  'pakistan-india': 'Pakistan: Umang 0311-7786264 • India: iCall 9152987821 • Vandrevala 1860-2662-345',
  'global-arabic': 'UAE: Estijaba 800-LIFE (5433) • International: findahelpline.com • US: 988',
  'global-spanish': 'Spain: 024 • Mexico: SAPTEL 55-5259-8121 • US: 988 (en español)',
  'global-french': 'France: 3114 • Belgium: 0800 32 123 • Canada: 1-833-456-4566',
  global: 'US: 988 (call or text) • UK: Samaritans 116 123 • International: findahelpline.com'
};

const REGION_BY_LANG = {
  en: 'global', hi: 'india', pa: 'india', bn: 'india', ta: 'india',
  te: 'india', mr: 'india', ur: 'pakistan-india', ar: 'global-arabic',
  es: 'global-spanish', fr: 'global-french'
};

function helplinesFor(lang) {
  const region = REGION_BY_LANG[lang] || 'global';
  return HELPLINES[region] || HELPLINES.global;
}

module.exports = { scan, lastUserText, helplinesFor, REGION_BY_LANG, HELPLINES };
