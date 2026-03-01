/**
 * controllers/authController.js
 * ═══════════════════════════════════════════════════════════════════
 * Merged from two auth implementations. Takes the best of both:
 *   — DNS email validation before any Firebase call  (new validator)
 *   — Transaction rollback if registration partially fails
 *   — Firebase REST API login (email+password) via axios
 *   — Secure session cookies + CSRF token on login
 *   — Full audit trail for registration, login, verification
 *   — Role system: always GUEST on register, 2-step upgrade
 *
 * REGISTRATION FLOW
 * ───────────────────────────────────────────────────────────────────
 *  POST /api/auth/register
 *    1. Validate input (fields, format, password strength)
 *    2. validateEmailFull() — format + disposable + DNS MX check
 *    3. checkExistingUser() — prevent duplicate registration
 *    4. admin.auth().createUser() → Firebase Auth
 *    5. createUser() → RTDB + Firestore (role=guest, status=pending)
 *    6. sendVerificationEmail() + PDF attachment
 *    7. On any failure → rollback Firebase Auth + RTDB records
 *
 * LOGIN FLOW
 * ───────────────────────────────────────────────────────────────────
 *  POST /api/auth/login  { email, password }
 *    1. authenticateWithFirebase() → Firebase REST API (idToken)
 *    2. verifyAndValidateToken()   → Admin SDK verify + DB lookup
 *    3. Check account status (suspended / pending / awaiting)
 *    4. establishSecureSession()   → httpOnly cookies + CSRF
 *    5. AuditLog success + recordLogin()
 *
 * EMAIL VERIFY FLOW  (guest upgrade step 1 of 2)
 * ───────────────────────────────────────────────────────────────────
 *  POST /api/auth/verify-email
 *    → consumes oobCode, marks emailVerified=true
 *    → status: pending → awaiting
 *    → added to Firestore approvalQueue
 *    → NOT promoted yet — admin must approve (step 2)
 *
 * ADMIN APPROVE FLOW  (step 2 — adminController.js)
 *  POST /api/admin/users/:uid/approve
 *    → adminApproved=true → promotes guest → user if email verified
 * ═══════════════════════════════════════════════════════════════════
 */

import axios                              from 'axios';
import { admin, db, firebaseAuth }        from '../../config/firebase.js';
import { ref, remove }                    from 'firebase/database';
import { signOut }                        from 'firebase/auth';
import { ROLES, STATUS }                  from '../../config/roles.js';
import {
  createUser, getUserById, recordLogin,
  markEmailVerified,
}                                         from '../../models/user.js';
import VerificationModel                  from '../../models/verificationModel.js';
import { sendVerificationEmail }          from '../../services/emailService.js';
import AuditLog                           from '../../services/auditLog.js';
import {
  validateEmailFull,
  validatePasswordStrength,
  hashString,
}                                         from '../../utils/validator.js';
import {
  handleRegistrationError,
  handleLoginError,
  sendErrorResponse,
  mapFirebaseError,
  getErrorResponse,
}                                         from '../../utils/errorHandler.js';
import {
  createSessionFingerprint,
  generateCSRFToken,
  setSecurityHeaders,
}                                         from '../../utils/security.js';
import { checkExistingUser }              from '../../services/userService.js';

/* ── Helpers ─────────────────────────────────────────────────────── */

/** Extract real client IP, respecting proxy headers */
const getIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
  req.ip ||
  req.connection?.remoteAddress ||
  'unknown';

const getUserAgent = (req) => req.headers['user-agent'] || 'unknown';

/* ══════════════════════════════════════════════════════════════════
   REGISTER
   Always creates as role=guest, status=pending.
   Has full rollback on any partial failure.
   ══════════════════════════════════════════════════════════════════ */
