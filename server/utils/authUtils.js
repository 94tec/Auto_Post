/**
 * utils/authUtils.js
 * ═══════════════════════════════════════════════════════════════════
 * Auth utilities: login-attempt tracking, session fingerprinting,
 * CSRF generation, token revocation check.
 *
 * FIXES vs original:
 *   - loginAttempts Map() → Redis (survives restarts, shared across instances)
 *   - console.alert() → console.warn() (alert doesn't exist in Node)
 *   - checkLoginAttempts(email) referenced req.ip without req param → fixed
 *   - sendSecurityAlert was undefined → replaced with AuditLog
 *   - createSessionFingerprint now uses COOKIE_SECRET with safe fallback
 *   - getTokenRevocationTime now uses adminDb (Admin SDK) not client db
 *   - Redis cache: login attempt counts cached with TTL auto-expiry
 * ═══════════════════════════════════════════════════════════════════
 */

import crypto   from 'crypto';
import { adminDb } from '../config/firebase.js';
import redis       from '../config/redis.js';
import AuditLog    from '../services/auditLog.js';

/* ── Redis key builders ──────────────────────────────────────── */
const K = {
  loginAttempts: (email) => `auth:attempts:${email}`,
  loginLock:     (email) => `auth:lock:${email}`,
  tokenRevoke:   (uid)   => `auth:revoke:${uid}`,
};

/* ── Config ──────────────────────────────────────────────────── */
const MAX_ATTEMPTS   = 5;
const LOCK_DURATION  = 60 * 60;      // 1 hour in seconds
const WARN_THRESHOLD = 3;            // send alert at this many failures
const ATTEMPT_TTL    = 60 * 60 * 2; // store attempts for 2 hours

/* ── Safe Redis helpers ──────────────────────────────────────── */
const rGet  = async (k)         => { try { return await redis.get(k);  } catch { return null; } };
const rSet  = async (k, v, ttl) => { try { await redis.setEx(k, ttl, String(v)); } catch { /* ignore */ } };
const rIncr = async (k, ttl)    => {
  try {
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, ttl); // set TTL on first increment
    return n;
  } catch { return 0; }
};
const rDel  = async (k) => { try { await redis.del(k); } catch { /* ignore */ } };

/* ══════════════════════════════════════════════════════════════
   LOGIN ATTEMPT TRACKING (Redis-backed)
══════════════════════════════════════════════════════════════ */

/**
 * Check if an email is currently locked out.
 * @param {string} email
 * @param {string} [ip] — for audit logging
 * @returns {Promise<{ allowed: boolean, remaining?: number }>}
 */
export const checkLoginAttempts = async (email, ip = 'unknown') => {
  // Check for an explicit lock key first (faster than counting)
  const locked = await rGet(K.loginLock(email));
  if (locked) {
    // Get remaining TTL so we can tell the user how long to wait
    let remaining = LOCK_DURATION;
    try { remaining = await redis.ttl(K.loginLock(email)); } catch { /* ignore */ }

    console.warn(`[Auth] Login blocked — account locked: ${email} (IP: ${ip})`);
    return { allowed: false, remaining };
  }

  // Count recent failures
  const count = parseInt(await rGet(K.loginAttempts(email)) ?? '0', 10);
  if (count >= MAX_ATTEMPTS) {
    // Set the lock and clear the counter (lock auto-expires)
    await rSet(K.loginLock(email), '1', LOCK_DURATION);
    await rDel(K.loginAttempts(email));

    AuditLog.record('ACCOUNT_LOCKED', {
      ip,
      metadata: { email, attemptCount: count },
    }).catch(() => {});

    return { allowed: false, remaining: LOCK_DURATION };
  }

  return { allowed: true };
};

/**
 * Record a failed login attempt in Redis.
 * Fires security alert at WARN_THRESHOLD failures.
 * @param {string} email
 * @param {string} [ip]
 */
