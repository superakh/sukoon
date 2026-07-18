/**
 * Sukoon — R2 asset URLs and range-aware serving.
 *
 * All video, audio, and OG imagery lives in the `sukoon-assets` R2
 * bucket. The upload script (cf/scripts/upload-to-r2.mjs) mirrors the
 * `/public` layout into R2, so the R2 object key equals the /public
 * path minus the leading slash:
 *
 *   /public/video/hero-home.mp4                 <-> video/hero-home.mp4
 *   /public/audio/ambient-home.mp3              <-> audio/ambient-home.mp3
 *   /public/og/home.jpg                         <-> og/home.jpg
 *   /public/og/asanas/adho-mukha-svanasana.jpg  <-> og/asanas/adho-mukha-svanasana.jpg
 *
 * We prefer serving through the Worker itself using the SUKOON_ASSETS
 * R2 binding: a stable `/assets/<key>` URL, no external hostname, and
 * we control the response headers (cache-control, content-type, range
 * support). The `assetUrl(...)` helper is the single source of truth
 * for those URLs — templates and HTML routes should never string-build
 * `/video/foo.mp4` by hand.
 */

import type { R2Bucket } from '@cloudflare/workers-types';

/** URL prefix the Worker exposes for R2-backed assets. */
export const ASSET_URL_PREFIX = '/assets';

/** Cache header written both by wrangler r2 object put and here. */
export const ASSET_CACHE_CONTROL = 'public,max-age=31536000,immutable';

/** File-extension -> content-type. Matches the upload script. */
const CONTENT_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  json: 'application/json',
  txt: 'text/plain; charset=utf-8',
};

/** Recognized top-level asset trees. Anything else 404s from /assets/*. */
const ASSET_TREES = ['video', 'audio', 'og'] as const;
export type AssetTree = (typeof ASSET_TREES)[number];

/**
 * Build a Worker-served URL for an R2 asset.
 *
 * Accepts any of:
 *   - "video/hero-home.mp4"          (bare key)
 *   - "/video/hero-home.mp4"         (leading slash — a /public-style path)
 *   - "video", "hero-home.mp4"       (tree + filename)
 *   - "og", "asanas/adho-mukha-svanasana.jpg"  (tree + nested key)
 *
 * Returns e.g. "/assets/video/hero-home.mp4".
 *
 * We intentionally return a same-origin path — no CDN hostname, no bucket
 * URL — so the caller can drop it straight into an <img>, <video>, or
 * <audio> src and stay behind the Worker's cache + range handling.
 */
export function assetUrl(...parts: string[]): string {
  if (parts.length === 0) throw new Error('assetUrl: no key parts');
  const joined = parts
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join('/')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/');
  if (!joined) throw new Error('assetUrl: empty key');
  return `${ASSET_URL_PREFIX}/${joined}`;
}

/**
 * The plain R2 key (no leading slash, no host, no /assets prefix) for a
 * given /public-style path or (tree, subpath) pair. Use this when you
 * need to read from R2 directly via env.SUKOON_ASSETS.get(key).
 */
export function assetKey(...parts: string[]): string {
  return assetUrl(...parts).slice(ASSET_URL_PREFIX.length + 1);
}

/**
 * Best-effort Content-Type from a key or filename.
 * Falls back to `application/octet-stream` for unknown extensions.
 */
export function contentTypeFor(keyOrName: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(keyOrName);
  const ext = m ? m[1].toLowerCase() : '';
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

/** True if `key` sits under one of the known trees. */
export function isAssetKey(key: string): key is string {
  const first = key.replace(/^\/+/, '').split('/', 1)[0];
  return (ASSET_TREES as readonly string[]).includes(first);
}

/**
 * Parse an HTTP Range header of the form `bytes=start-end` (either end
 * optional) into a normalized R2 range hint. Returns null when the
 * header is missing, malformed, or requests a multi-range.
 *
 * R2's Range option accepts `{ offset, length }` OR `{ suffix }` — this
 * helper produces the shape the R2 SDK expects.
 */
export function parseRange(
  header: string | null | undefined,
  size: number,
): { offset: number; length: number } | { suffix: number } | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, startS, endS] = m;
  if (startS === '' && endS === '') return null;
  if (startS === '') {
    const suffix = Number(endS);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    return { suffix: Math.min(suffix, size) };
  }
  const start = Number(startS);
  if (!Number.isFinite(start) || start < 0 || start >= size) return null;
  const end = endS === '' ? size - 1 : Number(endS);
  if (!Number.isFinite(end) || end < start) return null;
  const clampedEnd = Math.min(end, size - 1);
  return { offset: start, length: clampedEnd - start + 1 };
}

/**
 * Fetch an object from R2 and turn it into a Response with the same
 * long-lived immutable Cache-Control we wrote at upload time, a
 * best-guess Content-Type, and correct Range/206 handling.
 *
 * Callers wire this up from a Worker route like:
 *
 *   app.get('/assets/*', async (c) => {
 *     const key = new URL(c.req.url).pathname.slice('/assets/'.length);
 *     return serveAsset(c.env.SUKOON_ASSETS, key, c.req.raw.headers);
 *   });
 */
export async function serveAsset(
  bucket: R2Bucket,
  key: string,
  reqHeaders?: Headers,
): Promise<Response> {
  const cleanKey = key.replace(/^\/+/, '');
  if (!cleanKey || !isAssetKey(cleanKey)) {
    return new Response('not_found', { status: 404 });
  }

  // HEAD-style probe so we can compute Content-Range without pulling
  // the whole object twice.
  const head = await bucket.head(cleanKey);
  if (!head) return new Response('not_found', { status: 404 });

  const size = head.size;
  const contentType = contentTypeFor(cleanKey);

  const rangeHeader = reqHeaders?.get('range') ?? null;
  const parsed = parseRange(rangeHeader, size);

  const baseHeaders: Record<string, string> = {
    'content-type': contentType,
    'cache-control': ASSET_CACHE_CONTROL,
    'accept-ranges': 'bytes',
    etag: head.httpEtag,
  };

  if (parsed) {
    const range =
      'suffix' in parsed
        ? { suffix: parsed.suffix }
        : { offset: parsed.offset, length: parsed.length };
    const obj = await bucket.get(cleanKey, { range });
    if (!obj) return new Response('not_found', { status: 404 });
    const start = 'suffix' in parsed ? size - parsed.suffix : parsed.offset;
    const length = 'suffix' in parsed ? parsed.suffix : parsed.length;
    const end = start + length - 1;
    return new Response(obj.body, {
      status: 206,
      headers: {
        ...baseHeaders,
        'content-length': String(length),
        'content-range': `bytes ${start}-${end}/${size}`,
      },
    });
  }

  const obj = await bucket.get(cleanKey);
  if (!obj) return new Response('not_found', { status: 404 });
  return new Response(obj.body, {
    status: 200,
    headers: {
      ...baseHeaders,
      'content-length': String(size),
    },
  });
}