export const register = async (req, res) => {
  // Track created resources so we can roll back on failure
  let firebaseUid = null;

  try {
    const { email, password, displayName, name } = req.body;
    const resolvedName = displayName || name;

    // ── 1. Required fields ─────────────────────────────────────────
    if (!email || !password || !resolvedName) {
      return res.status(400).json({
        error: 'Email, password, and name are required.',
        code:  'MISSING_FIELDS',
      });
    }

    const normalisedEmail = email.trim().toLowerCase();

    // ── 2. Full email validation (format + disposable + DNS MX) ───
    const emailCheck = await validateEmailFull(normalisedEmail);
    if (!emailCheck.valid) {
      return res.status(400).json({
        error: emailCheck.reason,
        code:  emailCheck.code,
        ...(emailCheck.domain && { domain: emailCheck.domain }),
      });
    }

    // ── 3. Password strength ───────────────────────────────────────
    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.valid) {
      return res.status(400).json({
        error:  pwCheck.reason,
        code:   'WEAK_PASSWORD',
        failed: pwCheck.failed,
      });
    }

    // ── 4. Duplicate check ─────────────────────────────────────────
    const existing = await checkExistingUser(normalisedEmail);
    if (existing.exists) {
      return res.status(409).json({
        error: existing.isVerified
          ? 'An account with this email already exists.'
          : 'This email is already registered. Please verify your email.',
        code:  existing.isVerified ? 'EMAIL_EXISTS' : 'PENDING_VERIFICATION',
      });
    }

    // ── 5. Create Firebase Auth user ───────────────────────────────
    const firebaseUser = await admin.auth().createUser({
      email:         normalisedEmail,
      password,
      displayName:   resolvedName,
      emailVerified: false,
    });
    firebaseUid = firebaseUser.uid; // store for rollback

    // ── 6. Create DB user (RTDB + Firestore) ───────────────────────
    await createUser({
      uid:         firebaseUid,
      email:       normalisedEmail,
      displayName: resolvedName,
      ip:          getIp(req),
    });

    // ── 7. Send verification email + PDF ──────────────────────────
    const verificationResult = await sendVerificationEmail({
      userId:  firebaseUid,
      email:   normalisedEmail,
      name:    resolvedName,
      ip:      getIp(req),
      req,
    });

    // ── 8. Security headers ────────────────────────────────────────
    setSecurityHeaders(res);

    // ── 9. Audit (non-fatal, runs after response) ─────────────────
    // Fire-and-forget — don't await in the response path
    AuditLog.record(AuditLog.EVENTS.USER_REGISTERED, {
      userId:    firebaseUid,
      ip:        getIp(req),
      userAgent: getUserAgent(req),
      metadata:  {
        email:        normalisedEmail,
        role:         ROLES.GUEST,
        dnsMethod:    emailCheck.dnsMethod,
        emailDomain:  emailCheck.domain,
      },
    }).catch((e) => console.error('Audit error (register):', e.message));

    return res.status(201).json({
      success:   true,
      message:   'Registration successful. Please check your email to verify your account.',
      nextSteps: ['check_email', 'await_admin_approval'],
      _meta: {
        userId:          firebaseUid,
        role:            ROLES.GUEST,
        status:          STATUS.PENDING,
        emailSent:       true,
        verificationId:  verificationResult?.id,
      },
    });

  } catch (err) {
    // ── ROLLBACK — delete Firebase Auth + RTDB if partially created
    if (firebaseUid) {
      try {
        console.warn(`⚠️  Rolling back registration for uid=${firebaseUid}...`);
        await admin.auth().deleteUser(firebaseUid);
        await remove(ref(db, `users/${firebaseUid}`));
        console.log(`✅ Rollback complete for uid=${firebaseUid}`);
      } catch (rollbackErr) {
        console.error(`❌ Rollback failed for uid=${firebaseUid}:`, rollbackErr.message);
      }
    }

    // Log + audit the failure
    await handleRegistrationError(err, req);

    // Send safe error response
    const { status, message } = getErrorResponse(err);
    return res.status(status).json({
      error: message,
      code:  err.code || 'REGISTRATION_FAILED',
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    });
  }
};

/* ══════════════════════════════════════════════════════════════════
   LOGIN  (email + password via Firebase REST API)
   Returns session cookies + CSRF token.
   ══════════════════════════════════════════════════════════════════ */
