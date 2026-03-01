/**
 * models/user.js
 * ═══════════════════════════════════════════════════════════════════
 * All database operations for the users collection.
 *
 * STORAGE STRATEGY
 * ─────────────────────────────────────────────────────────────────
 *  RTDB (hot path)
 *    users/{uid}/basic       → role, status, emailVerified, adminApproved
 *    users/{uid}/permissions → permission flags (read on every request)
 *
 *  Firestore (rich queries)
 *    users/{uid}             → full profile, audit trail ref
 *    approvalQueue/{uid}     → guests awaiting admin approval
 *
 * Both stores are written atomically on create/update.
 * RTDB is always the authoritative source for permission checks.
 * ═══════════════════════════════════════════════════════════════════
 */

import { ref, get, set, update }         from 'firebase/database';
import {
  doc, setDoc, getDoc, updateDoc,
  collection, query, where, getDocs,
  serverTimestamp, deleteDoc,
}                                         from 'firebase/firestore';
import { db, firestore, adminDb }         from '../config/firebase.js';
import { ROLES, STATUS, DEFAULT_PERMISSIONS,
         GRANTABLE_TO_USERS, ADMIN_ONLY_PERMS,
         GUEST_UPGRADE_CRITERIA }         from '../config/roles.js';

// ── Ref helpers ──────────────────────────────────────────────────────
const rtdbUser   = (uid) => ref(db, `users/${uid}`);
const rtdbPerms  = (uid) => ref(db, `users/${uid}/permissions`);
const rtdbBasic  = (uid) => ref(db, `users/${uid}/basic`);
const fsUser     = (uid) => doc(firestore, 'users', uid);
const fsQueue    = (uid) => doc(firestore, 'approvalQueue', uid);
const fsQueueCol = ()    => collection(firestore, 'approvalQueue');

/* ══════════════════════════════════════════════════════════════════
   CREATE
   ══════════════════════════════════════════════════════════════════ */

/**
 * Creates user in BOTH RTDB and Firestore after registration.
 * All registrations start as GUEST with status=pending.
 *
 * @param {{ uid, email, displayName, ip }} params
 * @returns {Promise<Object>} created user data
 */
export const createUser = async ({ uid, email, displayName, ip }) => {
  const now  = new Date().toISOString();
  const role = ROLES.GUEST;

  const basic = {
    uid,
    email,
    displayName:    displayName || email.split('@')[0],
    role,
    status:         STATUS.PENDING,
    emailVerified:  false,
    adminApproved:  false,
    createdAt:      now,
    updatedAt:      now,
  };

  const permissions = { ...DEFAULT_PERMISSIONS[role] };

  const meta = {
    lastLogin:   null,
    loginCount:  0,
    ipHistory:   ip ? [ip] : [],
    registeredIp: ip || null,
  };

  // ── Write RTDB ──────────────────────────────────────────────────
  await set(rtdbUser(uid), { basic, permissions, meta });

  // ── Write Firestore ─────────────────────────────────────────────
  await setDoc(fsUser(uid), {
    uid, email,
    displayName:    basic.displayName,
    role,
    status:         STATUS.PENDING,
    emailVerified:  false,
    adminApproved:  false,
    permissions,
    meta,
    createdAt:      serverTimestamp(),
    updatedAt:      serverTimestamp(),
  });

  return { basic, permissions, meta };
};

/* ══════════════════════════════════════════════════════════════════
   READ
   ══════════════════════════════════════════════════════════════════ */

/**
 * Fetch user from RTDB (fast, used on every authenticated request).
 * @param {string} uid
 * @returns {Promise<Object|null>}
 */
export const getUserById = async (uid) => {
  const snap = await get(rtdbUser(uid));
  return snap.exists() ? { uid, ...snap.val() } : null;
};

/**
 * Fetch user from Firestore (richer data, used in admin queries).
 * @param {string} uid
 * @returns {Promise<Object|null>}
 */
