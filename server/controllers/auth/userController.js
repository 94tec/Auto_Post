/**
 * services/userService.js
 * ═══════════════════════════════════════════════════════════════════
 * Account-management operations for signed-in users.
 * "Things you do to your own account once you're already in."
 *
 * WHAT LIVES HERE
 * ───────────────────────────────────────────────────────────────────
 *  checkExistingUser(email)  — duplicate-email helper (called by
 *                              authController.register, not a route)
 *  changePassword(req, res)  — POST /api/users/change-password
 *  updateProfile(req, res)   — PATCH /api/users/profile-advanced
 *  deleteAccount(req, res)   — DELETE /api/users/account
 *
 * WHAT WAS REMOVED vs OLD VERSION
 * ───────────────────────────────────────────────────────────────────
 *  createUserAccount  — duplicate of the inline rollback logic in
 *                       authController.register. Removed to avoid two
 *                       implementations of the same thing.
 *
 *  forgotPassword     — moved to authController.js because it lives
 *  verifyResetLink      on /api/auth/* routes. Auth controller owns
 *  resetPassword        everything on those routes consistently.
 *
 * DESIGN NOTES
 * ───────────────────────────────────────────────────────────────────
 *  • Admin SDK exclusively — no client SDK, no rule hits
 *  • Passwords are never stored in our DB — Firebase Auth owns them.
 *    hashPassword / verifyPassword are intentionally absent.
 *  • changePassword delegates entirely to admin.auth().updateUser().
 *    The user does NOT need to provide their current password here
 *    because they are already authenticated (verifyToken ran). If you
 *    want to require the current password as extra confirmation, you
 *    would re-authenticate via Firebase REST API before calling this.
 *  • updateProfile handles both displayName and email changes.
 *    Email changes reset status→pending and emailVerified→false so
 *    the user must re-verify before being fully active again.
 *    For displayName-only changes, use PATCH /api/users/profile
 *    (userRoutes.js) which is slightly lighter.
 * ═══════════════════════════════════════════════════════════════════
 */

import { admin, adminDb, adminFirestore } from '../../config/firebase.js';
import AuditLog                           from '../../services/auditLog.js';
import { validatePasswordStrength }       from '../../utils/validator.js';
import { STATUS }                         from '../../config/roles.js';

/* ── Shared request helpers ──────────────────────────────────────── */
const getIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
  req.ip ||
  req.connection?.remoteAddress ||
  'unknown';

const getUserAgent = (req) => req.headers['user-agent'] || 'unknown';

/* ══════════════════════════════════════════════════════════════════
   CHECK EXISTING USER
   Pure helper — no HTTP req/res. Called by authController.register
   before creating any Firebase resource to block duplicate emails.
   ══════════════════════════════════════════════════════════════════ */

/**
 * Checks Firebase Auth for an existing account with this email.
 * @param {string} email — already trimmed + lowercased
 * @returns {Promise<{ exists: boolean, isVerified?: boolean }>}
 */
export const checkExistingUser = async (email) => {
  try {
    const record = await admin.auth().getUserByEmail(email.toLowerCase().trim());
    return { exists: true, isVerified: record.emailVerified };
  } catch (err) {
    if (err.code === 'auth/user-not-found') return { exists: false };
    throw err; // unexpected — bubble up to caller
  }
};

