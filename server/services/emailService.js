/**
 * services/emailService.js
 * ═══════════════════════════════════════════════════════════════════
 * Email delivery + verification token management.
 *
 * WHAT CHANGED vs old version
 * ───────────────────────────────────────────────────────────────────
 *  • ALL Firestore writes → adminFirestore (Admin SDK).
 *    Old code used client SDK (setDoc, getDocs, updateDoc from
 *    'firebase/firestore') which hit security rules and threw
 *    Code 7 PERMISSION_DENIED on the server.
 *
 *  • ALL RTDB writes → adminDb.ref() (Admin SDK).
 *    Old verifyEmailLink used db.ref() (client SDK) → PERMISSION_DENIED.
 *
 *  • resendEmailVerification and verifyEmailLink removed from this file.
 *    Those are now handled by authController (resendVerification,
 *    verifyEmail) which were already rewritten correctly.
 *    Having them here too was dead / conflicting code.
 *
 *  • sendEmail and sendVerificationEmail are the only exports needed
 *    by the rest of the codebase. Kept exactly as-is except the
 *    verificationRecord write now goes through adminFirestore.
 *
 * EXPORTS
 * ───────────────────────────────────────────────────────────────────
 *  sendEmail             — generic nodemailer wrapper
 *  sendVerificationEmail — generate link + store token + send email
 * ═══════════════════════════════════════════════════════════════════
 */

import nodemailer          from 'nodemailer';
import { admin, adminDb, adminFirestore } from '../config/firebase.js';
import { hashString }      from '../utils/validator.js';
import { parseUserAgent }  from '../utils/security.js';

/* ── Email transporter ───────────────────────────────────────────── */
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

/* ── Admin Firestore helpers ─────────────────────────────────────── */
const serverTs    = () => admin.firestore.FieldValue.serverTimestamp();
const verColRef   = () => adminFirestore.collection('emailVerifications');

/* ══════════════════════════════════════════════════════════════════
   SEND EMAIL  — generic nodemailer wrapper
   ══════════════════════════════════════════════════════════════════ */

/**
 * @param {{ to: string, subject: string, html: string, headers?: Object }} options
 */
export const sendEmail = async ({ to, subject, html, headers }) => {
  try {
    await transporter.sendMail({
      from:    process.env.SMTP_USER,
      to,
      subject,
      html,
      headers,
    });
    console.log(`✅ Email sent to ${to}`);
  } catch (err) {
    console.error('❌ Email send failed:', err.message);
    throw new Error(`Email sending failed: ${err.message}`);
  }
};

/* ══════════════════════════════════════════════════════════════════
   SEND VERIFICATION EMAIL
   ───────────────────────────────────────────────────────────────────
   1. Generate Firebase verification link (Admin SDK — server-side)
   2. Extract oobCode → build clean frontend URL
   3. Hash oobCode → store in Firestore emailVerifications (Admin SDK)
   4. Send branded HTML email via nodemailer
   ══════════════════════════════════════════════════════════════════ */

/**
 * @param {{
 *   userId:   string,
 *   email:    string,
 *   name:     string,
 *   ip:       string,
 *   req:      import('express').Request,
 *   isResend?: boolean,
 * }} params
 * @returns {Promise<{ id: string, userId: string, email: string, expiresAt: string }>}
 */
export const sendVerificationEmail = async ({ userId, email, name, ip, req, isResend = false }) => {
  // ── 1. Generate Firebase email verification link ────────────────
  const verificationLink = await admin.auth().generateEmailVerificationLink(email, {
    url:             `${process.env.FRONTEND_URL}/auth/verify-email?uid=${userId}`,
    handleCodeInApp: true,
  });

  // ── 2. Extract oobCode + build clean frontend URL ───────────────
  const oobCode   = new URL(verificationLink).searchParams.get('oobCode');
  const frontendLink = oobCode
    ? `${process.env.FRONTEND_URL}/auth/verify-email?oobCode=${encodeURIComponent(oobCode)}&uid=${userId}&email=${encodeURIComponent(email)}`
    : verificationLink;

  // ── 3. Store hashed token in Firestore (Admin SDK — no rule hits) ─
  const tokenHash  = await hashString(oobCode);
  const recordId   = `${userId}_${Date.now()}`;
  const expiresAt  = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await verColRef().doc(recordId).set({
    id:        recordId,
    userId,
    email,
    ip:        ip || null,
    token:     tokenHash,
    consumed:  false,
    isResend,
    expiresAt,
    createdAt: serverTs(),
  });

  // ── 4. Parse device + send email ─────────────────────────────────
  const userAgent = req?.headers?.['user-agent'] || 'Unknown';
  const device    = parseUserAgent(userAgent);

  console.log(`📧 Sending ${isResend ? 'resend ' : ''}verification email to ${email} [${ip}]`);

  await sendEmail({
    to:      email,
    subject: 'Verify your email — Damuchi',
    html:    _verificationEmailHtml({ name, ip, device, link: frontendLink }),
    headers: {
      'X-Mailer-Lite-track': 'false',
      Precedence:            'bulk',
    },
  });

  return { id: recordId, userId, email, expiresAt };
};

/* ══════════════════════════════════════════════════════════════════
   EMAIL TEMPLATE — verification
   ══════════════════════════════════════════════════════════════════ */

function _verificationEmailHtml({ name, ip, device, link }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your Email — Damuchi</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Segoe UI',system-ui,sans-serif;color:#1a1a2e;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;
              overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0A0E1A 0%,#1C2135 100%);
                padding:32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1);">
      <h1 style="margin:0;color:#F59E0B;font-size:22px;letter-spacing:0.5px;">Damuchi</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:14px;">Email Verification Required</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin-top:0;">Hello <strong>${name}</strong>,</p>
      <p>We received a signup request for your account. Please verify your email address to complete registration.</p>

      <div style="background:#f3f4f6;border-radius:6px;padding:12px;
                  font-family:monospace;font-size:13px;margin:16px 0;">
        <div><strong>IP Address:</strong> ${ip || 'unknown'}</div>
        <div><strong>Device:</strong> ${device || 'unknown'}</div>
      </div>

      <p>Click the button below to verify your email.
         This link expires in <strong style="color:#ef4444;">24 hours</strong>.</p>

      <div style="text-align:center;margin:28px 0;">
        <a href="${link}"
           style="display:inline-block;padding:13px 32px;
                  background:#F59E0B;color:#0A0E1A;
                  border-radius:8px;text-decoration:none;
                  font-weight:700;font-size:15px;">
          Verify Email Address
        </a>
      </div>

      <p style="color:#64748b;font-size:13px;">
        If you didn't request this, you can safely ignore this email.
        Your account won't be created until verification is complete.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;
                text-align:center;font-size:12px;color:#6b7280;">
      <p style="margin:0;">© ${new Date().getFullYear()} Damuchi / 94tec Technologies. All rights reserved.</p>
      <p style="margin:6px 0 0;">
        <a href="https://94tec.com/privacy" style="color:#6b7280;">Privacy Policy</a>
         | 
        <a href="https://94tec.com/terms" style="color:#6b7280;">Terms of Service</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}