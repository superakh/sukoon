/**
 * POST /api/library — filter or by-id lookup over the content library.
 *
 * Same request/response shape as the Express handler at
 * routes/library-api.js, so the frontend can flip its base URL to the
 * Worker without any client-side changes.
 *
 * Body:
 *   {
 *     kind?:     string   // one of the KIND_ALIASES keys
 *     tags?:     string[]
 *     mood?:     string
 *     duration?: number   // seconds; matched ±50 %
 *     lang?:     string
 *     ids?:      string[] // when present, wins over `kind`
 *     limit?:    number   // 1..50, default 20
 *   }
 *
 * Response:
 *   { items, mode: 'by-id' }                                        // ids branch
 *   { items, mode: 'filter', count, libraryStats: Snapshot }        // facet branch
 */

import { Hono } from 'hono';

import type { Bindings } from '../types';
import { filterLibrary, getByIds, resolveKind, snapshot } from '../lib/library';

const library = new Hono<{ Bindings: Bindings }>();

interface LibraryRequest {
  kind?: unknown;
  tags?: unknown;
  mood?: unknown;
  duration?: unknown;
  lang?: unknown;
  ids?: unknown;
  limit?: unknown;
}

function asStringArray(v: unknown, cap: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const entry of v) {
    if (typeof entry === 'string' && entry.length > 0) out.push(entry);
    if (out.length >= cap) break;
  }
  return out;
}

library.post('/', async (c) => {
  let body: LibraryRequest;
  try {
    body = (await c.req.json()) as LibraryRequest;
  } catch {
    body = {};
  }

  // Mode A — lookup by ids. Cap at 50 ids per request so a bad client
  // can't fan out an unbounded query.
  const ids = asStringArray(body.ids, 50);
  if (ids.length > 0) {
    try {
      const items = await getByIds(c.env.SUKOON_DB, ids);
      return c.json({ items, mode: 'by-id' as const });
    } catch (err) {
      console.error('[library] by-id lookup failed', err);
      return c.json({ error: 'Library lookup failed.' }, 500);
    }
  }

  // Mode B — facet filter. `kind` is required and must resolve to a
  // known alias, otherwise the client gets the same 400 as Express.
  if (!resolveKind(body.kind)) {
    return c.json(
      {
        error:
          'kind is required (meditations, sleep-stories, breath-patterns, soundscapes, mantras, festivals, crisis-tools)',
      },
      400,
    );
  }

  const rawLimit = Number(body.limit);
  const limit = Math.max(1, Math.min(50, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20));

  const tags = asStringArray(body.tags, 20);

  try {
    const items = await filterLibrary(c.env.SUKOON_DB, {
      kind: typeof body.kind === 'string' ? body.kind : undefined,
      tags: tags.length > 0 ? tags : undefined,
      mood: typeof body.mood === 'string' ? body.mood : undefined,
      duration: typeof body.duration === 'number' ? body.duration : undefined,
      lang: typeof body.lang === 'string' ? body.lang : undefined,
      limit,
    });

    const stats = await snapshot(c.env.SUKOON_DB);

    return c.json({
      items,
      mode: 'filter' as const,
      count: items.length,
      libraryStats: stats,
    });
  } catch (err) {
    console.error('[library] filter failed', err);
    return c.json({ error: 'Library lookup failed.' }, 500);
  }
});

export default library;
