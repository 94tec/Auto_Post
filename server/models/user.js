/**
 * models/user.js
 * ═══════════════════════════════════════════════════════════════════
 * All database operations for the users collection.
 *
 * STORAGE STRATEGY
 * ───────────────────────────────────────────────────────────────────
 *  RTDB  (hot path — read on every authenticated request)
 *    users/{uid}/basic        → uid, email, displayName, role, status,
 *                               emailVerified, emailVerifiedAt,
 *                               adminApproved, adminApprovedBy, adminApprovedAt,
 *                               createdAt, updatedAt
 *    users/{uid}/permissions  → read, write, delete,
 *                               deleteAny, manageUsers, manageSystem
 *    users/{uid}/meta         → lastLogin, loginCount, ipHistory[], registeredIp
 *    users/{uid}/security     → lastPasswordChange
 *
 *  Firestore  (rich queries, audit trail) — OPTIONAL MIRROR
 *    users/{uid}                         → full profile mirror
 *    users/{uid}/permissionAudit/{id}    → per-change audit entries
 *    approvalQueue/{uid}                 → guests awaiting admin approval
 *
 * SDK RULE — READ THIS BEFORE TOUCHING ANY DB CALL
 * ───────────────────────────────────────────────────────────────────
 *  ALL reads  → Admin SDK (adminDb / adminFirestore)
 *  ALL writes → Admin SDK (adminDb / adminFirestore)
 *
 *  NEVER use the client SDK (firebase/database, firebase/firestore)
 *  on the server. The client SDK obeys security rules. The server has
 *  no signed-in Firebase user, so every client SDK write fails:
 *    RTDB      → PERMISSION_DENIED
 *    Firestore → Code 5 NOT_FOUND  (rules reject before even reading)
 *
 *  The Admin SDK uses a service account → bypasses all security rules.
 *
 * FIRESTORE AVAILABILITY
 * ───────────────────────────────────────────────────────────────────
 *  Firestore may not be provisioned yet (shows as "5 NOT_FOUND").
 *  All Firestore writes are wrapped in syncFs() — fire-and-forget.
 *  RTDB is always the source of truth. Firestore is a best-effort
 *  mirror for admin queries. Enable it in the Firebase console when
 *  ready: Firestore → Create database → Native mode.
 *
 *  Exception: getAllUsers() and getApprovalQueue() READ from Firestore.
 *  If Firestore is not provisioned those two endpoints return empty
 *  arrays and log a warning — all other endpoints remain unaffected.
 *
 * EXPORTS
 * ───────────────────────────────────────────────────────────────────
 *  createUser           — register (authController)
 *  getUserById          — RTDB read (middleware + controllers)
 *  getUserFromFirestore — Firestore read (admin queries)
 *  getAllUsers          — Firestore list with filters (adminController)
 *  getPermissions       — RTDB permissions-only read (middleware)
 *  recordLogin          — update lastLogin / loginCount / IP (authController)
 *  markEmailVerified    — step 1 of guest upgrade (authController)
 *  adminApproveUser     — step 2 of guest upgrade (adminController)
 *  overridePermissions  — merge permission flags (adminController)
 *  grantWriteAccess     — convenience wrapper → overridePermissions
 *  revokeWriteAccess    — convenience wrapper → overridePermissions
 *  setAccountStatus     — suspend / reactivate (adminController)
 *  getApprovalQueue     — Firestore approvalQueue list (adminController)
 * ═══════════════════════════════════════════════════════════════════
 */

import { admin, adminDb, adminFirestore } from '../config/firebase.js';
import {
  ROLES, STATUS, DEFAULT_PERMISSIONS,
  GRANTABLE_TO_USERS, ADMIN_ONLY_PERMS,
} from '../config/roles.js';

/* ══════════════════════════════════════════════════════════════════
   FIRESTORE RESILIENCE WRAPPER
   All Firestore writes go through syncFs().
   RTDB is always written first and is the source of truth.
   If Firestore fails (not provisioned, quota, network) the request
   succeeds anyway — a warning is printed to the console.
   ══════════════════════════════════════════════════════════════════ */
