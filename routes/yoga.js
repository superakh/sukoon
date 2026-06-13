/* ─── GET /api/yoga — asana library + sequences ──────────────────────
   Reads from the in-memory library populated at boot by routes/library.js
   (which slurps yoga-asanas-*.json into store.yogaAsanas and an optional
   yoga-sequences.json into store.yogaSequences).

   Two endpoints live in this router:
     GET /          → all asanas, optionally filtered by category,
                      difficulty, or lineage via query string.
     GET /sequences → yoga sequences (placeholder; file may be missing). */

const express = require('express');
const router = express.Router();

const library = require('./library');

// Case-insensitive string equality. Used for category + lineage match.
function eqi(a, b) {
  return typeof a === 'string'
      && typeof b === 'string'
      && a.toLowerCase() === b.toLowerCase();
}

router.get('/', (req, res) => {
  try {
    const items = library.getRaw('yogaAsanas');

    const { category, difficulty, lineage } = req.query;
    const diffNum = difficulty != null && difficulty !== '' ? Number(difficulty) : null;

    const filtered = items.filter(a => {
      if (!a) return false;
      if (category && !eqi(a.category, String(category))) return false;
      if (lineage && !eqi(a.lineage, String(lineage))) return false;
      if (diffNum != null && !Number.isNaN(diffNum) && Number(a.difficulty) !== diffNum) return false;
      return true;
    });

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ items: filtered, count: filtered.length });
  } catch (err) {
    // Constitution: never log user input. Only log internal error class.
    console.error('[Yoga] uncaught:', err.message);
    res.status(500).json({ error: 'Yoga lookup failed.' });
  }
});

router.get('/sequences', (req, res) => {
  try {
    const items = library.getRaw('yogaSequences');
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      items,
      count: items.length,
      note: items.length === 0
        ? 'yoga-sequences.json not present yet — placeholder endpoint.'
        : undefined
    });
  } catch (err) {
    console.error('[Yoga] sequences uncaught:', err.message);
    res.status(500).json({ error: 'Yoga sequences lookup failed.' });
  }
});

module.exports = router;
