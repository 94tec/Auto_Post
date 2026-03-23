/**
 * server/index.js
 * Production Entry – Clean Architecture
 */

import 'dotenv/config';
import http          from 'http';
import express       from 'express';
import helmet        from 'helmet';
import cors          from 'cors';
import morgan        from 'morgan';
import cookieParser  from 'cookie-parser';
import { Server }    from 'socket.io';

import router                       from './routes/routes.js';
import { notFound, errorHandler }   from './utils/errorHandler.js';
import { verifyToken }               from './middlewares/auth.js';
import { attachSession }             from './services/sessionService.js';
import { connectRedis }              from './config/redis.js';
import { startWorker, JOBS }         from './services/jobQueue.js';
import { apiLimiter }                from './middlewares/rateLimiter.js';

const app    = express();
const server = http.createServer(app);   // ← create server FIRST
const PORT   = process.env.PORT || 5000;

/* ── Trust proxy (Render / Railway / Heroku) ────────────────── */
app.set('trust proxy', 1);

/* ── Body / cookie parsers ──────────────────────────────────── */
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.COOKIE_SECRET));

/* ── Security headers ───────────────────────────────────────── */
app.use(helmet());

/* ── CORS ───────────────────────────────────────────────────── */
app.use(cors({
  origin:      process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods:     ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
}));

/* ── HTTP logger ────────────────────────────────────────────── */
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

/* ── Global rate limiter ────────────────────────────────────── */
app.use('/api', apiLimiter);

/* ── Firebase token + Redis session ────────────────────────── */
//app.use(verifyToken);
app.use(attachSession);

/* ── Routes ─────────────────────────────────────────────────── */
app.use('/api', router);

/* ── Error handlers (must be last) ─────────────────────────── */
app.use(notFound);
app.use(errorHandler);

/* ── Socket.io (after server is created) ───────────────────── */
const io = new Server(server, {
  cors: {
    origin:      process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log('[Socket.io] User connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('[Socket.io] User disconnected:', socket.id);
  });
});

// Make io accessible in controllers if needed: app.set('io', io)
app.set('io', io);

/* ── Job worker handlers ────────────────────────────────────── */
const startJobWorkers = () => {
  startWorker({

    [JOBS.WELCOME_EMAIL]: async ({ email, displayName }) => {
      console.log(`[Job] Welcome email → ${email}`);
      // await emailService.sendWelcome({ email, displayName });
    },

    [JOBS.QUOTE_DIGEST]: async ({ userIds }) => {
      console.log(`[Job] Digest → ${userIds?.length} users`);
      // for (const uid of userIds) await emailService.sendDigest(uid);
    },

    [JOBS.AUDIT_LOG_FLUSH]: async ({ event, userId, metadata }) => {
      const AuditLog = (await import('./services/auditLog.js')).default;
      await AuditLog.record(event, { userId, ...metadata });
    },

    [JOBS.CACHE_WARMUP]: async () => {
      const { getQuotes }        = await import('./models/quote.js');
      const { cacheSet, KEYS }   = await import('./services/cache.js');
      const quotes = await getQuotes({ pageSize: 100 });
      await cacheSet(KEYS.allQuotes(), quotes, 60 * 5);
      console.log('[Job] Cache warmed');
    },
  });
};

/* ── Bootstrap — connect Redis then start listening ─────────── */
const bootstrap = async () => {
  await connectRedis();   // gracefully continues if Redis is down
  startJobWorkers();

  server.listen(PORT, () => {
    console.log(`
┌────────────────────────────────────────────┐
│  🚀 Damuchi API Running                    │
│                                            │
│  Port:        ${String(PORT).padEnd(28)}│
│  Environment: ${String(process.env.NODE_ENV ?? 'development').padEnd(28)}│
│                                            │
│  Auth    → /api/auth                       │
│  Quotes  → /api/quotes                     │
│  Users   → /api/users                      │
│  Admin   → /api/admin                      │
└────────────────────────────────────────────┘
    `);
  });
};

bootstrap();
export default app;