const syncFs = (fn) => {
  Promise.resolve()
    .then(fn)
    .catch((err) => console.warn('[Firestore sync skipped]', err.code || err.message));
};

/* ══════════════════════════════════════════════════════════════════
   REFERENCE HELPERS
   Short, named helpers keep every DB call one line and make the
   SDK (admin) vs collection path immediately obvious on inspection.
   ══════════════════════════════════════════════════════════════════ */

// RTDB — Admin SDK
const rtdbUser  = (uid) => adminDb.ref(`users/${uid}`);
const rtdbPerms = (uid) => adminDb.ref(`users/${uid}/permissions`);

// Firestore — Admin SDK
const fsUser     = (uid) => adminFirestore.collection('users').doc(uid);
const fsQueue    = (uid) => adminFirestore.collection('approvalQueue').doc(uid);
const fsQueueCol = ()    => adminFirestore.collection('approvalQueue');

/** Admin SDK server timestamp — use everywhere instead of new Date() in Firestore */
const serverTs = () => admin.firestore.FieldValue.serverTimestamp();

/* ══════════════════════════════════════════════════════════════════
   CREATE
   Called by authController.register immediately after
   admin.auth().createUser() succeeds.
   All new accounts are GUEST + PENDING until both steps complete.
   ══════════════════════════════════════════════════════════════════ */

/**
 * Write a new user to RTDB (primary) and Firestore (mirror).
 * @param {{ uid: string, email: string, displayName: string, ip: string }} params
 * @returns {Promise<{ basic, permissions, meta }>}
 */
export const createUser = async ({ uid, email, displayName, ip }) => {
  const now  = new Date().toISOString();
  const role = ROLES.GUEST;
  const name = (displayName || email.split('@')[0]).trim();

  const basic = {
    uid,
    email:         email.toLowerCase(),
    displayName:   name,
    role,
    status:        STATUS.PENDING,
    emailVerified: false,
    adminApproved: false,
    createdAt:     now,
    updatedAt:     now,
  };

  const permissions = { ...DEFAULT_PERMISSIONS[role] };

  const meta = {
    lastLogin:    null,
    loginCount:   0,
    ipHistory:    ip ? [ip] : [],
    registeredIp: ip || null,
  };

  // ── RTDB: primary write — must succeed ───────────────────────────
  await rtdbUser(uid).set({ basic, permissions, meta });

  // ── Firestore: mirror — fire-and-forget ──────────────────────────
  syncFs(() => fsUser(uid).set({
    uid,
    email:         email.toLowerCase(),
    displayName:   name,
    role,
    status:        STATUS.PENDING,
    emailVerified: false,
    adminApproved: false,
    permissions,
    meta,
    createdAt:     serverTs(),
    updatedAt:     serverTs(),
  }));

  return { basic, permissions, meta };
};

/* ══════════════════════════════════════════════════════════════════
   READ
   ══════════════════════════════════════════════════════════════════ */

/**
 * Fetch user from RTDB — hot path, called on every authenticated request.
 * Returns the full { basic, permissions, meta, security } object or null.
 * @param {string} uid
 * @returns {Promise<Object|null>}
 */
export const getUserById = async (uid) => {
  const snap = await rtdbUser(uid).once('value');
  if (!snap.exists()) return null;
  return { uid, ...snap.val() };
};

/**
 * Fetch user from Firestore — richer data, used for admin detail views.
 * Returns null (with a warning) if Firestore is not provisioned.
 * @param {string} uid
 * @returns {Promise<Object|null>}
 */
export const getUserFromFirestore = async (uid) => {
  try {
    const snap = await fsUser(uid).get();
    return snap.exists ? { uid, ...snap.data() } : null;
  } catch (err) {
    console.warn('[getUserFromFirestore] Firestore unavailable:', err.code || err.message);
    return null;
  }
};

