/**
 * models/quote.js
 * ═══════════════════════════════════════════════════════════════════
 * All Firestore operations for the quotes collection.
 *
 * WHAT CHANGED vs old version
 * ───────────────────────────────────────────────────────────────────
 *  Old code imported collection, doc, getDoc, getDocs, addDoc,
 *  updateDoc, deleteDoc, query, where, orderBy, limit, startAfter,
 *  serverTimestamp from 'firebase/firestore' (client SDK) and used
 *  the exported `firestore` client instance.
 *
 *  On the server there is no signed-in Firebase user, so every client
 *  SDK write → Code 7 PERMISSION_DENIED and every read → may fail
 *  depending on your security rules.
 *
 *  New code uses adminFirestore (Admin SDK) exclusively.
 *  admin.firestore.FieldValue.serverTimestamp() replaces the client
 *  SDK's serverTimestamp() import.
 *
 *  Pagination note: startAfter() with a document snapshot is a client
 *  SDK concept. With Admin SDK we use the document snapshot from
 *  adminFirestore — the API is identical, just sourced correctly.
 * ═══════════════════════════════════════════════════════════════════
 */

import { admin, adminFirestore } from '../config/firebase.js';

/* ── Helpers ─────────────────────────────────────────────────────── */
const quotesCol = () => adminFirestore.collection('quotes');
const quoteDoc  = (id) => adminFirestore.collection('quotes').doc(id);
const serverTs  = () => admin.firestore.FieldValue.serverTimestamp();

/* ══════════════════════════════════════════════════════════════════
   CREATE
   ══════════════════════════════════════════════════════════════════ */

/**
 * @param {{ text, author, category, userId, createdBy }} params
 * @returns {Promise<{ id, text, author, category, userId, createdBy }>}
 */
export const createQuote = async ({ text, author, category, userId, createdBy }) => {
  const data = {
    text:      text.trim(),
    author:    author.trim(),
    category:  category?.trim() || 'general',
    userId,
    createdBy,
    createdAt: serverTs(),
    updatedAt: serverTs(),
  };

  const ref = await quotesCol().add(data);
  return { id: ref.id, ...data };
};

/* ══════════════════════════════════════════════════════════════════
   READ
   ══════════════════════════════════════════════════════════════════ */

/**
 * Fetch a single quote by Firestore document ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export const getQuoteById = async (id) => {
  const snap = await quoteDoc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
};

/**
 * Fetch a paginated list of quotes with optional filters.
 * @param {{ category?, author?, pageSize?, lastDocId? }} options
 *   lastDocId — Firestore document ID of the last item from the previous page
 * @returns {Promise<Object[]>}
 */
export const getQuotes = async ({ category, author, pageSize = 50, lastDocId } = {}) => {
  let q = quotesCol().orderBy('createdAt', 'desc').limit(pageSize);

  if (category) q = q.where('category', '==', category);
  if (author)   q = q.where('author',   '==', author);

  // Cursor-based pagination — fetch the last doc snapshot by ID
  if (lastDocId) {
    const lastSnap = await quoteDoc(lastDocId).get();
    if (lastSnap.exists) q = q.startAfter(lastSnap);
  }

  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Fetch all quotes created by a specific user.
 * @param {string} userId
 * @returns {Promise<Object[]>}
 */
export const getQuotesByUser = async (userId) => {
  const snap = await quotesCol()
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Check if a quote with identical text already exists.
 * Used to prevent exact duplicates.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export const quoteDuplicateExists = async (text) => {
  const snap = await quotesCol()
    .where('text', '==', text.trim())
    .limit(1)
    .get();
  return !snap.empty;
};

/* ══════════════════════════════════════════════════════════════════
   UPDATE
   ══════════════════════════════════════════════════════════════════ */

/**
 * Partially update a quote. Only text, author, category are patchable.
 * @param {string} id
 * @param {{ text?, author?, category? }} patch
 * @returns {Promise<{ id, ...patch }>}
 */
export const updateQuote = async (id, patch) => {
  const allowed = { updatedAt: serverTs() };
  if (patch.text)     allowed.text     = patch.text.trim();
  if (patch.author)   allowed.author   = patch.author.trim();
  if (patch.category) allowed.category = patch.category.trim();

  await quoteDoc(id).update(allowed);
  return { id, ...allowed };
};

/* ══════════════════════════════════════════════════════════════════
   DELETE
   ══════════════════════════════════════════════════════════════════ */

/**
 * Hard-delete a quote document.
 * @param {string} id
 */
export const deleteQuote = async (id) => {
  await quoteDoc(id).delete();
};