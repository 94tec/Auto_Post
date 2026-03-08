/**
 * services/auditLog.js
 * ════════════════════════════════════════════════════════
 * Structured audit trail written to Firestore "auditLogs".
 *
 * Usage:
 *   import AuditLog from '../services/auditLog.js';
 *
 *   AuditLog.record(AuditLog.EVENTS.USER_LOGIN, { userId, ip, userAgent, metadata });
 *   // NOTE: do NOT await record() — it is intentionally fire-and-forget.
 *
 *   const logs = await AuditLog.getRecent({ limit: 50, userId: 'xxx' });
 *
 * WHY fire-and-forget:
 *   Firestore may be unavailable (not yet provisioned, quota hit, network
 *   blip). Audit logs must NEVER block or crash a user-facing request.
 *   record() returns void immediately; the write happens in the background.
 * ════════════════════════════════════════════════════════
 */

import { adminFirestore } from '../config/firebase.js';

const col = () => adminFirestore.collection('auditLogs');

/* ── Event name constants ──────────────────────────────── */
const EVENTS = {
  USER_REGISTERED:              'USER_REGISTERED',
  USER_LOGIN:                   'USER_LOGIN',
  USER_LOGOUT:                  'USER_LOGOUT',
  USER_SUSPENDED:               'USER_SUSPENDED',
  USER_REACTIVATED:             'USER_REACTIVATED',
  EMAIL_VERIFICATION:           'EMAIL_VERIFICATION',
  EMAIL_VERIFICATION_RESEND:    'EMAIL_VERIFICATION_RESEND',
  GUEST_APPROVED:               'GUEST_APPROVED',
  GUEST_PROMOTED:               'GUEST_PROMOTED',
  PERMISSION_GRANTED:           'PERMISSION_GRANTED',
  PERMISSION_REVOKED:           'PERMISSION_REVOKED',
  PERMISSION_OVERRIDE:          'PERMISSION_OVERRIDE',
  PASSWORD_RESET_REQUESTED:     'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED:     'PASSWORD_RESET_COMPLETED',
  PASSWORD_RESET_FAILED:        'PASSWORD_RESET_FAILED',
  PASSWORD_RESET_ATTEMPT:       'PASSWORD_RESET_ATTEMPT',
  PASSWORD_RESET_FAILURE:       'PASSWORD_RESET_FAILURE',
  PASSWORD_RESET_VERIFICATION:  'PASSWORD_RESET_VERIFICATION',
  PASSWORD_CHANGE:              'PASSWORD_CHANGE',
  PROFILE_UPDATE:               'PROFILE_UPDATE',
  ACCOUNT_DELETION:             'ACCOUNT_DELETION',
  QUOTE_CREATED:                'QUOTE_CREATED',
  QUOTE_DELETED:                'QUOTE_DELETED',
  ADMIN_SEED_CREATE:            'ADMIN_SEED_CREATE',
  ADMIN_SEED_UPGRADE:           'ADMIN_SEED_UPGRADE',
};

/* ── record — FIRE AND FORGET, never await ─────────────── */
/**
 * @param {string} action  — one of EVENTS.*
 * @param {{ userId?, ip?, userAgent?, metadata? }} opts
 * @returns {void}  — intentionally NOT a Promise
 */
const record = (action, { userId, ip, userAgent, metadata } = {}) => {
  Promise.resolve()
    .then(async () => {
      const ref = col().doc();
      await ref.set({
        id:        ref.id,
        action:    action    || 'UNKNOWN',
        userId:    userId    || 'system',
        ip:        ip        || 'unknown',
        userAgent: userAgent || 'unknown',
        metadata:  metadata  || {},
        createdAt: new Date().toISOString(),
      });
    })
    .catch((err) => {
      // Warn only — never crash. Enable Firestore in your Firebase console
      // (Firestore → Create database) to persist audit logs.
      console.warn('[AuditLog] write skipped:', err.code || err.message);
    });
};

/* ── getRecent — awaitable, used by admin dashboard ───── */
/**
 * @param {{ limit?: number, userId?: string, action?: string }}
 * @returns {Promise<Object[]>}
 */
const getRecent = async ({ limit = 100, userId, action } = {}) => {
  const snap = await col().orderBy('createdAt', 'desc').limit(limit).get();
  let logs = snap.docs.map((d) => d.data());
  if (userId) logs = logs.filter((l) => l.userId === userId);
  if (action)  logs = logs.filter((l) => l.action === action);
  return logs;
};

/* ── Export ────────────────────────────────────────────── */
const AuditLog = { record, getRecent, EVENTS };

export default AuditLog;
export { record, getRecent, EVENTS };