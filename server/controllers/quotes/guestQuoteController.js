// ══════════════════════════════════════════════════════════════
// controllers/guestQuoteController.js
// ══════════════════════════════════════════════════════════════
import { admin } from '../../config/firebase.js';
import { cacheGet, cacheSet, cacheDel, KEYS } from '../../services/cache.js';
import AuditLog from '../../services/auditLog.js';
 
const db  = admin.database();
const REF = 'guestQuotes';
const CACHE_TTL = 60 * 10; // 10 min
 
/* ── helpers ─────────────────────────────────────────────────── */
const toArray = (snap) => {
  const val = snap.val();
  if (!val) return [];
  return Object.entries(val).map(([id, v]) => ({ id, ...v }));
};
 
/* ── GET all ─────────────────────────────────────────────────── */
export const getGuestQuotes = async (req, res) => {
  try {
    const cacheKey = 'guestQuotes:all';
    const cached = await cacheGet(cacheKey);
    if (cached) return res.status(200).json({ quotes: cached, total: cached.length, fromCache: true });
 
    const snap   = await db.ref(REF).once('value');
    const quotes = toArray(snap);
 
    await cacheSet(cacheKey, quotes, CACHE_TTL);
    return res.status(200).json({ quotes, total: quotes.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch guest quotes', code: 'SERVER_ERROR' });
  }
};
 
/* ── GET single ──────────────────────────────────────────────── */
export const getGuestQuote = async (req, res) => {
  try {
    const snap = await db.ref(`${REF}/${req.params.id}`).once('value');
    if (!snap.exists()) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    return res.status(200).json({ quote: { id: snap.key, ...snap.val() } });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch', code: 'SERVER_ERROR' });
  }
};
 
/* ── CREATE ──────────────────────────────────────────────────── */
export const createGuestQuote = async (req, res) => {
  const { text, author, category } = req.body;
  if (!text?.trim() || !author?.trim())
    return res.status(400).json({ error: 'text and author are required', code: 'MISSING_FIELDS' });
 
  try {
    const ref = db.ref(REF).push();
    const quote = {
      text:      text.trim(),
      author:    author.trim(),
      category:  category?.trim() || 'motivation',
      createdBy: req.uid,
      createdAt: new Date().toISOString(),
    };
    await ref.set(quote);
    await cacheDel('guestQuotes:all');
 
    AuditLog.record('GUEST_QUOTE_CREATED', {
      userId: req.uid, ip: req.ip,
      metadata: { quoteId: ref.key, author },
    }).catch(() => {});
 
    return res.status(201).json({ message: 'Guest quote created', quote: { id: ref.key, ...quote } });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create', code: 'SERVER_ERROR' });
  }
};
 
/* ── UPDATE ──────────────────────────────────────────────────── */
export const updateGuestQuote = async (req, res) => {
  const { id } = req.params;
  try {
    const snap = await db.ref(`${REF}/${id}`).once('value');
    if (!snap.exists()) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
 
    const updates = {};
    if (req.body.text)     updates.text     = req.body.text.trim();
    if (req.body.author)   updates.author   = req.body.author.trim();
    if (req.body.category) updates.category = req.body.category.trim();
    updates.updatedAt = new Date().toISOString();
 
    await db.ref(`${REF}/${id}`).update(updates);
    await cacheDel('guestQuotes:all');
 
    return res.status(200).json({ message: 'Updated', quote: { id, ...snap.val(), ...updates } });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update', code: 'SERVER_ERROR' });
  }
};
 
/* ── DELETE ──────────────────────────────────────────────────── */
export const deleteGuestQuote = async (req, res) => {
  const { id } = req.params;
  try {
    const snap = await db.ref(`${REF}/${id}`).once('value');
    if (!snap.exists()) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
 
    await db.ref(`${REF}/${id}`).remove();
    await cacheDel('guestQuotes:all');
 
    AuditLog.record('GUEST_QUOTE_DELETED', {
      userId: req.uid, ip: req.ip, metadata: { quoteId: id },
    }).catch(() => {});
 
    return res.status(200).json({ message: 'Deleted', id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete', code: 'SERVER_ERROR' });
  }
};