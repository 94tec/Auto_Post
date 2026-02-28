import dotenv from 'dotenv';
dotenv.config();

import AuditLog from '../services/auditLog.js';

const uid = process.argv[2]; // Pass userId via CLI
if (!uid) {
  console.error('Usage: node decryptAuditLog.js <userId>');
  process.exit(1);
}

(async () => {
  const logs = await AuditLog.getByUserId(uid);
  console.log(JSON.stringify(logs, null, 2));
})();
