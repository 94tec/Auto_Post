// server/routes/emailRoutes.js
import express from 'express';
// import { verifyEmailLink, resendEmailVerification } from '../services/emailService.js';
import { verifyEmail, resendVerification } from '../controllers/auth/emailVerificationController.js';


const router = express.Router();

router.post('/verify-email', verifyEmail);
router.post('/resend-verification-email', resendVerification);

export default router;