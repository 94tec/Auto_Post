/**
 * controllers/auth/registerController.js
 * ═══════════════════════════════════════════════════════════════
 * POST /api/auth/register
 *
 * FLOW
 * ───────────────────────────────────────────────────────────────
 *  1. Field presence check
 *  2. Email format validation (regex)
 *  3. Name length (2–50)
 *  4. Password strength (via validatePasswordStrength)
 *  5. Redis idempotency lock — prevent double-submit (30s)
 *  6. Redis fast duplicate check O(1)
 *  7. Firebase Auth authoritative duplicate check
 *  8. admin.auth().createUser()
 *  9. RTDB + Firestore parallel write
 * 10. Redis cache warm (email→uid, uid→profile)
 * 11. Release lock
 * 12. sendWelcomeEmail() — fire-and-forget
 * 13. AuditLog           — fire-and-forget
 * 14. 201 response with nextSteps[]
 *
 * ROLLBACK
 * ───────────────────────────────────────────────────────────────
 *  Any failure after step 8 triggers full cleanup:
 *    Firebase Auth delete + RTDB remove + Firestore delete + Redis del
 * ═══════════════════════════════════════════════════════════════
 */

import { admin }                        from '../../config/firebase.js';
import { ROLES, STATUS }                from '../../config/roles.js';
import { validatePasswordStrength }     from '../../utils/validator.js';
import { checkExistingUser }            from './userController.js';
import { sendVerificationEmail, sendWelcomeEmail }             from '../../services/emailService.js';
import AuditLog                         from '../../services/auditLog.js';
import {
  getIp, getUserAgent, validateEmailFormat,
  writeUserToRTDB, writeUserToFirestore,
  cacheNewUser, rollbackRegistration,
  rGet, rSet, rDel, rSetNX,
  K, TTL, mapFirebaseError,
} from './authHelpers.js';

/* ══════════════════════════════════════════════════════════════
   REGISTER
══════════════════════════════════════════════════════════════ */
export const register = async (req, res) => {
  let firebaseUid = null;
  const normEmail  = req.body?.email?.trim().toLowerCase();

  try {
    const { password, displayName, name } = req.body;
    const resolvedName = (displayName || name)?.trim();

    /* 1. Field presence ───────────────────────────────────────── */
    const missing = [];
    if (!normEmail)     missing.push('email');
    if (!password)      missing.push('password');
    if (!resolvedName)  missing.push('name');

    if (missing.length) {
      return res.status(400).json({
        error:   `Please fill in: ${missing.join(', ')}.`,
        code:    'MISSING_FIELDS',
        missing,
      });
    }

    /* 2. Email format ─────────────────────────────────────────── */
    const emailCheck = validateEmailFormat(normEmail);
    if (!emailCheck.valid) {
      return res.status(400).json({ error: emailCheck.reason, code: emailCheck.code });
    }

    /* 3. Name length ──────────────────────────────────────────── */
    if (resolvedName.length < 2 || resolvedName.length > 50) {
      return res.status(400).json({
        error: 'Name must be between 2 and 50 characters.',
        code:  'INVALID_NAME_LENGTH',
      });
    }

    /* 4. Password strength ────────────────────────────────────── */
    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.valid) {
      return res.status(400).json({
        error:  pwCheck.reason,
        code:   'WEAK_PASSWORD',
        failed: pwCheck.failed,
        hint:   'Use 8+ characters with uppercase, lowercase, a number, and a special character.',
      });
    }

    /* 5. Idempotency lock (30 s) ──────────────────────────────── */
    const lockKey  = K.regLock(normEmail);
    const acquired = await rSetNX(lockKey, '1', TTL.REG_LOCK);
    if (!acquired) {
      return res.status(429).json({
        error: 'A registration for this email is already in progress. Please wait 30 seconds.',
        code:  'REGISTRATION_IN_PROGRESS',
      });
    }

    /* 6. Redis fast duplicate check ───────────────────────────── */
    const cachedUid = await rGet(K.emailToUid(normEmail));
    if (cachedUid) {
      await rDel(lockKey);
      return res.status(409).json({
        error: 'An account with this email already exists.',
        code:  'EMAIL_EXISTS',
        hint:  'Try signing in, or use "Forgot password" if you can\'t remember your credentials.',
      });
    }

    /* 7. Firebase Auth authoritative duplicate check ──────────── */
    const existing = await checkExistingUser(normEmail);
    if (existing.exists) {
      await rDel(lockKey);
      // Prime cache so next attempt is O(1)
      if (existing.uid) await rSet(K.emailToUid(normEmail), existing.uid, TTL.EMAIL_UID);
      return res.status(409).json({
        error: existing.isVerified
          ? 'An account with this email already exists. Please sign in.'
          : 'This email is registered but not yet verified. Check your inbox.',
        code:  existing.isVerified ? 'EMAIL_EXISTS' : 'PENDING_VERIFICATION',
        hint:  existing.isVerified
          ? 'Use "Forgot password" if you\'ve lost access.'
          : 'Didn\'t get the email? Request a new verification link on the login page.',
      });
    }

    /* 8. Create Firebase Auth user ────────────────────────────── */
    const firebaseUser = await admin.auth().createUser({
      email:         normEmail,
      password,
      displayName:   resolvedName,
      emailVerified: false,
      disabled:      false,
    });
    firebaseUid = firebaseUser.uid;

    /* 9. Write RTDB + Firestore in parallel ───────────────────── */
    const userData = { email: normEmail, displayName: resolvedName, ip: getIp(req) };
    await Promise.all([
      writeUserToRTDB(firebaseUid, userData),
      writeUserToFirestore(firebaseUid, userData),
    ]);

    /* 10. Warm Redis cache ─────────────────────────────────────── */
    await cacheNewUser(firebaseUid, normEmail, resolvedName);

    /* 11. Release lock ─────────────────────────────────────────── */
    await rDel(lockKey);

    await sendVerificationEmail({
    userId: firebaseUid,
      email:  normEmail,
      name:   resolvedName,
      ip:     getIp(req),
      req,
    });

    // 12. Send the welcome/onboarding email (explains what happens next)
    sendWelcomeEmail({
      email:       normEmail,
      displayName: resolvedName,
    }).catch(e => console.error('Welcome email failed (non-fatal):', e.message));

    /* 13. Audit log — fire-and-forget ─────────────────────────── */
    AuditLog.record(AuditLog.EVENTS.USER_REGISTERED, {
      userId:    firebaseUid,
      ip:        getIp(req),
      userAgent: getUserAgent(req),
      metadata:  { email: normEmail, role: ROLES.GUEST },
    }).catch(err => console.error('[Audit] register:', err.message));

    /* 14. Success ──────────────────────────────────────────────── */
    return res.status(201).json({
      success:   true,
      message:   'Account created! We\'ve sent a verification email to your inbox.',
      nextSteps: [
        'Check your inbox and click the verification link.',
        'After verification, an admin will review and activate your account.',
        'You\'ll receive a welcome email once approved — usually within 24 hours.',
      ],
      user: {
        uid:         firebaseUid,
        email:       normEmail,
        displayName: resolvedName,
        role:        ROLES.GUEST,
        status:      STATUS.PENDING,
      },
    });

  } catch (err) {
    /* ── ROLLBACK ─────────────────────────────────────────────── */
    if (firebaseUid) await rollbackRegistration(firebaseUid, normEmail);
    if (normEmail)   await rDel(K.regLock(normEmail));

    console.error('[Register] Error:', err.code ?? err.message);

    const mapped = mapFirebaseError(err);
    return res.status(mapped.status).json({ error: mapped.error, code: mapped.code });
  }
};