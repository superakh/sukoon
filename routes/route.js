/* ─── POST /api/route ──────────────────────────────────────────────────
   Classify a user's free-text input into one of Sukoon's eight routes
   and return the top three library matches by id. Crisis is detected
   client-side AND here on the server: if any trigger fires, the route
   is forced to "now" regardless of what Claude said. */

const express = require('express');
const router = express.Router();

const { callAnthropic } = require('./anthropic');
const { filterLibrary, getById, snapshot } = require('./library');
const { scan: scanCrisis, helplinesFor } = require('./crisis');

const ROUTES = ['arrive', 'be-with-me', 'breathe', 'sit', 'rest', 'sounds', 'today', 'now'];

// Heuristic seed: kind preferred for each route, used when surfacing
// top-3 library matches before/after the model speaks.
const KIND_FOR_ROUTE = {
  'arrive': 'meditations',
  'be-with-me': 'meditations',
  'breathe': 'breath-patterns',
  'sit': 'meditations',
  'rest': 'sleep-stories',
  'sounds': 'soundscapes',
  'today': 'mantras',
  'now': 'crisis-tools'
};

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

function safeParseJson(text) {
  if (typeof text !== 'string') return null;
  // Tolerant: strip code fences if the model added them.
  const cleaned = text.replace(/```json|```/g, '').trim();
  // Find first JSON object in case of preamble.
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

router.post('/', async (req, res) => {
  try {
    const { input, language, mood: hintMood } = req.body || {};
    if (typeof input !== 'string' || input.trim().length === 0) {
      return res.status(400).json({ error: 'input is required' });
    }

    const safeInput = input.slice(0, 1000);

    // 1) Hard safety: client-detectable triggers always win.
    const crisis = scanCrisis(safeInput);
    if (crisis.hit) {
      const matches = filterLibrary({ kind: 'crisis-tools', limit: 3 })
        .map(it => it.id).filter(Boolean);
      return res.json({
        route: 'now',
        mood: 'crisis',
        tags: ['crisis', 'safety'],
        tier: crisis.tier,
        reason: 'Safety override — trigger words detected.',
        matches,
        helplines: helplinesFor(language),
        source: 'safety-override'
      });
    }

    // 2) Ask Claude to classify. Cheap call, 300 tokens is plenty.
    const result = await callAnthropic({
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: 'user', content: safeInput }],
      maxTokens: 300,
      temperature: 0.2
    });

    let parsed = null;
    if (result.ok) parsed = safeParseJson(result.text);

    let route = parsed && ROUTES.includes(parsed.route) ? parsed.route : 'arrive';
    const mood = (parsed && typeof parsed.mood === 'string' && parsed.mood) || hintMood || null;
    const tags = parsed && Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [];
    const reason = parsed && typeof parsed.reason === 'string' ? parsed.reason.slice(0, 240) : null;

    // 3) Top 3 library matches for this route.
    const kind = KIND_FOR_ROUTE[route] || 'meditations';
    const candidates = filterLibrary({ kind, tags, mood, lang: language, limit: 3 });
    const matches = candidates.map(it => it.id).filter(Boolean);

    res.json({
      route,
      mood,
      tags,
      reason,
      matches,
      source: result.ok ? 'classifier' : 'fallback',
      libraryStats: snapshot()
    });
  } catch (err) {
    console.error('[Route] uncaught:', err.message);
    res.status(500).json({ error: 'Could not route this input.' });
  }
});

module.exports = router;
