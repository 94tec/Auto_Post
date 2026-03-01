/**
 * controllers/authController.js
 * ═══════════════════════════════════════════════════════════════════
 * REGISTRATION FLOW
 * ───────────────────────────────────────────────────────────────────
 *  POST /api/auth/register
 *    → always creates as GUEST, status=pending
 *    → sends verification email + PDF attachment
 *    → 'admin' in body body is silently overridden to 'guest'
 *
 * EMAIL VERIFY FLOW  (step 1 of 2 for guest upgrade)
 *  POST /api/auth/verify-email
 *    → consumes oobCode
 *    → marks emailVerified=true
 *    → status: pending → awaiting
 *    → adds to Firestore approvalQueue
 *    → guest is NOT promoted yet — admin must also approve
 *
 * ADMIN APPROVE FLOW  (step 2 of 2 — in adminController.js)
 *  POST /api/admin/users/:uid/approve
 *    → sets adminApproved=true
 *    → if emailVerified already true → promotes guest → user
 * ═══════════════════════════════════════════════════════════════════
 */

import { admin }                          from '../../config/firebase.js';
import { ROLES, STATUS }                  from '../../config/roles.js';
import {
  createUser, getUserById, recordLogin,
  markEmailVerified,
}                                         from '../../models/user.js';
import VerificationModel                  from '../../models/verificationModel.js';
import { sendVerificationEmail }          from '../../services/emailService.js';
import AuditLog                           from '../../services/auditLog.js';
import { hashString }                     from '../../utils/validator.js';
import { validateEmail, validatePassword } from '../../utils/authUtils.js';

const ip = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';

/* ══════════════════════════════════════════════════════════════════
   REGISTER  — always GUEST, status=pending
   ══════════════════════════════════════════════════════════════════ */
export const register = async (req, res) => {
  const { email, password, displayName } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required', code: 'MISSING_FIELDS' });
  if (!validateEmail(email))
    return res.status(400).json({ error: 'Invalid email address', code: 'INVALID_EMAIL' });
  if (!validatePassword(password))
    return res.status(400).json({
      error: 'Password must be 8+ chars with uppercase, number, and special character.',
      code:  'WEAK_PASSWORD',
    });

  try {
    const firebaseUser = await admin.auth().createUser({
      email:         email.trim().toLowerCase(),
      password,
      displayName:   displayName || email.split('@')[0],
      emailVerified: false,
    });

    await createUser({
      uid:         firebaseUser.uid,
      email:       email.trim().toLowerCase(),
      displayName: displayName || email.split('@')[0],
      ip:          ip(req),
    });

    await sendVerificationEmail({
      userId: firebaseUser.uid,
      email:  email.trim().toLowerCase(),
      name:   displayName || email.split('@')[0],
      ip:     ip(req),
      req,
    });

    await AuditLog.record(AuditLog.EVENTS.USER_REGISTERED, {
      userId:    firebaseUser.uid,
      ip:        ip(req),
      userAgent: req.headers['user-agent'],
      metadata:  { email, role: ROLES.GUEST },
    });

    return res.status(201).json({
      message: 'Registration successful. Check your email to verify your account.',
      userId:  firebaseUser.uid,
      role:    ROLES.GUEST,
      status:  STATUS.PENDING,
    });
  } catch (err) {
    if (err.code === 'auth/email-already-exists')
      return res.status(409).json({ error: 'An account with this email already exists.', code: 'EMAIL_EXISTS' });
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed.', code: 'SERVER_ERROR' });
  }
};

/* ══════════════════════════════════════════════════════════════════
   LOGIN
   ══════════════════════════════════════════════════════════════════ */
