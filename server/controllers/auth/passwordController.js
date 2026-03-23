/**
 * controllers/auth/passwordController.js
 * ═══════════════════════════════════════════════════════════════
 * POST /api/auth/forgot-password     — generate + email reset link
 * POST /api/auth/verify-reset-link   — validate oobCode before form
 * POST /api/auth/reset-password      — consume oobCode + set password
 *
 * Anti-enumeration: forgotPassword always returns 200
 * Session revocation: resetPassword revokes all tokens after success
 * ═══════════════════════════════════════════════════════════════
 */

import { admin, adminDb }           from '../../config/firebase.js';
import { validatePasswordStrength } from '../../utils/validator.js';
import { sendPasswordResetEmail }   from '../../services/emailService.js';
import AuditLog                     from '../../services/auditLog.js';
import { getIp, getUserAgent, mapFirebaseError } from './authHelpers.js';

/* ══════════════════════════════════════════════════════════════
   FORGOT PASSWORD
══════════════════════════════════════════════════════════════ */
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const ip        = getIp(req);
  const userAgent = getUserAgent(req);

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required.', code: 'MISSING_FIELDS' });
  }

  const normEmail  = email.trim().toLowerCase();
  // Always return same message — prevents email enumeration
  const safeOk = () => res.status(200).json({
    message: 'If this email is registered, you\'ll receive a password reset link shortly.',
    code:    'RESET_EMAIL_SENT',
    hint:    'Check your spam folder if it doesn\'t arrive within 5 minutes.',
  });

  try {
    const fbUser = await admin.auth().getUserByEmail(normEmail);

    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const actionUrl   = `${frontendUrl}/auth/reset-password`;

    const resetLink = await admin.auth().generatePasswordResetLink(normEmail, {
      url:             `${actionUrl}?uid=${fbUser.uid}&email=${encodeURIComponent(normEmail)}`,
      handleCodeInApp: true,
    });

    // Extract oobCode so we can build a cleaner URL
    const oobCode = new URL(resetLink).searchParams.get('oobCode');
    const link    = oobCode
      ? `${actionUrl}?oobCode=${encodeURIComponent(oobCode)}&uid=${fbUser.uid}&email=${encodeURIComponent(normEmail)}`
      : resetLink;

    await sendPasswordResetEmail({
      email:       normEmail,
      displayName: fbUser.displayName || normEmail.split('@')[0],
      resetLink:   link,
      ip,
    });

    AuditLog.record(AuditLog.EVENTS.PASSWORD_RESET_REQUESTED, {
      userId:    fbUser.uid,
      ip,
      userAgent,
      metadata:  { email: normEmail },
    }).catch(() => {});

    return safeOk();

  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      AuditLog.record(AuditLog.EVENTS.PASSWORD_RESET_UNKNOWN_EMAIL, {
        ip, userAgent, metadata: { email: normEmail },
      }).catch(() => {});
      return safeOk(); // don't reveal non-existence
    }

    console.error('[ForgotPassword] Error:', err.message);
    return res.status(500).json({
      error: 'Failed to process request. Please try again.',
      code:  'SERVER_ERROR',
    });
  }
};

/* ══════════════════════════════════════════════════════════════
   VERIFY RESET LINK
   Called when user lands on /auth/reset-password with oobCode.
   Validates the code before showing the new-password form.
══════════════════════════════════════════════════════════════ */
export const verifyResetLink = async (req, res) => {
  const { oobCode, uid, email } = req.body;

  if (!oobCode || !uid || !email) {
    return res.status(400).json({
      error: 'Incomplete reset link. Please use the full link from your email.',
      code:  'INVALID_RESET_PARAMS',
    });
  }

  try {
    // Firebase validates the oobCode — throws on expired/used/invalid
    await admin.auth().verifyPasswordResetCode(oobCode);

    // Cross-check uid matches the email
    const fbUser = await admin.auth().getUser(uid);
    if (fbUser.email.toLowerCase() !== email.toLowerCase().trim()) {
      return res.status(400).json({ error: 'Link parameters are inconsistent.', code: 'EMAIL_MISMATCH' });
    }

    AuditLog.record(AuditLog.EVENTS.PASSWORD_RESET_LINK_VERIFIED, {
      userId:    uid,
      ip:        getIp(req),
      userAgent: getUserAgent(req),
    }).catch(() => {});

    return res.status(200).json({ success: true, message: 'Reset link is valid.', uid });

  } catch (err) {
    console.error('[VerifyResetLink] Error:', err.code ?? err.message);
    const mapped = mapFirebaseError(err);
    return res.status(mapped.status).json({ error: mapped.error, code: mapped.code });
  }
};

/* ══════════════════════════════════════════════════════════════
   RESET PASSWORD
   Consumes the oobCode, sets new password, revokes all sessions.
══════════════════════════════════════════════════════════════ */
export const resetPassword = async (req, res) => {
  const { oobCode, newPassword } = req.body;
  const ip        = getIp(req);
  const userAgent = getUserAgent(req);

  if (!oobCode || !newPassword) {
    return res.status(400).json({
      error: 'Reset code and new password are required.',
      code:  'MISSING_FIELDS',
    });
  }

  const pwCheck = validatePasswordStrength(newPassword);
  if (!pwCheck.valid) {
    return res.status(400).json({
      error:  pwCheck.reason,
      code:   'WEAK_PASSWORD',
      failed: pwCheck.failed,
      hint:   'Use 8+ characters with uppercase, lowercase, a number, and a special character.',
    });
  }

  try {
    /* Verify oobCode — returns the email it was issued for */
    const email = await admin.auth().verifyPasswordResetCode(oobCode);

    /* Commit new password */
    await admin.auth().confirmPasswordReset(oobCode, newPassword);

    /* Revoke all sessions (invalidates all existing tokens) */
    const fbUser = await admin.auth().getUserByEmail(email);
    await admin.auth().revokeRefreshTokens(fbUser.uid);

    /* Record timestamp */
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
    console.error('[ResetPassword] Error:', err.code ?? err.message);
    AuditLog.record(AuditLog.EVENTS.PASSWORD_RESET_FAILED, {
      ip, userAgent, metadata: { errorCode: err.code },
    }).catch(() => {});
    const mapped = mapFirebaseError(err);
    return res.status(mapped.status).json({ error: mapped.error, code: mapped.code });
  }
};