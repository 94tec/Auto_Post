/**
 * scripts/seedAdmin.js
 * ═══════════════════════════════════════════════════════════════════
 * Creates the first admin account — the ONLY way to make an admin.
 * /api/auth/register always assigns role: 'guest'. This script bypasses
 * that by writing directly to Firebase Auth + RTDB + Firestore.
 *
 * ── Your data schema (from userRoutes.js) ──────────────────────────
 *
 *  Realtime Database:  users/{uid}/
 *    basic/
 *      uid            string
 *      email          string
 *      displayName    string
 *      role           'admin'
 *      status         'active'
 *      emailVerified  true
 *      adminApproved  true
 *      createdAt      ISO string
 *      updatedAt      ISO string
 *    permissions/
 *      read           true
 *      write          true
 *      delete         true
 *      manageUsers    true
 *      accessAdmin    true
 *    meta/
 *      lastLogin      null
 *      seededAt       ISO string
 *
 *  Firestore:  users/{uid}   (mirror for queries)
 *    Same fields as RTDB basic + permissions, flat
 *
 * ── Usage ──────────────────────────────────────────────────────────
 *
 *  Option A – .env file already configured:
 *    node utils/seedAdmin.js
 *
 *  Option B – inline env vars (no .env needed):
 *    ADMIN_EMAIL=you@example.com \
 *    ADMIN_PASSWORD=MyPass123! \
 *    ADMIN_NAME="Your Name" \
 *    FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com \
 *    node utils/seedAdmin.js
 *
 *  Option C – npm script (after adding to package.json):
 *    npm run seed:admin
 *
 * ── Re-runnable ─────────────────────────────────────────────────────
 *  Safe to run multiple times. If the account already exists it will
 *  be upgraded to admin without changing the password or createdAt.
 * ═══════════════════════════════════════════════════════════════════
 */

import 'dotenv/config';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import { readFileSync }   from 'fs';

// firebase-admin is CJS — use createRequire inside ESM
const require   = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const admin     = require('firebase-admin');

/* ── Load service account ──────────────────────────────────────── */
const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  join(__dirname, '..', 'quotesapp-26f84-firebase-adminsdk-fbsvc-d945847f08.json');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch {
  fatal(
    `Cannot read service account JSON at:\n  ${serviceAccountPath}\n\n` +
    `Fix: set FIREBASE_SERVICE_ACCOUNT_PATH in .env, or place the JSON in the server root.`
  );
}

/* ── Init Firebase Admin ───────────────────────────────────────── */
const databaseURL = process.env.FIREBASE_DATABASE_URL;
if (!databaseURL) fatal('FIREBASE_DATABASE_URL is not set. Add it to .env or export it before running.');

if (!admin.apps.length) {
  admin.initializeApp({
    credential:  admin.credential.cert(serviceAccount),
    databaseURL,
  });
}

const auth      = admin.auth();
const rtdb      = admin.database();
const firestore = admin.firestore();

/* ── Admin permissions  (matches your permissions/* RTDB node) ──── */
const ADMIN_PERMISSIONS = {
  read:        true,
  write:       true,
  delete:      true,
  manageUsers: true,
  accessAdmin: true,
};

