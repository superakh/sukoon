/**
 * GET /api/daily — today's mantra + optional festival.
 *
 * Deterministic per UTC day. The resolver in `../lib/library` hashes
 * the ISO date and picks a stable index, so every visitor sees the
 * same daily mantra for the same date regardless of which edge
 * location served them. That determinism is what lets us set an hour
 * of edge cache without risking stale/wrong content.
 */
import { Hono } from 'hono';

import type { Bindings } from '../types';
import { getDaily } from '../lib/library';

const daily = new Hono<{ Bindings: Bindings }>();

daily.get('/daily', async (c) => {
  try {
    const payload = await getDaily(c.env.SUKOON_DB);
    // 1h edge cache. Safe because the resolver is date-keyed — two
    // callers within the same UTC day always get the same payload.
    c.header('Cache-Control', 'public, max-age=3600');
    return c.json(payload);
  } catch (err) {
    console.error(
      '[Daily] uncaught:',
      err instanceof Error ? err.message : String(err),
    );
    return c.json({ error: 'Could not resolve daily.' }, 500);
  }
});

export default daily;
