/**
 * utils/validator.js
 * ═══════════════════════════════════════════════════════════════════
 * Validation utilities used across the entire application.
 *
 * EMAIL VALIDATION PIPELINE (in order):
 *   1. Format check        — RFC-5321 regex
 *   2. Length limits       — local (64) + domain (255) + total (320)
 *   3. Disposable blocklist — 150+ known throwaway domains
 *   4. Blocked TLD check   — .test .invalid .example .localhost
 *   5. MX record lookup    — real DNS query, confirms domain can receive mail
 *   6. Fallback A record   — some valid domains have A but not MX
 *
 * PASSWORD VALIDATION & HASHING
 *   - validatePasswordStrength() — checks complexity
 *   - hashPassword() / verifyPassword() — argon2id hashing
 *
 * Usage:
 *   import { validateEmailFull, hashString, hashPassword } from '../utils/validator.js';
 *   const result = await validateEmailFull('user@gmail.com');
 *   if (!result.valid) return res.status(400).json({ error: result.reason });
 * ═══════════════════════════════════════════════════════════════════
 */

import dns           from 'dns';
import { promisify } from 'util';
import crypto        from 'crypto';
import argon2        from 'argon2';   // added for password hashing

const resolveMx = promisify(dns.resolveMx);
const resolve4  = promisify(dns.resolve4);  // A record fallback
const resolve6  = promisify(dns.resolve6);  // AAAA record fallback

/* ══════════════════════════════════════════════════════════════════
   DISPOSABLE / THROWAWAY EMAIL DOMAIN BLOCKLIST
   ══════════════════════════════════════════════════════════════════ */
const DISPOSABLE_DOMAINS = new Set([
  // ... (your existing list, unchanged) ...
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
  'guerrillamail.de', 'guerrillamail.biz', 'guerrillamail.info',
  'throwam.com', 'throwaway.email', 'dispostable.com', 'spamgourmet.com',
  'spamgourmet.net', 'spamgourmet.org', 'tempmail.com', 'temp-mail.org',
  'temp-mail.ru', 'tempmail.net', 'tempinbox.com', 'trashmail.com',
  'trashmail.me', 'trashmail.net', 'trashmail.at', 'trashmail.io',
  'trashmail.xyz', 'trashmail.org', 'getairmail.com', 'airmail.me',
  'mailnull.com', 'mailnull.net', 'yopmail.com', 'yopmail.fr',
  'cool.fr.nf', 'jetable.fr.nf', 'nospam.ze.tc', 'nomail.xl.cx',
  'mega.zik.dj', 'speed.1s.fr', 'courriel.fr.nf', 'moncourrier.fr.nf',
  'monemail.fr.nf', 'monmail.fr.nf',
  'maildrop.cc', 'mailnesia.com', 'mailnull.com', 'mailsac.com',
  'mailtemp.org', 'mailtemp.net', 'mailtemp.info',
  '10minutemail.com', '10minutemail.net', '10minutemail.org',
  '10minutemail.co.za', '10minutemail.de', '10minutemail.us',
  '10minutemail.info', '10minemail.com', 'tenminutemail.com',
  'sharklasers.com', 'guerrillamailblock.com', 'grr.la', 'guerrillamail.info',
  'spam4.me', 'spamhere.net', 'spamhereplease.com',
  'example.com', 'example.net', 'example.org', 'test.com', 'test.net',
  'test.org', 'localhost.com', 'invalid.com',
  'mohmal.com', 'spamex.com', 'spaml.com', 'spaml.de', 'spamoff.de',
  'nospam.ze.tc', 'fastacura.com', 'fastchevy.com', 'fastchrysler.com',
  'fastkawasaki.com', 'fastmazda.com', 'fastmitsubishi.com', 'fastnissan.com',
  'fastsubaru.com', 'fastsuzuki.com', 'fasttoyota.com', 'fastyamaha.com',
  'fakeinbox.com', 'safetymail.info', 'gishpuppy.com', 'sneakemail.com',
  'wegwerfmail.de', 'wegwerfmail.net', 'wegwerfmail.org',
  'protonmail.trash.net', 'tempail.com', 'owlpic.com', 'emailondeck.com',
  'discard.email', 'discardmail.com', 'discardmail.de', 'spamgrap.com',
  'spamspot.com', 'spamstack.net', 'spamavert.com',
  'throwam.com', 'throwam.net', 'throwam.org',
  'filzmail.com', 'filzmail.org', 'inboxalias.com',
  'zetmail.com', 'meltmail.com', 'trbvm.com', 'kurzepost.de',
  'objectmail.com', 'proxymail.eu', 'rcpt.at', 'recode.me',
  'mytrashmail.com', 'mt2014.com', 'mt2015.com', 'notsharingmy.info',
  'nospam4.us', 'nus.edu.disposable',
]);

