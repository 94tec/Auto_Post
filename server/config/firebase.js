// server/config/firebase.js
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { createRequire } from 'module';

dotenv.config();
const require = createRequire(import.meta.url);
//const serviceAccount = require('../quotesapp-26f84-firebase-adminsdk-fbsvc-d247cc6b4d.json');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY1);

// Initialize Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

// Realtime DB
const db = admin.database();

// Client SDK config (if needed on server)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const firebaseClientApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseClientApp);

// Test DB connection
db.ref('/').once('value')
  .then(() => {
    console.log('✅ Firebase Realtime Database connected successfully.');
  })
  .catch((err) => {
    console.error('❌ Firebase connection failed:', err.message);
  });

// ✅ EXPORT in ESM style
export {
  admin,
  db,
  firebaseAuth,
  firebaseClientApp,
};


