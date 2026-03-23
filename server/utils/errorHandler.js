/**
 * utils/errorHandler.js
 * ═══════════════════════════════════════════════════════════════════
 * Unified error handling — the SINGLE source of truth.
 * authErrorHandler.js re-exports from here for backward compat.
 *
 * FIXES vs original:
 *   - authErrorHandler.js and errorHandler.js both exported the same
 *     functions (mapFirebaseError, handleLoginError, sendErrorResponse,
 *     handleRegistrationError) — DEDUPLICATED here.
 *   - authController.js was importing from both → now import only from errorHandler.js
 * ═══════════════════════════════════════════════════════════════════
 */

import AuditLog from '../services/auditLog.js';

const isDev = () => process.env.NODE_ENV !== 'production';

/* ══════════════════════════════════════════════════════════════
   FIREBASE ERROR MAPPING — single source of truth
══════════════════════════════════════════════════════════════ */

/**
 * Maps a Firebase Auth error (REST API or Admin SDK) to a
 * standardised application error: { code, message, status }.
 * @param {Error} error
 * @returns {{ code: string, message: string, status: number }}
 */
export const mapFirebaseError = (error) => {
  const msg =
    error?.response?.data?.error?.message ||
    error?.code ||
    'UNKNOWN';

  const MAP = {
    // Sign-in failures — deliberately vague to prevent user enumeration
    'EMAIL_NOT_FOUND':             { code:'INVALID_CREDENTIALS', message:'Invalid email or password.',               status:401 },
    'auth/user-not-found':         { code:'INVALID_CREDENTIALS', message:'Invalid email or password.',               status:401 },
    'INVALID_PASSWORD':            { code:'INVALID_CREDENTIALS', message:'Invalid email or password.',               status:401 },
    'auth/wrong-password':         { code:'INVALID_CREDENTIALS', message:'Invalid email or password.',               status:401 },
    'INVALID_LOGIN_CREDENTIALS':   { code:'INVALID_CREDENTIALS', message:'Invalid email or password.',               status:401 },
    'auth/invalid-credential':     { code:'INVALID_CREDENTIALS', message:'Invalid email or password.',               status:401 },

    // Rate limiting
    'TOO_MANY_ATTEMPTS_TRY_LATER': { code:'TOO_MANY_ATTEMPTS',   message:'Too many attempts. Try again later.',      status:429 },
    'auth/too-many-requests':      { code:'TOO_MANY_ATTEMPTS',   message:'Too many attempts. Try again later.',      status:429 },

    // Account state
    'USER_DISABLED':               { code:'USER_DISABLED',       message:'This account has been disabled.',          status:403 },
    'auth/user-disabled':          { code:'USER_DISABLED',       message:'This account has been disabled.',          status:403 },

    // Registration
    'auth/email-already-exists':   { code:'EMAIL_EXISTS',        message:'An account with this email already exists.', status:409 },
    'auth/email-already-in-use':   { code:'EMAIL_EXISTS',        message:'An account with this email already exists.', status:409 },
    'auth/weak-password':          { code:'WEAK_PASSWORD',       message:'Password is not strong enough.',           status:400 },
    'auth/invalid-email':          { code:'INVALID_EMAIL',       message:'The email address is not valid.',          status:400 },
    'auth/operation-not-allowed':  { code:'SERVICE_UNAVAILABLE', message:'Account creation is temporarily unavailable.', status:503 },

    // Token lifecycle
    'auth/id-token-expired':       { code:'TOKEN_EXPIRED',       message:'Session expired. Please sign in again.',  status:401 },
    'auth/id-token-revoked':       { code:'TOKEN_REVOKED',       message:'Session revoked. Please sign in again.',  status:401 },
    'auth/argument-error':         { code:'INVALID_TOKEN',       message:'Invalid authentication token.',           status:401 },

    // Network
    'NETWORK_ERROR':               { code:'NETWORK_ERROR',       message:'Network error. Please try again.',        status:503 },
    'auth/network-request-failed': { code:'NETWORK_ERROR',       message:'Network error. Please try again.',        status:503 },
  };

  return MAP[msg] ?? { code:'AUTHENTICATION_FAILED', message:'Authentication failed. Please try again.', status:401 };
};

/* ══════════════════════════════════════════════════════════════
   USER-FACING MESSAGE MAP
══════════════════════════════════════════════════════════════ */

