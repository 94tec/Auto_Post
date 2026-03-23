// services/sessionService.js
// Stores user session metadata in Redis.
// Firebase handles auth tokens — this layer stores richer session data
// (device info, last active, preferences) without hitting Firestore.
//
// Session TTL = 7 days (refreshed on each active request).

import redis from '../config/redis.js';
import { KEYS } from './cache.js';

const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

/**
 * Create or refresh a session after login.
 * @param {string} uid       Firebase UID
 * @param {object} metadata  { email, displayName, role, ip, userAgent }
 */
export const createSession = async (uid, metadata = {}) => {
  if (!redis.isReady) return null;
  try {
    const session = {
      uid,
      email:       metadata.email       || null,
      displayName: metadata.displayName || null,
      role:        metadata.role        || 'user',
      ip:          metadata.ip          || null,
      userAgent:   metadata.userAgent   || null,
      createdAt:   new Date().toISOString(),
      lastActive:  new Date().toISOString(),
    };
    await redis.setEx(KEYS.userSession(uid), SESSION_TTL, JSON.stringify(session));
    return session;
  } catch (err) {
    console.error('[Session] createSession error:', err.message);
    return null;
  }
};

/**
 * Get session data for a user.
 * Returns null if session doesn't exist or Redis is down.
 */
export const getSession = async (uid) => {
  if (!redis.isReady) return null;
  try {
    const raw = await redis.get(KEYS.userSession(uid));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('[Session] getSession error:', err.message);
    return null;
  }
};

/**
 * Refresh the session TTL + update lastActive timestamp.
 * Call this on every authenticated request.
 */
export const refreshSession = async (uid) => {
  if (!redis.isReady) return;
  try {
    const raw = await redis.get(KEYS.userSession(uid));
    if (!raw) return;
    const session = JSON.parse(raw);
    session.lastActive = new Date().toISOString();
    await redis.setEx(KEYS.userSession(uid), SESSION_TTL, JSON.stringify(session));
  } catch (err) {
    console.error('[Session] refreshSession error:', err.message);
  }
};

/**
 * Destroy session on logout.
 */
export const destroySession = async (uid) => {
  if (!redis.isReady) return;
  try {
    await redis.del(KEYS.userSession(uid));
  } catch (err) {
    console.error('[Session] destroySession error:', err.message);
  }
};

/**
 * Middleware: attaches session data to req.session (non-blocking).
 * Always calls next() — session is enrichment, not a gate.
 */
export const attachSession = async (req, res, next) => {
  if (req.uid && redis.isReady) {
    try {
      const raw = await redis.get(KEYS.userSession(req.uid));
      req.session = raw ? JSON.parse(raw) : null;
      // Silently refresh TTL in background (fire and forget)
      if (req.session) refreshSession(req.uid).catch(() => {});
    } catch {
      req.session = null;
    }
  }
  next();
};