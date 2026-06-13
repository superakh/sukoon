/* ─── Generative fallbacks ─────────────────────────────────────────────
   When the library has no match, Claude writes fresh content under the
   same voice constraints that govern the library. Three endpoints:
     POST /api/generate-meditation
     POST /api/generate-story
     POST /api/generate-breath
   Each uses native Anthropic via routes/anthropic.js, retries once
   on 429/5xx, and returns JSON (parsed if the model complied, raw text
   in `text` otherwise). */

const express = require('express');
const router = express.Router();

const { callAnthropic } = require('./anthropic');

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

function safeJson(text) {
  if (typeof text !== 'string') return null;
  const cleaned = text.replace(/```json|```/g, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function buildUserPrompt({ mood, duration, language, theme, tags }) {
  const parts = [];
  if (mood) parts.push(`Mood: ${String(mood).slice(0, 60)}`);
  if (typeof duration === 'number') parts.push(`Duration: about ${duration} minutes`);
  if (language) parts.push(`Language: ${String(language).slice(0, 16)}`);
  if (theme) parts.push(`Theme: ${String(theme).slice(0, 120)}`);
  if (Array.isArray(tags) && tags.length) {
    parts.push(`Tags: ${tags.slice(0, 8).map(t => String(t).slice(0, 24)).join(', ')}`);
  }
  return parts.join('\n') || 'Write something for a person who just opened Sukoon.';
}

async function handleGenerate({ req, res, system, maxTokens, label }) {
  try {
    const body = req.body || {};
    const userPrompt = buildUserPrompt(body);

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'AI is not configured. Set ANTHROPIC_API_KEY.' });
    }

    const result = await callAnthropic({
      system,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens,
      temperature: 0.85
    });

    if (!result.ok) {
      return res.status(503).json({ error: 'Generation failed. Please try again in a moment.' });
    }

    const parsed = safeJson(result.text);
    if (parsed) {
      return res.json({ ...parsed, source: 'generated', kind: label });
    }
    // Fallback: return raw text under a known field rather than 500.
    res.json({ text: result.text, source: 'generated-raw', kind: label });
  } catch (err) {
    console.error(`[Generate:${label}] uncaught:`, err.message);
    res.status(500).json({ error: 'Generation failed.' });
  }
}

router.post('/meditation', (req, res) => handleGenerate({
  req, res, system: MEDITATION_SYSTEM, maxTokens: 2500, label: 'meditation'
}));

router.post('/story', (req, res) => handleGenerate({
  req, res, system: STORY_SYSTEM, maxTokens: 2500, label: 'story'
}));

router.post('/breath', (req, res) => handleGenerate({
  req, res, system: BREATH_SYSTEM, maxTokens: 1500, label: 'breath'
}));

module.exports = router;
