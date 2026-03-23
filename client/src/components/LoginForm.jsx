/**
 * components/LoginForm.jsx
 * ═══════════════════════════════════════════════════════════════
 * Card component rendered by AuthPage at /auth/login.
 * Merges LoginPage's full state-aware error system with
 * LoginForm's Google OAuth, onSwitch prop, and card layout.
 *
 * WHAT'S DIFFERENT FROM THE OLD LoginForm
 * ───────────────────────────────────────────────────────────────
 *  • Uses authApi.login (backend session flow) instead of
 *    signInWithEmailAndPassword directly. authApi.login calls
 *    signInWithCustomToken internally so onAuthStateChanged fires.
 *  • Full BANNER map → every backend error code has a distinct
 *    icon, colour, title, hint, and optional action button.
 *  • Inline field errors (per-field) on top of the global banner.
 *  • mustChangePassword routing → /auth/change-password.
 *  • EMAIL_NOT_VERIFIED / AWAITING_APPROVAL → inline resend button.
 *  • ACCOUNT_SUSPENDED → support email link.
 *  • TOO_MANY_ATTEMPTS → direct link to forgot-password.
 *  • canSubmit computed properly (not just !submitting).
 *  • Google OAuth preserved from old LoginForm (unchanged).
 *
 * PROPS
 * ───────────────────────────────────────────────────────────────
 *  onSwitch  — called when user clicks "Sign up free" (swaps tab)
 * ═══════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../utils/api';
import toast from 'react-hot-toast';
import {
  FiMail, FiLock, FiEye, FiEyeOff,
  FiAlertCircle, FiArrowRight, FiRefreshCw, FiShield,
  FiClock, FiInfo, FiAlertTriangle, FiSlash,
} from 'react-icons/fi';

const ACCENT  = '#F59E0B';
const ACCENT2 = '#F97316';

/* ════════════════════════════════════════════════════════════════
   BANNER MAP — every code loginController can emit
════════════════════════════════════════════════════════════════ */
const BANNER = {
  /* ── Credentials ─────────────────────────────────────────── */
  INVALID_CREDENTIALS: {
    icon:  FiAlertCircle,
    color: '#f87171',
    title: 'Incorrect email or password',
    hint:  null,
  },
  MISSING_CREDENTIALS: {
    icon:  FiAlertCircle,
    color: '#f87171',
    title: 'Missing credentials',
    hint:  null,
  },

  /* ── Account states ──────────────────────────────────────── */
  ACCOUNT_SUSPENDED: {
    icon:   FiSlash,
    color:  '#f87171',
    title:  'Account suspended',
    hint:   'Contact hello@damuchi.app to appeal.',
    action: { label: 'Email support', href: 'mailto:hello@damuchi.app' },
  },
  EMAIL_NOT_VERIFIED: {
    icon:       FiMail,
    color:      ACCENT,
    title:      'Email not verified',
    hint:       'Check your inbox for the verification link.',
    showResend: true,
  },
  AWAITING_APPROVAL: {
    icon:  FiClock,
    color: '#818CF8',
    title: 'Awaiting admin approval',
    hint:  'Your email is verified. An admin will review your account — usually within 24 hours.',
  },
  PENDING_ACTIVATION: {
    icon:       FiClock,
    color:      ACCENT,
    title:      'Account setup incomplete',
    hint:       'Check your inbox for a verification link.',
    showResend: true,
  },

  /* ── Auth / rate limiting ─────────────────────────────────── */
  TOO_MANY_ATTEMPTS: {
    icon:   FiAlertTriangle,
    color:  '#fb923c',
    title:  'Too many failed attempts',
    hint:   'Your account is temporarily locked.',
    action: { label: 'Reset password', to: '/auth/forgot-password' },
  },
  INVALID_EMAIL: {
    icon:  FiAlertCircle,
    color: '#f87171',
    title: 'Invalid email address',
    hint:  null,
  },
  USER_RECORD_MISSING: {
    icon:  FiAlertCircle,
    color: '#f87171',
    title: 'Profile error',
    hint:  'Contact support — your account profile could not be loaded.',
  },
  SERVER_ERROR: {
    icon:  FiAlertCircle,
    color: '#f87171',
    title: 'Something went wrong',
    hint:  'Please try again. If this persists, contact support.',
  },
};

