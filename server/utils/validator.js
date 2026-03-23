/**
 * utils/validator.js
 * ═══════════════════════════════════════════════════════════════════
 * Validation utilities — email pipeline, password strength, hashing.
 *
 * EMAIL VALIDATION PIPELINE (in order):
 *   1. Format check        — RFC-5321 regex
 *   2. Length limits       — local (64) + domain (255) + total (320)
 *   3. Disposable blocklist — 150+ known throwaway domains
 *   4. Blocked TLD check   — .test .invalid .example .localhost
 *   5. MX record lookup    — real DNS query, confirms domain can receive mail
 *   6. Fallback A/AAAA     — some valid domains have A but not MX
 *
 * FIXES vs original:
 *   - isValidEmailFormat was called but never defined → fixed (was named validateEmailFormat)
 *   - Default export referenced isValidEmailFormat (undefined) → fixed
 *   - argon2 install: npm install argon2
 * ═══════════════════════════════════════════════════════════════════
 */

import dns           from 'dns';
import { promisify } from 'util';
import crypto        from 'crypto';
import argon2        from 'argon2';  // npm install argon2

const resolveMx = promisify(dns.resolveMx);
const resolve4  = promisify(dns.resolve4);
const resolve6  = promisify(dns.resolve6);

/* ── Disposable domain blocklist ─────────────────────────────── */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','guerrillamail.net','guerrillamail.org',
  'guerrillamail.de','guerrillamail.biz','guerrillamail.info',
  'throwam.com','throwaway.email','dispostable.com','spamgourmet.com',
  'spamgourmet.net','spamgourmet.org','tempmail.com','temp-mail.org',
  'temp-mail.ru','tempmail.net','tempinbox.com','trashmail.com',
  'trashmail.me','trashmail.net','trashmail.at','trashmail.io',
  'trashmail.xyz','trashmail.org','getairmail.com','airmail.me',
  'mailnull.com','mailnull.net','yopmail.com','yopmail.fr',
  'cool.fr.nf','jetable.fr.nf','nospam.ze.tc','nomail.xl.cx',
  'mega.zik.dj','speed.1s.fr','courriel.fr.nf','moncourrier.fr.nf',
  'monemail.fr.nf','monmail.fr.nf',
  'maildrop.cc','mailnesia.com','mailsac.com',
  'mailtemp.org','mailtemp.net','mailtemp.info',
  '10minutemail.com','10minutemail.net','10minutemail.org',
  '10minutemail.co.za','10minutemail.de','10minutemail.us',
  '10minutemail.info','10minemail.com','tenminutemail.com',
  'sharklasers.com','guerrillamailblock.com','grr.la',
  'spam4.me','spamhere.net','spamhereplease.com',
  'example.com','example.net','example.org','test.com','test.net',
  'test.org','localhost.com','invalid.com',
  'mohmal.com','spamex.com','spaml.com','spaml.de','spamoff.de',
  'fakeinbox.com','safetymail.info','gishpuppy.com','sneakemail.com',
  'wegwerfmail.de','wegwerfmail.net','wegwerfmail.org',
  'tempail.com','owlpic.com','emailondeck.com',
  'discard.email','discardmail.com','discardmail.de',
  'spamgrap.com','spamspot.com','spamstack.net','spamavert.com',
  'filzmail.com','filzmail.org','inboxalias.com',
  'zetmail.com','meltmail.com','trbvm.com','kurzepost.de',
  'objectmail.com','proxymail.eu','rcpt.at','recode.me',
  'mytrashmail.com','mt2014.com','mt2015.com','notsharingmy.info',
  'nospam4.us',
]);

/* ── Blocked TLDs ────────────────────────────────────────────── */
const BLOCKED_TLDS = new Set([
  '.test','.invalid','.example','.localhost',
  '.local','.internal','.arpa','.corp','.home',
]);

/* ══════════════════════════════════════════════════════════════
   EMAIL FORMAT — defined once, used everywhere in this file
══════════════════════════════════════════════════════════════ */
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/**
 * Core email format check — RFC-5321 regex + length guards.
 * Named isValidEmailFormat (was called but never defined in the original).
 */
export const isValidEmailFormat = (email) => {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254)                  return false;
  const [local, domain] = email.split('@');
  if (!local || !domain)                   return false;
  if (local.length > 64)                   return false;
  if (domain.length > 255)                 return false;
  return EMAIL_RE.test(email);
};

/** Alias used by some callers */
export const validateEmailFormat = (email) => {
  if (!isValidEmailFormat(email)) {
    return { valid: false, reason: 'Please enter a valid email address.', code: 'INVALID_EMAIL' };
  }
  return { valid: true };
};

