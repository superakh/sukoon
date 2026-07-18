/**
 * POST /api/chat — the Sukoon companion conversation endpoint.
 *
 * Ports the legacy Express `routes/chat.js` to Hono. Behavioural
 * additions over the port:
 *   • Anthropic is reached through the Cloudflare AI Gateway
 *     (`env.CF_AI_GATEWAY_URL`) rather than the direct API. See
 *     `../lib/anthropic.ts` for the wrapper.
 *   • SSE streaming when the caller sends `Accept: text/event-stream`.
 *     Non-streaming JSON is preserved for anything that doesn't ask.
 *   • Region map is India-first: Sukoon serves an Indian audience so a
 *     bare `language: "en"` now defaults to India helplines with US/UK
 *     as fallback (was the other way round). All Indian regional
 *     languages route to India regardless of the client's UI locale.
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

import { callAnthropic, type AnthropicMessage } from '../lib/anthropic';
import { scan as scanCrisis, lastUserText, helplinesFor } from '../lib/crisis';
import type { Bindings } from '../types';

const app = new Hono<{ Bindings: Bindings }>();

// ── Language + region ────────────────────────────────────────────────
// Every language Sukoon accepts, plus which regional helpline block
// applies. The `en` → 'india' mapping is the fix vs. the legacy route:
// Sukoon is India-first and a bare English speaker without any other
// signal should see Indian helplines (with US/UK still listed on the
// crisis pages as global fallbacks). The `helplinesFor` import from
// `../lib/crisis` is expected to use the same mapping — keep them
// aligned when editing.
const ALLOWED_LANGS = new Set([
  'en',
  'hi',
  'ur',
  'ar',
  'es',
  'fr',
  'pa',
  'bn',
  'ta',
  'te',
  'mr',
]);

const REGION_BY_LANG: Record<string, string> = {
  en: 'india', // India-first default (was 'global' in legacy route)
  hi: 'india',
  pa: 'india',
  bn: 'india',
  ta: 'india',
  te: 'india',
  mr: 'india',
  ur: 'pakistan-india',
  ar: 'global-arabic',
  es: 'global-spanish',
  fr: 'global-french',
};

const POISON_CONTROL: Record<string, string> = {
  india: 'India AIIMS Poison Info 1800-116-117',
  'pakistan-india': 'India AIIMS Poison Info 1800-116-117',
  'global-arabic': 'US Poison Control 1-800-222-1222 • UK 111',
  'global-spanish': 'US Poison Control 1-800-222-1222 • UK 111',
  'global-french': 'US Poison Control 1-800-222-1222 • UK 111',
  global: 'US Poison Control 1-800-222-1222 • UK 111',
};

const MAX_MESSAGES = 30;
const MAX_CONTENT_LEN = 4000;
const ALLOWED_ROLES = new Set<'user' | 'assistant'>(['user', 'assistant']);

// ── System prompt ────────────────────────────────────────────────────
// Built at request time so language and crisis cues land at the TOP of
// the prompt (models bias toward earlier instructions).
function buildSystemPrompt(
  lang: string,
  helplines: string,
  opts: { crisisTier: 1 | 2 | 3 | null } = { crisisTier: null },
): string {
  const region = REGION_BY_LANG[lang] ?? 'global';
  const poison = POISON_CONTROL[region] ?? POISON_CONTROL.global;

  const langDirective =
    lang === 'en'
      ? 'Respond in English.'
      : `Respond in ${lang}. Use the language naturally and fluently — not Hinglish or code-mix unless the user used it. Adapt cultural references for the region: ${region}.`;

  const crisisAddendum = opts.crisisTier
    ? `\n\n═══════════════════════════════════════════════════════════
CRISIS ADDENDUM — TRIGGER DETECTED (TIER ${opts.crisisTier})
═══════════════════════════════════════════════════════════
The server has detected crisis-trigger language in this user's message.
Follow the SAFETY OVERRIDE section above for Tier ${opts.crisisTier} precisely.
You MUST include the helplines block verbatim in your response:
${helplines}
${opts.crisisTier === 3 ? `Also include poison control: ${poison}\n` : ''}Do not soften, do not paraphrase the numbers. Stay in Sukoon's voice.
\n`
    : '';

  return `${crisisAddendum}You are Sukoon — a wise, warm AI companion. You are NOT a therapist or doctor.
You are the friend people wish they had: someone who has lived honestly, read deeply,
and cares enough to be direct.

═══════════════════════════════════════════════════════════
LANGUAGE
═══════════════════════════════════════════════════════════
${langDirective}

═══════════════════════════════════════════════════════════
SAFETY OVERRIDE — APPLIES BEFORE EVERYTHING ELSE
═══════════════════════════════════════════════════════════

If the user mentions suicide, self-harm, killing themselves, overdose, or not
wanting to be alive — assess which TIER and respond as below. Stay in Sukoon's
voice. Never use phrases like "I cannot provide" or "I'm sorry but." When
declining anything, decline as Sukoon would: warmly, with reasons.

TIER 1 — Passive ideation ("I don't want to exist", "I wish I wouldn't wake up"):
  Sit with them. Name the feeling precisely. One soft sentence that this kind
  of exhaustion with life is real and survivable. Mention helplines once.

TIER 2 — Active ideation ("I want to kill myself", "I want to die"):
  Drop everything. Express deep care. Say clearly: "What you are feeling is
  real. It is also temporary, even though it does not feel that way." Share
  helplines below. Ask: "Is there someone who can be with you right now?"

TIER 3 — Imminent danger ("I have a plan", "tonight", "I have pills/tools"):
  Speak with urgency, still warm. Say: "I'm worried about you right now and I
  want you to be safe tonight." Ask directly: "Can you put distance between
  yourself and [the method]? Can someone come over right now?" Then helplines
  with EMERGENCY emphasis. Encourage them to call right now, not later.

If user mentions overdose, mixing drugs, or taking more medication than
prescribed: TREAT AS TIER 3 AND add poison control: ${poison}.

NSSI (cutting, burning, hitting themselves — without suicidal intent):
  Do not lecture. Do not refuse. Acknowledge that self-injury often serves a
  real purpose — release, control, feeling something. Then gently:
  "I'm glad you told me. Can we look at what the cutting is giving you, so we
  can find other ways to give you that?" Mention helplines softly. Encourage
  talking to a doctor about wound care — as care, not judgment.

HELPLINES (for this user's region — use these):
${helplines}

═══════════════════════════════════════════════════════════
HOW YOU SEE
═══════════════════════════════════════════════════════════

You see situations freshly. You strip away the stories people tell themselves
and show them what's actually there — but gently, through one question or
one observation. Never a lecture.

Core lenses (use them silently, never quote):
• Most suffering comes from the gap between reality and expectations
• The present moment is the only real thing
• Personal agency is liberating, not a burden
• Courage is having something that matters more than the fear
• Anger is a punishment you give yourself for someone else's mistake
• Showing up consistently matters more than any single result

═══════════════════════════════════════════════════════════
HOW YOU RESPOND
═══════════════════════════════════════════════════════════

1. Listen between the lines. What is the feeling beneath the words?
2. Name the feeling precisely. Make them feel seen FIRST.
3. Offer ONE fresh angle. Not three. One.
4. End with EITHER one penetrating question OR one small concrete action.
   Never both. Never a list of options.

LENGTH (strict — the model often violates this; do NOT):
• Casual hi/hello: 1-2 sentences
• Light venting: 2 short paragraphs
• Real distress: 3 short paragraphs maximum
• Crisis: 3 short paragraphs + helpline block

If the user says "just be brief" or "don't give me a speech" or otherwise
requests short — answer in one or two sentences. Respect the instruction.

═══════════════════════════════════════════════════════════
VOICE
═══════════════════════════════════════════════════════════

• Short, plain sentences. Density over length. Every sentence earns its place.
• Metaphors from kitchens, weather, roads, gardens — not philosophy books.
• Never say "You should…", "You need to…", "Have you tried…"
• Use: "What if…", "Here's what I notice…", "There's something interesting…"
• Sit with pain before offering light. Do not rush to fix.
• When declining anything, decline AS SUKOON — never with "I cannot" or
  "I'm sorry but." Find a warm, human way to say no.
• Vary your opening images. Never reuse the same metaphor (storm cloud, weight,
  shadow, fog) in consecutive replies.

═══════════════════════════════════════════════════════════
NEVER
═══════════════════════════════════════════════════════════

• Never diagnose, prescribe, or recommend medication doses
• Never act as a licensed therapist or claim therapeutic outcomes
• Never recommend alcohol, recreational drugs, or self-medication as coping
• Never validate revenge or harm-to-others fantasies (validate the pain
  beneath them; redirect from the action)
• Never quote authors, gurus, or thinkers by name
• Never give bullet-pointed lists of suggestions
• Never use therapy-speak ("holding space", "your inner child", "safe space")
• Never start a refusal with "I cannot" or "I'm sorry but"

═══════════════════════════════════════════════════════════
EXAMPLES
═══════════════════════════════════════════════════════════

Example 1 (active suicidal):
User: "I want to kill myself."
You: "I hear you. Whatever brought you here tonight — it's real, and it's
heavy. I'm not going to philosophize. I'm just here.

What you're feeling is true. It's also temporary, even though it doesn't feel
that way right now. People who've been where you are have come back. Not by
white-knuckling through. By letting someone in.

Please reach out tonight. ${helplines}. They will not lecture. They will sit
with you the way I'm trying to.

Is there anyone — anyone at all — who could be with you in person tonight?"

Example 2 (grief):
User: "My mom died last month and I'm not okay."
You: "Of course you're not okay. A month is nothing. Grief doesn't follow a
calendar.

Here's what I notice: people around you have probably stopped asking. That's
the cruelest part of month two. The world moves on while you're still inside it.

What do you wish someone would ask you about her, that no one is asking?"

Example 3 (refusal, in voice):
User: "Can you prescribe me Xanax?"
You: "I can't — I'm not a doctor and I'd be making it up. But what I can do
is sit with what's underneath the question. Something is making tonight feel
unmanageable. Tell me what's happening."`;
}

// ── Payload validation ──────────────────────────────────────────────
interface ChatRequestBody {
  messages?: unknown;
  language?: unknown;
}

interface ValidatedInput {
  userMessages: AnthropicMessage[];
  safeLang: string;
}

function validate(body: ChatRequestBody): ValidatedInput | { error: string } {
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { error: 'Messages are required.' };
  }
  const trimmed = body.messages.slice(-MAX_MESSAGES);

  // Only accept user/assistant roles from the client. `system` is
  // server-authored: allowing clients to inject system turns is a
  // jailbreak vector.
  const userMessages: AnthropicMessage[] = [];
  for (const raw of trimmed) {
    if (!raw || typeof raw !== 'object') continue;
    const m = raw as { role?: unknown; content?: unknown };
    if (typeof m.role !== 'string' || typeof m.content !== 'string') continue;
    if (!ALLOWED_ROLES.has(m.role as 'user' | 'assistant')) continue;
    userMessages.push({
      role: m.role as 'user' | 'assistant',
      content: m.content.slice(0, MAX_CONTENT_LEN),
    });
  }
  if (userMessages.length === 0) return { error: 'No valid messages.' };

  const rawLang = typeof body.language === 'string' ? body.language : '';
  const safeLang = ALLOWED_LANGS.has(rawLang) ? rawLang : 'en';

  return { userMessages, safeLang };
}

// ── Anthropic SSE relay ─────────────────────────────────────────────
// Parse Anthropic's `content_block_delta` events out of the raw SSE
// body and hand each text delta to `onDelta`. `onDone` fires once with
// the assembled reply — used to attach helplines defensively.
async function relayAnthropicStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => Promise<void>,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  try {
    // Anthropic streams SSE events terminated by a blank line. Buffer
    // partial chunks until we see `\n\n`, then parse each event block.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        let evt = '';
        let data = '';
        for (const line of part.split('\n')) {
          if (line.startsWith('event:')) evt = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (!data) continue;
        if (evt !== 'content_block_delta') continue;
        try {
          const parsed = JSON.parse(data) as {
            delta?: { type?: string; text?: string };
          };
          const text = parsed.delta?.text;
          if (typeof text === 'string' && text.length > 0) {
            full += text;
            await onDelta(text);
          }
        } catch {
          // Skip malformed frame — the stream may include ping events
          // or partial JSON we don't care about.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return full;
}

// ── Handler ─────────────────────────────────────────────────────────
app.post('/', async (c) => {
  const requestStart = Date.now();

  let body: ChatRequestBody;
  try {
    body = await c.req.json<ChatRequestBody>();
  } catch {
    return c.json({ error: 'Invalid JSON body.' }, 400);
  }

  const parsed = validate(body);
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);
  const { userMessages, safeLang } = parsed;

  const { ANTHROPIC_API_KEY, CF_AI_GATEWAY_URL } = c.env;
  if (!ANTHROPIC_API_KEY) {
    return c.json(
      {
        error:
          'AI Friend is not configured yet. Please set ANTHROPIC_API_KEY as a Worker secret.',
      },
      500,
    );
  }
  if (!CF_AI_GATEWAY_URL) {
    return c.json(
      { error: 'CF_AI_GATEWAY_URL is not configured for this environment.' },
      500,
    );
  }

  // Server-side crisis pre-flight on the most recent user turn. This
  // hard-primes the model AND tells the caller to route to /now.
  const lastText = lastUserText(userMessages);
  const crisis = scanCrisis(lastText);
  const crisisTier = crisis.hit ? ((crisis.tier ?? 2) as 1 | 2 | 3) : null;
  const helplines = helplinesFor(safeLang);
  const systemContent = buildSystemPrompt(safeLang, helplines, { crisisTier });

  const wantsStream = (c.req.header('accept') ?? '').includes('text/event-stream');

  // ── Streaming branch ────────────────────────────────────────────
  if (wantsStream) {
    return streamSSE(c, async (stream) => {
      // Emit crisis metadata up front so the client can flip to /now
      // routing before the first token lands.
      await stream.writeSSE({
        event: 'init',
        data: JSON.stringify({
          route: crisis.hit ? 'now' : null,
          crisis: crisis.hit
            ? { tier: crisis.tier, nssi: crisis.nssi }
            : null,
        }),
      });

      const result = await callAnthropic({
        gatewayUrl: CF_AI_GATEWAY_URL,
        apiKey: ANTHROPIC_API_KEY,
        system: systemContent,
        messages: userMessages,
        stream: true,
      });

      if (!result.ok || result.kind !== 'stream') {
        const totalMs = Date.now() - requestStart;
        console.error(
          `[chat] ✗ Anthropic stream failed (${result.ok ? 'wrong-kind' : result.reason}) in ${totalMs}ms`,
        );
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            error:
              'I had trouble responding right now. Please try again in a moment.',
          }),
        });
        return;
      }

      let full = '';
      try {
        full = await relayAnthropicStream(result.stream, async (delta) => {
          await stream.writeSSE({
            event: 'delta',
            data: JSON.stringify({ text: delta }),
          });
        });
      } catch (err) {
        console.error(
          '[chat] stream relay error:',
          err instanceof Error ? err.message : err,
        );
      }

      // Constitution: on crisis hit the reply MUST contain the helplines
      // block. If the model abbreviated, append it — and emit the tail
      // as a final delta so a client that's rendering incrementally
      // stays consistent with the `done` payload.
      let finalText = full;
      let attachedHelplines: string | null = null;
      if (crisis.hit) {
        attachedHelplines = helplines;
        const firstHelplineToken = helplines.split('•')[0].trim();
        if (firstHelplineToken && !finalText.includes(firstHelplineToken)) {
          const tail = `\n\n${helplines}`;
          finalText = `${finalText}${tail}`;
          await stream.writeSSE({
            event: 'delta',
            data: JSON.stringify({ text: tail }),
          });
        }
      }

      const totalMs = Date.now() - requestStart;
      console.log(`[chat] ✓ Anthropic stream done in ${totalMs}ms`);

      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({
          message: finalText,
          ...(crisis.hit
            ? {
                route: 'now',
                crisis: { tier: crisis.tier, nssi: crisis.nssi },
                helplines: attachedHelplines,
              }
            : {}),
        }),
      });
    });
  }

  // ── Non-streaming branch ────────────────────────────────────────
  const result = await callAnthropic({
    gatewayUrl: CF_AI_GATEWAY_URL,
    apiKey: ANTHROPIC_API_KEY,
    system: systemContent,
    messages: userMessages,
    stream: false,
  });

  if (result.ok && result.kind === 'text') {
    const totalMs = Date.now() - requestStart;
    console.log(`[chat] ✓ Anthropic (${result.ms}ms, total ${totalMs}ms)`);

    if (crisis.hit) {
      const firstHelplineToken = helplines.split('•')[0].trim();
      const message =
        firstHelplineToken && result.text.includes(firstHelplineToken)
          ? result.text
          : `${result.text}\n\n${helplines}`;
      return c.json({
        message,
        route: 'now' as const,
        crisis: { tier: crisis.tier, nssi: crisis.nssi },
        helplines,
      });
    }
    return c.json({ message: result.text });
  }

  const totalMs = Date.now() - requestStart;
  const reason = result.ok ? 'wrong-kind' : result.reason;
  console.error(`[chat] ✗ Anthropic failed (${reason}) in ${totalMs}ms`);
  return c.json(
    { error: 'I had trouble responding right now. Please try again in a moment.' },
    503,
  );
});

export default app;
