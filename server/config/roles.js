/**
 * config/roles.js
 * ════════════════════════════════════════════════════════
 * Single source of truth for roles, statuses, permissions.
 *
 * ROLES
 *   admin  – full control. Created ONLY via scripts/seedAdmin.js
 *   user   – verified + admin-approved. Read + write (if granted)
 *   guest  – newly registered, read-only
 *
 * STATUS  (RTDB: users/{uid}/basic/status)
 *   pending   – registered, email NOT yet verified
 *   awaiting  – email verified, waiting for admin approval (step 2)
 *   active    – fully approved and active
 *   suspended – disabled by admin
 *
 * UPGRADE PATH
 *   guest/pending  → awaiting    (email verified — authController)
 *   guest/awaiting → user/active (admin approves — adminController)
 *   user           → user+write  (admin grants write — adminController)
 *   USERS CANNOT BECOME ADMIN    (only scripts/seedAdmin.js)
 *
 * PERMISSIONS  (RTDB: users/{uid}/permissions/)
 *   Stored as flat booleans. Admin can override per-user via
 *   PATCH /api/admin/users/:uid/permissions (GRANTABLE_TO_USERS keys only).
 * ════════════════════════════════════════════════════════
 */

export const ROLES = {
  ADMIN: 'admin',
  USER:  'user',
  GUEST: 'guest',
};

export const STATUS = {
  PENDING:   'pending',
  AWAITING:  'awaiting',
  ACTIVE:    'active',
  SUSPENDED: 'suspended',
};

/** Default permission sets — written to RTDB on account creation / role change */
export const DEFAULT_PERMISSIONS = {
  admin: {
    read:        true,
    write:       true,
    delete:      true,
    manageUsers: true,
    accessAdmin: true,
  },
  user: {
    read:        true,
    write:       false,   // ← must be explicitly granted by admin
    delete:      false,
    manageUsers: false,
    accessAdmin: false,
  },
  guest: {
    read:        true,
    write:       false,
    delete:      false,
    manageUsers: false,
    accessAdmin: false,
  },
};

/**
 * Permission keys an admin may grant/revoke on individual users.
 * 'manageUsers' and 'accessAdmin' are NEVER grantable to non-admins.
 */
export const GRANTABLE_TO_USERS = ['read', 'write', 'delete'];

/** Returns a fresh copy of the default permissions for a role */
export const buildDefaultPermissions = (role) => ({
  ...(DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS.guest),
});

/**
 * Permission keys that may NEVER be granted to non-admin users.
 * overridePermissions() blocks these regardless of who calls it.
 */
export const ADMIN_ONLY_PERMS = ['manageUsers', 'manageSystem', 'accessAdmin'];