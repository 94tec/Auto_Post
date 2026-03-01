/**
 * controllers/adminController.js
 * ═══════════════════════════════════════════════════════════════════
 * Admin-only operations. Every route using this controller MUST be
 * protected by [verifyToken, requireAdmin] in adminRoutes.js.
 *
 * KEY FLOWS
 * ───────────────────────────────────────────────────────────────────
 *  GUEST UPGRADE (2-step):
 *    Step 1 — user verifies email (authController.verifyEmail)
 *             → status: pending → awaiting
 *             → added to Firestore approvalQueue
 *    Step 2 — admin calls POST /admin/users/:uid/approve
 *             → adminApproved=true
 *             → if emailVerified=true → promoted to user, status=active
 *             → removed from approvalQueue
 *
 *  WRITE ACCESS:
 *    POST /admin/users/:uid/grant-write
 *    → user must already be role=user + status=active + emailVerified
 *    → sets permissions.write = true
 * ═══════════════════════════════════════════════════════════════════
 */

import { admin }                from '../../config/firebase.js';
import {
  getAllUsers, getUserById,
  adminApproveUser,
  grantWriteAccess, revokeWriteAccess,
  overridePermissions, setAccountStatus,
  getApprovalQueue,
}                               from '../../models/user.js';
import { ROLES, STATUS,
         GRANTABLE_TO_USERS }   from '../../config/roles.js';
import AuditLog                 from '../../services/auditLog.js';

const myUid = (req) => req.uid;

/* ══════════════════════════════════════════════════════════════════
   APPROVAL QUEUE  (guests who verified email, awaiting admin step)
   ══════════════════════════════════════════════════════════════════ */

