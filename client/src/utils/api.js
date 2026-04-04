/**
 * utils/api.js
 * ═══════════════════════════════════════════════════════════════
 * Centralised API client for Damuchi frontend.
 *
 * FEATURES
 * ───────────────────────────────────────────────────────────────
 *  • Firebase ID token auto-attached on every request
 *  • CSRF token read from __csrf cookie and sent as X-CSRF-Token
 *  • Rich error objects: { error, code, hint, missing, failed }
 *    matching the backend error shape so components can map codes
 *    directly to their ERROR_MAP without re-parsing strings
 *  • login() calls /api/auth/login, gets customToken, signs the
 *    Firebase client SDK in so onAuthStateChanged fires
 *  • Token refresh: if a 401 TOKEN_EXPIRED is received, silently
 *    refreshes and retries once before throwing
 *
 * EXPORTS
 * ───────────────────────────────────────────────────────────────
 *  authApi    — register, login, logout, me, verify, resend,
 *               forgotPassword, verifyResetLink, resetPassword
 *  quotesApi  — create, update, delete, getAll, getMy, getOne
 *  adminApi   — createAdmin, createUser, listUsers, getUser,
 *               approveUser, grantWrite, revokeWrite,
 *               patchPermissions, suspendUser, reactivateUser,
 *               getQueue, getPendingWrite, getStats, getAuditLogs
 *  lyricsApi  — getAll, create, delete
 *  guestApi   — getQuotes
 *  contactApi — send
 * ═══════════════════════════════════════════════════════════════
 */

import { auth }                  from '../config/firebase';
import { signInWithCustomToken } from 'firebase/auth';

const API_BASE = '/api';

/* ── Error class ─────────────────────────────────────────────── */
export class ApiError extends Error {
  constructor({ error, code, hint, missing, failed, status }) {
    super(error || 'Request failed');
    this.code    = code    || 'UNKNOWN';
    this.hint    = hint    || null;
    this.missing = missing || null;
    this.failed  = failed  || null;
    this.status  = status  || 0;
  }
}

/* ── Token helpers ───────────────────────────────────────────── */
const getToken = async (forceRefresh = false) => {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
};

/** Read __csrf cookie (set by the backend, NOT httpOnly) */
const getCsrf = () => {
  const match = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

/* ── Core request ────────────────────────────────────────────── */
let _retrying = false; // prevent infinite retry loop

async function request(endpoint, options = {}, retried = false) {
  const token = await getToken(retried); // force refresh on retry

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options.method && options.method !== 'GET'
      ? { 'X-CSRF-Token': getCsrf() ?? '' }
      : {}),
    ...options.headers,
  };

  const res  = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Auto-retry once on token expiry
    if (data.code === 'TOKEN_EXPIRED' && !retried) {
      return request(endpoint, options, true);
    }
    throw new ApiError({ ...data, status: res.status });
  }

  return data;
}

/* ── Shorthand builders ──────────────────────────────────────── */
const GET    = (url, params)  => request(`${url}${params ? `?${new URLSearchParams(params)}` : ''}`);
const POST   = (url, body)    => request(url, { method: 'POST',   body: body ? JSON.stringify(body) : undefined });
const PATCH  = (url, body)    => request(url, { method: 'PATCH',  body: body ? JSON.stringify(body) : undefined });
const DELETE = (url)          => request(url, { method: 'DELETE' });

