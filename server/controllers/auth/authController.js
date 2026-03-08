/**
 * controllers/authController.js
 * ═══════════════════════════════════════════════════════════════════
 * All session-lifecycle and authentication operations.
 * "Getting into and out of the system, and proving who you are."
 *
 * ROUTES HANDLED
 * ───────────────────────────────────────────────────────────────────
 *  POST /api/auth/register             — create guest account
 *  POST /api/auth/login                — authenticate + issue session
 *  POST /api/auth/logout               — clear session cookies
 *  POST /api/auth/verify-email         — consume oobCode (step 1 of 2)
 *  POST /api/auth/resend-verification  — re-send verification email
 *  GET  /api/auth/me                   — current session user
 *  POST /api/auth/forgot-password      — generate + send reset link
 *  POST /api/auth/verify-reset-link    — validate oobCode before form
 *  POST /api/auth/reset-password       — consume oobCode + set password
 *
 * WHAT DOES NOT BELONG HERE (→ userService.js + /api/users/*)
 * ───────────────────────────────────────────────────────────────────
 *  changePassword   — signed-in user changing their own password
 *  updateProfile    — signed-in user updating displayName / email
 *  deleteAccount    — signed-in user deleting their own account
 *
 * REGISTRATION FLOW
 * ───────────────────────────────────────────────────────────────────
 *  1. Validate fields, email format+DNS, password strength
 *  2. checkExistingUser() — block duplicates before any Firebase write
 *  3. admin.auth().createUser() → Firebase Auth
 *  4. createUser()  → RTDB + Firestore (role=guest, status=pending)
 *  5. sendVerificationEmail()
 *  6. On any failure → rollback Firebase Auth + RTDB
 *
 * LOGIN FLOW
 * ───────────────────────────────────────────────────────────────────
 *  1. authenticateWithFirebase() → Firebase REST API → idToken
 *  2. verifyAndValidateToken()   → Admin SDK verify + DB lookup
 *  3. Check account not suspended
 *  4. recordLogin()              → update lastLogin / IP in RTDB
 *  5. establishSecureSession()   → httpOnly cookies + CSRF token
 *
 * PASSWORD RESET FLOW  (user is logged out)
 * ───────────────────────────────────────────────────────────────────
 *  forgotPassword    — generate Firebase link → email it
 *  verifyResetLink   — validate oobCode is still valid (before form)
 *  resetPassword     — consume oobCode → set new password
 *
 * EMAIL VERIFY FLOW  (guest upgrade step 1 of 2)
 * ───────────────────────────────────────────────────────────────────
 *  verifyEmail       — pending → awaiting + added to approvalQueue
 *  [admin approves]  — awaiting → active (adminController.js)
 * ═══════════════════════════════════════════════════════════════════
 */

import axios                           from 'axios';
import { admin, adminDb, firebaseAuth } from '../../config/firebase.js';
import { signOut }                     from 'firebase/auth';
import { ROLES, STATUS }               from '../../config/roles.js';
import {
  createUser, getUserById, recordLogin,
  markEmailVerified,
}                                      from '../../models/user.js';
import VerificationModel               from '../../models/verificationModel.js';
import { sendVerificationEmail, sendEmail } from '../../services/emailService.js';
import AuditLog                        from '../../services/auditLog.js';
import {
  validateEmailFull,
  validatePasswordStrength,
  hashString,
}                                      from '../../utils/validator.js';
import {
  handleRegistrationError,
  handleLoginError,
  sendErrorResponse,
  mapFirebaseError,
  getErrorResponse,
}                                      from '../../utils/errorHandler.js';
import {
  createSessionFingerprint,
  generateCSRFToken,
  setSecurityHeaders,
}                                      from '../../utils/security.js';
import { checkExistingUser }           from '../../controllers/auth/userController.js';

/* ── Shared request helpers ──────────────────────────────────────── */
const getIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
  req.ip ||
  req.connection?.remoteAddress ||
  'unknown';

