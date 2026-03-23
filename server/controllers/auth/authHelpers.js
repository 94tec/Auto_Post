/**
 * controllers/auth/authHelpers.js
 * ═══════════════════════════════════════════════════════════════
 * Shared utilities used by authController, userController,
 * and adminController. Import only what you need.
 *
 * EXPORTS
 * ───────────────────────────────────────────────────────────────
 *  Redis helpers    : rGet, rSet, rDel, rSetNX
 *  Cache keys       : K
 *  Cache TTLs       : TTL
 *  DB writes        : writeUserToRTDB, writeUserToFirestore, cacheNewUser
 *  Rollback         : rollbackRegistration
 *  Request helpers  : getIp, getUserAgent
 *  Email validator  : validateEmailFormat
 * ═══════════════════════════════════════════════════════════════
 */

import { admin, adminDb } from '../../config/firebase.js';
import { ROLES, STATUS }  from '../../config/roles.js';
import redis              from '../../config/redis.js';

/* ── Request helpers ─────────────────────────────────────────── */
export const getIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
  req.ip ||
  req.connection?.remoteAddress ||
  'unknown';

export const getUserAgent = (req) => req.headers['user-agent'] || 'unknown';

/* ── Cache TTLs ──────────────────────────────────────────────── */
export const TTL = {
  EMAIL_UID:   60 * 60 * 24 * 7,  // 7 days   — email→uid lookup
  PROFILE:     60 * 60 * 2,        // 2 hours  — warm profile cache
  REG_LOCK:    30,                  // 30 sec   — double-submit lock
  SESSION:     60 * 60,             // 1 hour   — session data
  RESEND_COOL: 60 * 2,             // 2 min    — resend verification cooldown
};

/* ── Cache key builders ──────────────────────────────────────── */
export const K = {
  emailToUid:  (email) => `reg:email:${email}`,
  profile:     (uid)   => `reg:uid:${uid}`,
  regLock:     (email) => `reg:lock:${email}`,
  resendCool:  (email) => `resend:cool:${email}`,
  session:     (uid)   => `session:${uid}`,
};

/* ── Safe Redis helpers — never throw ────────────────────────── */
export const rGet = async (key) => {
  try { return await redis.get(key); }
  catch { return null; }
};

export const rSet = async (key, value, ttlSeconds) => {
  try { await redis.setEx(key, ttlSeconds, value); }
  catch (err) { console.warn(`[Redis] rSet ${key}:`, err.message); }
};

export const rDel = async (key) => {
  try { await redis.del(key); }
  catch (err) { console.warn(`[Redis] rDel ${key}:`, err.message); }
};

/** SET NX — returns truthy if acquired, null if key already exists */
export const rSetNX = async (key, value, ttlSeconds) => {
  try {
    return await redis.set(key, value, { NX: true, EX: ttlSeconds });
  } catch {
    return null;
  }
};

/* ── Email format validator ──────────────────────────────────── */
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export const validateEmailFormat = (email) => {
  if (!email || typeof email !== 'string')
    return { valid: false, reason: 'Email is required.',              code: 'MISSING_EMAIL' };
  if (email.length > 254)
    return { valid: false, reason: 'Email address is too long.',      code: 'EMAIL_TOO_LONG' };
  if (!EMAIL_RE.test(email))
    return { valid: false, reason: 'Please enter a valid email address (e.g. you@example.com).', code: 'INVALID_EMAIL' };
  return { valid: true };
};

/* ── RTDB write — nested multi-path update ───────────────────── */
export const writeUserToRTDB = async (uid, { email, displayName, ip }) => {
  const now = new Date().toISOString();
  await adminDb.ref('/').update({
    [`users/${uid}/basic/uid`]:           uid,
    [`users/${uid}/basic/email`]:         email,
    [`users/${uid}/basic/displayName`]:   displayName,
    [`users/${uid}/basic/role`]:          ROLES.GUEST,
    [`users/${uid}/basic/status`]:        STATUS.PENDING,
    [`users/${uid}/basic/emailVerified`]: false,
    [`users/${uid}/basic/adminApproved`]: false,
    [`users/${uid}/basic/createdAt`]:     now,
    [`users/${uid}/basic/updatedAt`]:     now,
    [`users/${uid}/basic/registeredIp`]:  ip || 'unknown',
    [`users/${uid}/permissions/read`]:    true,
    [`users/${uid}/permissions/write`]:   false,
    [`users/${uid}/permissions/delete`]:  false,
    [`users/${uid}/meta/lastLogin`]:      null,
    [`users/${uid}/meta/createdAt`]:      now,
  });
};

