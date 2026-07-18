/**
 * Anthropic client wrapped through a Cloudflare AI Gateway.
 *
 * We never call `api.anthropic.com` from the Worker directly — the
 * gateway gives us caching, retries, rate-limit metrics, and per-model
 * spend tracking. `env.CF_AI_GATEWAY_URL` should point at the gateway
 * up to and including the `/anthropic` segment
 * (e.g. `https://gateway.ai.cloudflare.com/v1/<acct>/<gw>/anthropic`).
 * We append `/v1/messages` ourselves so callers cannot accidentally
 * point at the wrong endpoint.
 *
 * Behaviour:
 *   • 20-second wall-clock timeout via AbortController
 *   • Retry-once on 429 or any 5xx (single transient blip is common on
 *     Anthropic; a second attempt costs ~1s and usually succeeds)
 *   • `stream: true` returns the raw SSE body as a ReadableStream so
 *     callers can pipe or re-emit frames without buffering the whole
 *     response
 *   • Non-streaming returns the plain text of the first content block
 */

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CallAnthropicOpts {
  /** Base gateway URL up to and including the `/anthropic` segment. */
  gatewayUrl: string;
  /** Anthropic API key (still required — gateway is a proxy, not auth). */
  apiKey: string;
  /** System prompt string. */
  system: string;
  /** Chat turns (user/assistant only — no system role here). */
  messages: AnthropicMessage[];
  /** Max output tokens. Defaults to 500 (matches legacy Express route). */
  maxTokens?: number;
  /** Sampling temperature. Defaults to 0.7. */
  temperature?: number;
  /** When true, return the raw Anthropic SSE stream instead of text. */
  stream?: boolean;
  /** Model id. Defaults to `claude-sonnet-4-6` (legacy compat). */
  model?: string;
  /** Anthropic API version header. Defaults to `2023-06-01`. */
  apiVersion?: string;
  /** Timeout in ms. Defaults to 20_000. */
  timeoutMs?: number;
}

export type CallAnthropicResult =
  | { ok: true; ms: number; kind: 'text'; text: string }
  | { ok: true; ms: number; kind: 'stream'; stream: ReadableStream<Uint8Array> }
  | { ok: false; ms: number; reason: string; status?: number };

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_API_VERSION = '2023-06-01';
const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Fire a single request to the AI Gateway with a wall-clock timeout.
 * Kept as an inner helper so the retry path can call it twice without
 * duplicating the AbortController plumbing.
 */
async function callOnce(opts: CallAnthropicOpts): Promise<CallAnthropicResult> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const url = `${opts.gatewayUrl.replace(/\/+$/, '')}/v1/messages`;
    const body = {
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: opts.maxTokens ?? 500,
      temperature: opts.temperature ?? 0.7,
      system: opts.system,
      messages: opts.messages,
      ...(opts.stream ? { stream: true } : {}),
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': opts.apiKey,
        'anthropic-version': opts.apiVersion ?? DEFAULT_API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    const ms = Date.now() - started;

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      // Truncate error body so we don't dump 10KB of HTML into logs.
      console.error(`[anthropic] ${res.status} in ${ms}ms:`, errText.slice(0, 200));
      return { ok: false, ms, reason: `http-${res.status}`, status: res.status };
    }

    if (opts.stream) {
      if (!res.body) {
        return { ok: false, ms, reason: 'no-stream-body' };
      }
      return { ok: true, ms, kind: 'stream', stream: res.body };
    }

    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text;
    if (!text) {
      console.error(`[anthropic] empty response in ${ms}ms`);
      return { ok: false, ms, reason: 'empty' };
    }
    return { ok: true, ms, kind: 'text', text };
  } catch (err) {
    const ms = Date.now() - started;
    const name = err instanceof Error ? err.name : 'unknown';
    const msg = err instanceof Error ? err.message : String(err);
    const reason = name === 'AbortError' ? 'timeout' : `error:${msg.slice(0, 80)}`;
    console.error(`[anthropic] ${reason} in ${ms}ms`);
    return { ok: false, ms, reason };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call Anthropic via the Cloudflare AI Gateway with a single retry on
 * transient failures. Safe to await from a Hono handler.
 */
export async function callAnthropic(
  opts: CallAnthropicOpts,
): Promise<CallAnthropicResult> {
  let result = await callOnce(opts);
  if (
    !result.ok &&
    (result.status === 429 || (result.status !== undefined && result.status >= 500))
  ) {
    console.log(`[anthropic] ${result.status} — retrying once`);
    result = await callOnce(opts);
  }
  return result;
}
