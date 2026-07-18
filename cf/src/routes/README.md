# Routes

Each file here is a Hono sub-app mounted under `/api/<name>` from
`src/index.ts`. Keep the modules thin — one feature per file, no
cross-imports beyond `../types`, `../lib/*`, and `../durable/*`.

## Port map (Express → Worker)

| Express (`routes/*.js`) | Worker (`cf/src/routes/*.ts`) | Notes |
| --- | --- | --- |
| `pulse.js`      | `pulse.ts`   | Fan-out to `durable/pulse.ts` DO — state now survives restarts. |
| `yoga.js`       | `yoga.ts`    | Filters pushed down to D1 (`yoga_asanas`, `yoga_sequences`). |
| `courses.js`    | `courses.ts` | List summarizer keeps the heavy `sessions` / `days_content` off list responses. |
| `library.js`    | `library.ts` | (Ported separately.) |
| `chat.js`       | `chat.ts`    | (Ported separately.) |
| `crisis.js`     | `crisis.ts`  | (Ported separately.) |
| `daily.js`      | (folded into `library.ts`) | — |
| `route.js`      | (folded into `library.ts`) | — |
| `rateLimit.js`  | **removed** | See below. |

## Why `rateLimit.js` is gone

The Express version kept an in-memory `Map<ip, {count, windowStart}>`
that was pruned every minute (see `sukoon/routes/rateLimit.js`).
That approach doesn't survive on the edge:

- Workers are stateless per isolate — every colo, every isolate, every
  cold start would keep its own counter, so the effective rate limit
  becomes `MAX_PER_WINDOW × isolates`.
- We'd have to promote the Map to KV or a Durable Object just to
  restore the semantics, which is exactly what Cloudflare's Rate
  Limiting Rules do already, without app code.

So rate limiting is now configured **outside the Worker**, via the
Cloudflare dashboard + `wrangler.toml`:

- **Anonymous read endpoints** (`/api/pulse`, `/api/yoga*`,
  `/api/courses*`, `/api/library*`): 60 req / min / IP, matching the
  old Express limit.
- **AI-adjacent endpoints** (`/api/chat`, `/api/generate`,
  `/api/translate`): a stricter tier — configured in the dashboard so
  we can tune it without a redeploy.
- **Crisis path** (`/api/crisis`): intentionally unthrottled at the
  edge. Anyone reaching for a helpline gets through.

Ownership: the rules live in the Cloudflare account, cross-referenced
in `cf/docs/rate-limits.md` (TODO). If you touch the limits, update
both the dashboard rule and that doc so the next engineer can find it.
No route code should re-implement rate limiting.
