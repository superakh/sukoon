-- =============================================================================
-- Sukoon Content Library — D1 Schema (initial migration)
-- =============================================================================
-- Target: Cloudflare D1 (SQLite dialect)
-- Purpose: House the full ~648-item Sukoon library (meditations, sleep stories,
--          breath patterns, soundscapes, daily mantras, festivals, crisis
--          tools, yoga asanas & sequences, courses, and video scripts) sourced
--          from /public/content/*.json.
--
-- Schema conventions
--   * Every table has a TEXT primary key `id` (matches the string ids used in
--     the source JSON, e.g. "med-anxiety-morning-en", "tadasana").
--   * All bilingual text is stored side-by-side in `*_en` / `*_hi` columns.
--   * List / structured payloads are kept as TEXT holding JSON. D1 has no
--     native JSON type; use `json_extract`, `json_each`, etc. at query time.
--   * `created_at` / `updated_at` use ISO-8601 strings via CURRENT_TIMESTAMP.
--
-- How to run:
--   wrangler d1 execute sukoon-content --file=schema/001_init.sql
--   # or against a local dev DB:
--   wrangler d1 execute sukoon-content --local --file=schema/001_init.sql
--
-- Follow-up seed migration:
--   wrangler d1 execute sukoon-content --file=schema/002_seed_meta.sql
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- meditations
--   Source files: meditations-*.json (anxiety-en, anxiety-hi, focus-work,
--   grief-anger, grounding, morning-evening, self-compassion, sleep). ~102 rows.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meditations (
    id          TEXT PRIMARY KEY,
    title_en    TEXT,
    title_hi    TEXT,
    duration    INTEGER,                     -- minutes
    mood_tags   TEXT,                        -- JSON array<string>
    script_en   TEXT,                        -- long-form guided script
    script_hi   TEXT,
    tags        TEXT,                        -- JSON array<string> (theme, chapters, etc.)
    languages   TEXT,                        -- JSON array<string> e.g. ["en","hi"]
    audio_url   TEXT,
    cover_url   TEXT,
    source      TEXT NOT NULL DEFAULT 'curated',
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- sleep_stories
--   Same shape as meditations + a `setting` column (e.g. "night train to the
--   mountains", "Iceland hot spring"). Source: stories-*.json. ~50 rows.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sleep_stories (
    id          TEXT PRIMARY KEY,
    title_en    TEXT,
    title_hi    TEXT,
    duration    INTEGER,                     -- minutes
    mood_tags   TEXT,                        -- JSON array<string>
    script_en   TEXT,                        -- full narrative body
    script_hi   TEXT,
    tags        TEXT,                        -- JSON array<string>
    languages   TEXT,                        -- JSON array<string>
    audio_url   TEXT,
    cover_url   TEXT,
    setting     TEXT,                        -- narrative locale/setting
    source      TEXT NOT NULL DEFAULT 'curated',
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- breath_patterns
--   Source: breath.json (25 patterns).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS breath_patterns (
    id           TEXT PRIMARY KEY,
    title_en     TEXT,
    title_hi     TEXT,
    pattern      TEXT,                       -- e.g. "4-7-8", "box", "bhramari"
    phases       TEXT,                       -- JSON: [{name,seconds}, ...] or ratio breakdown
    purpose_en   TEXT,
    purpose_hi   TEXT,
    duration_min INTEGER,
    tags         TEXT,                       -- JSON array<string>
    created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- soundscapes
--   Source: soundscapes.json (15 loops — rain, temple bells, etc.).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS soundscapes (
    id           TEXT PRIMARY KEY,
    title_en     TEXT,
    title_hi     TEXT,
    category     TEXT,                       -- nature | temple | urban | drone | ...
    audio_url    TEXT,
    duration_min INTEGER,
    created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- daily_mantras
--   Source: daily-q1..q4.json (~365 daily entries — mantra + reflection).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_mantras (
    id              TEXT PRIMARY KEY,        -- e.g. "day-001"
    sanskrit        TEXT,                    -- transliterated sanskrit (nullable)
    devanagari      TEXT,                    -- devanagari script (nullable)
    translation_en  TEXT,                    -- English rendering / mantra_en
    translation_hi  TEXT,                    -- Hindi rendering / mantra_hi
    source          TEXT,                    -- attribution (poet, scripture, author)
    insight_en      TEXT,                    -- reflection_en
    insight_hi      TEXT,                    -- reflection_hi
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- festivals
--   Source: festivals.json (Diwali, Holi, Navratri, ...). ~7 rows.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS festivals (
    id              TEXT PRIMARY KEY,        -- festival_id
    name_en         TEXT,
    name_hi         TEXT,
    month           INTEGER,                 -- 1..12
    day             INTEGER,                 -- 1..31
    date            TEXT,                    -- "YYYY-MM-DD" for the tracked year
    description_en  TEXT,                    -- practice script / prose
    description_hi  TEXT,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- crisis_tools
--   Source: crisis.json (12 rapid grounding / SOS tools).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crisis_tools (
    id              TEXT PRIMARY KEY,
    kind            TEXT,                    -- grounding | breath | somatic | reach-out
    title_en        TEXT,
    title_hi        TEXT,
    instruction_en  TEXT,                    -- may hold serialized JSON list or prose
    instruction_hi  TEXT,
    duration_min    INTEGER,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- yoga_asanas
--   Source: yoga-asanas-1..4.json (~60 poses).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS yoga_asanas (
    id                TEXT PRIMARY KEY,      -- e.g. "tadasana"
    sanskrit_name     TEXT,                  -- "Tadasana"
    devanagari        TEXT,                  -- "ताडासन"
    name_en           TEXT,                  -- "Mountain Pose"
    name_hi           TEXT,
    category          TEXT,                  -- standing | seated | supine | prone | inversion | balance | twist
    difficulty        INTEGER,               -- 1..5
    lineage           TEXT,                  -- Hatha | Iyengar | Ashtanga | Vinyasa ...
    alignment_steps   TEXT,                  -- JSON: {en:[...], hi:[...]}
    benefits          TEXT,                  -- JSON: {en:[...], hi:[...]}
    safety            TEXT,                  -- JSON: {en:[...], hi:[...]}
    modifications     TEXT,                  -- JSON: {en:[...], hi:[...], props:[...]}
    counter_pose      TEXT,                  -- counter_pose_id (FK-ish, string)
    cover_url         TEXT,
    created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- yoga_sequences
--   Curated flows composed of ordered asana ids. Seeded from course sessions +
--   editorial sequences.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS yoga_sequences (
    id            TEXT PRIMARY KEY,
    title_en      TEXT,
    title_hi      TEXT,
    duration_min  INTEGER,
    difficulty    INTEGER,                   -- 1..5
    asanas        TEXT,                      -- JSON: ordered list of asana ids ["tadasana","adho-mukha-svanasana",...]
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- courses
--   Source: courses-foundational.json, courses-specialized.json,
--   courses-therapeutic.json (~12 multi-day journeys).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id             TEXT PRIMARY KEY,         -- e.g. "7-days-of-sukoon"
    title_en       TEXT,
    title_hi       TEXT,
    duration_days  INTEGER,                  -- days
    level          TEXT,                     -- beginner | intermediate | advanced | therapeutic
    focus_tags     TEXT,                     -- JSON array<string>
    sessions       TEXT,                     -- JSON: session template (intro/close/estimated_daily_minutes)
    days_content   TEXT,                     -- JSON: day-by-day program (title, script, asanas, breath)
    cover_url      TEXT,
    created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- video_scripts
--   Source: video-scripts-{breath,meditation,talks,yoga}.json + youtube-scripts.json.
--   ~37 rows (production scripts, shot lists, YouTube full-length).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS video_scripts (
    id            TEXT PRIMARY KEY,
    category      TEXT,                      -- breath | meditation | talks | yoga | youtube
    title         TEXT,                      -- title_en (canonical)
    script        TEXT,                      -- full script_text_en (long-form)
    duration_min  INTEGER,
    notes         TEXT,                      -- JSON: production notes (location, camera, b_roll, edit_notes, hi script, tags, etc.)
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Indexes
-- =============================================================================
-- Note: mood_tags is stored as JSON; the index accelerates equality/prefix
-- lookups on the raw JSON string (e.g. LIKE '%"anxiety"%' filters). For richer
-- querying, use json_each() in a subquery — no expression index is required.
CREATE INDEX IF NOT EXISTS idx_meditations_mood   ON meditations(mood_tags);
CREATE INDEX IF NOT EXISTS idx_stories_setting    ON sleep_stories(setting);
CREATE INDEX IF NOT EXISTS idx_yoga_category      ON yoga_asanas(category);
CREATE INDEX IF NOT EXISTS idx_courses_level      ON courses(level);

-- Helpful secondary indexes (cheap, high-value for the app's filter surface):
CREATE INDEX IF NOT EXISTS idx_meditations_duration ON meditations(duration);
CREATE INDEX IF NOT EXISTS idx_stories_duration     ON sleep_stories(duration);
CREATE INDEX IF NOT EXISTS idx_breath_pattern       ON breath_patterns(pattern);
CREATE INDEX IF NOT EXISTS idx_soundscapes_category ON soundscapes(category);
CREATE INDEX IF NOT EXISTS idx_festivals_month_day  ON festivals(month, day);
CREATE INDEX IF NOT EXISTS idx_crisis_kind          ON crisis_tools(kind);
CREATE INDEX IF NOT EXISTS idx_yoga_difficulty      ON yoga_asanas(difficulty);
CREATE INDEX IF NOT EXISTS idx_video_category       ON video_scripts(category);

-- =============================================================================
-- End 001_init.sql
-- =============================================================================
