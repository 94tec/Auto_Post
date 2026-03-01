/**
 * models/verificationModel.js
 * ═══════════════════════════════════════════════════════════════════
 * Stores hashed oobCode tokens in Firestore for email verification.
 * ═══════════════════════════════════════════════════════════════════
 */

import {
  collection, doc, setDoc, getDocs,
  query, where, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { firestore } from '../config/firebase.js';

const verCol = () => collection(firestore, 'emailVerifications');

const VerificationModel = {
  async create({ userId, email, ip, token, expiresAt }) {
    const id  = `${userId}_${Date.now()}`;
    const ref = doc(verCol(), id);
    await setDoc(ref, {
      id, userId, email, ip, token,
      consumed:  false,
      expiresAt,
      createdAt: serverTimestamp(),
    });
    return { id, userId, email, token, expiresAt };
  },

  async findByToken(tokenHash) {
    const q    = query(verCol(), where('token', '==', tokenHash), where('consumed', '==', false));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  },

  async markAsConsumed(id) {
    const ref = doc(verCol(), id);
    await updateDoc(ref, { consumed: true, consumedAt: serverTimestamp() });
  },
};

export default VerificationModel;