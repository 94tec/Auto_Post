/**
 * utils/errorHandler.js
 * ═══════════════════════════════════════════════════════════════════
 * Unified error handling for the Damuchi / 94tec platform.
 *
 * EXPORTS (application-level helpers):
 *   handleRegistrationError(error, req)  — logs + optionally audits
 *   getErrorResponse(error)              — maps error → { status, message }
 *   handleLoginError(error, context)     — logs + audits login failures
 *   sendErrorResponse(res, error)        — sends consistent JSON error
 *   getClientErrorMessage(code)          — safe user-facing messages
 *   mapFirebaseError(error)              — Firebase REST API error mapping
 *
 * EXPRESS MIDDLEWARE (mount in index.js):
 *   notFound(req, res, next)             — 404 handler after all routes
 *   errorHandler(err, req, res, next)    — global uncaught error handler
 *
 * DESIGN PRINCIPLES
 *   - User-facing messages never leak stack traces or internal codes
 *   - Full details go to server logs only
 *   - In development, `details` field is included in responses
 *   - Audit logging is non-fatal (errors caught and swallowed)
 * ═══════════════════════════════════════════════════════════════════
 */

import AuditLog from '../services/auditLog.js';

const isDev = () => process.env.NODE_ENV !== 'production';

/* ══════════════════════════════════════════════════════════════════
   FIREBASE ERROR MAPPING
   Maps Firebase REST API error codes → application error codes
   ══════════════════════════════════════════════════════════════════ */

/**
 * Maps a Firebase Auth error (from REST API or Admin SDK) to a
 * standardised application error object.
 *
 * @param {Error} error
 * @returns {{ code: string, message: string, status: number }}
 */
export const mapFirebaseError = (error) => {
  // Firebase REST API puts the message in response.data.error.message
  const firebaseMsg =
    error?.response?.data?.error?.message ||
    error?.code ||
    'UNKNOWN';

  const map = {
    // Auth errors
    'EMAIL_NOT_FOUND':             { code: 'USER_NOT_FOUND',     message: 'No account found with this email.', status: 404 },
    'auth/user-not-found':         { code: 'USER_NOT_FOUND',     message: 'No account found with this email.', status: 404 },
    'INVALID_PASSWORD':            { code: 'WRONG_PASSWORD',     message: 'Incorrect password.',               status: 401 },
    'auth/wrong-password':         { code: 'WRONG_PASSWORD',     message: 'Incorrect password.',               status: 401 },
    'INVALID_LOGIN_CREDENTIALS':   { code: 'INVALID_CREDENTIALS',message: 'Invalid email or password.',        status: 401 },
    'auth/invalid-credential':     { code: 'INVALID_CREDENTIALS',message: 'Invalid email or password.',        status: 401 },
    'TOO_MANY_ATTEMPTS_TRY_LATER': { code: 'TOO_MANY_ATTEMPTS',  message: 'Too many attempts. Try again later.', status: 429 },
    'auth/too-many-requests':      { code: 'TOO_MANY_ATTEMPTS',  message: 'Too many attempts. Try again later.', status: 429 },
    'USER_DISABLED':               { code: 'USER_DISABLED',      message: 'This account has been disabled.',   status: 403 },
    'auth/user-disabled':          { code: 'USER_DISABLED',      message: 'This account has been disabled.',   status: 403 },
    'auth/email-already-exists':   { code: 'EMAIL_EXISTS',       message: 'An account with this email already exists.', status: 409 },
    'auth/email-already-in-use':   { code: 'EMAIL_EXISTS',       message: 'An account with this email already exists.', status: 409 },
    'auth/id-token-expired':       { code: 'TOKEN_EXPIRED',      message: 'Session expired. Please sign in again.', status: 401 },
    'auth/id-token-revoked':       { code: 'TOKEN_REVOKED',      message: 'Session revoked. Please sign in again.', status: 401 },
    'auth/argument-error':         { code: 'INVALID_TOKEN',      message: 'Invalid authentication token.',    status: 401 },
    'NETWORK_ERROR':               { code: 'NETWORK_ERROR',      message: 'Network error. Please try again.', status: 503 },
    'auth/network-request-failed': { code: 'NETWORK_ERROR',      message: 'Network error. Please try again.', status: 503 },
  };

  return map[firebaseMsg] ?? {
    code:    'AUTHENTICATION_FAILED',
    message: 'Authentication failed. Please try again.',
    status:  401,
  };
};

