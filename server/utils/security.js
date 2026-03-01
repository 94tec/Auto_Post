// server/utils/security.js
import { UAParser } from 'ua-parser-js';
import crypto from 'crypto';

// Set strong HTTP security headers
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
}

// Parse user agent string into a readable description
function parseUserAgent(ua) {
  try {
    if (!ua || typeof ua !== 'string') return 'Unknown Device';

    const parser = new UAParser(ua);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();

    const browserName = browser?.name || 'Browser';
    const browserVersion = browser?.version || '';
    const osName = os?.name || 'OS';
    const osVersion = os?.version || '';
    const deviceType = device?.type || 'Desktop';

    return `${browserName} ${browserVersion} on ${osName} ${osVersion} (${deviceType})`;
  } catch (err) {
    console.error('UA Parse error:', err.message);
    return 'Unknown Device';
  }
}

/**
 * Create a fingerprint for a session based on user agent and IP.
 * Used for device tracking and security.
 * @param {string} userAgent
 * @param {string} ip
 * @returns {string} SHA-256 hash of combined data
 */
function createSessionFingerprint(userAgent, ip) {
  const data = `${userAgent}|${ip}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}
/**
 * Generate a secure random CSRF token.
 * @param {number} bytes - number of random bytes (default 32)
 * @returns {string} hex string
 */
function generateCSRFToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export {
  setSecurityHeaders,
  parseUserAgent,
  createSessionFingerprint, 
  generateCSRFToken,  
};