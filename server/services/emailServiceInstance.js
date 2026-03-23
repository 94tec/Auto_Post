/**
 * services/emailServiceInstance.js
 * ═══════════════════════════════════════════════════════════════
 * All transactional emails for Damuchi.
 * Provider: Resend (https://resend.com)  → npm install resend
 *
 * .env vars required:
 *   RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
 *   EMAIL_FROM=Damuchi <noreply@damuchi.app>
 *   CLIENT_URL=https://damuchi.app
 *   CONTACT_EMAIL=hello@damuchi.app   ← where contact forms land
 *
 * EXPORTS
 * ───────────────────────────────────────────────────────────────
 *  sendApprovalEmail        → admin approved a guest
 *  sendAdminNotification    → guest verified email, notify admins
 *  sendContactEmail         → contact form submission
 *  sendWelcomeEmail         → after successful registration
 *  sendVerificationReminder → resend email verification link
 *  sendPasswordChangedEmail → after password change
 *  sendQuoteDigest          → daily quote digest (job queue)
 * ═══════════════════════════════════════════════════════════════
 */

import { Resend } from 'resend';

const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = process.env.EMAIL_FROM    || 'Damuchi <noreply@damuchi.app>';
const APP_URL = process.env.CLIENT_URL    || 'https://damuchi.app';
const CONTACT = process.env.CONTACT_EMAIL || 'hello@damuchi.app';

/* ── shared design tokens ─────────────────────────────────── */
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

/* ── shared wrappers ─────────────────────────────────────── */
const emailShell = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="dark"/>
  <title>Damuchi</title>
</head>
<body style="margin:0;padding:0;background:${T.navy};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="max-width:580px;margin:0 auto;padding:40px 20px;">
    <tr><td>

      ${logo()}
      ${content}
      ${footer()}

    </td></tr>
  </table>
</body>
</html>`;

const logo = () => `
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

const footer = () => `
<p style="margin:28px 0 0;font-size:11px;color:${T.dim};text-align:center;line-height:1.7;">
  © ${new Date().getFullYear()} Damuchi &nbsp;·&nbsp; Built with purpose in Nairobi 🇰🇪
  <br/>
  <a href="${APP_URL}/docs"   style="color:rgba(245,158,11,0.55);text-decoration:none;">Documentation</a>
  &nbsp;·&nbsp;
  <a href="mailto:${CONTACT}" style="color:rgba(245,158,11,0.55);text-decoration:none;">Support</a>
  &nbsp;·&nbsp;
  <a href="${APP_URL}/guest"  style="color:rgba(245,158,11,0.55);text-decoration:none;">Unsubscribe</a>
</p>`;

const card = (content, accent = T.accent) => `
<div style="background:${T.slate};border-radius:20px;
            border:1px solid rgba(255,255,255,0.08);overflow:hidden;
            box-shadow:0 16px 40px rgba(0,0,0,0.4);">
  <div style="height:3px;background:linear-gradient(to right,${accent},${accent}44,transparent);"></div>
  <div style="padding:36px 32px;">
    ${content}
  </div>
</div>`;

const ctaButton = (label, href, accent = T.accent) => `
<a href="${href}"
   style="display:inline-block;
          background:linear-gradient(to right,${accent},${T.orange});
          color:${T.navy};font-size:14px;font-weight:700;
          padding:14px 28px;border-radius:14px;
          text-decoration:none;letter-spacing:0.01em;
          margin-top:4px;">
  ${label}
</a>`;

const infoBox = (rows) => `
<div style="background:${T.dark};border-radius:14px;padding:20px;margin-bottom:24px;">
  ${rows.map(([label, value]) => `
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;
            color:${T.dim};text-transform:uppercase;letter-spacing:0.1em;">${label}</p>
  <p style="margin:0 0 12px;font-size:14px;color:${T.white};">${value}</p>
  `).join('')}
</div>`;

const bulletList = (items) => items.map(item => `
<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">
  <div style="width:5px;height:5px;border-radius:50%;
              background:${T.accent};flex-shrink:0;margin-top:1px;"></div>
  <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.5;">${item}</p>
</div>`).join('');

/* ── safe send wrapper ─────────────────────────────────────── */
const safeSend = async ({ to, subject, html, tag }) => {
  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) throw new Error(error.message);
    console.log(`[Email:${tag}] Sent to ${Array.isArray(to) ? to.join(', ') : to} → id: ${data?.id}`);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error(`[Email:${tag}] Failed:`, err.message);
    return { success: false, error: err.message };
    // Never throw — callers should not fail because of email
  }
};

/* ══════════════════════════════════════════════════════════════
   1. APPROVAL EMAIL
   Sent to user when admin approves their account.
   ══════════════════════════════════════════════════════════════ */
export const sendApprovalEmail = async ({ email, displayName }) => {
  const name = displayName?.trim() || 'there';

  const html = emailShell(card(`
    <div style="font-size:36px;margin-bottom:20px;">🎉</div>

    <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;
               color:${T.white};letter-spacing:-0.5px;">
      You're approved, ${name}!
    </h1>

    <p style="margin:0 0 24px;font-size:14px;color:${T.muted};line-height:1.65;">
      Your Damuchi account has been reviewed and approved. You now have
      full access to create, organise, and share your personal quote collection.
    </p>

    <div style="background:${T.dark};border-radius:14px;padding:20px;margin-bottom:28px;">
      <p style="margin:0 0 12px;font-size:11px;font-weight:700;
                color:${T.dim};text-transform:uppercase;letter-spacing:0.1em;">
        What's now unlocked
      </p>
      ${bulletList([
        '📚 Build and manage your personal quote library',
        '⚡ Create, edit and organise quotes by category',
        '⭐ Save and access your favourite quotes anytime',
        '📤 Auto-post to X and LinkedIn <em style="color:${T.dim};font-size:11px;">(coming soon)</em>',
      ])}
    </div>

    ${ctaButton('Sign in to Damuchi →', `${APP_URL}/auth/login`)}

    <p style="margin:24px 0 0;font-size:12px;color:${T.dim};line-height:1.6;">
      Didn't create this account?
      <a href="mailto:${CONTACT}" style="color:${T.accent};text-decoration:none;">Contact support</a>.
    </p>
  `));

  return safeSend({ to: email, subject: '🎉 Your Damuchi account is approved!', html, tag: 'approval' });
};

/* ══════════════════════════════════════════════════════════════
   2. ADMIN NOTIFICATION
   Sent to all admins when a guest verifies their email.
   ══════════════════════════════════════════════════════════════ */
export const sendAdminNotification = async ({ adminEmails, newUser }) => {
  if (!adminEmails?.length) return { success: false, error: 'No admin emails provided' };

  const html = emailShell(card(`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
      <div style="width:44px;height:44px;border-radius:14px;
                  background:rgba(129,140,248,0.14);
                  border:1px solid rgba(129,140,248,0.25);
                  display:flex;align-items:center;justify-content:center;
                  font-size:22px;flex-shrink:0;">🔔</div>
      <div>
        <h2 style="margin:0 0 3px;font-size:18px;font-weight:900;color:${T.white};">
          New approval request
        </h2>
        <p style="margin:0;font-size:12px;color:${T.muted};">
          A user verified their email and is awaiting your approval.
        </p>
      </div>
    </div>

    ${infoBox([
      ['Display Name', newUser.displayName || '<em style="color:rgba(255,255,255,0.3)">Not set</em>'],
      ['Email',        `<span style="color:${T.accent};">${newUser.email}</span>`],
      ['Registered',   newUser.createdAt ? new Date(newUser.createdAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }) : 'Just now'],
    ])}

    ${ctaButton('Review in admin panel →', `${APP_URL}/admin?tab=queue`, '#818CF8')}

    <p style="margin:20px 0 0;font-size:12px;color:${T.dim};line-height:1.6;">
      You can also review via
      <a href="${APP_URL}/admin/users/${newUser.uid || ''}" style="color:#818CF8;text-decoration:none;">
        direct user profile
      </a>.
    </p>
  `, '#818CF8'));

  return safeSend({
    to:      adminEmails,
    subject: `🔔 Approval needed: ${newUser.email}`,
    html,
    tag:     'admin-notify',
  });
};

/* ══════════════════════════════════════════════════════════════
   3. CONTACT FORM EMAIL
   Forwarded to CONTACT_EMAIL when a user submits the contact form.
   ══════════════════════════════════════════════════════════════ */
