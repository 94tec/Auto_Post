/**
 * config/firebase.js
 */

import admin                              from 'firebase-admin';
import { initializeApp as initClientApp } from 'firebase/app';
import { getAuth }                        from 'firebase/auth';

/* ── Admin SDK ───────────────────────────────────────────────────────
   projectId   → required for Firestore gRPC endpoint resolution
   databaseURL → required for RTDB
   credential  → service account bypasses all security rules
 ─────────────────────────────────────────────────────────────────── */
if (!admin.apps.length) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  admin.initializeApp({
    credential:  admin.credential.cert(serviceAccountPath),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId:   process.env.FIREBASE_PROJECT_ID,   // ← THE FIX for "5 NOT_FOUND"
  });
}

/** Firebase Admin SDK namespace. Use admin.auth(), admin.firestore.FieldValue, etc. */
export { admin };

/**
 * Admin Realtime Database — use for ALL RTDB operations.
 * adminDb.ref('users/uid').set / update / once('value') / remove
 */
export const adminDb = admin.database();

/**
 * Admin Firestore — use for ALL Firestore operations.
 * adminFirestore.collection('x').doc('y').set / update / get / delete
 * Server timestamp: admin.firestore.FieldValue.serverTimestamp()
 */
export const adminFirestore = admin.firestore();

// Drop undefined fields silently instead of throwing.
// Fixes: "Cannot use undefined as a Firestore value" in audit logs.
adminFirestore.settings({ ignoreUndefinedProperties: true });

/* ── Client SDK — Auth only ──────────────────────────────────────────
   Used ONLY for firebaseAuth.signOut() in the logout controller.
   Do NOT use for any database reads or writes.
 ─────────────────────────────────────────────────────────────────── */
const _clientApp = initClientApp({
  apiKey:     process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId:  process.env.FIREBASE_PROJECT_ID,
}, 'client');

/**
 * Client Auth — signOut() only.
 * Never use getDatabase(clientApp) or getFirestore(clientApp) on the server.
 */
export const firebaseAuth = getAuth(_clientApp);