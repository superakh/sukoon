#!/usr/bin/env node
/**
 * Sukoon — seed content JSON into D1.
 *
 * Reads every *.json under /public/content/, pattern-matches filenames
 * against the same rules the Express in-memory loader (routes/library.js)
 * uses, transforms each item into a row for one of three D1 tables, and
 * writes them out as INSERT OR REPLACE statements.
 *
 *   library_items   — meditations, sleep stories, breathwork, soundscapes,
 *                     crisis tools, yoga asanas + sequences, courses, and
 *                     video scripts. `kind` column separates them.
 *   daily_mantras   — the 365-day mantra rotation.
 *   festivals       — fixed-date and computed festival practices.
 *
 * Two modes:
 *
 *   node scripts/json-to-d1.mjs
 *     Write cf/schema/003_data.sql. Idempotent — safe to re-run after
 *     content edits; the file is overwritten atomically.
 *
 *   node scripts/json-to-d1.mjs --exec
 *     Write the .sql file AND shell out to `wrangler d1 execute` in
 *     batches of 100 statements each so a single HTTP call to the D1
 *     control-plane never blows past its payload cap.
 *
 * SQL escaping is deliberately narrow: we double single quotes, wrap
 * strings in single quotes, and leave everything else literal. UTF-8
 * (Devanagari, emoji, whatever) passes through unmodified — the file is
 * written with encoding 'utf8', wrangler forwards raw bytes to D1, and
 * SQLite stores TEXT as UTF-8 natively. No double-escaping anywhere.
 *
 * Requires: Node 20+ (ESM, top-level await, fs.readFileSync bytes → utf8).
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONTENT_DIR = path.join(REPO_ROOT, 'public', 'content');
const OUT_FILE = path.resolve(__dirname, '..', 'schema', '003_data.sql');

// D1 binding used with `wrangler d1 execute` in --exec mode.
// Mirrors wrangler.toml's [[d1_databases]] database_name.
const D1_DATABASE = process.env.SUKOON_D1_NAME || 'sukoon-content';

/**
 * Filename pattern → destination.
 *
 * Ported verbatim from routes/library.js CONTENT_PATTERNS (Express) so
 * both loaders see the same set of files. `video-scripts-*.json` is the
 * one addition; it didn't exist in the Express store because those
 * scripts were only ever produced from Anthropic outputs, but we want
 * them queryable now that they're persisted content.
 */
const CONTENT_PATTERNS = [
  { pattern: /^meditations-.*\.json$|^meditations\.json$/, kind: 'meditation', table: 'library_items' },
  { pattern: /^stories-.*\.json$|^sleep-stories\.json$/, kind: 'sleep_story', table: 'library_items' },
  { pattern: /^breath\.json$|^breath-patterns\.json$/, kind: 'breathwork', table: 'library_items' },
  { pattern: /^soundscapes\.json$/, kind: 'sound_bath', table: 'library_items' },
  { pattern: /^daily-q[1-4]\.json$|^daily\.json$|^mantras\.json$/, kind: 'mantra', table: 'daily_mantras' },
  { pattern: /^festivals\.json$/, kind: 'festival', table: 'festivals' },
  { pattern: /^crisis\.json$|^crisis-tools\.json$/, kind: 'crisis_tool', table: 'library_items' },
  { pattern: /^yoga-asanas-[1-9]\.json$|^yoga-asanas\.json$/, kind: 'yoga_asana', table: 'library_items' },
  { pattern: /^yoga-sequences\.json$/, kind: 'yoga_sequence', table: 'library_items' },
  { pattern: /^courses-.*\.json$|^courses\.json$/, kind: 'course', table: 'library_items' },
  { pattern: /^video-scripts-.*\.json$/, kind: 'video_script', table: 'library_items' },
];

/* ─── Helpers ──────────────────────────────────────────────────────── */

/** First non-null, non-empty value from the argument list. */
function first(...vals) {
  for (const v of vals) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.length === 0) continue;
    return v;
  }
  return null;
}

/**
 * SQLite string literal escape. We only ever need to double single
 * quotes — everything else (NUL, backslashes, high UTF-8) is safe inside
 * a TEXT literal. NULL is emitted as the bare word.
 */
function sqlLit(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return `'${s.replace(/'/g, "''")}'`;
}