export const login = async (req, res) => {
  const { email, password } = req.body;
  const clientIp  = getIp(req);
  const userAgent = getUserAgent(req);

  // ── Input validation ───────────────────────────────────────────
  if (!email || !password) {
    return sendErrorResponse(res, {
      code:    'MISSING_CREDENTIALS',
      message: 'Email and password are required.',
      status:  400,
    });
  }

  const normalisedEmail = email.trim().toLowerCase();

  try {
    // ── 1. Authenticate via Firebase REST API ────────────────────
    const authResult = await authenticateWithFirebase(normalisedEmail, password);

    // ── 2. Verify token + load DB user ───────────────────────────
    const { user, tokenData } = await verifyAndValidateToken(
      authResult.idToken,
      authResult.localId,
    );

    // ── 3. Account status checks ──────────────────────────────────
    const status = user.basic?.status;
    if (status === STATUS.SUSPENDED) {
      return sendErrorResponse(res, {
        code:    'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Contact support.',
        status:  403,
      });
    }

    // Note: pending + awaiting accounts CAN log in — frontend uses
    // status field to show appropriate onboarding UI to the user.

    // ── 4. Record login metadata ──────────────────────────────────
    await recordLogin(authResult.localId, clientIp);

    // ── 5. Establish secure session cookies + CSRF ────────────────
    establishSecureSession(res, {
      idToken:      authResult.idToken,
      refreshToken: authResult.refreshToken,
      userId:       authResult.localId,
      userAgent,
    });

    // ── 6. Audit success ──────────────────────────────────────────
    AuditLog.record(AuditLog.EVENTS.USER_LOGIN, {
      userId:    authResult.localId,
      ip:        clientIp,
      userAgent,
      metadata:  { email: normalisedEmail },
    }).catch((e) => console.error('Audit error (login):', e.message));

    // ── 7. Response ───────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      user: {
        uid:           authResult.localId,
        email:         user.basic?.email,
        displayName:   user.basic?.displayName,
        role:          user.basic?.role,
        status:        user.basic?.status,
        emailVerified: user.basic?.emailVerified,
        adminApproved: user.basic?.adminApproved,
        permissions:   user.permissions,
      },
      _meta: {
        authTime:     new Date().toISOString(),
      },
    });

  } catch (err) {
    await handleLoginError(err, {
      email:  normalisedEmail,
      ip:     clientIp,
      userAgent,
    });
    sendErrorResponse(res, err);
  }
};

/* ══════════════════════════════════════════════════════════════════
   VERIFY EMAIL  (guest upgrade step 1 of 2)
   pending → awaiting + added to Firestore approvalQueue
   ══════════════════════════════════════════════════════════════════ */
export const verifyEmail = async (req, res) => {
  const { oobCode, uid, email } = req.body;

  if (!oobCode || !uid || !email) {
    return res.status(400).json({
      error: 'Missing verification parameters.',
      code:  'INVALID_PARAMS',
    });
  }

  // Idempotency lock — prevents double-consumption on rapid re-submits
  const lockKey = `verify-${uid}-${oobCode}`;
  if (verifyLocks.has(lockKey)) {
    return res.status(409).json({ code: 'VERIFICATION_IN_PROGRESS' });
  }
  verifyLocks.set(lockKey, Date.now());

  try {
    // ── Already verified? ─────────────────────────────────────────
    const fbUser = await admin.auth().getUser(uid);
    if (fbUser.emailVerified) {
      return res.status(200).json({
        success:         true,
        alreadyVerified: true,
        message:         'Your email is already verified.',
      });
    }

    // ── Validate oobCode token ────────────────────────────────────
    const tokenHash = await hashString(oobCode);
    const record    = await VerificationModel.findByToken(tokenHash);

    if (!record) {
      return res.status(404).json({ error: 'Invalid verification link.', code: 'INVALID_TOKEN' });
    }
    if (record.consumed) {
      return res.status(410).json({ error: 'This link has already been used.', code: 'TOKEN_CONSUMED' });
    }
    if (new Date(record.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'This link has expired.', code: 'TOKEN_EXPIRED' });
    }

    // ── Consume token + update Firebase Auth ──────────────────────
    await VerificationModel.markAsConsumed(record.id);
    await admin.auth().updateUser(uid, { emailVerified: true });

    // ── Update RTDB + Firestore — may trigger guest → user ────────
    const { nowAwaiting } = await markEmailVerified(uid);

    AuditLog.record(AuditLog.EVENTS.EMAIL_VERIFICATION, {
      userId:    uid,
      ip:        getIp(req),
      userAgent: getUserAgent(req),
      metadata:  { nowAwaiting },
    }).catch((e) => console.error('Audit error (verify):', e.message));

    return res.status(200).json({
      success:  true,
      status:   nowAwaiting ? STATUS.AWAITING : STATUS.ACTIVE,
      message:  nowAwaiting
        ? 'Email verified! Your account is awaiting admin approval.'
        : 'Email verified and account activated.',
    });

  } catch (err) {
    console.error('verifyEmail error:', err);
    return res.status(500).json({ error: 'Verification failed.', code: 'VERIFY_FAILED' });
  } finally {
    verifyLocks.delete(lockKey);
  }
};

