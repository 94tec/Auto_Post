import redis from '../config/redis.js';

const DEFAULT_OPTIONS = {
  max: 60,
  window: 60, // seconds
  keyBy: 'ip',
  message: 'Too many requests — slow down.',
};

export const rateLimiter = (opts = {}) => {
  const { max, window, keyBy, message } = { ...DEFAULT_OPTIONS, ...opts };

  return async (req, res, next) => {
    if (!redis.isReady) {
      // Optionally log that Redis is down
      return next();
    }

    const ip = req.ip || req.connection.remoteAddress;
    const uid = req.uid;

    let key;
    if (keyBy === 'user' && uid) {
      key = `rl:user:${uid}`;
    } else if (keyBy === 'both' && uid) {
      key = `rl:both:${uid}:${ip}`;
    } else {
      key = `rl:ip:${ip}`;
    }

    try {
      const script = `
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then
          redis.call('EXPIRE', KEYS[1], ARGV[1])
        end
        return {count, redis.call('TTL', KEYS[1])}
      `;

      const [count, ttl] = await redis.eval(script, {
        keys: [key],
        arguments: [String(window)],
      });

      const remaining = Math.max(0, max - count);
      const reset = Math.floor(Date.now() / 1000) + ttl;

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
      next();
    }
  };
};

// Pre-configured limiters
export const authLimiter = rateLimiter({
  max: 10,
  window: 15 * 60,
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