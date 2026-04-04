/**
 * utils/sessionRevoke.js
 * ═══════════════════════════════════════════════════════════════
 * Server-side session revocation.
 *
 * Call this whenever you want to force a client to sign out:
 *   • Password reset completed
 *   • Account suspended
 *   • Admin "Force logout" action
 *   • Security incident
 *
 * WHAT IT DOES
 * ─────────────────────────────────────────────────────────────
 *  1. Firebase revokeRefreshTokens(uid)
 *     → invalidates ALL refresh tokens server-side
 *
 *  2. Sets RTDB flag: users/{uid}/session/forceLogout = true
 *     → SessionWatcher polls this every 60s and signs out client
 * ═══════════════════════════════════════════════════════════════
 */

import admin       from 'firebase-admin';
import { adminDb } from '../config/firebase.js';

/**
 * Revokes all Firebase refresh tokens for a user and sets the
 * RTDB forceLogout flag so the client signs out within 60s.
 *
 * @param {string} uid      — Firebase UID
 * @param {string} reason   — Reason string for audit / RTDB record
 * @returns {Promise<void>}
 */
export const revokeUserSession = async (uid, reason = 'manual') => {
  const errors = [];

  // 1. Revoke Firebase refresh tokens
  try {
    await admin.auth().revokeRefreshTokens(uid);
    console.log(`[SessionRevoke] Tokens revoked for ${uid} (${reason})`);
  } catch (err) {
    console.error(`[SessionRevoke] Failed to revoke tokens for ${uid}:`, err.message);
    errors.push(`token_revoke: ${err.message}`);
  }

  // 2. Set RTDB forceLogout flag — picked up by SessionWatcher within 60s
  try {
    await adminDb.ref(`users/${uid}/session`).update({
      forceLogout:  true,
      revokedAt:    new Date().toISOString(),
      revokeReason: reason,
    });
    console.log(`[SessionRevoke] RTDB forceLogout flag set for ${uid}`);
  } catch (err) {
    console.error(`[SessionRevoke] Failed to set RTDB flag for ${uid}:`, err.message);
    errors.push(`rtdb_flag: ${err.message}`);
  }

  // Only throw if BOTH operations failed
  if (errors.length === 2) {
    throw new Error(`Session revocation failed: ${errors.join(', ')}`);
  }
};

/**
 * Clear the forceLogout flag after it's been consumed.
 * SessionWatcher clears it client-side automatically,
 * but you can also call this server-side if needed.
 *
 * @param {string} uid — Firebase UID
 */
export const clearForceLogoutFlag = async (uid) => {
  try {
    await adminDb.ref(`users/${uid}/session/forceLogout`).remove();
    console.log(`[SessionRevoke] Cleared forceLogout flag for ${uid}`);
  } catch (err) {
    console.error(`[SessionRevoke] Failed to clear RTDB flag for ${uid}:`, err.message);
    throw new Error(`Failed to clear forceLogout flag: ${err.message}`);
  }
};