
1// Middleware to check Redis health before protected routes

import e from 'express';
import redis from '../config/redis.js';
const requireRedis = (req, res, next) => {
  if (!redis.isOpen) {
    return res.status(503).json({ error: 'Session service temporarily unavailable' });
  }
  next();
};
export { requireRedis };