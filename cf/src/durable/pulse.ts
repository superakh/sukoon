/**
 * PulseCounter — Durable Object powering the "souls present now" pulse.
 *
 * The Express version (routes/library.js#getPulse) seeded a walk from
 * `Date.now()` at process boot. That reset every restart. Here we keep
 * the same deterministic sine wave, but the boot moment is persisted
 * in Durable Object storage the first time the DO wakes up. Every
 * subsequent request — whether the DO is warm or cold-started by
 * Cloudflare — reads the same anchor, so the wave stays continuous
 * across worker recycles.
 *
 * Anonymity by construction:
 *   - no identity, IP, or headers touch storage;
 *   - the only persisted key is `boot_ms` (a bare integer);
 *   - the pulse value is a pure function of (now - boot_ms).
 *
 * The DO exposes a tiny fetch handler as an internal RPC surface. The
 * public HTTP route (routes/pulse.ts) hits GET /count on the stub and
 * forwards the JSON to the client.
 */

import type { DurableObjectState } from '@cloudflare/workers-types';

interface PulseSnapshot {
  count: number;
  since: number;
}

export class PulseCounter {
  private readonly ctx: DurableObjectState;
  private bootMs: number | null = null;

  constructor(ctx: DurableObjectState, _env: unknown) {
    this.ctx = ctx;
    // blockConcurrencyWhile guarantees the boot anchor is loaded (or
    // written for the first time) before any fetch handler runs. This
    // is the standard cold-start pattern for DOs backed by storage.
    void this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<number>('boot_ms');
      if (typeof stored === 'number' && Number.isFinite(stored)) {
        this.bootMs = stored;
      } else {
        const now = Date.now();
        await this.ctx.storage.put('boot_ms', now);
        this.bootMs = now;
      }
    });
  }

  /**
   * Deterministic wave keyed to `(now - bootMs)`. Mirrors the original
   * getPulse() so the frontend animation stays identical:
   *   - base 240–299 souls (seeded once by the boot moment);
   *   - ~80-soul sine wave with a ~6 min period;
   *   - slow +1 drift every 4 min;
   *   - hard floor of 50 so the pulse never reads "empty".
   */
  private snapshot(now: number = Date.now()): PulseSnapshot {
    const bootMs = this.bootMs ?? now;
    const base = 240 + (bootMs % 60);
    const uptimeSec = Math.floor((now - bootMs) / 1000);
    const wave = Math.round(80 * Math.sin(uptimeSec / 60));
    const drift = Math.floor(uptimeSec / 240);
    const count = Math.max(50, base + wave + drift);
    return { count, since: bootMs };
  }

  /**
   * Internal RPC surface. The URL passed to `stub.fetch(...)` is opaque
   * to the outside world — we treat the path as a private router.
   *
   *   GET /count  →  { count, since }
   *
   * Anything else 404s so a rogue caller can't probe the DO for state.
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/count') {
      return Response.json(this.snapshot());
    }
    return new Response('not_found', { status: 404 });
  }
}
