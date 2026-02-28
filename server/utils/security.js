// server/utils/security.js
import e from 'express';
import { UAParser } from 'ua-parser-js';

// Set strong HTTP security headers
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
}

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

export {
  setSecurityHeaders,
  parseUserAgent
};
