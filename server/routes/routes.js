/**
 * routes/routes.js — Master router
 *   /api/auth/*    public + auth actions
 *   /api/quotes/*  quote CRUD (permission-gated)
 *   /api/users/*   self-profile (authenticated)
 *   /api/admin/*   admin-only (404 to non-admins)
 */
import { Router }  from 'express';
import authRoutes  from './authRoutes.js';
import quoteRoutes from './qouteRoutes.js';
import userRoutes  from './userRoutes.js';
import adminRoutes from './adminRoutes.js';
import guestQuoteRoutes from './guestQuotes.js';  
import lyricsRoutes from './lyricsRoutes.js'; 

const router = Router();

router.use('/auth',   authRoutes);
router.use('/quotes', quoteRoutes);
router.use('/users',  userRoutes);
router.use('/admin',  adminRoutes);
router.use('/guest-quotes', guestQuoteRoutes);  // from routes/guestQuotes.js
router.use('/lyrics',  lyricsRoutes); 
router.get('/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

export default router;