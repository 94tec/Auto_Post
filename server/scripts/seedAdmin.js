/**
 * routes/userRoutes.js
 * Self-profile reads/updates. Role and permission changes blocked here.
 */
import { Router }              from 'express';
import { getUserById, updateUser } from '../models/user.js';  // RTDB update
import { updateDoc }           from 'firebase/firestore';
import { doc }                 from 'firebase/firestore';
import { firestore }           from '../config/firebase.js';
import { verifyToken, requireActiveAccount } from '../middlewares/auth.js';
import { apiRateLimiter }      from '../middlewares/rateLimiter.js';
import { serverTimestamp }     from 'firebase/firestore';

const router = Router();
router.use(verifyToken, apiRateLimiter);

/** GET /api/users/profile */
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
    return res.status(500).json({ error: 'Failed to fetch profile', code: 'SERVER_ERROR' });
  }
});

/** PATCH /api/users/profile — display name only */
router.patch('/profile', requireActiveAccount, async (req, res) => {
  const { displayName } = req.body;
  if (!displayName?.trim())
    return res.status(400).json({ error: 'displayName required', code: 'MISSING_FIELDS' });
  if (displayName.trim().length < 2 || displayName.trim().length > 50)
    return res.status(400).json({ error: 'displayName must be 2–50 characters', code: 'INVALID_LENGTH' });

  try {
    // Update RTDB
    const { ref: rtdbRef, update: rtdbUpdate } = await import('firebase/database');
    const { db } = await import('../config/firebase.js');
    await rtdbUpdate(rtdbRef(db, `users/${req.uid}`), {
      'basic/displayName': displayName.trim(),
      'basic/updatedAt':   new Date().toISOString(),
    });
    // Update Firestore
    await updateDoc(doc(firestore, 'users', req.uid), {
      displayName: displayName.trim(),
      updatedAt:   serverTimestamp(),
    });
    return res.status(200).json({ message: 'Profile updated', displayName: displayName.trim() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update', code: 'SERVER_ERROR' });
  }
});

export default router;