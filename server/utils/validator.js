// server/utils/validator.js
import dns from 'dns';
import argon2 from 'argon2';
import crypto, { verify } from 'crypto';

const ENCRYPTION_KEY = process.env.LOG_ENCRYPTION_KEY.slice(0, 32); // 32 bytes
const ALGORITHM = 'aes-256-cbc'; // AES-256-CBC encryption
const IV_LENGTH = 16;

// 1. Strong password validation
// Password must be at least 8 characters long, include uppercase, lowercase, number, and special character.
// Returns an object with valid status and message
const isStrongPassword = (password) => {
  const strongPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^])[A-Za-z\d@$!%*?&#^]{8,}$/;

  if (!password) {
    return { valid: false, message: 'Password cannot be empty' };
  }

  if (!strongPattern.test(password)) {
    return {
      valid: false,
      message: 'Password must be at least 8 characters long, include uppercase, lowercase, number, and special character.'
    };
  }

  return { valid: true };
};


// 2. Basic email format check
const isValidEmail = (email) => {
  const domainPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return domainPattern.test(email);
};
// 3. Check if email domain exists
const isEmailDomainValid = async (email) => {
  try {
    const domain = email.split('@')[1];
    if (!domain) {
      return { valid: false, reason: 'Invalid email format: missing domain.' };
    }

    const lowerCaseDomain = domain.toLowerCase();

    // Optional: block fake/disposable domains
    const blockList = ['mailinator.com', '10minutemail.com', 'example.com']; // Extend this list as needed
    if (blockList.includes(lowerCaseDomain)) {
      return { valid: false, reason: `Email domain '${domain}' is not allowed.` };
    }

    // Attempt to resolve MX records
    const mxRecords = await dns.promises.resolveMx(lowerCaseDomain);

    if (mxRecords && mxRecords.length > 0) {
      return { valid: true }; // Domain has valid MX records and is not in blocklist
    } else {
      return { valid: false, reason: `Email domain '${domain}' does not have valid MX records.` };
    }

  } catch (err) {
    // Catching specific DNS errors can provide more context
    if (err.code === 'ENOTFOUND') {
      return { valid: false, reason: `Email domain '${email.split('@')[1]}' not found.` };
    }
    console.error('DNS lookup failed for email domain validation:', err.message);
    return { valid: false, reason: 'Failed to validate email domain due to a server error.' };
  }
};

// 4. Password hashing with argon2
const hashPassword = async (plainText) => {
  return await argon2.hash(plainText);
};

// 5. Password comparison with argon2
const verifyPassword = async (plainText, hashedPassword) => {
  try {
    return await argon2.verify(hashedPassword, plainText);
  } catch (err) {
    console.error('Password verification failed:', err.message);
    return false;
  }
};

/**
 * Hash a string using SHA-256 and base64 encoding
 * @param {string} input
 * @returns {Promise<string>} Base64 hash
 */
async function hashString(input) {
  return crypto.createHash('sha256').update(input).digest('base64');
}
// Encrypt and decrypt functions using AES-256-CBC
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(enc) {
  const [ivHex, dataHex] = enc.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText, 'binary', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
function safeDecryptObject(enc) {
  try {
    const decrypted = decrypt(enc);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return {};
  }
}
function safeEncryptObject(obj = {}) {
  try {
    const json = JSON.stringify(obj);
    return encrypt(json);
  } catch (error) {
    console.error('Encryption failed:', error.message);
    return encrypt('{}'); // Return empty object if encryption fails
  }
}
async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(hashBuffer).toString('base64');
}
function encodeFirebaseKey(key) {
  return key
    .replace(/\./g, '%2E')
    .replace(/#/g, '%23')
    .replace(/\$/g, '%24')
    .replace(/\//g, '%2F')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D');
}

function decodeFirebaseKey(key) {
  return key
    .replace(/%2E/g, '.')
    .replace(/%23/g, '#')
    .replace(/%24/g, '$')
    .replace(/%2F/g, '/')
    .replace(/%5B/g, '[')
    .replace(/%5D/g, ']');
}

export {
  isStrongPassword,
  isValidEmail, 
  isEmailDomainValid,
  hashPassword,
  verifyPassword,
  hashString,
  encrypt,
  decrypt,
  safeEncryptObject,
  safeDecryptObject,
  hashToken,
  encodeFirebaseKey,
  decodeFirebaseKey
};



