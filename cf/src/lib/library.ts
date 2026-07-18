/**
 * Sukoon — content library, ported from Express to Cloudflare Workers.
 *
 * The Express version slurped ~28 JSON files into an in-memory Map at
 * boot. That won't work on Workers: there is no filesystem, and cold
 * starts must stay fast. Every lookup here goes to D1 with a prepared
 * statement so the working set stays small and horizontally scaled.
 *
 * Schema (created by scripts/json-to-d1.mjs):
 *
 *   library_items (
 *     id TEXT PK, kind TEXT NOT NULL, title TEXT,
 *     subtitle TEXT, description TEXT,
 *     duration_seconds INTEGER,
 *     tags TEXT,        -- JSON array
 *     moods TEXT,       -- JSON array
 *     languages TEXT,   -- JSON array
 *     audio_key TEXT, image_key TEXT, slug TEXT,
 *     data TEXT,        -- JSON blob for kind-specific extras
 *     created_at TEXT, updated_at TEXT
 *   )
 *
 *   daily_mantras (
 *     id TEXT PK, text TEXT NOT NULL, author TEXT,
 *     tags TEXT, data TEXT
 *   )
 *
 *   festivals (
 *     id TEXT PK, name TEXT NOT NULL,
 *     date TEXT,       -- YYYY-MM-DD, may be NULL for movable feasts
 *     month INTEGER, day INTEGER,   -- fallback anchor
 *     description TEXT, data TEXT
 *   )
 *
 * All JSON columns are read back with SQLite's json_each in facet
 * filters — a tags-overlap check runs at the DB, not in the Worker,
 * so we never pull rows we're going to throw away.
 */

/* ─── Types ───────────────────────────────────────────────────────── */

/**
 * A single content-library row.
 *
 * We use one flexible shape across three tables (library_items,
 * daily_mantras, festivals) so callers can iterate a mixed by-id
 * response without narrowing. `kind` is always populated; the rest
 * depends on which table the row came from.
 */
export interface LibraryItem {
  id: string;
  kind: string;
  title?: string;
  subtitle?: string;
  description?: string;
  duration_seconds?: number;
  languages?: string[];
  moods?: string[];
  tags?: string[];
  audio_key?: string;
  image_key?: string;
  slug?: string;
  // daily_mantras fields
  text?: string;
  author?: string;
  // festivals fields
  date?: string;
  month?: number;
  day?: number;
  // kind-specific extras stashed as JSON
  data?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface FilterOpts {
  kind?: string;
  tags?: string[];
  mood?: string;
  duration?: number;
  lang?: string;
  limit?: number;
}

export interface Snapshot {
  meditations: number;
  sleepStories: number;
  breathPatterns: number;
  soundscapes: number;
  daily: number;
  festivals: number;
  crisisTools: number;
  yogaAsanas: number;
  yogaSequences: number;
  courses: number;
}

export interface DailyPayload {
  date: string;
  mantra: LibraryItem | null;
  festival: LibraryItem | null;
}

export interface PulsePayload {
  count: number;
  since: number;
}

/* ─── Kind aliases ────────────────────────────────────────────────── */

/**
 * Same shape as the Express KIND_ALIASES map, but the values now point
 * at *canonical DB kinds* (or synthetic table markers) instead of
 * in-memory store keys.
 *
 * `mantra` / `festival` route to their dedicated tables — the rest live
 * in library_items and share the same facet filter path.
 */
const KIND_ALIASES: Readonly<Record<string, string>> = {
  meditation: 'meditation',
  meditations: 'meditation',
  story: 'sleep_story',
  stories: 'sleep_story',
  'sleep-story': 'sleep_story',
  'sleep-stories': 'sleep_story',
  breath: 'breathwork',
  breaths: 'breathwork',
  'breath-pattern': 'breathwork',
  'breath-patterns': 'breathwork',
  sound: 'sound_bath',
  sounds: 'sound_bath',
  soundscape: 'sound_bath',
  soundscapes: 'sound_bath',
  mantra: 'mantra',
  mantras: 'mantra',
  festival: 'festival',
  festivals: 'festival',
  crisis: 'crisis_tool',
  'crisis-tools': 'crisis_tool',
  yoga: 'yoga_asana',
  'yoga-asana': 'yoga_asana',
  'yoga-asanas': 'yoga_asana',
  'yoga-sequence': 'yoga_sequence',
  'yoga-sequences': 'yoga_sequence',
  course: 'course',
  courses: 'course',
};

/** Map an alias table -> canonical snapshot key, for the count() rollup. */
const KIND_TO_SNAPSHOT: Readonly<Record<string, keyof Snapshot>> = {
  meditation: 'meditations',
  sleep_story: 'sleepStories',
  breathwork: 'breathPatterns',
  sound_bath: 'soundscapes',
  crisis_tool: 'crisisTools',
  yoga_asana: 'yogaAsanas',
  yoga_sequence: 'yogaSequences',
  course: 'courses',
};

export function resolveKind(kind: unknown): string | null {
  if (typeof kind !== 'string') return null;
  return KIND_ALIASES[kind.toLowerCase()] ?? null;
}

/* ─── Row shapes (private) ────────────────────────────────────────── */

interface LibraryItemRow {
  id: string;
  kind: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  duration_seconds: number | null;
  languages: string | null;
  moods: string | null;
  tags: string | null;
  audio_key: string | null;
  image_key: string | null;
  slug: string | null;
  created_at: string | null;
  updated_at: string | null;
  data: string | null;
}

interface MantraRow {
  id: string;
  text: string;
  author: string | null;
  tags: string | null;
  data: string | null;
}

interface FestivalRow {
  id: string;
  name: string;
  date: string | null;
  month: number | null;
  day: number | null;
  description: string | null;
  data: string | null;
}

/* ─── Small utilities ─────────────────────────────────────────────── */

function dateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * djb2 hash. Same algorithm as the Express version so a fresh Worker
 * deploy picks the same daily mantra as the old Node box would for a
 * given YYYY-MM-DD.
 */
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function parseJsonArray(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : undefined;
  } catch {
    return undefined;
  }
}

