/**
 * utils/authErrorHandler.js
 * ═══════════════════════════════════════════════════════════════════
 * BACKWARD COMPAT SHIM — do not add logic here.
 *
 * All error handling logic now lives in utils/errorHandler.js.
 * This file re-exports everything so existing imports don't break.
 *
 * If you import from authErrorHandler.js anywhere, migrate to:
 *   import { ... } from '../utils/errorHandler.js';
 * ═══════════════════════════════════════════════════════════════════
 */

export {
  mapFirebaseError,
  mapRegistrationError,
  handleRegistrationError,
  handleLoginError,
  sendErrorResponse,
} from './errorHandler.js';

// mapRegistrationError is a legacy alias for getErrorResponse
import { getErrorResponse } from './errorHandler.js';
export const mapRegistrationError = getErrorResponse;