/**
 * Fetch all users from Firestore with optional role/status filtering.
 * Firestore handles server-side filtering — no in-memory scan.
 * Falls back to empty array if Firestore is not provisioned.
 * @param {{ role?: string, status?: string }} filters
 * @returns {Promise<Object[]>}
 */
export const getAllUsers = async ({ role, status } = {}) => {
  try {
    let q = adminFirestore.collection('users');

    if (role   && status) q = q.where('role', '==', role).where('status', '==', status);
    else if (role)        q = q.where('role', '==', role);
    else if (status)      q = q.where('status', '==', status);

    const snap = await q.get();
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[getAllUsers] Firestore unavailable — returning empty list:', err.code || err.message);
    return [];
  }
};

/**
 * Fetch only the permissions node from RTDB.
 * Lowest-latency path — used by requirePermission middleware.
 * @param {string} uid
 * @returns {Promise<Object>}
 */
export const getPermissions = async (uid) => {
  const snap = await rtdbPerms(uid).once('value');
  return snap.exists() ? snap.val() : {};
};

/* ══════════════════════════════════════════════════════════════════
   LOGIN METADATA
   Called by authController.login on every successful sign-in.
   Keeps lastLogin, loginCount, and a rolling 10-entry IP history.
   ══════════════════════════════════════════════════════════════════ */

/**
 * @param {string} uid
 * @param {string} ip
 */
export const recordLogin = async (uid, ip) => {
  const snap = await rtdbUser(uid).once('value');
  if (!snap.exists()) return;

  const meta    = snap.val().meta || {};
  const history = Array.isArray(meta.ipHistory) ? [...meta.ipHistory] : [];

  // Prepend new IP, deduplicate, cap at 10 entries
  if (ip && !history.includes(ip)) history.unshift(ip);

  const now = new Date().toISOString();
  await rtdbUser(uid).update({
    'meta/lastLogin':  now,
    'meta/loginCount': (meta.loginCount || 0) + 1,
    'meta/ipHistory':  history.slice(0, 10),
    'basic/updatedAt': now,
  });
};

/* ══════════════════════════════════════════════════════════════════
   EMAIL VERIFICATION  (guest upgrade — step 1 of 2)
   ───────────────────────────────────────────────────────────────────
   Normal path:   pending → awaiting + added to approvalQueue
   Edge case:     if adminApproved already=true, promote immediately
                  (admin approved before the user clicked the link)
   ══════════════════════════════════════════════════════════════════ */

/**
 * @param {string} uid
 * @returns {Promise<{ nowAwaiting: boolean }>}
 */
export const markEmailVerified = async (uid) => {
  const snap = await rtdbUser(uid).once('value');
  if (!snap.exists()) throw new Error(`User ${uid} not found in database`);

  const user            = snap.val();
  const alreadyApproved = user.basic?.adminApproved === true;
  const now             = new Date().toISOString();
  const newStatus       = alreadyApproved ? STATUS.ACTIVE : STATUS.AWAITING;

  // ── RTDB: primary write — must succeed ───────────────────────────
  const rtdbPatch = {
    'basic/emailVerified':   true,
    'basic/emailVerifiedAt': now,
    'basic/status':          newStatus,
    'basic/updatedAt':       now,
  };
  if (alreadyApproved) {
    rtdbPatch['basic/role'] = ROLES.USER;
    const userPerms = DEFAULT_PERMISSIONS[ROLES.USER];
    Object.entries(userPerms).forEach(([k, v]) => { rtdbPatch[`permissions/${k}`] = v; });
  }
  await rtdbUser(uid).update(rtdbPatch);

  // ── Firestore: mirror — fire-and-forget ──────────────────────────
  const fsPatch = {
    emailVerified:   true,
    emailVerifiedAt: now,
    status:          newStatus,
    updatedAt:       serverTs(),
  };
  if (alreadyApproved) {
    fsPatch.role        = ROLES.USER;
    fsPatch.permissions = { ...DEFAULT_PERMISSIONS[ROLES.USER] };
  }
  syncFs(() => fsUser(uid).update(fsPatch));

  // ── Approval queue — add only if still needs admin approval ──────
  if (!alreadyApproved) {
    syncFs(() => fsQueue(uid).set({
      uid,
      email:           user.basic?.email,
      displayName:     user.basic?.displayName,
      emailVerifiedAt: now,
      requestedAt:     serverTs(),
      status:          'pending_approval',
    }));
  }

  return { nowAwaiting: !alreadyApproved };
};

