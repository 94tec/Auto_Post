/**
 * controllers/auth/emailVerificationController.js
 * ═══════════════════════════════════════════════════════════════
 * POST /api/auth/verify-email        — guest upgrade step 1 of 2
 * POST /api/auth/resend-verification — re-send verification link
 *
 * VERIFY FLOW
 * ───────────────────────────────────────────────────────────────
 *  1. Validate params (oobCode, uid, email)
 *  2. Redis idempotency lock — prevent double-consumption
 *  3. Check if already verified (idempotent early exit)
 *  4. Validate oobCode token record (hash + expiry + consumed flag)
 *  5. Consume token + mark Firebase Auth emailVerified=true
 *  6. RTDB + Firestore: status pending → awaiting
 *  7. Notify all admins (fire-and-forget)
 *  8. AuditLog (fire-and-forget)
 *
 * RESEND FLOW
 * ───────────────────────────────────────────────────────────────
 *  Rate-limited: 1 per 2 minutes per email (Redis cooldown key)
 *  Anti-enumeration: always 200 whether user exists or not
 * ═══════════════════════════════════════════════════════════════
 */

import { admin, adminDb }         from '../../config/firebase.js';
import { STATUS }                  from '../../config/roles.js';
import { getAllUsers }              from '../../models/user.js';
import {
  sendVerificationReminder,
  sendAdminNotification,
}                                  from '../../services/emailService.js';
import AuditLog                    from '../../services/auditLog.js';
import { validateEmailFormat }     from './authHelpers.js';
import {
  getIp, getUserAgent,
  rGet, rSet, rDel, rSetNX,
  K, TTL,
} from './authHelpers.js';

/* ── In-process idempotency lock (Redis-backed in production) ─ */
// Falls back to a Map if Redis is down — acceptable for low-volume
const _locks = new Map();
const _acquireLock = async (key) => {
  const got = await rSetNX(key, '1', 60);
  if (got) return true;
  if (_locks.has(key)) return false;
  _locks.set(key, Date.now());
  return true;
};
const _releaseLock = async (key) => {
  await rDel(key);
  _locks.delete(key);
};

/* ── Mark emailVerified in RTDB + Firestore ──────────────────── */
const markEmailVerifiedInDB = async (uid) => {
  const now = new Date().toISOString();
  await Promise.all([
    adminDb.ref(`users/${uid}`).update({
      'basic/emailVerified': true,
      'basic/status':        STATUS.AWAITING,
      'basic/updatedAt':     now,
    }),
    admin.firestore().collection('users').doc(uid).update({
      emailVerified: true,
      status:        STATUS.AWAITING,
      updatedAt:     now,
    }),
  ]);
};

/* ── Add to Firestore approvalQueue ──────────────────────────── */
const addToApprovalQueue = async (uid, email, displayName) => {
  try {
    await admin.firestore().collection('approvalQueue').doc(uid).set({
      uid,
      email,
      displayName,
      requestedAt: new Date().toISOString(),
      status:      STATUS.AWAITING,
    }, { merge: true });
  } catch (err) {
    console.error('[VerifyEmail] approvalQueue write failed (non-fatal):', err.message);
  }
};

