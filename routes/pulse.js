/* ─── GET /api/pulse — anonymous "souls present now" counter ──────────
   Deterministic walk seeded at process boot — no Math.random, no
   identity, no persistence. See routes/library.js getPulse(). */

const express = require('express');
const router = express.Router();

const { getPulse } = require('./library');

router.get('/', (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(getPulse());
  } catch (err) {
    console.error('[Pulse] uncaught:', err.message);
    res.status(500).json({ error: 'Pulse unavailable.' });
  }
});

module.exports = router;
