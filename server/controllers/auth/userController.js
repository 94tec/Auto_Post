/**
 * controllers/auth/userController.js
 * ═══════════════════════════════════════════════════════════════
 * Account-management for signed-in users.
 * All routes require verifyToken + requireActiveAccount.
 *
 * EXPORTS (routes)
 * ───────────────────────────────────────────────────────────────
 *  POST  /api/users/change-password    changePassword
 *  PATCH /api/users/profile            updateProfile
 *  PATCH /api/users/profile-advanced   updateProfileAdvanced (email change)
 *  DELETE /api/users/account           deleteAccount
 *
 * EXPORTS (helpers — called by other controllers)
 * ───────────────────────────────────────────────────────────────
 *  checkExistingUser(email) → { exists, isVerified, uid? }
 * ═══════════════════════════════════════════════════════════════
 */

import { admin, adminDb }           from '../../config/firebase.js';
import { STATUS }                   from '../../config/roles.js';
import { validatePasswordStrength } from '../../utils/validator.js';
import { sendPasswordChangedEmail } from '../../services/emailService.js';
import AuditLog                     from '../../services/auditLog.js';
import { rDel, rSet, K, TTL, getIp, getUserAgent } from './authHelpers.js';

/* ══════════════════════════════════════════════════════════════
   CHECK EXISTING USER (helper — used by registerController)
══════════════════════════════════════════════════════════════ */
/**
 * Returns { exists: false } or { exists: true, isVerified, uid }.
 * Throws on unexpected Firebase errors.
 */
export const checkExistingUser = async (email) => {
  try {
    const record = await admin.auth().getUserByEmail(email.toLowerCase().trim());
    return { exists: true, isVerified: record.emailVerified, uid: record.uid };
  } catch (err) {
    if (err.code === 'auth/user-not-found') return { exists: false };
    throw err;
  }
};

