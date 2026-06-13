/* ─── In-memory library loader ─────────────────────────────────────────
   At boot, slurp every JSON file under /public/content/ into RAM and
   index every item by id. Partial library is allowed (skips missing
   files) so dev environments without all content still boot. */

const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '..', 'public', 'content');

// Filename pattern → store key. Patterns are regex-tested against each
// file in CONTENT_DIR. This way the loader picks up split files like
// meditations-anxiety-en.json + meditations-sleep.json + ... without
// listing them individually. Yoga + course splits are also handled.
const CONTENT_PATTERNS = [
  { pattern: /^meditations-.*\.json$|^meditations\.json$/, key: 'meditations' },
  { pattern: /^stories-.*\.json$|^sleep-stories\.json$/, key: 'sleepStories' },
  { pattern: /^breath\.json$|^breath-patterns\.json$/, key: 'breathPatterns' },
  { pattern: /^soundscapes\.json$/, key: 'soundscapes' },
  { pattern: /^daily-q[1-4]\.json$|^daily\.json$|^mantras\.json$/, key: 'daily' },
  { pattern: /^festivals\.json$/, key: 'festivals' },
  { pattern: /^crisis\.json$|^crisis-tools\.json$/, key: 'crisisTools' },
  { pattern: /^yoga-asanas-[1-9]\.json$|^yoga-asanas\.json$/, key: 'yogaAsanas' },
  { pattern: /^yoga-sequences\.json$/, key: 'yogaSequences' },
  { pattern: /^courses-.*\.json$|^courses\.json$/, key: 'courses' },
];

const store = {
  meditations: [],
  sleepStories: [],
  breathPatterns: [],
  soundscapes: [],
  daily: [],
  festivals: [],
  crisisTools: [],
  yogaAsanas: [],
  yogaSequences: [],
  courses: [],
  // Flat id index: id → { kind, item }
  byId: new Map()
};