function parseJsonObject(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function hydrateLibrary(row: LibraryItemRow): LibraryItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title ?? undefined,
    subtitle: row.subtitle ?? undefined,
    description: row.description ?? undefined,
    duration_seconds: row.duration_seconds ?? undefined,
    languages: parseJsonArray(row.languages),
    moods: parseJsonArray(row.moods),
    tags: parseJsonArray(row.tags),
    audio_key: row.audio_key ?? undefined,
    image_key: row.image_key ?? undefined,
    slug: row.slug ?? undefined,
    data: parseJsonObject(row.data),
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

function hydrateMantra(row: MantraRow): LibraryItem {
  return {
    id: row.id,
    kind: 'mantra',
    text: row.text,
    author: row.author ?? undefined,
    tags: parseJsonArray(row.tags),
    data: parseJsonObject(row.data),
  };
}

function hydrateFestival(row: FestivalRow): LibraryItem {
  return {
    id: row.id,
    kind: 'festival',
    title: row.name,
    description: row.description ?? undefined,
    date: row.date ?? undefined,
    month: row.month ?? undefined,
    day: row.day ?? undefined,
    data: parseJsonObject(row.data),
  };
}

/* ─── Daily resolver ─────────────────────────────────────────────── */

/**
 * Pick today's mantra by hashing YYYY-MM-DD modulo the daily-mantras
 * row count. Deterministic per calendar day, so every Worker isolate
 * on every colo returns the same mantra at the same instant.
 *
 * The festival lookup handles two anchor styles used by the seed data:
 *   1. `date = 'YYYY-MM-DD'` — full date, we compare the MM-DD suffix
 *   2. `month + day` integer pair — for movable feasts we still want to
 *      surface on a fixed civil date.
 *
 * Query count: 2 in parallel + at most 1 more for the mantra row.
 * Not N+1 — bounded, and independent of collection size.
 */
export async function getDaily(db: D1Database, date: Date = new Date()): Promise<DailyPayload> {
  const key = dateKey(date);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mmdd = `${mm}-${dd}`;

  const [countRow, festivalRow] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS n FROM daily_mantras').first<{ n: number }>(),
    db
      .prepare(
        `SELECT id, name, date, month, day, description, data
         FROM festivals
         WHERE (date IS NOT NULL AND substr(date, 6, 5) = ?1)
            OR (month IS NOT NULL AND day IS NOT NULL
                AND printf('%02d', month) = ?2
                AND printf('%02d', day)   = ?3)
         LIMIT 1`,
      )
      .bind(mmdd, mm, dd)
      .first<FestivalRow>(),
  ]);

  const count = countRow?.n ?? 0;
  let mantra: LibraryItem | null = null;
  if (count > 0) {
    const offset = djb2(key) % count;
    const row = await db
      .prepare(
        `SELECT id, text, author, tags, data
         FROM daily_mantras
         ORDER BY id
         LIMIT 1 OFFSET ?1`,
      )
      .bind(offset)
      .first<MantraRow>();
    if (row) mantra = hydrateMantra(row);
  }

  return {
    date: key,
    mantra,
    festival: festivalRow ? hydrateFestival(festivalRow) : null,
  };
}

