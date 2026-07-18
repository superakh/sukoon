/**
 * Sukoon — Cloudflare Worker entry.
 *
 * Hono handles routing on top of the Workers runtime. Every feature
 * lives in its own module under ./routes/* and is mounted here so
 * this file stays a readable table of contents.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import type { Bindings } from './types';

// Route modules. Each exports a Hono app scoped to its own prefix.
// They are lazy-required to keep this table of contents readable —
// add a new route by dropping a file in ./routes/ and importing it.
import library from './routes/library';
import chat from './routes/chat';
import breathe from './routes/breathe';
import pulse from './routes/pulse';
import crisis from './routes/crisis';
import media from './routes/media';

// Durable Object class. Re-exported at the bottom so Wrangler can
// bind it to the PULSE namespace declared in wrangler.toml.
import { PulseCounter } from './do/pulse_counter';

const app = new Hono<{ Bindings: Bindings }>();

// --- Global middleware ------------------------------------------------
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => origin ?? '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Sukoon-Session'],
    credentials: true,
    maxAge: 86400,
  }),
);

// --- Health check -----------------------------------------------------
// Returns worker status plus a tiny snapshot of the content library so
// we can tell "is D1 reachable?" from the same probe. Safe to poll.
app.get('/api/health', async (c) => {
  const started = Date.now();
  let library_count = 0;
  let d1_ok = false;
  let sample: { id: string; title: string; kind: string } | null = null;

  try {
    const row = await c.env.SUKOON_DB.prepare(
      'SELECT COUNT(*) AS n FROM library_items',
    ).first<{ n: number }>();
    library_count = row?.n ?? 0;
    d1_ok = true;

    const first = await c.env.SUKOON_DB.prepare(
      'SELECT id, title, kind FROM library_items ORDER BY updated_at DESC LIMIT 1',
    ).first<{ id: string; title: string; kind: string }>();
    sample = first ?? null;
  } catch {
    // D1 unreachable or table missing (fresh env). Still return 200 so
    // uptime probes don't page — the caller can inspect `d1_ok`.
    d1_ok = false;
  }

  return c.json({
    status: 'ok',
    service: 'sukoon',
    env: c.env.NODE_ENV,
    d1_ok,
    library: {
      count: library_count,
      latest: sample,
    },
    latency_ms: Date.now() - started,
    ts: new Date().toISOString(),
  });
});

// --- Feature routes ---------------------------------------------------
app.route('/api/library', library);
app.route('/api/chat', chat);
app.route('/api/breathe', breathe);
app.route('/api/pulse', pulse);
app.route('/api/crisis', crisis);
app.route('/api/media', media);

// --- Fallbacks --------------------------------------------------------
app.notFound((c) =>
  c.json({ error: 'not_found', path: new URL(c.req.url).pathname }, 404),
);

app.onError((err, c) => {
  console.error('[sukoon] unhandled', err);
  return c.json(
    {
      error: 'internal_error',
      message: err instanceof Error ? err.message : String(err),
    },
    500,
  );
});

export default app;
export { PulseCounter };