/* ══════════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════════ */
async function seed() {
  // ── Validate env vars ────────────────────────────────────────────
  const email    = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const name     = process.env.ADMIN_NAME?.trim() || 'System Admin';

  if (!email)    fatal('ADMIN_EMAIL is not set.');
  if (!password) fatal('ADMIN_PASSWORD is not set.');
  if (password.length < 8) fatal('ADMIN_PASSWORD must be at least 8 characters.');

  banner(email, name);
  const now = new Date().toISOString();

  /* ── 1. Firebase Auth: create or fetch ──────────────────────── */
  let firebaseUser;
  let authExisted = false;

  try {
    firebaseUser  = await auth.getUserByEmail(email);
    authExisted   = true;
    step(`Auth user found          uid: ${firebaseUser.uid}`);
    // Make sure it's enabled and verified
    await auth.updateUser(firebaseUser.uid, {
      displayName:   name,
      emailVerified: true,
      disabled:      false,
    });
    step('Auth user updated        emailVerified=true, disabled=false');
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    firebaseUser = await auth.createUser({
      email,
      password,
      displayName:   name,
      emailVerified: true,   // skip email verification flow for admin
      disabled:      false,
    });
    step(`Auth user created        uid: ${firebaseUser.uid}`);
  }

  const { uid } = firebaseUser;

  /* ── 2. Read existing RTDB record (preserve createdAt) ──────── */
  const existingSnap = await rtdb.ref(`users/${uid}/basic`).once('value');
  const existingBasic = existingSnap.val();

  if (existingBasic) {
    step(`RTDB record found        role was: '${existingBasic.role}'`);
  } else {
    step('RTDB record not found    creating fresh');
  }

  /* ── 3. Write RTDB — nested schema matching userRoutes.js ───── */
  //
  //  getUserById(uid) in your model reads:
  //    basic/*, permissions/*, meta/*
  //  so we write exactly those paths.
  //
  const rtdbPayload = {
    [`users/${uid}/basic/uid`]:            uid,
    [`users/${uid}/basic/email`]:          email.toLowerCase(),
    [`users/${uid}/basic/displayName`]:    name,
    [`users/${uid}/basic/role`]:           'admin',
    [`users/${uid}/basic/status`]:         'active',
    [`users/${uid}/basic/emailVerified`]:  true,
    [`users/${uid}/basic/adminApproved`]:  true,
    [`users/${uid}/basic/createdAt`]:      existingBasic?.createdAt || now,
    [`users/${uid}/basic/updatedAt`]:      now,
    // permissions — read by:  user.permissions.write, user.permissions.accessAdmin, etc.
    [`users/${uid}/permissions/read`]:        true,
    [`users/${uid}/permissions/write`]:       true,
    [`users/${uid}/permissions/delete`]:      true,
    [`users/${uid}/permissions/manageUsers`]: true,
    [`users/${uid}/permissions/accessAdmin`]: true,
    // meta
    [`users/${uid}/meta/lastLogin`]:   null,
    [`users/${uid}/meta/seededAt`]:    now,
    [`users/${uid}/meta/seededBy`]:    'seedAdmin.js',
  };

  // rtdb.ref('/').update() lets us do multi-path writes atomically
  await rtdb.ref('/').update(rtdbPayload);
  step(`RTDB written              users/${uid}`);

  /* ── 4. Mirror to Firestore ─────────────────────────────────── */
  await firestore.collection('users').doc(uid).set({
    uid,
    email:         email.toLowerCase(),
    displayName:   name,
    role:          'admin',
    status:        'active',
    emailVerified: true,
    adminApproved: true,
    permissions:   ADMIN_PERMISSIONS,
    createdAt:     existingBasic?.createdAt || now,
    updatedAt:     now,
    seededAt:      now,
  }, { merge: true });        // merge: don't wipe fields we didn't include
  step(`Firestore written         users/${uid}`);

  /* ── 5. Audit log ───────────────────────────────────────────── */
  const auditRef = firestore.collection('auditLogs').doc();
  await auditRef.set({
    id:        auditRef.id,
    action:    authExisted ? 'ADMIN_SEED_UPGRADE' : 'ADMIN_SEED_CREATE',
    uid,
    email:     email.toLowerCase(),
    role:      'admin',
    ip:        'seed-script',
    details:   `Admin ${authExisted ? 'upgraded' : 'created'} via seedAdmin.js`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  step('Audit log written');

  /* ── Done ───────────────────────────────────────────────────── */
  console.log(`
────────────────────────────────────────────
✅  Admin ready!

   UID:          ${uid}
   Email:        ${email}
   Role:         admin
   Permissions:  read · write · delete · manageUsers · accessAdmin

   Sign in with these credentials at your frontend.
   /api/admin/* will be accessible to this account only.
────────────────────────────────────────────
`);
  process.exit(0);
}

/* ── Helpers ─────────────────────────────────────────────────────── */
function banner(email, name) {
  console.log(`
════════════════════════════════════════════
  🌱  Damuchi Admin Seeder
════════════════════════════════════════════
   Email: ${email}
   Name:  ${name}
────────────────────────────────────────────`);
}

function step(msg) { console.log(`   ✓ ${msg}`); }

function fatal(msg) {
  console.error(`\n❌  ${msg}\n`);
  process.exit(1);
}

/* ── Run ─────────────────────────────────────────────────────────── */
seed().catch(err => {
  console.error('\n❌  Seeder crashed unexpectedly:');
  console.error(err?.message || err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});