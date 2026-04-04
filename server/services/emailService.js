/**
 * services/emailService.js
 * ═══════════════════════════════════════════════════════════════════
 * Email delivery + all transactional templates for Damuchi.
 * Provider: Gmail via nodemailer (SMTP)
 *
 * .env vars required:
 *   SMTP_HOST=smtp.gmail.com       (optional)
 *   SMTP_PORT=465                  (optional)
 *   SMTP_USER=you@gmail.com
 *   SMTP_PASS=your-app-password
 *   FRONTEND_URL=https://damuchi.app
 *   CONTACT_EMAIL=hello@damuchi.app
 *
 * EXPORTS
 * ───────────────────────────────────────────────────────────────────
 *  sendEmail                — generic nodemailer wrapper (throws on fail)
 *  sendVerificationEmail    — generate link + store token + send
 *  sendWelcomeEmail         — after successful registration
 *  sendApprovalEmail        — admin approved a guest
 *  sendAdminNotification    — guest verified, notify admins
 *  sendAdminWelcomeEmail    — new admin account created
 *  sendUserCreatedEmail     — admin created a user account
 *  sendContactEmail         — contact form submission
 *  sendPasswordChangedEmail — security alert after password change
 *  sendPasswordResetEmail   — forgot-password reset link
 *  sendQuoteDigest          — daily quote digest (job queue)
 * ═══════════════════════════════════════════════════════════════════
 */

import nodemailer         from 'nodemailer';
import { admin, adminFirestore } from '../config/firebase.js';
import { hashString }     from '../utils/validator.js';
import { parseUserAgent } from '../utils/security.js';

/* ══════════════════════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════════════════════ */
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

const APP_URL = process.env.FRONTEND_URL  || 'https://damuchi.app';
const CONTACT = process.env.CONTACT_EMAIL || 'hello@damuchi.app';
const FROM    = process.env.SMTP_USER;

const serverTs  = () => admin.firestore.FieldValue.serverTimestamp();
const verColRef = () => adminFirestore.collection('emailVerifications');

/* ══════════════════════════════════════════════════════════════════
   DESIGN TOKENS  — single source of truth
══════════════════════════════════════════════════════════════════ */
const C = {
  /* backgrounds */
  navy:    '#080D18',
  slate:   '#0F1623',
  card:    '#141C2E',
  dark:    '#0D1118',
  cardBdr: '#1E2940',
  faint:   '#1E2940',
  /* brand */
  amber:   '#F59E0B',
  orange:  '#F97316',
  indigo:  '#818CF8',
  green:   '#34D399',
  red:     '#f87171',
  /* text */
  white:   '#FFFFFF',
  dim:     '#94A3B8',
  muted:   '#64748B',
};

/* ══════════════════════════════════════════════════════════════════
   HTML BUILDING BLOCKS
   All helpers are pure functions → easy to test / reuse
══════════════════════════════════════════════════════════════════ */

/** Full document shell with responsive styles + preheader */
const _shell = (content, preheader = '') => `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="color-scheme" content="dark"/>
  <meta name="supported-color-schemes" content="dark"/>
  <title>Damuchi</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
    body{margin:0;padding:0;background-color:${C.navy};}
    a{color:${C.amber};text-decoration:none;}
    a:hover{text-decoration:underline;}
    .btn:hover{opacity:.88!important;}
    @media only screen and (max-width:600px){
      .wrap{padding:16px!important;}
      .card{padding:28px 22px!important;border-radius:16px!important;}
      .h1{font-size:21px!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${C.navy};
             font-family:'Inter',Helvetica,Arial,sans-serif;">

  ${preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
         ${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
       </div>`
    : ''}

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:${C.navy};min-height:100vh;">
    <tr>
      <td align="center" class="wrap" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:580px;">
          <tr><td>
            ${_logo()}
            ${content}
            ${_footer()}
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/** Damuchi logo row */
const _logo = () => `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin-bottom:24px;">
  <tr><td>
    <table cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding-right:10px;vertical-align:middle;">
          <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            style="height:36px;width:36px;v-text-anchor:middle;"
            arcsize="30%" fillcolor="${C.amber}" strokecolor="none">
            <w:anchorlock/>
            <center style="color:${C.navy};font-family:Arial;font-size:16px;font-weight:900;">D</center>
          </v:roundrect><![endif]-->
          <!--[if !mso]><!-->
          <div style="width:36px;height:36px;border-radius:11px;
                      background:linear-gradient(135deg,${C.amber},${C.orange});
                      display:inline-flex;align-items:center;justify-content:center;
                      font-weight:900;font-size:16px;color:${C.navy};
                      line-height:36px;text-align:center;">D</div>
          <!--<![endif]-->
        </td>
        <td style="vertical-align:middle;">
          <span style="font-size:18px;font-weight:800;color:${C.white};
                       letter-spacing:-0.4px;">
            Damu<span style="color:${C.amber};">chi</span>
          </span>
        </td>
      </tr>
    </table>
  </td></tr>
</table>`;