const getUserAgent = (req) => req.headers['user-agent'] || 'unknown';

/* ── Module-level maps (replace with Redis in production) ────────── */
const verifyLocks  = new Map(); // email verify idempotency
const resetLocks   = new Map(); // reset-link verify idempotency
const cooldowns    = new Map(); // resend-verification rate limit

// Clean up stale entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [k, ts] of verifyLocks) if (now - ts > 60_000)      verifyLocks.delete(k);
  for (const [k, ts] of resetLocks)  if (now - ts > 60_000)      resetLocks.delete(k);
  for (const [k, ts] of cooldowns)   if (now - ts > 3 * 60_000)  cooldowns.delete(k);
}, 5 * 60_000);

/* ══════════════════════════════════════════════════════════════════
   REGISTER
   Always creates as role=guest, status=pending.
   Full rollback on any partial failure.
   ══════════════════════════════════════════════════════════════════ */
export const register = async (req, res) => {
  let firebaseUid = null; // track for rollback

  try {
    const { email, password, displayName, name } = req.body;
    const resolvedName = (displayName || name)?.trim();

    // ── 1. Required fields ─────────────────────────────────────────
    if (!email || !password || !resolvedName) {
      return res.status(400).json({
        error: 'Email, password, and name are required.',
        code:  'MISSING_FIELDS',
      });
    }

    const normalisedEmail = email.trim().toLowerCase();

    // ── 2. Email — format + disposable domain + DNS MX ─────────────
    const emailCheck = await validateEmailFull(normalisedEmail);
    if (!emailCheck.valid) {
      return res.status(400).json({
        error:  emailCheck.reason,
        code:   emailCheck.code,
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

    // ── 4. Duplicate check (Firebase Auth is source of truth) ──────
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
    firebaseUid = firebaseUser.uid;

    // ── 6. Write DB records (RTDB + Firestore) ─────────────────────
    await createUser({
      uid:         firebaseUid,
      email:       normalisedEmail,
      displayName: resolvedName,
      ip:          getIp(req),
    });

    // ── 7. Send verification email ─────────────────────────────────
    const verificationResult = await sendVerificationEmail({
      userId: firebaseUid,
      email:  normalisedEmail,
      name:   resolvedName,
      ip:     getIp(req),
      req,
    });

    // ── 8. Security headers ────────────────────────────────────────
    setSecurityHeaders(res);

    // ── 9. Audit — fire-and-forget ────────────────────────────────
    AuditLog.record(AuditLog.EVENTS.USER_REGISTERED, {
      userId:    firebaseUid,
      ip:        getIp(req),
      userAgent: getUserAgent(req),
      metadata:  {
        email:       normalisedEmail,
        role:        ROLES.GUEST,
        dnsMethod:   emailCheck.dnsMethod,
        emailDomain: emailCheck.domain,
      },
    }).catch((e) => console.error('Audit error (register):', e.message));

    return res.status(201).json({
      success:   true,
      message:   'Registration successful. Please check your email to verify your account.',
      nextSteps: ['check_email', 'await_admin_approval'],
      _meta: {
        userId:         firebaseUid,
        role:           ROLES.GUEST,
        status:         STATUS.PENDING,
        emailSent:      true,
        verificationId: verificationResult?.id,
      },
    });

  } catch (err) {
    // ── ROLLBACK ──────────────────────────────────────────────────
    if (firebaseUid) {
      try {
        console.warn(`⚠️  Rolling back registration for uid=${firebaseUid}...`);
        await admin.auth().deleteUser(firebaseUid);
        await adminDb.ref(`users/${firebaseUid}`).remove();
        console.log(`✅ Rollback complete for uid=${firebaseUid}`);
      } catch (rollbackErr) {
        console.error(`❌ Rollback failed for uid=${firebaseUid}:`, rollbackErr.message);
      }
    }

    await handleRegistrationError(err, req);
    const { status, message } = getErrorResponse(err);
    return res.status(status).json({
      error: message,
      code:  err.code || 'REGISTRATION_FAILED',
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    });
  }
};

/* ══════════════════════════════════════════════════════════════════
   LOGIN  — email + password via Firebase REST API
   Returns idToken in session cookies + CSRF token.
   Suspended accounts are blocked; pending/awaiting can log in
   (frontend uses status field to show appropriate onboarding UI).
   ══════════════════════════════════════════════════════════════════ */
export const login = async (req, res) => {
  const { email, password } = req.body;
  const clientIp  = getIp(req);
  const userAgent = getUserAgent(req);

  if (!email || !password) {
    return sendErrorResponse(res, {
      code:    'MISSING_CREDENTIALS',
      message: 'Email and password are required.',
      status:  400,
    });
  }

  const normalisedEmail = email.trim().toLowerCase();

  try {
    // ── 1. Firebase REST API sign-in ──────────────────────────────
    const authResult = await authenticateWithFirebase(normalisedEmail, password);

    // ── 2. Verify token + load DB user record ─────────────────────
    const { user } = await verifyAndValidateToken(authResult.idToken, authResult.localId);

    // ── 3. Block suspended accounts ───────────────────────────────
    if (user.basic?.status === STATUS.SUSPENDED) {
      return sendErrorResponse(res, {
        code:    'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Contact support.',
        status:  403,
      });
    }

    // ── 4. Record login (lastLogin, loginCount, IP history) ────────
    await recordLogin(authResult.localId, clientIp);

    // ── 5. Issue session cookies + CSRF ───────────────────────────
    establishSecureSession(res, {
      idToken:      authResult.idToken,
      refreshToken: authResult.refreshToken,
      userId:       authResult.localId,
      userAgent,
    });

    // ── 6. Audit — fire-and-forget ────────────────────────────────
    AuditLog.record(AuditLog.EVENTS.USER_LOGIN, {
      userId:    authResult.localId,
      ip:        clientIp,
      userAgent,
      metadata:  { email: normalisedEmail, status: user.basic?.status },
    }).catch((e) => console.error('Audit error (login):', e.message));

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
      _meta: { authTime: new Date().toISOString() },
    });

  } catch (err) {
    await handleLoginError(err, { email: normalisedEmail, ip: clientIp, userAgent });
    sendErrorResponse(res, err);
  }
};

/* ══════════════════════════════════════════════════════════════════
   LOGOUT
   Clears all three session cookies. Firebase token invalidation
   happens client-side — we can't un-issue a token server-side
   without revoking all sessions (which would log out all devices).
   ══════════════════════════════════════════════════════════════════ */
export const logout = async (req, res) => {
  try {
    // Best-effort Firebase client signout — non-fatal
    if (firebaseAuth) signOut(firebaseAuth).catch(() => {});

    const prod        = process.env.NODE_ENV === 'production';
    const sessionName = prod ? '__Host-session' : '__session';

    res.clearCookie(sessionName, { path: '/' });
    res.clearCookie('__refresh',  { path: '/auth/refresh' });
    res.clearCookie('__csrf',     { path: '/' });

    AuditLog.record(AuditLog.EVENTS.USER_LOGOUT, {
      userId:    req.uid || 'unknown',
      ip:        getIp(req),
      userAgent: getUserAgent(req),
    }).catch(() => {});

    return res.status(200).json({ success: true, message: 'Logged out successfully.' });

  } catch (err) {
    console.error('Logout error:', err.message);
    return res.status(500).json({ error: 'Logout failed.', code: 'LOGOUT_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════════
   GET ME  — returns current session user from the RTDB record
   (populated on req.user by the verifyToken middleware)
   ══════════════════════════════════════════════════════════════════ */
export const getMe = (req, res) => {
  const { basic, permissions } = req.user;
  return res.status(200).json({
    uid:           req.uid,
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
   VERIFY EMAIL  — guest upgrade step 1 of 2
   pending → awaiting + added to Firestore approvalQueue
   Step 2: admin approves via POST /api/admin/users/:uid/approve
   ══════════════════════════════════════════════════════════════════ */
export const verifyEmail = async (req, res) => {
  const { oobCode, uid, email } = req.body;

  if (!oobCode || !uid || !email) {
    return res.status(400).json({ error: 'Missing verification parameters.', code: 'INVALID_PARAMS' });
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

    // ── Validate our verification token record ────────────────────
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

    // ── Consume token + mark verified in Firebase Auth ────────────
    await VerificationModel.markAsConsumed(record.id);
    await admin.auth().updateUser(uid, { emailVerified: true });

    // ── Update RTDB + Firestore (pending → awaiting) ──────────────
    const { nowAwaiting } = await markEmailVerified(uid);

    AuditLog.record(AuditLog.EVENTS.EMAIL_VERIFICATION, {
      userId:    uid,
      ip:        getIp(req),
      userAgent: getUserAgent(req),
      metadata:  { nowAwaiting },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      status:  nowAwaiting ? STATUS.AWAITING : STATUS.ACTIVE,
      message: nowAwaiting
        ? 'Email verified! Your account is awaiting admin approval.'
        : 'Email verified and account activated.',
    });

  } catch (err) {
    console.error('verifyEmail error:', err.message);
    return res.status(500).json({ error: 'Verification failed.', code: 'VERIFY_FAILED' });
  } finally {
    verifyLocks.delete(lockKey);
  }
};

/* ══════════════════════════════════════════════════════════════════
   RESEND VERIFICATION EMAIL
   Rate-limited: 1 per 2 minutes per email address.
   Anti-enumeration: always returns 200 whether user exists or not.
   ══════════════════════════════════════════════════════════════════ */
export const resendVerification = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.', code: 'MISSING_FIELDS' });
  }

  const normalised = email.trim().toLowerCase();

  // Light format check before touching Firebase
  const emailCheck = await validateEmailFull(normalised);
  if (!emailCheck.valid) {
    return res.status(400).json({ error: emailCheck.reason, code: emailCheck.code });
  }

  // Rate limit — 2 minutes between resends per email
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
    }).catch(() => {});

    return res.status(200).json({ message: 'Verification email sent.', code: 'SENT' });

  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      cooldowns.set(coolKey, Date.now()); // prevent timing-based enumeration
      return res.status(200).json({
        message: 'If this email is registered you will receive a verification email.',
        code:    'POTENTIALLY_SENT',
      });
    }
    console.error('resendVerification error:', err.message);
    return res.status(500).json({ error: 'Failed to send verification email.', code: 'SERVER_ERROR' });
  }
};

/* ══════════════════════════════════════════════════════════════════
   FORGOT PASSWORD
   POST /api/auth/forgot-password
   User is NOT logged in. Generates a Firebase password reset link
   and emails it. Anti-enumeration: always returns 200.
   ══════════════════════════════════════════════════════════════════ */
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required.', code: 'MISSING_FIELDS' });
  }

  const normalised = email.trim().toLowerCase();
  const ip         = getIp(req);
  const userAgent  = getUserAgent(req);

  // Always return this regardless of whether the user exists
  const safeResponse = () =>
    res.status(200).json({
      message: 'If this email is registered you will receive a reset link shortly.',
      code:    'RESET_EMAIL_SENT',
    });

  try {
    const fbUser = await admin.auth().getUserByEmail(normalised);

    const resetLink = await admin.auth().generatePasswordResetLink(normalised, {
      url:             `${process.env.FRONTEND_URL}/auth/reset-password?uid=${fbUser.uid}&email=${encodeURIComponent(normalised)}`,
      handleCodeInApp: true,
    });

    // Extract oobCode and build a cleaner frontend URL
    const oobCode          = new URL(resetLink).searchParams.get('oobCode');
    const frontendLink     = oobCode
      ? `${process.env.FRONTEND_URL}/auth/reset-password?oobCode=${encodeURIComponent(oobCode)}&uid=${fbUser.uid}&email=${encodeURIComponent(normalised)}`
      : resetLink;

    await sendEmail({
      to:      normalised,
      subject: 'Reset your Damuchi password',
      html:    _passwordResetHtml({
        name:      fbUser.displayName || normalised.split('@')[0],
        resetLink: frontendLink,
        ip,
      }),
    });

    AuditLog.record(AuditLog.EVENTS.PASSWORD_RESET_REQUESTED, {
      userId:    fbUser.uid,
      ip,
      userAgent,
      metadata:  { email: normalised },
    }).catch(() => {});

    return safeResponse();

  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      AuditLog.record(AuditLog.EVENTS.PASSWORD_RESET_ATTEMPT_UNKNOWN_EMAIL, {
        ip,
        userAgent,
        metadata: { email: normalised },
      }).catch(() => {});
      return safeResponse();
    }

    console.error('[forgotPassword]', err.message);
    AuditLog.record(AuditLog.EVENTS.PASSWORD_RESET_FAILURE, {
      ip,
      userAgent,
      metadata: { email: normalised, errorCode: err.code },
    }).catch(() => {});

    return res.status(500).json({ error: 'Failed to process request. Please try again.', code: 'SERVER_ERROR' });
  }
};

