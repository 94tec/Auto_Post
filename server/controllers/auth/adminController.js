/**
 * controllers/adminController.js
 * ═══════════════════════════════════════════════════════════════
 * Admin-only operations. Protected by [verifyToken, requireAdmin].
 *
 * NEW IN THIS VERSION
 * ───────────────────────────────────────────────────────────────
 *  createAdmin  — caches new admin in Redis, sends admin welcome
 *                 email with next-steps, sets mustChangePassword flag
 *  createUser   — admin creates a pre-approved user account
 *  All user reads now check Redis cache first (O(1) lookup)
 * ═══════════════════════════════════════════════════════════════
 */

import { admin, adminDb }        from '../../config/firebase.js';
import {
  getAllUsers, getUserById,
  adminApproveUser,
  grantWriteAccess, revokeWriteAccess,
  overridePermissions, setAccountStatus,
  getApprovalQueue,
}                                from '../../models/user.js';
import {
  sendApprovalEmail,
  sendAdminWelcomeEmail,
  sendUserCreatedEmail,
}                                from '../../services/emailService.js';
import { ROLES, STATUS, GRANTABLE_TO_USERS } from '../../config/roles.js';
import AuditLog                  from '../../services/auditLog.js';
import {
  rGet, rSet, rDel, K, TTL,
  writeUserToRTDB, writeUserToFirestore,
}                                from '../auth/authHelpers.js';

const myUid = (req) => req.uid;

/* ── Shared helpers ──────────────────────────────────────────── */
const getIp        = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
const getUserAgent = (req) => req.headers['user-agent'] || 'unknown';

/* ── Cache a user profile after admin creates it ────────────── */
const cacheAdminCreatedUser = async (uid, email, profile) => {
  const payload = JSON.stringify({ ...profile, cachedAt: Date.now() });
  await Promise.all([
    rSet(K.emailToUid(email), uid,     TTL.EMAIL_UID),
    rSet(K.profile(uid),      payload, TTL.PROFILE),
  ]);
};

/* ── Invalidate a user's profile cache ───────────────────────── */
const bustUserCache = async (uid, email) => {
  await Promise.all([
    rDel(K.profile(uid)),
    email && rDel(K.emailToUid(email)),
  ].filter(Boolean));
};