/** GET /api/admin/approval-queue */
export const getQueue = async (req, res) => {
  try {
    const queue = await getApprovalQueue();
    return res.status(200).json({ queue, total: queue.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch approval queue', code: 'SERVER_ERROR' });
  }
};

/**
 * POST /api/admin/users/:uid/approve
 * Approve a guest who has already verified their email.
 * If email is verified → immediately promoted to user (role=user, status=active).
 * If email NOT yet verified → adminApproved=true stored, promotion deferred.
 */
export const approveUser = async (req, res) => {
  const { uid } = req.params;

  try {
    const user = await getUserById(uid);
    if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });

    if (user.basic?.role !== ROLES.GUEST)
      return res.status(400).json({ error: 'Only guests can be approved', code: 'NOT_GUEST' });

    if (user.basic?.adminApproved)
      return res.status(200).json({ message: 'User already approved.', code: 'ALREADY_APPROVED' });

    const { promoted, status, role } = await adminApproveUser(uid, myUid(req));

    await AuditLog.record(AuditLog.EVENTS.GUEST_APPROVED, {
      userId:    myUid(req),
      ip:        req.ip,
      userAgent: req.headers['user-agent'],
      metadata:  { targetUid: uid, promoted, newStatus: status },
    });

    if (promoted) {
      await AuditLog.record(AuditLog.EVENTS.GUEST_PROMOTED, {
        userId:    myUid(req),
        ip:        req.ip,
        userAgent: req.headers['user-agent'],
        metadata:  { targetUid: uid, newRole: role },
      });
    }

    return res.status(200).json({
      success:  true,
      promoted,
      role,
      status,
      message: promoted
        ? `User ${uid} promoted to "${ROLES.USER}" and account activated.`
        : `User ${uid} approved. Awaiting their email verification to complete promotion.`,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message, code: 'APPROVE_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════════
   USER LIST
   ══════════════════════════════════════════════════════════════════ */

/** GET /api/admin/users?role=user&status=active */
export const listUsers = async (req, res) => {
  try {
    const { role, status } = req.query;
    const users = await getAllUsers({ role, status });

    const sanitised = users.map(({ uid, displayName, email, role: r,
      status: s, emailVerified, adminApproved, permissions, createdAt, meta }) => ({
      uid, displayName, email,
      role: r, status: s, emailVerified, adminApproved,
      permissions, lastLogin: meta?.lastLogin, createdAt,
    }));

    return res.status(200).json({ users: sanitised, total: sanitised.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch users', code: 'SERVER_ERROR' });
  }
};

/** GET /api/admin/users/:uid */
export const getUserDetail = async (req, res) => {
  try {
    const user = await getUserById(req.params.uid);
    if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    return res.status(200).json({ user });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user', code: 'SERVER_ERROR' });
  }
};

/* ══════════════════════════════════════════════════════════════════
   WRITE ACCESS  (primary admin→user action after approval)
   ══════════════════════════════════════════════════════════════════ */

/** POST /api/admin/users/:uid/grant-write */
export const grantWrite = async (req, res) => {
  const { uid } = req.params;
  try {
    await grantWriteAccess(uid, myUid(req));
    await AuditLog.record(AuditLog.EVENTS.PERMISSION_GRANTED, {
      userId: myUid(req), ip: req.ip, userAgent: req.headers['user-agent'],
      metadata: { targetUid: uid, permission: 'write' },
    });
    return res.status(200).json({ success: true, message: `Write access granted to ${uid}.` });
  } catch (err) {
    return res.status(400).json({ error: err.message, code: 'GRANT_FAILED' });
  }
};

/** POST /api/admin/users/:uid/revoke-write */
export const revokeWrite = async (req, res) => {
  const { uid } = req.params;
  try {
    await revokeWriteAccess(uid, myUid(req));
    await AuditLog.record(AuditLog.EVENTS.PERMISSION_REVOKED, {
      userId: myUid(req), ip: req.ip, userAgent: req.headers['user-agent'],
      metadata: { targetUid: uid, permission: 'write' },
    });
    return res.status(200).json({ success: true, message: `Write access revoked from ${uid}.` });
  } catch (err) {
    return res.status(400).json({ error: err.message, code: 'REVOKE_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════════
   GRANULAR PERMISSION OVERRIDE
   ══════════════════════════════════════════════════════════════════ */

/**
 * PATCH /api/admin/users/:uid/permissions
 * Body: { permissions: { write: true, delete: false } }
 * Only GRANTABLE_TO_USERS keys are accepted.
 */
export const patchPermissions = async (req, res) => {
  const { uid }         = req.params;
  const { permissions } = req.body;

  if (!permissions || typeof permissions !== 'object')
    return res.status(400).json({ error: 'permissions object required', code: 'INVALID_BODY' });

  const safe = Object.fromEntries(
    Object.entries(permissions).filter(([k]) => GRANTABLE_TO_USERS.includes(k)),
  );

  if (!Object.keys(safe).length)
    return res.status(400).json({
      error:   'No valid permission keys',
      code:    'INVALID_PERMISSIONS',
      allowed: GRANTABLE_TO_USERS,
    });

  try {
    await overridePermissions(uid, safe, myUid(req));
    await AuditLog.record(AuditLog.EVENTS.PERMISSION_OVERRIDE, {
      userId: myUid(req), ip: req.ip, userAgent: req.headers['user-agent'],
      metadata: { targetUid: uid, changes: safe },
    });
    return res.status(200).json({ success: true, updated: safe });
  } catch (err) {
    return res.status(400).json({ error: err.message, code: 'OVERRIDE_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════════
   ACCOUNT STATUS — suspend / reactivate
   ══════════════════════════════════════════════════════════════════ */

/** POST /api/admin/users/:uid/suspend */
export const suspendUser = async (req, res) => {
  const { uid } = req.params;
  if (uid === myUid(req))
    return res.status(400).json({ error: 'Cannot suspend your own account', code: 'SELF_ACTION' });

  try {
    const user = await getUserById(uid);
    if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    if (user.basic?.role === ROLES.ADMIN)
      return res.status(403).json({ error: 'Cannot suspend another admin', code: 'FORBIDDEN' });

    await setAccountStatus(uid, STATUS.SUSPENDED, myUid(req));
    await admin.auth().updateUser(uid, { disabled: true });

    await AuditLog.record(AuditLog.EVENTS.USER_SUSPENDED, {
      userId: myUid(req), ip: req.ip, userAgent: req.headers['user-agent'],
      metadata: { targetUid: uid },
    });

    return res.status(200).json({ success: true, message: `User ${uid} suspended.` });
  } catch (err) {
    return res.status(500).json({ error: err.message, code: 'SUSPEND_FAILED' });
  }
};

/** POST /api/admin/users/:uid/reactivate */
export const reactivateUser = async (req, res) => {
  const { uid } = req.params;
  try {
    const user = await getUserById(uid);
    if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });

    await setAccountStatus(uid, STATUS.ACTIVE, myUid(req));
    await admin.auth().updateUser(uid, { disabled: false });

    await AuditLog.record(AuditLog.EVENTS.USER_REACTIVATED, {
      userId: myUid(req), ip: req.ip, userAgent: req.headers['user-agent'],
      metadata: { targetUid: uid },
    });

    return res.status(200).json({ success: true, message: `User ${uid} reactivated.` });
  } catch (err) {
    return res.status(500).json({ error: err.message, code: 'REACTIVATE_FAILED' });
  }
};

/* ══════════════════════════════════════════════════════════════════
   PENDING WRITE ACCESS QUEUE
   ══════════════════════════════════════════════════════════════════ */

/**
 * GET /api/admin/pending-write
 * Lists active users who are eligible for write access (active but write=false).
 */
export const getPendingWriteAccess = async (req, res) => {
  try {
    const users   = await getAllUsers({ role: ROLES.USER, status: STATUS.ACTIVE });
    const pending = users
      .filter((u) => !u.permissions?.write)
      .map(({ uid, displayName, email, permissions, createdAt }) => ({
        uid, displayName, email, permissions, createdAt,
      }));
    return res.status(200).json({ pending, total: pending.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch', code: 'SERVER_ERROR' });
  }
};

/* ══════════════════════════════════════════════════════════════════
   AUDIT LOGS + STATS
   ══════════════════════════════════════════════════════════════════ */

/** GET /api/admin/audit-logs?limit=100&userId=xxx */
export const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.getRecent({
      limit:  Number(req.query.limit || 100),
      userId: req.query.userId,
    });
    return res.status(200).json({ logs });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch logs', code: 'SERVER_ERROR' });
  }
};

/** GET /api/admin/stats */
export const getStats = async (req, res) => {
  try {
    const all   = await getAllUsers();
    const stats = {
      total: all.length,
      byRole:   { admin: 0, user: 0, guest: 0 },
      byStatus: { pending: 0, awaiting: 0, active: 0, suspended: 0 },
      awaitingApproval:    0,
      awaitingWriteAccess: 0,
    };

    for (const u of all) {
      const r = u.role   || u.basic?.role;
      const s = u.status || u.basic?.status;
      if (r && stats.byRole[r]   !== undefined) stats.byRole[r]++;
      if (s && stats.byStatus[s] !== undefined) stats.byStatus[s]++;
      if (s === STATUS.AWAITING)                                stats.awaitingApproval++;
      if (r === ROLES.USER && s === STATUS.ACTIVE && !u.permissions?.write)
        stats.awaitingWriteAccess++;
    }

    return res.status(200).json({ stats });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch stats', code: 'SERVER_ERROR' });
  }
};