/**
 * Derive the `languages` array for a library row. Prefers explicit
 * fields (lang / language / languages), then falls back to scanning the
 * item's own keys for the `_en` / `_hi` suffixes we use in content JSON,
 * then finally to the filename convention.
 *
 * Emits an empty array when nothing is detectable — library.ts treats
 * NULL and empty as "matches any lang filter" which matches Express.
 */
function deriveLanguages(item, sourceFile) {
  const langs = new Set();
  const push = (l) => {
    if (typeof l === 'string' && l.length > 0) langs.add(l.toLowerCase());
  };
  push(item.lang);
  push(item.language);
  if (Array.isArray(item.languages)) item.languages.forEach(push);

  for (const key of Object.keys(item)) {
    const val = item[key];
    // Only count a suffix if there's actually content behind it.
    if (val === null || val === undefined || val === '') continue;
    if (key === 'en' || key.endsWith('_en')) langs.add('en');
    if (key === 'hi' || key.endsWith('_hi')) langs.add('hi');
  }

  if (langs.size === 0) {
    if (/-en\.json$/i.test(sourceFile)) langs.add('en');
    else if (/-hi\.json$/i.test(sourceFile)) langs.add('hi');
  }

  return [...langs];
}

/**
 * Common tag/mood coalescer. Content files use several vocabularies —
 * mood_tags on meditations, purpose_tags on breath, trigger_moods on
 * crisis — so we collect all of them into the same slot. lower-casing is
 * left to library.ts's SQL filters so we don't lose the source form.
 */