/** Card wrapper with top gradient accent bar */
const _card = (inner, accent1 = C.amber, accent2 = C.orange) => `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin-bottom:20px;">
  <tr>
    <td style="border-radius:20px;overflow:hidden;
               background:${C.card};border:1px solid ${C.cardBdr};">
      <div style="height:3px;
                  background:linear-gradient(to right,${accent1},${accent2},${accent1}22);
                  border-radius:20px 20px 0 0;"></div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td class="card" style="padding:36px 40px;">
            ${inner}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

/** CTA button — MSO/VML fallback for Outlook */
const _cta = (label, href, bg1 = C.amber, bg2 = C.orange) => `
<table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 4px;">
  <tr><td>
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      href="${href}" style="height:48px;v-text-anchor:middle;width:220px;"
      arcsize="25%" fillcolor="${bg1}" strokecolor="none">
      <w:anchorlock/>
      <center style="color:${C.navy};font-family:Arial;font-size:14px;font-weight:700;">
        ${label}
      </center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-->
    <a href="${href}" class="btn"
       style="display:inline-block;
              background:linear-gradient(to right,${bg1},${bg2});
              color:${C.navy};font-size:14px;font-weight:700;
              padding:14px 32px;border-radius:14px;text-decoration:none;
              letter-spacing:0.01em;">
      ${label} &rarr;
    </a>
    <!--<![endif]-->
  </td></tr>
</table>`;

/** Dark inset info rows */
const _infoBox = (rows) => `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background:${C.slate};border-radius:12px;
              border:1px solid ${C.cardBdr};margin-bottom:24px;">
  <tr><td style="padding:18px 22px;">
    ${rows.map(([label, value]) => `
    <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:${C.muted};
              text-transform:uppercase;letter-spacing:0.1em;">${label}</p>
    <p style="margin:0 0 14px;font-size:13px;color:${C.white};line-height:1.5;">${value}</p>
    `).join('')}
  </td></tr>
</table>`;

/** Bullet list */
const _bullets = (items) => items.map(item => `
<table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:9px;">
  <tr>
    <td style="width:14px;vertical-align:top;padding-top:5px;">
      <div style="width:5px;height:5px;border-radius:50%;
                  background:${C.amber};"></div>
    </td>
    <td style="font-size:13px;color:rgba(255,255,255,0.65);
               line-height:1.5;padding-left:8px;">${item}</td>
  </tr>
</table>`).join('');

/** Amber warning box */
const _warn = (text) => `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin-bottom:24px;">
  <tr>
    <td style="background:${C.amber}10;border:1px solid ${C.amber}28;
               border-radius:10px;padding:12px 16px;">
      <p style="margin:0;font-size:12px;color:${C.amber}CC;line-height:1.5;">${text}</p>
    </td>
  </tr>
</table>`;

/** Red danger box */
const _danger = (text) => `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin-bottom:24px;">
  <tr>
    <td style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.22);
               border-radius:12px;padding:16px 18px;">
      <p style="margin:0;font-size:13px;color:rgba(248,113,113,0.88);line-height:1.6;">${text}</p>
    </td>
  </tr>
</table>`;

/** Fallback URL block */
const _fallbackUrl = (link) => `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin-top:24px;">
  <tr>
    <td style="background:${C.slate};border:1px solid ${C.cardBdr};
               border-radius:12px;padding:16px 18px;">
      <p style="margin:0 0 5px;font-size:10px;font-weight:700;color:${C.muted};
                text-transform:uppercase;letter-spacing:0.1em;">Button not working?</p>
      <p style="margin:0 0 4px;font-size:11px;color:${C.muted};line-height:1.5;">
        Copy and paste this URL into your browser:
      </p>
      <p style="margin:0;font-size:11px;word-break:break-all;line-height:1.5;">
        <a href="${link}" style="color:${C.amber};text-decoration:none;">${link}</a>
      </p>
    </td>
  </tr>