/* ══════════════════════════════════════════════════════════════
   AUTH API
══════════════════════════════════════════════════════════════ */
export const authApi = {

  /** POST /api/auth/register — creates guest account */
  register: ({ name, email, password }) =>
    POST('/auth/register', { name, email: email.trim().toLowerCase(), password }),

  /**
   * POST /api/auth/login
   * Receives { customToken, user } from backend.
   * Signs into Firebase client SDK with customToken so
   * onAuthStateChanged fires and AuthContext updates.
   */
  login: async ({ email, password }) => {
    const data = await POST('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });
    // Re-hydrate Firebase client session from backend-issued custom token
    if (data.customToken) {
      await signInWithCustomToken(auth, data.customToken);
    }
    return data; // { success, customToken, user }
  },

  /** POST /api/auth/logout */
  logout: () => POST('/auth/logout'),

  /** GET /api/auth/me — current user from session */
  me: () => GET('/auth/me'),

  /** POST /api/auth/verify-email */
  verifyEmail: ({ oobCode, uid, email }) =>
    POST('/auth/verify-email', { oobCode, uid, email }),

  /** POST /api/auth/resend-verification */
  resendVerification: (email) =>
    POST('/auth/resend-verification', { email }),

  /** POST /api/auth/forgot-password */
  forgotPassword: (email) =>
    POST('/auth/forgot-password', { email }),

  /** POST /api/auth/verify-reset-link */
  verifyResetLink: ({ oobCode, uid, email }) =>
    POST('/auth/verify-reset-link', { oobCode, uid, email }),

  /** POST /api/auth/reset-password */
  resetPassword: ({ oobCode, newPassword }) =>
    POST('/auth/reset-password', { oobCode, newPassword }),
};

/* ══════════════════════════════════════════════════════════════
   QUOTES API
══════════════════════════════════════════════════════════════ */
export const quotesApi = {
  /** POST /api/quotes */
  create: (quoteData) => POST('/quotes', quoteData),

  /** PATCH /api/quotes/:id */
  update: (id, quoteData) => PATCH(`/quotes/${id}`, quoteData),

  /** DELETE /api/quotes/:id */
  delete: (id) => DELETE(`/quotes/${id}`),

  /** GET /api/quotes?category=&author= */
  getAll: (params = {}) => GET('/quotes', params),

  /** GET /api/quotes/my */
  getMy: () => GET('/quotes/my'),

  /** GET /api/quotes/:id */
  getOne: (id) => GET(`/quotes/${id}`),
};

/* ══════════════════════════════════════════════════════════════
   ADMIN API
══════════════════════════════════════════════════════════════ */
export const adminApi = {

  /**
   * POST /api/admin/users
   * Creates a new admin. Sets mustChangePassword=true.
   * Backend sends admin welcome email with temp password.
   */
  createAdmin: ({ email, password, displayName }) =>
    POST('/admin/users', { email, password, displayName }),

  /**
   * POST /api/admin/users/create-user
   * Admin creates a pre-approved user. Skips guest→verify→approve flow.
   */
  createUser: ({ email, password, displayName, grantWrite = false }) =>
    POST('/admin/users/create-user', { email, password, displayName, grantWrite }),

  /** GET /api/admin/users?role=&status= */
  listUsers: (params = {}) => GET('/admin/users', params),

  /** GET /api/admin/users/:uid */
  getUser: (uid) => GET(`/admin/users/${uid}`),

  /** POST /api/admin/users/:uid/approve */
  approveUser: (uid) => POST(`/admin/users/${uid}/approve`),

  /** POST /api/admin/users/:uid/grant-write */
  grantWrite: (uid) => POST(`/admin/users/${uid}/grant-write`),

  /** POST /api/admin/users/:uid/revoke-write */
  revokeWrite: (uid) => POST(`/admin/users/${uid}/revoke-write`),

  /** PATCH /api/admin/users/:uid/permissions */
  patchPermissions: (uid, permissions) =>
    PATCH(`/admin/users/${uid}/permissions`, { permissions }),

  /** POST /api/admin/users/:uid/suspend */
  suspendUser: (uid) => POST(`/admin/users/${uid}/suspend`),

  /** POST /api/admin/users/:uid/reactivate */
  reactivateUser: (uid) => POST(`/admin/users/${uid}/reactivate`),

  /** GET /api/admin/approval-queue */
  getQueue: () => GET('/admin/approval-queue'),

  /** GET /api/admin/pending-write */
  getPendingWrite: () => GET('/admin/pending-write'),

  /** GET /api/admin/stats */
  getStats: () => GET('/admin/stats'),

  /** GET /api/admin/audit-logs?limit=&userId= */
  getAuditLogs: (params = {}) => GET('/admin/audit-logs', params),
};

/* ══════════════════════════════════════════════════════════════
   LYRICS API
══════════════════════════════════════════════════════════════ */
export const lyricsApi = {
  /** GET /api/lyrics */
  getAll:  (params = {}) => GET('/lyrics', params),

  /** POST /api/lyrics (admin only) */
  create:  (data) => POST('/lyrics', data),

  /** DELETE /api/lyrics/:id (admin only) */
  delete:  (id)   => DELETE(`/lyrics/${id}`),
};

/* ══════════════════════════════════════════════════════════════
   GUEST QUOTES API
══════════════════════════════════════════════════════════════ */
export const guestApi = {
  /** GET /api/guest-quotes — public, no auth required */
  getQuotes: (params = {}) => GET('/guest-quotes', params),
};

/* ══════════════════════════════════════════════════════════════
   CONTACT API
══════════════════════════════════════════════════════════════ */
export const contactApi = {
  /** POST /api/contact */
  send: ({ name, email, topic, message }) =>
    POST('/contact', { name, email, topic, message }),
};

/* ══════════════════════════════════════════════════════════════
   USER API (signed-in user's own account)
══════════════════════════════════════════════════════════════ */
export const userApi = {
  /** POST /api/users/change-password */
  changePassword: (newPassword) =>
    POST('/users/change-password', { newPassword }),

  /** PATCH /api/users/profile */
  updateProfile: (data) => PATCH('/users/profile', data),

  /** PATCH /api/users/profile-advanced (email or displayName change) */
  updateProfileAdvanced: ({ displayName, email }) =>
    PATCH('/users/profile-advanced', { displayName, email }),

  /** DELETE /api/users/account */
  deleteAccount: () =>
    request('/users/account', { method: 'DELETE' }),

  getProfile: () => GET('/users/profile'),

  requestEmailChange: (newEmail) => POST('/users/request-email-change', { newEmail }),
};