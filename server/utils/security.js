/**
 * utils/security.js
 * ═══════════════════════════════════════════════════════════════════
 * HTTP security headers, session fingerprinting, CSRF generation,
 * UA parsing. This is the CANONICAL security utils file.
 *
 * authUtils.js re-exports createSessionFingerprint / generateCSRFToken
 * for backward compat, but the implementation lives here.
 *
 * FIXES vs original:
 *   - Both security.js and authUtils.js defined createSessionFingerprint
 *     and generateCSRFToken — consolidated here, authUtils.js imports from here.
 *   - createSessionFingerprint signature unified: (userAgent, ip?) → hex
 *   - Redis cache: active sessions cached for fast revocation checks
 * ═══════════════════════════════════════════════════════════════════
 */

import crypto   from 'crypto';
import { UAParser } from 'ua-parser-js';  // npm install ua-parser-js
import redis       from '../config/redis.js';

/* ── Safe Redis helper ───────────────────────────────────────── */
const rSet = async (k, v, ttl) => { try { await redis.setEx(k, ttl, v); } catch { /* ignore */ } };

/* ══════════════════════════════════════════════════════════════
   HTTP SECURITY HEADERS
══════════════════════════════════════════════════════════════ */

/**
 * Sets hardened HTTP security headers on the response.
 * Call after cookie setup in the login flow.
 * @param {import('express').Response} res
 */
export const setSecurityHeaders = (res) => {
  res.setHeader('X-Content-Type-Options',   'nosniff');
  res.setHeader('X-Frame-Options',          'DENY');
  res.setHeader('X-XSS-Protection',         '1; mode=block');
  res.setHeader('Referrer-Policy',          'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy',       'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; connect-src 'self' https://identitytoolkit.googleapis.com;"
  );
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  res.removeHeader('X-Powered-By');
};

/* ══════════════════════════════════════════════════════════════
   USER AGENT PARSING
══════════════════════════════════════════════════════════════ */

/**
 * Parses a raw User-Agent string into a readable description.
 * @param {string} ua
 * @returns {string}  e.g. "Chrome 124 on Windows 11 (Desktop)"
 */
export const parseUserAgent = (ua) => {
  try {
    if (!ua || typeof ua !== 'string') return 'Unknown Device';
    const p       = new UAParser(ua);
    const browser = p.getBrowser();
    const os      = p.getOS();
    const device  = p.getDevice();
    return `${browser.name || 'Browser'} ${browser.version || ''} on ${os.name || 'OS'} ${os.version || ''} (${device.type || 'Desktop'})`.trim();
  } catch {
    return 'Unknown Device';
  }
};

/* ══════════════════════════════════════════════════════════════
   SESSION FINGERPRINTING
   Canonical implementation — authUtils.js re-exports this.
══════════════════════════════════════════════════════════════ */

/**
 * Creates a short session fingerprint from User-Agent (+ optional IP).
 * Used when setting cookies to detect cross-device token theft.
 * @param {string} userAgent
 * @param {string} [ip]   — include for stricter binding (optional)
 * @returns {string}  16-char hex
 */
export const createSessionFingerprint = (userAgent, ip = '') => {
  const secret = process.env.COOKIE_SECRET || 'damuchi-fp-fallback';
  return crypto
    .createHash('sha256')
    .update(`${userAgent || 'unknown'}|${ip}|${secret}`)
    .digest('hex')
    .substring(0, 16);
};

/* ══════════════════════════════════════════════════════════════
   CSRF TOKEN
   Canonical implementation — authUtils.js re-exports this.
══════════════════════════════════════════════════════════════ */

/**
 * Generates a cryptographically secure CSRF token.
 * @param {number} [bytes=32]
 * @returns {string} hex string
 */
export const generateCSRFToken = (bytes = 32) =>
  crypto.randomBytes(bytes).toString('hex');

/* ══════════════════════════════════════════════════════════════
   SECURE SESSION COOKIES + REDIS CACHE
   Called from authController.login after verifyAndValidateToken.
══════════════════════════════════════════════════════════════ */

/**
 * Sets three httpOnly signed cookies on the response AND caches
 * the active session in Redis for fast lookup / revocation.
 *
 * Cookies:
 *   __Host-session / __session  — idToken + fingerprint  (1 h, httpOnly)
 *   __refresh                   — refreshToken           (30 d, httpOnly)
 *   __csrf                      — CSRF token             (1 h, NOT httpOnly)
 *
 * Redis:
 *   session:{uid}  → { uid, issuedAt, fingerprint }   (1 h TTL)
 *
 * @param {import('express').Response} res
 * @param {{ idToken, refreshToken, userId, userAgent, ip? }} opts
 */
export const establishSecureSession = async (res, { idToken, refreshToken, userId, userAgent, ip = '' }) => {
  const prod        = process.env.NODE_ENV === 'production';
  const fingerprint = createSessionFingerprint(userAgent, ip);
  const csrfToken   = generateCSRFToken();
  const sessionName = prod ? '__Host-session' : '__session';

  const cookieBase = {
    httpOnly: true,
    secure:   prod,
    sameSite: 'strict',
    path:     '/',
    signed:   true,
    ...(prod && process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };

  res.cookie(sessionName, `${idToken}|${fingerprint}`, { ...cookieBase, maxAge: 60 * 60 * 1000 });
  res.cookie('__refresh', refreshToken, { ...cookieBase, path: '/auth/refresh', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.cookie('__csrf',    csrfToken,    { ...cookieBase, httpOnly: false, maxAge: 60 * 60 * 1000 });

  // Cache active session in Redis for fast revocation checks
  const sessionData = JSON.stringify({ uid: userId, fingerprint, issuedAt: Date.now() });
  await rSet(`session:${userId}`, sessionData, 60 * 60); // 1 h TTL matches cookie

  setSecurityHeaders(res);
};