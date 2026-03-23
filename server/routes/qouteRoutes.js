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
}                              from '../controllers/quotes/quoteController.js';
import {
  verifyToken, optionalAuth,
  requirePermission, requireActiveAccount,
}                              from '../middlewares/auth.js';
import { apiLimiter }      from '../middlewares/rateLimiter.js';

const router = Router();

router.get('/',    apiLimiter, optionalAuth, getQuotes);
router.get('/my',  apiLimiter, verifyToken,  getMyQuotes);
router.get('/:id', apiLimiter, optionalAuth, getQuote);

router.post('/',
  apiLimiter, verifyToken, requireActiveAccount, requirePermission('write'),
  createQuote,
);

router.patch('/:id',
  apiLimiter, verifyToken, requireActiveAccount, requirePermission('write'),
  updateQuote,
);

router.delete('/:id',
  apiLimiter, verifyToken, requirePermission('delete'),
  deleteQuote,
);

export default router;