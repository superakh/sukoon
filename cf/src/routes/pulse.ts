/**
 * GET /api/pulse — anonymous "souls present now" counter.
 *
 * The Express version kept an in-memory counter that reset on every
 * process restart (see routes/pulse.js + routes/library.js#getPulse).
 * On Workers we fan the read out to a single Durable Object
 * (PulseCounter) so the wave stays continuous across recycles and
 * every isolate sees the same anchor.
 *
 * Constitution: no identity, no logging of user input, no
 * caching in front of the pulse (it must feel live).
 */

import { Hono } from 'hono';

import type { Bindings } from '../types';

const pulse = new Hono<{ Bindings: Bindings }>();

// The DO is a singleton — one shared pulse for the whole edge. Any
// stable idFromName works; "global" makes the intent obvious.
const PULSE_ID_NAME = 'global';

pulse.get('/', async (c) => {
  c.header('Cache-Control', 'no-store');

  try {
    const id = c.env.PULSE.idFromName(PULSE_ID_NAME);
    const stub = c.env.PULSE.get(id);

    // The path/host here are opaque — the DO's internal router only
    // cares about the pathname. See durable/pulse.ts#fetch.
    const doRes = await stub.fetch('https://pulse.internal/count');
    if (!doRes.ok) {
      throw new Error(`pulse_do_${doRes.status}`);
    }

    const body = (await doRes.json()) as { count: number; since: number };
    return c.json(body);
  } catch (err) {
    // Constitution: never log user input. Only log internal error class.
    console.error('[Pulse] uncaught:', err instanceof Error ? err.message : err);
    return c.json({ error: 'Pulse unavailable.' }, 500);
  }
});

export default pulse;
