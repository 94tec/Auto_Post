// routes/guestQuotes.js
// ─────────────────────────────────────────────────────────────
// GUEST QUOTES — special public-facing quotes curated by admins.
// These appear on GuestLanding. Only admins can write/edit/delete.
// Anyone can read (no auth required).
 
// ══════════════════════════════════════════════════════════════
// routes/guestQuotes.js  — add to your routes.js:
//   import guestQuoteRoutes from './guestQuotes.js';
//   router.use('/guest-quotes', guestQuoteRoutes);
// ══════════════════════════════════════════════════════════════
 
import express from 'express';
import { verifyToken, requireAdmin }   from '../middlewares/auth.js';
import {
  getGuestQuotes,
  getGuestQuote,
  createGuestQuote,
  updateGuestQuote,
  deleteGuestQuote,
} from '../controllers/quotes/guestQuoteController.js';
import { apiLimiter, writeLimiter } from '../middlewares/rateLimiter.js';
 
const router = express.Router();
 
// Public — no auth
router.get('/',    apiLimiter,   getGuestQuotes);
router.get('/:id', apiLimiter,   getGuestQuote);
 
// Admin only
router.post('/',     writeLimiter, verifyToken, requireAdmin, createGuestQuote);
router.patch('/:id', writeLimiter, verifyToken, requireAdmin, updateGuestQuote);
router.delete('/:id',writeLimiter, verifyToken, requireAdmin, deleteGuestQuote);
 
export default router;