export const sendContactEmail = async ({ name, email, topic, message }) => {
  const html = emailShell(card(`
    <div style="font-size:32px;margin-bottom:18px;">✉️</div>

    <h2 style="margin:0 0 6px;font-size:20px;font-weight:900;color:${T.white};">
      New contact message
    </h2>
    <p style="margin:0 0 22px;font-size:13px;color:${T.muted};">
      Submitted via the Damuchi contact form.
    </p>

    ${infoBox([
      ['From',  `${name} &lt;<a href="mailto:${email}" style="color:${T.accent};text-decoration:none;">${email}</a>&gt;`],
      ['Topic', topic || 'General enquiry'],
    ])}

    <p style="margin:0 0 8px;font-size:11px;font-weight:700;
              color:${T.dim};text-transform:uppercase;letter-spacing:0.1em;">Message</p>
    <div style="background:${T.dark};border-radius:14px;padding:18px;margin-bottom:24px;
                border-left:3px solid ${T.accent};">
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.75);
                line-height:1.7;white-space:pre-wrap;">${message}</p>
    </div>

    ${ctaButton(`Reply to ${name} →`, `mailto:${email}`)}

    <p style="margin:20px 0 0;font-size:11px;color:${T.dim};">
      Reply-To is set to the sender's email for one-click replies.
    </p>
  `));

  return safeSend({
    to:       CONTACT,
    replyTo:  email,
    subject:  `[Damuchi Contact] ${topic || 'General'} — ${name}`,
    html,
    tag:      'contact',
  });
};

/* ══════════════════════════════════════════════════════════════
   4. WELCOME EMAIL
   Sent immediately after a new user registers successfully.
   ══════════════════════════════════════════════════════════════ */
