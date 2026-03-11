/**
 * server/index.js
 * Production Entry – Clean Architecture
 */

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import router from './routes/routes.js';
import { notFound, errorHandler } from './utils/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 5000;

/* ───────────────── Core ───────────────── */

app.set('trust proxy', 1);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));

/* ── Signed cookie support ────────────────────────────────────── */
// COOKIE_SECRET must be set in .env — generate with:
//   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
app.use(cookieParser(process.env.COOKIE_SECRET));

/* ───────────────── Security ───────────── */

app.use(helmet());

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
}));

app.use(
  morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev')
);

/* ───────────────── Routes ─────────────── */

app.use('/api', router);

/* ───────────────── Errors ─────────────── */

app.use(notFound);
app.use(errorHandler);

/* ───────────────── Start ─────────────── */

app.listen(PORT, () => {
  console.log(`
┌────────────────────────────────────────────┐
│ 🚀 Damuchi API Running                    │
│                                            │
│ Port:        ${PORT}
│ Environment: ${process.env.NODE_ENV}
│                                            │
│ Auth    → /api/auth
│ Quotes  → /api/quotes
│ Users   → /api/users
│ Admin   → /api/admin  (404 to non-admins)
└────────────────────────────────────────────┘
`);
});

export default app;