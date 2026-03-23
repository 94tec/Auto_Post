// ══════════════════════════════════════════════════════════════
// routes/lyricsRoutes.js  — wire in routes.js:
//   import lyricsRoutes from './lyrics.js';
//   router.use('/lyrics', lyricsRoutes);
// ══════════════════════════════════════════════════════════════
 
import express from 'express';
import { verifyToken }  from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { apiLimiter, writeLimiter } from '../middleware/rateLimiter.js';
import {
  getLyrics, getLyric,
  createLyric, updateLyric, deleteLyric,
} from '../controllers/lyricsController.js';
 
const router = express.Router();
 
router.get('/',    apiLimiter,   getLyrics);          // public
router.get('/:id', apiLimiter,   getLyric);           // public
router.post('/',   writeLimiter, verifyToken, requireAdmin, createLyric);
router.patch('/:id', writeLimiter, verifyToken, requireAdmin, updateLyric);
router.delete('/:id',writeLimiter, verifyToken, requireAdmin, deleteLyric);
 
export default router;