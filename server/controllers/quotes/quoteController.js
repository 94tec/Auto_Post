/**
 * controllers/quoteController.js
 * ═══════════════════════════════════════════════════════════════════
 * Quote CRUD. Permission matrix:
 *   READ     any authenticated or guest (optionalAuth)
 *   CREATE   verifyToken + requireActiveAccount + requirePermission('write')
 *   UPDATE   verifyToken + requirePermission('write') + owns quote
 *   DELETE   verifyToken + requirePermission('delete') + owns quote
 *            OR admin with deleteAny
 * ═══════════════════════════════════════════════════════════════════
 */

import {
  createQuote as dbCreate,
  getQuoteById, getQuotes as dbGetAll,
  getQuotesByUser, quoteDuplicateExists,
  updateQuote as dbUpdate,
  deleteQuote as dbDelete,
} from '../../models/quote.js';
import { ROLES } from '../../config/roles.js';
import AuditLog  from '../../services/auditLog.js';

const isAdmin    = (req) => req.user?.basic?.role === ROLES.ADMIN;
const ownsQuote  = (req, q) => q?.userId === req.uid;

/* ── GET all ──────────────────────────────────────────────────────── */
export const getQuotes = async (req, res) => {
  try {
    const { category, pageSize, lastDoc } = req.query;
    const quotes = await dbGetAll({ category, pageSize: Number(pageSize) || 50 });
    return res.status(200).json({ quotes, total: quotes.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch quotes', code: 'SERVER_ERROR' });
  }
};

/* ── GET single ──────────────────────────────────────────────────── */
export const getQuote = async (req, res) => {
  try {
    const quote = await getQuoteById(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });
    return res.status(200).json({ quote });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch quote', code: 'SERVER_ERROR' });
  }
};

/* ── GET my quotes ───────────────────────────────────────────────── */
export const getMyQuotes = async (req, res) => {
  try {
    const quotes = await getQuotesByUser(req.uid);
    return res.status(200).json({ quotes, total: quotes.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch your quotes', code: 'SERVER_ERROR' });
  }
};

/* ── CREATE ──────────────────────────────────────────────────────── */
export const createQuote = async (req, res) => {
  const { text, author, category } = req.body;

  if (!text?.trim() || !author?.trim())
    return res.status(400).json({ error: 'text and author are required', code: 'MISSING_FIELDS' });
  if (text.trim().length < 5)
    return res.status(400).json({ error: 'Quote text too short (min 5 chars)', code: 'TEXT_TOO_SHORT' });
  if (text.trim().length > 1000)
    return res.status(400).json({ error: 'Quote text too long (max 1000 chars)', code: 'TEXT_TOO_LONG' });

  try {
    const duplicate = await quoteDuplicateExists(text);
    if (duplicate)
      return res.status(409).json({ error: 'This quote already exists', code: 'DUPLICATE_QUOTE' });

    const quote = await dbCreate({
      text, author, category,
      userId:    req.uid,
      createdBy: req.user?.basic?.displayName || 'Unknown',
    });

    await AuditLog.record(AuditLog.EVENTS.QUOTE_CREATED, {
      userId: req.uid, ip: req.ip, userAgent: req.headers['user-agent'],
      metadata: { quoteId: quote.id, author },
    });

    return res.status(201).json({ message: 'Quote created', quote });
  } catch (err) {
    console.error('createQuote error:', err);
    return res.status(500).json({ error: 'Failed to create quote', code: 'SERVER_ERROR' });
  }
};

/* ── UPDATE ──────────────────────────────────────────────────────── */
export const updateQuote = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await getQuoteById(id);
    if (!existing) return res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });

    if (!isAdmin(req) && !ownsQuote(req, existing))
      return res.status(403).json({ error: 'You can only edit your own quotes', code: 'NOT_OWNER' });

    const updated = await dbUpdate(id, req.body);

    await AuditLog.record(AuditLog.EVENTS.QUOTE_UPDATED, {
      userId: req.uid, ip: req.ip, userAgent: req.headers['user-agent'],
      metadata: { quoteId: id },
    });

    return res.status(200).json({ message: 'Quote updated', quote: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update', code: 'SERVER_ERROR' });
  }
};

/* ── DELETE ──────────────────────────────────────────────────────── */
export const deleteQuote = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await getQuoteById(id);
    if (!existing) return res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });

    const perms       = req.user?.permissions || {};
    const canDeleteAny = perms.deleteAny || isAdmin(req);

    if (!ownsQuote(req, existing) && !canDeleteAny)
      return res.status(403).json({ error: 'You can only delete your own quotes', code: 'NOT_OWNER' });

    if (ownsQuote(req, existing) && !perms.delete && !isAdmin(req))
      return res.status(403).json({ error: 'Delete permission required', code: 'NO_DELETE_PERMISSION' });

    await dbDelete(id);

    await AuditLog.record(AuditLog.EVENTS.QUOTE_DELETED, {
      userId: req.uid, ip: req.ip, userAgent: req.headers['user-agent'],
      metadata: { quoteId: id, deletedByAdmin: isAdmin(req) && !ownsQuote(req, existing) },
    });

    return res.status(200).json({ message: 'Quote deleted', id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete', code: 'SERVER_ERROR' });
  }
};