// services/rateLimiter.js
import { getRedis, isRedisAlive } from '../config/redis.js';

const DEFAULT_OPTIONS = {
  max: 60,
  window: 60, // seconds
  keyBy: 'ip', // 'ip', 'user', or 'both'
  message: 'Too many requests — slow down.',
};

export const rateLimiter = (opts = {}) => {
  const { max, window, keyBy, message } = { ...DEFAULT_OPTIONS, ...opts };

  return async (req, res, next) => {
    // Check Redis availability – if down, bypass rate limiting (or log warning)
    if (!isRedisAlive()) {
      console.warn('[RateLimit] Redis unavailable – bypassing');
      return next();
    }

    // Determine the key based on configuration
    let key;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userId = req.user?.uid; // Assumes authentication middleware sets req.user

    if (keyBy === 'user' && userId) {
      key = `rl:user:${userId}`;
    } else if (keyBy === 'both' && userId) {
      key = `rl:both:${userId}:${ip}`;
    } else {
      key = `rl:ip:${ip}`;
    }

    try {
      // Lua script: atomic increment + set expiry + return count and TTL
      const script = `
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then
          redis.call('EXPIRE', KEYS[1], ARGV[1])
        end
        local ttl = redis.call('TTL', KEYS[1])
        return {count, ttl}
      `;

      const client = getRedis(); // throws if Redis not ready
      const [count, ttl] = await client.eval(script, {
        keys: [key],
        arguments: [String(window)],
      });

      const remaining = Math.max(0, max - count);
      const reset = Math.floor(Date.now() / 1000) + ttl;

      // Set rate-limit headers
      res.set({
        'X-RateLimit-Limit': max,
        'X-RateLimit-Remaining': remaining,
        'X-RateLimit-Reset': reset,
      });

      if (count > max) {
        return res.status(429).json({
          error: message,
          code: 'RATE_LIMITED',
          retryAfter: ttl,
        });
      }

      next();
    } catch (err) {
      console.error('[RateLimit] Redis error:', err.message);
      next(); // fail open
    }
  };
};

// Pre‑configured limiters
export const authLimiter = rateLimiter({
  max: 10,
  window: 15 * 60, // 15 minutes
  keyBy: 'ip',
  message: 'Too many auth attempts. Try again in 15 minutes.',
});

export const apiLimiter = rateLimiter({ max: 60, window: 60 });

export const writeLimiter = rateLimiter({
  max: 20,
  window: 60,
  keyBy: 'user',
  message: 'Write limit reached. Slow down.',
});