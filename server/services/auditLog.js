import { db } from '../config/firebase.js';
import geoip from 'geoip-lite';
import useragent from 'useragent';
import { v4 as uuidv4 } from 'uuid';
import { encrypt, safeEncryptObject } from '../utils/validator.js';

function removeUndefined(obj) {
  return JSON.parse(JSON.stringify(obj));
}

class AuditLog {
  /**
   * Record an audit event
   * @param {string} eventType - Type of audit event
   * @param {Object} data - Metadata for the event
   */
  static async record(eventType, data) {
    try {
      if (!eventType) {
        throw new Error('Missing required audit log fields');
      }
      // Set default IP if not provided
      const ip = data?.ip || data?.ipAddress || 'unknown';

      const agent = useragent.parse(data.userAgent || '');
      const deviceInfo = {
        browser: agent?.family ?? null,
        os: agent?.os?.family ?? null,
        device: agent?.device?.family ?? null,
        isMobile:
          typeof agent?.device?.isMobile === 'boolean'
            ? agent.device.isMobile
            : false,
      };

      const geo = geoip.lookup(data.ip) || {};
      const location = {
        country: geo.country ?? null,
        region: geo.region ?? null,
        city: geo.city ?? null,
        ll: geo.ll ?? null,
      };

      const now = new Date().toISOString();
      const userId = data.userId || 'unknown';

      const logData = {
        id: uuidv4(),
        eventType,
        timestamp: now,
        userId,
        email: data.email ? encrypt(data.email) : null,
        ipAddress: encrypt(ip),
        userAgent: data.userAgent || null,
        deviceInfo,
        location,
        metadata: data.metadata ? safeEncryptObject(data.metadata) : null,
        error: data.error || null,
      };

      const sanitizedLog = removeUndefined(logData);
      //console.log('📝 Audit log writing:', data);
      await this._writeWithRetry(userId, sanitizedLog);

      console.log(`✅ Audit log recorded: ${eventType} for ${userId}`);
    } catch (error) {
      console.error('❌ Failed to record audit log:', error.message);
      console.error('📄 Audit Log Fallback:', {
        eventType,
        ...data,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
  /**
   * Retry-safe writer
   */
  static async _writeWithRetry(userId, logData, attempt = 1) {
    const maxAttempts = 3;
    const ref = db.ref(`users/${userId}/auditLogs/${logData.id}`);
    try {
      await ref.set(logData);
    } catch (error) {
      if (attempt >= maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      return this._writeWithRetry(userId, logData, attempt + 1);
    }
  }

  /**
   * Get logs by user ID
   */
  static async getByUserId(userId, limit = 100) {
    try {
      const snapshot = await db
        .ref(`users/${userId}/auditLogs`)
        .orderByChild('timestamp')
        .limitToLast(limit)
        .once('value');

      const logs = [];
      snapshot.forEach(child => logs.push(child.val()));
      return logs.reverse();
    } catch (error) {
      console.error('❌ Failed to fetch audit logs:', error.message);
      throw new Error('Could not retrieve audit logs');
    }
  }

  /**
   * Get recent logs globally by eventType (expensive)
   */
  static async getRecentEvents(eventType, hours = 24, limit = 1000) {
    try {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - hours);
      const cutoffIso = cutoff.toISOString();

      const allLogsSnapshot = await db.ref('users').once('value');
      const logs = [];

      allLogsSnapshot.forEach(userSnap => {
        const userLogs = userSnap.child('auditLogs');
        userLogs.forEach(child => {
          const log = child.val();
          if (log.eventType === eventType && log.timestamp >= cutoffIso) {
            logs.push(log);
          }
        });
      });

      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return logs.slice(0, limit);
    } catch (error) {
      console.error('❌ Failed to fetch recent events:', error.message);
      throw new Error('Could not retrieve recent events');
    }
  }
}

// Event Types
AuditLog.EVENTS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  REGISTRATION: 'REGISTRATION',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PASSWORD_RESET: 'PASSWORD_RESET',
  ACCOUNT_LOCK: 'ACCOUNT_LOCK',
  ACCOUNT_UNLOCK: 'ACCOUNT_UNLOCK',
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  ROLE_CHANGE: 'ROLE_CHANGE',
  EMAIL_VERIFICATION_RESEND: 'VERIFICATION_RESENT'
};

export default AuditLog;