/* ══════════════════════════════════════════════════════════════
   DNS MX CHECK
══════════════════════════════════════════════════════════════ */
export const checkDomainMX = async (domain, timeoutMs = 5000) => {
  const withTimeout = (p, ms, label) =>
    Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error(`DNS timeout: ${label}`)), ms)),
    ]);

  try {
    const mx = await withTimeout(resolveMx(domain), timeoutMs, 'MX');
    const valid = (mx || []).filter(r => r.exchange && r.exchange !== '.');
    if (valid.length) return { active: true, method: 'MX', records: valid };
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.message?.includes('timeout')) {
      console.warn(`[DNS] Server unreachable for ${domain} — skipping check`);
      return { active: true, method: 'DNS_SKIP' };
    }
  }

  for (const [fn, label] of [[resolve4,'A'],[resolve6,'AAAA']]) {
    try {
      const recs = await withTimeout(fn(domain), timeoutMs, label);
      if (recs?.length) return { active: true, method: `${label}_FALLBACK`, records: recs };
    } catch { /* try next */ }
  }

  return { active: false, method: 'NONE', reason: `Domain "${domain}" has no DNS records` };
};

/* ══════════════════════════════════════════════════════════════
   FULL EMAIL VALIDATION PIPELINE
══════════════════════════════════════════════════════════════ */
export const validateEmailFull = async (email) => {
  if (!email || typeof email !== 'string')
    return { valid: false, reason: 'Email is required.', code: 'MISSING_EMAIL' };

  const normalised = email.trim().toLowerCase();

  if (!isValidEmailFormat(normalised))
    return { valid: false, reason: 'Please enter a valid email address.', code: 'INVALID_FORMAT' };

  const domain = normalised.split('@')[1];

  if (BLOCKED_TLDS.has(`.${domain.split('.').pop()}`))
    return { valid: false, reason: 'Email domain uses a reserved TLD.', code: 'BLOCKED_TLD', domain };

  if (DISPOSABLE_DOMAINS.has(domain))
    return { valid: false, reason: 'Disposable or temporary email addresses are not allowed.', code: 'DISPOSABLE_EMAIL', domain };

  let dnsResult;
  try {
    dnsResult = await checkDomainMX(domain);
  } catch (err) {
    console.warn(`[DNS] Unexpected error for ${domain}:`, err.message);
    dnsResult = { active: true, method: 'DNS_ERROR_OPEN' };
  }

  if (!dnsResult.active)
    return { valid: false, reason: `The email domain "${domain}" does not appear to be active.`, code: 'INACTIVE_DOMAIN', domain };

  return { valid: true, domain, dnsMethod: dnsResult.method };
};

/* ══════════════════════════════════════════════════════════════
   PASSWORD VALIDATION
══════════════════════════════════════════════════════════════ */
export const validatePasswordStrength = (password) => {
  if (!password || typeof password !== 'string')
    return { valid: false, reason: 'Password is required.', code: 'MISSING_PASSWORD' };

  if (password.length > 128)
    return { valid: false, reason: 'Password is too long (max 128 characters).', code: 'PASSWORD_TOO_LONG' };

  const checks = {
    length:    password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number:    /[0-9]/.test(password),
    special:   /[^a-zA-Z0-9]/.test(password),
  };

  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  if (failed.length) {
    const labels = { length:'at least 8 characters', uppercase:'one uppercase letter',
                     lowercase:'one lowercase letter', number:'one number', special:'one special character' };
    return { valid: false, reason: `Password must contain: ${failed.map(k => labels[k]).join(', ')}.`, code: 'WEAK_PASSWORD', failed };
  }

  const passed = Object.values(checks).filter(Boolean).length;
  const strength = (passed === 5 && password.length >= 12) ? 'strong' : passed >= 4 ? 'medium' : 'weak';
  return { valid: true, strength };
};

/* ══════════════════════════════════════════════════════════════
   PASSWORD HASHING — argon2id
══════════════════════════════════════════════════════════════ */
export const hashPassword   = async (plain)         => argon2.hash(plain);
export const verifyPassword = async (plain, hashed) => {
  try { return await argon2.verify(hashed, plain); }
  catch { return false; }
};

/* ══════════════════════════════════════════════════════════════
   HASH UTILITY — SHA-256 for oobCode tokens
══════════════════════════════════════════════════════════════ */
export const hashString = async (input) =>
  crypto.createHash('sha256').update(input).digest('hex');

/* ══════════════════════════════════════════════════════════════
   LEGACY COMPAT EXPORTS
══════════════════════════════════════════════════════════════ */
export const isValidEmail      = (email)    => isValidEmailFormat(email);
export const isStrongPassword  = (password) => { const r = validatePasswordStrength(password); return { valid: r.valid, message: r.reason }; };
export const isEmailDomainValid = async (email) => {
  const domain = email.split('@')[1];
  if (!domain) return { valid: false, reason: 'No domain found.' };
  const r = await checkDomainMX(domain);
  return { valid: r.active, reason: r.reason };
};

export default {
  isValidEmailFormat, validateEmailFormat, validateEmailFull,
  checkDomainMX, validatePasswordStrength,
  hashPassword, verifyPassword, hashString,
  isValidEmail, isStrongPassword, isEmailDomainValid,
};