const CLIENT_MESSAGES = {
  INVALID_CREDENTIALS:   'Invalid email or password.',
  WRONG_PASSWORD:        'Incorrect password.',
  EMAIL_NOT_VERIFIED:    'Please verify your email before signing in.',
  USER_NOT_FOUND:        'No account found with this email.',
  ACCOUNT_DISABLED:      'Account disabled. Please contact support.',
  USER_DISABLED:         'Account disabled. Please contact support.',
  TOO_MANY_ATTEMPTS:     'Too many attempts. Please try again later.',
  RATE_LIMITED:          'Too many requests. Try again in a few minutes.',
  NETWORK_ERROR:         'Network error. Please try again.',
  TOKEN_EXPIRED:         'Session expired. Please sign in again.',
  TOKEN_REVOKED:         'Session revoked. Please sign in again.',
  ACCOUNT_SUSPENDED:     'Your account has been suspended. Contact support.',
  ACCOUNT_INACTIVE:      'Your account is not active. Please contact support.',
  ACCOUNT_PENDING:       'Please verify your email before signing in.',
  ACCOUNT_AWAITING:      'Your account is awaiting admin approval.',
  EMAIL_EXISTS:          'An account with this email already exists.',
  WEAK_PASSWORD:         'Password does not meet requirements.',
  INVALID_EMAIL:         'Invalid email address.',
  DISPOSABLE_EMAIL:      'Temporary or disposable email addresses are not allowed.',
  INACTIVE_DOMAIN:       'This email domain does not appear to be active.',
  MISSING_FIELDS:        'Please fill in all required fields.',
  SERVICE_UNAVAILABLE:   'Service temporarily unavailable. Please try again shortly.',
  DEFAULT:               'Something went wrong. Please try again.',
};

/** Returns a safe, user-facing message. Never exposes internals. */
export const getClientErrorMessage = (code) =>
  CLIENT_MESSAGES[code] ?? CLIENT_MESSAGES.DEFAULT;

/* ══════════════════════════════════════════════════════════════
   REGISTRATION ERROR HANDLING
══════════════════════════════════════════════════════════════ */

/** Maps a registration-flow error to { status, message }. */
export const getErrorResponse = (error) => {
  const codeMap = {
    WEAK_PASSWORD:        { status:400, message: error.message || CLIENT_MESSAGES.WEAK_PASSWORD },
    INVALID_EMAIL:        { status:400, message: CLIENT_MESSAGES.INVALID_EMAIL },
    INVALID_FORMAT:       { status:400, message: 'Invalid email format.' },
    DISPOSABLE_EMAIL:     { status:400, message: CLIENT_MESSAGES.DISPOSABLE_EMAIL },
    INACTIVE_DOMAIN:      { status:400, message: CLIENT_MESSAGES.INACTIVE_DOMAIN },
    BLOCKED_TLD:          { status:400, message: CLIENT_MESSAGES.INACTIVE_DOMAIN },
    MISSING_FIELDS:       { status:400, message: CLIENT_MESSAGES.MISSING_FIELDS },
    EMAIL_EXISTS:         { status:409, message: CLIENT_MESSAGES.EMAIL_EXISTS },
    PENDING_VERIFICATION: { status:409, message: 'This email is already registered. Please verify your email.' },
    SERVICE_UNAVAILABLE:  { status:503, message: CLIENT_MESSAGES.SERVICE_UNAVAILABLE },
    5:                    { status:500, message: CLIENT_MESSAGES.DEFAULT },
  };

  if (codeMap[error.code]) return codeMap[error.code];
  const fb = mapFirebaseError(error);
  if (fb.code !== 'AUTHENTICATION_FAILED') return { status: fb.status, message: fb.message };
  return { status:500, message: CLIENT_MESSAGES.DEFAULT };
};

/**
 * Logs + audits a registration error. Non-fatal — never throws.
 * @param {Error} error
 * @param {import('express').Request} req
 */
export const handleRegistrationError = async (error, req) => {
  const email     = req?.body?.email || 'unknown';
  const clientIp  = req?.ip || req?.connection?.remoteAddress || 'unknown';
  const userAgent = req?.headers?.['user-agent'] || 'unknown';

  const payload = { code: error.code || 'UNKNOWN', message: error.message || 'Unknown', email, ip: clientIp, userAgent, timestamp: new Date().toISOString() };
  console.error('❌ [Register]', isDev() ? { ...payload, stack: error.stack } : payload);

  AuditLog.record('REGISTRATION_ERROR', {
    ip: clientIp, userAgent,
    metadata: { email, errorCode: error.code, errorMessage: error.message },
  }).catch(() => {});
};