function coalesceTags(...arrs) {
  const out = [];
  const seen = new Set();
  for (const a of arrs) {
    if (!Array.isArray(a)) continue;
    for (const v of a) {
      if (typeof v !== 'string' || v.length === 0) continue;
      const key = v.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

/* ─── Row builders ─────────────────────────────────────────────────── */

/**
 * Transform a JSON item into a library_items row. Fields that don't map
 * cleanly to a first-class column go into `data` as a JSON blob so
 * library.ts can hydrate the full item from a single SELECT.
 */
function toLibraryRow(item, kind, sourceFile) {
  const durationSec =
    typeof item.duration_seconds === 'number' ? item.duration_seconds
    : typeof item.duration_sec === 'number' ? item.duration_sec
    : typeof item.duration_min === 'number' ? Math.round(item.duration_min * 60)
    : typeof item.target_duration_min === 'number' ? Math.round(item.target_duration_min * 60)
    : typeof item.estimated_daily_minutes === 'number' ? Math.round(item.estimated_daily_minutes * 60)
    : null;

  const title = first(item.title_en, item.name_en, item.title_hi, item.name_hi, item.title, item.name);
  const subtitle = first(item.subtitle_en, item.subtitle_hi, item.title_hi, item.name_hi, item.subtitle);
  const description = first(item.description_en, item.description, item.intro_en, item.intro_hi);

  const tags = coalesceTags(item.tags, item.mood_tags, item.purpose_tags, item.trigger_moods, item.focus_tag ? [item.focus_tag] : null);
  const moods = coalesceTags(item.moods, item.mood_tags, item.trigger_moods);
  const languages = deriveLanguages(item, sourceFile);

  const audioKey = first(item.mp3_url, item.audio_key, item.audio_url, item.ambient_video);
  const imageKey = first(item.image_key, item.still, item.thumbnail, item.image_url);

  return {
    id: item.id,
    kind,
    title,
    subtitle,
    description,
    duration_seconds: durationSec,
    tags,
    moods,
    languages,
    audio_key: audioKey,
    image_key: imageKey,
    slug: item.slug || item.id,
    data: item,
  };
}

/**
 * Mantras don't carry an explicit id in the source JSON — they anchor
 * on day_of_year (1..365). We synthesize a stable id so re-seeds don't
 * multiply rows.
 */
function toMantraRow(item) {
  const day = typeof item.day_of_year === 'number' ? item.day_of_year : null;
  const id = day !== null ? `daily-${String(day).padStart(3, '0')}` : item.id || null;
  return {
    id,
    text: first(item.mantra_en, item.mantra_hi, item.text),
    author: first(item.author),
    tags: coalesceTags(item.focus ? [item.focus] : null, item.tags),
    data: item,
  };
}

/**
 * Festivals carry `dates_2026` in YYYY-MM-DD form for fixed civil dates
 * and (in earlier drafts) a month/day pair for the lunar ones. We split
 * whichever we get into the two anchor styles library.ts's getDaily
 * query looks for.
 */
function toFestivalRow(item) {
  const id = item.festival_id || item.id;
  const name = first(item.festival_name_en, item.name, item.name_en);
  const rawDate = first(item.dates_2026, item.date);
  let month = typeof item.month === 'number' ? item.month : null;
  let day = typeof item.day === 'number' ? item.day : null;
  let date = null;
  if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    date = rawDate;
    if (month === null) month = parseInt(rawDate.slice(5, 7), 10);
    if (day === null) day = parseInt(rawDate.slice(8, 10), 10);
  }
  return {
    id,
    name,
    date,
    month,
    day,
    description: first(item.practice_title_en, item.description),
    data: item,
  };
}

/* ─── SQL renderers ────────────────────────────────────────────────── */

const LIBRARY_COLS = [
  'id', 'kind', 'title', 'subtitle', 'description',
  'duration_seconds', 'languages', 'moods', 'tags',
  'audio_key', 'image_key', 'slug',
  'created_at', 'updated_at', 'data',
];

function libraryStmt(row) {
  const vals = [
    row.id,
    row.kind,
    row.title,
    row.subtitle,
    row.description,
    row.duration_seconds,
    row.languages && row.languages.length ? JSON.stringify(row.languages) : null,
    row.moods && row.moods.length ? JSON.stringify(row.moods) : null,
    row.tags && row.tags.length ? JSON.stringify(row.tags) : null,
    row.audio_key,
    row.image_key,
    row.slug,
    null, // created_at — let a DEFAULT populate it at INSERT time
    null, // updated_at
    row.data ? JSON.stringify(row.data) : null,
  ];
  return `INSERT OR REPLACE INTO library_items (${LIBRARY_COLS.join(', ')}) VALUES (${vals.map(sqlLit).join(', ')});`;
}

const MANTRA_COLS = ['id', 'text', 'author', 'tags', 'data'];

function mantraStmt(row) {
  const vals = [
    row.id,
    row.text,
    row.author,
    row.tags && row.tags.length ? JSON.stringify(row.tags) : null,
    row.data ? JSON.stringify(row.data) : null,
  ];
  return `INSERT OR REPLACE INTO daily_mantras (${MANTRA_COLS.join(', ')}) VALUES (${vals.map(sqlLit).join(', ')});`;
}

const FESTIVAL_COLS = ['id', 'name', 'date', 'month', 'day', 'description', 'data'];

function festivalStmt(row) {
  const vals = [
    row.id,
    row.name,
    row.date,
    row.month,
    row.day,
    row.description,
    row.data ? JSON.stringify(row.data) : null,
  ];
  return `INSERT OR REPLACE INTO festivals (${FESTIVAL_COLS.join(', ')}) VALUES (${vals.map(sqlLit).join(', ')});`;
}

/* ─── Main pipeline ────────────────────────────────────────────────── */

/**
 * Scan CONTENT_DIR, dispatch each file to its transformer, and return
 * both the statement list (in table order) and per-table stats for the
 * final log.
 */
function build() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`[seed] content directory not found: ${CONTENT_DIR}`);
    process.exit(2);
  }

  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json'));

  const perTable = {
    library_items: { rows: [], byKind: new Map(), ids: new Set(), skipped: [], duplicates: [] },
    daily_mantras: { rows: [], byKind: new Map(), ids: new Set(), skipped: [], duplicates: [] },
    festivals:     { rows: [], byKind: new Map(), ids: new Set(), skipped: [], duplicates: [] },
  };
  const unmatched = [];

  for (const filename of files) {
    const match = CONTENT_PATTERNS.find((p) => p.pattern.test(filename));
    if (!match) {
      unmatched.push(filename);
      continue;
    }
    const full = path.join(CONTENT_DIR, filename);
    let parsed;
    try {
      const raw = fs.readFileSync(full, 'utf8');
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn(`[seed] failed to parse ${filename}: ${err.message}`);
      continue;
    }
    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.items) ? parsed.items : [];

    const bucket = perTable[match.table];

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;

      let row;
      if (match.table === 'library_items') row = toLibraryRow(item, match.kind, filename);
      else if (match.table === 'daily_mantras') row = toMantraRow(item);
      else if (match.table === 'festivals') row = toFestivalRow(item);

      const requiredTitle = match.table === 'daily_mantras' ? row.text
        : match.table === 'festivals' ? row.name
        : row.title;

      if (!row.id || !requiredTitle) {
        bucket.skipped.push({ file: filename, id: row.id, reason: !row.id ? 'missing id' : 'missing title/text/name' });
        continue;
      }
      if (bucket.ids.has(row.id)) {
        bucket.duplicates.push({ file: filename, id: row.id });
        // The last write wins — replace the earlier row.
        const idx = bucket.rows.findIndex((r) => r.id === row.id);
        if (idx >= 0) bucket.rows.splice(idx, 1);
        else bucket.ids.add(row.id);
      } else {
        bucket.ids.add(row.id);
      }
      bucket.rows.push(row);
      const kindKey = match.kind;
      bucket.byKind.set(kindKey, (bucket.byKind.get(kindKey) || 0) + 1);
    }
  }

  const stmts = [];
  for (const row of perTable.library_items.rows) stmts.push(libraryStmt(row));
  for (const row of perTable.daily_mantras.rows) stmts.push(mantraStmt(row));
  for (const row of perTable.festivals.rows) stmts.push(festivalStmt(row));

  return { stmts, perTable, unmatched };
}