/* ══════════════════════════════════════════════════════════════════
   BLOCKED TLDs  (always invalid for real users)
   ══════════════════════════════════════════════════════════════════ */
const BLOCKED_TLDS = new Set([
  '.test', '.invalid', '.example', '.localhost',
  '.local', '.internal', '.arpa', '.corp', '.home',
]);

/* ══════════════════════════════════════════════════════════════════
   FORMAT VALIDATION
   ══════════════════════════════════════════════════════════════════ */

/**
 * RFC-5321 compliant email format check.
 * Returns true/false — does not check DNS.
 * @param {string} email
 * @returns {boolean}
 */
export const isValidEmailFormat = (email) => {
  if (!email || typeof email !== 'string') return false;

  if (email.length > 320) return false;

  const parts = email.split('@');
  if (parts.length !== 2) return false;

  const [local, domain] = parts;
  if (!local || !domain)       return false;
  if (local.length > 64)       return false;
  if (domain.length > 255)     return false;

  const localRegex = /^[a-zA-Z0-9]([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]*[a-zA-Z0-9])?$/;
  if (!localRegex.test(local)) return false;
  if (local.includes('..'))    return false;

  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!domainRegex.test(domain)) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;

  if (!domain.includes('.')) return false;

  return true;
};

/* ══════════════════════════════════════════════════════════════════
   DNS MX LOOKUP  (core of active email validation)
   ══════════════════════════════════════════════════════════════════ */

/**
 * Checks if a domain has active MX records (can receive email).
 * Falls back to A/AAAA records if no MX found.
 *
 * @param {string} domain  e.g. 'gmail.com'
 * @param {number} timeoutMs  default 5000ms
 * @returns {Promise<{ active: boolean, reason?: string, records?: Object[] }>}
 */
export const checkDomainMX = async (domain, timeoutMs = 5000) => {
  const withTimeout = (promise, ms, label) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`DNS timeout: ${label}`)), ms),
      ),
    ]);

  try {
    const mxRecords = await withTimeout(resolveMx(domain), timeoutMs, 'MX');
    if (mxRecords && mxRecords.length > 0) {
      const valid = mxRecords.filter(
        (r) => r.exchange && r.exchange.length > 0 && r.exchange !== '.',
      );
      if (valid.length > 0) {
        return {
          active:  true,
          method:  'MX',
          records: valid.map((r) => ({ exchange: r.exchange, priority: r.priority })),
        };
      }
    }
  } catch (mxErr) {
    if (mxErr.code === 'ECONNREFUSED' || mxErr.message?.includes('timeout')) {
      console.warn(`⚠️  DNS server unreachable for ${domain} — skipping DNS check`);
      return { active: true, method: 'DNS_SKIP', reason: 'DNS server unreachable' };
    }
  }

  try {
    const aRecords = await withTimeout(resolve4(domain), timeoutMs, 'A');
    if (aRecords && aRecords.length > 0) {
      return { active: true, method: 'A_FALLBACK', records: aRecords };
    }
  } catch {}

  try {
    const aaaaRecords = await withTimeout(resolve6(domain), timeoutMs, 'AAAA');
    if (aaaaRecords && aaaaRecords.length > 0) {
      return { active: true, method: 'AAAA_FALLBACK', records: aaaaRecords };
    }
  } catch {}

  return {
    active: false,
    method: 'NONE',
    reason: `Domain "${domain}" has no MX, A, or AAAA records — likely does not exist`,
  };
};

/* ══════════════════════════════════════════════════════════════════
   FULL EMAIL VALIDATION PIPELINE
   ══════════════════════════════════════════════════════════════════ */

/**
 * Complete email validation — format + disposable check + DNS MX.
 * This is the PRIMARY function to call before registration.
 *
 * @param {string} email
 * @returns {Promise<{
 *   valid: boolean,
 *   reason?: string,
 *   code?: string,
 *   domain?: string,
 *   dnsMethod?: string
 * }>}
 */
