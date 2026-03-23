// services/cache.js
// Thin wrapper around node-redis for typed cache ops.
// All methods fail silently — if Redis is down, the app keeps working.
 
import redis from '../config/redis.js';
 
const DEFAULT_TTL = 60 * 5; // 5 minutes
 
/* ── key builders — centralised so invalidation is consistent ── */
export const KEYS = {
  allQuotes:      ()        => 'quotes:all',
  userQuotes:     (uid)     => `quotes:user:${uid}`,
  singleQuote:    (id)      => `quotes:id:${id}`,
  userSession:    (uid)     => `session:${uid}`,
  rateLimitIP:    (ip)      => `rl:ip:${ip}`,
  rateLimitUser:  (uid)     => `rl:user:${uid}`,
  jobQueue:       (name)    => `queue:${name}`,
};
 
/* ── isAlive — check before every op ── */
const isAlive = () => redis.isReady;
 
/* ── get ────────────────────────────────────────────────────── */
export const cacheGet = async (key) => {
  if (!isAlive()) return null;
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error(`[Cache] GET ${key}:`, err.message);
    return null;
  }
};
 
/* ── set ────────────────────────────────────────────────────── */
export const cacheSet = async (key, value, ttlSeconds = DEFAULT_TTL) => {
  if (!isAlive()) return;
  try {
    await redis.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.error(`[Cache] SET ${key}:`, err.message);
  }
};
 
/* ── delete one key ─────────────────────────────────────────── */
export const cacheDel = async (key) => {
  if (!isAlive()) return;
  try {
    await redis.del(key);
  } catch (err) {
    console.error(`[Cache] DEL ${key}:`, err.message);
  }
};
 
/* ── delete by pattern (e.g. 'quotes:*') ───────────────────── */
export const cacheDelPattern = async (pattern) => {
  if (!isAlive()) return;
  try {
    // SCAN is non-blocking; KEYS would block on large datasets
    let cursor = 0;
    do {
      const { cursor: next, keys } = await redis.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });
      cursor = next;
      if (keys.length) await redis.del(keys);
    } while (cursor !== 0);
  } catch (err) {
    console.error(`[Cache] DEL pattern ${pattern}:`, err.message);
  }
};
 
/* ── invalidate all quote caches ───────────────────────────── */
export const invalidateQuoteCache = async (uid) => {
  await Promise.all([
    cacheDel(KEYS.allQuotes()),
    uid && cacheDel(KEYS.userQuotes(uid)),
    cacheDelPattern('quotes:*'),        // belt + suspenders
  ]);
};