/* ══════════════════════════════════════════════════════════════════
   RESEND VERIFICATION EMAIL
   Rate limited: 1 per 2 minutes per email address
   ══════════════════════════════════════════════════════════════════ */
export const resendVerification = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.', code: 'MISSING_FIELDS' });
  }

  const normalised = email.trim().toLowerCase();

  // Basic format check before hitting Firebase
  const emailCheck = await validateEmailFull(normalised);
  if (!emailCheck.valid) {
    return res.status(400).json({ error: emailCheck.reason, code: emailCheck.code });
  }

  // Rate limit check
  const coolKey = `resend:${normalised}`;
  const last    = cooldowns.get(coolKey);
  if (last && Date.now() - last < 2 * 60 * 1000) {
    return res.status(429).json({
      error: 'Please wait 2 minutes before requesting another verification email.',
      code:  'RATE_LIMITED',
    });
  }

  try {
    const fbUser = await admin.auth().getUserByEmail(normalised);

    if (fbUser.emailVerified) {
      return res.status(200).json({ message: 'Email already verified.', code: 'ALREADY_VERIFIED' });
    }

    await sendVerificationEmail({
      userId:   fbUser.uid,
      email:    normalised,
      name:     fbUser.displayName || normalised.split('@')[0],
      ip:       getIp(req),
      req,
      isResend: true,
    });

    cooldowns.set(coolKey, Date.now());

    AuditLog.record(AuditLog.EVENTS.EMAIL_VERIFICATION_RESEND, {
      userId:    fbUser.uid,
      ip:        getIp(req),
      userAgent: getUserAgent(req),
    }).catch((e) => console.error('Audit error (resend):', e.message));

    return res.status(200).json({ message: 'Verification email sent.', code: 'SENT' });

  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      cooldowns.set(coolKey, Date.now()); // prevent enumeration timing attack
      return res.status(200).json({
        message: 'If this email is registered you will receive a verification email.',
        code:    'POTENTIALLY_SENT',
      });
    }
    console.error('resendVerification error:', err);
    return res.status(500).json({ error: 'Failed to send verification email.', code: 'SERVER_ERROR' });
  }
};

/* ══════════════════════════════════════════════════════════════════
   LOGOUT
   Clears session cookies. Firebase token invalidation is client-side.
   ══════════════════════════════════════════════════════════════════ */
