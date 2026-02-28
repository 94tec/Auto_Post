// server/services/userService.js
//import admin from 'firebase-admin';
import { db, admin } from '../config/firebase.js';
import UserModel from '../models/user.js';
import { hashPassword, verifyPassword } from '../utils/validator.js';
import AuditLog from '../services/auditLog.js';
import { sendEmail } from '../services/emailService.js';
import { hashString } from '../utils/validator.js';
import { parseUserAgent } from '../utils/security.js';
import PasswordResetModel from '../models/passwordResetModel.js';
import { validateEmail } from '../utils/authUtils.js';

async function checkExistingUser(email) {
  const safeEMail = email.toLowerCase().trim();
  try {
    const userRecord = await admin.auth().getUserByEmail(safeEMail);
    return {
      exists: true,
      isVerified: userRecord.emailVerified,
    };
  } catch (err) {
    // ✅ Handle Firebase user-not-found error gracefully
    if (err.code === 'auth/user-not-found') {
      return { exists: false };
    }

    // ❌ Re-throw all other unexpected errors
    throw err;
  }
}


async function createUserAccount({ email, password, name, ip, userAgent }) {
  let userRecord;
  try {
    // 1. Create Firebase Auth user
    // This handles the core authentication aspect: email, password, display name.
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      disabled: false,
      emailVerified: false, // Initially false, will be set to true upon email verification
    });
    const userId = userRecord.uid;

    // 2. Prepare data for UserModel's `create` method
    const dbUserData = {
      uid: userId,
      email,
      name,
      password,
      ip,
      userAgent,
    };
    const dbUser = await UserModel.createUser(dbUserData);

    // If both operations succeed, return the combined result
    return { userRecord, dbUser };

  } catch (error) {
    console.error('Error creating user account:', error);

    if (userRecord && userRecord.uid) {
      console.warn(`Attempting to delete orphaned Firebase Auth user ${userRecord.uid}`);
      try {
        await admin.auth().deleteUser(userRecord.uid);
        console.log(`Successfully deleted orphaned Firebase Auth user ${userRecord.uid}.`);
      } catch (deleteError) {
        console.error(`Failed to delete orphaned Firebase Auth user ${userRecord.uid}:`, deleteError);
      }
    }
    throw error; // Re-throw the original error
  }
}

