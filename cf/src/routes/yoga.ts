/**
 * GET /api/yoga — asana library + sequences.
 *
 * The Express version (routes/yoga.js) filtered an in-memory JSON
 * blob loaded at boot. Here we push the filters down to D1 so the
 * worker never has to hold the whole library in isolate memory.
 *
 * Two endpoints:
 *   GET /            → all asanas, optional ?category=&difficulty=&lineage=
 *   GET /sequences   → yoga_sequences table (may be empty).
 *
 * Both are safe to cache aggressively — the content changes when
 * we ship new JSON, not on user actions.
 */

import { Hono } from 'hono';

import type { Bindings } from '../types';

const yoga = new Hono<{ Bindings: Bindings }>();

const LIST_CACHE = 'public, max-age=3600';

/**
 * Asana row shape. Kept intentionally loose — the D1 rows carry a
 * `payload` JSON blob with the rest of the fields, and we decode it
 * lazily so a schema drift in one asana can't 500 the whole list.
 */
interface AsanaRow {
  id: string;
  slug: string | null;
  name: string | null;
  sanskrit: string | null;
  category: string | null;
  difficulty: number | null;
  lineage: string | null;
  payload: string | null;
}

interface SequenceRow {
  id: string;
  payload: string | null;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function hydrateAsana(row: AsanaRow): Record<string, unknown> {
  const extra = safeParse<Record<string, unknown>>(row.payload) ?? {};
  return {
    ...extra,
    id: row.id,
    slug: row.slug,
    name: row.name,
    sanskrit: row.sanskrit,
    category: row.category,
    difficulty: row.difficulty,
    lineage: row.lineage,
  };
}

yoga.get('/', async (c) => {
  try {
    const { category, difficulty, lineage } = c.req.query();

    // Build the WHERE clause dynamically. COLLATE NOCASE gives us the
    // case-insensitive match the Express `eqi()` helper used to do.
    const where: string[] = [];
    const binds: (string | number)[] = [];

    if (typeof category === 'string' && category.length > 0) {
      where.push('category = ? COLLATE NOCASE');
      binds.push(category);
    }
    if (typeof lineage === 'string' && lineage.length > 0) {
      where.push('lineage = ? COLLATE NOCASE');
      binds.push(lineage);
    }
    if (typeof difficulty === 'string' && difficulty.length > 0) {
      const diffNum = Number(difficulty);
      if (Number.isFinite(diffNum)) {
        where.push('difficulty = ?');
        binds.push(diffNum);
      }
    }

    const sql =
      'SELECT id, slug, name, sanskrit, category, difficulty, lineage, payload ' +
      'FROM yoga_asanas' +
      (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
      ' ORDER BY name';

    const stmt = c.env.SUKOON_DB.prepare(sql).bind(...binds);
    const { results } = await stmt.all<AsanaRow>();
    const items = (results ?? []).map(hydrateAsana);

    c.header('Cache-Control', LIST_CACHE);
    return c.json({ items, count: items.length });
  } catch (err) {
    console.error('[Yoga] uncaught:', err instanceof Error ? err.message : err);
    return c.json({ error: 'Yoga lookup failed.' }, 500);
  }
});

yoga.get('/sequences', async (c) => {
  try {
    const { results } = await c.env.SUKOON_DB.prepare(
      'SELECT id, payload FROM yoga_sequences ORDER BY id',
    ).all<SequenceRow>();

    const items = (results ?? []).map((row) => {
      const extra = safeParse<Record<string, unknown>>(row.payload) ?? {};
      return { ...extra, id: row.id };
    });

    c.header('Cache-Control', LIST_CACHE);
    return c.json({
      items,
      count: items.length,
      note:
        items.length === 0
          ? 'yoga-sequences.json not present yet — placeholder endpoint.'
          : undefined,
    });
  } catch (err) {
    console.error('[Yoga] sequences uncaught:', err instanceof Error ? err.message : err);
    return c.json({ error: 'Yoga sequences lookup failed.' }, 500);
  }
});

export default yoga;
