# cf/scripts

Operational scripts for the Sukoon Cloudflare Worker. All scripts are
plain Node ESM (`.mjs`) and assume Node 20+.

## `json-to-d1.mjs` — seed content into D1

Reads every `*.json` under `public/content/` and produces one big
`INSERT OR REPLACE` batch against three D1 tables:

| Table            | Source files (regex)                                       | ~Row count |
|------------------|------------------------------------------------------------|-----------:|
| `library_items`  | `meditations-*.json`, `stories-*.json`, `breath.json`, `soundscapes.json`, `crisis.json`, `yoga-asanas-*.json`, `yoga-sequences.json`, `courses-*.json`, `video-scripts-*.json` | 301 |
| `daily_mantras`  | `daily-q[1-4].json`                                        | 365 |
| `festivals`      | `festivals.json`                                           |   7 |

The filename → destination mapping is the same regex set the Express
in-memory loader (`routes/library.js`) uses, plus one new pattern for
`video-scripts-*.json`.

### One-time setup

```bash
# 1. Create the D1 database (paste the returned id into cf/wrangler.toml).
wrangler d1 create sukoon-content

# 2. Apply the schema.
wrangler d1 execute sukoon-content --file=schema/001_init.sql --remote

# 3. Seed the content library.
npm run seed              # writes schema/003_data.sql
npm run seed -- --exec    # ALSO ships it to D1 in 100-statement batches
```

`npm run seed` is idempotent — it uses `INSERT OR REPLACE`, so re-running
after editing a JSON file safely upserts the changed rows.

### What the seed logs

The script prints a per-table rollup — total rows, count per `kind`,
any items skipped for missing required fields (`id`, `title`/`text`/`name`),
and any duplicate ids (last-write-wins). Expected output on a fresh run:

```
library_items: 301
  - meditation:   102
  - sleep_story:   50
  - breathwork:    25
  - sound_bath:    15
  - crisis_tool:   12
  - yoga_asana:    60
  - course:        12
  - video_script:  25
daily_mantras: 365
  - mantra:       365
festivals:       7
total statements: 673
```

`/api/health` will report **~648** items — that's the `library.ts`
`snapshot()` sum, which excludes `video_script` since those aren't yet
part of the library kind rollup.

### Unicode

Devanagari, Chinese, emoji — all pass through the SQL layer unmodified.
The script writes UTF-8, `wrangler d1 execute` forwards raw bytes, and
SQLite stores TEXT as UTF-8 natively. If you see `स्...`
escapes anywhere in `003_data.sql`, something is double-encoding — that
is a bug, not a feature. Report it.

### `--exec` mode

`--exec` shells out to `wrangler d1 execute --file=<batch>.sql --remote`
in 100-statement batches. D1's control-plane rejects requests larger
than a few megabytes; batching keeps every request small and lets a
failed batch bail out without leaving the database half-populated (each
batch is wrapped in its own `BEGIN … COMMIT`).

If a batch fails, the script prints the batch number, exit code, and
the path of the temp file it left behind so you can inspect and re-run
that single batch manually:

```bash
npx wrangler d1 execute sukoon-content --file=/tmp/sukoon-seed-XXXX/batch-042.sql --remote
```

Override the database name via `SUKOON_D1_NAME=<name>` if you're seeding
a preview environment.