/* ══════════════════════════════════════════════════════════════════
   USER-FACING ERROR MESSAGES
   Safe messages shown to the client — never expose internals
   ══════════════════════════════════════════════════════════════════ */

const CLIENT_MESSAGES = {
  INVALID_CREDENTIALS:  'Invalid email or password.',
  WRONG_PASSWORD:       'Incorrect password.',
  EMAIL_NOT_VERIFIED:   'Please verify your email before logging in.',
  USER_NOT_FOUND:       'No account found with this email.',
  ACCOUNT_DISABLED:     'Account disabled. Please contact support.',
  USER_DISABLED:        'Account disabled. Please contact support.',
  TOO_MANY_ATTEMPTS:    'Too many attempts. Please try again later.',
  RATE_LIMITED:         'Too many requests. Try again in a few minutes.',
  NETWORK_ERROR:        'Network error. Please try again.',
  TOKEN_EXPIRED:        'Session expired. Please sign in again.',
  TOKEN_REVOKED:        'Session revoked. Please sign in again.',
  ACCOUNT_SUSPENDED:    'Your account has been suspended. Contact support.',
  ACCOUNT_INACTIVE:     'Your account is not active. Please contact support.',
  EMAIL_EXISTS:         'An account with this email already exists.',
  WEAK_PASSWORD:        'Password does not meet requirements.',
  INVALID_EMAIL:        'Invalid email address.',
  DISPOSABLE_EMAIL:     'Temporary or disposable email addresses are not allowed.',
  INACTIVE_DOMAIN:      'This email domain does not appear to be active.',
  MISSING_FIELDS:       'Please fill in all required fields.',
  DEFAULT:              'Something went wrong. Please try again.',
};

/**
 * Returns a safe, user-facing error message for a given error code.
 * Never exposes internal details.
 * @param {string} code
 * @returns {string}
 */
export const getClientErrorMessage = (code) =>
  CLIENT_MESSAGES[code] ?? CLIENT_MESSAGES.DEFAULT;

/* ══════════════════════════════════════════════════════════════════
   REGISTRATION ERROR HANDLING
   ══════════════════════════════════════════════════════════════════ */

/**
 * Logs a registration error to the console.
 * Non-fatal — never throws.
 *
 * @param {Error} error
 * @param {import('express').Request} req
 */
export const handleRegistrationError = async (error, req) => {
  const email     = req?.body?.email || 'unknown';
  const clientIp  = req?.ip || req?.connection?.remoteAddress || 'unknown';
  const userAgent = req?.headers?.['user-agent'] || 'unknown';

  const logPayload = {
    code:      error.code    || 'UNKNOWN',
    message:   error.message || 'Unknown registration error',
    email,
    ip:        clientIp,
    userAgent,
    timestamp: new Date().toISOString(),
  };

  console.error('❌ Registration Error:', isDev() ? { ...logPayload, stack: error.stack } : logPayload);

  // Best-effort audit log (non-fatal)
  try {
    await AuditLog.record('REGISTRATION_ERROR', {
      ip:        clientIp,
      userAgent,
      metadata:  { email, errorCode: error.code, errorMessage: error.message },
    });
  } catch {
    // Audit failure must never propagate
  }
};

/**
 * Maps an error from the registration flow to an HTTP status + message.
 * @param {Error} error
 * @returns {{ status: number, message: string }}
 */