/* ══════════════════════════════════════════════════════════════════
   ADMIN APPROVAL  (guest upgrade — step 2 of 2)
   ───────────────────────────────────────────────────────────────────
   emailVerified=true  → promote now: guest→user, status→active
   emailVerified=false → store adminApproved=true, defer promotion
                         (promotion fires when user clicks verify link)
   ══════════════════════════════════════════════════════════════════ */

/**
 * @param {string} targetUid
 * @param {string} adminUid
 * @returns {Promise<{ promoted: boolean, status: string, role: string }>}
 */
export const adminApproveUser = async (targetUid, adminUid) => {
  const snap = await rtdbUser(targetUid).once('value');
  if (!snap.exists()) throw new Error(`User ${targetUid} not found`);

  const user          = snap.val();
  const currentRole   = user.basic?.role;
  const emailVerified = user.basic?.emailVerified === true;
  const now           = new Date().toISOString();

  if (currentRole === ROLES.ADMIN) {
    throw new Error('Cannot modify another admin via this route');
  }

  const promote   = emailVerified;
  const newRole   = promote ? ROLES.USER    : currentRole;
  const newStatus = promote ? STATUS.ACTIVE : STATUS.AWAITING;
  const newPerms  = promote ? { ...DEFAULT_PERMISSIONS[ROLES.USER] } : user.permissions;

  // ── RTDB: primary write — must succeed ───────────────────────────
  const rtdbPatch = {
    'basic/adminApproved':   true,
    'basic/adminApprovedBy': adminUid,
    'basic/adminApprovedAt': now,
    'basic/status':          newStatus,
    'basic/updatedAt':       now,
  };
  if (promote) {
    rtdbPatch['basic/role'] = ROLES.USER;
    Object.entries(newPerms).forEach(([k, v]) => { rtdbPatch[`permissions/${k}`] = v; });
  }
  await rtdbUser(targetUid).update(rtdbPatch);

  // ── Firestore: mirror + queue removal — fire-and-forget ──────────
  const fsPatch = {
    adminApproved:   true,
    adminApprovedBy: adminUid,
    adminApprovedAt: now,
    status:          newStatus,
    updatedAt:       serverTs(),
  };
  if (promote) {
    fsPatch.role        = ROLES.USER;
    fsPatch.permissions = newPerms;
  }
  syncFs(() => fsUser(targetUid).update(fsPatch));
  syncFs(() => fsQueue(targetUid).delete());

  return { promoted: promote, status: newStatus, role: newRole };
};

/* ══════════════════════════════════════════════════════════════════
   PERMISSION OVERRIDE
   ───────────────────────────────────────────────────────────────────
   Only keys in GRANTABLE_TO_USERS are accepted.
   ADMIN_ONLY_PERMS are always blocked — even if caller is admin.
   Every change is written to a permissionAudit subcollection.
   ══════════════════════════════════════════════════════════════════ */

/**
 * Merge a partial permissions object into a user's permissions node.
 * @param {string} targetUid
 * @param {Record<string, boolean>} permissions  e.g. { write: true }
 * @param {string} adminUid
 */
