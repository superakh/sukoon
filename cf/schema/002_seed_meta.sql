-- =============================================================================
-- Sukoon Content Library — Meta seed
-- =============================================================================
-- Purpose: create a `meta` key/value table that records the schema version and
--          a boot marker so the app can verify D1 is initialized end-to-end.
--
-- How to run:
--   wrangler d1 execute sukoon-content --file=schema/002_seed_meta.sql
--   # or against a local dev DB:
--   wrangler d1 execute sukoon-content --local --file=schema/002_seed_meta.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS meta (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Single seed row: schema version + boot marker (JSON payload).
INSERT INTO meta (key, value) VALUES (
    'schema_version',
    json_object(
        'version',       '001',
        'migration',     '001_init.sql',
        'library_size',  648,
        'boot_marker',   'sukoon-content-online',
        'booted_at',     CURRENT_TIMESTAMP
    )
)
ON CONFLICT(key) DO UPDATE SET
    value      = excluded.value,
    updated_at = CURRENT_TIMESTAMP;

-- =============================================================================
-- End 002_seed_meta.sql
-- =============================================================================
