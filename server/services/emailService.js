import nodemailer from 'nodemailer';
import { db, admin } from '../config/firebase.js';
//import { applyActionCode } from 'firebase/auth';
import { ref, get, update } from 'firebase/database';
import { hashString } from '../utils/validator.js';
import { validateEmail } from '../utils/authUtils.js'
import { parseUserAgent } from '../utils/security.js';
import VerificationModel from '../models/verificationModel.js';
import AuditLog from './auditLog.js';

// Email transporter config
const transporter = nodemailer.createTransport({
  service: 'gmail', // or 'smtp.mailgun.org' if you're using Mailgun, etc.
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Generic send email function using nodemailer
 * @param {Object} options
 * @param {string} options.to - Recipient
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {Object} [options.headers] - Optional headers
 */
const sendEmail = async ({ to, subject, html, headers }) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
      headers,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    throw new Error(`Email sending failed: ${error.message}`);
  }
};

/**
 * Sends a secure email verification link and logs the attempt
 * @param {Object} params
 * @param {string} params.userId - Firebase UID
 * @param {string} params.email - User's email
 * @param {string} params.name - Display name
 * @param {string} params.ip - Origin IP
 * @param {Object} params.req - Express request (for user-agent)
 */
const sendVerificationEmail = async ({ userId, email, name, ip, req }) => {
  try {
    // 1. Generate Firebase verification link
    // const verificationLink = await admin.auth().generateEmailVerificationLink(email, {
    //   url: `${process.env.EMAIL_VERIFY_REDIRECT}?uid=${userId}`,
    //   handleCodeInApp: true,
    //   dynamicLinkDomain: process.env.FIREBASE_DYNAMIC_LINKS_DOMAIN,
    // });
    // 1. Generate the verification link with your custom path
    const actionCodeSettings = {
      url: `${process.env.FRONTEND_URL}/auth/verify-email?uid=${userId}`,
      handleCodeInApp: true,
    };

    const verificationLink = await admin.auth().generateEmailVerificationLink(
      email, 
      actionCodeSettings
    );

      // Extract just the oobCode from the Firebase URL
    const url = new URL(verificationLink);
    const oobCode = url.searchParams.get('oobCode');
    const customVerificationLink = `${process.env.FRONTEND_URL}/auth/verify-email?oobCode=${encodeURIComponent(oobCode)}&uid=${userId}&email=${encodeURIComponent(email)}`;

    // 2. Store hashed version of token for auditing
    const tokenHash = await hashString(oobCode);

    const verificationRecord = await VerificationModel.create({
      userId,
      email,
      ip,
      token: tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    // 3. Parse device info
    //const userAgent = req.headers['user-agent'];
    //const device = parseUserAgent(userAgent);
    // Parse device info safely
    const userAgent = req?.headers?.['user-agent'] || 'Unknown';
    const device = parseUserAgent(userAgent);
    //const device = parseUserAgent(req.headers['user-agent']);
    console.log(`📧 Sending verification email to ${email} from IP ${ip} on device ${device}`);
    // 4. Send HTML email
    await sendEmail({
      to: email,
      subject: 'Verify Your Email - SecureSphere',
      html: generateVerificationEmail({ name, ip, device, customVerificationLink }),
      headers: {
        'X-Mailer-Lite-track': 'false',
        Precedence: 'bulk',
      },
    });

    return verificationRecord;
  }catch (error) {
      console.error('Error sending verification email:', error);
      throw new Error(`Failed to send verification email: ${error.message}`);
    }     
};
  
const cooldownMap = new Map(); // Replace with Redis in prod
const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes cooldown

const resendEmailVerification = async (req, res) => {
  const { email } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  // Validate email format before processing
  if (!email || typeof email !== 'string' || !validateEmail(email)) {
    return res.status(400).json({ 
      error: 'Please provide a valid email address',
      code: 'INVALID_EMAIL'
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const cooldownKey = `verify:${normalizedEmail}`;
  const lastSent = cooldownMap.get(cooldownKey);
  const now = Date.now();

  try {
    // Check rate limiting first (fast fail)
    const lastSent = await getCooldown(cooldownKey);
    const now = Date.now();
    
    if (lastSent && now - lastSent < COOLDOWN_MS) {
      const secondsLeft = Math.ceil((COOLDOWN_MS - (now - lastSent)) / 1000);
      return res.status(429).json({ 
        error: `Please wait ${secondsLeft} seconds before requesting another verification email.`,
        code: 'RATE_LIMITED'
      });
    }
    // Get user from firebase
    const user = await admin.auth().getUserByEmail(normalizedEmail);

    // Check if already verified
    if (user.emailVerified) {
      return res.status(200).json({ 
        message: 'This email address has already been verified.',
        code: 'ALREADY_VERIFIED'
      });
    }
    // Check for existing active verification
    const existingVerification = await VerificationModel.findOne({
      userId: user.uid,
      email: normalizedEmail,
      consumed: false,
      expiresAt: { $gt: new Date() }
    });
    if (existingVerification) {
      console.log(`Reusing existing verification for ${normalizedEmail}`);
    }

    // Send verification email
    await sendVerificationEmail({
      userId: user.uid,
      email: normalizedEmail,
      name: user.displayName || normalizedEmail.split('@')[0],
      ip,
      userAgent: req.headers['user-agent'] || 'Unknown',
      isResend: true
    });

    cooldownMap.set(cooldownKey, now);
    // Log successful resend
    //await logVerificationResend(user.uid, normalizedEmail, ip, req.headers['user-agent']);
    await logVerificationResend({
      userId: user.uid,
      metadata: { normalizedEmail },
      ip: req.ip,
      userAgent: req.headers['user-agent'] || 'Unknown'
    });

    return res.status(200).json({ 
      message: 'Verification email sent successfully.',
      code: 'SENT'
    });
  } catch (error) {
    // Handle specific Firebase errors
    if (error.code === 'auth/user-not-found') {
      // Don't reveal whether user exists
      await setCooldown(cooldownKey, Date.now()); // Apply cooldown even for non-existent users
      return res.status(200).json({ 
        message: 'If this email is registered, you will receive a verification link.',
        code: 'POTENTIALLY_SENT'
      });
    }

    console.error('Resend error:', { 
      email: normalizedEmail, 
      error: error.message,
      stack: error.stack 
    });

    return res.status(500).json({ 
      error: 'Failed to send verification email. Please try again later.',
      code: 'SERVER_ERROR'
    });
  }
};
// Helper functions (would be Redis in production)
async function getCooldown(key) {
  // In production: return await redis.get(key);
  return cooldownMap.get(key);
}

async function setCooldown(key, timestamp) {
  // In production: await redis.setex(key, COOLDOWN_MS/1000, timestamp);
  cooldownMap.set(key, timestamp);
  setTimeout(() => cooldownMap.delete(key), COOLDOWN_MS);
}
// Logging function
async function logVerificationResend({ userId, email, ip, userAgent }) {
  try {
    await AuditLog.record(AuditLog.EVENTS.EMAIL_VERIFICATION_RESEND,{
      userId,
      ip,
      userAgent, 
      mtadata: { email },
    });
  } catch (logError) {
    console.error('Failed to log verification resend:', logError);
  }
}

const verificationLocks = new Map();
const LOCK_TIMEOUT_MS = 30000;
const verifyEmailLink = async (req, res) => {
  const { oobCode, uid, email, isFromFrontend = false } = req.body;

  // For direct link clicks (GET requests)
  if (req.method === 'GET') {
    if (isFromFrontend) {
      // If this is already a frontend-triggered verification
      return res.redirect(`${process.env.FRONTEND_URL}/auth/verify-email?verified=true&uid=${uid}`);
    }
    // Render a page that will trigger the frontend verification
    return res.send(`
      <html>
        <script>
          window.addEventListener('load', () => {
            fetch('/api/verify-email-link', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                oobCode: '${oobCode}',
                uid: '${uid}',
                email: '${email}',
                isFromFrontend: true
              })
            }).then(() => {
              window.location.href = '${process.env.FRONTEND_URL}/auth/verify-email?verified=true&uid=${uid}';
            });
          });
        </script>
      </html>
    `);
  }
  if (!oobCode || !uid || !email) {
    return res.status(400).json({ 
      error: 'Missing verification parameters', 
      code: 'INVALID_VERIFICATION_PARAMS',
      userMessage: 'The verification link is incomplete. Please use the full link from your email.'
    });
  }
  // Create unique lock key
  const lockKey = `verify-${uid}-${oobCode}`;
   // Check for existing lock (prevent concurrent processing)
  // Check for existing lock (with timeout check)
  const existingLock = verificationLocks.get(lockKey);
  if (existingLock && (Date.now() - existingLock.timestamp < LOCK_TIMEOUT_MS)) {
    return res.status(409).json({
      success: false,
      code: 'VERIFICATION_IN_PROGRESS',
      userMessage: 'Verification is already being processed'
    });
  }

  // Set lock with timestamp
  verificationLocks.set(lockKey, { timestamp: Date.now() });
  try {
     // ✅ STEP 0: Check if user is already verified
    const firebaseUser = await admin.auth().getUser(uid);
    if (firebaseUser.emailVerified) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        userMessage: 'Your email is already verified. You can proceed to login.',
        userId: firebaseUser.uid
      });
    }
    // 1. First verify the token before any updates
    const tokenHash = await hashString(oobCode);

    //console.log('🔑 Comparing token:', tokenHash);
    const verification = await VerificationModel.findByToken(tokenHash);

    if (!verification) {
      return res.status(404).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
        userMessage: 'The verification link is invalid.'
      });
    }

    if (verification.consumed) {
      return res.status(410).json({ 
        error: 'Token already used',
        code: 'TOKEN_CONSUMED',
        userMessage: 'This verification link has already been used.'
      });
    }
    // 2. Mark token as consumed first to prevent reuse
    await VerificationModel.markAsConsumed(verification.id);
    await admin.auth().updateUser(uid, { emailVerified: true });

    // 3. Get the Firebase user using Admin SDK (for UID + emailVerified check)
    const userRecord = await admin.auth().getUserByEmail(email);
    if (!userRecord.emailVerified) {
      throw new Error('Email verification failed - email not marked as verified');
    }

    // 4. Realtime DB: Reference to user path
    const userRef = ref(db, `users/${userRecord.uid}`);
    const userSnap = await get(userRef);

    if (!userSnap.exists()) {
      throw new Error('User record not found in Realtime Database');
    }
    //console.log('✅ Token valid:', verification);
    //console.log('✅ Firebase user found:', userRecord.emailVerified);
    //console.log('✅ Realtime DB snapshot:', userSnap.exists());
    //console.log('✅ Updating Realtime DB for UID:', uid);

    // 5. Update user status to 'active' and mark verified
    try {
      const userRef = db.ref(`users/${uid}`);
      const now = new Date().toISOString();
  
      const updatePayload = {
        'basic/status': 'active',
        'basic/emailVerified': true,
        'basic/emailVerifiedAt': now,
        'basic/updatedAt': now
      };
        //console.log('🧪 Firebase Realtime update payload:', updatePayload);
        await userRef.update(updatePayload);

    } catch (err) {
        console.error('❌ Firebase DB update failed:', err);
        throw err;
      }

    // 6. Log success
    await AuditLog.record('EMAIL_VERIFICATION', {
       userId: uid,
       email,
       ip: req.ip,
       userAgent: req.headers['user-agent'],
       verificationId: verification._id
     });

    return res.status(200).json({ 
      success: true,
      message: 'Email successfully verified and account activated.',
      userId: userRecord.uid
    });

  } catch (error) {
     console.error('❌ Email verification failed', { 
      error: error.message,
      oobCode: oobCode ? 'exists' : 'missing',
      ip: req.ip
    });

    let errorCode = 'EMAIL_VERIFICATION_FAILED';
    let userMessage = 'Email verification failed. Please try again.';
    let statusCode = 400;

    if (error.message.includes('expired') || error.message.includes('invalid')) {
      errorCode = 'EXPIRED_CODE';
      userMessage = 'The verification link has expired. Please request a new one.';
      statusCode = 410; // Gone
    } else if (error.message.includes('user not found')) {
      errorCode = 'USER_NOT_FOUND';
      userMessage = 'No account found with this email address.';
    }

    return res.status(statusCode).json({
      success: false,
      error: error.message,
      code: errorCode,
      userMessage
    });
  }finally {
    // Release lock
    verificationLocks.delete(lockKey);
  }
};