function writeSqlFile(stmts) {
  const header = [
    '-- Sukoon — generated by scripts/json-to-d1.mjs. DO NOT EDIT BY HAND.',
    '-- Regenerate with: npm run seed',
    `-- Statements: ${stmts.length}`,
    `-- Generated: ${new Date().toISOString()}`,
    '',
    'PRAGMA foreign_keys = ON;',
    'BEGIN TRANSACTION;',
    '',
  ].join('\n');
  const footer = '\nCOMMIT;\n';
  const body = stmts.join('\n');

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, header + body + footer, 'utf8');
  return OUT_FILE;
}

/**
 * --exec mode: split the statement list into 100-stmt chunks, write each
 * to a temp file, and pipe it through `wrangler d1 execute --file=…`.
 * We keep the batching at the wrangler layer (rather than one giant
 * file) because the D1 control-plane rejects requests bigger than a few
 * megabytes and this content set easily crosses that at 700+ rows.
 */
function execAgainstD1(stmts) {
  const BATCH = 100;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sukoon-seed-'));
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < stmts.length; i += BATCH) {
    const chunk = stmts.slice(i, i + BATCH);
    const chunkFile = path.join(tmpDir, `batch-${String(i / BATCH).padStart(3, '0')}.sql`);
    fs.writeFileSync(
      chunkFile,
      'BEGIN TRANSACTION;\n' + chunk.join('\n') + '\nCOMMIT;\n',
      'utf8',
    );
    const args = ['wrangler', 'd1', 'execute', D1_DATABASE, '--file', chunkFile, '--remote'];
    console.log(`[seed] wrangler batch ${Math.floor(i / BATCH) + 1} (${chunk.length} stmts)…`);
    const res = spawnSync('npx', args, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    if (res.status === 0) ok += chunk.length;
    else {
      failed += chunk.length;
      console.error(`[seed] batch failed with exit ${res.status}; leaving temp file at ${chunkFile}`);
      break;
    }
  }
  console.log(`[seed] wrangler exec done — ${ok} ok, ${failed} failed. Temp dir: ${tmpDir}`);
}

function summarize({ perTable, unmatched, stmts }) {
  const lines = [];
  const rollup = (name, bucket) => {
    lines.push(`  ${name}: ${bucket.rows.length}`);
    for (const [k, n] of bucket.byKind) lines.push(`    - ${k}: ${n}`);
    if (bucket.skipped.length) {
      lines.push(`    skipped ${bucket.skipped.length}:`);
      for (const s of bucket.skipped) lines.push(`      · ${s.file} id=${s.id || '?'} — ${s.reason}`);
    }
    if (bucket.duplicates.length) {
      lines.push(`    duplicates ${bucket.duplicates.length} (last-write-wins):`);
      for (const d of bucket.duplicates) lines.push(`      · ${d.file} id=${d.id}`);
    }
  };
  rollup('library_items', perTable.library_items);
  rollup('daily_mantras', perTable.daily_mantras);
  rollup('festivals',     perTable.festivals);
  if (unmatched.length) {
    lines.push(`  unmatched files (${unmatched.length}):`);
    for (const f of unmatched) lines.push(`    · ${f}`);
  }
  lines.push(`  total statements: ${stmts.length}`);
  return lines.join('\n');
}

/* ─── Entry point ──────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const doExec = args.includes('--exec');

const built = build();
const outFile = writeSqlFile(built.stmts);
console.log(`[seed] wrote ${built.stmts.length} statements → ${outFile}`);
console.log(summarize(built));

if (doExec) {
  execAgainstD1(built.stmts);
}