// User Account Operations
const resetPassword = async (req, res) => {
  const { oobCode, newPassword } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';

  try {
    // Validate input
    if (!oobCode || !newPassword) {
      return res.status(400).json({ 
        error: 'Reset code and new password are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters',
        code: 'WEAK_PASSWORD'
      });
    }

    // Verify the reset token with Firebase
    const email = await admin.auth().verifyPasswordResetCode(oobCode);
    const normalizedEmail = email.toLowerCase().trim();

    // Check verification record
    const passwordResetModel = await PasswordResetModel.findOne({
      token: await hashString(oobCode),
      type: 'PASSWORD_RESET',
      consumed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!passwordResetModel) {
      return res.status(400).json({
        error: 'Invalid or expired reset link',
        code: 'INVALID_RESET_LINK'
      });
    }

    // Complete the password reset
    await admin.auth().confirmPasswordReset(oobCode, newPassword);

    // Get user record
    const user = await admin.auth().getUserByEmail(normalizedEmail);

    // Update verification record
    await PasswordResetModel.markAsConsumed(passwordResetModel.id);

    // Update user's last password change timestamp
    await UserModel.updateUser(user.uid, {
      security: {
        lastPasswordChange: new Date().toISOString()
      }
    });

    // Audit log
    await AuditLog.record('PASSWORD_RESET_COMPLETED', {
      userId: user.uid,
      email: normalizedEmail,
      ipAddress: ip,
      userAgent,
      metadata: {
        verificationId: verificationRecord.id
      }
    });

    // Invalidate all active sessions (optional security measure)
    await admin.auth().revokeRefreshTokens(user.uid);

    return res.status(200).json({ 
      success: true,
      message: 'Password reset successfully',
      code: 'PASSWORD_RESET_SUCCESS'
    });

  } catch (error) {
    console.error('Password reset error:', error);

    // Handle specific Firebase errors
    let errorMessage = 'Failed to reset password';
    let errorCode = 'RESET_FAILED';
    let statusCode = 400;

    switch (error.code) {
      case 'auth/expired-action-code':
        errorMessage = 'Password reset link has expired';
        errorCode = 'EXPIRED_LINK';
        break;
      case 'auth/invalid-action-code':
        errorMessage = 'Invalid password reset link';
        errorCode = 'INVALID_LINK';
        break;
      case 'auth/user-disabled':
        errorMessage = 'Account is disabled';
        errorCode = 'ACCOUNT_DISABLED';
        statusCode = 403;
        break;
      case 'auth/user-not-found':
        errorMessage = 'Account not found';
        errorCode = 'USER_NOT_FOUND';
        break;
      case 'auth/weak-password':
        errorMessage = 'Password is too weak';
        errorCode = 'WEAK_PASSWORD';
        break;
    }

    // Audit log for failed attempt
    await AuditLog.record('PASSWORD_RESET_FAILED', {
      error: error.message,
      ipAddress: ip,
      userAgent,
      metadata: {
        errorCode: error.code
      }
    });

    return res.status(statusCode).json({
      error: errorMessage,
      code: errorCode
    });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  
  // Validate email format before processing
  if (!email || typeof email !== 'string' || !validateEmail(email)) {
    return res.status(400).json({ 
      error: 'Please provide a valid email address',
      code: 'INVALID_EMAIL'
    });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';

  try {
    // Check if user exists in Firebase
    const user = await admin.auth().getUserByEmail(normalizedEmail);
    const userId = user.uid;

    // Generate secure Firebase password reset link
    const actionCodeSettings = {
      url: `${process.env.FRONTEND_URL}/auth/reset-password?uid=${userId}&email=${encodeURIComponent(normalizedEmail)}`,
      handleCodeInApp: true,
    };

    const resetLink = await admin.auth().generatePasswordResetLink(
      normalizedEmail, 
      actionCodeSettings
    );

    // Extract and encode parameters for security
    const url = new URL(resetLink);
    const oobCode = url.searchParams.get('oobCode');
    const customResetLink = `${process.env.FRONTEND_URL}/auth/reset-password?oobCode=${encodeURIComponent(oobCode)}&uid=${userId}&email=${encodeURIComponent(normalizedEmail)}`;

    // Store verification record with additional security measures
    const tokenHash = await hashString(oobCode);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour expiration

    await PasswordResetModel.create({
      userId,
      email: normalizedEmail,
      token: tokenHash,
      type: 'PASSWORD_RESET',
      ip,
      userAgent,
      expiresAt,
      consumed: false,
      metadata: {
        generatedAt: now,
        requestIp: ip,
        userAgent: userAgent
      }
    });

    // Get device information
    const device = parseUserAgent(userAgent);
    // Send email with enhanced security information
    await sendEmail({
      to: normalizedEmail,
      subject: 'Reset Your Password',
      html: generatePasswordResetEmail({
        name: user.displayName || normalizedEmail.split('@')[0],
        ip,
        device,
        resetLink: customResetLink,
        expirationTime: '1 hour',
        supportContact: process.env.SUPPORT_EMAIL
      }),
      text: `You requested a password reset. Click here: ${customResetLink}\nThis link will expire in 1 hour.`
    });

    // Audit log
    await AuditLog.record('PASSWORD_RESET_REQUESTED', {
      userId,
      email: normalizedEmail,
      ipAddress: ip,
      userAgent,
      metadata: {
        resetLinkHash: tokenHash,
        deviceInfo: device
      }
    });
    // Enhanced audit logging
    await AuditLog.record('PASSWORD_RESET_REQUESTED', {
      userId,
      email: normalizedEmail,
      ipAddress: ip,
      userAgent,
      deviceInfo: device,
      metadata: {
        resetTokenHash: tokenHash,
        expiresAt,
        frontendLink: customResetLink
      }
    });

    return res.status(200).json({ 
      message: 'If this email is registered, you will receive a reset link shortly',
      code: 'RESET_EMAIL_SENT'
    });

  } catch (error) {
     // Handle specific Firebase errors
    if (error.code === 'auth/user-not-found') {
      // Security: Don't reveal whether user exists
      await AuditLog.record('PASSWORD_RESET_ATTEMPT', {
        email: normalizedEmail,
        ipAddress: ip,
        userAgent,
        status: 'user_not_found',
        metadata: {
          attempted: true,
          timestamp: new Date()
        }
      });

      return res.status(200).json({ 
        message: 'If this email is registered, you will receive a reset link shortly',
        code: 'POTENTIAL_RESET_SENT'
      });
    }
    console.error('Password reset error:', { 
      email: normalizedEmail, 
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
     await AuditLog.record('PASSWORD_RESET_FAILURE', {
      email: normalizedEmail,
      ipAddress: ip,
      userAgent,
      error: error.message,
      status: 'system_error',
      metadata: {
        failed: true,
        errorCode: error.code,
        timestamp: new Date()
      }
    });

    return res.status(500).json({ 
      error: 'Failed to process password reset request. Please try again later.',
      code: 'SERVER_ERROR',
      supportContact: process.env.SUPPORT_EMAIL
    });
  }
};
const verificationLocks = new Map();
const LOCK_TIMEOUT_MS = 30000;

const verifyResetLink = async (req, res) => {
  const { oobCode, uid, email, isFromFrontend = false } = req.body;

  // For direct link clicks (GET requests)
  if (req.method === 'GET') {
    if (isFromFrontend) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth/reset-password?oobCode=${oobCode}&uid=${uid}&email=${email}&verified=true`);
    }
    return res.send(`
      <html>
        <script>
          window.addEventListener('load', () => {
            fetch('/api/verify-reset-link', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                oobCode: '${oobCode}',
                uid: '${uid}',
                email: '${email}',
                isFromFrontend: true
              })
            }).then(() => {
              window.location.href = '${process.env.FRONTEND_URL}/auth/reset-password?oobCode=${oobCode}&uid=${uid}&email=${email}&verified=true';
            });
          });
        </script>
      </html>
    `);
  }

  if (!oobCode || !uid || !email) {
    return res.status(400).json({ 
      error: 'Missing verification parameters', 
      code: 'INVALID_RESET_PARAMS',
      userMessage: 'The password reset link is incomplete. Please use the full link from your email.'
    });
  }

  const lockKey = `reset-${uid}-${oobCode}`;
  const existingLock = verificationLocks.get(lockKey);
  
  if (existingLock && (Date.now() - existingLock.timestamp < LOCK_TIMEOUT_MS)) {
    return res.status(409).json({
      success: false,
      code: 'RESET_IN_PROGRESS',
      userMessage: 'Password reset is already being processed'
    });
  }

  verificationLocks.set(lockKey, { timestamp: Date.now() });

  try {
    // 1. Verify the password reset code with Firebase
    try {
      await admin.auth().verifyPasswordResetCode(oobCode);
    } catch (error) {
      if (error.code === 'auth/expired-action-code') {
        return res.status(410).json({ 
          error: 'Expired code',
          code: 'EXPIRED_RESET_CODE',
          userMessage: 'This password reset link has expired. Please request a new one.'
        });
      }
      if (error.code === 'auth/invalid-action-code') {
        return res.status(404).json({ 
          error: 'Invalid code',
          code: 'INVALID_RESET_CODE',
          userMessage: 'The password reset link is invalid.'
        });
      }
      throw error;
    }

    // 2. Verify the user exists and matches the email
    let userRecord;
    try {
      userRecord = await admin.auth().getUser(uid);
      if (userRecord.email !== email) {
        return res.status(400).json({ 
          error: 'Email mismatch',
          code: 'EMAIL_MISMATCH',
          userMessage: 'The email in the reset link does not match the user account.'
        });
      }
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return res.status(404).json({ 
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          userMessage: 'No account found with this email address.'
        });
      }
      throw error;
    }

    // 3. Check if the token has already been used (optional - if tracking in your DB)
    const tokenHash = await hashString(oobCode);
    const existingReset = await PasswordResetModel.findByToken(tokenHash);
    
    if (existingReset && existingReset.used) {
      return res.status(410).json({ 
        error: 'Token already used',
        code: 'TOKEN_CONSUMED',
        userMessage: 'This password reset link has already been used.'
      });
    }

    // 4. If implementing rate limiting (optional)
    const recentResets = await PasswordResetModel.countRecentResets(uid);
    if (recentResets > 3) {
      return res.status(429).json({ 
        error: 'Too many resets',
        code: 'RESET_LIMIT_EXCEEDED',
        userMessage: 'Too many password reset attempts. Please try again later.'
      });
    }

    // 5. Log the verification attempt
    await AuditLog.record('PASSWORD_RESET_VERIFICATION', {
      userId: uid,
      email,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      resetToken: tokenHash
    });

    return res.status(200).json({ 
      success: true,
      message: 'Password reset link is valid.',
      userId: uid,
      email: userRecord.email
    });

  } catch (error) {
    console.error('Password reset verification failed', { 
      error: error.message,
      oobCode: oobCode ? 'exists' : 'missing',
      ip: req.ip
    });

    let errorCode = 'RESET_VERIFICATION_FAILED';
    let userMessage = 'Password reset verification failed. Please try again.';
    let statusCode = 400;

    if (error.code === 'auth/invalid-action-code') {
      errorCode = 'INVALID_RESET_CODE';
      userMessage = 'The password reset link is invalid.';
      statusCode = 404;
    } else if (error.code === 'auth/expired-action-code') {
      errorCode = 'EXPIRED_RESET_CODE';
      userMessage = 'The password reset link has expired. Please request a new one.';
      statusCode = 410;
    } else if (error.code === 'auth/user-not-found') {
      errorCode = 'USER_NOT_FOUND';
      userMessage = 'No account found with this email address.';
      statusCode = 404;
    }

    return res.status(statusCode).json({
      success: false,
      error: error.message,
      code: errorCode,
      userMessage
    });
  } finally {
    verificationLocks.delete(lockKey);
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { uid } = req.user;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Current and new password are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Get user from database
    const user = await UserModel.getUserById(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    // Verify current password
    const isPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Current password is incorrect',
        code: 'INVALID_PASSWORD'
      });
    }

    // Update password in Firebase
    await admin.auth().updateUser(uid, { password: newPassword });

    // Update password hash in database
    await UserModel.updateUser(uid, {
      passwordHash: await hashPassword(newPassword),
      security: {
        ...user.security,
        lastPasswordChange: new Date().toISOString(),
        failedLoginAttempts: 0 // Reset failed attempts on password change
      }
    });

    // Log the password change
    await AuditLog.record('PASSWORD_CHANGE', {
      userId: uid,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error.message);
    res.status(500).json({ 
      error: 'Failed to change password',
      code: 'PASSWORD_CHANGE_FAILED'
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const { uid } = req.user;

    if (!name && !email) {
      return res.status(400).json({ 
        error: 'At least one field to update is required',
        code: 'MISSING_FIELDS'
      });
    }

    const updates = {};
    if (name) updates.name = name;
    
    // Handle email update
    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      
      // Check if email is already in use
      try {
        const existingUser = await admin.auth().getUserByEmail(normalizedEmail);
        if (existingUser.uid !== uid) {
          return res.status(409).json({ 
            error: 'Email already in use',
            code: 'EMAIL_IN_USE'
          });
        }
      } catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
      }

      updates.email = normalizedEmail;
      updates.emailVerified = false; // Require re-verification
    }

    // Update Firebase auth record
    await admin.auth().updateUser(uid, updates);

    // Update database record
    const updatedUser = await UserModel.updateUser(uid, updates);

    // Log the profile update
    await AuditLog.record('PROFILE_UPDATE', {
      userId: uid,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { updatedFields: Object.keys(updates) }
    });

    res.json({ 
      success: true, 
      user: updatedUser,
      message: email ? 'Profile updated. Please verify your new email.' : 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({ 
      error: 'Failed to update profile',
      code: 'PROFILE_UPDATE_FAILED'
    });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const { uid } = req.user;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ 
        error: 'Password is required for account deletion',
        code: 'MISSING_PASSWORD'
      });
    }

    // Verify password
    const user = await UserModel.getUserById(uid);
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Invalid password',
        code: 'INVALID_PASSWORD'
      });
    }

    // Delete from Firebase Auth
    await admin.auth().deleteUser(uid);

    // Soft delete in database (or hard delete if preferred)
    await UserModel.updateUser(uid, { 
      status: 'deleted',
      deletedAt: new Date().toISOString() 
    });

    // Log the account deletion
    await AuditLog.record('ACCOUNT_DELETION', {
      userId: uid,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Clear session cookie
    res.clearCookie('__session');

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error.message);
    res.status(500).json({ 
      error: 'Failed to delete account',
      code: 'ACCOUNT_DELETION_FAILED'
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const firebaseUser = await admin.auth().getUser(req.user.uid);
    const user = await UserModel.getUserById(req.user.uid);

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Return minimal necessary user data
    const userData = {
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: firebaseUser.emailVerified,
      profileComplete: !!user.profileCompleted
    };

    res.json(userData);
  } catch (error) {
    console.error('Get current user error:', error.message);
    res.status(500).json({ 
      error: 'Failed to retrieve user data',
      code: 'USER_DATA_RETRIEVAL_FAILED'
    });
  }
};
function generatePasswordResetEmail({ name, ip, device, customResetLink }) {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Reset Your Password - SecureSphere</title>
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
              <img src="https://yourcompany.com/logo-white.png" alt="SecureSphere" class="logo" />
              <h1 style="color: white; margin: 0; font-size: 22px;">Reset Your Password</h1>
          </div>

          <div class="content">
              <p>Hello <strong>${name}</strong>,</p>

              <p>We received a password reset request from:</p>

              <div class="device-info">
                  <div><strong>IP Address:</strong> ${ip}</div>
                  <div><strong>Device:</strong> ${device}</div>
              </div>

              <p style="margin-bottom: 25px;">
                Click the button below to securely reset your password. This link will expire in <span class="expiry-notice">1 hour</span>.
              </p>

              <div style="text-align: center;">
                  <a href="${customResetLink}" class="button">Reset Password</a>
              </div>

              <p>If you didn't request this, no action is required. You can safely ignore this message.</p>

              <p style="margin-top: 30px;">Thanks,<br>The SecureSphere Team</p>
          </div>

          <div class="footer">
              <p>© ${new Date().getFullYear()} SecureSphere Technologies. All rights reserved.</p>
              <p>
                  <a href="https://yourcompany.com/privacy" style="color: #6b7280; text-decoration: underline;">Privacy Policy</a> | 
                  <a href="https://yourcompany.com/terms" style="color: #6b7280; text-decoration: underline;">Terms of Service</a>
              </p>
          </div>
      </div>
  </body>
  </html>`;
}

export {
  checkExistingUser,
  createUserAccount,
  resetPassword,
  forgotPassword,
  changePassword,
  updateProfile,
  deleteAccount,
  getCurrentUser
};