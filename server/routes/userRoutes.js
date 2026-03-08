/**
 * routes/userRoutes.js
 * ═══════════════════════════════════════════════════════════════════
 * Self-service profile endpoints.
 * Users can only change their own displayName.
 * Role, permissions, status changes are admin-only.
 *
 * All writes use Admin SDK — no client SDK here.
 * ═══════════════════════════════════════════════════════════════════
 */
import { Router }       from 'express';
import { admin, adminDb, adminFirestore } from '../config/firebase.js';
import { getUserById }  from '../models/user.js';
import {
  changePassword, updateProfile, deleteAccount,
}                       from '../controllers/auth/userController.js';
import {
  verifyToken,
  requireActiveAccount,
}                       from '../middlewares/auth.js';
import { apiRateLimiter } from '../middlewares/rateLimiter.js';

const router = Router();
router.use(verifyToken, apiRateLimiter);

/* ══════════════════════════════════════════════════════════════════
   GET /api/users/profile
   ══════════════════════════════════════════════════════════════════ */
router.get('/profile', async (req, res) => {
  try {
    const user = await getUserById(req.uid);
    if (!user) return res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' });

    const { basic, permissions, meta } = user;
    return res.status(200).json({
      uid:           req.uid,
      displayName:   basic?.displayName,
      email:         basic?.email,
      role:          basic?.role,
      status:        basic?.status,
      emailVerified: basic?.emailVerified,
      adminApproved: basic?.adminApproved,
      permissions,
      lastLogin:     meta?.lastLogin,
      createdAt:     basic?.createdAt,
    });
  } catch (err) {
    console.error('GET /profile error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch profile', code: 'SERVER_ERROR' });
  }
});

/* ══════════════════════════════════════════════════════════════════
   PATCH /api/users/profile — displayName only
   ══════════════════════════════════════════════════════════════════ */
router.patch('/profile', requireActiveAccount, async (req, res) => {
  const { displayName } = req.body;

  if (!displayName?.trim())
    return res.status(400).json({ error: 'displayName is required', code: 'MISSING_FIELDS' });

  if (displayName.trim().length < 2 || displayName.trim().length > 50)
    return res.status(400).json({
      error: 'displayName must be between 2 and 50 characters',
      code:  'INVALID_LENGTH',
    });

  const trimmed = displayName.trim();
  const now     = new Date().toISOString();

  try {
    // ── RTDB (Admin SDK) ──────────────────────────────────────────
    await adminDb.ref(`users/${req.uid}`).update({
      'basic/displayName': trimmed,
      'basic/updatedAt':   now,
    });

    // ── Firestore (Admin SDK) ─────────────────────────────────────
    await adminFirestore.collection('users').doc(req.uid).update({
      displayName: trimmed,
      updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success:     true,
      message:     'Profile updated successfully.',
      displayName: trimmed,
    });
  } catch (err) {
    console.error('PATCH /profile error:', err.message);
    return res.status(500).json({ error: 'Failed to update profile', code: 'SERVER_ERROR' });
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/users/change-password
   ══════════════════════════════════════════════════════════════ */
router.post('/change-password', requireActiveAccount, changePassword);

/* ══════════════════════════════════════════════════════════════
   PATCH /api/users/profile-advanced  (email + displayName)
   ══════════════════════════════════════════════════════════════ */
router.patch('/profile-advanced', requireActiveAccount, updateProfile);

/* ══════════════════════════════════════════════════════════════
   DELETE /api/users/account
   ══════════════════════════════════════════════════════════════ */
router.delete('/account', requireActiveAccount, deleteAccount);

export default router;