/* ══════════════════════════════════════════════════════════════════
   VERIFY RESET LINK
   POST /api/auth/verify-reset-link
   Frontend calls this when the user lands on the reset page to confirm
   the oobCode is still valid before rendering the new-password form.
   Idempotency lock prevents parallel duplicate calls.
   ══════════════════════════════════════════════════════════════════ */
export const verifyResetLink = async (req, res) => {
  const { oobCode, uid, email } = req.body;

  if (!oobCode || !uid || !email) {
    return res.status(400).json({
      error:       'Missing reset link parameters.',
      code:        'INVALID_RESET_PARAMS',
      userMessage: 'The password reset link is incomplete. Please use the full link from your email.',
    });
  }

  const lockKey = `reset-verify-${uid}-${oobCode}`;
  if (resetLocks.has(lockKey)) {
    return res.status(409).json({ code: 'RESET_VERIFICATION_IN_PROGRESS' });
  }
  resetLocks.set(lockKey, Date.now());

  try {
    // ── 1. Firebase validates the oobCode ─────────────────────────
    try {
      await admin.auth().verifyPasswordResetCode(oobCode);
    } catch (err) {
      if (err.code === 'auth/expired-action-code') {
        return res.status(410).json({
          error:       'This link has expired.',
          code:        'EXPIRED_RESET_CODE',
          userMessage: 'Please request a new password reset link.',
        });
      }
      if (err.code === 'auth/invalid-action-code') {
        return res.status(404).json({
          error:       'Invalid or already-used link.',
          code:        'INVALID_RESET_CODE',
          userMessage: 'This password reset link is invalid or has already been used.',
        });
      }
      throw err;
    }

    // ── 2. Confirm uid matches the email in the link ──────────────
    let userRecord;
    try {
      userRecord = await admin.auth().getUser(uid);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        return res.status(404).json({ error: 'Account not found.', code: 'USER_NOT_FOUND' });
      }
      throw err;
    }

    if (userRecord.email.toLowerCase() !== email.toLowerCase().trim()) {
      return res.status(400).json({ error: 'Email mismatch in reset link.', code: 'EMAIL_MISMATCH' });
    }

    AuditLog.record(AuditLog.EVENTS.PASSWORD_RESET_LINK_VERIFIED, {
      userId:    uid,
      ip:        getIp(req),
      userAgent: getUserAgent(req),
      metadata:  { email: userRecord.email },
    }).catch(() => {});

    return res.status(200).json({ success: true, message: 'Reset link is valid.', uid, email: userRecord.email });

  } catch (err) {
    console.error('[verifyResetLink]', err.message);
    return res.status(500).json({ error: 'Verification failed.', code: 'SERVER_ERROR' });
  } finally {
    resetLocks.delete(lockKey);
  }
};

