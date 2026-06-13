/* ─── POST /api/library — filter the in-memory library ────────────────
   Body: { kind, tags?, mood?, duration?, lang?, ids?, limit? }
   - If `ids` is provided, returns items by id in the order given
     (lookup is constitutional: stable, no model needed).
   - Otherwise filters by kind + optional facets. */

const express = require('express');
const router = express.Router();

const { filterLibrary, getById, resolveKind, snapshot } = require('./library');

router.post('/', (req, res) => {
  try {
    const body = req.body || {};

    // Mode A: lookup by ids
    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const items = body.ids
        .slice(0, 50)
        .map(id => getById(id))
        .filter(Boolean);
      return res.json({ items, mode: 'by-id' });
    }

    // Mode B: facet filter
    if (!resolveKind(body.kind)) {
      return res.status(400).json({
        error: 'kind is required (meditations, sleep-stories, breath-patterns, soundscapes, mantras, festivals, crisis-tools)'
      });
    }

    const limit = Math.max(1, Math.min(50, Number(body.limit) || 20));
    const items = filterLibrary({
      kind: body.kind,
      tags: body.tags,
      mood: body.mood,
      duration: typeof body.duration === 'number' ? body.duration : undefined,
      lang: body.lang,
      limit
    });

    res.json({ items, mode: 'filter', count: items.length, libraryStats: snapshot() });
  } catch (err) {
    console.error('[Library] uncaught:', err.message);
    res.status(500).json({ error: 'Library lookup failed.' });
  }
});

module.exports = router;
