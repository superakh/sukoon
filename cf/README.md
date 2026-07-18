# Sukoon — Cloudflare Edge Backend

Sukoon is a free mental wellness platform. This directory holds the
Cloudflare Workers + Hono backend that powers the app: content
library, AI companion chat (Anthropic via AI Gateway), breathwork
sessions, live pulse counter, crisis routing, and R2-hosted media.

## Stack

| Concern                | Binding            | Backing service                         |
| ---------------------- | ------------------ | --------------------------------------- |
| HTTP framework         | –                  | Hono on Cloudflare Workers              |
| Content DB             | `SUKOON_DB`        | D1 (SQLite at the edge)                 |
| Audio / imagery        | `SUKOON_ASSETS`    | R2                                      |
| Rate limiting          | `RATE_LIMIT`       | Workers KV                              |
| Live pulse counter     | `PULSE`            | Durable Object (`PulseCounter`)         |
| LLM traffic            | –                  | Anthropic, wrapped via CF AI Gateway    |
| Voice (optional)       | –                  | ElevenLabs (secret only)                |

## Layout

```
cf/
  src/
    index.ts          # Worker entry — mounts every route, exports PulseCounter
    types.ts          # Bindings + shared types
    routes/
      library.ts
      chat.ts
      breathe.ts
      pulse.ts
      crisis.ts
      media.ts
    do/
      pulse_counter.ts
  scripts/
    json-to-d1.mjs    # Seed D1 from a JSON export of the content library
  wrangler.toml
  tsconfig.json
  package.json
```

## Local development

Prereqs: Node 20+, a Cloudflare account, `wrangler` logged in.

```bash
# 1. Install deps
npm install

# 2. Create the backing resources (one time, per env)
npx wrangler d1 create sukoon-content
npx wrangler r2 bucket create sukoon-assets
npx wrangler kv:namespace create RATE_LIMIT

# Paste the returned IDs into wrangler.toml (replace the PENDING
# placeholders on database_id and the KV `id`).

# 3. Provide secrets. .dev.vars is git-ignored; wrangler dev picks it up.
cat > .dev.vars <<'EOF'
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=...
EOF

# 4. Run locally on the Miniflare runtime
npm run dev
# -> http://127.0.0.1:8787/api/health
```

## Deploying

```bash
# Push production secrets once
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY

# Ship it
npm run deploy
```

## Seeding the content library

`scripts/json-to-d1.mjs` reads a JSON export of meditations, sleep
stories, and breathwork sessions and writes them to the D1 binding.

```bash
npm run seed -- ./data/library.json
```

## AI Gateway

All Anthropic calls go through
`https://gateway.ai.cloudflare.com/v1/{account}/sukoon-ai/anthropic`
so we get caching, cost caps, and a shared observability pane. The
gateway URL is read from `CF_AI_GATEWAY_URL` in `[vars]`; the
`ANTHROPIC_API_KEY` used as the upstream auth is a Worker secret.

## Health

`GET /api/health` returns worker status plus a snapshot of the content
library so uptime probes can distinguish "worker is up but D1 is not"
from "everything is fine."
