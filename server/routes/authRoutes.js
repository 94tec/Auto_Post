/**
 * routes/authRoutes.js
 * ═══════════════════════════════════════════════════════════════
 * Mounts all auth endpoints. Import this in routes/routes.js:
 *   import authRoutes from './authRoutes.js';
 *   router.use('/auth', authRoutes);
 *
 * ENDPOINT MAP
 * ───────────────────────────────────────────────────────────────
 *  POST /api/auth/register             registerController
 *  POST /api/auth/login                loginController
 *  POST /api/auth/logout               loginController
 *  GET  /api/auth/me                   loginController  (verifyToken)
 *  POST /api/auth/verify-email         emailVerificationController
 *  POST /api/auth/resend-verification  emailVerificationController
 *  POST /api/auth/forgot-password      passwordController
 *  POST /api/auth/verify-reset-link    passwordController
 *  POST /api/auth/reset-password       passwordController
 * ═══════════════════════════════════════════════════════════════
 */

import express from 'express';
import { register }                        from '../controllers/auth/registerController.js';
import { login, logout, getMe }            from '../controllers/auth/loginController.js';
import { verifyEmail, resendVerification } from '../controllers/auth/emailVerificationController.js';
import { forgotPassword, verifyResetLink, resetPassword } from '../controllers/auth/passwordController.js';
import { verifyToken }                     from '../middlewares/auth.js';
import { authLimiter, apiLimiter, writeLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

/* ── Registration ────────────────────────────────────────────── */
router.post('/register',            writeLimiter, register);

/* ── Session ─────────────────────────────────────────────────── */
router.post('/login',               authLimiter,  login);
router.post('/logout',              apiLimiter,   logout);
router.get( '/me',                  verifyToken,  getMe);

/* ── Email verification ──────────────────────────────────────── */
router.post('/verify-email',        apiLimiter,   verifyEmail);
router.post('/resend-verification', apiLimiter,   resendVerification);

/* ── Password reset ──────────────────────────────────────────── */
router.post('/forgot-password',     authLimiter,  forgotPassword);
router.post('/verify-reset-link',   apiLimiter,   verifyResetLink);
router.post('/reset-password',      writeLimiter, resetPassword);

export default router;