function safeReadJson(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[Library] failed to parse ${path.basename(file)}: ${err.message}`);
    }
    return null;
  }
}

function loadAll() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.warn(`[Library] ${CONTENT_DIR} not found — booting with empty library.`);
    return;
  }
  let total = 0;
  let fileCount = 0;
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json'));
  for (const filename of files) {
    const match = CONTENT_PATTERNS.find(p => p.pattern.test(filename));
    if (!match) continue;
    const data = safeReadJson(path.join(CONTENT_DIR, filename));
    if (!data) continue;
    const items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
    store[match.key].push(...items);
    total += items.length;
    fileCount++;
    for (const item of items) {
      if (item && typeof item.id === 'string') {
        store.byId.set(item.id, { kind: match.key, item });
      }
    }
  }
  console.log(`[Library] loaded ${total} items across ${fileCount} files.`);
}

/* ── Daily resolver ──────────────────────────────────────────────────
   Pick today's mantra by date-hash modulo so it is stable for the day
   regardless of process restart. If a festival matches today's date,
   surface it alongside. Dates compared in UTC; festival entries should
   carry a `date` field in YYYY-MM-DD form or a `month`/`day` pair. */

function dateKey(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Stable hash → integer
function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getDaily(now = new Date()) {
  const key = dateKey(now);
  const daily = store.daily;
  const mantra = daily.length > 0
    ? daily[djb2(key) % daily.length]
    : null;

  // Festival match: today's MM-DD against festival.date (YYYY-MM-DD) or {month,day}.
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const festival = store.festivals.find(f => {
    if (!f) return false;
    if (typeof f.date === 'string' && f.date.endsWith(`-${mm}-${dd}`)) return true;
    if (f.month && f.day) {
      return String(f.month).padStart(2, '0') === mm
          && String(f.day).padStart(2, '0') === dd;
    }
    return false;
  }) || null;

  return { date: key, mantra, festival };
}

/* ── Pulse counter — deterministic walk ──────────────────────────────
   We seed at process start with a number derived from the boot time
   so two restarts don't produce the same trajectory, then advance the
   counter by a deterministic function of uptime. No randomness, no
   identity attached. Returned value is an integer "souls present now". */

const BOOT_MS = Date.now();
const BASE = 240 + (BOOT_MS % 60);          // 240–299 at boot

function getPulse(now = Date.now()) {
  const uptimeSec = Math.floor((now - BOOT_MS) / 1000);
  // Smooth wave: amplitude ~80, period ~6 min, plus slow drift of +1 per 4 min.
  const wave = Math.round(80 * Math.sin(uptimeSec / 60));
  const drift = Math.floor(uptimeSec / 240);
  const count = Math.max(50, BASE + wave + drift);
  return { count, since: BOOT_MS };
}

/* ── Filtering ───────────────────────────────────────────────────────
   Generic filter over a named collection. Used by POST /api/library and
   POST /api/route to surface the top-3 library matches. */

const KIND_ALIASES = {
  meditation: 'meditations',
  meditations: 'meditations',
  story: 'sleepStories',
  stories: 'sleepStories',
  'sleep-story': 'sleepStories',
  'sleep-stories': 'sleepStories',
  breath: 'breathPatterns',
  breaths: 'breathPatterns',
  'breath-pattern': 'breathPatterns',
  'breath-patterns': 'breathPatterns',
  sound: 'soundscapes',
  sounds: 'soundscapes',
  soundscape: 'soundscapes',
  soundscapes: 'soundscapes',
  mantra: 'mantras',
  mantras: 'mantras',
  festival: 'festivals',
  festivals: 'festivals',
  crisis: 'crisisTools',
  'crisis-tools': 'crisisTools'
};

function resolveKind(kind) {
  if (!kind || typeof kind !== 'string') return null;
  return KIND_ALIASES[kind.toLowerCase()] || null;
}

function getCollection(kind) {
  const key = resolveKind(kind);
  return key ? store[key] : null;
}

function filterLibrary({ kind, tags, mood, duration, lang, limit = 20 }) {
  const collection = getCollection(kind);
  if (!collection) return [];

  const tagSet = Array.isArray(tags) && tags.length
    ? new Set(tags.map(t => String(t).toLowerCase()))
    : null;
  const moodNorm = typeof mood === 'string' ? mood.toLowerCase() : null;
  const langNorm = typeof lang === 'string' ? lang.toLowerCase() : null;

  const out = [];
  for (const item of collection) {
    if (!item) continue;
    if (tagSet) {
      const itemTags = Array.isArray(item.tags) ? item.tags.map(t => String(t).toLowerCase()) : [];
      const hit = itemTags.some(t => tagSet.has(t));
      if (!hit) continue;
    }
    if (moodNorm) {
      const itemMoods = Array.isArray(item.moods) ? item.moods.map(m => String(m).toLowerCase()) : [];
      if (!itemMoods.includes(moodNorm)) continue;
    }
    if (langNorm) {
      const itemLangs = Array.isArray(item.languages) ? item.languages.map(l => String(l).toLowerCase()) : null;
      if (itemLangs && !itemLangs.includes(langNorm)) continue;
    }
    if (typeof duration === 'number' && typeof item.duration === 'number') {
      // ±50% window around requested duration
      if (item.duration < duration * 0.5 || item.duration > duration * 1.5) continue;
    }
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function getById(id) {
  if (!id) return null;
  const hit = store.byId.get(id);
  return hit ? hit.item : null;
}

function snapshot() {
  return {
    meditations: store.meditations.length,
    sleepStories: store.sleepStories.length,
    breathPatterns: store.breathPatterns.length,
    soundscapes: store.soundscapes.length,
    daily: store.daily.length,
    festivals: store.festivals.length,
    crisisTools: store.crisisTools.length,
    yogaAsanas: store.yogaAsanas.length,
    yogaSequences: store.yogaSequences.length,
    courses: store.courses.length
  };
}

// Direct (non-aliased) accessor used by the yoga + courses routes,
// which need keys that aren't in KIND_ALIASES (e.g. 'yogaAsanas').
function getRaw(key) {
  return Object.prototype.hasOwnProperty.call(store, key) && Array.isArray(store[key])
    ? store[key]
    : [];
}

module.exports = {
  loadAll,
  getDaily,
  getPulse,
  filterLibrary,
  getById,
  getCollection,
  getRaw,
  resolveKind,
  snapshot
};