/* ══════════════════════════════════════════════════════════════
   LOGIN ERROR HANDLING
══════════════════════════════════════════════════════════════ */

/**
 * Maps, logs, and audits a login failure.
 * @param {Error} error
 * @param {{ email, ip, userAgent, userId? }} context
 * @returns {Promise<{ code, status, message }>}
 */
export const handleLoginError = async (error, { email, ip, userAgent, userId } = {}) => {
  const APP_CODE_MAP = {
    USER_NOT_FOUND:      { status:401, message:'Invalid email or password.' },
    USER_RECORD_MISSING: { status:500, message:'User profile could not be loaded. Please try again.' },
    ACCOUNT_SUSPENDED:   { status:403, message:'Your account has been suspended. Contact support.' },
    ACCOUNT_PENDING:     { status:403, message:'Please verify your email before signing in.' },
    ACCOUNT_AWAITING:    { status:403, message:'Your account is awaiting admin approval.' },
    TOKEN_INVALID:       { status:401, message:'Authentication failed. Please sign in again.' },
    TOKEN_EXPIRED:       { status:401, message:'Your session has expired. Please sign in again.' },
    TOKEN_REVOKED:       { status:401, message:'Your session was revoked. Please sign in again.' },
    TOO_MANY_ATTEMPTS:   { status:429, message:'Too many failed attempts. Please wait before trying again.' },
    DATABASE_TIMEOUT:    { status:503, message:'Service is temporarily slow. Please try again.' },
  };

  let mapped;
  if (error.status) {
    mapped = error; // already shaped
  } else if (APP_CODE_MAP[error.code]) {
    mapped = { code: error.code, ...APP_CODE_MAP[error.code] };
  } else {
    mapped = mapFirebaseError(error);
  }

  const payload = { code: mapped.code, rawMessage: error.message, email, ip, userAgent, timestamp: new Date().toISOString() };
  console.error('❌ [Login]', isDev() ? { ...payload, stack: error.stack } : payload);

  AuditLog.record(AuditLog.EVENTS?.LOGIN_FAILURE ?? 'LOGIN_FAILURE', {
    userId: userId || 'unknown', ip, userAgent,
    metadata: { email, errorCode: mapped.code, errorMessage: mapped.message },
  }).catch(() => {});

  return mapped;
};

/* ══════════════════════════════════════════════════════════════
   SEND ERROR RESPONSE — single canonical function
══════════════════════════════════════════════════════════════ */

/**
 * Sends a consistent JSON error response.
 * Stack traces only in development. Never leaks internals.
 * @param {import('express').Response} res
 * @param {Error | { code?, status?, message? }} error
 */
export const sendErrorResponse = (res, error) => {
  if (!error) {
    return res.status(500).json({ error:'An unexpected error occurred. Please try again.', code:'INTERNAL_ERROR' });
  }

  const status  = error.status || error.statusCode || 500;
  const code    = error.code   || 'INTERNAL_ERROR';
  const message = error.message || getClientErrorMessage(code) || 'An unexpected error occurred.';

  const body = { error: message, code };
  if (isDev() && error.details) body.details = error.details;

  return res.status(status).json(body);
};

/* ══════════════════════════════════════════════════════════════
   EXPRESS MIDDLEWARE
══════════════════════════════════════════════════════════════ */

/** 404 handler — mount AFTER all routes */
export const notFound = (req, res) =>
  res.status(404).json({ error:'Not Found', code:'NOT_FOUND', path: req.originalUrl, method: req.method });

/** Global error handler — mount LAST (4 params required by Express) */
export const errorHandler = (err, req, res, _next) => {
  console.error('🔥 [Unhandled]', {
    message: err.message, code: err.code,
    path: req.originalUrl, method: req.method,
    ...(isDev() && { stack: err.stack }),
  });
  res.status(err.status || err.statusCode || 500).json({
    error: isDev() ? err.message : 'Internal Server Error',
    code:  err.code || 'SERVER_ERROR',
    ...(isDev() && { path: req.originalUrl }),
  });
};