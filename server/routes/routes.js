// server/routes/routes.js`
import express from 'express';
import { register, login, logout } from '../controllers/auth.js';
import { registrationLimiter, isLoginRateLimited} from '../middlewares/rateLimiter.js';

const router = express.Router();

// Auth Routes
router.post('/register', registrationLimiter, register);
router.post('/login',isLoginRateLimited, login);
router.post('/logout', logout);


export default router;