/* ════════════════════════════════════════════════════════════════
   ErrorBanner — state-aware, with inline action buttons
════════════════════════════════════════════════════════════════ */
const ErrorBanner = ({ code, message, hint: backendHint, email, onResend }) => {
  const cfg  = BANNER[code] ?? BANNER.SERVER_ERROR;
  const Icon = cfg.icon;
  const hint = backendHint || cfg.hint;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{   opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.22 }}
      className="rounded-2xl border p-4 mb-5"
      style={{ background: `${cfg.color}0D`, borderColor: `${cfg.color}30` }}
    >
      <div className="flex items-start gap-3">
        {/* icon */}
        <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
             style={{ background: `${cfg.color}18` }}>
          <Icon size={13} style={{ color: cfg.color }} />
        </div>

        <div className="flex-1">
          <p className="text-[13px] font-semibold mb-0.5" style={{ color: cfg.color }}>
            {cfg.title}
          </p>
          <p className="text-[12px] text-white/60 leading-relaxed">{message}</p>
          {hint && (
            <p className="text-[11px] mt-1.5 flex items-start gap-1.5"
               style={{ color: `${cfg.color}80` }}>
              <FiInfo size={9} className="mt-0.5 shrink-0" />{hint}
            </p>
          )}

          {/* ── Contextual action buttons ── */}
          {(cfg.showResend || cfg.action) && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {cfg.showResend && email && (
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => onResend?.(email)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px]
                             font-semibold border transition-all"
                  style={{
                    background:  `${ACCENT}14`,
                    borderColor: `${ACCENT}30`,
                    color:       ACCENT,
                  }}>
                  <FiRefreshCw size={10} />Resend verification
                </motion.button>
              )}
              {cfg.action?.to && (
                <Link to={cfg.action.to}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px]
                             font-semibold border border-white/10 bg-white/5 text-white/55
                             hover:text-white hover:bg-white/8 transition-all">
                  <FiArrowRight size={10} />{cfg.action.label}
                </Link>
              )}
              {cfg.action?.href && (
                <a href={cfg.action.href}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px]
                             font-semibold border border-white/10 bg-white/5 text-white/55
                             hover:text-white hover:bg-white/8 transition-all">
                  <FiArrowRight size={10} />{cfg.action.label}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════════════════════════
   Input class helper — highlights red on field error
════════════════════════════════════════════════════════════════ */
const inputCls = (hasError = false) =>
  `w-full pl-10 pr-4 py-3 rounded-2xl border bg-[#0D1017] text-[13px]
   text-white/85 placeholder-white/20 focus:outline-none transition-all
   ${hasError
     ? 'border-red-500/40 focus:border-red-500/60 focus:ring-1 focus:ring-red-500/15'
     : 'border-white/8 focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/15'
   }`;

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════ */
const LoginForm = ({ onSwitch }) => {
  const { user, loading, roleReady } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || '/';

  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [showPw,        setShowPw]        = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Global banner error { code, error, hint, email, userState }
  const [apiErr,   setApiErr]   = useState(null);
  // Inline per-field errors { email?, password? }
  const [fieldErr, setFieldErr] = useState({});

  /* ── Session-expired toast ────────────────────────────────── */
  useEffect(() => {
    if (location.state?.sessionExpired) {
      toast('Session expired. Please sign in again.', {
        id:    'session-expired',
        icon:  '🔒',
        style: {
          background: '#141924',
          color:      'rgba(255,255,255,0.7)',
          border:     '1px solid rgba(255,255,255,0.08)',
          fontSize:   '13px',
        },
      });
    }
    if (location.state?.forcedOut) {
      toast.error('Signed out for security. Please sign in again.', { id: 'forced-out' });
    }
  }, [location.state]);

  /* ── Redirect already-authenticated users ─────────────────── */
  useEffect(() => {
    if (loading || !user || !roleReady) return;  // ← wait for role fetch
    
    console.log('🧭 Redirect check:', {
      roleReady,
      mustChangePassword: user.mustChangePassword,
      adminApproved:      user.adminApproved,
      emailVerified:      user.emailVerified,
      status:             user.status,
      from,
    });

    if (user.mustChangePassword) {
      navigate('/auth/change-password', { replace: true });
      return;
    }
    if (user.adminApproved) {
      navigate(from === '/auth/login' ? '/' : from, { replace: true });
      return;
    }
    if (!user.emailVerified) {
      navigate('/auth/verify-pending', { replace: true });
      return;
    }
    if (!user.adminApproved) {
      navigate('/guest', { replace: true });
      return;
    }
    navigate(from === '/auth/login' ? '/' : from, { replace: true });
  }, [user, loading, roleReady]);


  /* ── Resend verification email ────────────────────────────── */
  const handleResend = async (emailAddr) => {
    try {
      await authApi.resendVerification(emailAddr || email.trim().toLowerCase());
      toast.success('Verification email sent! Check your inbox.', { duration: 5000 });
      setApiErr(null);
    } catch (err) {
      toast.error(err.message || 'Could not resend. Please try again.');
    }
  };

  /* ── Email + password submit ──────────────────────────────── */
  const handleLogin = async (e) => {
    e.preventDefault();
    setApiErr(null);
    setFieldErr({});

    // Client-side field validation first
    const trimEmail = email.trim().toLowerCase();
    const errs      = {};
    if (!trimEmail) errs.email    = 'Email is required.';
    if (!password)  errs.password = 'Password is required.';
    if (Object.keys(errs).length) { setFieldErr(errs); return; }

    setSubmitting(true);
    try {
      // authApi.login → POST /api/auth/login → gets customToken → signInWithCustomToken
      // onAuthStateChanged fires → AuthContext + Redux update
      const data = await authApi.login({ email: trimEmail, password });

      // Admin created by another admin must change temp password
      if (data.mustChangePassword) {
        toast('You must change your password before continuing.', {
          id:       'must-change-pw',
          icon:     '🔐',
          duration: 6000,
          style: {
            background: '#141924',
            color:      'rgba(255,255,255,0.7)',
            border:     '1px solid rgba(255,255,255,0.08)',
            fontSize:   '13px',
          },
        });
        navigate('/auth/change-password', { replace: true });
        return;
      }

      // Normal success — useEffect above handles redirect via updated user state
      toast.success(
        `Welcome back, ${data.user?.displayName?.split(' ')[0] || 'back'}!`,
        { duration: 3000 },
      );

    } catch (err) {
      // ApiError shape: { code, message, hint, status }
      setApiErr({
        code:      err.code      || 'SERVER_ERROR',
        error:     err.message,
        hint:      err.hint      || null,
        email:     trimEmail,     // pre-fill resend button
        userState: err.userState ?? null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Google OAuth ─────────────────────────────────────────── */
  const handleGoogle = async () => {
    setGoogleLoading(true);
    setApiErr(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      // onAuthStateChanged in AuthContext handles the redirect
    } catch (err) {
      // Map common Google popup errors
      const googleMsg = {
        'auth/popup-closed-by-user':       'Sign-in popup was closed. Try again.',
        'auth/cancelled-popup-request':    'Another sign-in is in progress.',
        'auth/network-request-failed':     'Network error. Check your connection.',
        'auth/popup-blocked':              'Popup blocked by your browser. Allow popups and retry.',
        'auth/account-exists-with-different-credential':
          'An account already exists with this email using a different sign-in method.',
      }[err.code] ?? 'Google sign-in failed. Please try again.';

      setApiErr({ code: 'SERVER_ERROR', error: googleMsg, hint: null, email: '' });
    } finally {
      setGoogleLoading(false);
    }
  };

  const busy      = submitting || googleLoading;
  const canSubmit = !busy && email.trim().length > 0 && password.length > 0;

  /* ─────────────────────────────────────────────────────────── */
  return (
    <div className="rounded-[28px] border border-white/10 overflow-hidden"
         style={{ background: '#141924', boxShadow: '0 40px 80px rgba(0,0,0,0.55)' }}>

      {/* amber top bar */}
      <div className="h-[3px]"
           style={{ background: `linear-gradient(to right,${ACCENT},${ACCENT2},transparent)` }} />

      <div className="px-8 pt-8 pb-6">

        {/* logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-[11px] flex items-center justify-center font-black text-[16px]"
               style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, color: '#0A0E1A' }}>
            D
          </div>
          <span className="font-extrabold text-[18px] tracking-tight text-white">
            Damu<span style={{ color: ACCENT }}>chi</span>
          </span>
        </div>

        <h1 className="text-[24px] font-black text-white mb-1 tracking-tight">Welcome back</h1>
        <p className="text-[13px] text-white/40 mb-7">Sign in to your account to continue.</p>

        {/* ── State-aware error / info banner ── */}
        <AnimatePresence mode="wait">
          {apiErr && (
            <ErrorBanner
              key={apiErr.code}
              code={apiErr.code}
              message={apiErr.error}
              hint={apiErr.hint}
              email={apiErr.email}
              onResend={handleResend}
            />
          )}
        </AnimatePresence>

        {/* ── Google OAuth ── */}
        <motion.button
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
          onClick={handleGoogle}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl
                     border border-white/10 bg-white/5 hover:bg-white/8
                     text-[13px] font-medium text-white/70 hover:text-white
                     transition-all disabled:opacity-40 mb-4"
        >
          {googleLoading
            ? <FiRefreshCw size={14} className="animate-spin text-white/50" />
            : (
              <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )
          }
          Continue with Google
        </motion.button>

        {/* ── Divider ── */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-[11px] text-white/25">or email</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        {/* ── Email + password form ── */}
        <form onSubmit={handleLogin} className="space-y-3" noValidate>

          {/* Email */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.12em]
                              text-amber-500/70 mb-1.5">
              Email
            </label>
            <div className="relative">
              <FiMail size={13}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: fieldErr.email ? '#f87171' : 'rgba(255,255,255,0.3)' }} />
              <input
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setFieldErr(f => ({ ...f, email: undefined }));
                  if (apiErr?.code === 'INVALID_EMAIL') setApiErr(null);
                }}
                placeholder="you@example.com"
                autoComplete="email"
                className={inputCls(!!fieldErr.email)}
              />
            </div>
            <AnimatePresence>
              {fieldErr.email && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                  <FiAlertCircle size={9} />{fieldErr.email}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-500/70">
                Password
              </label>
              <Link to="/auth/forgot-password"
                className="text-[12px] text-amber-500/60 hover:text-amber-500 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <FiLock size={13}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: fieldErr.password ? '#f87171' : 'rgba(255,255,255,0.3)' }} />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setFieldErr(f => ({ ...f, password: undefined }));
                  setApiErr(null);
                }}
                placeholder="••••••••"
                autoComplete="current-password"
                className={`${inputCls(!!fieldErr.password)} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2
                           text-white/30 hover:text-white/55 transition-colors"
              >
                {showPw ? <FiEyeOff size={13} /> : <FiEye size={13} />}
              </button>
            </div>
            <AnimatePresence>
              {fieldErr.password && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                  <FiAlertCircle size={9} />{fieldErr.password}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Submit */}
          <motion.button
            whileHover={canSubmit ? { scale: 1.01 } : {}}
            whileTap={canSubmit   ? { scale: 0.98 } : {}}
            type="submit"
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
                       font-bold text-[14px] text-gray-950 transition-all
                       disabled:opacity-35 disabled:cursor-not-allowed"
            style={{ background: `linear-gradient(to right,${ACCENT},${ACCENT2})` }}
          >
            {submitting
              ? <><FiRefreshCw size={13} className="animate-spin" />Signing in…</>
              : <><FiArrowRight size={13} />Sign in</>
            }
          </motion.button>
        </form>
      </div>

      {/* footer — sign up switcher */}
      <div className="px-8 py-5 border-t border-white/6 flex items-center justify-between"
           style={{ background: 'rgba(0,0,0,0.2)' }}>
        <p className="text-[12px] text-white/35">
          No account?{' '}
          <button
            onClick={onSwitch}
            className="text-amber-500/70 hover:text-amber-500 font-semibold transition-colors"
          >
            Sign up free
          </button>
        </p>
        <Link to="/guest"
          className="text-[12px] text-white/25 hover:text-white/45 transition-colors
                     flex items-center gap-1">
          Browse as guest <FiArrowRight size={10} />
        </Link>
      </div>

      {/* trust strip */}
      <div className="flex items-center justify-center gap-4 px-8 py-3 border-t border-white/4">
        {['Firebase Auth', 'Encrypted', 'No credit card'].map(t => (
          <div key={t} className="flex items-center gap-1 text-[10px] text-white/18">
            <FiShield size={9} className="text-green-400/35" />{t}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoginForm;