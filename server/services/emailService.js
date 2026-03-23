/**
 * services/emailService.js
 * ═══════════════════════════════════════════════════════════════════
 * Email delivery + all transactional templates for Damuchi.
 * Provider: Gmail via nodemailer (SMTP)
 *
 * .env vars required:
 *   SMTP_HOST=smtp.gmail.com          (optional, defaults below)
 *   SMTP_PORT=465                     (optional)
 *   SMTP_USER=you@gmail.com
 *   SMTP_PASS=your-app-password       ← Gmail App Password (not your login password)
 *   FRONTEND_URL=https://damuchi.app
 *   CONTACT_EMAIL=hello@damuchi.app
 *
 * EXPORTS
 * ───────────────────────────────────────────────────────────────────
 *  sendEmail                — generic nodemailer wrapper (internal)
 *  sendVerificationEmail    — generate link + store token + send
 *  sendApprovalEmail        — admin approved a guest
 *  sendAdminNotification    — guest verified, notify admins
 *  sendContactEmail         — contact form submission
 *  sendWelcomeEmail         — after successful registration
 *  sendVerificationReminder — resend verification link
 *  sendPasswordChangedEmail — security alert after password change
 *  sendQuoteDigest          — daily quote digest (job queue)
 * ═══════════════════════════════════════════════════════════════════
 */

import nodemailer         from 'nodemailer';
import { admin, adminDb, adminFirestore } from '../config/firebase.js';
import { hashString }     from '../utils/validator.js';
import { parseUserAgent } from '../utils/security.js';

/* ── transporter ─────────────────────────────────────────────────── */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host:    process.env.SMTP_HOST || 'smtp.gmail.com',
  port:    parseInt(process.env.SMTP_PORT || '465', 10),
  secure:  true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/* ── env shortcuts ───────────────────────────────────────────────── */
const APP_URL = process.env.FRONTEND_URL  || 'https://damuchi.app';
const CONTACT = process.env.CONTACT_EMAIL || 'hello@damuchi.app';
const FROM    = process.env.SMTP_USER;     // Gmail must send from the authed address

/* ── Firestore helpers ───────────────────────────────────────────── */
const serverTs  = () => admin.firestore.FieldValue.serverTimestamp();
const verColRef = () => adminFirestore.collection('emailVerifications');

/* ══════════════════════════════════════════════════════════════════
   DESIGN TOKENS  (inline email — no CSS classes)
   ══════════════════════════════════════════════════════════════════ */
const T = {
  navy:   '#0A0E1A',
  slate:  '#141924',
  dark:   '#0D1220',
  accent: '#F59E0B',
  orange: '#F97316',
  white:  '#ffffff',
  muted:  'rgba(255,255,255,0.5)',
  dim:    'rgba(255,255,255,0.25)',
  faint:  'rgba(255,255,255,0.12)',
};

/* ══════════════════════════════════════════════════════════════════
   SHARED HTML BUILDING BLOCKS
   ══════════════════════════════════════════════════════════════════ */

const emailShell = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="dark"/>
  <title>Damuchi</title>
</head>
<body style="margin:0;padding:0;background:${T.navy};
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
             -webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="max-width:580px;margin:0 auto;padding:40px 20px;">
    <tr><td>
      ${_logo()}
      ${content}
      ${_footer()}
    </td></tr>
  </table>
</body>
</html>`;

const _logo = () => `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="padding-right:10px;">
            <div style="width:38px;height:38px;border-radius:11px;
                        background:linear-gradient(135deg,${T.accent},${T.orange});
                        display:inline-flex;align-items:center;justify-content:center;
                        font-weight:900;font-size:17px;color:${T.navy};
                        line-height:1;text-align:center;">D</div>
          </td>
          <td>
            <span style="font-size:19px;font-weight:800;color:${T.white};
                         letter-spacing:-0.5px;line-height:1;">
              Damu<span style="color:${T.accent};">chi</span>
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

const _footer = () => `
<p style="margin:28px 0 0;font-size:11px;color:${T.dim};text-align:center;line-height:1.7;">
  © ${new Date().getFullYear()} Damuchi &nbsp;·&nbsp; Built with purpose in Nairobi 🇰🇪<br/>
  <a href="${APP_URL}/docs"   style="color:rgba(245,158,11,0.55);text-decoration:none;">Docs</a>
  &nbsp;·&nbsp;
  <a href="mailto:${CONTACT}" style="color:rgba(245,158,11,0.55);text-decoration:none;">Support</a>
  &nbsp;·&nbsp;
  <a href="${APP_URL}/guest"  style="color:rgba(245,158,11,0.55);text-decoration:none;">Unsubscribe</a>
</p>`;

const _card = (content, accent = T.accent) => `
<div style="background:${T.slate};border-radius:20px;
            border:1px solid rgba(255,255,255,0.08);overflow:hidden;
            box-shadow:0 16px 40px rgba(0,0,0,0.4);">
  <div style="height:3px;background:linear-gradient(to right,${accent},${accent}44,transparent);"></div>
  <div style="padding:36px 32px;">${content}</div>
</div>`;

const _cta = (label, href, accent = T.accent) => `
<a href="${href}"
   style="display:inline-block;
          background:linear-gradient(to right,${accent},${T.orange});
          color:${T.navy};font-size:14px;font-weight:700;
          padding:14px 28px;border-radius:14px;text-decoration:none;
          letter-spacing:0.01em;margin-top:4px;">
  ${label}
</a>`;

const _infoBox = (rows) => `
<div style="background:${T.dark};border-radius:14px;padding:20px;margin-bottom:24px;">
  ${rows.map(([label, value]) => `
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:${T.dim};
              text-transform:uppercase;letter-spacing:0.1em;">${label}</p>
    <p style="margin:0 0 12px;font-size:14px;color:${T.white};">${value}</p>
  `).join('')}
</div>`;

const _bullets = (items) => items.map(item => `
<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">
  <div style="width:5px;height:5px;border-radius:50%;background:${T.accent};flex-shrink:0;margin-top:1px;"></div>
  <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.5;">${item}</p>
</div>`).join('');

/* ══════════════════════════════════════════════════════════════════
   CORE SEND WRAPPER
   Non-throwing — callers should never fail because of an email error.
   ══════════════════════════════════════════════════════════════════ */

/**
 * @param {{ to: string|string[], subject: string, html: string,
 *            headers?: Object, replyTo?: string, tag?: string }} opts
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
const safeSend = async ({ to, subject, html, headers, replyTo, tag = 'email' }) => {
  try {
    const info = await transporter.sendMail({
      from:    FROM,
      to:      Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      ...(replyTo  && { replyTo }),
      ...(headers  && { headers }),
    });
    console.log(`[Email:${tag}] ✅ Sent → ${Array.isArray(to) ? to.join(', ') : to} (msgId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email:${tag}] ❌ Failed:`, err.message);
    return { success: false, error: err.message };
    // Never throw — email failure must never crash a request
  }
};

/**
 * Public alias — kept for backward-compat with any callers using sendEmail directly.
 * Throws on error (legacy behaviour).
 */
export const sendEmail = async ({ to, subject, html, headers }) => {
  const result = await safeSend({ to, subject, html, headers, tag: 'generic' });
  if (!result.success) throw new Error(`Email sending failed: ${result.error}`);
};

/* ══════════════════════════════════════════════════════════════════
   1. VERIFICATION EMAIL  (registration + resend flow)
   ══════════════════════════════════════════════════════════════════ */
export const sendVerificationEmail = async ({
  userId, email, name, ip, req, isResend = false,
}) => {
  // 1. Firebase generates the verification link (Admin SDK — server-side only)
  const verificationLink = await admin.auth().generateEmailVerificationLink(email, {
    url:             `${APP_URL}/auth/verify-email?uid=${userId}`,
    handleCodeInApp: true,
  });

  // 2. Extract oobCode → clean frontend URL
  const oobCode      = new URL(verificationLink).searchParams.get('oobCode');
  const frontendLink = oobCode
    ? `${APP_URL}/auth/verify-email?oobCode=${encodeURIComponent(oobCode)}&uid=${userId}&email=${encodeURIComponent(email)}`
    : verificationLink;

  // 3. Hash token + persist to Firestore
  const tokenHash = await hashString(oobCode);
  const recordId  = `${userId}_${Date.now()}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await verColRef().doc(recordId).set({
    id: recordId, userId, email,
    ip:       ip || null,
    token:    tokenHash,
    consumed: false,
    isResend,
    expiresAt,
    createdAt: serverTs(),
  });

  // 4. Send
  const userAgent = req?.headers?.['user-agent'] || 'Unknown';
  const device    = parseUserAgent(userAgent);

  console.log(`📧 Sending ${isResend ? 'resend ' : ''}verification to ${email} [${ip}]`);

  await safeSend({
    to:      email,
    subject: 'Verify your email — Damuchi',
    html:    _verificationHtml({ name, ip, device, link: frontendLink }),
    headers: { 'X-Mailer-Lite-track': 'false', Precedence: 'bulk' },
    tag:     'verify',
  });

  return { id: recordId, userId, email, expiresAt };
};

/* ══════════════════════════════════════════════════════════════════
   2. WELCOME EMAIL  — sent right after registration
   ══════════════════════════════════════════════════════════════════ */
export const sendWelcomeEmail = async ({ email, displayName }) => {
  const name = displayName?.trim() || 'there';

  const steps = [
    ['01', T.accent,  'Verify your email',    'Click the link we just sent to your inbox.'],
    ['02', '#818CF8', 'Await admin approval',  'An admin will review your account — usually within 24 h.'],
    ['03', '#34D399', 'Full access',           'Create, curate, and share your personal quote collection.'],
  ];

  return safeSend({
    to:      email,
    subject: '👋 Welcome to Damuchi — complete your setup',
    tag:     'welcome',
    html:    emailShell(_card(`
      <div style="font-size:36px;margin-bottom:20px;">👋</div>
      <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;color:${T.white};letter-spacing:-0.5px;">
        Welcome to Damuchi, ${name}!
      </h1>
      <p style="margin:0 0 20px;font-size:14px;color:${T.muted};line-height:1.65;">
        Your account has been created. Complete these steps to get full access:
      </p>
      <div style="background:${T.dark};border-radius:14px;padding:20px;margin-bottom:28px;">
        ${steps.map(([num, color, title, desc]) => `
        <div style="display:flex;gap:14px;margin-bottom:16px;align-items:flex-start;">
          <div style="width:28px;height:28px;border-radius:9px;flex-shrink:0;
                      background:${color}20;border:1px solid ${color}40;
                      display:flex;align-items:center;justify-content:center;
                      font-size:10px;font-weight:900;color:${color};margin-top:1px;">${num}</div>
          <div>
            <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:${T.white};">${title}</p>
            <p style="margin:0;font-size:12px;color:${T.muted};line-height:1.5;">${desc}</p>
          </div>
        </div>`).join('')}
      </div>
      ${_cta('Go to Damuchi →', `${APP_URL}/auth/verify-pending`)}
      <p style="margin:24px 0 0;font-size:12px;color:${T.dim};line-height:1.6;">
        Didn't register?
        <a href="mailto:${CONTACT}" style="color:${T.accent};text-decoration:none;">Contact support</a>.
      </p>
    `)),
  });
};

/* ══════════════════════════════════════════════════════════════════
   3. APPROVAL EMAIL  — admin approved a guest account
   ══════════════════════════════════════════════════════════════════ */
export const sendApprovalEmail = async ({ email, displayName }) => {
  const name = displayName?.trim() || 'there';

  return safeSend({
    to:      email,
    subject: '🎉 Your Damuchi account is approved!',
    tag:     'approval',
    html:    emailShell(_card(`
      <div style="font-size:36px;margin-bottom:20px;">🎉</div>
      <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;color:${T.white};letter-spacing:-0.5px;">
        You're approved, ${name}!
      </h1>
      <p style="margin:0 0 24px;font-size:14px;color:${T.muted};line-height:1.65;">
        Your account has been reviewed and approved. You now have full access to create,
        organise, and share your personal quote collection.
      </p>
      <div style="background:${T.dark};border-radius:14px;padding:20px;margin-bottom:28px;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:${T.dim};
                  text-transform:uppercase;letter-spacing:0.1em;">What's now unlocked</p>
        ${_bullets([
          '📚 Build and manage your personal quote library',
          '⚡ Create, edit and organise quotes by category',
          '⭐ Save and access your favourite quotes anytime',
          '📤 Auto-post to X and LinkedIn <em style="color:rgba(255,255,255,0.3);font-size:11px;">(coming soon)</em>',
        ])}
      </div>
      ${_cta('Sign in to Damuchi →', `${APP_URL}/auth/login`)}
      <p style="margin:24px 0 0;font-size:12px;color:${T.dim};line-height:1.6;">
        Didn't create this account?
        <a href="mailto:${CONTACT}" style="color:${T.accent};text-decoration:none;">Contact support</a>.
      </p>
    `)),
  });
};

/* ══════════════════════════════════════════════════════════════════
   4. ADMIN NOTIFICATION  — guest verified, pending approval
   ══════════════════════════════════════════════════════════════════ */
export const sendAdminNotification = async ({ adminEmails, newUser }) => {
  if (!adminEmails?.length) return { success: false, error: 'No admin emails provided' };

  return safeSend({
    to:      adminEmails,
    subject: `🔔 Approval needed: ${newUser.email}`,
    tag:     'admin-notify',
    html:    emailShell(_card(`
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <div style="width:44px;height:44px;border-radius:14px;
                    background:rgba(129,140,248,0.14);border:1px solid rgba(129,140,248,0.25);
                    display:flex;align-items:center;justify-content:center;
                    font-size:22px;flex-shrink:0;">🔔</div>
        <div>
          <h2 style="margin:0 0 3px;font-size:18px;font-weight:900;color:${T.white};">
            New approval request
          </h2>
          <p style="margin:0;font-size:12px;color:${T.muted};">
            A user verified their email and is awaiting approval.
          </p>
        </div>
      </div>
      ${_infoBox([
        ['Display Name', newUser.displayName || '<em style="color:rgba(255,255,255,0.3)">Not set</em>'],
        ['Email',        `<span style="color:${T.accent};">${newUser.email}</span>`],
        ['Registered',   newUser.createdAt
          ? new Date(newUser.createdAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })
          : 'Just now'],
      ])}
      ${_cta('Review in admin panel →', `${APP_URL}/admin?tab=queue`, '#818CF8')}
      <p style="margin:20px 0 0;font-size:12px;color:${T.dim};line-height:1.6;">
        Or view the
        <a href="${APP_URL}/admin/users/${newUser.uid || ''}" style="color:#818CF8;text-decoration:none;">
          direct user profile
        </a>.
      </p>
    `, '#818CF8')),
  });
};

/* ══════════════════════════════════════════════════════════════════
   5. CONTACT FORM EMAIL  — forwarded to CONTACT_EMAIL
   ══════════════════════════════════════════════════════════════════ */
export const sendContactEmail = async ({ name, email, topic, message }) => {
  return safeSend({
    to:      CONTACT,
    replyTo: email,
    subject: `[Damuchi Contact] ${topic || 'General'} — ${name}`,
    tag:     'contact',
    html:    emailShell(_card(`
      <div style="font-size:32px;margin-bottom:18px;">✉️</div>
      <h2 style="margin:0 0 6px;font-size:20px;font-weight:900;color:${T.white};">
        New contact message
      </h2>
      <p style="margin:0 0 22px;font-size:13px;color:${T.muted};">
        Submitted via the Damuchi contact form.
      </p>
      ${_infoBox([
        ['From',  `${name} &lt;<a href="mailto:${email}" style="color:${T.accent};text-decoration:none;">${email}</a>&gt;`],
        ['Topic', topic || 'General enquiry'],
      ])}
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${T.dim};
                text-transform:uppercase;letter-spacing:0.1em;">Message</p>
      <div style="background:${T.dark};border-radius:14px;padding:18px;margin-bottom:24px;
                  border-left:3px solid ${T.accent};">
        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.75);
                  line-height:1.7;white-space:pre-wrap;">${message}</p>
      </div>
      ${_cta(`Reply to ${name} →`, `mailto:${email}`)}
      <p style="margin:20px 0 0;font-size:11px;color:${T.dim};">
        Reply-To is set to the sender's address for one-click replies.
      </p>
    `)),
  });
};

/* ══════════════════════════════════════════════════════════════
   ADMIN WELCOME EMAIL
   Sent when seeded admin or existing admin creates a new admin.
   Includes temp password + next-steps + force-change warning.
══════════════════════════════════════════════════════════════ */
export const sendAdminWelcomeEmail = async ({ email, displayName, tempPassword, createdBy }) => {
  const name = displayName?.trim() || 'Admin';
 
  const html = emailShell(card(`
    <div style="font-size:36px;margin-bottom:20px;">🛡️</div>
 
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;
               color:${T.white};letter-spacing:-0.5px;">
      Welcome to the admin team, ${name}!
    </h1>
    <p style="margin:0 0 6px;font-size:13px;color:${T.muted};">
      Created by: <strong style="color:${T.white};">${createdBy || 'System Admin'}</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:${T.muted};line-height:1.65;">
      Your Damuchi admin account has been created. Use the credentials below to sign in.
    </p>
 
    ${infoBox([
      ['Email',             email],
      ['Temporary password', `<code style="background:rgba(255,255,255,0.08);padding:2px 8px;border-radius:6px;font-family:monospace;color:${T.accent};">${tempPassword}</code>`],
    ])}
 
    <div style="background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.25);
                border-radius:14px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#fca5a5;line-height:1.6;">
        <strong>⚠️ You must change your password on first login.</strong><br/>
        Full admin access is restricted until the password is changed.
        This temporary password will work only once.
      </p>
    </div>
 
    <div style="background:${T.dark};border-radius:14px;padding:20px;margin-bottom:28px;">
      <p style="margin:0 0 12px;font-size:11px;font-weight:700;
                color:${T.dim};text-transform:uppercase;letter-spacing:0.1em;">Your admin capabilities</p>
      ${bulletList([
        '👥 Manage and approve user accounts',
        '🔐 Grant or revoke write permissions',
        '📊 View system statistics and audit logs',
        '✍️ Create, edit and delete all quotes',
        '🔔 Receive approval notifications',
      ])}
    </div>
 
    ${ctaButton('Sign in & change password →', `${APP_URL}/auth/login`)}
 
    <p style="margin:24px 0 0;font-size:12px;color:${T.dim};line-height:1.6;">
      Didn't expect this email?
      <a href="mailto:${CONTACT}" style="color:${T.accent};text-decoration:none;">Contact support</a>.
    </p>
  `, '#818CF8'));
 
  return safeSend({
    to:      email,
    subject: '🛡️ Your Damuchi admin account is ready',
    html,
    tag:     'admin-welcome',
  });
};
 
/* ══════════════════════════════════════════════════════════════
   USER CREATED BY ADMIN EMAIL
   Sent when admin creates a pre-approved user account.
══════════════════════════════════════════════════════════════ */
export const sendUserCreatedEmail = async ({ email, displayName, tempPassword }) => {
  const name = displayName?.trim() || 'there';
 
  const html = emailShell(card(`
    <div style="font-size:36px;margin-bottom:20px;">🎉</div>
 
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;
               color:${T.white};letter-spacing:-0.5px;">
      Your account is ready, ${name}!
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:${T.muted};line-height:1.65;">
      A Damuchi admin has created an account for you. You have full member access from day one.
    </p>
 
    ${infoBox([
      ['Email',             email],
      ['Temporary password', `<code style="background:rgba(255,255,255,0.08);padding:2px 8px;border-radius:6px;font-family:monospace;color:${T.accent};">${tempPassword}</code>`],
    ])}
 
    <div style="background:${T.dark};border-radius:14px;padding:20px;margin-bottom:28px;">
      <p style="margin:0 0 12px;font-size:11px;font-weight:700;
                color:${T.dim};text-transform:uppercase;letter-spacing:0.1em;">What's waiting for you</p>
      ${bulletList([
        '📚 Build your personal quote library',
        '⭐ Save and organise your favourites',
        '✍️ Create and share your own quotes',
        '📤 Auto-post to X and LinkedIn (coming soon)',
      ])}
    </div>
 
    ${ctaButton('Sign in to Damuchi →', `${APP_URL}/auth/login`)}
 
    <p style="margin:24px 0 0;font-size:12px;color:${T.dim};">
      We recommend changing your password after first sign-in.
    </p>
  `));
 
  return safeSend({
    to:      email,
    subject: '🎉 Your Damuchi account is ready — sign in now',
    html,
    tag:     'user-created',
  });
};

/* ══════════════════════════════════════════════════════════════════
   6. VERIFICATION REMINDER  — resend the verify link
   ══════════════════════════════════════════════════════════════════ */
export const sendVerificationReminder = async ({ email, displayName, verificationLink }) => {
  const name = displayName?.trim() || 'there';
  const link = verificationLink || `${APP_URL}/auth/verify-pending`;

  return safeSend({
    to:      email,
    subject: '📧 Verify your Damuchi email address',
    tag:     'verify-reminder',
    html:    emailShell(_card(`
      <div style="font-size:36px;margin-bottom:20px;">📧</div>
      <h1 style="margin:0 0 10px;font-size:22px;font-weight:900;color:${T.white};letter-spacing:-0.5px;">
        Verify your email, ${name}
      </h1>
      <p style="margin:0 0 10px;font-size:14px;color:${T.muted};line-height:1.65;">
        Click the button below to confirm your address and continue your registration.
      </p>
      <p style="margin:0 0 24px;font-size:13px;color:rgba(245,158,11,0.65);">
        ⚠️ This link expires in <strong style="color:${T.accent};">24 hours</strong>.
      </p>
      ${_cta('Verify my email →', link)}
      <div style="background:${T.dark};border-radius:12px;padding:16px;margin-top:24px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:${T.dim};
                  text-transform:uppercase;letter-spacing:0.1em;">Button not working?</p>
        <p style="margin:0;font-size:11px;color:${T.dim};word-break:break-all;line-height:1.5;">
          Copy and paste this URL:<br/>
          <a href="${link}" style="color:${T.accent};text-decoration:none;">${link}</a>
        </p>
      </div>
      <p style="margin:20px 0 0;font-size:12px;color:${T.dim};line-height:1.6;">
        Didn't request this?
        <a href="mailto:${CONTACT}" style="color:${T.accent};text-decoration:none;">Contact support</a>.
      </p>
    `)),
  });
};

/* ══════════════════════════════════════════════════════════════════
   7. PASSWORD CHANGED  — security alert
   ══════════════════════════════════════════════════════════════════ */
export const sendPasswordChangedEmail = async ({ email, displayName, ip, userAgent }) => {
  const name = displayName?.trim() || 'there';
  const time = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });

  return safeSend({
    to:      email,
    subject: '🔐 Your Damuchi password was changed',
    tag:     'password-changed',
    html:    emailShell(_card(`
      <div style="font-size:36px;margin-bottom:20px;">🔐</div>
      <h1 style="margin:0 0 10px;font-size:22px;font-weight:900;color:${T.white};letter-spacing:-0.5px;">
        Password changed, ${name}
      </h1>
      <p style="margin:0 0 20px;font-size:14px;color:${T.muted};line-height:1.65;">
        Your password was successfully updated. All other active sessions have been
        signed out for your security.
      </p>
      ${_infoBox([
        ['Time',       time],
        ['IP address', ip        || 'Unknown'],
        ['Device',     userAgent ? userAgent.split('(')[0].trim() : 'Unknown'],
      ])}
      <div style="background:rgba(248,113,113,0.08);border-radius:14px;
                  border:1px solid rgba(248,113,113,0.2);padding:18px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:rgba(248,113,113,0.85);line-height:1.6;">
          <strong>Wasn't you?</strong> Your account may be compromised.
          <a href="${APP_URL}/auth/reset-password"
             style="color:#f87171;font-weight:700;text-decoration:underline;">
            Reset your password immediately
          </a>
          and contact support.
        </p>
      </div>
      ${_cta('Sign in to Damuchi →', `${APP_URL}/auth/login`)}
    `, '#818CF8')),
  });
};

/* ══════════════════════════════════════════════════════════════
   9. PASSWORD RESET EMAIL  — sent by forgotPassword controller
      Params: { email, displayName, resetLink, ip }
══════════════════════════════════════════════════════════════ */
export const sendPasswordResetEmail = async ({ email, displayName, resetLink, ip }) => {
  const name = displayName?.trim() || 'there';

  return safeSend({
    to:      email,
    subject: '🔑 Reset your Damuchi password',
    tag:     'password-reset',
    html:    emailShell(_card(`
      <div style="font-size:36px;margin-bottom:20px;">🔑</div>
      <h1 style="margin:0 0 10px;font-size:22px;font-weight:900;
                 color:${T.white};letter-spacing:-0.5px;">
        Reset your password, ${name}
      </h1>
      <p style="margin:0 0 10px;font-size:14px;color:${T.muted};line-height:1.65;">
        We received a request to reset the password for your Damuchi account.
        Click the button below to choose a new password.
      </p>
      <p style="margin:0 0 24px;font-size:13px;color:rgba(245,158,11,0.65);">
        ⚠️ This link expires in
        <strong style="color:${T.accent};">15 minutes</strong>
        and can only be used once.
      </p>
      ${_infoBox([
        ['Requested from', ip || 'Unknown'],
      ])}
      ${_cta('Reset my password →', resetLink)}
      <div style="background:${T.dark};border-radius:12px;padding:16px;margin-top:24px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:${T.dim};
                  text-transform:uppercase;letter-spacing:0.1em;">Button not working?</p>
        <p style="margin:0;font-size:11px;color:${T.dim};word-break:break-all;line-height:1.5;">
          Copy and paste this URL:<br/>
          <a href="${resetLink}" style="color:${T.accent};text-decoration:none;">${resetLink}</a>
        </p>
      </div>
      <div style="background:rgba(248,113,113,0.08);border-radius:14px;
                  border:1px solid rgba(248,113,113,0.18);padding:16px;margin-top:16px;">
        <p style="margin:0;font-size:12px;color:rgba(248,113,113,0.8);line-height:1.6;">
          Didn't request this? You can safely ignore this email — your password won't change
          unless you click the link above.
        </p>
      </div>
    `)),
  });
};

/* ══════════════════════════════════════════════════════════════════
   8. QUOTE DIGEST  — daily email (called by job queue)
   ══════════════════════════════════════════════════════════════════ */
export const sendQuoteDigest = async ({ email, displayName, quotes = [] }) => {
  const name     = displayName?.trim() || 'there';
  const topThree = quotes.slice(0, 3);
  if (!topThree.length) return { success: false, error: 'No quotes to send' };

  const CAT_COLOR = {
    motivation: '#F59E0B', mindset: '#818CF8', discipline: '#34D399',
    success:    '#A78BFA', resilience: '#FB923C',
  };

  const quoteCards = topThree.map(q => {
    const color = CAT_COLOR[q.category] || T.accent;
    return `
    <div style="background:${T.dark};border-radius:14px;padding:18px;
                margin-bottom:12px;border-left:3px solid ${color};">
      <p style="margin:0 0 8px;font-size:9px;font-weight:700;color:${color};
                text-transform:uppercase;letter-spacing:0.12em;">
        ${q.category || 'inspiration'}
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:rgba(255,255,255,0.8);
                line-height:1.65;font-style:italic;">"${q.text}"</p>
      <p style="margin:0;font-size:11px;font-weight:700;color:${color};
                text-transform:uppercase;letter-spacing:0.1em;">— ${q.author}</p>
    </div>`;
  }).join('');

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const shortDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return safeSend({
    to:      email,
    subject: `✨ Your daily Damuchi inspiration — ${shortDate}`,
    tag:     'digest',
    html:    emailShell(_card(`
      <div style="font-size:32px;margin-bottom:16px;">✨</div>
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:900;color:${T.white};letter-spacing:-0.5px;">
        Daily inspiration, ${name}
      </h1>
      <p style="margin:0 0 22px;font-size:13px;color:${T.muted};">${dateStr}</p>
      ${quoteCards}
      ${_cta('Read more quotes →', `${APP_URL}/quotes`)}
      <p style="margin:20px 0 0;font-size:11px;color:${T.dim};">
        You're receiving this because you're a Damuchi member.
        <a href="${APP_URL}/guest" style="color:${T.dim};text-decoration:underline;">Unsubscribe</a>.
      </p>
    `)),
  });
};

/* ══════════════════════════════════════════════════════════════════
   VERIFICATION EMAIL TEMPLATE  (internal — used by sendVerificationEmail)
   ══════════════════════════════════════════════════════════════════ */
function _verificationHtml({ name, ip, device, link }) {
  return emailShell(_card(`
    <div style="font-size:36px;margin-bottom:20px;">📧</div>
    <h1 style="margin:0 0 10px;font-size:22px;font-weight:900;color:${T.white};letter-spacing:-0.5px;">
      Verify your email, ${name}
    </h1>
    <p style="margin:0 0 12px;font-size:14px;color:${T.muted};line-height:1.65;">
      We received a sign-up request for your account. Click below to verify your email
      address and complete registration.
    </p>
    <p style="margin:0 0 24px;font-size:13px;color:rgba(245,158,11,0.65);">
      ⚠️ This link expires in <strong style="color:${T.accent};">24 hours</strong>.
    </p>
    ${_infoBox([
      ['IP address', ip     || 'Unknown'],
      ['Device',     device || 'Unknown'],
    ])}
    ${_cta('Verify my email →', link)}
    <div style="background:${T.dark};border-radius:12px;padding:16px;margin-top:24px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:${T.dim};
                text-transform:uppercase;letter-spacing:0.1em;">Button not working?</p>
      <p style="margin:0;font-size:11px;color:${T.dim};word-break:break-all;line-height:1.5;">
        Copy and paste this URL:<br/>
        <a href="${link}" style="color:${T.accent};text-decoration:none;">${link}</a>
      </p>
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:${T.dim};line-height:1.6;">
      If you didn't request this, you can safely ignore this email.
      Your account won't be created until verification is complete.
    </p>
  `));
}