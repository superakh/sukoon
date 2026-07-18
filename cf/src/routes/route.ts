/**
 * POST /api/route — classify a user's free-text into one of Sukoon's
 * eight routes and return the top three matching library items.
 *
 * Two-stage design:
 *   1. Local crisis scan (deterministic substring match, Roman-Hindi
 *      aware). If anything fires, the response is forced to route
 *      "now" with helplines and a `tier` — Claude is never asked.
 *      This is the safety override.
 *   2. Otherwise, a cheap Claude call at temperature 0.2 that returns
 *      strict JSON: {route, mood, tags, reason}. We ceiling the
 *      trust — route must be one of the known ROUTES, tags capped at
 *      8, reason capped at 240 chars.
 *
 * The response is always JSON-safe even if Claude misbehaves, because
 * the fallback route is "arrive" (Sukoon's benign landing screen).
 */
import { Hono } from 'hono';

import type { Bindings } from '../types';
import { callAnthropic } from '../lib/anthropic';
import { filterLibrary } from '../lib/library';
import { scan as scanCrisis, helplinesFor } from '../lib/crisis';

const routeApp = new Hono<{ Bindings: Bindings }>();

const ROUTES = [
  'arrive',
  'be-with-me',
  'breathe',
  'sit',
  'rest',
  'sounds',
  'today',
  'now',
] as const;

type RouteName = (typeof ROUTES)[number];

/**
 * Heuristic seed: for each route, which library kind we prefer to
 * surface as "top 3 matches". The classifier only tells us where the
 * user should go — this map tells us what to hand them once they're
 * there.
 */
const KIND_FOR_ROUTE: Record<RouteName, string> = {
  arrive: 'meditations',
  'be-with-me': 'meditations',
  breathe: 'breath-patterns',
  sit: 'meditations',
  rest: 'sleep-stories',
  sounds: 'soundscapes',
  today: 'mantras',
  now: 'crisis-tools',
};

/**
 * Classifier system prompt. Word-for-word identical to the Express
 * version — the router's behaviour is a product decision, not an
 * infrastructure one, so it stays stable across stacks.
 */
const CLASSIFIER_SYSTEM = `You are Sukoon's router. Given a user's short free-text input
describing how they feel or what they need, classify it into exactly ONE of these routes:
- arrive: greeting, unsure, just landing
- be-with-me: wants to talk, vent, friend mode
- breathe: panic, anxiety, anger, racing thoughts
- sit: focus, meditation, restless mind, stillness
- rest: tired, can't sleep, bedtime
- sounds: ambient, soundscape, background
- today: daily mantra, festival, weekly broadcast
- now: crisis, suicidal, self-harm, immediate danger

You MUST respond with ONLY a single JSON object on one line, no markdown,
no preamble, no code fences. Schema:
{"route":"<one of the routes>","mood":"<single-word emotional label>","tags":["lowercase","keywords"],"reason":"<one short sentence>"}

If the input contains any indication of suicide, self-harm, overdose, or
imminent danger, set route to "now".`;

interface RouteBody {
  input?: unknown;
  language?: unknown;
  mood?: unknown;
}

interface ClassifierPayload {
  route?: unknown;
  mood?: unknown;
  tags?: unknown;
  reason?: unknown;
}

/**
 * Tolerant JSON extractor. Strips code fences and picks the first
 * {...} block. Returns null on any failure — the caller falls back to
 * the "arrive" route rather than 500-ing.
 */
function safeParseJson(text: string): ClassifierPayload | null {
  if (typeof text !== 'string') return null;
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(match[0]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as ClassifierPayload;
    }
    return null;
  } catch {
    return null;
  }
}

function isRouteName(value: unknown): value is RouteName {
  return (
    typeof value === 'string' && (ROUTES as readonly string[]).includes(value)
  );
}

routeApp.post('/route', async (c) => {
  let body: RouteBody;
  try {
    const raw: unknown = await c.req.json();
    body =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as RouteBody)
        : {};
  } catch {
    body = {};
  }

  const { input, language, mood: hintMood } = body;

  if (typeof input !== 'string' || input.trim().length === 0) {
    return c.json({ error: 'input is required' }, 400);
  }

  const safeInput = input.slice(0, 1000);
  const lang = typeof language === 'string' ? language : undefined;

  // --- Stage 1: safety override -------------------------------------
  // Deterministic substring scan. If ANY crisis phrase fires, we route
  // to "now" without calling Claude — this is the guarantee we make to
  // ourselves that no upstream flake can mask an active-ideation
  // message behind a benign classification.
  const crisis = scanCrisis(safeInput);
  if (crisis.hit) {
    const crisisMatches = await filterLibrary({
      db: c.env.SUKOON_DB,
      kind: 'crisis-tools',
      limit: 3,
    });
    const matches = crisisMatches
      .map((it) => it.id)
      .filter((id): id is string => typeof id === 'string');

    return c.json({
      route: 'now' satisfies RouteName,
      mood: 'crisis',
      tags: ['crisis', 'safety'],
      reason: 'Safety override — trigger words detected.',
      matches,
      source: 'safety-override',
      tier: crisis.tier,
      helplines: helplinesFor(lang),
    });
  }

  // --- Stage 2: Claude classifier -----------------------------------
  // Cheap call, 300 tokens is plenty for a one-line JSON blob. If the
  // key is missing or the upstream flakes, we fall through to a
  // benign "arrive" default so the frontend still gets a valid shape.
  let parsed: ClassifierPayload | null = null;
  let source: 'classifier' | 'fallback' = 'fallback';

  if (c.env.ANTHROPIC_API_KEY) {
    const result = await callAnthropic({
      apiKey: c.env.ANTHROPIC_API_KEY,
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: 'user', content: safeInput }],
      maxTokens: 300,
      temperature: 0.2,
    });

    if (result.ok) {
      parsed = safeParseJson(result.text);
      source = 'classifier';
    }
  }

  const route: RouteName = isRouteName(parsed?.route) ? parsed.route : 'arrive';

  const mood: string | null =
    typeof parsed?.mood === 'string' && parsed.mood.length > 0
      ? parsed.mood
      : typeof hintMood === 'string' && hintMood.length > 0
        ? hintMood
        : null;

  const tags: string[] = Array.isArray(parsed?.tags)
    ? parsed.tags
        .slice(0, 8)
        .filter((t): t is string => typeof t === 'string')
    : [];

  const reason: string | null =
    typeof parsed?.reason === 'string' ? parsed.reason.slice(0, 240) : null;

  // Top 3 library matches for the chosen route. Uses the same filter
  // the /api/library endpoint uses, so ranking stays consistent
  // between "browse" and "route me somewhere" flows.
  const kind = KIND_FOR_ROUTE[route];
  const candidates = await filterLibrary({
    db: c.env.SUKOON_DB,
    kind,
    tags: tags.length > 0 ? tags : undefined,
    mood: mood ?? undefined,
    lang,
    limit: 3,
  });
  const matches = candidates
    .map((it) => it.id)
    .filter((id): id is string => typeof id === 'string');

  return c.json({
    route,
    mood,
    tags,
    reason,
    matches,
    source,
  });
});

export default routeApp;