export const sendWelcomeEmail = async ({ email, displayName }) => {
  const name = displayName?.trim() || 'there';

  const html = emailShell(card(`
    <div style="font-size:36px;margin-bottom:20px;">👋</div>

    <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;
               color:${T.white};letter-spacing:-0.5px;">
      Welcome to Damuchi, ${name}!
    </h1>

    <p style="margin:0 0 20px;font-size:14px;color:${T.muted};line-height:1.65;">
      Your account has been created. Before you can access the full platform,
      you need to complete two quick steps:
    </p>

    <div style="background:${T.dark};border-radius:14px;padding:20px;margin-bottom:28px;">
      ${[
        ['01', T.accent,   'Verify your email',   'Click the verification link we just sent to your inbox.'],
        ['02', '#818CF8',  'Await admin approval', 'Once verified, an admin will review and approve your account. Usually within 24 hours.'],
        ['03', '#34D399',  'Full access',          'Create, curate, and share your personal quote collection.'],
      ].map(([num, color, title, desc]) => `
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

    ${ctaButton('Go to Damuchi →', `${APP_URL}/auth/verify-pending`)}

    <p style="margin:24px 0 0;font-size:12px;color:${T.dim};line-height:1.6;">
      Didn't register?
      <a href="mailto:${CONTACT}" style="color:${T.accent};text-decoration:none;">Contact support</a>.
    </p>
  `));

  return safeSend({ to: email, subject: '👋 Welcome to Damuchi — complete your setup', html, tag: 'welcome' });
};

/* ══════════════════════════════════════════════════════════════
   5. VERIFICATION REMINDER
   Sent when user requests a resend of the verification email.
   Includes the actual Firebase verification link.
   ══════════════════════════════════════════════════════════════ */
export const sendVerificationReminder = async ({ email, displayName, verificationLink }) => {
  const name = displayName?.trim() || 'there';

  const html = emailShell(card(`
    <div style="font-size:36px;margin-bottom:20px;">📧</div>

    <h1 style="margin:0 0 10px;font-size:22px;font-weight:900;
               color:${T.white};letter-spacing:-0.5px;">
      Verify your email, ${name}
    </h1>

    <p style="margin:0 0 10px;font-size:14px;color:${T.muted};line-height:1.65;">
      You requested a new verification email. Click the button below to confirm
      your address and continue your Damuchi registration.
    </p>

    <p style="margin:0 0 24px;font-size:13px;color:rgba(245,158,11,0.65);">
      ⚠️ This link expires in <strong style="color:${T.accent};">24 hours</strong>.
    </p>

    ${ctaButton('Verify my email →', verificationLink || `${APP_URL}/auth/verify-pending`)}

    <div style="background:${T.dark};border-radius:12px;padding:16px;margin-top:24px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;
                color:${T.dim};text-transform:uppercase;letter-spacing:0.1em;">
        Button not working?
      </p>
      <p style="margin:0;font-size:11px;color:${T.dim};word-break:break-all;line-height:1.5;">
        Copy and paste this URL into your browser:<br/>
        <a href="${verificationLink || APP_URL}" style="color:${T.accent};text-decoration:none;">
          ${verificationLink || `${APP_URL}/auth/verify-pending`}
        </a>
      </p>
    </div>

    <p style="margin:20px 0 0;font-size:12px;color:${T.dim};line-height:1.6;">
      Didn't request this?
      <a href="mailto:${CONTACT}" style="color:${T.accent};text-decoration:none;">Contact support</a>.
    </p>
  `));

  return safeSend({ to: email, subject: '📧 Verify your Damuchi email address', html, tag: 'verify-reminder' });
};

/* ══════════════════════════════════════════════════════════════
   6. PASSWORD CHANGED EMAIL
   Sent after a successful password change as a security alert.
   ══════════════════════════════════════════════════════════════ */
export const sendPasswordChangedEmail = async ({ email, displayName, ip, userAgent }) => {
  const name = displayName?.trim() || 'there';
  const time = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });

  const html = emailShell(card(`
    <div style="font-size:36px;margin-bottom:20px;">🔐</div>

    <h1 style="margin:0 0 10px;font-size:22px;font-weight:900;
               color:${T.white};letter-spacing:-0.5px;">
      Password changed, ${name}
    </h1>

    <p style="margin:0 0 20px;font-size:14px;color:${T.muted};line-height:1.65;">
      Your Damuchi account password was successfully updated. All other
      active sessions have been signed out for your security.
    </p>

    ${infoBox([
      ['Time',       time],
      ['IP address', ip || 'Unknown'],
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

    ${ctaButton('Sign in to Damuchi →', `${APP_URL}/auth/login`)}
  `, '#818CF8'));

  return safeSend({ to: email, subject: '🔐 Your Damuchi password was changed', html, tag: 'password-changed' });
};

/* ══════════════════════════════════════════════════════════════
   7. QUOTE DIGEST
   Daily digest email with featured quotes. Called by job worker.
   ══════════════════════════════════════════════════════════════ */
export const sendQuoteDigest = async ({ email, displayName, quotes = [] }) => {
  const name    = displayName?.trim() || 'there';
  const topThree = quotes.slice(0, 3);

  if (!topThree.length) return { success: false, error: 'No quotes to send' };

  const quoteCards = topThree.map((q) => {
    const color = {
      motivation: '#F59E0B', mindset: '#818CF8', discipline: '#34D399',
      success: '#A78BFA', resilience: '#FB923C',
    }[q.category] || T.accent;

    return `
    <div style="background:${T.dark};border-radius:14px;padding:18px;
                margin-bottom:12px;border-left:3px solid ${color};">
      <p style="margin:0 0 8px;font-size:9px;font-weight:700;
                color:${color};text-transform:uppercase;letter-spacing:0.12em;">
        ${q.category || 'inspiration'}
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:rgba(255,255,255,0.8);
                line-height:1.65;font-style:italic;">"${q.text}"</p>
      <p style="margin:0;font-size:11px;font-weight:700;
                color:${color};text-transform:uppercase;letter-spacing:0.1em;">
        — ${q.author}
      </p>
    </div>`;
  }).join('');

  const html = emailShell(card(`
    <div style="font-size:32px;margin-bottom:16px;">✨</div>

    <h1 style="margin:0 0 6px;font-size:22px;font-weight:900;
               color:${T.white};letter-spacing:-0.5px;">
      Daily inspiration, ${name}
    </h1>
    <p style="margin:0 0 22px;font-size:13px;color:${T.muted};">
      ${new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
    </p>

    ${quoteCards}

    ${ctaButton('Read more quotes →', `${APP_URL}/quotes`)}

    <p style="margin:20px 0 0;font-size:11px;color:${T.dim};">
      You're receiving this because you're a Damuchi member.
      <a href="${APP_URL}/guest" style="color:${T.dim};text-decoration:underline;">Unsubscribe</a>.
    </p>
  `));

  return safeSend({ to: email, subject: `✨ Your daily Damuchi inspiration — ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'})}`, html, tag: 'digest' });
};