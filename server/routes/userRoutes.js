// server/routes/userRoutes.js
import express from 'express';
import {
  resetPassword,
  forgotPassword,
  changePassword,
  updateProfile,
  deleteAccount,
  getCurrentUser
} from '../services/userService.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

router.post('/reset-password', resetPassword);
router.post('/forgot-password', forgotPassword);
router.post('/change-password', verifyToken, changePassword);
router.post('/update-profile', verifyToken, updateProfile);
router.post('/delete-account', verifyToken, deleteAccount);
router.get('/me', verifyToken, getCurrentUser);

export default router;