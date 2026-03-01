/**
 * middlewares/rateLimiter.js
 * Tiered rate limiting:
 *   authRateLimiter  — 10 req / 15 min  (login, register, resend)
 *   apiRateLimiter   — 100 req / 15 min (general API)
 *   adminRateLimiter — 60 req / 15 min  (admin panel)
 */
import rateLimit from 'express-rate-limit';

const w = 15 * 60 * 1000;

export const authRateLimiter = rateLimit({
  windowMs: w, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many auth requests. Wait 15 minutes.', code: 'RATE_LIMITED' },
});

export const apiRateLimiter = rateLimit({
  windowMs: w, max: 100, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Rate limit exceeded.', code: 'RATE_LIMITED' },
});

export const adminRateLimiter = rateLimit({
  windowMs: w, max: 60, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}-${req.uid || 'anon'}`,
  message: { error: 'Admin rate limit exceeded.', code: 'RATE_LIMITED' },
});