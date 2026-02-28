import rateLimit from 'express-rate-limit';

// ✅ In-memory rate limiter for login
const isLoginRateLimited = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    req.rateLimited = true;
    return next();
  }
});

// ✅ In-memory rate limiter for registration
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.body.email || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many registration attempts. Please try again later.',
      code: 'RATE_LIMITED'
    });
  }
});


export {
  isLoginRateLimited,
  registrationLimiter
};
