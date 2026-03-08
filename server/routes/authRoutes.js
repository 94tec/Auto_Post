/**
 * routes/authRoutes.js
 * ═══════════════════════════════════════════════════════════════════
 * All handlers imported from authController — no service imports here.
 * ═══════════════════════════════════════════════════════════════════
 */
import { Router }          from 'express';
import {
  register,
  login,
  logout,
  verifyEmail,
  resendVerification,
  getMe,
  forgotPassword,
  verifyResetLink,
  resetPassword,
}                          from '../controllers/authController.js';
import { verifyToken }     from '../middlewares/auth.js';
import { authRateLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// ── Account creation + session ──────────────────────────────────────
router.post('/register',             authRateLimiter, register);
router.post('/login',                authRateLimiter, login);
router.post('/logout',               verifyToken,     logout);
router.get('/me',                    verifyToken,     getMe);

// ── Email verification ──────────────────────────────────────────────
router.post('/verify-email',         verifyEmail);
router.post('/resend-verification',  authRateLimiter, resendVerification);

// ── Password reset (user is NOT logged in) ──────────────────────────
router.post('/forgot-password',      authRateLimiter, forgotPassword);
router.post('/verify-reset-link',    verifyResetLink);
router.post('/reset-password',       authRateLimiter, resetPassword);

export default router;