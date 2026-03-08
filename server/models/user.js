/**
 * models/user.js
 * ════════════════════════════════════════════════════════
 * All user DB operations — RTDB (primary) + Firestore (mirror).
 *
 * RTDB schema  users/{uid}/
 *   basic/
 *     uid, email, displayName, role, status,
 *     emailVerified, adminApproved, createdAt, updatedAt
 *   permissions/
 *     read, write, delete, manageUsers, accessAdmin
 *   meta/
 *     lastLogin, registeredIp, registeredAt
 *
 * Firestore mirror  users/{uid}  — flat, used for queries/audit.
 *
 * Functions consumed by your controllers (import names must match):
 *   createUser, getUserById, getAllUsers, recordLogin,
 *   markEmailVerified, adminApproveUser,
 *   grantWriteAccess, revokeWriteAccess,
 *   overridePermissions, setAccountStatus,
 *   getApprovalQueue
 * ════════════════════════════════════════════════════════
 */

import { admin, adminDb, firestore, FieldValue } from '../config/firebase.js';
import { ROLES, STATUS, buildDefaultPermissions } from '../config/roles.js';

/* ── RTDB helpers ──────────────────────────────────────── */
const userRef  = (uid) => admin.database().ref(`users/${uid}`);
const basicRef = (uid) => admin.database().ref(`users/${uid}/basic`);
const permsRef = (uid) => admin.database().ref(`users/${uid}/permissions`);
const metaRef  = (uid) => admin.database().ref(`users/${uid}/meta`);

/** Read a user from RTDB and return a unified object. Returns null if missing. */
export const getUserById = async (uid) => {
  const snap = await userRef(uid).once('value');
  if (!snap.exists()) return null;
  const data = snap.val();
  // Flatten for convenience: controllers can read user.basic.role, user.permissions.write, etc.
  return {
    uid,
    ...data,                    // basic, permissions, meta sub-objects
    // also expose top-level shortcuts used by adminController list sanitiser
    displayName:   data.basic?.displayName,
    email:         data.basic?.email,
    role:          data.basic?.role,
    status:        data.basic?.status,
    emailVerified: data.basic?.emailVerified,
    adminApproved: data.basic?.adminApproved,
    createdAt:     data.basic?.createdAt,
    permissions:   data.permissions ?? {},
    meta:          data.meta ?? {},
  };
};

/* ── CREATE ────────────────────────────────────────────── */
/**
 * Called by authController.register after Firebase Auth user is created.
 * @param {{ uid, email, displayName, ip }}
 */
export const createUser = async ({ uid, email, displayName, ip }) => {
  const now  = new Date().toISOString();
  const name = displayName || email.split('@')[0];
  const perms = buildDefaultPermissions(ROLES.GUEST);

  const rtdbPayload = {
    [`users/${uid}/basic/uid`]:            uid,
    [`users/${uid}/basic/email`]:          email.toLowerCase(),
    [`users/${uid}/basic/displayName`]:    name,
    [`users/${uid}/basic/role`]:           ROLES.GUEST,
    [`users/${uid}/basic/status`]:         STATUS.PENDING,
    [`users/${uid}/basic/emailVerified`]:  false,
    [`users/${uid}/basic/adminApproved`]:  false,
    [`users/${uid}/basic/createdAt`]:      now,
    [`users/${uid}/basic/updatedAt`]:      now,
    // permissions
    [`users/${uid}/permissions/read`]:        perms.read,
    [`users/${uid}/permissions/write`]:       perms.write,
    [`users/${uid}/permissions/delete`]:      perms.delete,
    [`users/${uid}/permissions/manageUsers`]: perms.manageUsers,
    [`users/${uid}/permissions/accessAdmin`]: perms.accessAdmin,
    // meta
    [`users/${uid}/meta/lastLogin`]:      null,
    [`users/${uid}/meta/registeredIp`]:   ip || 'unknown',
    [`users/${uid}/meta/registeredAt`]:   now,
  };

  await admin.database().ref('/').update(rtdbPayload);

  // Firestore mirror
  await firestore.collection('users').doc(uid).set({
    uid,
    email:         email.toLowerCase(),
    displayName:   name,
    role:          ROLES.GUEST,
    status:        STATUS.PENDING,
    emailVerified: false,
    adminApproved: false,
    permissions:   perms,
    createdAt:     now,
    updatedAt:     now,
  });

  return getUserById(uid);
};