export const logout = async (req, res) => {
  try {
    // Attempt Firebase client SDK signout (best effort)
    if (firebaseAuth) {
      await signOut(firebaseAuth).catch(() => {});
    }

    const isProduction  = process.env.NODE_ENV === 'production';
    const sessionName   = isProduction ? '__Host-session' : '__session';

    res.clearCookie(sessionName, { path: '/' });
    res.clearCookie('__refresh',  { path: '/auth/refresh' });
    res.clearCookie('__csrf',     { path: '/' });

    AuditLog.record('USER_LOGOUT', {
      userId:    req.uid || 'unknown',
      ip:        getIp(req),
      userAgent: getUserAgent(req),
    }).catch(() => {});

    return res.status(200).json({ success: true, message: 'Logged out successfully.' });

  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Logout failed.', code: 'LOGOUT_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════════
   GET ME  — current session user info
   ══════════════════════════════════════════════════════════════════ */
export const getMe = (req, res) => {
  const { uid, basic, permissions } = req.user;
  return res.status(200).json({
    uid:           uid || req.uid,
    displayName:   basic?.displayName,
    email:         basic?.email,
    role:          basic?.role,
    status:        basic?.status,
    emailVerified: basic?.emailVerified,
    adminApproved: basic?.adminApproved,
    permissions,
  });
};

/* ══════════════════════════════════════════════════════════════════
   PRIVATE HELPERS
   ══════════════════════════════════════════════════════════════════ */

/**
 * Authenticates email + password against Firebase REST API.
 * Returns idToken, refreshToken, localId on success.
 * Throws a mapped error on failure.
 *
 * Uses axios with a 5s timeout to prevent hanging requests.
 */
async function authenticateWithFirebase(email, password) {
  const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;

  try {
    const response = await Promise.race([
      axios.post(endpoint, { email, password, returnSecureToken: true }, { timeout: 5000 }),
      new Promise((_, reject) =>
        setTimeout(() => {
          const err    = new Error('Firebase authentication timed out');
          err.code     = 'NETWORK_ERROR';
          err.status   = 503;
          reject(err);
        }, 5500),
      ),
    ]);

    return {
      idToken:       response.data.idToken,
      refreshToken:  response.data.refreshToken,
      localId:       response.data.localId,
      emailVerified: response.data.emailVerified,
    };

  } catch (err) {
    if (err.code === 'NETWORK_ERROR') throw err;

    // Map Firebase REST error → application error code
    const mapped  = mapFirebaseError(err);
    const appErr  = new Error(mapped.message);
    appErr.code   = mapped.code;
    appErr.status = mapped.status;
    throw appErr;
  }
}

/**
 * Verifies Firebase ID token with Admin SDK and loads the DB user record.
 * Checks email_verified and token/user UID match.
 *
 * @param {string} idToken
 * @param {string} expectedUid
 * @returns {Promise<{ user: Object, tokenData: Object }>}
 */
async function verifyAndValidateToken(idToken, expectedUid) {
  let decoded;
  try {
    // checkRevoked=true ensures revoked tokens are rejected
    decoded = await admin.auth().verifyIdToken(idToken, true);
  } catch (err) {
    const mapped  = mapFirebaseError(err);
    const appErr  = new Error(mapped.message);
    appErr.code   = mapped.code;
    appErr.status = mapped.status;
    throw appErr;
  }

  // UID must match what Firebase returned in sign-in response
  if (decoded.uid !== expectedUid) {
    const err    = new Error('Token/user identity mismatch');
    err.code     = 'TOKEN_MISMATCH';
    err.status   = 403;
    throw err;
  }

  // Load DB user record (RTDB — fast path)
  const user = await getUserWithTimeout(expectedUid);
  return { user, tokenData: decoded };
}

/**
 * Loads a user from RTDB with a 3s timeout.
 * Throws USER_NOT_FOUND if record is missing.
 */
async function getUserWithTimeout(uid) {
  const user = await Promise.race([
    getUserById(uid),
    new Promise((_, reject) =>
      setTimeout(() => {
        const err  = new Error('Database lookup timed out');
        err.code   = 'DATABASE_TIMEOUT';
        err.status = 503;
        reject(err);
      }, 3000),
    ),
  ]);

  if (!user) {
    const err  = new Error('User account not found in database');
    err.code   = 'USER_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  return user;
}

/**
 * Sets secure httpOnly session cookies + CSRF token on the response.
 * Cookie names use __Host- prefix in production for extra security.
 *
 * Cookies set:
 *   __Host-session / __session  — idToken + fingerprint (1h, httpOnly)
 *   __refresh                   — refreshToken (30d, httpOnly, /auth/refresh)
 *   __csrf                      — CSRF token (1h, NOT httpOnly — readable by JS)
 */
function establishSecureSession(res, { idToken, refreshToken, userId, userAgent }) {
  const isProduction      = process.env.NODE_ENV === 'production';
  const fingerprint       = createSessionFingerprint(userAgent);
  const csrfToken         = generateCSRFToken();
  const sessionCookieName = isProduction ? '__Host-session' : '__session';

  const base = {
    httpOnly: true,
    secure:   isProduction,
    sameSite: 'strict',
    path:     '/',
    signed:   true,
    ...(isProduction && process.env.COOKIE_DOMAIN
        ? { domain: process.env.COOKIE_DOMAIN }
        : {}),
  };

  // Session token (1 hour)
  res.cookie(sessionCookieName, `${idToken}|${fingerprint}`, {
    ...base,
    maxAge: 60 * 60 * 1000,
  });

  // Refresh token (30 days, restricted to /auth/refresh path)
  res.cookie('__refresh', refreshToken, {
    ...base,
    path:   '/auth/refresh',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  // CSRF token — NOT httpOnly so frontend JS can read + send in headers
  res.cookie('__csrf', csrfToken, {
    ...base,
    httpOnly: false,
    maxAge:   60 * 60 * 1000,
  });

  // Extra security headers
  res.setHeader('X-Content-Type-Options',    'nosniff');
  res.setHeader('X-Frame-Options',           'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
}

/* ── Module-level maps (replace with Redis in production) ────────── */
const verifyLocks = new Map();
const cooldowns   = new Map();

// Periodically clean up stale lock/cooldown entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of verifyLocks) {
    if (now - ts > 60_000) verifyLocks.delete(key);  // 1 min max lock
  }
  for (const [key, ts] of cooldowns) {
    if (now - ts > 3 * 60_000) cooldowns.delete(key); // 3 min max cooldown
  }
}, 5 * 60_000); // run every 5 minutes