/* ─── Shared Anthropic caller ──────────────────────────────────────────
   Single source of truth for talking to Claude. Used by chat, route,
   and the three generate-* endpoints. Mirrors the contract already
   established in routes/chat.js: x-api-key header, native Messages API,
   AbortController timeout, retry-once on 429 / 5xx upstream. */

const ANTHROPIC = {
  url: 'https://api.anthropic.com/v1/messages',
  model: 'claude-sonnet-4-6',
  apiVersion: '2023-06-01',
  timeoutMs: 20_000
};

async function callOnce({ system, messages, maxTokens = 500, temperature = 0.7 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, reason: 'no-key' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANTHROPIC.timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(ANTHROPIC.url, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': ANTHROPIC.apiVersion,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: ANTHROPIC.model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages
      }),
      signal: controller.signal
    });

    const ms = Date.now() - startedAt;

    if (!response.ok) {
      // Drain body silently — never log user-derived content.
      const errBody = await response.text().catch(() => '');
      console.error(`[Anthropic] ${response.status} in ${ms}ms: ${errBody.slice(0, 200)}`);
      return { ok: false, reason: `http-${response.status}`, ms, status: response.status };
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;
    if (!text) return { ok: false, reason: 'empty', ms };
    return { ok: true, text, ms };
  } catch (err) {
    const ms = Date.now() - startedAt;
    const reason = err.name === 'AbortError' ? 'timeout' : `error:${err.message.slice(0, 80)}`;
    console.error(`[Anthropic] ${reason} in ${ms}ms`);
    return { ok: false, reason, ms };
  } finally {
    clearTimeout(timeout);
  }
}

/* Public: callAnthropic — does callOnce, retries once on 429/5xx. */
async function callAnthropic(opts) {
  let result = await callOnce(opts);
  if (!result.ok && (result.status === 429 || (result.status && result.status >= 500))) {
    result = await callOnce(opts);
  }
  return result;
}

module.exports = { callAnthropic, ANTHROPIC };
