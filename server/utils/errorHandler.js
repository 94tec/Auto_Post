/**
 * utils/errorHandler.js
 * Global Express Error Middleware
 * Handles:
 *   - 404 routes
 *   - Uncaught application errors
 *   - Consistent JSON error responses
 */

/**
 * 404 handler — must be after all routes
 */
export function notFound(req, res, _next) {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
    method: req.method,
  });
}

/**
 * Global error handler — must be last middleware
 */
export function errorHandler(err, req, res, _next) {
  console.error('🔥 Unhandled Server Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  const statusCode = err.status || err.statusCode || 500;

  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'SERVER_ERROR',
  });
}