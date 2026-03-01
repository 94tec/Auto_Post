/**
 * routes/quoteRoutes.js
 * ═══════════════════════════════════════════════════════════════════
 * Permission matrix per route:
 *   GET    /           optionalAuth           (guests can read)
 *   GET    /my         verifyToken            (own quotes)
 *   GET    /:id        optionalAuth
 *   POST   /           verifyToken + activeAccount + write permission
 *   PATCH  /:id        verifyToken + activeAccount + write permission
 *   DELETE /:id        verifyToken + delete permission
 * ═══════════════════════════════════════════════════════════════════
 */
import { Router }              from 'express';
import {
  getQuotes, getQuote, getMyQuotes,
  createQuote, updateQuote, deleteQuote,
}                              from '../controllers/quoteController.js';
import {
  verifyToken, optionalAuth,
  requirePermission, requireActiveAccount,
}                              from '../middlewares/auth.js';
import { apiRateLimiter }      from '../middlewares/rateLimiter.js';

const router = Router();

router.get('/',    apiRateLimiter, optionalAuth, getQuotes);
router.get('/my',  apiRateLimiter, verifyToken,  getMyQuotes);
router.get('/:id', apiRateLimiter, optionalAuth, getQuote);

router.post('/',
  apiRateLimiter, verifyToken, requireActiveAccount, requirePermission('write'),
  createQuote,
);

router.patch('/:id',
  apiRateLimiter, verifyToken, requireActiveAccount, requirePermission('write'),
  updateQuote,
);

router.delete('/:id',
  apiRateLimiter, verifyToken, requirePermission('delete'),
  deleteQuote,
);

export default router;