//template for sending verification email link
function generateVerificationEmail({ name, ip, device, customVerificationLink }) {
  return `<!DOCTYPE html>
  <html lang="en">
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - SecureSphere</title>
        <style>
            body {
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                background-color: #f5f7fa;
                margin: 0;
                padding: 0;
                color: #1a1a2e;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            }
            .header {
                background: linear-gradient(135deg, #0c0c1e 0%, #1a1a2e 100%);
                padding: 30px;
                text-align: center;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            .logo {
                height: 40px;
                margin-bottom: 15px;
            }
            .content {
                padding: 30px;
            }
            .footer {
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #6b7280;
                background-color: #f9fafb;
                border-top: 1px solid #e5e7eb;
            }
            .button {
                display: inline-block;
                padding: 12px 24px;
                background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
                color: white !important;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 20px 0;
            }
            .device-info {
                background-color: #f3f4f6;
                padding: 12px;
                border-radius: 6px;
                font-family: monospace;
                font-size: 13px;
                margin: 15px 0;
            }
            .expiry-notice {
                color: #ef4444;
                font-weight: 600;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <!-- Replace with your actual logo URL -->
                <h1 style="color: white; margin: 0; font-size: 22px;">Email Verification Required</h1>
            </div>
            
            <div class="content">
                <p>Hello <strong>${name}</strong>,</p>
                
                <p>We received a signup request for your 94tec Technologies account. Please verify your email address to complete registration.</p>
                
                <div class="device-info">
                    <div><strong>IP Address:</strong> ${ip}</div>
                    <div><strong>Device:</strong> ${device}</div>
                </div>
                
                <p style="margin-bottom: 25px;">Click the button below to verify your email address. This link will expire in <span class="expiry-notice">24 hours</span>.</p>
                
                <div style="text-align: center;">
                    <a href="${customVerificationLink}" class="button">Verify Email Address</a>
                </div>
                
                <p>If you didn't request this email, you can safely ignore it. Your account won't be created until verification is complete.</p>
                
                <p style="margin-top: 30px;">Thanks,<br>The 94tec Technologies Team</p>
            </div>
            
            <div class="footer">
                <p>© ${new Date().getFullYear()} 94tech Technologies. All rights reserved.</p>
                <p>
                    <a href="https://94tec.com/privacy" style="color: #6b7280; text-decoration: underline;">Privacy Policy</a> | 
                    <a href="https://94tec.com/terms" style="color: #6b7280; text-decoration: underline;">Terms of Service</a>
                </p>
            </div>
        </div>
    </body>
    </html>
  </html>`;
}
export {
  sendEmail,
  sendVerificationEmail,
  resendEmailVerification,
  verifyEmailLink
};