/* ══════════════════════════════════════════════════════════════════
   RESET PASSWORD
   POST /api/auth/reset-password
   Consumes the oobCode and sets the new password.
   Revokes all existing sessions after success so stolen tokens
   can't be reused.
   ══════════════════════════════════════════════════════════════════ */
export const resetPassword = async (req, res) => {
  const { oobCode, newPassword } = req.body;
  const ip        = getIp(req);
  const userAgent = getUserAgent(req);

  if (!oobCode || !newPassword) {
    return res.status(400).json({ error: 'Reset code and new password are required.', code: 'MISSING_FIELDS' });
  }

  const pwCheck = validatePasswordStrength(newPassword);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.reason, code: 'WEAK_PASSWORD', failed: pwCheck.failed });
  }

  try {
    // ── 1. Verify oobCode (returns the email it was issued for) ────
    const email = await admin.auth().verifyPasswordResetCode(oobCode);

    // ── 2. Commit the new password ─────────────────────────────────
    await admin.auth().confirmPasswordReset(oobCode, newPassword);

    // ── 3. Look up the user ────────────────────────────────────────
    const fbUser = await admin.auth().getUserByEmail(email);

    // ── 4. Revoke all sessions (invalidates all issued tokens) ─────
    await admin.auth().revokeRefreshTokens(fbUser.uid);

    // ── 5. Record timestamp in RTDB — non-fatal ───────────────────
    adminDb.ref(`users/${fbUser.uid}/security`).update({
      lastPasswordChange: new Date().toISOString(),
    }).catch(() => {});

    AuditLog.record(AuditLog.EVENTS.PASSWORD_RESET_COMPLETED, {
      userId:    fbUser.uid,
      ip,
      userAgent,
      metadata:  { email },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. Please sign in with your new password.',
      code:    'PASSWORD_RESET_SUCCESS',
    });

  } catch (err) {
    AuditLog.record(AuditLog.EVENTS.PASSWORD_RESET_FAILED, {
      ip,
      userAgent,
      metadata: { errorCode: err.code },
    }).catch(() => {});

    const errorMap = {
      'auth/expired-action-code': [410, 'Reset link has expired. Please request a new one.',  'EXPIRED_LINK'],
      'auth/invalid-action-code': [400, 'Invalid or already-used reset link.',                 'INVALID_LINK'],
      'auth/user-disabled':       [403, 'Account disabled. Contact support.',                  'ACCOUNT_DISABLED'],
      'auth/user-not-found':      [404, 'Account not found.',                                  'USER_NOT_FOUND'],
      'auth/weak-password':       [400, 'Password too weak.',                                  'WEAK_PASSWORD'],
    };
    const [status, message, code] = errorMap[err.code] || [500, 'Password reset failed.', 'RESET_FAILED'];
    return res.status(status).json({ error: message, code });
  }
};

