/**
 * config/roles.js
 * ═══════════════════════════════════════════════════════════════════
 * SINGLE SOURCE OF TRUTH — roles, permissions, upgrade criteria.
 *
 * ROLE HIERARCHY
 * ───────────────────────────────────────────────────────────────────
 *  guest   read-only. Upgrade: emailVerified AND adminApproved → user
 *  user    authenticated + approved. write only when admin grants it.
 *  admin   seeded via CLI only. Full access. Cannot be self-assigned.
 *
 * GUEST UPGRADE — BOTH required:
 *   1. emailVerified  = true   (automatic when oobCode consumed)
 *   2. adminApproved  = true   (admin calls POST /admin/users/:uid/approve)
 *
 * STORAGE SPLIT (Realtime DB + Firestore)
 * ───────────────────────────────────────────────────────────────────
 *  RTDB       hot path — auth checks, live permission reads
 *             users/{uid}/basic, users/{uid}/permissions
 *
 *  Firestore  rich queries, audit trail, approval queue
 *             users/{uid}  (full profile doc)
 *             auditLogs/{id}
 *             approvalQueue/{uid}
 * ═══════════════════════════════════════════════════════════════════
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  USER:  'user',
  GUEST: 'guest',
});

export const STATUS = Object.freeze({
  PENDING:   'pending',    // registered, email not yet verified
  AWAITING:  'awaiting',   // email verified, waiting admin approval
  ACTIVE:    'active',     // fully onboarded
  SUSPENDED: 'suspended',  // banned
});

export const DEFAULT_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: {
    read: true, write: true, delete: true,
    deleteAny: true, manageUsers: true, manageSystem: true,
  },
  [ROLES.USER]: {
    read: true, write: false,  // admin flips write=true explicitly
    delete: true,              // own quotes only — enforced in controller
    deleteAny: false, manageUsers: false, manageSystem: false,
  },
  [ROLES.GUEST]: {
    read: true, write: false, delete: false,
    deleteAny: false, manageUsers: false, manageSystem: false,
  },
});

/** Both must be true for guest → user promotion */
export const GUEST_UPGRADE_CRITERIA = Object.freeze({
  requireEmailVerified: true,
  requireAdminApproval: true,
});

/** Keys an admin may grant/revoke on non-admin users */
export const GRANTABLE_TO_USERS = Object.freeze(['read', 'write', 'delete']);

/** Keys that are permanently admin-only */
export const ADMIN_ONLY_PERMS = Object.freeze(['deleteAny', 'manageUsers', 'manageSystem']);