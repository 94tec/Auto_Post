/**
 * services/auditLog.js
 * ═══════════════════════════════════════════════════════════════════
 * Immutable audit trail stored in Firestore.
 * Every sensitive action creates a record here.
 * ═══════════════════════════════════════════════════════════════════
 */

import {
  collection, addDoc, query, orderBy,
  limit, where, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { firestore } from '../config/firebase.js';

const auditCol = () => collection(firestore, 'auditLogs');

const EVENTS = Object.freeze({
  USER_REGISTERED:            'USER_REGISTERED',
  USER_LOGIN:                 'USER_LOGIN',
  EMAIL_VERIFICATION:         'EMAIL_VERIFICATION',
  EMAIL_VERIFICATION_RESEND:  'EMAIL_VERIFICATION_RESEND',
  GUEST_APPROVED:             'GUEST_APPROVED',
  GUEST_PROMOTED:             'GUEST_PROMOTED',
  PERMISSION_GRANTED:         'PERMISSION_GRANTED',
  PERMISSION_REVOKED:         'PERMISSION_REVOKED',
  PERMISSION_OVERRIDE:        'PERMISSION_OVERRIDE',
  USER_SUSPENDED:             'USER_SUSPENDED',
  USER_REACTIVATED:           'USER_REACTIVATED',
  QUOTE_CREATED:              'QUOTE_CREATED',
  QUOTE_UPDATED:              'QUOTE_UPDATED',
  QUOTE_DELETED:              'QUOTE_DELETED',
});

const AuditLog = {
  EVENTS,

  async record(event, { userId, ip, userAgent, metadata = {} } = {}) {
    try {
      await addDoc(auditCol(), {
        event,
        userId:    userId || null,
        ip:        ip     || null,
        userAgent: userAgent || null,
        metadata,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      // Non-fatal — never let audit failure break the main flow
      console.error('AuditLog.record failed:', err.message);
    }
  },

  async getRecent({ limit: lim = 100, userId } = {}) {
    const constraints = [orderBy('createdAt', 'desc'), limit(lim)];
    if (userId) constraints.push(where('userId', '==', userId));
    const snap = await getDocs(query(auditCol(), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
};

export default AuditLog;