/* ══════════════════════════════════════════════════════════════════
   PRIVATE HELPERS
   ══════════════════════════════════════════════════════════════════ */

/**
 * Signs in via Firebase REST API (email + password).
 * Returns { idToken, refreshToken, localId, emailVerified }.
 * Uses axios with a 5 s timeout. Maps Firebase error codes to app codes.
 */
async function authenticateWithFirebase(email, password) {
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`;

  try {
    const response = await Promise.race([
      axios.post(endpoint, { email, password, returnSecureToken: true }, { timeout: 5000 }),
      new Promise((_, reject) =>
        setTimeout(() => {
          const err  = new Error('Firebase authentication timed out');
          err.code   = 'NETWORK_ERROR';
          err.status = 503;
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
    const mapped  = mapFirebaseError(err);
    const appErr  = new Error(mapped.message);
    appErr.code   = mapped.code;
    appErr.status = mapped.status;
    throw appErr;
  }
}

/**
 * Verifies an idToken with the Admin SDK and loads the RTDB user record.
 * Validates that the token UID matches the expected UID.
 * checkRevoked=true rejects tokens that have been revoked server-side.
 */
async function verifyAndValidateToken(idToken, expectedUid) {
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken, true);
  } catch (err) {
    const mapped  = mapFirebaseError(err);
    const appErr  = new Error(mapped.message);
    appErr.code   = mapped.code;
    appErr.status = mapped.status;
    throw appErr;
  }

  if (decoded.uid !== expectedUid) {
    const err  = new Error('Token/user identity mismatch');
    err.code   = 'TOKEN_MISMATCH';
    err.status = 403;
    throw err;
  }

  const user = await _getUserWithTimeout(expectedUid);
  return { user, tokenData: decoded };
}

/**
 * RTDB lookup with 3 s timeout. Throws USER_NOT_FOUND if missing.
 */
async function _getUserWithTimeout(uid) {
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
 * Sets three secure cookies on the response:
 *   __Host-session / __session  — idToken + UA fingerprint  (1 h, httpOnly)
 *   __refresh                   — refreshToken              (30 d, httpOnly)
 *   __csrf                      — CSRF token                (1 h, NOT httpOnly)
 *
 * __Host- prefix in production enforces Secure + no Domain + path=/ (RFC 6265bis).
 */
function establishSecureSession(res, { idToken, refreshToken, userAgent }) {
  const prod            = process.env.NODE_ENV === 'production';
  const fingerprint     = createSessionFingerprint(userAgent);
  const csrfToken       = generateCSRFToken();
  const sessionName     = prod ? '__Host-session' : '__session';

  const base = {
    httpOnly: true,
    secure:   prod,
    sameSite: 'strict',
    path:     '/',
    signed:   true,
    ...(prod && process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };

  res.cookie(sessionName, `${idToken}|${fingerprint}`, { ...base, maxAge: 60 * 60 * 1000 });
  res.cookie('__refresh', refreshToken, { ...base, path: '/auth/refresh', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.cookie('__csrf', csrfToken,       { ...base, httpOnly: false, maxAge: 60 * 60 * 1000 });

  res.setHeader('X-Content-Type-Options',    'nosniff');
  res.setHeader('X-Frame-Options',           'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
}

/**
 * Password reset email template — Damuchi branded.
 */
function _passwordResetHtml({ name, resetLink, ip }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password — Damuchi</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Segoe UI',system-ui,sans-serif;color:#1a1a2e;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;
              overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0A0E1A 0%,#1C2135 100%);
                padding:32px;text-align:center;">
      <h1 style="margin:0;color:#F59E0B;font-size:22px;">Damuchi</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:14px;">Password Reset Request</p>
    </div>
    <div style="padding:32px;">
      <p style="margin-top:0;">Hi <strong>${name}</strong>,</p>
      <p>We received a password reset request for your account.</p>
      <div style="background:#f3f4f6;border-radius:6px;padding:12px;font-family:monospace;font-size:13px;margin:16px 0;">
        <strong>Request origin:</strong> ${ip}
      </div>
      <p>Click the button below to set a new password.
         This link expires in <strong style="color:#ef4444;">1 hour</strong>.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetLink}"
           style="display:inline-block;padding:13px 32px;background:#F59E0B;color:#0A0E1A;
                  border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          Reset Password
        </a>
      </div>
      <p style="color:#64748b;font-size:13px;">
        If you didn't request this, you can safely ignore this email. Your password won't change.
      </p>
    </div>
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;
                text-align:center;font-size:12px;color:#6b7280;">
      <p style="margin:0;">© ${new Date().getFullYear()} Damuchi / 94tec. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}