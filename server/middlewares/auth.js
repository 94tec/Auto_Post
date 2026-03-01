/**
 * middlewares/auth.js
 * ═══════════════════════════════════════════════════════════════════
 * All authentication and authorisation middleware.
 *
 * MIDDLEWARE CHAIN
 * ───────────────────────────────────────────────────────────────────
 *  verifyToken           validates Firebase ID token → req.user (RTDB)
 *  optionalAuth          soft token check, no 401 on missing
 *  requireEmailVerified  rejects unverified accounts
 *  requireActiveAccount  rejects pending / awaiting / suspended
 *  requireRole(...roles) allows only listed roles
 *  requirePermission(key) checks a specific flag on req.user.permissions
 *  requireAdmin          admin-only — returns 404 to all others (security)
 * ═══════════════════════════════════════════════════════════════════
 */

import { admin }       from '../config/firebase.js';
import { getUserById } from '../models/user.js';
import { ROLES, STATUS } from '../config/roles.js';

/* ── Token extraction ────────────────────────────────────────────── */
const extractToken = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

/* ── verifyToken ─────────────────────────────────────────────────── */
/**
 * Verifies Firebase ID token, loads RTDB user record.
 * Attaches: req.user, req.uid, req.firebaseUser
 */
export const verifyToken = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      error:   'Authentication required',
      code:    'NO_TOKEN',
      message: 'Please sign in to access this resource.',
    });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const dbUser  = await getUserById(decoded.uid);

    if (!dbUser) {
      return res.status(401).json({ error: 'User record not found', code: 'USER_NOT_FOUND' });
    }

    if (dbUser.basic?.status === STATUS.SUSPENDED) {
      return res.status(403).json({
        error:   'Account suspended',
        code:    'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Contact support.',
      });
    }

    req.firebaseUser = decoded;
    req.user         = dbUser;
    req.uid          = decoded.uid;
    next();
  } catch (err) {
    const expired = err.code === 'auth/id-token-expired';
    return res.status(401).json({
      error:   expired ? 'Token expired'  : 'Invalid token',
      code:    expired ? 'TOKEN_EXPIRED'  : 'INVALID_TOKEN',
      message: expired ? 'Session expired. Please sign in again.' : 'Authentication failed.',
    });
  }
};

/* ── optionalAuth ────────────────────────────────────────────────── */
/**
 * Soft auth — guests without a token pass through.
 * If a valid token is present, req.user is populated.
 */
export const optionalAuth = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const dbUser  = await getUserById(decoded.uid);
    req.firebaseUser = decoded;
    req.user = dbUser;
    req.uid  = decoded.uid;
  } catch {
    // Silently ignore invalid tokens in optional auth
  }
  next();
};

/* ── requireEmailVerified ────────────────────────────────────────── */
export const requireEmailVerified = (req, res, next) => {
  if (!req.user?.basic?.emailVerified) {
    return res.status(403).json({
      error:   'Email not verified',
      code:    'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email before accessing this feature.',
    });
  }
  next();
};

/* ── requireActiveAccount ────────────────────────────────────────── */
/**
 * Requires status === 'active'.
 * Catches pending (no email verify), awaiting (email ok, no admin approval),
 * and suspended states.
 */
export const requireActiveAccount = (req, res, next) => {
  const status = req.user?.basic?.status;

  if (status === STATUS.ACTIVE) return next();

  const messages = {
    [STATUS.PENDING]:   'Please verify your email to activate your account.',
    [STATUS.AWAITING]:  'Your account is awaiting admin approval. You will be notified.',
    [STATUS.SUSPENDED]: 'Your account has been suspended. Contact support.',
  };

  return res.status(403).json({
    error:   'Account not active',
    code:    `ACCOUNT_${status?.toUpperCase()}`,
    status,
    message: messages[status] || 'Account not active.',
  });
};

/* ── requireRole ─────────────────────────────────────────────────── */
/**
 * @param {...string} roles  allowed role names
 */
export const requireRole = (...roles) => (req, res, next) => {
  const userRole = req.user?.basic?.role;
  if (!roles.includes(userRole)) {
    return res.status(403).json({
      error:    'Insufficient role',
      code:     'FORBIDDEN_ROLE',
      required: roles,
      yours:    userRole || 'none',
    });
  }
  next();
};

/* ── requireAdmin ────────────────────────────────────────────────── */
/**
 * Admin-only guard.
 * Returns 404 to non-admins to obscure admin route existence.
 */
export const requireAdmin = (req, res, next) => {
  if (req.user?.basic?.role !== ROLES.ADMIN) {
    return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
  }
  next();
};

/* ── requirePermission ───────────────────────────────────────────── */
/**
 * Checks a specific permission flag on the user's permission map.
 * Admins always bypass by default.
 *
 * @param {string} key         permission key e.g. 'write', 'delete'
 * @param {{ allowAdmin? }} opts
 */
export const requirePermission = (key, { allowAdmin = true } = {}) =>
  (req, res, next) => {
    const role  = req.user?.basic?.role;
    const perms = req.user?.permissions || {};

    if (allowAdmin && role === ROLES.ADMIN) return next();

    if (!perms[key]) {
      return res.status(403).json({
        error:    'Permission denied',
        code:     'INSUFFICIENT_PERMISSION',
        required: key,
        message:  key === 'write'
          ? 'You need write permission. An admin must grant it to you.'
          : `You do not have the "${key}" permission.`,
      });
    }
    next();
  };