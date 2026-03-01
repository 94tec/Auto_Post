/**
 * models/quote.js
 * ═══════════════════════════════════════════════════════════════════
 * All Firestore operations for the quotes collection.
 * Quotes are stored in Firestore for rich filtering/searching.
 * ═══════════════════════════════════════════════════════════════════
 */

import {
  collection, doc, getDoc, getDocs, addDoc,
  updateDoc, deleteDoc, query, where,
  orderBy, limit, startAfter, serverTimestamp,
} from 'firebase/firestore';
import { firestore } from '../config/firebase.js';

const quotesCol = () => collection(firestore, 'quotes');
const quoteDoc  = (id) => doc(firestore, 'quotes', id);

/* ── Create ─────────────────────────────────────────────────────── */
export const createQuote = async ({ text, author, category, userId, createdBy }) => {
  const ref = await addDoc(quotesCol(), {
    text:      text.trim(),
    author:    author.trim(),
    category:  category?.trim() || 'general',
    userId,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, text, author, category, userId, createdBy };
};

/* ── Read ───────────────────────────────────────────────────────── */
export const getQuoteById = async (id) => {
  const snap = await getDoc(quoteDoc(id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getQuotes = async ({ category, author, pageSize = 50, lastDoc } = {}) => {
  const constraints = [orderBy('createdAt', 'desc'), limit(pageSize)];
  if (category) constraints.push(where('category', '==', category));
  if (lastDoc)  constraints.push(startAfter(lastDoc));

  const q    = query(quotesCol(), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getQuotesByUser = async (userId) => {
  const q    = query(quotesCol(), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const quoteDuplicateExists = async (text) => {
  const q    = query(quotesCol(), where('text', '==', text.trim()));
  const snap = await getDocs(q);
  return !snap.empty;
};

/* ── Update ─────────────────────────────────────────────────────── */
export const updateQuote = async (id, patch) => {
  const allowed = {};
  if (patch.text)     allowed.text     = patch.text.trim();
  if (patch.author)   allowed.author   = patch.author.trim();
  if (patch.category) allowed.category = patch.category.trim();
  allowed.updatedAt = serverTimestamp();
  await updateDoc(quoteDoc(id), allowed);
  return { id, ...allowed };
};

/* ── Delete ─────────────────────────────────────────────────────── */
export const deleteQuote = async (id) => {
  await deleteDoc(quoteDoc(id));
};