/* ══════════════════════════════════════════════════════════════
   CHANGE PASSWORD
   POST /api/users/change-password
   User is authenticated — no current password needed.
   Revokes all other sessions after success.
══════════════════════════════════════════════════════════════ */
export const changePassword = async (req, res) => {
  const { newPassword } = req.body;
  const uid       = req.uid;
  const ip        = getIp(req);
  const userAgent = getUserAgent(req);

  if (!newPassword) {
    return res.status(400).json({ error: 'New password is required.', code: 'MISSING_FIELDS' });
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
    await admin.auth().updateUser(uid, { password: newPassword });
    await admin.auth().revokeRefreshTokens(uid); // log out all other devices

    const now = new Date().toISOString();

    // Clear mustChangePassword flag + record change timestamp
    // Both RTDB and Firestore — in parallel, non-fatal
    await Promise.allSettled([
      adminDb.ref(`users/${uid}`).update({
        'basic/mustChangePassword': false,
        'basic/updatedAt':          now,
        'security/lastPasswordChange': now,
      }),
      admin.firestore().collection('users').doc(uid).update({
        mustChangePassword: false,
        updatedAt:          now,
      }),
      // Bust Redis profile cache so next fetchUserRole gets fresh data
      rDel(K.profile(uid)),
    ]);

    // Security email
    const fbUser = await admin.auth().getUser(uid).catch(() => null);
    sendPasswordChangedEmail({
      email:       fbUser?.email || req.user?.basic?.email,
      displayName: fbUser?.displayName || req.user?.basic?.displayName,
      ip,
      userAgent,
    }).catch(() => {});

    AuditLog.record(AuditLog.EVENTS.PASSWORD_CHANGED, { userId: uid, ip, userAgent }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully. All other sessions have been signed out.',
      mustChangePassword: false, // frontend can update Redux state immediately
    });

  } catch (err) {
    console.error('[changePassword]', err.message);
    return res.status(500).json({ error: 'Failed to change password.', code: 'PASSWORD_CHANGE_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════
   UPDATE PROFILE (display name only — lightweight)
   PATCH /api/users/profile
══════════════════════════════════════════════════════════════ */
export const updateProfile = async (req, res) => {
  const { displayName } = req.body;
  const uid = req.uid;

  if (!displayName?.trim()) {
    return res.status(400).json({ error: 'displayName is required.', code: 'MISSING_FIELDS' });
  }

  const trimmed = displayName.trim();
  if (trimmed.length < 2 || trimmed.length > 50) {
    return res.status(400).json({ error: 'Display name must be 2–50 characters.', code: 'INVALID_LENGTH' });
  }

  try {
    const now = new Date().toISOString();
    await Promise.all([
      admin.auth().updateUser(uid, { displayName: trimmed }),
      adminDb.ref(`users/${uid}`).update({ 'basic/displayName': trimmed, 'basic/updatedAt': now }),
      admin.firestore().collection('users').doc(uid).update({ displayName: trimmed, updatedAt: now }),
    ]);

    AuditLog.record(AuditLog.EVENTS.PROFILE_UPDATED, {
      userId:   uid,
      ip:       getIp(req),
      metadata: { updatedFields: ['displayName'] },
    }).catch(() => {});

    return res.status(200).json({ success: true, message: 'Profile updated.', displayName: trimmed });
  } catch (err) {
    console.error('[updateProfile]', err.message);
    return res.status(500).json({ error: 'Failed to update profile.', code: 'PROFILE_UPDATE_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════
   UPDATE PROFILE ADVANCED (displayName + email change)
   PATCH /api/users/profile-advanced
   Email changes reset status→pending and require re-verification.
══════════════════════════════════════════════════════════════ */
export const updateProfileAdvanced = async (req, res) => {
  const { displayName, email } = req.body;
  const uid       = req.uid;
  const ip        = getIp(req);
  const userAgent = getUserAgent(req);

  if (!displayName && !email) {
    return res.status(400).json({ error: 'Provide at least one field to update.', code: 'MISSING_FIELDS' });
  }

  try {
    const authUp  = {};
    const rtdbUp  = { 'basic/updatedAt': new Date().toISOString() };
    const fsUp    = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    /* Display name ─────────────────────────────────────────────── */
    if (displayName?.trim()) {
      const t = displayName.trim();
      if (t.length < 2 || t.length > 50) {
        return res.status(400).json({ error: 'Display name must be 2–50 characters.', code: 'INVALID_LENGTH' });
      }
      authUp.displayName = t;
      rtdbUp['basic/displayName'] = t;
      fsUp.displayName = t;
    }

    /* Email change ─────────────────────────────────────────────── */
    let emailChanged = false;
    if (email?.trim()) {
      const norm = email.trim().toLowerCase();

      // Check if another account owns this email
      try {
        const ex = await admin.auth().getUserByEmail(norm);
        if (ex.uid !== uid) {
          return res.status(409).json({ error: 'This email is already in use by another account.', code: 'EMAIL_IN_USE' });
        }
      } catch (err) {
        if (err.code !== 'auth/user-not-found') throw err;
      }

      authUp.email              = norm;
      authUp.emailVerified      = false;
      rtdbUp['basic/email']          = norm;
      rtdbUp['basic/emailVerified']  = false;
      rtdbUp['basic/status']         = STATUS.PENDING;
      fsUp.email         = norm;
      fsUp.emailVerified = false;
      fsUp.status        = STATUS.PENDING;
      emailChanged = true;

      // Bust Redis email cache for old email
      const oldUser = await admin.auth().getUser(uid);
      if (oldUser.email) await rDel(K.emailToUid(oldUser.email));
      // Cache new email
      await rSet(K.emailToUid(norm), uid, TTL.EMAIL_UID);
    }

    await admin.auth().updateUser(uid, authUp);
    await adminDb.ref(`users/${uid}`).update(rtdbUp);
    await admin.firestore().collection('users').doc(uid).update(fsUp);

    AuditLog.record(AuditLog.EVENTS.PROFILE_UPDATED, {
      userId: uid, ip, userAgent, metadata: { updatedFields: Object.keys(authUp) },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: emailChanged
        ? 'Profile updated. Please verify your new email address to reactivate your account.'
        : 'Profile updated.',
      ...(emailChanged && {
        requiresEmailVerification: true,
        newStatus: STATUS.PENDING,
        hint: 'Check your new inbox for a verification link.',
      }),
    });

  } catch (err) {
    console.error('[updateProfileAdvanced]', err.message);
    return res.status(500).json({ error: 'Failed to update profile.', code: 'PROFILE_UPDATE_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════
   DELETE ACCOUNT
   DELETE /api/users/account
   Soft-deletes DB records, then hard-deletes Firebase Auth.
══════════════════════════════════════════════════════════════ */
export const deleteAccount = async (req, res) => {
  const uid       = req.uid;
  const ip        = getIp(req);
  const userAgent = getUserAgent(req);
  const now       = new Date().toISOString();

  try {
    // Soft-delete DB first (preserves audit trail even if Auth delete fails)
    await Promise.all([
      adminDb.ref(`users/${uid}`).update({
        'basic/status':    'deleted',
        'basic/deletedAt': now,
        'basic/updatedAt': now,
      }),
      admin.firestore().collection('users').doc(uid).update({
        status:    'deleted',
        deletedAt: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
    ]);

    // Bust Redis cache
    const fbUser = await admin.auth().getUser(uid).catch(() => null);
    if (fbUser?.email) await rDel(K.emailToUid(fbUser.email));
    await rDel(K.profile(uid));

    // Hard-delete Firebase Auth
    await admin.auth().deleteUser(uid);

    // Clear session cookies
    const prod = process.env.NODE_ENV === 'production';
    res.clearCookie(prod ? '__Host-session' : '__session', { path: '/' });
    res.clearCookie('__refresh', { path: '/auth/refresh' });
    res.clearCookie('__csrf',    { path: '/' });

    AuditLog.record(AuditLog.EVENTS.ACCOUNT_DELETED, { userId: uid, ip, userAgent }).catch(() => {});

    return res.status(200).json({ success: true, message: 'Account deleted successfully.' });

  } catch (err) {
    console.error('[deleteAccount]', err.message);
    return res.status(500).json({ error: 'Failed to delete account.', code: 'ACCOUNT_DELETION_FAILED' });
  }
};