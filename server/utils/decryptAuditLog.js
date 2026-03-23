/**
 * utils/decryptAuditLog.js
 * ═══════════════════════════════════════════════════════════════════
 * CLI tool — fetch and print audit logs for a given user ID.
 *
 * Usage:
 *   node utils/decryptAuditLog.js <userId>
 *   node utils/decryptAuditLog.js <userId> --limit 50
 * ═══════════════════════════════════════════════════════════════════
 */

import 'dotenv/config';
import AuditLog from '../services/auditLog.js';

const [,, uid, ...flags] = process.argv;

if (!uid) {
  console.error('Usage: node utils/decryptAuditLog.js <userId> [--limit N]');
  process.exit(1);
}

// Parse --limit flag
const limitIdx = flags.indexOf('--limit');
const limit    = limitIdx !== -1 ? parseInt(flags[limitIdx + 1], 10) : 100;

(async () => {
  try {
    const logs = await AuditLog.getByUserId(uid, { limit });

    if (!logs || logs.length === 0) {
      console.log(`No audit logs found for uid: ${uid}`);
      process.exit(0);
    }

    console.log(`\n══ Audit logs for ${uid} (${logs.length} entries) ══\n`);
    console.log(JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error('Error fetching audit logs:', err.message);
    process.exit(1);
  }
})();