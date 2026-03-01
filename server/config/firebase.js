/**
 * config/firebase.js
 * ═══════════════════════════════════════════════════════════════════
 * Initialises Firebase Admin SDK, Realtime Database, and Firestore.
 *
 * RTDB      → hot path for auth/permission reads (low latency)
 * Firestore → rich queries, audit logs, approval queue, user profiles
 * ═══════════════════════════════════════════════════════════════════
 */

import admin      from 'firebase-admin';
import { initializeApp as initClientApp } from 'firebase/app';
import { getDatabase }  from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ── Admin SDK (server-side) ──────────────────────────────────────────
if (!admin.apps.length) {
  const serviceAccount = require('../quotesapp-26f84-firebase-adminsdk-fbsvc-d945847f08.json');

  admin.initializeApp({
    credential:   admin.credential.cert(serviceAccount),
    databaseURL:  process.env.FIREBASE_DATABASE_URL,
  });
}

// ── Client SDK (for Realtime DB + Firestore reads) ───────────────────
const clientApp = initClientApp({
  apiKey:            process.env.FIREBASE_API_KEY,
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL:       process.env.FIREBASE_DATABASE_URL,
  projectId:         process.env.FIREBASE_PROJECT_ID,
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.FIREBASE_APP_ID,
}, 'client');

/** Firebase Admin SDK instance */
export { admin };

/** Realtime Database (client SDK) — hot permission reads */
export const db = getDatabase(clientApp);

/** Firestore (client SDK) — queries, audit, approval queue */
export const firestore = getFirestore(clientApp);

/** Admin Firestore — server writes with elevated privilege */
export const adminFirestore = admin.firestore();

/** Admin RTDB — server writes */
export const adminDb = admin.database();