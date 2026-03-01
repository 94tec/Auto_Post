/**
 * server.js
 * ─────────────────────────────────────────────
 * Damuchi API – Production Entry Point
 *
 * Architecture:
 *   Explicit route mounting
 *   Namespace isolation
 *   Scoped middleware enforcement
 *   Modular monolith ready
 *
 * Security:
 *   - Helmet
 *   - CORS restriction
 *   - Rate limiting (admin scoped)
 *   - JSON size limiting
 *   - Trust proxy enabled
 */

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

// ── Route Modules ────────────────────────────
import authRoutes from './routes/authRoutes.js';
import quoteRoutes from './routes/quoteRoutes.js';
import userRoutes from './routes/userRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

// ── Middleware ───────────────────────────────
import { notFound, errorHandler } from './utils/errorHandler.js';
import { requireAdmin } from './middleware/requireAdmin.js';

class Server {
  constructor() {
    this.app = express();
    this.PORT = process.env.PORT || 5000;

    this.initializeCore();
    this.initializeSecurity();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  /* ─────────────────────────────────────────── */
  /* Core configuration                          */
  /* ─────────────────────────────────────────── */

  initializeCore() {
    this.app.set('trust proxy', 1);

    this.app.use(express.json({ limit: '100kb' }));
    this.app.use(express.urlencoded({ extended: false }));
  }

  /* ─────────────────────────────────────────── */
  /* Security configuration                      */
  /* ─────────────────────────────────────────── */

  initializeSecurity() {
    this.app.use(helmet());

    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
    }));

    this.app.use(
      morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev')
    );
  }

  /* ─────────────────────────────────────────── */
  /* Route mounting (Explicit Namespaces)        */
  /* ─────────────────────────────────────────── */

  initializeRoutes() {

    // Health check
    this.app.get('/health', (_req, res) => {
      res.status(200).json({
        status: 'ok',
        environment: process.env.NODE_ENV,
        timestamp: Date.now()
      });
    });

    /* ── Public + Authenticated Routes ─────── */

    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/quotes', quoteRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/email', emailRoutes);

    /* ── Admin Namespace (Isolated + Guarded) ─ */

    const adminLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many admin requests' }
    });

    this.app.use(
      '/api/admin',
      adminLimiter,
      requireAdmin,      // namespace-level protection
      adminRoutes
    );
  }

  /* ─────────────────────────────────────────── */
  /* Error handling                              */
  /* ─────────────────────────────────────────── */

  initializeErrorHandling() {
    this.app.use(notFound);
    this.app.use(errorHandler);
  }

  /* ─────────────────────────────────────────── */
  /* Start server                                */
  /* ─────────────────────────────────────────── */

  start() {
    this.app.listen(this.PORT, () => {
      console.log(`
┌────────────────────────────────────────────┐
│  🚀 Damuchi API Running                    │
│                                            │
│  Port:        ${this.PORT}
│  Environment: ${process.env.NODE_ENV}
│                                            │
│  Public:   /api/auth, /api/quotes          │
│  User:     /api/users                      │
│  Email:    /api/email                      │
│  Admin:    /api/admin  (isolated)          │
└────────────────────────────────────────────┘
      `);
    });
  }
}

/* ─────────────────────────────────────────── */
/* Bootstrap                                   */
/* ─────────────────────────────────────────── */

const server = new Server();
server.start();

export default server;