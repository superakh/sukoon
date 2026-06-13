/* ─── GET /api/daily — today's mantra + festival ──────────────────────
   Deterministic per UTC day. No randomness; the same date always
   resolves to the same library item. */

const express = require('express');
const router = express.Router();

const { getDaily } = require('./library');

router.get('/', (req, res) => {
  try {
    const payload = getDaily();
    // Cache for an hour at the edge — clients will see the same daily
    // anyway because the resolver is date-keyed.
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(payload);
  } catch (err) {
    console.error('[Daily] uncaught:', err.message);
    res.status(500).json({ error: 'Could not resolve daily.' });
  }
});

module.exports = router;
