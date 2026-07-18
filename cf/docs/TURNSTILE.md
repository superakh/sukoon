# Cloudflare Turnstile — Bot Protection for `/api/chat`

Turnstile is Cloudflare's CAPTCHA replacement. It runs a set of invisible
browser challenges (proof-of-work, TLS fingerprinting, behavioural signals) and
issues a short-lived token that our Worker verifies before it forwards the
request to Anthropic. Bots that can't solve the challenge — or that reuse
tokens — never spend our LLM budget.

We're putting it in front of `/api/chat` because that's the most expensive
endpoint and the one most attractive to abuse (free LLM access via our API
key). Everything else stays open.

---

## 1. Create the Turnstile site

**Cloudflare Dashboard → Turnstile → Add site**

| Field | Value |
| --- | --- |
| Site name | `sukoon-chat` |
| Domains | `sukoon.cloud`, `www.sukoon.cloud` (add `localhost` for dev) |
| Widget mode | **Invisible** |
| Pre-clearance | `Off` (we handle verification server-side) |

Save the two secrets that appear on the confirmation screen:

- **Site key** — public, ships to the browser.
- **Secret key** — private, only the Worker sees it.

Store the secret key in the Worker:

```bash
wrangler secret put TURNSTILE_SECRET_KEY
```

Store the site key as a plain (non-secret) var so the frontend can read it via
the config endpoint:

```bash
wrangler vars put TURNSTILE_SITE_KEY --value "0x4AAAAAAA..."
```

For local dev, Cloudflare provides always-pass and always-fail test keys —
see the Turnstile docs. Use always-pass locally so devs don't need real keys.

---

## 2. Frontend integration

### 2a. Load the Turnstile script

Add to `index.html` (or your app shell), just before `</body>`:

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async defer></script>
```

The script is ~15 KB and is cached across every Cloudflare-protected site
the user has ever visited, so this is effectively free after first paint.

### 2b. Add the widget to the chat form

The invisible widget renders a zero-height div. Drop it inside the chat
composer, right above the submit button:

```html
<form id="chat-form">
  <textarea name="message" required></textarea>

  <div class="cf-turnstile"
       data-sitekey="TURNSTILE_SITE_KEY_HERE"
       data-callback="onTurnstileSuccess"
       data-error-callback="onTurnstileError"
       data-expired-callback="onTurnstileExpired"
       data-size="invisible"></div>

  <button type="submit">Send</button>
</form>
```

Replace `TURNSTILE_SITE_KEY_HERE` at build time from
`import.meta.env.VITE_TURNSTILE_SITE_KEY` (or however your bundler injects
public config).

### 2c. Attach the token to the request

Invisible Turnstile runs a challenge in the background and fires the
`data-callback` with a token. Cache it on the form, then send it in the
`cf-turnstile-response` field alongside the chat payload:

```js
let turnstileToken = null;

window.onTurnstileSuccess = (token) => { turnstileToken = token; };
window.onTurnstileError    = ()      => { turnstileToken = null; };
window.onTurnstileExpired  = ()      => { turnstileToken = null; };

document.getElementById('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!turnstileToken) {
    // Force a challenge if the background one hasn't finished yet.
    turnstile.execute();
    return;
  }

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: e.target.message.value,
      'cf-turnstile-response': turnstileToken,
    }),
  });

  // Tokens are single-use — reset immediately.
  turnstileToken = null;
  turnstile.reset();

  // ... handle response
});
```

Turnstile tokens are single-use and expire after 300 seconds. Reset after every
submit so the next message gets a fresh one.

---

## 3. Worker verification

Before the Worker calls Anthropic, POST the token to Cloudflare's siteverify
endpoint. Reject the request if the response comes back with `success: false`.

```js
// worker/src/turnstile.js
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token, remoteip, secret) {
  if (!token) return { ok: false, reason: 'missing-token' };

  const body = new URLSearchParams({
    secret,
    response: token,
    ...(remoteip && { remoteip }),
  });

  const res = await fetch(SITEVERIFY, { method: 'POST', body });
  const data = await res.json();

  if (!data.success) {
    return { ok: false, reason: data['error-codes']?.[0] ?? 'unknown' };
  }
  return { ok: true, hostname: data.hostname };
}
```

Wire it into the `/api/chat` handler:

```js
// worker/src/routes/chat.js
import { verifyTurnstile } from '../turnstile.js';