export const recordFailedAttempt = async (email, ip = 'unknown') => {
  const count = await rIncr(K.loginAttempts(email), ATTEMPT_TTL);

  console.warn(`[Auth] Failed login attempt ${count}/${MAX_ATTEMPTS} for ${email} (IP: ${ip})`);

  if (count === WARN_THRESHOLD) {
    // Fire-and-forget security alert via audit log
    AuditLog.record('LOGIN_WARNING', {
      ip,
      metadata: {
        email,
        attemptCount: count,
        message: `${count} consecutive failed login attempts`,
      },
    }).catch(() => {});

    console.warn(`[Auth] ⚠️  Security alert: ${count} failed attempts for ${email} from IP ${ip}`);
  }
};

/**
 * Clear failed attempt counter after a successful login.
 * @param {string} email
 */
export const clearLoginAttempts = async (email) => {
  await Promise.allSettled([
    rDel(K.loginAttempts(email)),
    rDel(K.loginLock(email)),
  ]);
};

/* ══════════════════════════════════════════════════════════════
   EMAIL VALIDATION (basic format — full pipeline in validator.js)
══════════════════════════════════════════════════════════════ */

/**
 * Quick format check. Use validateEmailFull() from validator.js
 * for the full pipeline (disposable check + DNS MX).
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254)                  return false;
  const [local, domain] = email.split('@');
  if (!local || !domain)                   return false;
  if (local.length > 64)                   return false;
  // RFC 5322 — includes end anchor $
  const RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  return RE.test(email);
};

/* ══════════════════════════════════════════════════════════════
   PASSWORD VALIDATION (basic — detailed version in validator.js)
══════════════════════════════════════════════════════════════ */

export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8 || password.length > 128) return false;
  if (password.includes(' ')) return false;
  // 1 uppercase, 1 lowercase, 1 digit, 1 special
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#()\-_=+[\]{};:'",.<>?/\\|`~])[A-Za-z\d@$!%*?&^#()\-_=+[\]{};:'",.<>?/\\|`~]{8,}$/.test(password);
};

/* ══════════════════════════════════════════════════════════════
   SESSION FINGERPRINTING
══════════════════════════════════════════════════════════════ */

/**
 * Creates a short session fingerprint from the user agent.
 * Used to detect token theft across different devices.
 * @param {string} userAgent
 * @returns {string} 16-char hex
 */
export const createSessionFingerprint = (userAgent) => {
  const ua     = userAgent || 'unknown-agent';
  const secret = process.env.COOKIE_SECRET || 'damuchi-fallback-fingerprint-secret';
  return crypto
    .createHash('sha256')
    .update(`${ua}|${secret}`)
    .digest('hex')
    .substring(0, 16);
};

/* ══════════════════════════════════════════════════════════════
   CSRF TOKEN
══════════════════════════════════════════════════════════════ */

/** @returns {string} 64-char hex CSRF token */
export const generateCSRFToken = () => crypto.randomBytes(32).toString('hex');

/* ══════════════════════════════════════════════════════════════
   TOKEN REVOCATION CHECK (Redis cache + RTDB fallback)
══════════════════════════════════════════════════════════════ */

/**
 * Gets the token revocation timestamp for a user.
 * Checks Redis first (warm), then RTDB (source of truth).
 * @param {string} uid
 * @returns {Promise<Date|null>}
 */
export const getTokenRevocationTime = async (uid) => {
  // 1. Redis cache (fast path)
  const cached = await rGet(K.tokenRevoke(uid));
  if (cached) return new Date(cached);

  // 2. RTDB (source of truth — uses Admin SDK, not client SDK)
  try {
    const snap     = await adminDb.ref(`tokenRevocations/${uid}`).once('value');
    const revokedAt = snap.val();
    if (revokedAt) {
      // Warm the cache for next check (TTL = 1 hour)
      await rSet(K.tokenRevoke(uid), revokedAt, 3600);
      return new Date(revokedAt);
    }
    return null;
  } catch (err) {
    console.error('[Auth] Token revocation check failed:', err.message);
    return null; // fail open — assume not revoked
  }
};