/* ══════════════════════════════════════════════════════════════════
   CHANGE PASSWORD  (signed-in user)
   POST /api/users/change-password
   Requires verifyToken + requireActiveAccount middleware.

   The user is already authenticated — we trust the session.
   If you want to require current-password confirmation before
   allowing a change, re-authenticate via Firebase REST API first
   (same pattern as login in authController.authenticateWithFirebase).

   After success, all other sessions are revoked so stolen tokens
   can't be reused on other devices.
   ══════════════════════════════════════════════════════════════════ */
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
    return res.status(400).json({ error: pwCheck.reason, code: 'WEAK_PASSWORD', failed: pwCheck.failed });
  }

  try {
    // Firebase Auth owns the password — update through Admin SDK
    await admin.auth().updateUser(uid, { password: newPassword });

    // Revoke all refresh tokens (logs out all other devices)
    await admin.auth().revokeRefreshTokens(uid);

    // Record timestamp in RTDB — non-fatal
    adminDb.ref(`users/${uid}/security`).update({
      lastPasswordChange: new Date().toISOString(),
    }).catch(() => {});

    AuditLog.record(AuditLog.EVENTS.PASSWORD_CHANGED, {
      userId:    uid,
      ip,
      userAgent,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully. Other sessions have been signed out.',
    });

  } catch (err) {
    console.error('[changePassword]', err.message);
    return res.status(500).json({ error: 'Failed to change password.', code: 'PASSWORD_CHANGE_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════════
   UPDATE PROFILE  (signed-in user)
   PATCH /api/users/profile-advanced
   Requires verifyToken + requireActiveAccount middleware.

   Handles displayName and/or email changes:
     — displayName only: updates Firebase Auth + RTDB + Firestore
     — email change:     updates all three + resets emailVerified=false
                         and status=pending so re-verification is required

   For displayName-only changes you can also use the lighter
   PATCH /api/users/profile in userRoutes.js.
   ══════════════════════════════════════════════════════════════════ */
export const updateProfile = async (req, res) => {
  const { displayName, email } = req.body;
  const uid       = req.uid;
  const ip        = getIp(req);
  const userAgent = getUserAgent(req);

  if (!displayName && !email) {
    return res.status(400).json({ error: 'At least one field is required.', code: 'MISSING_FIELDS' });
  }

  try {
    const authUpdates = {};
    const rtdbUpdates = { 'basic/updatedAt': new Date().toISOString() };
    const fsUpdates   = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    // ── displayName ───────────────────────────────────────────────
    if (displayName?.trim()) {
      const trimmed = displayName.trim();
      if (trimmed.length < 2 || trimmed.length > 50) {
        return res.status(400).json({ error: 'displayName must be 2–50 characters.', code: 'INVALID_LENGTH' });
      }
      authUpdates.displayName          = trimmed;
      rtdbUpdates['basic/displayName'] = trimmed;
      fsUpdates.displayName            = trimmed;
    }

    // ── email ─────────────────────────────────────────────────────
    if (email?.trim()) {
      const normalised = email.trim().toLowerCase();

      // Block if another account already owns this email
      try {
        const existing = await admin.auth().getUserByEmail(normalised);
        if (existing.uid !== uid) {
          return res.status(409).json({ error: 'Email already in use.', code: 'EMAIL_IN_USE' });
        }
      } catch (err) {
        if (err.code !== 'auth/user-not-found') throw err;
        // auth/user-not-found means the email is available — continue
      }

      authUpdates.email              = normalised;
      authUpdates.emailVerified      = false;           // must re-verify new email
      rtdbUpdates['basic/email']          = normalised;
      rtdbUpdates['basic/emailVerified']  = false;
      rtdbUpdates['basic/status']         = STATUS.PENDING; // back to pending until verified
      fsUpdates.email                = normalised;
      fsUpdates.emailVerified        = false;
      fsUpdates.status               = STATUS.PENDING;
    }

    // ── Write all three stores ────────────────────────────────────
    await admin.auth().updateUser(uid, authUpdates);
    await adminDb.ref(`users/${uid}`).update(rtdbUpdates);
    await adminFirestore.collection('users').doc(uid).update(fsUpdates);

    AuditLog.record(AuditLog.EVENTS.PROFILE_UPDATED, {
      userId:    uid,
      ip,
      userAgent,
      metadata:  { updatedFields: Object.keys(authUpdates) },
    }).catch(() => {});

    const emailChanged = !!authUpdates.email;
    return res.status(200).json({
      success:  true,
      message:  emailChanged
        ? 'Profile updated. Please verify your new email address to reactivate your account.'
        : 'Profile updated.',
      ...(emailChanged && { requiresEmailVerification: true, newStatus: STATUS.PENDING }),
    });

  } catch (err) {
    console.error('[updateProfile]', err.message);
    return res.status(500).json({ error: 'Failed to update profile.', code: 'PROFILE_UPDATE_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════════
   DELETE ACCOUNT  (signed-in user)
   DELETE /api/users/account
   Requires verifyToken + requireActiveAccount middleware.

   Soft-deletes RTDB + Firestore records (preserves audit trail),
   then hard-deletes from Firebase Auth (removes login credentials).
   Clears all session cookies after deletion.
   ══════════════════════════════════════════════════════════════════ */
export const deleteAccount = async (req, res) => {
  const uid       = req.uid;
  const ip        = getIp(req);
  const userAgent = getUserAgent(req);
  const now       = new Date().toISOString();

  try {
    // ── Soft-delete DB records first ──────────────────────────────
    // (do this before Firebase Auth so we still have UID if something fails)
    await adminDb.ref(`users/${uid}`).update({
      'basic/status':    'deleted',
      'basic/deletedAt': now,
      'basic/updatedAt': now,
    });

    await adminFirestore.collection('users').doc(uid).update({
      status:    'deleted',
      deletedAt: now,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ── Hard-delete Firebase Auth record ──────────────────────────
    await admin.auth().deleteUser(uid);

    // ── Clear session cookies ─────────────────────────────────────
    const prod        = process.env.NODE_ENV === 'production';
    const sessionName = prod ? '__Host-session' : '__session';
    res.clearCookie(sessionName, { path: '/' });
    res.clearCookie('__refresh',  { path: '/auth/refresh' });
    res.clearCookie('__csrf',     { path: '/' });

    AuditLog.record(AuditLog.EVENTS.ACCOUNT_DELETED, {
      userId:    uid,
      ip,
      userAgent,
    }).catch(() => {});

    return res.status(200).json({ success: true, message: 'Account deleted successfully.' });

  } catch (err) {
    console.error('[deleteAccount]', err.message);
    return res.status(500).json({ error: 'Failed to delete account.', code: 'ACCOUNT_DELETION_FAILED' });
  }
};