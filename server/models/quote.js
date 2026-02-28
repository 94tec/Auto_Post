// models/quote.js
import { db } from '../config/firebase.js';

// Utility: Normalize quote text to avoid casing/space duplicates
const normalizeText = (text) => {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
};

const quoteExists = async (text) => {
  const normalized = normalizeText(text);
  const snapshot = await db.ref('quotes')
    .orderByChild('normalizedText')
    .equalTo(normalized)
    .once('value');
  return snapshot.exists();
};

// ➕ Create a new unique quote
const createQuote = async ({ text, author, uid }) => {
  const normalized = normalizeText(text);
  const newQuoteRef = db.ref('quotes').push();
  await newQuoteRef.set({
    text: text.trim(),
    normalizedText: normalized,
    author: author || 'Unknown',
    uid,
    createdAt: new Date().toISOString(),
  });
  return newQuoteRef.key;
};

// 📄 Get all quotes
const getAllQuotes = async () => {
  const snapshot = await db.ref('quotes').once('value');
  return snapshot.val() || {};
};

// 📄 Get quote by ID
const getQuoteById = async (id) => {
  const snapshot = await db.ref(`quotes/${id}`).once('value');
  return snapshot.exists() ? snapshot.val() : null;
};

// ✏️ Update a quote by ID
const updateQuote = async (id, data) => {
  await db.ref(`quotes/${id}`).update(data);
};

// ❌ Delete a quote by ID
const deleteQuote = async (id) => {
  const quoteRef = db.ref(`quotes/${id}`);
  const snapshot = await quoteRef.once('value');

  if (!snapshot.exists()) {
    throw new Error('Quote not found');
  }

  await quoteRef.remove(); // ✅ this deletes the data
};
export {
  createQuote,
  getAllQuotes, 
  getQuoteById,
  updateQuote,
  deleteQuote,
  quoteExists,
  normalizeText,
};