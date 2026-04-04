// controllers/auth/emailVerificationController.js
import { admin, adminDb } from '../../config/firebase.js';
import { STATUS } from '../../config/roles.js';
import { sendVerificationEmail } from '../../services/emailService.js';
import { getAllUsers } from '../../models/user.js';
import { sendAdminNotification } from '../../services/emailService.js';
import AuditLog from '../../services/auditLog.js';
import { getIp, getUserAgent, rSet, rGet, rDel, rSetNX, K, TTL } from './authHelpers.js';
import { validateEmailFormat } from './authHelpers.js';
import VerificationModel from '../../models/verificationModel.js'; // if exists

// Idempotency lock helpers
const locks = new Map();
const acquireLock = async (key) => {
  const got = await rSetNX(key, '1', 60);
  if (got) return true;
  if (locks.has(key)) return false;
  locks.set(key, Date.now());
  return true;
};
const releaseLock = async (key) => {
  await rDel(key);
  locks.delete(key);
};

// Mark email verified in DBs
const markEmailVerifiedInDB = async (uid) => {
  const now = new Date().toISOString();
  await Promise.all([
    adminDb.ref(`users/${uid}`).update({
      'basic/emailVerified': true,
      'basic/status': STATUS.AWAITING,
      'basic/updatedAt': now,
    }),
    admin.firestore().collection('users').doc(uid).update({
      emailVerified: true,
      status: STATUS.AWAITING,
      updatedAt: now,
    }),
  ]);
};

// Add to approval queue
const addToApprovalQueue = async (uid, email, displayName) => {
  try {
    await admin.firestore().collection('approvalQueue').doc(uid).set({
      uid, email, displayName,
      requestedAt: new Date().toISOString(),
      status: STATUS.AWAITING,
    }, { merge: true });
  } catch (err) {
    console.error('[VerifyEmail] approvalQueue write failed:', err.message);
  }
};

export const verifyEmail = async (req, res) => {
  const { oobCode, uid, email } = req.body;

  if (!oobCode || !uid || !email) {
    return res.status(400).json({ error: 'Missing parameters', code: 'INVALID_PARAMS' });
  }

  const lockKey = `vlock:${uid}:${oobCode.slice(-8)}`;
  const locked = await acquireLock(lockKey);
  if (!locked) {
    return res.status(409).json({ error: 'Verification in progress', code: 'VERIFICATION_IN_PROGRESS' });
  }

  try {
    // 1. Check if already verified in Firebase Auth
    const fbUser = await admin.auth().getUser(uid);
    if (fbUser.emailVerified) {
      return res.status(200).json({ success: true, alreadyVerified: true, message: 'Email already verified' });
    }

    // 2. Validate token (optional, if you stored it)
    let record = null;
    if (VerificationModel) {
      const { hashString } = await import('../../utils/validator.js');
      const tokenHash = await hashString(oobCode);
      record = await VerificationModel.findByToken(tokenHash);
      if (!record) {
        return res.status(404).json({ error: 'Invalid verification link', code: 'INVALID_TOKEN' });
      }
      if (record.consumed) {
        return res.status(410).json({ error: 'Link already used', code: 'TOKEN_CONSUMED' });
      }
      if (new Date(record.expiresAt) < new Date()) {
        return res.status(410).json({ error: 'Link expired', code: 'TOKEN_EXPIRED' });
      }
    }

    // 3. Mark Firebase Auth as verified
    await admin.auth().updateUser(uid, { emailVerified: true });

    // 4. Update local databases
    await markEmailVerifiedInDB(uid);

    // 5. Consume token if stored
    if (record && VerificationModel) {
      await VerificationModel.markAsConsumed(record.id);
    }

    // 6. Add to approval queue + notify admins (fire-and-forget)
    const displayName = fbUser.displayName || email.split('@')[0];
    addToApprovalQueue(uid, email, displayName).catch(() => {});
    getAllUsers({ role: 'admin' })
      .then(admins => sendAdminNotification({
        adminEmails: admins.map(a => a.email || a.basic?.email).filter(Boolean),
        newUser: { uid, email, displayName, createdAt: fbUser.metadata?.creationTime },
      }))
      .catch(err => console.error('Admin notification failed:', err.message));

    // 7. Audit log
    AuditLog.record(AuditLog.EVENTS.EMAIL_VERIFICATION, {
      userId: uid, ip: getIp(req), userAgent: getUserAgent(req),
      metadata: { email, newStatus: STATUS.AWAITING },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      status: STATUS.AWAITING,
      message: 'Email verified! Your account is now pending admin approval.',
    });

  } catch (err) {
    console.error('[VerifyEmail] Error:', err.message);
    return res.status(500).json({ error: 'Verification failed', code: 'VERIFY_FAILED' });
  } finally {
    await releaseLock(lockKey);
  }
};

export const resendVerification = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required', code: 'MISSING_FIELDS' });
  }

  const normEmail = email.trim().toLowerCase();
  const emailCheck = validateEmailFormat(normEmail);
  if (!emailCheck.valid) {
    return res.status(400).json({ error: emailCheck.reason, code: emailCheck.code });
  }

  // Rate limit: 1 per 2 minutes
  const coolKey = K.resendCool(normEmail);
  const cooldown = await rGet(coolKey);
  if (cooldown) {
    return res.status(429).json({
      error: 'Please wait 2 minutes before requesting another verification email.',
      code: 'RATE_LIMITED',
    });
  }

  const safeOk = () => res.status(200).json({
    message: 'If the email is registered and unverified, you will receive a new verification link.',
    code: 'SENT',
  });

  try {
    const fbUser = await admin.auth().getUserByEmail(normEmail);

    if (fbUser.emailVerified) {
      return res.status(200).json({ message: 'Email already verified', code: 'ALREADY_VERIFIED' });
    }

    // Set cooldown before sending to avoid race
    await rSet(coolKey, '1', TTL.RESEND_COOL);

    // Send new verification email (reuse the same sending logic)
    await sendVerificationEmail({
      userId: fbUser.uid,
      email: normEmail,
      name: fbUser.displayName,
      ip: getIp(req),
      req,
      isResend: true,
    });

    AuditLog.record(AuditLog.EVENTS.EMAIL_VERIFICATION_RESEND, {
      userId: fbUser.uid,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    }).catch(() => {});

    return safeOk();
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      // Rate limit anyway to prevent email enumeration
      await rSet(coolKey, '1', TTL.RESEND_COOL);
      return safeOk();
    }
    console.error('[ResendVerification] Error:', err.message);
    return res.status(500).json({ error: 'Failed to send verification email', code: 'SERVER_ERROR' });
  }
};