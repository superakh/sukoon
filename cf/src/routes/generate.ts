/**
 * Generative fallbacks — /api/generate-{meditation,story,breath}
 *
 * When the library has no match for a given mood/duration/theme, Claude
 * writes fresh content under the same voice constraints that govern the
 * curated library. Each endpoint has its own STRICT-JSON system prompt
 * and its own token budget:
 *
 *   POST /api/generate-meditation  → maxTokens 2500
 *   POST /api/generate-story       → maxTokens 2500
 *   POST /api/generate-breath      → maxTokens 1500
 *
 * These were the three endpoints that failed on Railway because Express
 * URL-rewrite middleware never let the request reach the handler. On
 * the Hono/Workers stack they are plain routes and just work.
 */
import { Hono } from 'hono';

import type { Bindings } from '../types';
import { callAnthropic } from '../lib/anthropic';

const generate = new Hono<{ Bindings: Bindings }>();

/**
 * Shared voice preamble. Kept identical to the Express version so any
 * A/B comparison between old and new stack measures infrastructure, not
 * prompt drift.
 */
const VOICE_PREAMBLE = `You are Sukoon — a wise, warm AI companion writing for a sanctuary,
not an app store. Hindustani at heart, English on the surface unless the user asks otherwise.
Plain sentences. Density over length. Metaphors from kitchens, weather, roads, gardens.
Never therapy-speak. Never gurus by name. Never bullet lists of advice.
Sukoon is anonymous: do not invent names, ages, or backstories for the listener.`;

const MEDITATION_SYSTEM = `${VOICE_PREAMBLE}

Write a guided meditation script. Output STRICT JSON, one object, no markdown:
{"title":"<short evocative title>","duration_min":<integer minutes>,"language":"<bcp-47>","script":"<full narrated text with [pause N] markers for silence in seconds>"}
The script should feel speakable — short lines, gentle pacing.`;

const STORY_SYSTEM = `${VOICE_PREAMBLE}

Write a sleep story. Output STRICT JSON, one object, no markdown:
{"title":"<short title>","duration_min":<integer>,"language":"<bcp-47>","story":"<continuous prose, third-person, slow descent toward stillness>"}
No conflict. No surprise. The reader should be drifting by paragraph four.`;

const BREATH_SYSTEM = `${VOICE_PREAMBLE}

Design a breath pattern. Output STRICT JSON, one object, no markdown:
{"name":"<short pattern name>","pattern":{"inhale":<seconds>,"hold_in":<seconds>,"exhale":<seconds>,"hold_out":<seconds>},"cycles":<integer>,"cue":"<one sentence telling the user what this pattern is for>","script":"<short opening line + closing line>"}
Use safe ranges: each phase 2–8 seconds, cycles 4–20.`;

/**
 * Request body shape. All fields optional — the frontend calls this
 * with whatever it has (mood + duration is the common case; the mantra
 * screen sometimes passes a theme). Length-bounded to keep prompt
 * injection small and predictable.
 */
interface GenerateBody {
  mood?: unknown;
  duration?: unknown;
  language?: unknown;
  theme?: unknown;
  tags?: unknown;
}

type GenerateKind = 'meditation' | 'story' | 'breath';

/**
 * Tolerant JSON extractor. Claude sometimes wraps the object in
 * ```json fences or emits a stray preamble sentence. Strip fences, pick
 * the first {...} block, parse. Return null on any failure — the caller
 * falls back to `text` mode rather than 500-ing.
 */
function safeJson(text: string): Record<string, unknown> | null {
  if (typeof text !== 'string') return null;
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(match[0]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Compose the user prompt from the request body. Length caps mirror the
 * Express version — enough for real-world moods and tag lists, small
 * enough that nothing pathological can bloat the model call.
 */
function buildUserPrompt(body: GenerateBody): string {
  const parts: string[] = [];

  if (typeof body.mood === 'string' && body.mood.length > 0) {
    parts.push(`Mood: ${body.mood.slice(0, 60)}`);
  }
  if (typeof body.duration === 'number' && Number.isFinite(body.duration)) {
    parts.push(`Duration: about ${body.duration} minutes`);
  }
  if (typeof body.language === 'string' && body.language.length > 0) {
    parts.push(`Language: ${body.language.slice(0, 16)}`);
  }
  if (typeof body.theme === 'string' && body.theme.length > 0) {
    parts.push(`Theme: ${body.theme.slice(0, 120)}`);
  }
  if (Array.isArray(body.tags) && body.tags.length > 0) {
    const tags = body.tags
      .slice(0, 8)
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.slice(0, 24));
    if (tags.length > 0) parts.push(`Tags: ${tags.join(', ')}`);
  }

  return parts.length > 0
    ? parts.join('\n')
    : 'Write something for a person who just opened Sukoon.';
}

/**
 * The three endpoints only differ in system prompt, token budget, and
 * label. Everything else — body parsing, key check, upstream call,
 * JSON extraction, response shape — is identical.
 */
async function handleGenerate(
  system: string,
  maxTokens: number,
  kind: GenerateKind,
  body: GenerateBody,
  apiKey: string | undefined,
): Promise<
  | { status: 500 | 503; payload: { error: string } }
  | { status: 200; payload: Record<string, unknown> }
> {
  if (!apiKey) {
    return {
      status: 500,
      payload: { error: 'AI is not configured. Set ANTHROPIC_API_KEY.' },
    };
  }

  const userPrompt = buildUserPrompt(body);

  const result = await callAnthropic({
    apiKey,
    system,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens,
    temperature: 0.85,
  });

  if (!result.ok) {
    return {
      status: 503,
      payload: { error: 'Generation failed. Please try again in a moment.' },
    };
  }

  const parsed = safeJson(result.text);
  if (parsed) {
    return {
      status: 200,
      payload: { ...parsed, source: 'generated', kind },
    };
  }

  // Fallback: return the raw model text rather than a 500. Frontend
  // has a text-mode fallback that renders this gracefully.
  return {
    status: 200,
    payload: { text: result.text, source: 'generated-raw', kind },
  };
}

/**
 * Parse the request body defensively. Hono's `c.req.json()` throws on
 * empty/malformed bodies, so we swallow the error and use `{}`.
 */
async function readBody(c: {
  req: { json: () => Promise<unknown> };
}): Promise<GenerateBody> {
  try {
    const raw = await c.req.json();
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as GenerateBody;
    }
    return {};
  } catch {
    return {};
  }
}

generate.post('/generate-meditation', async (c) => {
  const body = await readBody(c);
  const outcome = await handleGenerate(
    MEDITATION_SYSTEM,
    2500,
    'meditation',
    body,
    c.env.ANTHROPIC_API_KEY,
  );
  return c.json(outcome.payload, outcome.status);
});

generate.post('/generate-story', async (c) => {
  const body = await readBody(c);
  const outcome = await handleGenerate(
    STORY_SYSTEM,
    2500,
    'story',
    body,
    c.env.ANTHROPIC_API_KEY,
  );
  return c.json(outcome.payload, outcome.status);
});

generate.post('/generate-breath', async (c) => {
  const body = await readBody(c);
  const outcome = await handleGenerate(
    BREATH_SYSTEM,
    1500,
    'breath',
    body,
    c.env.ANTHROPIC_API_KEY,
  );
  return c.json(outcome.payload, outcome.status);
});

export default generate;
