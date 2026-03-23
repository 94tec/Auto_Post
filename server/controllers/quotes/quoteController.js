// controllers/quoteController.js — with Redis caching on all read paths
import {
  createQuote as dbCreate,
  getQuoteById, getQuotes as dbGetAll,
  getQuotesByUser, quoteDuplicateExists,
  updateQuote as dbUpdate,
  deleteQuote as dbDelete,
} from '../../models/quote.js';
import { ROLES }                  from '../../config/roles.js';
import AuditLog                   from '../../services/auditLog.js';
import { cacheGet, cacheSet, invalidateQuoteCache, KEYS } from '../../services/cache.js';
import { enqueue, JOBS }          from '../../services/jobQueue.js';

const CACHE_TTL  = 60 * 5;  // 5 min for list
const SINGLE_TTL = 60 * 10; // 10 min for single quote

const isAdmin   = (req) => req.user?.basic?.role === ROLES.ADMIN;
const ownsQuote = (req, q) => q?.userId === req.uid;

/* ── GET all ─────────────────────────────────────────────────── */
export const getQuotes = async (req, res) => {
  try {
    const { category, pageSize } = req.query;
    const cacheKey = KEYS.allQuotes();

    // Cache hit
    const cached = await cacheGet(cacheKey);
    if (cached && !category) {
      return res.status(200).json({ quotes: cached, total: cached.length, fromCache: true });
    }

    const quotes = await dbGetAll({ category, pageSize: Number(pageSize) || 50 });

    // Only cache uncategorised full list
    if (!category) await cacheSet(cacheKey, quotes, CACHE_TTL);

    return res.status(200).json({ quotes, total: quotes.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch quotes', code: 'SERVER_ERROR' });
  }
};

/* ── GET single ──────────────────────────────────────────────── */
export const getQuote = async (req, res) => {
  try {
    const cacheKey = KEYS.singleQuote(req.params.id);

    const cached = await cacheGet(cacheKey);
    if (cached) return res.status(200).json({ quote: cached, fromCache: true });

    const quote = await getQuoteById(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });

    await cacheSet(cacheKey, quote, SINGLE_TTL);
    return res.status(200).json({ quote });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch quote', code: 'SERVER_ERROR' });
  }
};

/* ── GET my quotes ───────────────────────────────────────────── */
export const getMyQuotes = async (req, res) => {
  try {
    const cacheKey = KEYS.userQuotes(req.uid);

    const cached = await cacheGet(cacheKey);
    if (cached) return res.status(200).json({ quotes: cached, total: cached.length, fromCache: true });

    const quotes = await getQuotesByUser(req.uid);
    await cacheSet(cacheKey, quotes, CACHE_TTL);

    return res.status(200).json({ quotes, total: quotes.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch your quotes', code: 'SERVER_ERROR' });
  }
};

/* ── CREATE ──────────────────────────────────────────────────── */
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

    // Invalidate caches so next read is fresh
    await invalidateQuoteCache(req.uid);

    // Enqueue audit log (non-blocking)
    enqueue(JOBS.AUDIT_LOG_FLUSH, {
      event:    'QUOTE_CREATED',
      userId:   req.uid,
      metadata: { quoteId: quote.id, author },
    }).catch(() => {});

    return res.status(201).json({ message: 'Quote created', quote });
  } catch (err) {
    console.error('createQuote error:', err);
    return res.status(500).json({ error: 'Failed to create quote', code: 'SERVER_ERROR' });
  }
};

/* ── UPDATE ──────────────────────────────────────────────────── */
export const updateQuote = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await getQuoteById(id);
    if (!existing)
      return res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });

    if (!isAdmin(req) && !ownsQuote(req, existing))
      return res.status(403).json({ error: 'You can only edit your own quotes', code: 'NOT_OWNER' });

    const updated = await dbUpdate(id, req.body);

    // Bust single quote + list caches
    await Promise.all([
      invalidateQuoteCache(req.uid),
      // If admin edits someone else's quote, also bust that user's cache
      existing.userId !== req.uid && invalidateQuoteCache(existing.userId),
    ]);

    enqueue(JOBS.AUDIT_LOG_FLUSH, {
      event: 'QUOTE_UPDATED', userId: req.uid, metadata: { quoteId: id },
    }).catch(() => {});

    return res.status(200).json({ message: 'Quote updated', quote: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update', code: 'SERVER_ERROR' });
  }
};

/* ── DELETE ──────────────────────────────────────────────────── */
export const deleteQuote = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await getQuoteById(id);
    if (!existing)
      return res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });

    const perms       = req.user?.permissions || {};
    const canDeleteAny = perms.deleteAny || isAdmin(req);

    if (!ownsQuote(req, existing) && !canDeleteAny)
      return res.status(403).json({ error: 'You can only delete your own quotes', code: 'NOT_OWNER' });

    if (ownsQuote(req, existing) && !perms.delete && !isAdmin(req))
      return res.status(403).json({ error: 'Delete permission required', code: 'NO_DELETE_PERMISSION' });

    await dbDelete(id);

    await Promise.all([
      invalidateQuoteCache(req.uid),
      existing.userId !== req.uid && invalidateQuoteCache(existing.userId),
    ]);

    enqueue(JOBS.AUDIT_LOG_FLUSH, {
      event:    'QUOTE_DELETED',
      userId:   req.uid,
      metadata: { quoteId: id, deletedByAdmin: isAdmin(req) && !ownsQuote(req, existing) },
    }).catch(() => {});

    return res.status(200).json({ message: 'Quote deleted', id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete', code: 'SERVER_ERROR' });
  }
};