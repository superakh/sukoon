#!/usr/bin/env node
/**
 * Sukoon — generate the R2 upload batch script for /public assets.
 *
 * Walks the three asset trees under /public/ and emits a shell script
 * (cf/scripts/upload-assets.sh) full of `wrangler r2 object put`
 * commands, one per file, that push everything into the `sukoon-assets`
 * bucket with the correct Content-Type and a year-long immutable cache.
 *
 * The R2 object key mirrors the /public path exactly so the Worker can
 * serve them at /assets/<same-path> without any translation table:
 *
 *   /public/video/hero-home.mp4                 -> r2://sukoon-assets/video/hero-home.mp4
 *   /public/audio/ambient-home.mp3              -> r2://sukoon-assets/audio/ambient-home.mp3
 *   /public/og/home.jpg                         -> r2://sukoon-assets/og/home.jpg
 *   /public/og/asanas/adho-mukha-svanasana.jpg  -> r2://sukoon-assets/og/asanas/adho-mukha-svanasana.jpg
 *
 * Subfolders (og/meditations, og/stories, og/moods, og/breath,
 * og/courses, og/posters, og/asanas, video/originals-no-music) are
 * discovered by recursion — no hard-coded list to drift.
 *
 * Rules:
 *   video/*  -> Content-Type: video/mp4
 *   audio/*  -> Content-Type: audio/mpeg
 *   og/*     -> Content-Type: image/jpeg   (all og assets are .jpg today)
 *   Cache-Control on all three: public,max-age=31536000,immutable
 *
 * Files with an unexpected extension are skipped with a warning so a
 * stray .DS_Store or README doesn't turn into a broken R2 object.
 *
 * Usage:
 *   node cf/scripts/upload-to-r2.mjs
 *   bash  cf/scripts/upload-assets.sh
 *
 * The generated script assumes:
 *   wrangler r2 bucket create sukoon-assets
 * has already run and that `wrangler` is authenticated for this account.
 *
 * Requires: Node 20+ (ESM, fs.promises, top-level await).
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// cf/scripts/ -> cf/ -> sukoon/
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC_DIR = path.join(REPO_ROOT, 'public');
const OUT_PATH = path.join(__dirname, 'upload-assets.sh');
const BUCKET = 'sukoon-assets';
const CACHE_CONTROL = 'public,max-age=31536000,immutable';

// Top-level asset trees we care about, and the Content-Type + allowed
// extension for each. Anything outside these three trees is ignored.
const TREES = [
  { dir: 'video', contentType: 'video/mp4', ext: '.mp4' },
  { dir: 'audio', contentType: 'audio/mpeg', ext: '.mp3' },
  { dir: 'og', contentType: 'image/jpeg', ext: '.jpg' },
];

// Directory names we never descend into. Belt-and-suspenders: /public
// should not contain node_modules or .git, but if a tarball ever lands
// there we don't want to enqueue a 400MB upload by accident.
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.DS_Store',
  '.cache',
  '.next',
  '.turbo',
  'dist',
  'build',
]);

/**
 * Recursively yield every file path under `root`, POSIX-slash relative
 * to `root`, skipping SKIP_DIRS and dotfiles. Deterministic order so
 * repeated runs produce identical diffs of upload-assets.sh.
 *
 * Symlinks are followed via `fs.statSync` so placeholder symlinks (e.g.
 * every asana that currently points at `_placeholder.jpg`) still get an
 * R2 object at their own key — wrangler dereferences the link when it
 * reads --file, so each key ends up with the target's bytes.
 */
function* walk(root, rel = '') {
  const abs = path.join(root, rel);
  let entries;
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
    const entryAbs = path.join(abs, entry.name);

    // Resolve symlinks so directories-of-symlinks and file-symlinks
    // (placeholder asanas today) both get walked correctly.
    let stat;
    if (entry.isSymbolicLink()) {
      try {
        stat = fs.statSync(entryAbs);
      } catch {
        // Dangling symlink — nothing to upload, skip silently.
        continue;
      }
    }
    const isDir = entry.isDirectory() || (stat && stat.isDirectory());
    const isFile = entry.isFile() || (stat && stat.isFile());

    if (isDir) {
      yield* walk(root, nextRel);
    } else if (isFile) {
      yield nextRel;
    }
  }
}

