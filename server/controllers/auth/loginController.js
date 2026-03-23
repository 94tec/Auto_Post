/**
 * controllers/auth/loginController.js
 * ═══════════════════════════════════════════════════════════════
 * POST /api/auth/login
 * POST /api/auth/logout
 * GET  /api/auth/me
 *
 * LOGIN FLOW — STATE-AWARE
 * ───────────────────────────────────────────────────────────────
 *  1.  Validate email + password fields
 *  2.  Firebase REST API signInWithPassword → idToken
 *  3.  Admin SDK verifyIdToken (checkRevoked=true)
 *  4.  Load RTDB user record
 *  5.  SUSPENDED  → 403 ACCOUNT_SUSPENDED (hard block)
 *  6.  EMAIL_NOT_VERIFIED → 403 EMAIL_NOT_VERIFIED  (soft block)
 *  7.  AWAITING_APPROVAL  → 403 AWAITING_APPROVAL   (soft block)
 *  8.  PENDING (edge case) → 403 PENDING_APPROVAL   (soft block)
 *  9.  Admin mustChangePassword flag → success with flag in response
 * 10.  Record login
 * 11.  Issue httpOnly session cookies + CSRF token
 * 12.  Return custom token + full user shape + mustChangePassword flag
 *
 * EVERY error response includes:
 *   { error, code, hint, userState? }
 * so the frontend can map accurately without guessing.
 * ═══════════════════════════════════════════════════════════════
 */

import axios              from 'axios';
import crypto             from 'crypto';
import { admin, adminDb } from '../../config/firebase.js';
import { STATUS, ROLES }  from '../../config/roles.js';
import { getUserById }    from '../../models/user.js';
import AuditLog           from '../../services/auditLog.js';
import {
  getIp, getUserAgent, mapFirebaseError,
  rGet, rSet, rDel, K, TTL,
} from './authHelpers.js';

/* ── Environment helpers ─────────────────────────────────────── */
const isProd  = () => process.env.NODE_ENV === 'production';
const SESSION = () => isProd() ? '__Host-session' : '__session';