/* ── Firestore write — mirror of RTDB ───────────────────────── */
export const writeUserToFirestore = async (uid, { email, displayName, ip }) => {
  const now = new Date().toISOString();
  await admin.firestore().collection('users').doc(uid).set({
    uid,
    email,
    displayName,
    role:          ROLES.GUEST,
    status:        STATUS.PENDING,
    emailVerified: false,
    adminApproved: false,
    permissions:   { read: true, write: false, delete: false },
    createdAt:     now,
    updatedAt:     now,
    registeredIp:  ip || 'unknown',
  }, { merge: true });
};

/* ── Prime Redis after successful registration ───────────────── */
export const cacheNewUser = async (uid, email, displayName) => {
  const profile = JSON.stringify({
    uid, email, displayName,
    role:          ROLES.GUEST,
    status:        STATUS.PENDING,
    emailVerified: false,
    adminApproved: false,
    cachedAt:      Date.now(),
  });
  await Promise.all([
    rSet(K.emailToUid(email), uid,     TTL.EMAIL_UID),
    rSet(K.profile(uid),      profile, TTL.PROFILE),
  ]);
};

/* ── Full rollback — called when any step after createUser fails  */
export const rollbackRegistration = async (uid, email) => {
  console.warn(`[Auth] Rolling back uid=${uid}`);
  const results = await Promise.allSettled([
    admin.auth().deleteUser(uid),
    adminDb.ref(`users/${uid}`).remove(),
    admin.firestore().collection('users').doc(uid).delete(),
    rDel(K.emailToUid(email)),
    rDel(K.profile(uid)),
  ]);
  results.forEach((r, i) => {
    if (r.status === 'rejected')
      console.error(`[Auth] Rollback step ${i} failed:`, r.reason?.message);
  });
  console.log(`[Auth] Rollback complete uid=${uid}`);
};

/* ── Map Firebase Auth error codes to app responses ─────────── */
export const FIREBASE_AUTH_ERROR_MAP = {
  'auth/email-already-exists':   { status: 409, code: 'EMAIL_EXISTS',         error: 'This email is already registered. Please sign in or reset your password.' },
  'auth/invalid-email':          { status: 400, code: 'INVALID_EMAIL',        error: 'The email address format is invalid.' },
  'auth/weak-password':          { status: 400, code: 'WEAK_PASSWORD',        error: 'Password is too weak. Choose a stronger one.' },
  'auth/operation-not-allowed':  { status: 503, code: 'SERVICE_UNAVAILABLE',  error: 'Account creation is temporarily unavailable. Please try again later.' },
  'auth/user-not-found':         { status: 404, code: 'USER_NOT_FOUND',       error: 'No account found with this email.' },
  'auth/wrong-password':         { status: 401, code: 'INVALID_CREDENTIALS',  error: 'Incorrect email or password.' },
  'auth/invalid-credential':     { status: 401, code: 'INVALID_CREDENTIALS',  error: 'Incorrect email or password.' },
  'auth/too-many-requests':      { status: 429, code: 'TOO_MANY_ATTEMPTS',    error: 'Too many failed attempts. Try again later or reset your password.' },
  'auth/user-disabled':          { status: 403, code: 'ACCOUNT_DISABLED',     error: 'This account has been disabled. Contact support.' },
  'auth/expired-action-code':    { status: 410, code: 'LINK_EXPIRED',         error: 'This link has expired. Please request a new one.' },
  'auth/invalid-action-code':    { status: 400, code: 'INVALID_LINK',         error: 'This link is invalid or has already been used.' },
  'auth/id-token-revoked':       { status: 401, code: 'TOKEN_REVOKED',        error: 'Your session has been revoked. Please sign in again.' },
  'auth/id-token-expired':       { status: 401, code: 'TOKEN_EXPIRED',        error: 'Your session has expired. Please sign in again.' },
  'auth/argument-error':         { status: 400, code: 'INVALID_TOKEN',        error: 'Invalid authentication token.' },
};

export const mapFirebaseError = (err) =>
  FIREBASE_AUTH_ERROR_MAP[err.code] ?? {
    status: 500,
    code:   'SERVER_ERROR',
    error:  'An unexpected error occurred. Please try again.',
  };