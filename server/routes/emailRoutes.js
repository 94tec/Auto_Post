// server/routes/emailRoutes.js
import express from 'express';
import { verifyEmailLink, resendEmailVerification } from '../services/emailService.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

router.post('/verify-email-link', verifyEmailLink);
router.post('/resend-verification-email', resendEmailVerification);

export default router;