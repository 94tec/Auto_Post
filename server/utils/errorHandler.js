import AuditLog from '../services/auditLog.js';

async function handleRegistrationError(error, req) {
  const email = req.body?.email || 'unknown';
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const timestamp = new Date().toISOString();

  console.error('❌ Registration Error:', {
    error: error.message || 'Unknown',
    stack: error.stack,
    code: error.code,
    ip,
    email,
    timestamp
  });

}

function getErrorResponse(error) {
  if (error.code === 'WEAK_PASSWORD') {
    return { status: 400, message: error.message || 'Password not strong enough.' };
  }
  if (error.code === 5 || error.code === 'NOT_FOUND') {
    return { status: 500, message: 'Server error during registration. Please try again.' };
  }

  return { status: 500, message: error.message || 'An unexpected error occurred during registration.' };
}

async function handleLoginError(error, { email, ip, userAgent, userId }) {
  const code = error.code || 'LOGIN_FAILED';
  const message = error.message || 'Login failed';

  const timestamp = new Date().toISOString();

  try {
    await AuditLog.record(AuditLog.EVENTS.LOGIN_FAILURE, {
      userId: userId || 'unknown',
      email,
      ip,
      userAgent,
      errorCode: code,
      errorMessage: message,
      timestamp
    });
  } catch (auditErr) {
    console.error('⚠️ Failed to record login attempt:', auditErr.message);
  }

  console.error('❌ Login Error:', {
    errorCode: code,
    errorMessage: message,
    ip,
    email,
    timestamp
  });
}

function sendErrorResponse(res, error) {
  const statusCode = error.status || 401;
  const clientMessage = getClientErrorMessage(error.code);

  res.status(statusCode).json({
    error: clientMessage,
    code: error.code || 'AUTHENTICATION_FAILED'
  });
}

function getClientErrorMessage(errorCode) {
  const messages = {
    'INVALID_CREDENTIALS': 'Invalid email or password',
    'WRONG_PASSWORD': 'Incorrect password',
    'EMAIL_NOT_VERIFIED': 'Please verify your email before logging in',
    'USER_NOT_FOUND': 'Account not found',
    'ACCOUNT_DISABLED': 'Account disabled. Please contact support.',
    'TOO_MANY_ATTEMPTS': 'Too many attempts. Please try again later.',
    'RATE_LIMITED': 'Too many requests. Try again later.',
    'NETWORK_ERROR': 'Network error. Please try again.',
    'DEFAULT': 'Authentication failed. Please try again.'
  };

  return messages[errorCode] || messages.DEFAULT;
}

function mapFirebaseError(error) {
  const firebaseMsg = error?.response?.data?.error?.message || error?.code || 'UNKNOWN';

  switch (firebaseMsg) {
    case 'EMAIL_NOT_FOUND':
    case 'auth/user-not-found':
      return { code: 'USER_NOT_FOUND', message: 'User not found.' };
    case 'INVALID_PASSWORD':
    case 'auth/wrong-password':
      return { code: 'WRONG_PASSWORD', message: 'Incorrect password.' };
    case 'TOO_MANY_ATTEMPTS_TRY_LATER':
    case 'auth/too-many-requests':
      return { code: 'TOO_MANY_ATTEMPTS', message: 'Too many login attempts. Please try again later.' };
    case 'USER_DISABLED':
    case 'auth/user-disabled':
      return { code: 'USER_DISABLED', message: 'Your account has been disabled.' };
    case 'NETWORK_ERROR':
    case 'auth/network-request-failed':
      return { code: 'NETWORK_ERROR', message: 'Network error. Please try again.' };
    case 'INVALID_LOGIN_CREDENTIALS':
      return { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
    default:
      return {
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed. Please try again.'
      };
  }
}

export {
  handleRegistrationError,
  getErrorResponse,
  handleLoginError,
  sendErrorResponse,
  getClientErrorMessage,
  mapFirebaseError
};