export const getUserFromFirestore = async (uid) => {
  const snap = await getDoc(fsUser(uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
};

/**
 * Fetch all users from Firestore with optional role/status filter.
 * @param {{ role?, status? }} filters
 * @returns {Promise<Object[]>}
 */
export const getAllUsers = async ({ role, status } = {}) => {
  const col = collection(firestore, 'users');
  let q = col;

  if (role && status) {
    q = query(col, where('role', '==', role), where('status', '==', status));
  } else if (role) {
    q = query(col, where('role', '==', role));
  } else if (status) {
    q = query(col, where('status', '==', status));
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
};

/**
 * Fetch only the permission flags from RTDB (lowest latency path).
 * Used inside requirePermission middleware.
 * @param {string} uid
 * @returns {Promise<Object>}
 */
export const getPermissions = async (uid) => {
  const snap = await get(rtdbPerms(uid));
  return snap.exists() ? snap.val() : {};
};

/* ══════════════════════════════════════════════════════════════════
   EMAIL VERIFICATION  (step 1 of 2 for guest upgrade)
   ══════════════════════════════════════════════════════════════════ */

/**
 * Marks email as verified. Updates status to AWAITING if adminApproved
 * is already true (unlikely at this point, but handles edge cases).
 * Adds user to Firestore approvalQueue so admin can see them.
 *
 * @param {string} uid
 * @returns {Promise<{ nowAwaiting: boolean }>}
 */
export const markEmailVerified = async (uid) => {
  const snap = await get(rtdbUser(uid));
  if (!snap.exists()) throw new Error(`User ${uid} not found`);

  const user      = snap.val();
  const alreadyApproved = user.basic?.adminApproved === true;
  const now       = new Date().toISOString();

  // Determine new status
  const newStatus = alreadyApproved ? STATUS.ACTIVE : STATUS.AWAITING;

  // ── RTDB update ─────────────────────────────────────────────────
  await update(rtdbUser(uid), {
    'basic/emailVerified':   true,
    'basic/emailVerifiedAt': now,
    'basic/status':          newStatus,
    'basic/updatedAt':       now,
  });

  // ── Firestore update ─────────────────────────────────────────────
  await updateDoc(fsUser(uid), {
    emailVerified:   true,
    emailVerifiedAt: now,
    status:          newStatus,
    updatedAt:       serverTimestamp(),
  });

  // ── Add to approval queue (if not already approved) ──────────────
  if (!alreadyApproved) {
    await setDoc(fsQueue(uid), {
      uid,
      email:        user.basic?.email,
      displayName:  user.basic?.displayName,
      emailVerifiedAt: now,
      requestedAt:  serverTimestamp(),
      status:       'pending_approval',
    });
  }

  return { nowAwaiting: !alreadyApproved };
};

/* ══════════════════════════════════════════════════════════════════
   ADMIN APPROVAL  (step 2 of 2 — promotes guest → user)
   ══════════════════════════════════════════════════════════════════ */

/**
 * Admin approves a guest. If email is already verified, the account
 * is promoted to USER immediately. Otherwise, status moves to AWAITING
 * and promotion happens when they verify email.
 *
 * @param {string} targetUid  UID of the guest being approved
 * @param {string} adminUid   UID of the admin performing the action
 * @returns {Promise<{ promoted: boolean, status: string }>}
 */
export const adminApproveUser = async (targetUid, adminUid) => {
  const snap = await get(rtdbUser(targetUid));
  if (!snap.exists()) throw new Error(`User ${targetUid} not found`);

  const user          = snap.val();
  const role          = user.basic?.role;
  const emailVerified = user.basic?.emailVerified === true;
  const now           = new Date().toISOString();

  if (role === ROLES.ADMIN) {
    throw new Error('Cannot modify another admin via this route');
  }

  // If BOTH criteria met → promote to user
  const promote   = emailVerified; // email verified is step 1
  const newRole   = promote ? ROLES.USER   : role;
  const newStatus = promote ? STATUS.ACTIVE : STATUS.AWAITING;
  const newPerms  = promote ? { ...DEFAULT_PERMISSIONS[ROLES.USER] } : user.permissions;

  // ── RTDB update ─────────────────────────────────────────────────
  const rtdbPatch = {
    'basic/adminApproved':   true,
    'basic/adminApprovedBy': adminUid,
    'basic/adminApprovedAt': now,
    'basic/status':          newStatus,
    'basic/updatedAt':       now,
  };
  if (promote) {
    rtdbPatch['basic/role'] = ROLES.USER;
    Object.entries(newPerms).forEach(([k, v]) => {
      rtdbPatch[`permissions/${k}`] = v;
    });
  }
  await update(rtdbUser(targetUid), rtdbPatch);

  // ── Firestore update ─────────────────────────────────────────────
  const fsPatch = {
    adminApproved:   true,
    adminApprovedBy: adminUid,
    adminApprovedAt: now,
    status:          newStatus,
    updatedAt:       serverTimestamp(),
  };
  if (promote) {
    fsPatch.role        = ROLES.USER;
    fsPatch.permissions = newPerms;
  }
  await updateDoc(fsUser(targetUid), fsPatch);

  // ── Remove from approval queue ───────────────────────────────────
  await deleteDoc(fsQueue(targetUid));

  return { promoted: promote, status: newStatus, role: newRole };
};

/* ══════════════════════════════════════════════════════════════════
   PERMISSION OVERRIDE  (admin grants/revokes individual flags)
   ══════════════════════════════════════════════════════════════════ */

/**
 * Override specific permissions for any non-admin user.
 * Only GRANTABLE_TO_USERS keys accepted.
 * ADMIN_ONLY_PERMS are always blocked.
 *
 * @param {string} targetUid
 * @param {Object} permissions  e.g. { write: true }
 * @param {string} adminUid
 */
export const overridePermissions = async (targetUid, permissions, adminUid) => {
  const user = await getUserById(targetUid);
  if (!user)                           throw new Error('User not found');
  if (user.basic?.role === ROLES.ADMIN) throw new Error('Cannot modify admin permissions');

  // Block admin-only keys
  const blocked = Object.keys(permissions).filter((k) => ADMIN_ONLY_PERMS.includes(k));
  if (blocked.length) throw new Error(`Cannot grant [${blocked.join(', ')}] to non-admins`);

  // Only allowed keys
  const safe = Object.fromEntries(
    Object.entries(permissions).filter(([k]) => GRANTABLE_TO_USERS.includes(k)),
  );
  if (!Object.keys(safe).length) throw new Error('No valid permission keys provided');

  const now = new Date().toISOString();

  // ── RTDB ─────────────────────────────────────────────────────────
  const rtdbPatch = { 'basic/updatedAt': now };
  Object.entries(safe).forEach(([k, v]) => {
    rtdbPatch[`permissions/${k}`] = Boolean(v);
  });
  await update(rtdbUser(targetUid), rtdbPatch);

  // ── Firestore ────────────────────────────────────────────────────
  const fsPatch = { updatedAt: serverTimestamp() };
  Object.entries(safe).forEach(([k, v]) => {
    fsPatch[`permissions.${k}`] = Boolean(v);
  });
  await updateDoc(fsUser(targetUid), fsPatch);

  // ── Audit trail on user doc ──────────────────────────────────────
  const auditRef = doc(firestore, `users/${targetUid}/permissionAudit`, `${Date.now()}`);
  await setDoc(auditRef, {
    changedBy: adminUid,
    changes:   safe,
    at:        serverTimestamp(),
  });
};

/**
 * Grant write permission to a verified+approved user (primary admin action).
 */
export const grantWriteAccess = async (targetUid, adminUid) => {
  const user = await getUserById(targetUid);
  if (!user)                              throw new Error('User not found');
  if (user.basic?.role !== ROLES.USER)    throw new Error('Can only grant write access to users with role=user');
  if (!user.basic?.emailVerified)         throw new Error('User must verify their email first');
  if (user.basic?.status !== STATUS.ACTIVE) throw new Error('User account must be active');
  return overridePermissions(targetUid, { write: true }, adminUid);
};

/** Revoke write permission */
export const revokeWriteAccess = async (targetUid, adminUid) =>
  overridePermissions(targetUid, { write: false }, adminUid);

/* ══════════════════════════════════════════════════════════════════
   ACCOUNT STATUS
   ══════════════════════════════════════════════════════════════════ */

/**
 * Update account status (suspend / reactivate).
 * Writes to both RTDB and Firestore.
 */
export const setAccountStatus = async (uid, status, changedBy) => {
  const now = new Date().toISOString();
  await update(rtdbUser(uid), { 'basic/status': status, 'basic/updatedAt': now });
  await updateDoc(fsUser(uid), {
    status,
    statusChangedBy: changedBy,
    statusChangedAt: now,
    updatedAt:       serverTimestamp(),
  });
};

/* ══════════════════════════════════════════════════════════════════
   APPROVAL QUEUE  (Firestore only)
   ══════════════════════════════════════════════════════════════════ */

/** Fetch all guests awaiting admin approval */
export const getApprovalQueue = async () => {
  const snap = await getDocs(fsQueueCol());
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
};

/* ══════════════════════════════════════════════════════════════════
   LOGIN METADATA
   ══════════════════════════════════════════════════════════════════ */

export const recordLogin = async (uid, ip) => {
  const snap = await get(rtdbUser(uid));
  if (!snap.exists()) return;

  const meta     = snap.val().meta || {};
  const history  = Array.isArray(meta.ipHistory) ? meta.ipHistory : [];
  if (!history.includes(ip)) history.unshift(ip);

  const now = new Date().toISOString();
  await update(rtdbUser(uid), {
    'meta/lastLogin':  now,
    'meta/loginCount': (meta.loginCount || 0) + 1,
    'meta/ipHistory':  history.slice(0, 10),
    'basic/updatedAt': now,
  });
};