/* ══════════════════════════════════════════════════════════════
   FIREBASE REST SIGN-IN
   Returns { idToken, refreshToken, localId }
   Throws with err.code = 'auth/*' on failure
══════════════════════════════════════════════════════════════ */
const signInWithFirebase = async (email, password) => {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`;
  try {
    const { data } = await axios.post(
      url,
      { email, password, returnSecureToken: true },
      { timeout: 6000 },
    );
    return { idToken: data.idToken, refreshToken: data.refreshToken, localId: data.localId };
  } catch (err) {
    const msg     = err.response?.data?.error?.message ?? err.code ?? '';
    const appErr  = new Error(msg);
    appErr.code   = _restToAuthCode(msg);
    throw appErr;
  }
};

/** Map Firebase REST API error strings → auth/* codes */
const _restToAuthCode = (msg = '') => {
  if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(msg))
    return 'auth/invalid-credential';
  if (msg.includes('USER_DISABLED'))      return 'auth/user-disabled';
  if (msg.includes('TOO_MANY_ATTEMPTS'))  return 'auth/too-many-requests';
  if (msg.includes('INVALID_EMAIL'))      return 'auth/invalid-email';
  return 'auth/unknown';
};

/* ══════════════════════════════════════════════════════════════
   COOKIES
══════════════════════════════════════════════════════════════ */
const setSessionCookies = (res, { idToken, refreshToken, userAgent }) => {
  const base = {
    httpOnly: true,
    secure:   isProd(),
    sameSite: 'strict',
    path:     '/',
    signed:   true,
  };

  // Lightweight UA fingerprint — detects stolen token on different device/browser
  const fp = Buffer.from(userAgent.slice(0, 64)).toString('base64').slice(0, 16);

  res.cookie(SESSION(), `${idToken}|${fp}`, {
    ...base,
    maxAge: 60 * 60 * 1000, // 1 h
  });

  res.cookie('__refresh', refreshToken, {
    ...base,
    path:   '/auth/refresh',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 d
  });

  // CSRF — NOT httpOnly so client JS can read and send it
  const csrf = crypto.randomBytes(24).toString('hex');
  res.cookie('__csrf', csrf, {
    ...base,
    httpOnly: false,
    maxAge:   60 * 60 * 1000,
  });
};

const clearSessionCookies = (res) => {
  const opts = { path: '/', signed: true };
  res.clearCookie(SESSION(), opts);
  res.clearCookie('__refresh', { ...opts, path: '/auth/refresh' });
  res.clearCookie('__csrf',    { ...opts, httpOnly: false });
};

/* ══════════════════════════════════════════════════════════════
   RECORD LOGIN  (fire-and-forget — never blocks response)
══════════════════════════════════════════════════════════════ */
const recordLogin = (uid, ip) => {
  adminDb.ref(`users/${uid}/meta`).update({
    lastLogin: new Date().toISOString(),
    lastIp:    ip,
  }).catch(err => console.warn('[Login] recordLogin failed:', err.message));
};

/* ══════════════════════════════════════════════════════════════
   LOGIN
══════════════════════════════════════════════════════════════ */
export const login = async (req, res) => {
  const { email, password } = req.body;
  const ip        = getIp(req);
  const userAgent = getUserAgent(req);

  /* ── 1. Field validation ──────────────────────────────────── */
  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required.',
      code:  'MISSING_CREDENTIALS',
    });
  }

  const normEmail = email.trim().toLowerCase();

  try {
    /* ── 2. Firebase REST sign-in ─────────────────────────── */
    const { idToken, refreshToken, localId } =
      await signInWithFirebase(normEmail, password);

    /* ── 3. Verify token + check revocation ───────────────── */
    await admin.auth().verifyIdToken(idToken, true);

    /* ── 4. Load RTDB profile ─────────────────────────────── */
    // Try Redis cache first, fall back to RTDB
    let userRecord = null;
    const cached   = await rGet(K.profile(localId));
    if (cached) {
      try { userRecord = JSON.parse(cached); } catch { /* ignore */ }
    }
    if (!userRecord) {
      userRecord = await getUserById(localId);
      // Prime cache for next read
      if (userRecord) {
        rSet(K.profile(localId), JSON.stringify(userRecord), TTL.PROFILE)
          .catch(() => {});
      }
    }

    if (!userRecord) {
      console.error(`[Login] RTDB record missing uid=${localId}`);
      return res.status(500).json({
        error: 'Your account profile could not be loaded. Please contact support.',
        code:  'USER_RECORD_MISSING',
        hint:  'Contact hello@damuchi.app with your email address.',
      });
    }

    const basic = userRecord.basic ?? userRecord; // handle both RTDB shapes

    /* ── 5. SUSPENDED ─────────────────────────────────────── */
    if (basic.status === STATUS.SUSPENDED) {
      AuditLog.record(AuditLog.EVENTS.LOGIN_BLOCKED, {
        userId: localId, ip, userAgent,
        metadata: { reason: 'SUSPENDED', email: normEmail },
      }).catch(() => {});

      return res.status(403).json({
        error:     'Your account has been suspended.',
        code:      'ACCOUNT_SUSPENDED',
        hint:      'Contact hello@damuchi.app for assistance.',
        userState: 'suspended',
      });
    }

    /* ── 6. EMAIL NOT VERIFIED ────────────────────────────── */
    // Non-admins must verify email before proceeding
    if (basic.role !== ROLES.ADMIN && !basic.emailVerified) {
      return res.status(403).json({
        error:     'Please verify your email address before signing in.',
        code:      'EMAIL_NOT_VERIFIED',
        hint:      'Check your inbox for the verification link. Need a new one? Use "Resend" below.',
        userState: 'unverified',
        email:     normEmail, // send back so frontend can prefill resend form
      });
    }

    /* ── 7. AWAITING ADMIN APPROVAL ───────────────────────── */
    // Email verified but admin hasn't approved yet
    if (basic.role !== ROLES.ADMIN && basic.emailVerified && !basic.adminApproved) {
      return res.status(403).json({
        error:     'Your account is pending admin approval.',
        code:      'AWAITING_APPROVAL',
        hint:      'You\'ll receive an email when your account is activated. Usually within 24 hours.',
        userState: 'awaiting',
      });
    }

    /* ── 8. PENDING (edge case — verified + status=pending) ── */
    // Should not happen in normal flow but guard against it
    if (basic.role !== ROLES.ADMIN && basic.status === STATUS.PENDING) {
      return res.status(403).json({
        error:     'Your account setup is not yet complete.',
        code:      'PENDING_ACTIVATION',
        hint:      'Please check your email for a verification link.',
        userState: 'pending',
      });
    }

    /* ── 9. MUST CHANGE PASSWORD (admin temp-pw enforcement) ── */
    const mustChangePassword = !!(basic.mustChangePassword);

    /* ── 10. Record login ─────────────────────────────────── */
    recordLogin(localId, ip); // fire-and-forget

    /* ── 11. Session cookies ──────────────────────────────── */
    setSessionCookies(res, { idToken, refreshToken, userAgent });

    /* ── 12. Custom token for client SDK ──────────────────── */
    const customToken = await admin.auth().createCustomToken(localId);

    /* ── Audit log ────────────────────────────────────────── */
    AuditLog.record(AuditLog.EVENTS.USER_LOGIN, {
      userId:    localId,
      ip,
      userAgent,
      metadata:  { email: normEmail, status: basic.status, role: basic.role, mustChangePassword },
    }).catch(() => {});

    /* ── Response ─────────────────────────────────────────── */
    return res.status(200).json({
      success:            true,
      customToken,
      mustChangePassword, // frontend uses this to redirect → /auth/change-password
      user: {
        uid:               localId,
        email:             basic.email,
        displayName:       basic.displayName,
        role:              basic.role,
        status:            basic.status,
        emailVerified:     basic.emailVerified,
        adminApproved:     basic.adminApproved,
        mustChangePassword,
        permissions:       userRecord.permissions ?? {},
      },
    });

  } catch (err) {
    console.error('[Login] Error:', err.code ?? err.message);

    AuditLog.record(AuditLog.EVENTS.LOGIN_FAILED, {
      ip, userAgent,
      metadata: { email: normEmail, errorCode: err.code },
    }).catch(() => {});

    const mapped = mapFirebaseError(err);
    return res.status(mapped.status).json({
      error: mapped.error,
      code:  mapped.code,
      hint:  err.code === 'auth/too-many-requests'
        ? 'Wait a few minutes or reset your password to unlock your account.'
        : mapped.hint ?? null,
    });
  }
};

/* ══════════════════════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════════════════════ */
export const logout = async (req, res) => {
  try {
    clearSessionCookies(res);

    AuditLog.record(AuditLog.EVENTS.USER_LOGOUT, {
      userId:    req.uid || 'unknown',
      ip:        getIp(req),
      userAgent: getUserAgent(req),
    }).catch(() => {});

    return res.status(200).json({ success: true, message: 'Signed out successfully.' });
  } catch (err) {
    console.error('[Logout]', err.message);
    return res.status(500).json({ error: 'Logout failed.', code: 'LOGOUT_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════
   GET ME — req.user populated by verifyToken middleware
══════════════════════════════════════════════════════════════ */
export const getMe = (req, res) => {
  const { basic, permissions } = req.user ?? {};
  return res.status(200).json({
    uid:               req.uid,
    displayName:       basic?.displayName,
    email:             basic?.email,
    role:              basic?.role,
    status:            basic?.status,
    emailVerified:     basic?.emailVerified,
    adminApproved:     basic?.adminApproved,
    mustChangePassword: basic?.mustChangePassword ?? false,
    permissions:       permissions ?? {},
  });
};