/**
 * Shell-quote a value for a POSIX shell. Wraps in single quotes and
 * escapes any embedded single quote via the `'\''` idiom. The generated
 * script runs under bash/zsh so this is safe for filenames with spaces,
 * parentheses, ampersands, etc.
 */
function shq(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const lines = [];
lines.push('#!/usr/bin/env bash');
lines.push('# ---------------------------------------------------------------');
lines.push('# Sukoon — upload every /public asset into R2.');
lines.push('#');
lines.push('# GENERATED by cf/scripts/upload-to-r2.mjs — DO NOT EDIT BY HAND.');
lines.push('# Re-run the generator whenever /public/{video,audio,og}/ changes.');
lines.push('#');
lines.push('# Prereqs:');
lines.push(`#   wrangler r2 bucket create ${BUCKET}`);
lines.push('#   wrangler login   (or CLOUDFLARE_API_TOKEN in the env)');
lines.push('#');
lines.push('# All objects are written with a year-long immutable cache. The');
lines.push('# key mirrors the /public path so the Worker can serve them at');
lines.push('# /assets/<same-path> without a translation table.');
lines.push('# ---------------------------------------------------------------');
lines.push('set -euo pipefail');
lines.push('');
lines.push(`cd "$(dirname "$0")/../.."   # sukoon/ project root`);
lines.push('');

const counts = Object.fromEntries(TREES.map((t) => [t.dir, 0]));
const skipped = [];
let totalBytes = 0;
let totalFiles = 0;

for (const tree of TREES) {
  const treeRoot = path.join(PUBLIC_DIR, tree.dir);
  if (!fs.existsSync(treeRoot)) {
    lines.push(`# (skipping ${tree.dir}/ — directory not present)`);
    lines.push('');
    continue;
  }
  lines.push(`# --- ${tree.dir}/  (${tree.contentType}) ------------------------------`);
  for (const rel of walk(treeRoot)) {
    const ext = path.extname(rel).toLowerCase();
    if (ext !== tree.ext) {
      skipped.push(`${tree.dir}/${rel}`);
      continue;
    }
    const key = `${tree.dir}/${rel}`;
    const localPath = `public/${key}`;
    const size = fs.statSync(path.join(treeRoot, rel)).size;
    totalBytes += size;
    totalFiles += 1;
    counts[tree.dir] += 1;
    const cmd = [
      'wrangler r2 object put',
      `${BUCKET}/${key}`,
      `--file=${shq(localPath)}`,
      `--content-type=${shq(tree.contentType)}`,
      `--cache-control=${shq(CACHE_CONTROL)}`,
    ].join(' ');
    lines.push(cmd);
  }
  lines.push('');
}

lines.push('echo');
lines.push(`echo "[sukoon] uploaded ${totalFiles} assets to r2://${BUCKET}"`);
lines.push('');

fs.writeFileSync(OUT_PATH, lines.join('\n'), 'utf8');
fs.chmodSync(OUT_PATH, 0o755);

// --- Report -----------------------------------------------------------
console.log(`[sukoon] wrote ${path.relative(REPO_ROOT, OUT_PATH)}`);
console.log(`[sukoon] bucket: ${BUCKET}`);
console.log(`[sukoon] total files: ${totalFiles}  (${fmtBytes(totalBytes)})`);
for (const tree of TREES) {
  console.log(`[sukoon]   ${tree.dir}/: ${counts[tree.dir]}`);
}
if (skipped.length) {
  console.log(`[sukoon] skipped ${skipped.length} file(s) with unexpected extension:`);
  for (const s of skipped) console.log(`[sukoon]   - ${s}`);
}

process.exit(0);