</table>`;

/** Step row used in welcome / onboarding emails */
const _stepRow = ({ icon, color, num, title, desc }) => `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin-bottom:18px;">
  <tr>
    <td style="width:48px;vertical-align:top;padding-right:14px;">
      <div style="width:40px;height:40px;border-radius:12px;
                  background:${color}18;border:1px solid ${color}35;
                  text-align:center;line-height:40px;font-size:18px;">${icon}</div>
    </td>
    <td style="vertical-align:top;padding-top:4px;">
      <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:${C.white};">
        ${title}
        <span style="font-size:10px;font-weight:600;color:${color};margin-left:6px;
                     background:${color}15;padding:1px 7px;border-radius:999px;">
          ${num}
        </span>
      </p>
      <p style="margin:0;font-size:12px;color:${C.dim};line-height:1.55;">${desc}</p>
    </td>
  </tr>
</table>`;

/** Hero icon badge */
const _heroBadge = (emoji) => `
<table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;">
  <tr>
    <td>
      <div style="width:52px;height:52px;border-radius:16px;
                  background:linear-gradient(135deg,${C.amber}22,${C.orange}18);
                  border:1px solid ${C.amber}33;
                  text-align:center;line-height:52px;font-size:26px;">${emoji}</div>
    </td>
  </tr>
</table>`;

/** Page footer */
const _footer = () => `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin-top:28px;">
  <tr>
    <td style="border-top:1px solid ${C.faint};padding-top:20px;text-align:center;">
      <p style="margin:0 0 8px;font-size:11px;color:${C.muted};line-height:1.7;">
        © ${new Date().getFullYear()} Damuchi &nbsp;·&nbsp;
        Built with purpose in Nairobi 🇰🇪
      </p>
      <p style="margin:0;font-size:11px;">
        <a href="${APP_URL}/docs"
           style="color:${C.amber}55;text-decoration:none;">Docs</a>
        &nbsp;&middot;&nbsp;
        <a href="mailto:${CONTACT}"
           style="color:${C.amber}55;text-decoration:none;">Support</a>
        &nbsp;&middot;&nbsp;
        <a href="${APP_URL}/unsubscribe"
           style="color:${C.amber}55;text-decoration:none;">Unsubscribe</a>
      </p>
    </td>
  </tr>
</table>`;

/* ══════════════════════════════════════════════════════════════════
   CORE SEND WRAPPER — never throws
══════════════════════════════════════════════════════════════════ */
const safeSend = async ({ to, subject, html, headers, replyTo, tag = 'email' }) => {
  try {
    const info = await transporter.sendMail({
      from:  FROM,
      to:    Array.isArray(to) ? to.join(', ') : to,
      subject, html,
      ...(replyTo  && { replyTo }),
      ...(headers  && { headers }),
    });
    console.log(`[Email:${tag}] ✅ → ${Array.isArray(to) ? to.join(', ') : to} (${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email:${tag}] ❌ ${err.message}`);
    return { success: false, error: err.message };
  }
};

/** Public generic wrapper — throws on failure (legacy compat) */
export const sendEmail = async ({ to, subject, html, headers }) => {
  const r = await safeSend({ to, subject, html, headers, tag: 'generic' });
  if (!r.success) throw new Error(`Email sending failed: ${r.error}`);
};

/* ══════════════════════════════════════════════════════════════════
   1. VERIFICATION EMAIL  (registration + resend)
══════════════════════════════════════════════════════════════════ */
export const sendVerificationEmail = async ({
  userId, email, name, ip, req, isResend = false,
}) => {
  // 1. Generate Firebase verification link
  const verificationLink = await admin.auth().generateEmailVerificationLink(email, {
    url: `${APP_URL}/auth/verify-email?uid=${userId}`,
    handleCodeInApp: true,
  });

  // 2. Extract oobCode and build frontend link
  const oobCode = new URL(verificationLink).searchParams.get('oobCode');
  const frontendLink = oobCode
    ? `${APP_URL}/auth/verify-email?oobCode=${encodeURIComponent(oobCode)}&uid=${userId}&email=${encodeURIComponent(email)}`
    : verificationLink;

  // 3. Store token hash (optional)
  const tokenHash = await hashString(oobCode);
  const recordId = `${userId}_${Date.now()}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await verColRef().doc(recordId).set({
    id: recordId, userId, email,
    ip: ip || null,
    token: tokenHash,
    consumed: false,
    isResend,
    expiresAt,
    createdAt: serverTs(),
  });

  // 4. Prepare email content (inline HTML)
  const device = parseUserAgent(req?.headers?.['user-agent'] || 'Unknown');
  const firstName = name?.split(' ')[0] || 'there';

  console.log(`📧 Sending ${isResend ? 'resend ' : ''}verification to ${email} [${ip}]`);

  const html = _shell(
    _card(`
      ${_heroBadge('📧')}

      <h1 class="h1" style="margin:0 0 10px;font-size:24px;font-weight:900;
                             color:${C.white};letter-spacing:-0.5px;line-height:1.2;">
        ${isResend ? 'New verification link' : `Verify your email, ${firstName}`}
      </h1>

      <p style="margin:0 0 20px;font-size:14px;color:${C.dim};line-height:1.65;">
        ${isResend
          ? 'You requested a new verification email. Click below to confirm your address.'
          : "You're almost there! Click below to verify your email and activate your account."
        }
      </p>

      ${_warn(`⚠️ This link expires in <strong style="color:${C.amber};">24 hours</strong> and can only be used once.`)}

      ${_infoBox([
        ['Requested from', ip     || 'Unknown'],
        ['Device',         device || 'Unknown'],
      ])}

      ${_cta('Verify my email', frontendLink)}
      ${_fallbackUrl(frontendLink)}

      <p style="margin:24px 0 0;font-size:12px;color:${C.muted};line-height:1.6;">
        Didn't request this? You can safely ignore this email —
        your account won't be activated until the link is clicked.
      </p>
    `),
    isResend
      ? 'Your new Damuchi verification link is ready.'
      : `Hi ${firstName}, please verify your email to activate your account.`,
  );

  await safeSend({
    to:      email,
    subject: isResend ? '📧 New verification link — Damuchi' : '📧 Verify your email — Damuchi',
    html,
    headers: { 'X-Mailer-Lite-track': 'false', Precedence: 'bulk' },
    tag:     isResend ? 'verify-resend' : 'verify',
  });

  return { id: recordId, userId, email, expiresAt };
};