export const login = async (req, res) => {
  const { idToken } = req.body;
  if (!idToken)
    return res.status(400).json({ error: 'ID token required', code: 'MISSING_TOKEN' });

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const dbUser  = await getUserById(decoded.uid);

    if (!dbUser)
      return res.status(404).json({ error: 'User record not found', code: 'USER_NOT_FOUND' });

    if (dbUser.basic?.status === STATUS.SUSPENDED)
      return res.status(403).json({ error: 'Account suspended', code: 'ACCOUNT_SUSPENDED' });

    await recordLogin(decoded.uid, ip(req));

    await AuditLog.record(AuditLog.EVENTS.USER_LOGIN, {
      userId: decoded.uid, ip: ip(req), userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      message:       'Login successful',
      uid:           decoded.uid,
      role:          dbUser.basic?.role,
      status:        dbUser.basic?.status,
      emailVerified: dbUser.basic?.emailVerified,
      adminApproved: dbUser.basic?.adminApproved,
      permissions:   dbUser.permissions,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(401).json({ error: 'Authentication failed', code: 'AUTH_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════════
   VERIFY EMAIL  (step 1 of 2 — moves status pending → awaiting)
   ══════════════════════════════════════════════════════════════════ */
export const verifyEmail = async (req, res) => {
  const { oobCode, uid, email } = req.body;

  if (!oobCode || !uid || !email)
    return res.status(400).json({ error: 'Missing verification parameters', code: 'INVALID_PARAMS' });

  const lockKey = `verify-${uid}-${oobCode}`;
  if (verifyLocks.has(lockKey))
    return res.status(409).json({ code: 'VERIFICATION_IN_PROGRESS' });

  verifyLocks.set(lockKey, Date.now());

  try {
    // Already verified?
    const fbUser = await admin.auth().getUser(uid);
    if (fbUser.emailVerified) {
      return res.status(200).json({
        success: true, alreadyVerified: true,
        message: 'Your email is already verified.',
      });
    }

    // Validate token
    const tokenHash = await hashString(oobCode);
    const record    = await VerificationModel.findByToken(tokenHash);
    if (!record)          return res.status(404).json({ error: 'Invalid link', code: 'INVALID_TOKEN' });
    if (record.consumed)  return res.status(410).json({ error: 'Link already used', code: 'TOKEN_CONSUMED' });
    if (new Date(record.expiresAt) < new Date())
      return res.status(410).json({ error: 'Link expired', code: 'TOKEN_EXPIRED' });

    // Consume + update Firebase Auth
    await VerificationModel.markAsConsumed(record.id);
    await admin.auth().updateUser(uid, { emailVerified: true });

    // Update RTDB + Firestore, add to approval queue
    const { nowAwaiting } = await markEmailVerified(uid);

    await AuditLog.record(AuditLog.EVENTS.EMAIL_VERIFICATION, {
      userId: uid, ip: ip(req), userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success:      true,
      status:       nowAwaiting ? STATUS.AWAITING : STATUS.ACTIVE,
      message:      nowAwaiting
        ? 'Email verified! Your account is now awaiting admin approval.'
        : 'Email verified and account activated.',
    });
  } catch (err) {
    console.error('verifyEmail error:', err);
    return res.status(500).json({ error: 'Verification failed', code: 'VERIFY_FAILED' });
  } finally {
    verifyLocks.delete(lockKey);
  }
};

/* ══════════════════════════════════════════════════════════════════
   RESEND VERIFICATION
   ══════════════════════════════════════════════════════════════════ */
export const resendVerification = async (req, res) => {
  const { email } = req.body;

  if (!email || !validateEmail(email))
    return res.status(400).json({ error: 'Valid email required', code: 'INVALID_EMAIL' });

  const normalised = email.trim().toLowerCase();
  const coolKey    = `resend:${normalised}`;
  const last       = cooldowns.get(coolKey);

  if (last && Date.now() - last < 2 * 60 * 1000)
    return res.status(429).json({ error: 'Wait 2 minutes before requesting another email.', code: 'RATE_LIMITED' });

  try {
    const fbUser = await admin.auth().getUserByEmail(normalised);
    if (fbUser.emailVerified)
      return res.status(200).json({ message: 'Email already verified.', code: 'ALREADY_VERIFIED' });

    await sendVerificationEmail({
      userId: fbUser.uid, email: normalised,
      name:   fbUser.displayName || normalised.split('@')[0],
      ip: ip(req), req, isResend: true,
    });

    cooldowns.set(coolKey, Date.now());
    return res.status(200).json({ message: 'Verification email sent.', code: 'SENT' });
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      cooldowns.set(coolKey, Date.now());
      return res.status(200).json({ message: 'If registered, you will receive an email.', code: 'POTENTIALLY_SENT' });
    }
    return res.status(500).json({ error: 'Failed to send.', code: 'SERVER_ERROR' });
  }
};

/* ── GET /api/auth/me ──────────────────────────────────────────── */
export const getMe = (req, res) => {
  const { uid, basic, permissions } = req.user;
  res.status(200).json({
    uid: uid || req.uid,
    displayName:   basic?.displayName,
    email:         basic?.email,
    role:          basic?.role,
    status:        basic?.status,
    emailVerified: basic?.emailVerified,
    adminApproved: basic?.adminApproved,
    permissions,
  });
};

// Module-level in-memory stores (replace with Redis in production)
const verifyLocks = new Map();
const cooldowns   = new Map();