// server/index.js
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import './config/firebase.js'; // Initialize Firebase
dotenv.config();
import authRoutes from './routes/routes.js';
import quoteRoutes from './routes/qouteRoutes.js';
import userRoutes from './routes/userRoutes.js';
import emailRoutes from './routes/emailRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'trusted.cdn.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'trusted.cdn.com'],
      connectSrc: ["'self'", 'api.yourdomain.com']
    }
  },
  hsts: {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'same-origin' }
}));

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
  }));
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use('/api/auth', authRoutes); // Auth routes
app.use("/api/quotes", quoteRoutes);
app.use('/api/user', userRoutes); // User management routes
app.use('/api', emailRoutes); // Email service routes

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


