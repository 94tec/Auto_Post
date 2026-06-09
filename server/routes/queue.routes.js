import express from 'express';
import { verifyToken as requireAuth, requireAdmin } from '../middlewares/auth.js';
import { queueService } from '../services/queueService.js';
import { adminFirestore } from '../config/firebase.js'; 

const router = express.Router();

router.post('/add', requireAuth, requireAdmin, async (req, res) => {
  const { quoteId, text, author, category } = req.body;
  if (!quoteId || !text?.trim()) {
    return res.status(400).json({ error: 'quoteId and text are required' });
  }
  try {
    const result = await queueService.add({
      quoteId,
      text:     text.trim(),
      author:   author ?? 'Unknown',
      category: category ?? 'general',
      addedBy:  req.user.uid,
    });
    res.json({ success: true, id: result.id });
  } catch (err) {
    const isDuplicate = err.message.includes('already in the queue');
    res.status(isDuplicate ? 409 : 500).json({ error: err.message });
  }
});

router.get('/list', requireAuth, requireAdmin, async (req, res) => {
  const { status, limit = '50' } = req.query;
  try {
    const items = await queueService.getAll({
      status: status || undefined,
      limit:  Math.min(parseInt(limit), 100),
    });
    res.json({ items });
  } catch (err) {
    console.error('[Queue list]', err);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await queueService.remove(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Queue delete]', err);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

router.get('/analytics', requireAuth, requireAdmin, async (req, res) => {
  try {
    const data = await queueService.getAnalytics();
    res.json(data);
  } catch (err) {
    console.error('[Queue analytics]', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ── Fixed: now uses queueService instead of raw adminFirestore ──
router.post('/retry/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await queueService.retry(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Queue retry]', err);
    res.status(500).json({ error: 'Failed to retry' });
  }
});

router.get('/slots', requireAuth, requireAdmin, async (req, res) => {
  try {
    const slots = await queueService.getSlots();
    res.json({ slots });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

export default router;