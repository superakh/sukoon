/* ─── GET /api/courses ───────────────────────────────────────────────
   Reads from the in-memory library populated at boot. Courses arrive
   from courses-foundational.json + courses-specialized.json (and any
   future courses-*.json file), all merged into store.courses.

   Endpoints:
     GET /     → all courses, optional ?level= and ?focus_tag= filters.
                 Returns a slim summary (no per-day session bodies) so
                 list pages don't ship the full curriculum payload.
     GET /:id  → full course detail by slug (the course's `id` field). */

const express = require('express');
const router = express.Router();

const library = require('./library');

function eqi(a, b) {
  return typeof a === 'string'
      && typeof b === 'string'
      && a.toLowerCase() === b.toLowerCase();
}

// Strip the heavy `sessions`/`days_content` payload for list views so a
// /api/courses response stays small. Detail view keeps everything.
function summarize(course) {
  if (!course || typeof course !== 'object') return course;
  const { sessions, days_content, ...rest } = course;
  return rest;
}

router.get('/', (req, res) => {
  try {
    const items = library.getRaw('courses');
    const { level, focus_tag } = req.query;

    const filtered = items.filter(c => {
      if (!c) return false;
      if (level && !eqi(c.level, String(level))) return false;
      if (focus_tag && !eqi(c.focus_tag, String(focus_tag))) return false;
      return true;
    }).map(summarize);

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ items: filtered, count: filtered.length });
  } catch (err) {
    console.error('[Courses] uncaught:', err.message);
    res.status(500).json({ error: 'Courses lookup failed.' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const id = String(req.params.id || '').slice(0, 128);
    // Bound the id length to avoid pathological lookups; never log it.
    const items = library.getRaw('courses');
    const course = items.find(c => c && typeof c.id === 'string' && c.id === id);
    if (!course) return res.status(404).json({ error: 'Course not found.' });

    res.set('Cache-Control', 'public, max-age=3600');
    res.json(course);
  } catch (err) {
    console.error('[Courses] detail uncaught:', err.message);
    res.status(500).json({ error: 'Course detail lookup failed.' });
  }
});

module.exports = router;