/* ─── Pulse counter ──────────────────────────────────────────────── */

/**
 * The pulse is a Durable Object because it needs a single writer to
 * survive across isolates. We just proxy to the DO — the shape mirrors
 * what the Express in-memory version used to return so the frontend
 * doesn't need to change.
 *
 * The DO exposes `GET /state` returning `{ count, since }`.
 */
export async function getPulse(pulseDO: DurableObjectStub): Promise<PulsePayload> {
  const res = await pulseDO.fetch('https://pulse.internal/state');
  if (!res.ok) {
    throw new Error(`pulse DO returned ${res.status}`);
  }
  const body = (await res.json()) as PulsePayload;
  return {
    count: Number(body.count) || 0,
    since: Number(body.since) || Date.now(),
  };
}

/* ─── Facet filter ───────────────────────────────────────────────── */

/**
 * Same predicates as the Express `filterLibrary`, translated to SQL:
 *
 *   - tags overlap  → json_each(tags) IN (...)
 *   - mood contains → json_each(moods) = ?
 *   - lang contains → json_each(languages) = ?, but treated as "no
 *     filter" when the row has no languages column populated (matches
 *     the Express short-circuit)
 *   - duration ±50% → BETWEEN, but only when the row declares a duration
 *
 * mantras and festivals live in their own tables; the alias resolver
 * routes those callers here but we return [] since neither is a
 * facet-filterable kind. That's a behavior tightening compared to
 * Express (which had a latent bug where mantras filters always
 * returned [] anyway, because store['mantras'] didn't exist).
 */
export async function filterLibrary(
  db: D1Database,
  { kind, tags, mood, duration, lang, limit = 20 }: FilterOpts,
): Promise<LibraryItem[]> {
  const canonical = resolveKind(kind);
  if (!canonical) return [];
  if (canonical === 'mantra' || canonical === 'festival') return [];

  const wheres: string[] = ['kind = ?'];
  const params: unknown[] = [canonical];

  if (Array.isArray(tags) && tags.length > 0) {
    const norm = tags.map((t) => String(t).toLowerCase());
    const placeholders = norm.map(() => '?').join(',');
    wheres.push(
      `EXISTS (
         SELECT 1 FROM json_each(library_items.tags)
         WHERE lower(json_each.value) IN (${placeholders})
       )`,
    );
    params.push(...norm);
  }

  if (typeof mood === 'string' && mood.length > 0) {
    wheres.push(
      `EXISTS (
         SELECT 1 FROM json_each(library_items.moods)
         WHERE lower(json_each.value) = ?
       )`,
    );
    params.push(mood.toLowerCase());
  }

  if (typeof lang === 'string' && lang.length > 0) {
    // Match Express: only filter rows that actually list languages;
    // rows without a `languages` array pass through.
    wheres.push(
      `(library_items.languages IS NULL
         OR EXISTS (
           SELECT 1 FROM json_each(library_items.languages)
           WHERE lower(json_each.value) = ?
         ))`,
    );
    params.push(lang.toLowerCase());
  }

  if (typeof duration === 'number' && duration > 0) {
    wheres.push(
      `(library_items.duration_seconds IS NULL
         OR library_items.duration_seconds BETWEEN ? AND ?)`,
    );
    params.push(duration * 0.5, duration * 1.5);
  }

  const cap = Math.max(1, Math.min(50, Number(limit) || 20));
  params.push(cap);

  const sql = `
    SELECT id, kind, title, subtitle, description, duration_seconds,
           languages, moods, tags, audio_key, image_key, slug,
           created_at, updated_at, data
      FROM library_items
     WHERE ${wheres.join(' AND ')}
     LIMIT ?
  `;

  const result = await db
    .prepare(sql)
    .bind(...params)
    .all<LibraryItemRow>();

  return (result.results ?? []).map(hydrateLibrary);
}

/* ─── By-id lookup ───────────────────────────────────────────────── */

/**
 * The Express `getById` walked a single Map keyed by id across every
 * kind. Here we UNION across the three tables — one round-trip covers
 * whichever bucket the id lives in.
 *
 * NOTE on N+1 risk: callers with a *list* of ids MUST use `getByIds`
 * below rather than looping this. `getByIds` batches into one
 * `WHERE id IN (…)` per table, so the whole call is O(3) queries no
 * matter how many ids are requested.
 */