/* ── READ ALL (admin list) ─────────────────────────────── */
/**
 * Reads all users from RTDB. Filters by role and/or status in-memory.
 * (RTDB doesn't support multi-field server-side queries.)
 */
export const getAllUsers = async ({ role, status } = {}) => {
  const snap = await admin.database().ref('users').once('value');
  if (!snap.exists()) return [];

  const users = [];
  snap.forEach((child) => {
    const data  = child.val();
    const basic = data?.basic || {};
    users.push({
      uid:           basic.uid || child.key,
      displayName:   basic.displayName,
      email:         basic.email,
      role:          basic.role,
      status:        basic.status,
      emailVerified: basic.emailVerified,
      adminApproved: basic.adminApproved,
      createdAt:     basic.createdAt,
      permissions:   data.permissions ?? {},
      meta:          data.meta ?? {},
    });
  });

  return users
    .filter((u) => !role   || u.role   === role)
    .filter((u) => !status || u.status === status);
};

/* ── APPROVAL QUEUE ────────────────────────────────────── */
/**
 * Returns guests who have verified their email (status=awaiting)
 * and are waiting for admin step-2 approval.
 */
export const getApprovalQueue = async () => {
  return getAllUsers({ role: ROLES.GUEST, status: STATUS.AWAITING });
};

/* ── LOGIN RECORD ──────────────────────────────────────── */
export const recordLogin = async (uid, ip) => {
  const now = new Date().toISOString();
  await admin.database().ref('/').update({
    [`users/${uid}/meta/lastLogin`]:   now,
    [`users/${uid}/meta/lastLoginIp`]: ip || 'unknown',
    [`users/${uid}/basic/updatedAt`]:  now,
  });
  await firestore.collection('users').doc(uid).update({
    lastLogin: now,
    updatedAt: now,
  }).catch(() => {}); // non-fatal if Firestore doc missing
};

/* ── EMAIL VERIFIED (step 1) ───────────────────────────── */
/**
 * Marks email as verified.
 * If adminApproved is already true → promote immediately (edge case).
 * Otherwise: pending → awaiting, and add to Firestore approvalQueue.
 * Returns { nowAwaiting: boolean }
 */
export const markEmailVerified = async (uid) => {
  const snap        = await userRef(uid).once('value');
  const data        = snap.val();
  const basic       = data?.basic || {};
  const alreadyApproved = basic.adminApproved === true;
  const now         = new Date().toISOString();

  if (alreadyApproved) {
    // Rare: admin approved before user verified email → promote now
    await admin.database().ref('/').update({
      [`users/${uid}/basic/emailVerified`]: true,
      [`users/${uid}/basic/role`]:          ROLES.USER,
      [`users/${uid}/basic/status`]:        STATUS.ACTIVE,
      [`users/${uid}/basic/updatedAt`]:     now,
    });
    await firestore.collection('users').doc(uid).update({
      emailVerified: true,
      role:          ROLES.USER,
      status:        STATUS.ACTIVE,
      updatedAt:     now,
    }).catch(() => {});
    return { nowAwaiting: false };
  }

  // Normal path: mark verified, move to awaiting
  await admin.database().ref('/').update({
    [`users/${uid}/basic/emailVerified`]: true,
    [`users/${uid}/basic/status`]:        STATUS.AWAITING,
    [`users/${uid}/basic/updatedAt`]:     now,
  });

  // Add to Firestore approval queue
  await firestore.collection('approvalQueue').doc(uid).set({
    uid,
    email:     basic.email,
    displayName: basic.displayName,
    requestedAt: now,
  });

  await firestore.collection('users').doc(uid).update({
    emailVerified: true,
    status:        STATUS.AWAITING,
    updatedAt:     now,
  }).catch(() => {});

  return { nowAwaiting: true };
};

/* ── ADMIN APPROVE (step 2) ────────────────────────────── */
/**
 * Admin approves a guest.
 * If email is already verified → promote to user/active now.
 * Otherwise → mark adminApproved, defer promotion until email verified.
 */