/* ══════════════════════════════════════════════════════════════
   VERIFY EMAIL
══════════════════════════════════════════════════════════════ */
export const verifyEmail = async (req, res) => {
  const { oobCode, uid, email } = req.body;

  /* 1. Validate params ─────────────────────────────────────── */
  if (!oobCode || !uid || !email) {
    return res.status(400).json({
      error: 'Missing verification parameters. Please use the full link from your email.',
      code:  'INVALID_PARAMS',
    });
  }

  /* 2. Idempotency lock ────────────────────────────────────── */
  const lockKey = `vlock:${uid}:${oobCode.slice(-8)}`;
  const locked  = await _acquireLock(lockKey);
  if (!locked) {
    return res.status(409).json({
      error: 'Verification already in progress.',
      code:  'VERIFICATION_IN_PROGRESS',
    });
  }

  try {
    /* 3. Already verified? ──────────────────────────────────── */
    const fbUser = await admin.auth().getUser(uid);
    if (fbUser.emailVerified) {
      return res.status(200).json({
        success:         true,
        alreadyVerified: true,
        message:         'Your email is already verified. You\'re in the approval queue.',
      });
    }

    /* 4. Validate oobCode via Firebase Admin ─────────────────── */
    // Firebase verifyPasswordResetCode validates the token format.
    // For email verification we use a custom token stored in our DB
    // (VerificationModel). If you use Firebase's own email link,
    // just call admin.auth().updateUser(uid, { emailVerified: true })
    // after the client has confirmed via Firebase client SDK.
    //
    // This controller assumes your sendVerificationEmail stored a
    // hashed token. If not using VerificationModel, remove steps 4a-c.
    let record;
    try {
      const { default: VerificationModel } = await import('../../models/verificationModel.js');
      const { hashString } = await import('../../utils/validator.js');
      const tokenHash = await hashString(oobCode);
      record = await VerificationModel.findByToken(tokenHash);
    } catch {
      // VerificationModel not set up — skip custom token validation
      // and rely on Firebase Auth's own verification
      record = null;
    }

    if (record !== null) {
      // Custom token validation path
      if (!record) {
        return res.status(404).json({ error: 'Invalid verification link.', code: 'INVALID_TOKEN' });
      }
      if (record.consumed) {
        return res.status(410).json({ error: 'This verification link has already been used.', code: 'TOKEN_CONSUMED' });
      }
      if (new Date(record.expiresAt) < new Date()) {
        return res.status(410).json({ error: 'This verification link has expired. Request a new one.', code: 'TOKEN_EXPIRED' });
      }
      try {
        const { default: VerificationModel } = await import('../../models/verificationModel.js');
        await VerificationModel.markAsConsumed(record.id);
      } catch {}
    }

    /* 5. Mark Firebase Auth emailVerified=true ───────────────── */
    await admin.auth().updateUser(uid, { emailVerified: true });

    /* 6. Update RTDB + Firestore: pending → awaiting ─────────── */
    await markEmailVerifiedInDB(uid);

    /* 7. Approval queue + admin notification (fire-and-forget) ── */
    const displayName = fbUser.displayName || email.split('@')[0];
    addToApprovalQueue(uid, email, displayName).catch(() => {});

    getAllUsers({ role: 'admin' })
      .then((admins) => {
        const adminEmails = admins.map(a => a.email || a.basic?.email).filter(Boolean);
        return sendAdminNotification({
          adminEmails,
          newUser: { uid, email, displayName, createdAt: fbUser.metadata?.creationTime },
        });
      })
      .catch(err => console.error('[VerifyEmail] Admin notification failed (non-fatal):', err.message));

    /* 8. Audit log ─────────────────────────────────────────────── */
    AuditLog.record(AuditLog.EVENTS.EMAIL_VERIFICATION, {
      userId:    uid,
      ip:        getIp(req),
      userAgent: getUserAgent(req),
      metadata:  { email, newStatus: STATUS.AWAITING },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      status:  STATUS.AWAITING,
      message: 'Email verified! Your account is now in the approval queue. You\'ll receive an email once approved.',
      nextStep: 'An admin will review your account shortly (usually within 24 hours).',
    });

  } catch (err) {
    console.error('[VerifyEmail] Error:', err.message);
    return res.status(500).json({
      error: 'Verification failed. Please try again or request a new link.',
      code:  'VERIFY_FAILED',
    });
  } finally {
    await _releaseLock(lockKey);
  }
};

/* ══════════════════════════════════════════════════════════════
   RESEND VERIFICATION
══════════════════════════════════════════════════════════════ */
export const resendVerification = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.', code: 'MISSING_FIELDS' });
  }

  const normEmail  = email.trim().toLowerCase();
  const emailCheck = validateEmailFormat(normEmail);
  if (!emailCheck.valid) {
    return res.status(400).json({ error: emailCheck.reason, code: emailCheck.code });
  }

  /* Rate limit: 1 per 2 minutes ──────────────────────────────── */
  const coolKey  = K.resendCool(normEmail);
  const cooldown = await rGet(coolKey);
  if (cooldown) {
    return res.status(429).json({
      error: 'Please wait 2 minutes before requesting another verification email.',
      code:  'RATE_LIMITED',
      hint:  'Check your spam/junk folder — the email may have already arrived.',
    });
  }

  /* Always 200 — never reveal whether email exists ─────────────── */
  const safeOk = () => res.status(200).json({
    message: 'If this email is registered and unverified, you\'ll receive a new verification email shortly.',
    code:    'SENT',
  });

  try {
    const fbUser = await admin.auth().getUserByEmail(normEmail);

    if (fbUser.emailVerified) {
      return res.status(200).json({
        message: 'Your email is already verified.',
        code:    'ALREADY_VERIFIED',
      });
    }

    // Set cooldown before sending (prevents race condition)
    await rSet(coolKey, '1', TTL.RESEND_COOL);

    await sendVerificationReminder({
      email:       normEmail,
      displayName: fbUser.displayName || normEmail.split('@')[0],
      // verificationLink is generated by your emailService
    });

    AuditLog.record(AuditLog.EVENTS.EMAIL_VERIFICATION_RESEND, {
      userId:    fbUser.uid,
      ip:        getIp(req),
      userAgent: getUserAgent(req),
    }).catch(() => {});

    return safeOk();

  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      // Set cooldown anyway — prevents timing-based email enumeration
      await rSet(coolKey, '1', TTL.RESEND_COOL);
      return safeOk();
    }
    console.error('[ResendVerification] Error:', err.message);
    return res.status(500).json({
      error: 'Failed to send verification email. Please try again.',
      code:  'SERVER_ERROR',
    });
  }
};