export async function getById(db: D1Database, id: string): Promise<LibraryItem | null> {
  if (!id) return null;

  const [lib, mantra, festival] = await Promise.all([
    db
      .prepare(
        `SELECT id, kind, title, subtitle, description, duration_seconds,
                languages, moods, tags, audio_key, image_key, slug,
                created_at, updated_at, data
           FROM library_items WHERE id = ?1 LIMIT 1`,
      )
      .bind(id)
      .first<LibraryItemRow>(),
    db
      .prepare(`SELECT id, text, author, tags, data FROM daily_mantras WHERE id = ?1 LIMIT 1`)
      .bind(id)
      .first<MantraRow>(),
    db
      .prepare(
        `SELECT id, name, date, month, day, description, data
           FROM festivals WHERE id = ?1 LIMIT 1`,
      )
      .bind(id)
      .first<FestivalRow>(),
  ]);

  if (lib) return hydrateLibrary(lib);
  if (mantra) return hydrateMantra(mantra);
  if (festival) return hydrateFestival(festival);
  return null;
}

/**
 * Batched sibling of `getById`. Preserves the *input order* the same
 * way the Express handler did, so callers rendering a curated list
 * (e.g. "your saved" or the router's top-3) get stable output.
 *
 * Three D1 round-trips regardless of `ids.length`. Missing ids are
 * silently dropped, matching Express.
 */
export async function getByIds(db: D1Database, ids: string[]): Promise<LibraryItem[]> {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const clean = Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0)));
  if (clean.length === 0) return [];

  const placeholders = clean.map(() => '?').join(',');

  const [libRes, mantraRes, festivalRes] = await Promise.all([
    db
      .prepare(
        `SELECT id, kind, title, subtitle, description, duration_seconds,
                languages, moods, tags, audio_key, image_key, slug,
                created_at, updated_at, data
           FROM library_items WHERE id IN (${placeholders})`,
      )
      .bind(...clean)
      .all<LibraryItemRow>(),
    db
      .prepare(
        `SELECT id, text, author, tags, data
           FROM daily_mantras WHERE id IN (${placeholders})`,
      )
      .bind(...clean)
      .all<MantraRow>(),
    db
      .prepare(
        `SELECT id, name, date, month, day, description, data
           FROM festivals WHERE id IN (${placeholders})`,
      )
      .bind(...clean)
      .all<FestivalRow>(),
  ]);

  const byId = new Map<string, LibraryItem>();
  for (const row of libRes.results ?? []) byId.set(row.id, hydrateLibrary(row));
  for (const row of mantraRes.results ?? []) byId.set(row.id, hydrateMantra(row));
  for (const row of festivalRes.results ?? []) byId.set(row.id, hydrateFestival(row));

  // Re-emit in the caller's original order, dropping unknowns.
  const out: LibraryItem[] = [];
  for (const id of ids) {
    const hit = byId.get(id);
    if (hit) out.push(hit);
  }
  return out;
}

/* ─── Snapshot ───────────────────────────────────────────────────── */

/**
 * One round-trip: GROUP BY kind on library_items, UNION with a count
 * of daily_mantras and festivals. Cheaper than the Express version's
 * length-of-each-array reads because we skip parsing everything.
 */
export async function snapshot(db: D1Database): Promise<Snapshot> {
  const base: Snapshot = {
    meditations: 0,
    sleepStories: 0,
    breathPatterns: 0,
    soundscapes: 0,
    daily: 0,
    festivals: 0,
    crisisTools: 0,
    yogaAsanas: 0,
    yogaSequences: 0,
    courses: 0,
  };

  const res = await db
    .prepare(
      `SELECT kind, COUNT(*) AS n FROM library_items GROUP BY kind
       UNION ALL
       SELECT 'mantra'   AS kind, COUNT(*) AS n FROM daily_mantras
       UNION ALL
       SELECT 'festival' AS kind, COUNT(*) AS n FROM festivals`,
    )
    .all<{ kind: string; n: number }>();

  for (const row of res.results ?? []) {
    if (row.kind === 'mantra') {
      base.daily = row.n;
      continue;
    }
    if (row.kind === 'festival') {
      base.festivals = row.n;
      continue;
    }
    const key = KIND_TO_SNAPSHOT[row.kind];
    if (key) base[key] = row.n;
  }

  return base;
}