export async function handleChat(request, env) {
  const body  = await request.json();
  const token = body['cf-turnstile-response'];
  const ip    = request.headers.get('CF-Connecting-IP');

  const check = await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY);

  if (!check.ok && !isGraceEligible(request, env)) {
    return new Response(
      JSON.stringify({ error: 'Bot check failed. Please refresh and try again.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ... forward to Anthropic
}
```

`env.TURNSTILE_SECRET_KEY` is the secret set via `wrangler secret put` in
step 1. Never inline it, never log it, and never send it to the browser.

---

## 4. Grace behaviour for logged-out users

Turnstile can occasionally hiccup: the script fails to load on flaky mobile
networks, a strict content blocker eats the widget, or Cloudflare itself has a
regional incident. We don't want a Turnstile outage to take our chat down.

**Rules for the grace path (`isGraceEligible`):**

1. **Logged-in users are never granted grace.** They're authenticated and we
   can rate-limit them by user id anyway — send them straight to the 403.
2. **Logged-out users get a soft path**:
   - If the token is missing *and* the request has a valid same-origin
     `Referer` (`https://sukoon.cloud/...` or `www.sukoon.cloud`), allow the
     request but attach a low daily quota (e.g. 5 messages / IP / 24 h)
     enforced via Workers KV.
   - Log the event as `turnstile.grace` in analytics so we can watch the rate.
     A sudden spike means either an outage (fine, we're absorbing it) or an
     attacker who has learned the grace rule (not fine — tighten it).
3. **If `env.TURNSTILE_MODE === 'strict'` we skip grace entirely.** Set this
   flag during a known attack to force every user through the challenge.

```js
function isGraceEligible(request, env) {
  if (env.TURNSTILE_MODE === 'strict') return false;
  if (request.headers.get('Authorization')) return false; // logged in

  const referer = request.headers.get('Referer') ?? '';
  const okOrigin =
    referer.startsWith('https://sukoon.cloud/') ||
    referer.startsWith('https://www.sukoon.cloud/');

  return okOrigin;
}
```

Grace exists so a bad Turnstile day doesn't equal a bad Sukoon day for
first-time visitors. It's not a permanent bypass — a real attacker who spoofs
the Referer still gets stopped by the KV daily quota and by the Rate Limiting
rules in `RATE-LIMITING.md`.

---

## 5. Verification checklist

1. **Widget renders.** Open the chat page in an incognito window, watch the
   Network tab — you should see requests to
   `challenges.cloudflare.com/turnstile/v0/...` and no visible UI.
2. **Happy path.** Send a chat message. In the Worker logs, look for a
   `siteverify` call returning `success: true`, followed by the normal
   Anthropic call.
3. **Missing token.** With DevTools, strip `cf-turnstile-response` from the
   request body before sending. Expect a `403` with the JSON error body — and,
   if logged out with a good Referer, the grace path instead.
4. **Reused token.** Send the same token twice. The second call must fail
   with `timeout-or-duplicate` from siteverify.
5. **Test keys in dev.** Point local dev at the always-pass site key
   (`1x00000000000000000000AA`) and always-pass secret
   (`1x0000000000000000000000000000000AA`) so nobody needs prod credentials.

## Rollback

Two switches:

- **Frontend:** stop attaching `cf-turnstile-response` — the Worker will
  fall into the grace path for logged-out traffic and 403 for logged-in.
- **Worker:** short-circuit `verifyTurnstile` to always return `{ ok: true }`
  behind a `env.TURNSTILE_ENABLED === 'false'` guard. Ship the guard *now*
  so the rollback is a single `wrangler secret put` and not a code deploy.
