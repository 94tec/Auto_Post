/**
 * models/verificationModel.js
 * ═══════════════════════════════════════════════════════════════════
 * Stores hashed oobCode tokens in Firestore for email verification.
 *
 * WHAT CHANGED vs old version
 * ───────────────────────────────────────────────────────────────────
 *  Old code imported collection, doc, setDoc, getDocs, updateDoc,
 *  serverTimestamp from 'firebase/firestore' (client SDK) and used
 *  the client `firestore` instance. On the server this hits security
 *  rules → Code 7 PERMISSION_DENIED.
 *
 *  New code uses adminFirestore (Admin SDK) exclusively.
 *  admin.firestore.FieldValue.serverTimestamp() replaces the client
 *  SDK's serverTimestamp() import.
 * ═══════════════════════════════════════════════════════════════════
 */

import { admin, adminFirestore } from '../config/firebase.js';

/* ── Helpers ─────────────────────────────────────────────────────── */
const verCol  = () => adminFirestore.collection('emailVerifications');
const serverTs = () => admin.firestore.FieldValue.serverTimestamp();

const VerificationModel = {

  /**
   * Store a new verification token record.
   * NOTE: emailService.js now writes directly to avoid a double round-trip.
   *       This create() method is kept for any direct callers that still use it.
   *
   * @param {{ userId, email, ip, token, expiresAt }} params
   * @returns {Promise<{ id, userId, email, token, expiresAt }>}
   */
  async create({ userId, email, ip, token, expiresAt }) {
    const id = `${userId}_${Date.now()}`;
    await verCol().doc(id).set({
      id,
      userId,
      email,
      ip:        ip || null,
      token,
      consumed:  false,
      expiresAt,
      createdAt: serverTs(),
    });
    return { id, userId, email, token, expiresAt };
  },

  /**
   * Find the most recent un-consumed record matching this token hash.
   * Returns null if not found.
   *
   * @param {string} tokenHash
   * @returns {Promise<Object|null>}
   */
  async findByToken(tokenHash) {
    const snap = await verCol()
      .where('token',    '==', tokenHash)
      .where('consumed', '==', false)
      .limit(1)
      .get();

    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  },

  /**
   * Mark a verification record as consumed (one-time use).
   * @param {string} id — document id
   */
  async markAsConsumed(id) {
    await verCol().doc(id).update({
      consumed:   true,
      consumedAt: serverTs(),
    });
  },
};

export default VerificationModel;