export const getErrorResponse = (error) => {
  const codeMap = {
    WEAK_PASSWORD:       { status: 400, message: error.message || CLIENT_MESSAGES.WEAK_PASSWORD },
    INVALID_EMAIL:       { status: 400, message: CLIENT_MESSAGES.INVALID_EMAIL },
    INVALID_FORMAT:      { status: 400, message: 'Invalid email format.' },
    DISPOSABLE_EMAIL:    { status: 400, message: CLIENT_MESSAGES.DISPOSABLE_EMAIL },
    INACTIVE_DOMAIN:     { status: 400, message: CLIENT_MESSAGES.INACTIVE_DOMAIN },
    BLOCKED_TLD:         { status: 400, message: CLIENT_MESSAGES.INACTIVE_DOMAIN },
    MISSING_FIELDS:      { status: 400, message: CLIENT_MESSAGES.MISSING_FIELDS },
    EMAIL_EXISTS:        { status: 409, message: CLIENT_MESSAGES.EMAIL_EXISTS },
    PENDING_VERIFICATION:{ status: 409, message: 'This email is already registered. Please verify your email.' },
    NOT_FOUND:           { status: 500, message: CLIENT_MESSAGES.DEFAULT },
    // Firebase code 5 = NOT_FOUND from Admin SDK
    5:                   { status: 500, message: CLIENT_MESSAGES.DEFAULT },
  };

  const mapped = codeMap[error.code];
  if (mapped) return mapped;

  // Firebase error fallback
  const firebase = mapFirebaseError(error);
  if (firebase.code !== 'AUTHENTICATION_FAILED') {
    return { status: firebase.status, message: firebase.message };
  }

  return { status: 500, message: CLIENT_MESSAGES.DEFAULT };
};

/* ══════════════════════════════════════════════════════════════════
   LOGIN ERROR HANDLING
   ══════════════════════════════════════════════════════════════════ */

/**
 * Logs and audits a login failure.
 * Non-fatal — never throws.
 *
 * @param {Error} error
 * @param {{ email, ip, userAgent, userId? }} context
 */
export const handleLoginError = async (error, { email, ip, userAgent, userId } = {}) => {
  const code    = error.code    || 'LOGIN_FAILED';
  const message = error.message || 'Login failed';

  const logPayload = {
    code, message, email, ip, userAgent,
    timestamp: new Date().toISOString(),
  };

  console.error('❌ Login Error:', isDev() ? { ...logPayload, stack: error.stack } : logPayload);

  // Best-effort audit
  try {
    await AuditLog.record(AuditLog.EVENTS?.LOGIN_FAILURE ?? 'LOGIN_FAILURE', {
      userId:    userId || 'unknown',
      ip,
      userAgent,
      metadata:  { email, errorCode: code, errorMessage: message },
    });
  } catch {
    // Non-fatal
  }
};

/* ══════════════════════════════════════════════════════════════════
   SEND ERROR RESPONSE
   ══════════════════════════════════════════════════════════════════ */

/**
 * Sends a consistent JSON error response.
 * User-facing message is always safe. Stack only in development.
 *
 * @param {import('express').Response} res
 * @param {Error | { code?, status?, message? }} error
 */
export const sendErrorResponse = (res, error) => {
  const statusCode = error.status || error.statusCode || 401;
  const code       = error.code   || 'AUTHENTICATION_FAILED';
  const message    = getClientErrorMessage(code);

  const body = { error: message, code };

  // Include details in development only
  if (isDev() && error.message && error.message !== message) {
    body.details = error.message;
  }

  res.status(statusCode).json(body);
};

/* ══════════════════════════════════════════════════════════════════
   EXPRESS MIDDLEWARE  (mount in index.js)
   ══════════════════════════════════════════════════════════════════ */

/**
 * 404 Not Found handler.
 * Mount AFTER all routes.
 */
export const notFound = (req, res, _next) => {
  res.status(404).json({
    error:  'Not Found',
    code:   'NOT_FOUND',
    path:   req.originalUrl,
    method: req.method,
  });
};

/**
 * Global uncaught error handler.
 * Mount LAST — after notFound.
 * Must have exactly 4 params for Express to recognise it as an error handler.
 */
export const errorHandler = (err, req, res, _next) => {
  console.error('🔥 Unhandled Server Error:', {
    message: err.message,
    code:    err.code,
    path:    req.originalUrl,
    method:  req.method,
    ...(isDev() && { stack: err.stack }),
  });

  const statusCode = err.status || err.statusCode || 500;

  res.status(statusCode).json({
    error: isDev() ? err.message : 'Internal Server Error',
    code:  err.code || 'SERVER_ERROR',
    ...(isDev() && { path: req.originalUrl }),
  });
};