/* ══════════════════════════════════════════════════════════════════
   2. WELCOME EMAIL  — right after registration
══════════════════════════════════════════════════════════════════ */
export const sendWelcomeEmail = async ({ email, displayName }) => {
  const firstName = (displayName?.trim() || 'there').split(' ')[0];

  const steps = [
    { icon: '✉️', color: C.amber,  num: '01', title: 'Verify your email',
      desc: 'Click the verification link we just sent to your inbox.' },
    { icon: '🔍', color: C.indigo, num: '02', title: 'Await admin approval',
      desc: 'An admin will review your account — usually within 24 hours.' },
    { icon: '🚀', color: C.green,  num: '03', title: 'Full access unlocked',
      desc: 'Create, curate, and share your personal quote collection.' },
  ];

  const html = _shell(
    _card(`
      ${_heroBadge('👋')}

      <h1 class="h1" style="margin:0 0 8px;font-size:24px;font-weight:900;
                             color:${C.white};letter-spacing:-0.5px;line-height:1.2;">
        Welcome, ${firstName}!
      </h1>
      <p style="margin:0 0 24px;font-size:14px;color:${C.dim};line-height:1.65;">
        Your Damuchi account has been created. Here's what happens next:
      </p>

      <!-- steps -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="background:${C.slate};border:1px solid ${C.cardBdr};
                    border-radius:14px;margin-bottom:28px;">
        <tr><td style="padding:22px 20px 4px;">
          ${steps.map(_stepRow).join('')}
        </td></tr>
      </table>

      <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:${C.muted};
                text-transform:uppercase;letter-spacing:0.12em;">Ready to explore?</p>
      <p style="margin:0;font-size:13px;color:${C.dim};line-height:1.6;">
        Head to Damuchi to start exploring quotes while you wait for activation.
      </p>

      ${_cta('Go to Damuchi', `${APP_URL}/auth/verify-pending`)}

      <!-- security note -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="margin-top:24px;">
        <tr>
          <td style="background:${C.slate};border:1px solid ${C.cardBdr};
                     border-radius:12px;padding:14px 18px;">
            <p style="margin:0;font-size:11px;color:${C.muted};line-height:1.6;">
              🔒 <strong style="color:${C.dim};">Didn't register?</strong>
              Someone may have used your email by mistake. Safely ignore this email —
              no account activates without clicking the verification link.
              <a href="mailto:${CONTACT}" style="color:${C.amber};text-decoration:none;">
                Contact support</a> if concerned.
            </p>
          </td>
        </tr>
      </table>
    `, C.amber, C.green),
    `Welcome to Damuchi, ${firstName}! Complete your setup to get full access.`,
  );

  return safeSend({
    to:      email,
    subject: '👋 Welcome to Damuchi — complete your setup',
    html,
    tag:     'welcome',
  });
};