export const overridePermissions = async (targetUid, permissions, adminUid) => {
  const user = await getUserById(targetUid);
  if (!user)                            throw new Error('User not found');
  if (user.basic?.role === ROLES.ADMIN) throw new Error('Cannot modify admin permissions');

  // Block any admin-only keys regardless of what was passed
  const blocked = Object.keys(permissions).filter((k) => ADMIN_ONLY_PERMS.includes(k));
  if (blocked.length) {
    throw new Error(`Cannot grant [${blocked.join(', ')}] to non-admins`);
  }

  // Keep only recognised grantable keys
  const safe = Object.fromEntries(
    Object.entries(permissions).filter(([k]) => GRANTABLE_TO_USERS.includes(k)),
  );
  if (!Object.keys(safe).length) throw new Error('No valid permission keys provided');

  const now = new Date().toISOString();

  // ── RTDB: primary write — must succeed ───────────────────────────
  const rtdbPatch = { 'basic/updatedAt': now };
  Object.entries(safe).forEach(([k, v]) => { rtdbPatch[`permissions/${k}`] = Boolean(v); });
  await rtdbUser(targetUid).update(rtdbPatch);

  // ── Firestore: mirror + audit trail — fire-and-forget ────────────
  const fsPatch = { updatedAt: serverTs() };
  Object.entries(safe).forEach(([k, v]) => { fsPatch[`permissions.${k}`] = Boolean(v); });
  syncFs(() => fsUser(targetUid).update(fsPatch));
  syncFs(() =>
    fsUser(targetUid)
      .collection('permissionAudit')
      .doc(`${Date.now()}`)
      .set({ changedBy: adminUid, changes: safe, at: serverTs() }),
  );
};

/**
 * Grant write permission to a verified, active user.
 * Wrapper around overridePermissions with pre-flight guards.
 */
export const grantWriteAccess = async (targetUid, adminUid) => {
  const user = await getUserById(targetUid);
  if (!user)                                throw new Error('User not found');
  if (user.basic?.role !== ROLES.USER)      throw new Error('Can only grant write access to role=user');
  if (!user.basic?.emailVerified)           throw new Error('User must verify their email first');
  if (user.basic?.status !== STATUS.ACTIVE) throw new Error('User account must be active');
  return overridePermissions(targetUid, { write: true }, adminUid);
};

/** Revoke write permission. No pre-flight guards — always safe to revoke. */
export const revokeWriteAccess = async (targetUid, adminUid) =>
  overridePermissions(targetUid, { write: false }, adminUid);

/* ══════════════════════════════════════════════════════════════════
   ACCOUNT STATUS
   ══════════════════════════════════════════════════════════════════ */

/**
 * Set account status (suspended / active / etc.).
 * @param {string} uid
 * @param {string} status     — use STATUS.* constants
 * @param {string} changedBy  — adminUid performing the change
 */
export const setAccountStatus = async (uid, status, changedBy) => {
  const now = new Date().toISOString();

  // ── RTDB: primary write — must succeed ───────────────────────────
  await rtdbUser(uid).update({
    'basic/status':    status,
    'basic/updatedAt': now,
  });

  // ── Firestore: mirror — fire-and-forget ──────────────────────────
  syncFs(() => fsUser(uid).update({
    status,
    statusChangedBy: changedBy,
    statusChangedAt: now,
    updatedAt:       serverTs(),
  }));
};

/* ══════════════════════════════════════════════════════════════════
   APPROVAL QUEUE
   Documents are added by markEmailVerified, removed by adminApproveUser.
   Returns empty array (with warning) if Firestore is not provisioned.
   ══════════════════════════════════════════════════════════════════ */

/** @returns {Promise<Object[]>} array of queued guest docs */
export const getApprovalQueue = async () => {
  try {
    const snap = await fsQueueCol().get();
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[getApprovalQueue] Firestore unavailable:', err.code || err.message);
    return [];
  }
};

/* ══════════════════════════════════════════════════════════════════
   ALSO NEED  config/roles.js  TO EXPORT ADMIN_ONLY_PERMS
   Add this to config/roles.js if not already present:

   export const ADMIN_ONLY_PERMS = ['manageUsers', 'manageSystem', 'accessAdmin'];
   ══════════════════════════════════════════════════════════════════ */