export const validateEmailFull = async (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Email is required', code: 'MISSING_EMAIL' };
  }

  const normalised = email.trim().toLowerCase();

  if (!isValidEmailFormat(normalised)) {
    return { valid: false, reason: 'Invalid email format', code: 'INVALID_FORMAT' };
  }

  const domain = normalised.split('@')[1];

  const tldMatch = BLOCKED_TLDS.has(`.${domain.split('.').pop()}`);
  if (tldMatch) {
    return { valid: false, reason: 'Email domain uses a reserved or invalid TLD', code: 'BLOCKED_TLD', domain };
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, reason: 'Disposable or temporary email addresses are not allowed', code: 'DISPOSABLE_EMAIL', domain };
  }

  let dnsResult;
  try {
    dnsResult = await checkDomainMX(domain);
  } catch (err) {
    console.warn(`⚠️  Unexpected DNS error for ${domain}:`, err.message);
    dnsResult = { active: true, method: 'DNS_ERROR_OPEN', reason: err.message };
  }

  if (!dnsResult.active) {
    return { valid: false, reason: `The email domain "${domain}" does not appear to be active or able to receive emails`, code: 'INACTIVE_DOMAIN', domain };
  }

  return { valid: true, domain, dnsMethod: dnsResult.method };
};

/* ══════════════════════════════════════════════════════════════════
   PASSWORD VALIDATION
   ══════════════════════════════════════════════════════════════════ */

/**
 * Password strength check.
 * Rules: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char.
 *
 * @param {string} password
 * @returns {{ valid: boolean, reason?: string, strength?: 'weak'|'medium'|'strong' }}
 */
export const validatePasswordStrength = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, reason: 'Password is required', code: 'MISSING_PASSWORD' };
  }

  const checks = {
    length:    password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number:    /[0-9]/.test(password),
    special:   /[^a-zA-Z0-9]/.test(password),
  };

  const failed = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);

  if (failed.length > 0) {
    const messages = {
      length:    'at least 8 characters',
      uppercase: 'one uppercase letter',
      lowercase: 'one lowercase letter',
      number:    'one number',
      special:   'one special character',
    };
    return {
      valid:  false,
      reason: `Password must contain: ${failed.map((k) => messages[k]).join(', ')}`,
      code:   'WEAK_PASSWORD',
      failed,
    };
  }

  const passedCount = Object.values(checks).filter(Boolean).length;
  const strength = passedCount === 5 && password.length >= 12 ? 'strong'
    : passedCount >= 4 ? 'medium' : 'weak';

  return { valid: true, strength };
};

/* ══════════════════════════════════════════════════════════════════
   PASSWORD HASHING (argon2)
   ══════════════════════════════════════════════════════════════════ */

/**
 * Hash a plaintext password using argon2id.
 * @param {string} plainText
 * @returns {Promise<string>}
 */
export const hashPassword = async (plainText) => {
  return await argon2.hash(plainText);
};

/**
 * Verify a plaintext password against an argon2 hash.
 * @param {string} plainText
 * @param {string} hashedPassword
 * @returns {Promise<boolean>}
 */
export const verifyPassword = async (plainText, hashedPassword) => {
  try {
    return await argon2.verify(hashedPassword, plainText);
  } catch (err) {
    console.error('Password verification failed:', err.message);
    return false;
  }
};

/* ══════════════════════════════════════════════════════════════════
   HASH UTILITY  (used for oobCode tokens)
   ══════════════════════════════════════════════════════════════════ */

/**
 * SHA-256 hash of a string.
 * @param {string} input
 * @returns {Promise<string>}
 */
export const hashString = async (input) => {
  return crypto.createHash('sha256').update(input).digest('hex');
};

/* ══════════════════════════════════════════════════════════════════
   LEGACY COMPAT EXPORTS  (used in existing code)
   ══════════════════════════════════════════════════════════════════ */

export const isValidEmail = (email) => isValidEmailFormat(email);

export const isEmailDomainValid = async (email) => {
  const domain = email.split('@')[1];
  if (!domain) return { valid: false, reason: 'No domain found' };
  const result = await checkDomainMX(domain);
  return {
    valid:  result.active,
    reason: result.reason,
  };
};

export const isStrongPassword = (password) => {
  const r = validatePasswordStrength(password);
  return { valid: r.valid, message: r.reason };
};

/* ══════════════════════════════════════════════════════════════════
   DEFAULT EXPORT (bundle all functions)
   ══════════════════════════════════════════════════════════════════ */

export default {
  isValidEmailFormat,
  checkDomainMX,
  validateEmailFull,
  validatePasswordStrength,
  hashPassword,                 
  verifyPassword,               
  hashString,
  isValidEmail,                 // legacy
  isEmailDomainValid,           // legacy
  isStrongPassword,             // legacy
};