# Cloudflare AI Gateway Setup for Sukoon

This guide walks through putting Cloudflare AI Gateway in front of Anthropic so every `messages` call from the Sukoon Worker gets cached, retried, rate-limited, logged, and cost-tracked automatically.

## Why AI Gateway

AI Gateway is a thin proxy that sits between your Worker and Anthropic. Once it is in the path you get:

- **Automatic caching** of identical requests — huge win for our meditation prompts, which repeat verbatim across users.
- **Retries with backoff** on 5xx and network hiccups without any code in the Worker.
- **Rate limiting** per gateway to protect the Anthropic key from a runaway loop.
- **Observability** — every request logged with latency, status, tokens in/out, and cost.
- **Cost tracking** — per-day and per-model spend without wiring up billing exports.
- **Logs** with the exact request/response body, filterable by status and model.

Anthropic itself sees a normal API call. The Worker code barely changes.

## 1. Create the gateway

1. Cloudflare dashboard → **AI** → **AI Gateway** → **Create Gateway**.
2. Name: `sukoon-ai`. Leave defaults.
3. Copy the endpoint URL. It looks like:

```
https://gateway.ai.cloudflare.com/v1/{account_id}/sukoon-ai/anthropic
```

Note the trailing `/anthropic` — that segment tells the gateway which upstream to forward to.

## 2. Wire it into the Worker

Add the gateway URL as a plain var (it is not a secret — the account id is visible in the URL and safe to check in) and keep the Anthropic key as a secret.

```bash
# wrangler.toml (non-secret)
[vars]
CF_AI_GATEWAY_URL = "https://gateway.ai.cloudflare.com/v1/{account_id}/sukoon-ai/anthropic"

# secret (never committed)
npx wrangler secret put ANTHROPIC_API_KEY
```

## 3. How `anthropic.ts` uses it

The wrapper posts to `${CF_AI_GATEWAY_URL}/v1/messages` with the same Anthropic-format body it would send to `api.anthropic.com`. Only the base URL changes; headers and payload are untouched.

```ts
const res = await fetch(`${env.CF_AI_GATEWAY_URL}/v1/messages`, {
  method: "POST",
  headers: {
    "x-api-key": env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
    // Cache identical (system, messages) hashes for 5 minutes
    "cf-aig-cache-ttl": "300",
  },
  body: JSON.stringify({ model, system, messages, max_tokens }),
});
```

`cf-aig-cache-ttl: 300` gives us a five-minute TTL keyed on the hash of the full request body. Meditation generation reuses the same seed prompt for large user cohorts, so cache hit rates on the meditation endpoint typically sit above 60%.

## 4. Observability

In the dashboard, open **AI Gateway → sukoon-ai → Logs**. You get:

- Request log with prompt, response, model, and cache status.
- Latency percentiles (p50/p95/p99).
- Error rate broken down by upstream status.
- Token spend by day and by model — the number that shows up on the Anthropic invoice.

## 5. Verify before deploying

Run this one-liner from your laptop. If it returns a normal `messages` response, the gateway is live and the Worker will just work.

```bash
curl "$CF_AI_GATEWAY_URL/v1/messages" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5","max_tokens":32,"messages":[{"role":"user","content":"ping"}]}'
```

If that returns 200, deploy the Worker.
