//import admin from 'firebase-admin';
import  userModel  from '../../models/user.js';
import { checkExistingUser, createUserAccount } from '../../services/userService.js';
import { sendVerificationEmail } from '../../services/emailService.js';
import {
   handleRegistrationError,
   getErrorResponse, 
   handleLoginError, 
   sendErrorResponse, 
   mapFirebaseError 
} from '../../utils/errorHandler.js';
import {
  createSessionFingerprint,
  generateCSRFToken,
  validateEmail,
  validatePassword
} from '../../utils/authUtils.js'
import { isValidEmail, isEmailDomainValid, isStrongPassword } from '../../utils/validator.js';
import AuditLog from '../../services/auditLog.js';
import { setSecurityHeaders } from '../../utils/security.js';
import { signOut } from 'firebase/auth';
import { db,firebaseAuth,admin } from '../../config/firebase.js';

import axios from 'axios';


const register = async (req, res) => {
  let userRecordUid = null;    
  try {
    const { email, password, name } = req.body;

    // 1. Enhanced Input Validation
    if (!email || !password || !name) {
      return res.status(400).json({ 
        error: 'All fields are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ 
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // 2. Domain and Disposable Email Check
    const domainCheck = await isEmailDomainValid(normalizedEmail);
    if (!domainCheck.valid) {
      return res.status(400).json({
        error: domainCheck.reason || 'Email domain is not acceptable', normalizedEmail,
        code: 'INVALID_DOMAIN'
      });
    }

    // 3. Password Strength Validation
    const passwordCheck = isStrongPassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({
        error: passwordCheck.message || 'Password does not meet requirements',
        code: 'WEAK_PASSWORD'
      });
    }

    // 5. Check Existing User with Transaction
    const existingUser = await checkExistingUser(normalizedEmail);
    if (existingUser.exists) {
      return res.status(409).json({
        error: existingUser.isVerified 
        ? 'An account with this email already exists.' 
        : 'This email is already registered. Please verify your email.',
        code: existingUser.isVerified ? 'EMAIL_EXISTS' : 'PENDING_VERIFICATION'
      });
    }

    // 6. Create User with Transaction
    const userCreationResult = await createUserAccount({
      email: normalizedEmail,
      password,
      name,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    userRecordUid = userCreationResult.userRecord.uid; // Store UID

    // 7. Email Verification with Enhanced Security
    const verificationResult = await sendVerificationEmail({
      req: req,
      userId: userRecordUid,
      email: normalizedEmail,
      name,
      ip: req.ip
    });

    // 8. Security Response Headers
    setSecurityHeaders(res);

    // 9. Success Response
    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      nextSteps: ['check_email', 'complete_profile'],
      _meta: {
        userId: userRecordUid,
        emailSent: true,
        verificationId: verificationResult.id
      }
    });

    // 10. Post-Registration Actions
    await postRegistrationActions({
      userId: userRecordUid,
      email: normalizedEmail,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

  } catch (error) {
     // --- Rollback Logic Starts Here ---
    if (userRecordUid) {
      try {
        console.warn(`Rolling back user ${userRecordUid}...`);
        
        // Delete Firebase Auth user
        await admin.auth().deleteUser(userRecordUid);

        // Delete from Realtime DB
        const userRef = db.ref(`users/${userRecordUid}`);
        await userRef.remove();

        // Delete from Realtime DB
        // Delete verification tokens tied to user
        //await VerificationModel.deleteAllForUser(userRecordUid);

        console.log(`✅ Rollback completed for ${userRecordUid}`);
      } catch (rollbackError) {
        console.error(`❌ Rollback failed for ${userRecordUid}:`, rollbackError.message);
      }
    }

    // Enhanced Error Handling
    await handleRegistrationError(error, req);

    // Secure Error Response
    const { status, message } = getErrorResponse(error);
    res.status(status).json({
      error: message,
      code: error.code || 'REGISTRATION_FAILED',
      ...(process.env.NODE_ENV === 'development' && { 
        details: error.message 
      })
    });
  }
};

// ===== Helper Functions ===== //

async function postRegistrationActions({ userId, email, ip, userAgent }) {
  // Log registration
  await AuditLog.record(AuditLog.EVENTS.REGISTRATION, {
    userId,
    ip,
    userAgent,
    metadata: { email },
    
  }).catch(err => {
    console.error('⚠️ Post-registration error:', err.message);
  });
}

const login = async (req, res) => {
  const { email, password } = req.body;

  // 1. Input validation
  if (!email || !password) {
    return sendErrorResponse(res, {
      code: 'MISSING_CREDENTIALS',
      message: 'Email and password are required',
      status: 400
    });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const ip = req.ip || req.connection?.remoteAddress || 'Unknown';

  try {
      // 2. Firebase Authentication with Timeout Protection
      const authResponse = await authenticateWithFirebase(normalizedEmail, password);

      // 3. Token Verification and Security Checks
      const { user, tokenData } = await verifyAndValidateToken(
        authResponse.idToken, 
        authResponse.localId
      );
      
      // 4. Check Account Status
      if (user.status !== 'active') {
        return sendErrorResponse(res, {
          code: 'ACCOUNT_INACTIVE',
          message: `Your account is currently '${user.status}'. Please contact support.`,
          status: 403
        });
      }

      // 5. Session Establishment
      establishSecureSession(res, {
        idToken: authResponse.idToken,
        refreshToken: authResponse.refreshToken,
        userId: authResponse.localId
      });

      // 6. Success Response
      sendSecureResponse(res, {
        userId: authResponse.localId,
        userData: {
          email: user.email,
          name: user.name,
          role: user.role
        }
      });

      // 7. Log Successful Login
      await AuditLog.record(AuditLog.EVENTS.LOGIN_SUCCESS, {
        userId: authResponse.localId,
        email: user.email,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { email: normalizedEmail }
      });
    } catch (error) {

      // 9. Error Handling
      await handleLoginError(error, {
        email: req.body.email,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      sendErrorResponse(res, error);
    }
};

// ===== Helper Functions ===== //
async function authenticateWithFirebase(email, password) {
     // Validate input format first
  if (!validateEmail(email) || !validatePassword(password)) {
    const err = new Error('Invalid credentials format');
    err.code = 'INVALID_CREDENTIALS';
    err.status = 400;
    throw err;
  }
 
  try {
    const firebaseResponse = await Promise.race([
      axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
        { email, password, returnSecureToken: true },
        { timeout: 5000 }
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Authentication timeout')), 5000))
    ]);
    // Check if account is disabled
    if (firebaseResponse.data?.idToken && !firebaseResponse.data?.registered) {
      const err = new Error('Account disabled');
      err.code = 'ACCOUNT_DISABLED';
      err.status = 403;
      throw err;
    }

    return {
      idToken: firebaseResponse.data.idToken,
      refreshToken: firebaseResponse.data.refreshToken,
      localId: firebaseResponse.data.localId,
      emailVerified: firebaseResponse.data.emailVerified
    };
  } catch (error) {
    //await trackFailedAttempt(email)
    console.error('🔥 Firebase Auth error:', error?.response?.data || error.message);
    error.code = mapFirebaseError(error).code;
    error.message = mapFirebaseError(error).message;
    throw error;
  }
}

async function verifyAndValidateToken(idToken, userId) {
  try {
    const decoded = await admin.auth().verifyIdToken(idToken, true);
  
    if (!decoded.email_verified) {
      const err = new Error('Email not verified');
      err.code = 'EMAIL_NOT_VERIFIED';
      err.status = 403;
      throw err;
    }
    // Verify token matches requested user
    if (decoded.uid !== userId) {
      const err = new Error('Token/user mismatch');
      err.code = 'TOKEN_MISMATCH';
      err.status = 403;
      throw err;
    }

    const user = await getUserWithTimeout(userId);
    return { user, tokenData: decoded };
  } catch (error) {
      // Log verification failures
      //await logVerificationAttempt(userId, false, error.message);
      throw error;
  }
}

async function getUserWithTimeout(userId) {
  try {
    const user = await Promise.race([
      userModel.getUserById(userId),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), 3000))
    ]);

    if (!user) {
      const err = new Error('User account not found');
      err.code = 'USER_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    return user;
  } catch (error) {
    error.code = error.code || 'DATABASE_ERROR';
    throw error;
  }
}

function establishSecureSession(res, { idToken, refreshToken, userId, userAgent }) {
  const isProduction = process.env.NODE_ENV === 'production';
  const sessionFingerprint = createSessionFingerprint(userAgent);
  
  const baseCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
    signed: true
  };

  // Session token cookie with __Host- prefix in production
  const sessionCookieName = isProduction ? '__Host-session' : '__session';
  res.cookie(sessionCookieName, `${idToken}|${sessionFingerprint}`, {
    ...baseCookieOptions,
    maxAge: 60 * 60 * 1000, // 1 hour
    ...(isProduction && { domain: process.env.COOKIE_DOMAIN })
  });

  // Refresh token cookie
  res.cookie('__refresh', refreshToken, {
    ...baseCookieOptions,
    httpOnly: true,
    path: '/auth/refresh',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  // Set CSRF token
  const csrfToken = generateCSRFToken();
  res.cookie('__csrf', csrfToken, {
    ...baseCookieOptions,
    httpOnly: false,
    path: '/',
    maxAge: 60 * 60 * 1000
  });

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('X-XSS-Protection', '1; mode=block');
}

function sendSecureResponse(res, { userId, userData }) {
  res.json({
    success: true,
    user: {
      uid: userId,
      ...userData
    },
    _meta: {
      authTime: new Date().toISOString()
    }
  });
}

const logout = async (req, res) => {
  try {
    // Sign out from Firebase
    await signOut(firebaseAuth);
    
    // Clear cookie
    res.clearCookie('__session');
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export {
  register,
  login,
  logout,
};