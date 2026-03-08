/**
 * services/auditLog.js
 * ═══════════════════════════════════════════════════════════════════
 * Immutable audit trail stored in Firestore.
 * Uses Admin SDK exclusively — bypasses Firestore security rules.
 *
 * DESIGN: record() always returns a Promise so callers can chain
 * .catch() for fire-and-forget usage:
 *   AuditLog.record(...).catch(() => {})
 *
 * Errors inside record() are swallowed — a logging failure must
 * never crash the main request flow.
 * ═══════════════════════════════════════════════════════════════════
 */

import { admin, adminFirestore } from '../config/firebase.js';

const auditCol = () => adminFirestore.collection('auditLogs');
const serverTs = () => admin.firestore.FieldValue.serverTimestamp();

const EVENTS = Object.freeze({
  // Auth lifecycle
  USER_REGISTERED:              'USER_REGISTERED',
  REGISTRATION_ERROR:           'REGISTRATION_ERROR',
  USER_LOGIN:                   'USER_LOGIN',
  LOGIN_SUCCESS:                'LOGIN_SUCCESS',
  LOGIN_FAILURE:                'LOGIN_FAILURE',
  USER_LOGOUT:                  'USER_LOGOUT',

  // Email verification
  EMAIL_VERIFICATION:           'EMAIL_VERIFICATION',
  EMAIL_VERIFICATION_RESEND:    'EMAIL_VERIFICATION_RESEND',

  // Guest approval / promotion
  GUEST_APPROVED:               'GUEST_APPROVED',
  GUEST_PROMOTED:               'GUEST_PROMOTED',

  // Permissions
  PERMISSION_GRANTED:           'PERMISSION_GRANTED',
  PERMISSION_REVOKED:           'PERMISSION_REVOKED',
  PERMISSION_OVERRIDE:          'PERMISSION_OVERRIDE',

  // Account status
  USER_SUSPENDED:               'USER_SUSPENDED',
  USER_REACTIVATED:             'USER_REACTIVATED',
  ACCOUNT_DELETED:              'ACCOUNT_DELETED',

  // Password
  PASSWORD_RESET_REQUESTED:     'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_LINK_VERIFIED: 'PASSWORD_RESET_LINK_VERIFIED',
  PASSWORD_RESET_COMPLETED:     'PASSWORD_RESET_COMPLETED',
  PASSWORD_RESET_FAILED:        'PASSWORD_RESET_FAILED',
  PASSWORD_RESET_ATTEMPT_UNKNOWN_EMAIL: 'PASSWORD_RESET_ATTEMPT_UNKNOWN_EMAIL',
  PASSWORD_RESET_FAILURE:       'PASSWORD_RESET_FAILURE',
  PASSWORD_CHANGED:             'PASSWORD_CHANGED',

  // Profile
  PROFILE_UPDATED:              'PROFILE_UPDATED',

  // Quotes
  QUOTE_CREATED:                'QUOTE_CREATED',
  QUOTE_UPDATED:                'QUOTE_UPDATED',
  QUOTE_DELETED:                'QUOTE_DELETED',
});

const AuditLog = {
  EVENTS,

  /**
   * Write an audit event to Firestore.
   * Always returns a Promise — safe to chain .catch() for fire-and-forget.
   * Errors are logged to console but never propagated.
   *
   * @param {string} event          — use AuditLog.EVENTS.*
   * @param {{ userId?, ip?, userAgent?, metadata? }} context
   * @returns {Promise<void>}
   */
  record(event, { userId, ip, userAgent, metadata = {} } = {}) {
    return auditCol().add({
      event,
      userId:    userId    ?? null,
      ip:        ip        ?? null,
      userAgent: userAgent ?? null,
      metadata,
      createdAt: serverTs(),
    }).catch((err) => {
      // Non-fatal — log locally but never throw
      console.warn(`[AuditLog] write failed (${event}):`, err.message);
    });
  },

  /**
   * Fetch recent audit entries.
   * @param {{ limit?: number, userId?: string }} opts
   * @returns {Promise<Object[]>}
   */
  async getRecent({ limit: lim = 100, userId } = {}) {
    let q = auditCol().orderBy('createdAt', 'desc').limit(lim);
    if (userId) q = q.where('userId', '==', userId);
    const snap = await q.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
};

export default AuditLog;