export const adminApproveUser = async (uid, adminUid) => {
  const snap  = await userRef(uid).once('value');
  const basic = snap.val()?.basic || {};
  const now   = new Date().toISOString();

  const emailVerified = basic.emailVerified === true;
  const promoted      = emailVerified;
  const newRole       = promoted ? ROLES.USER  : ROLES.GUEST;
  const newStatus     = promoted ? STATUS.ACTIVE : STATUS.AWAITING;

  await admin.database().ref('/').update({
    [`users/${uid}/basic/adminApproved`]: true,
    [`users/${uid}/basic/approvedBy`]:    adminUid,
    [`users/${uid}/basic/approvedAt`]:    now,
    [`users/${uid}/basic/role`]:          newRole,
    [`users/${uid}/basic/status`]:        newStatus,
    [`users/${uid}/basic/updatedAt`]:     now,
    // If promoted, grant default user permissions
    ...(promoted && {
      [`users/${uid}/permissions/read`]:        true,
      [`users/${uid}/permissions/write`]:       false, // write requires separate grant
      [`users/${uid}/permissions/delete`]:      false,
      [`users/${uid}/permissions/manageUsers`]: false,
      [`users/${uid}/permissions/accessAdmin`]: false,
    }),
  });

  // Remove from approval queue
  await firestore.collection('approvalQueue').doc(uid).delete().catch(() => {});

  await firestore.collection('users').doc(uid).update({
    adminApproved: true,
    approvedBy:    adminUid,
    approvedAt:    now,
    role:          newRole,
    status:        newStatus,
    updatedAt:     now,
  }).catch(() => {});

  return { promoted, role: newRole, status: newStatus };
};

/* ── WRITE ACCESS ──────────────────────────────────────── */
export const grantWriteAccess = async (uid, adminUid) => {
  const user = await getUserById(uid);
  if (!user) throw new Error('User not found');
  if (user.role !== ROLES.USER || user.status !== STATUS.ACTIVE)
    throw new Error('User must be an active user to receive write access');

  const now = new Date().toISOString();
  await admin.database().ref('/').update({
    [`users/${uid}/permissions/write`]:    true,
    [`users/${uid}/basic/updatedAt`]:      now,
  });
  await firestore.collection('users').doc(uid)
    .update({ 'permissions.write': true, updatedAt: now }).catch(() => {});
};

export const revokeWriteAccess = async (uid, adminUid) => {
  const now = new Date().toISOString();
  await admin.database().ref('/').update({
    [`users/${uid}/permissions/write`]: false,
    [`users/${uid}/basic/updatedAt`]:   now,
  });
  await firestore.collection('users').doc(uid)
    .update({ 'permissions.write': false, updatedAt: now }).catch(() => {});
};

/* ── PERMISSION OVERRIDE ───────────────────────────────── */
/**
 * Merges a partial permissions object into the user's permissions node.
 * @param {string} uid
 * @param {Record<string, boolean>} changes  e.g. { write: true, delete: false }
 * @param {string} adminUid
 */
export const overridePermissions = async (uid, changes, adminUid) => {
  const user = await getUserById(uid);
  if (!user) throw new Error('User not found');

  const now     = new Date().toISOString();
  const updates = {};
  for (const [key, val] of Object.entries(changes)) {
    updates[`users/${uid}/permissions/${key}`] = Boolean(val);
  }
  updates[`users/${uid}/basic/updatedAt`] = now;

  await admin.database().ref('/').update(updates);
  await firestore.collection('users').doc(uid)
    .update({ ...Object.fromEntries(
      Object.entries(changes).map(([k, v]) => [`permissions.${k}`, v])
    ), updatedAt: now }).catch(() => {});
};

/* ── ACCOUNT STATUS ────────────────────────────────────── */
export const setAccountStatus = async (uid, status, adminUid) => {
  const now = new Date().toISOString();
  await admin.database().ref('/').update({
    [`users/${uid}/basic/status`]:    status,
    [`users/${uid}/basic/updatedAt`]: now,
  });
  await firestore.collection('users').doc(uid)
    .update({ status, updatedAt: now }).catch(() => {});
};

/* ── UPDATE (generic — userRoutes profile patch) ─────────*/
export const updateUser = async (uid, fields) => {
  // fields should be dot-path safe for RTDB
  const now     = new Date().toISOString();
  const updates = { [`users/${uid}/basic/updatedAt`]: now };
  for (const [key, val] of Object.entries(fields)) {
    updates[`users/${uid}/${key}`] = val;
  }
  await admin.database().ref('/').update(updates);
  return getUserById(uid);
};

export default {
  createUser, getUserById, getAllUsers,
  recordLogin, markEmailVerified,
  adminApproveUser, getApprovalQueue,
  grantWriteAccess, revokeWriteAccess,
  overridePermissions, setAccountStatus,
  updateUser,
};