/**
 * routes/authRoutes.js
 * ═══════════════════════════════════════════════════════════════════
 */
import { Router }             from 'express';
import {
  register, login, verifyEmail,
  resendVerification, getMe,
}                             from '../controllers/authController.js';
import { verifyToken }        from '../middlewares/auth.js';
import { authRateLimiter }    from '../middlewares/rateLimiter.js';

const router = Router();

router.post('/register',            authRateLimiter, register);
router.post('/login',               authRateLimiter, login);
router.post('/verify-email',        verifyEmail);
router.post('/resend-verification', authRateLimiter, resendVerification);
router.get('/me',                   verifyToken, getMe);

export default router;