/* ══════════════════════════════════════════════════════════════
   CREATE ADMIN  (seeded admin or existing admin adds another)
   POST /api/admin/users
   Body: { email, password, displayName }
   • emailVerified = true  (admins skip verification)
   • mustChangePassword = true  (temp password must be changed)
   • Sends admin welcome email with next-steps
   • Caches profile in Redis
══════════════════════════════════════════════════════════════ */
export const createAdmin = async (req, res) => {
  const { email, password, displayName } = req.body;
  const creatorUid = myUid(req);

  /* Validation ─────────────────────────────────────────────── */
  if (!email?.trim() || !password || !displayName?.trim()) {
    return res.status(400).json({
      error:   'Email, password, and display name are required.',
      code:    'MISSING_FIELDS',
      missing: [!email?.trim() && 'email', !password && 'password', !displayName?.trim() && 'displayName'].filter(Boolean),
    });
  }
  if (password.length < 8) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters.',
      code:  'WEAK_PASSWORD',
      hint:  'Use a temporary password — the new admin will be required to change it on first login.',
    });
  }

  const normEmail = email.trim().toLowerCase();

  /* Fast duplicate check via Redis ─────────────────────────── */
  const cachedUid = await rGet(K.emailToUid(normEmail));
  if (cachedUid) {
    return res.status(409).json({ error: 'An account with this email already exists.', code: 'EMAIL_EXISTS' });
  }

  try {
    /* Check Firebase Auth ──────────────────────────────────── */
    try {
      await admin.auth().getUserByEmail(normEmail);
      return res.status(409).json({ error: 'An account with this email already exists.', code: 'EMAIL_EXISTS' });
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
    }

    /* Create Firebase Auth user ────────────────────────────── */
    const firebaseUser = await admin.auth().createUser({
      email:         normEmail,
      password,
      displayName:   displayName.trim(),
      emailVerified: true,   // admins skip email verification
      disabled:      false,
    });
    const { uid } = firebaseUser;
    const now     = new Date().toISOString();

    /* Write RTDB ───────────────────────────────────────────── */
    await adminDb.ref('/').update({
      [`users/${uid}/basic/uid`]:              uid,
      [`users/${uid}/basic/email`]:            normEmail,
      [`users/${uid}/basic/displayName`]:      displayName.trim(),
      [`users/${uid}/basic/role`]:             ROLES.ADMIN,
      [`users/${uid}/basic/status`]:           STATUS.ACTIVE,
      [`users/${uid}/basic/emailVerified`]:    true,
      [`users/${uid}/basic/adminApproved`]:    true,
      [`users/${uid}/basic/mustChangePassword`]: true,  // ← force change on first login
      [`users/${uid}/basic/createdAt`]:        now,
      [`users/${uid}/basic/updatedAt`]:        now,
      [`users/${uid}/basic/createdBy`]:        creatorUid,
      [`users/${uid}/permissions/read`]:       true,
      [`users/${uid}/permissions/write`]:      true,
      [`users/${uid}/permissions/delete`]:     true,
      [`users/${uid}/permissions/manageUsers`]:true,
      [`users/${uid}/permissions/accessAdmin`]:true,
      [`users/${uid}/meta/lastLogin`]:         null,
      [`users/${uid}/meta/createdAt`]:         now,
      [`users/${uid}/meta/createdBy`]:         creatorUid,
    });

    /* Write Firestore mirror ───────────────────────────────── */
    await admin.firestore().collection('users').doc(uid).set({
      uid,
      email:               normEmail,
      displayName:         displayName.trim(),
      role:                ROLES.ADMIN,
      status:              STATUS.ACTIVE,
      emailVerified:       true,
      adminApproved:       true,
      mustChangePassword:  true,
      permissions: { read:true, write:true, delete:true, manageUsers:true, accessAdmin:true },
      createdAt:   now,
      updatedAt:   now,
      createdBy:   creatorUid,
    }, { merge: true });

    /* Cache new admin in Redis ──────────────────────────────── */
    await cacheAdminCreatedUser(uid, normEmail, {
      uid, email: normEmail, displayName: displayName.trim(),
      role: ROLES.ADMIN, status: STATUS.ACTIVE,
      emailVerified: true, adminApproved: true, mustChangePassword: true,
    });

    /* Send admin welcome email (fire-and-forget) ───────────── */
    sendAdminWelcomeEmail({
      email:       normEmail,
      displayName: displayName.trim(),
      tempPassword: password,    // shown in email — must be changed
      createdBy:   req.user?.basic?.displayName || 'Admin',
    }).catch(err => console.error('[Admin] Welcome email failed:', err.message));

    /* Audit log ────────────────────────────────────────────── */
    AuditLog.record('ADMIN_CREATED', {
      userId: creatorUid, ip: getIp(req), userAgent: getUserAgent(req),
      metadata: { targetUid: uid, email: normEmail },
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: `Admin account created for ${normEmail}. A welcome email with login instructions has been sent.`,
      uid,
      note: 'The new admin must change their password on first login before gaining full access.',
    });

  } catch (err) {
    console.error('[createAdmin]', err.message);
    return res.status(500).json({ error: 'Failed to create admin account.', code: 'ADMIN_CREATE_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════
   CREATE USER  (admin creates a pre-approved user)
   POST /api/admin/users/create-user
   Body: { email, password, displayName, grantWrite? }
   • role=user, status=active, adminApproved=true
   • Skips the normal guest→verify→approve flow
   • Sends a welcome email to the new user
══════════════════════════════════════════════════════════════ */
export const createUser = async (req, res) => {
  const { email, password, displayName, grantWrite = false } = req.body;
  const creatorUid = myUid(req);

  if (!email?.trim() || !password || !displayName?.trim()) {
    return res.status(400).json({
      error:   'Email, password, and display name are required.',
      code:    'MISSING_FIELDS',
    });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.', code: 'WEAK_PASSWORD' });
  }

  const normEmail = email.trim().toLowerCase();

  /* Fast dup check ─────────────────────────────────────────── */
  const cached = await rGet(K.emailToUid(normEmail));
  if (cached) {
    return res.status(409).json({ error: 'An account with this email already exists.', code: 'EMAIL_EXISTS' });
  }

  try {
    try {
      await admin.auth().getUserByEmail(normEmail);
      return res.status(409).json({ error: 'An account with this email already exists.', code: 'EMAIL_EXISTS' });
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
    }

    const firebaseUser = await admin.auth().createUser({
      email: normEmail, password, displayName: displayName.trim(),
      emailVerified: true, disabled: false,
    });
    const { uid } = firebaseUser;
    const now     = new Date().toISOString();

    await adminDb.ref('/').update({
      [`users/${uid}/basic/uid`]:            uid,
      [`users/${uid}/basic/email`]:          normEmail,
      [`users/${uid}/basic/displayName`]:    displayName.trim(),
      [`users/${uid}/basic/role`]:           ROLES.USER,
      [`users/${uid}/basic/status`]:         STATUS.ACTIVE,
      [`users/${uid}/basic/emailVerified`]:  true,
      [`users/${uid}/basic/adminApproved`]:  true,
      [`users/${uid}/basic/createdAt`]:      now,
      [`users/${uid}/basic/updatedAt`]:      now,
      [`users/${uid}/basic/createdBy`]:      creatorUid,
      [`users/${uid}/permissions/read`]:     true,
      [`users/${uid}/permissions/write`]:    grantWrite,
      [`users/${uid}/permissions/delete`]:   false,
      [`users/${uid}/meta/lastLogin`]:       null,
      [`users/${uid}/meta/createdAt`]:       now,
    });

    await admin.firestore().collection('users').doc(uid).set({
      uid, email: normEmail, displayName: displayName.trim(),
      role: ROLES.USER, status: STATUS.ACTIVE,
      emailVerified: true, adminApproved: true,
      permissions: { read: true, write: grantWrite, delete: false },
      createdAt: now, updatedAt: now, createdBy: creatorUid,
    }, { merge: true });

    await cacheAdminCreatedUser(uid, normEmail, {
      uid, email: normEmail, displayName: displayName.trim(),
      role: ROLES.USER, status: STATUS.ACTIVE,
      emailVerified: true, adminApproved: true,
    });

    sendUserCreatedEmail({ email: normEmail, displayName: displayName.trim(), tempPassword: password })
      .catch(err => console.error('[Admin] User created email failed:', err.message));

    AuditLog.record('USER_CREATED_BY_ADMIN', {
      userId: creatorUid, ip: getIp(req), userAgent: getUserAgent(req),
      metadata: { targetUid: uid, email: normEmail, grantWrite },
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: `User account created for ${normEmail}. A welcome email has been sent.`,
      uid,
    });

  } catch (err) {
    console.error('[createUser]', err.message);
    return res.status(500).json({ error: 'Failed to create user account.', code: 'USER_CREATE_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════
   APPROVAL QUEUE
══════════════════════════════════════════════════════════════ */
export const getQueue = async (req, res) => {
  try {
    const queue = await getApprovalQueue();
    return res.status(200).json({ queue, total: queue.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch approval queue', code: 'SERVER_ERROR' });
  }
};

export const approveUser = async (req, res) => {
  const { uid } = req.params;
  try {
    const user = await getUserById(uid);
    if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    if (user.basic?.role !== ROLES.GUEST)
      return res.status(400).json({ error: 'Only guests can be approved.', code: 'NOT_GUEST' });
    if (user.basic?.adminApproved)
      return res.status(200).json({ message: 'User already approved.', code: 'ALREADY_APPROVED' });

    const { promoted, status, role } = await adminApproveUser(uid, myUid(req));

    /* Bust stale cache so next read gets fresh data ─────────── */
    await bustUserCache(uid, user.basic?.email);

    sendApprovalEmail({ email: user.basic?.email, displayName: user.basic?.displayName })
      .catch(err => console.error('[Admin] Approval email failed:', err.message));

    await AuditLog.record(AuditLog.EVENTS.GUEST_APPROVED, {
      userId: myUid(req), ip: getIp(req), userAgent: getUserAgent(req),
      metadata: { targetUid: uid, promoted, newStatus: status },
    });

    if (promoted) {
      await AuditLog.record(AuditLog.EVENTS.GUEST_PROMOTED, {
        userId: myUid(req), ip: getIp(req), userAgent: getUserAgent(req),
        metadata: { targetUid: uid, newRole: role },
      });
    }

    return res.status(200).json({
      success: true, promoted, role, status,
      message: promoted
        ? `User activated as "${ROLES.USER}". Welcome email sent.`
        : `Admin approval saved. Awaiting email verification.`,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message, code: 'APPROVE_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════
   USER LIST — Redis-cached reads
══════════════════════════════════════════════════════════════ */
export const listUsers = async (req, res) => {
  try {
    const { role, status } = req.query;
    const users = await getAllUsers({ role, status });
    const sanitised = users.map(({ uid, displayName, email, role: r, status: s,
      emailVerified, adminApproved, permissions, createdAt, meta }) => ({
      uid, displayName, email, role: r, status: s,
      emailVerified, adminApproved, permissions,
      lastLogin: meta?.lastLogin, createdAt,
    }));
    return res.status(200).json({ users: sanitised, total: sanitised.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch users', code: 'SERVER_ERROR' });
  }
};

export const getUserDetail = async (req, res) => {
  try {
    /* Cache-first read ───────────────────────────────────────── */
    const cached = await rGet(K.profile(req.params.uid));
    if (cached) {
      const profile = JSON.parse(cached);
      return res.status(200).json({ user: profile, fromCache: true });
    }
    const user = await getUserById(req.params.uid);
    if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });

    /* Prime cache for future reads ────────────────────────────── */
    rSet(K.profile(req.params.uid), JSON.stringify(user), TTL.PROFILE).catch(() => {});

    return res.status(200).json({ user });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user', code: 'SERVER_ERROR' });
  }
};

/* ══════════════════════════════════════════════════════════════
   WRITE ACCESS
══════════════════════════════════════════════════════════════ */
export const grantWrite = async (req, res) => {
  const { uid } = req.params;
  try {
    await grantWriteAccess(uid, myUid(req));
    await bustUserCache(uid, null);
    await AuditLog.record(AuditLog.EVENTS.PERMISSION_GRANTED, {
      userId: myUid(req), ip: getIp(req), userAgent: getUserAgent(req),
      metadata: { targetUid: uid, permission: 'write' },
    });
    return res.status(200).json({ success: true, message: `Write access granted to ${uid}.` });
  } catch (err) {
    return res.status(400).json({ error: err.message, code: 'GRANT_FAILED' });
  }
};

export const revokeWrite = async (req, res) => {
  const { uid } = req.params;
  try {
    await revokeWriteAccess(uid, myUid(req));
    await bustUserCache(uid, null);
    await AuditLog.record(AuditLog.EVENTS.PERMISSION_REVOKED, {
      userId: myUid(req), ip: getIp(req), userAgent: getUserAgent(req),
      metadata: { targetUid: uid, permission: 'write' },
    });
    return res.status(200).json({ success: true, message: `Write access revoked from ${uid}.` });
  } catch (err) {
    return res.status(400).json({ error: err.message, code: 'REVOKE_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════
   PERMISSIONS PATCH
══════════════════════════════════════════════════════════════ */
export const patchPermissions = async (req, res) => {
  const { uid } = req.params;
  const { permissions } = req.body;
  if (!permissions || typeof permissions !== 'object')
    return res.status(400).json({ error: 'permissions object required', code: 'INVALID_BODY' });

  const safe = Object.fromEntries(
    Object.entries(permissions).filter(([k]) => GRANTABLE_TO_USERS.includes(k))
  );
  if (!Object.keys(safe).length)
    return res.status(400).json({ error: 'No valid permission keys', code: 'INVALID_PERMISSIONS', allowed: GRANTABLE_TO_USERS });

  try {
    await overridePermissions(uid, safe, myUid(req));
    await bustUserCache(uid, null);
    await AuditLog.record(AuditLog.EVENTS.PERMISSION_OVERRIDE, {
      userId: myUid(req), ip: getIp(req), userAgent: getUserAgent(req),
      metadata: { targetUid: uid, changes: safe },
    });
    return res.status(200).json({ success: true, updated: safe });
  } catch (err) {
    return res.status(400).json({ error: err.message, code: 'OVERRIDE_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════
   ACCOUNT STATUS
══════════════════════════════════════════════════════════════ */
export const suspendUser = async (req, res) => {
  const { uid } = req.params;
  if (uid === myUid(req))
    return res.status(400).json({ error: 'Cannot suspend your own account.', code: 'SELF_ACTION' });
  try {
    const user = await getUserById(uid);
    if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    if (user.basic?.role === ROLES.ADMIN)
      return res.status(403).json({ error: 'Cannot suspend another admin.', code: 'FORBIDDEN' });
    await setAccountStatus(uid, STATUS.SUSPENDED, myUid(req));
    await admin.auth().updateUser(uid, { disabled: true });
    await bustUserCache(uid, user.basic?.email);
    await AuditLog.record(AuditLog.EVENTS.USER_SUSPENDED, {
      userId: myUid(req), ip: getIp(req), userAgent: getUserAgent(req),
      metadata: { targetUid: uid },
    });
    await revokeUserSession(uid, 'account_suspended').catch(e =>
      console.warn('[suspend] Session revoke non-fatal:', e.message)
    );
    return res.status(200).json({ success: true, message: `User ${uid} suspended.` });
  } catch (err) {
    return res.status(500).json({ error: err.message, code: 'SUSPEND_FAILED' });
  }
};
  
export const reactivateUser = async (req, res) => {
  const { uid } = req.params;
  try {
    const user = await getUserById(uid);
    if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    await setAccountStatus(uid, STATUS.ACTIVE, myUid(req));
    await admin.auth().updateUser(uid, { disabled: false });
    await bustUserCache(uid, user.basic?.email);
    await AuditLog.record(AuditLog.EVENTS.USER_REACTIVATED, {
      userId: myUid(req), ip: getIp(req), userAgent: getUserAgent(req),
      metadata: { targetUid: uid },
    });
    return res.status(200).json({ success: true, message: `User ${uid} reactivated.` });
  } catch (err) {
    return res.status(500).json({ error: err.message, code: 'REACTIVATE_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════
   PENDING WRITE / AUDIT LOGS / STATS
══════════════════════════════════════════════════════════════ */
export const getPendingWriteAccess = async (req, res) => {
  try {
    const users   = await getAllUsers({ role: ROLES.USER, status: STATUS.ACTIVE });
    const pending = users.filter(u => !u.permissions?.write)
      .map(({ uid, displayName, email, permissions, createdAt }) => ({ uid, displayName, email, permissions, createdAt }));
    return res.status(200).json({ pending, total: pending.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch', code: 'SERVER_ERROR' });
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.getRecent({ limit: Number(req.query.limit || 100), userId: req.query.userId });
    return res.status(200).json({ logs });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch logs', code: 'SERVER_ERROR' });
  }
};

export const getStats = async (req, res) => {
  try {
    const all   = await getAllUsers();
    const stats = {
      total: all.length,
      byRole:   { admin: 0, user: 0, guest: 0 },
      byStatus: { pending: 0, awaiting: 0, active: 0, suspended: 0 },
      awaitingApproval: 0, awaitingWriteAccess: 0,
    };
    for (const u of all) {
      const r = u.role || u.basic?.role;
      const s = u.status || u.basic?.status;
      if (r && stats.byRole[r]   !== undefined) stats.byRole[r]++;
      if (s && stats.byStatus[s] !== undefined) stats.byStatus[s]++;
      if (s === STATUS.AWAITING) stats.awaitingApproval++;
      if (r === ROLES.USER && s === STATUS.ACTIVE && !u.permissions?.write) stats.awaitingWriteAccess++;
    }
    return res.status(200).json({ stats });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch stats', code: 'SERVER_ERROR' });
  }
};
/**
 * POST /api/admin/users/:uid/revoke-session
 * Force-logs out a user from all devices.
 * Admin only.
 */
export const revokeSessionHandler = async (req, res) => {
  const { uid }    = req.params;
  const adminUid   = req.user?.uid;
 
  if (!uid) {
    return res.status(400).json({ error: 'UID required', code: 'MISSING_UID' });
  }
 
  try {
    // Get target user
    const fbUser = await admin.auth().getUser(uid);
 
    // Don't revoke your own session
    if (uid === adminUid) {
      return res.status(400).json({
        error: 'Cannot revoke your own session',
        code:  'SELF_ACTION',
      });
    }
 
    // Don't revoke another admin (unless you're a super admin — adjust as needed)
    const rtdbSnap = await adminDb.ref(`users/${uid}/basic/role`).get();
    if (rtdbSnap.val() === 'admin') {
      return res.status(403).json({
        error: 'Cannot revoke another admin\'s session',
        code:  'FORBIDDEN',
      });
    }
 
    await revokeUserSession(uid, `force_logout_by_admin_${adminUid}`);
 
    // Audit log
    AuditLog.record('SESSION_FORCE_REVOKED', {
      userId:   adminUid,
      metadata: { targetUid: uid, targetEmail: fbUser.email },
    }).catch(() => {});
 
    return res.status(200).json({
      success: true,
      message: `Session for ${fbUser.email} has been revoked. They will be signed out within 60 seconds.`,
    });
 
  } catch (err) {
    console.error('[revokeSession] Error:', err.message);
    return res.status(500).json({ error: 'Failed to revoke session', code: 'SERVER_ERROR' });
  }
};