/* ══════════════════════════════════════════════════════════════════
   3. APPROVAL EMAIL  — admin approved a guest
══════════════════════════════════════════════════════════════════ */
export const sendApprovalEmail = async ({ email, displayName }) => {
  const name = displayName?.trim() || 'there';

  const html = _shell(_card(`
    ${_heroBadge('🎉')}

    <h1 class="h1" style="margin:0 0 10px;font-size:24px;font-weight:900;
                           color:${C.white};letter-spacing:-0.5px;line-height:1.2;">
      You're approved, ${name}!
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:${C.dim};line-height:1.65;">
      Your account has been reviewed and approved. You now have full access to create,
      organise, and share your personal quote collection.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="background:${C.slate};border:1px solid ${C.cardBdr};
                  border-radius:14px;padding:0;margin-bottom:28px;">
      <tr><td style="padding:20px 22px;">
        <p style="margin:0 0 14px;font-size:10px;font-weight:700;color:${C.muted};
                  text-transform:uppercase;letter-spacing:0.1em;">What's now unlocked</p>
        ${_bullets([
          '📚 Build and manage your personal quote library',
          '⚡ Create, edit and organise quotes by category',
          '⭐ Save and access your favourite quotes anytime',
          `📤 Auto-post to X and LinkedIn <em style="color:${C.muted};font-size:11px;">(coming soon)</em>`,
        ])}
      </td></tr>
    </table>

    ${_cta('Sign in to Damuchi', `${APP_URL}/auth/login`)}

    <p style="margin:24px 0 0;font-size:12px;color:${C.muted};line-height:1.6;">
      Didn't create this account?
      <a href="mailto:${CONTACT}" style="color:${C.amber};text-decoration:none;">Contact support</a>.
    </p>
  `), `Great news, ${name} — your Damuchi account has been approved!`);

  return safeSend({
    to:      email,
    subject: '🎉 Your Damuchi account is approved!',
    html,
    tag:     'approval',
  });
};

/* ══════════════════════════════════════════════════════════════════
   4. ADMIN NOTIFICATION  — guest verified, pending approval
══════════════════════════════════════════════════════════════════ */
export const sendAdminNotification = async ({ adminEmails, newUser }) => {
  if (!adminEmails?.length) return { success: false, error: 'No admin emails provided' };

  const html = _shell(_card(`
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;">
      <tr>
        <td style="width:48px;vertical-align:top;padding-right:12px;">
          <div style="width:44px;height:44px;border-radius:14px;
                      background:rgba(129,140,248,0.14);border:1px solid rgba(129,140,248,0.25);
                      text-align:center;line-height:44px;font-size:22px;">🔔</div>
        </td>
        <td style="vertical-align:top;padding-top:4px;">
          <h2 style="margin:0 0 3px;font-size:18px;font-weight:900;color:${C.white};">
            New approval request
          </h2>
          <p style="margin:0;font-size:12px;color:${C.dim};">
            A user verified their email and is awaiting your approval.
          </p>
        </td>
      </tr>
    </table>

    ${_infoBox([
      ['Display Name', newUser.displayName || `<em style="color:${C.muted};">Not set</em>`],
      ['Email',        `<span style="color:${C.amber};">${newUser.email}</span>`],
      ['Registered',   newUser.createdAt
        ? new Date(newUser.createdAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })
        : 'Just now'],
    ])}

    ${_cta('Review in admin panel', `${APP_URL}/admin?tab=queue`, C.indigo, '#6366f1')}

    <p style="margin:20px 0 0;font-size:12px;color:${C.muted};line-height:1.6;">
      Or view the
      <a href="${APP_URL}/admin/users/${newUser.uid || ''}"
         style="color:${C.indigo};text-decoration:none;">direct user profile</a>.
    </p>
  `, C.indigo, '#6366f1'), `Approval needed: ${newUser.email}`);

  return safeSend({
    to:      adminEmails,
    subject: `🔔 Approval needed: ${newUser.email}`,
    html,
    tag:     'admin-notify',
  });
};

