// utils/authUtils.js
import crypto from 'crypto';
import { db, admin } from '../config/firebase.js';
const loginAttempts = new Map();

const checkLoginAttempts = (email) => {
  const attempts = loginAttempts.get(email) || { count: 0, lastAttempt: null };
  
  if (attempts.count >= 5) {
    const lockDuration = 60 * 60 * 1000; // 1 hour
    if (Date.now() - attempts.lastAttempt < lockDuration) {
      // Log and alert
      console.alert(`Account locked: ${email} from IP ${req.ip}`);
      return false;
    }
    // Reset if lock duration has passed
    loginAttempts.delete(email);
  }
  return true;
};

const recordFailedAttempt = (email) => {
  const attempts = loginAttempts.get(email) || { count: 0 };
  attempts.count += 1;
  attempts.lastAttempt = Date.now();
  loginAttempts.set(email, attempts);
  
  if (attempts.count === 3) {
    // Send warning email
    sendSecurityAlert(email, 'Multiple failed login attempts');
  }
};
/**
 * Validates an email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if email is valid
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  
  // RFC 5322 compliant regex (simplified version)
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  // Additional checks
  if (email.length > 254) return false;
  if (email.indexOf('@') === -1) return false;
  
  const parts = email.split('@');
  if (parts[0].length > 64) return false;
  
  return regex.test(email);
}
/**
 * Validates password meets security requirements
 * @param {string} password - Password to validate
 * @returns {boolean} True if password is valid
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  
  // Minimum 8 characters, at least:
  // 1 uppercase, 1 lowercase, 1 number, 1 special character
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  
  // Additional checks
  if (password.length > 128) return false;
  if (password.includes(' ')) return false;
  
  return regex.test(password);
}

// Session fingerprinting
function createSessionFingerprint(userAgent) {
  const ua = userAgent || 'unknown-agent';
  const hash = crypto.createHash('sha256');
  hash.update(ua);
  hash.update(process.env.COOKIE_SECRET);
  return hash.digest('hex').substring(0, 16);
}

// CSRF protection
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Gets the token revocation time for a user
 * @param {string} uid - User ID to check
 * @returns {Date|null} Revocation date or null if not revoked
 */
async function getTokenRevocationTime(uid) {
  try {
    const snapshot = await db.ref(`tokenRevocations/${uid}`).once('value');
    const revokedAt = snapshot.val();
    
    return revokedAt ? new Date(revokedAt) : null;
  } catch (error) {
    console.error('Error checking token revocation:', error);
    return null; // Fail open - assume not revoked if error occurs
  }
}
export {
  checkLoginAttempts,
  recordFailedAttempt,
  validateEmail,
  validatePassword,
  createSessionFingerprint,
  generateCSRFToken,
  getTokenRevocationTime
}