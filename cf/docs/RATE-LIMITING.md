# Cloudflare Rate Limiting Rules — Sukoon

Replaces the in-memory `rateLimit.js` middleware. Once the Worker is fronted by
Cloudflare, per-IP throttling happens at the edge for free — no memory pressure
on our origin, no reset on deploys, and it survives multi-region rollouts.

## Why we're moving off `rateLimit.js`

- In-memory counters vanish on every Worker cold start / rolling deploy.
- A Map keyed by IP grows unbounded — a slow leak in long-lived processes.
- We can't share counters across regions or between the Worker and Express.
- Cloudflare Rate Limiting is enforced *before* the request reaches our
  compute, so abusive traffic never costs us a CPU cycle.

## Where to configure

**Cloudflare Dashboard → Security → WAF → Rate limiting rules → Create rule**

Attach the rules to the `sukoon.cloud` zone. Create them in the order below;
Cloudflare evaluates rate-limiting rules top-to-bottom and stops at the first
match, so the tighter rules must sit above the catch-all.

---

## Rule 1 — `/api/chat` (expensive, LLM-fanout)

| Field | Value |
| --- | --- |
| Rule name | `sukoon-chat-per-ip` |
| If incoming requests match | `URI Path` `equals` `/api/chat` |
| When rate exceeds | `20` requests |
| Period | `1 minute` |
| Characteristic | `IP` |
| Action | `Block` |
| Duration | `1 minute` |
| Response | Custom JSON (see "Response body" below) |

**Rationale.** Each `/api/chat` call fans out to Anthropic, streams tokens
back, and holds a Worker subrequest for the full duration. 20 req/min per IP
is comfortably above a real user (a therapy conversation is ~1 message every
20–40 s) and well below the point where a single IP can drain our Anthropic
budget.

---

## Rule 2 — `/api/generate-*` (LLM-heavy generators)

| Field | Value |
| --- | --- |
| Rule name | `sukoon-generate-per-ip` |
| If incoming requests match | `URI Path` `starts with` `/api/generate-` |
| When rate exceeds | `10` requests |
| Period | `1 minute` |
| Characteristic | `IP` |
| Action | `Block` |
| Duration | `1 minute` |
| Response | Custom JSON (see "Response body" below) |

**Rationale.** Covers `/api/generate-plan`, `/api/generate-meditation`,
`/api/generate-affirmation`, and any future `generate-*` route. These are
one-shot LLM calls but produce longer outputs than chat turns, so the per-call
Anthropic cost is higher and the human cadence is slower — a user does not
generate ten meditations a minute.

---

## Rule 3 — `/api/*` catch-all (matches old Express behaviour)

| Field | Value |
| --- | --- |
| Rule name | `sukoon-api-catchall-per-ip` |
| If incoming requests match | `URI Path` `starts with` `/api/` |
| When rate exceeds | `60` requests |
| Period | `1 minute` |
| Characteristic | `IP` |
| Action | `Block` |
| Duration | `1 minute` |
| Response | Custom JSON (see "Response body" below) |

**Rationale.** Mirrors the 60 req/min ceiling that `rateLimit.js` applied to
every `/api/*` route in the Express version. Anything not caught by Rules 1–2
falls through to this bucket, so cheap endpoints still get a sane ceiling
without punishing normal usage.

---

## Rule 4 — `/api/pulse` and `/api/daily` (skip rate limiting)

These endpoints are cheap, idempotent, and heavily cached at the edge. We
explicitly *do not* want them counted against the catch-all — the homepage
fires them on load and a rate-limit here would degrade the landing UX.

Two options — either works:

**Option A (preferred): Skip action.**

| Field | Value |
| --- | --- |
| Rule name | `sukoon-skip-cacheable` |
| Position | **Above** Rule 3 |
| If incoming requests match | `URI Path` `equals` `/api/pulse` `OR` `URI Path` `equals` `/api/daily` |
| Action | `Skip` → skip remaining rate-limiting rules |

**Option B: Exclude in Rule 3's expression.**

Change Rule 3's expression to:

```
(starts_with(http.request.uri.path, "/api/")
  and not (http.request.uri.path in {"/api/pulse" "/api/daily"}))
```

Option A is easier to reason about when we add new cheap endpoints later —
just append them to the skip list.

---

## Response body (all block actions)

Configure a **Custom response** on each blocking rule so the client gets a
useful payload instead of Cloudflare's default HTML challenge page.

- **Response type:** `Custom JSON`
- **Response code:** `429`
- **Response body:**

  ```json
  {"error":"Too many requests. Please slow down."}
  ```

- **Custom response headers:**

  | Header | Value |
  | --- | --- |
  | `Content-Type` | `application/json; charset=utf-8` |
  | `Retry-After` | `60` |
  | `Cache-Control` | `no-store` |

`Retry-After: 60` matches the 1-minute block duration so well-behaved clients
back off correctly. The frontend already reads this header in
`utils/apiClient.js` — no client changes required.

---

## Verification checklist

After deploying the rules:

1. **Load test one endpoint.** From a single IP, hammer `/api/chat` 25 times
   in ~10 s (`hey -n 25 -c 1 https://sukoon.cloud/api/chat`). Expect the last
   five responses to be `429` with the JSON body above.
2. **Confirm cheap endpoints are exempt.** Hit `/api/pulse` 200 times in a
   minute. All should be `200`.
3. **Watch the dashboard.** Security → Events → filter by `Rate limiting` —
   confirm the correct rule name is firing for each test.
4. **Delete `rateLimit.js`.** Once the above passes in staging, remove the
   middleware from the Worker and drop the module. Do not leave dead code in
   the hot path.

## Rollback

Each rule has a **Disable** toggle in the dashboard. Flip Rules 1–3 off and
traffic behaviour reverts to unlimited within seconds — no deploy required.
Keep `rateLimit.js` in git history (not in the running Worker) so we can
re-import it if we ever move off Cloudflare.