/* ══════════════════════════════════════════════════════════════════
   5. ADMIN WELCOME EMAIL  — new admin account created
══════════════════════════════════════════════════════════════════ */
export const sendAdminWelcomeEmail = async ({ email, displayName, tempPassword, createdBy }) => {
  const name = displayName?.trim() || 'Admin';

  const html = _shell(_card(`
    ${_heroBadge('🛡️')}

    <h1 class="h1" style="margin:0 0 8px;font-size:24px;font-weight:900;
                           color:${C.white};letter-spacing:-0.5px;line-height:1.2;">
      Welcome to the admin team, ${name}!
    </h1>
    <p style="margin:0 0 6px;font-size:12px;color:${C.muted};">
      Created by: <strong style="color:${C.dim};">${createdBy || 'System Admin'}</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:${C.dim};line-height:1.65;">
      Your Damuchi admin account is ready. Use the credentials below to sign in.
    </p>

    ${_infoBox([
      ['Email', email],
      ['Temporary password',
        `<code style="background:rgba(255,255,255,0.08);padding:3px 10px;
                      border-radius:6px;font-family:monospace;
                      color:${C.amber};">${tempPassword}</code>`],
    ])}

    ${_danger(`<strong>⚠️ You must change your password on first login.</strong><br/>
      Full admin access is restricted until the password is changed.`)}

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="background:${C.slate};border:1px solid ${C.cardBdr};
                  border-radius:14px;margin-bottom:28px;">
      <tr><td style="padding:20px 22px;">
        <p style="margin:0 0 14px;font-size:10px;font-weight:700;color:${C.muted};
                  text-transform:uppercase;letter-spacing:0.1em;">Your admin capabilities</p>
        ${_bullets([
          '👥 Manage and approve user accounts',
          '🔐 Grant or revoke write permissions',
          '📊 View system statistics and audit logs',
          '✍️ Create, edit and delete all quotes',
          '🔔 Receive approval notifications',
        ])}
      </td></tr>
    </table>

    ${_cta('Sign in & change password', `${APP_URL}/auth/login`, C.indigo, '#6366f1')}

    <p style="margin:24px 0 0;font-size:12px;color:${C.muted};line-height:1.6;">
      Didn't expect this?
      <a href="mailto:${CONTACT}" style="color:${C.amber};text-decoration:none;">Contact support</a>.
    </p>
  `, C.indigo, '#6366f1'), `Your Damuchi admin account is ready, ${name}.`);

  return safeSend({
    to:      email,
    subject: '🛡️ Your Damuchi admin account is ready',
    html,
    tag:     'admin-welcome',
  });
};

/* ══════════════════════════════════════════════════════════════════
   6. USER CREATED BY ADMIN  — pre-approved user account
══════════════════════════════════════════════════════════════════ */
export const sendUserCreatedEmail = async ({ email, displayName, tempPassword }) => {
  const name = displayName?.trim() || 'there';

  const html = _shell(_card(`
    ${_heroBadge('🎉')}

    <h1 class="h1" style="margin:0 0 10px;font-size:24px;font-weight:900;
                           color:${C.white};letter-spacing:-0.5px;line-height:1.2;">
      Your account is ready, ${name}!
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:${C.dim};line-height:1.65;">
      A Damuchi admin has created an account for you.
      You have full member access from day one.
    </p>

    ${_infoBox([
      ['Email', email],
      ['Temporary password',
        `<code style="background:rgba(255,255,255,0.08);padding:3px 10px;
                      border-radius:6px;font-family:monospace;
                      color:${C.amber};">${tempPassword}</code>`],
    ])}

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="background:${C.slate};border:1px solid ${C.cardBdr};
                  border-radius:14px;margin-bottom:28px;">
      <tr><td style="padding:20px 22px;">
        <p style="margin:0 0 14px;font-size:10px;font-weight:700;color:${C.muted};
                  text-transform:uppercase;letter-spacing:0.1em;">What's waiting for you</p>
        ${_bullets([
          '📚 Build your personal quote library',
          '⭐ Save and organise your favourites',
          '✍️ Create and share your own quotes',
          '📤 Auto-post to X and LinkedIn (coming soon)',
        ])}
      </td></tr>
    </table>

    ${_cta('Sign in to Damuchi', `${APP_URL}/auth/login`)}

    <p style="margin:24px 0 0;font-size:12px;color:${C.muted};">
      We recommend changing your password after first sign-in.
    </p>
  `), `Your Damuchi account is ready — sign in now.`);

  return safeSend({
    to:      email,
    subject: '🎉 Your Damuchi account is ready — sign in now',
    html,
    tag:     'user-created',
  });
};

/* ══════════════════════════════════════════════════════════════════
   7. CONTACT FORM  — forwarded to CONTACT_EMAIL
══════════════════════════════════════════════════════════════════ */
export const sendContactEmail = async ({ name, email, topic, message }) => {
  const html = _shell(_card(`
    ${_heroBadge('✉️')}

    <h2 style="margin:0 0 6px;font-size:20px;font-weight:900;color:${C.white};">
      New contact message
    </h2>
    <p style="margin:0 0 22px;font-size:13px;color:${C.muted};">
      Submitted via the Damuchi contact form.
    </p>

    ${_infoBox([
      ['From',  `${name} &lt;<a href="mailto:${email}"
                   style="color:${C.amber};text-decoration:none;">${email}</a>&gt;`],
      ['Topic', topic || 'General enquiry'],
    ])}

    <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:${C.muted};
              text-transform:uppercase;letter-spacing:0.1em;">Message</p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin-bottom:24px;">
      <tr>
        <td style="background:${C.dark};border-radius:12px;
                   border-left:3px solid ${C.amber};padding:16px 18px;">
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.75);
                    line-height:1.7;white-space:pre-wrap;">${message}</p>
        </td>
      </tr>
    </table>

    ${_cta(`Reply to ${name}`, `mailto:${email}`)}

    <p style="margin:20px 0 0;font-size:11px;color:${C.muted};">
      Reply-To is set to the sender's address for one-click replies.
    </p>
  `));

  return safeSend({
    to:      CONTACT,
    replyTo: email,
    subject: `[Damuchi Contact] ${topic || 'General'} — ${name}`,
    html,
    tag:     'contact',
  });
};

/* ══════════════════════════════════════════════════════════════════
   8. VERIFICATION REMINDER  — resend verify link
══════════════════════════════════════════════════════════════════ */
export const sendVerificationReminder = async ({ email, displayName, verificationLink }) => {
  const name = displayName?.trim() || 'there';
  const link = verificationLink || `${APP_URL}/auth/verify-pending`;

  const html = _shell(_card(`
    ${_heroBadge('📧')}

    <h1 class="h1" style="margin:0 0 10px;font-size:22px;font-weight:900;
                           color:${C.white};letter-spacing:-0.5px;line-height:1.2;">
      Verify your email, ${name}
    </h1>
    <p style="margin:0 0 20px;font-size:14px;color:${C.dim};line-height:1.65;">
      Click below to confirm your address and continue your registration.
    </p>

    ${_warn(`⚠️ This link expires in <strong style="color:${C.amber};">24 hours</strong>.`)}
    ${_cta('Verify my email', link)}
    ${_fallbackUrl(link)}

    <p style="margin:20px 0 0;font-size:12px;color:${C.muted};line-height:1.6;">
      Didn't request this?
      <a href="mailto:${CONTACT}" style="color:${C.amber};text-decoration:none;">Contact support</a>.
    </p>
  `), 'Your Damuchi verification link is ready.');

  return safeSend({
    to:      email,
    subject: '📧 Verify your Damuchi email address',
    html,
    tag:     'verify-reminder',
  });
};

/* ══════════════════════════════════════════════════════════════════
   9. PASSWORD CHANGED  — security alert
══════════════════════════════════════════════════════════════════ */
export const sendPasswordChangedEmail = async ({ email, displayName, ip, userAgent }) => {
  const name = displayName?.trim() || 'there';
  const time = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });

  const html = _shell(_card(`
    ${_heroBadge('🔐')}

    <h1 class="h1" style="margin:0 0 10px;font-size:22px;font-weight:900;
                           color:${C.white};letter-spacing:-0.5px;line-height:1.2;">
      Password changed, ${name}
    </h1>
    <p style="margin:0 0 20px;font-size:14px;color:${C.dim};line-height:1.65;">
      Your password was successfully updated. All other active sessions have been
      signed out for your security.
    </p>

    ${_infoBox([
      ['Time',       time],
      ['IP address', ip        || 'Unknown'],
      ['Device',     userAgent ? userAgent.split('(')[0].trim() : 'Unknown'],
    ])}

    ${_danger(`<strong>Wasn't you?</strong> Your account may be compromised.
      <a href="${APP_URL}/auth/reset-password"
         style="color:${C.red};font-weight:700;text-decoration:underline;">
        Reset your password immediately
      </a> and contact support.`)}

    ${_cta('Sign in to Damuchi', `${APP_URL}/auth/login`)}
  `, C.indigo, '#6366f1'), 'Your Damuchi password was just changed.');

  return safeSend({
    to:      email,
    subject: '🔐 Your Damuchi password was changed',
    html,
    tag:     'password-changed',
  });
};

/* ══════════════════════════════════════════════════════════════════
   10. PASSWORD RESET  — forgot-password link
══════════════════════════════════════════════════════════════════ */
export const sendPasswordResetEmail = async ({ email, displayName, resetLink, ip }) => {
  const name = displayName?.trim() || 'there';

  const html = _shell(_card(`
    ${_heroBadge('🔑')}

    <h1 class="h1" style="margin:0 0 10px;font-size:22px;font-weight:900;
                           color:${C.white};letter-spacing:-0.5px;line-height:1.2;">
      Reset your password, ${name}
    </h1>
    <p style="margin:0 0 20px;font-size:14px;color:${C.dim};line-height:1.65;">
      We received a request to reset your Damuchi password.
      Click below to choose a new one.
    </p>

    ${_warn(`⚠️ This link expires in <strong style="color:${C.amber};">15 minutes</strong> and can only be used once.`)}

    ${_infoBox([['Requested from', ip || 'Unknown']])}

    ${_cta('Reset my password', resetLink)}
    ${_fallbackUrl(resetLink)}

    ${_danger('Didn\'t request this? You can safely ignore this email — your password won\'t change unless you click the link above.')}
  `), 'Reset your Damuchi password.');

  return safeSend({
    to:      email,
    subject: '🔑 Reset your Damuchi password',
    html,
    tag:     'password-reset',
  });
};

/* ══════════════════════════════════════════════════════════════════
   11. QUOTE DIGEST  — daily email (job queue)
══════════════════════════════════════════════════════════════════ */
export const sendQuoteDigest = async ({ email, displayName, quotes = [] }) => {
  const name     = displayName?.trim() || 'there';
  const topThree = quotes.slice(0, 3);
  if (!topThree.length) return { success: false, error: 'No quotes to send' };

  const CAT_COLORS = {
    motivation: C.amber,  mindset:    C.indigo, discipline: C.green,
    success:    '#A78BFA',resilience: C.orange,
  };

  const quoteCards = topThree.map(q => {
    const color = CAT_COLORS[q.category] || C.amber;
    return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin-bottom:12px;">
      <tr>
        <td style="background:${C.dark};border-radius:12px;
                   border-left:3px solid ${color};padding:16px 18px;">
          <p style="margin:0 0 6px;font-size:9px;font-weight:700;
                    color:${color};text-transform:uppercase;letter-spacing:0.12em;">
            ${q.category || 'inspiration'}
          </p>
          <p style="margin:0 0 8px;font-size:14px;color:rgba(255,255,255,0.82);
                    line-height:1.65;font-style:italic;">"${q.text}"</p>
          <p style="margin:0;font-size:11px;font-weight:700;
                    color:${color};text-transform:uppercase;letter-spacing:0.1em;">
            — ${q.author}
          </p>
        </td>
      </tr>
    </table>`;
  }).join('');

  const dateStr   = new Date().toLocaleDateString('en-US',
    { weekday:'long', month:'long', day:'numeric', year:'numeric' });
  const shortDate = new Date().toLocaleDateString('en-US',
    { month:'short', day:'numeric' });

  const html = _shell(_card(`
    ${_heroBadge('✨')}

    <h1 class="h1" style="margin:0 0 4px;font-size:22px;font-weight:900;
                           color:${C.white};letter-spacing:-0.5px;line-height:1.2;">
      Daily inspiration, ${name}
    </h1>
    <p style="margin:0 0 22px;font-size:12px;color:${C.muted};">${dateStr}</p>

    ${quoteCards}

    ${_cta('Read more quotes', `${APP_URL}/quotes`)}

    <p style="margin:20px 0 0;font-size:11px;color:${C.muted};">
      You're receiving this because you're a Damuchi member.
      <a href="${APP_URL}/unsubscribe" style="color:${C.muted};text-decoration:underline;">
        Unsubscribe</a>.
    </p>
  `), `Your daily Damuchi inspiration for ${shortDate}.`);

  return safeSend({
    to:      email,
    subject: `✨ Your daily Damuchi inspiration — ${shortDate}`,
    html,
    tag:     'digest',
  });
};