/* ─── In-memory IP rate limiter — 60 req/min/IP ──────────────────────
   Anonymous by architecture: we store IP→{count,windowStart} in a Map
   that is wiped each minute. No persistence, no logging of payloads.
   Acceptable because Sukoon is single-process; if we shard, swap for
   a shared store. Constitution: never log user input. */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;

const buckets = new Map();

// Periodic prune so an attacker can't grow the Map unbounded.
// Runs every WINDOW_MS — cheap because Map is small.
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of buckets) {
    if (now - b.windowStart > WINDOW_MS) buckets.delete(ip);
  }
}, WINDOW_MS).unref();

function getIp(req) {
  // trust first hop only; railway/proxy sets x-forwarded-for
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function rateLimit(req, res, next) {
  const ip = getIp(req);
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now });
    return next();
  }

  bucket.count += 1;
  if (bucket.count > MAX_PER_WINDOW) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - bucket.windowStart)) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }
  next();
}

module.exports = rateLimit;
