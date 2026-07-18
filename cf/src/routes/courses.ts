/**
 * GET /api/courses — foundational + specialized course catalog.
 *
 * The Express version (routes/courses.js) walked an in-memory list.
 * Here we lean on D1: the full curriculum payload lives as JSON in
 * a `payload` column, and the list endpoint strips the heavy
 * `sessions` / `days_content` blobs before returning so list pages
 * don't ship the whole syllabus.
 *
 * Endpoints:
 *   GET /       → summary list, optional ?level=&focus_tag= (case-insensitive)
 *   GET /:id    → full course JSON, id capped at 128 chars, 404 if missing.
 */

import { Hono } from 'hono';

import type { Bindings } from '../types';

const courses = new Hono<{ Bindings: Bindings }>();

const CACHE_HEADER = 'public, max-age=3600';

interface CourseRow {
  id: string;
  payload: string | null;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Strip the heavy per-day fields so a list response stays small. */
function summarize(course: Record<string, unknown>): Record<string, unknown> {
  const {
    // These two are the heavy blobs; everything else flows through.
    sessions: _sessions,
    days_content: _days,
    ...rest
  } = course;
  void _sessions;
  void _days;
  return rest;
}

courses.get('/', async (c) => {
  try {
    const { level, focus_tag } = c.req.query();

    // Filtering happens in the app tier because the fields live inside
    // the JSON payload, not their own columns. The catalog is small
    // (dozens of courses), so this stays cheap.
    const { results } = await c.env.SUKOON_DB.prepare(
      'SELECT id, payload FROM courses ORDER BY id',
    ).all<CourseRow>();

    const wantLevel = typeof level === 'string' ? level.toLowerCase() : null;
    const wantFocus = typeof focus_tag === 'string' ? focus_tag.toLowerCase() : null;

    const items: Record<string, unknown>[] = [];
    for (const row of results ?? []) {
      const parsed = safeParse<Record<string, unknown>>(row.payload);
      if (!parsed) continue;
      const course = { ...parsed, id: row.id };

      if (wantLevel) {
        const lv = course.level;
        if (typeof lv !== 'string' || lv.toLowerCase() !== wantLevel) continue;
      }
      if (wantFocus) {
        const ft = course.focus_tag;
        if (typeof ft !== 'string' || ft.toLowerCase() !== wantFocus) continue;
      }

      items.push(summarize(course));
    }

    c.header('Cache-Control', CACHE_HEADER);
    return c.json({ items, count: items.length });
  } catch (err) {
    console.error('[Courses] uncaught:', err instanceof Error ? err.message : err);
    return c.json({ error: 'Courses lookup failed.' }, 500);
  }
});

courses.get('/:id', async (c) => {
  try {
    // Cap the id length so a pathological caller can't force D1 to
    // scan a giant string. Never log the raw value (constitution).
    const id = String(c.req.param('id') ?? '').slice(0, 128);

    const row = await c.env.SUKOON_DB.prepare(
      'SELECT id, payload FROM courses WHERE id = ? LIMIT 1',
    )
      .bind(id)
      .first<CourseRow>();

    if (!row) {
      return c.json({ error: 'Course not found.' }, 404);
    }

    const parsed = safeParse<Record<string, unknown>>(row.payload);
    if (!parsed) {
      return c.json({ error: 'Course not found.' }, 404);
    }

    c.header('Cache-Control', CACHE_HEADER);
    return c.json({ ...parsed, id: row.id });
  } catch (err) {
    console.error('[Courses] detail uncaught:', err instanceof Error ? err.message : err);
    return c.json({ error: 'Course detail lookup failed.' }, 500);
  }
});

export default courses;
