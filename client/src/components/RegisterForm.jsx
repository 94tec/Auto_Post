// components/RegisterForm.jsx
// ─────────────────────────────────────────────────────────────
// Connected to POST /api/auth/register
// • Shows backend error codes as specific, human-readable messages
// • Password strength meter with rule checklist
// • Idempotency: disables button while submitting
// • Success: 3-step next-steps card before redirect
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiUser, FiMail, FiLock, FiEye, FiEyeOff,
  FiAlertCircle, FiArrowRight, FiRefreshCw, FiCheck,
  FiCheckCircle, FiClock, FiShield, FiInfo,
} from 'react-icons/fi';

const ACCENT  = '#F59E0B';
const ACCENT2 = '#F97316';

/* ── Backend error code → UI message map ───────────────────── */
// Covers every code emitted by registerController + authHelpers + mapFirebaseError
const ERROR_MAP = {
  // Field / validation
  MISSING_FIELDS:           { icon: FiAlertCircle, color: '#f87171', title: 'Missing information',       hint: null },
  MISSING_EMAIL:            { icon: FiMail,        color: '#f87171', title: 'Email required',             hint: 'Please enter your email address.' },
  INVALID_EMAIL:            { icon: FiMail,        color: '#f87171', title: 'Invalid email',              hint: 'Check the format — e.g. you@example.com' },
  EMAIL_TOO_LONG:           { icon: FiMail,        color: '#f87171', title: 'Email too long',             hint: 'Use an address under 254 characters.' },
  INVALID_NAME_LENGTH:      { icon: FiUser,        color: '#f87171', title: 'Name out of range',          hint: 'Between 2 and 50 characters please.' },
  WEAK_PASSWORD:            { icon: FiLock,        color: '#fb923c', title: 'Password too weak',          hint: 'Use uppercase, lowercase, a number, and a symbol.' },
  // Duplicate / state
  EMAIL_EXISTS:             { icon: FiMail,        color: '#fb923c', title: 'Email already registered',   hint: 'Try signing in, or reset your password.' },
  PENDING_VERIFICATION:     { icon: FiClock,       color: ACCENT,   title: 'Email not yet verified',      hint: 'Click the link in your inbox, or use the button below to get a new one.', showResend: true },
  REGISTRATION_IN_PROGRESS: { icon: FiRefreshCw,  color: ACCENT,   title: 'Already in progress',         hint: 'Please wait 30 seconds before trying again.' },
  // Auth / Firebase errors
  INVALID_CREDENTIALS:      { icon: FiLock,        color: '#f87171', title: 'Incorrect credentials',      hint: null },
  TOO_MANY_ATTEMPTS:        { icon: FiAlertCircle, color: '#fb923c', title: 'Too many attempts',          hint: 'Wait a few minutes or reset your password.' },
  ACCOUNT_DISABLED:         { icon: FiShield,      color: '#f87171', title: 'Account disabled',           hint: 'Contact support at hello@damuchi.app.' },
  // Server
  SERVICE_UNAVAILABLE:      { icon: FiShield,      color: '#f87171', title: 'Service unavailable',        hint: 'Account registration is temporarily paused. Try again shortly.' },
  SERVER_ERROR:             { icon: FiAlertCircle, color: '#f87171', title: 'Something went wrong',       hint: 'Please try again or contact support.' },
};

/* ── Password rules ─────────────────────────────────────────── */
const RULES = [
  { label: '8+ characters',     test: (p) => p.length >= 8          },
  { label: 'Uppercase letter',  test: (p) => /[A-Z]/.test(p)        },
  { label: 'Lowercase letter',  test: (p) => /[a-z]/.test(p)        },
  { label: 'Number',            test: (p) => /\d/.test(p)           },
  { label: 'Special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const pwScore  = (p) => RULES.filter(r => r.test(p)).length;
const COLORS   = ['#ef4444','#f97316','#f59e0b','#84cc16','#22c55e'];
const LABELS   = ['Very weak','Weak','Fair','Good','Strong'];

/* ── PasswordStrength ───────────────────────────────────────── */
const PasswordStrength = ({ password }) => {
  if (!password) return null;
  const score = pwScore(password);
  const color = COLORS[score - 1] ?? COLORS[0];
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      className="mt-2.5 space-y-2 overflow-hidden">
      {/* strength bars */}
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div key={i}
            animate={{ background: i < score ? color : 'rgba(255,255,255,0.08)' }}
            transition={{ duration: 0.25 }}
            className="flex-1 h-1 rounded-full" />
        ))}
      </div>
      <p className="text-[11px] font-semibold" style={{ color }}>
        {LABELS[score - 1] ?? 'Very weak'}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {RULES.map(r => {
          const ok = r.test(password);
          return (
            <motion.div key={r.label} className="flex items-center gap-1.5"
              animate={{ opacity: ok ? 1 : 0.5 }}>
              <FiCheck size={9} style={{ color: ok ? '#22c55e' : 'rgba(255,255,255,0.2)' }} />
              <span className="text-[10px]" style={{ color: ok ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.28)' }}>
                {r.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

/* ── ErrorBanner ────────────────────────────────────────────── */
const ErrorBanner = ({ error, code, hint, backendHint, email, onResend, onSwitchToLogin }) => {
  const cfg         = ERROR_MAP[code] ?? ERROR_MAP.SERVER_ERROR;
  const Icon        = cfg.icon;
  const displayHint = backendHint || hint || cfg.hint;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.22 }}
      className="rounded-2xl border p-4 mb-5"
      style={{ background: `${cfg.color}0D`, borderColor: `${cfg.color}30` }}
    >
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
             style={{ background: `${cfg.color}18` }}>
          <Icon size={13} style={{ color: cfg.color }} />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold mb-0.5" style={{ color: cfg.color }}>
            {cfg.title}
          </p>
          <p className="text-[12px] text-white/60 leading-relaxed">{error}</p>
          {displayHint && (
            <p className="text-[11px] mt-1.5 flex items-center gap-1.5"
               style={{ color: `${cfg.color}80` }}>
              <FiInfo size={9} />{displayHint}
            </p>
          )}

          {/* Action buttons for specific codes */}
          {(cfg.showResend || code === 'EMAIL_EXISTS') && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {cfg.showResend && (
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => onResend?.(email)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all"
                  style={{ background: `${ACCENT}14`, borderColor: `${ACCENT}30`, color: ACCENT }}>
                  <FiRefreshCw size={10} />Resend verification
                </motion.button>
              )}
              {code === 'EMAIL_EXISTS' && (
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={onSwitchToLogin}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-white/10 bg-white/5 text-white/55 hover:text-white hover:bg-white/8 transition-all">
                  <FiArrowRight size={10} />Go to sign in
                </motion.button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/* ── SuccessCard ────────────────────────────────────────────── */
const SuccessCard = ({ email, nextSteps }) => (
  <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    className="text-center py-6">
    <motion.div animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 0.5, times: [0, 0.5, 1] }}
      className="w-16 h-16 rounded-[20px] flex items-center justify-center mx-auto mb-5"
      style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)' }}>
      <FiCheckCircle size={30} className="text-green-400" />
    </motion.div>

    <h2 className="text-[20px] font-black text-white mb-2 tracking-tight">You're registered! 🎉</h2>
    <p className="text-[13px] text-white/50 mb-6 leading-relaxed">
      We've sent a verification email to{' '}
      <span className="font-semibold text-white/80">{email}</span>.
    </p>

    {/* next steps */}
    {nextSteps?.length > 0 && (
      <div className="text-left space-y-2.5 mb-6">
        {nextSteps.map((step, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 + 0.2 }}
            className="flex items-start gap-3 p-3 rounded-xl border border-white/6"
            style={{ background: '#0D1220' }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5"
                 style={{ background: `${ACCENT}18`, color: ACCENT }}>{i + 1}</div>
            <p className="text-[12px] text-white/60 leading-relaxed">{step}</p>
          </motion.div>
        ))}
      </div>
    )}

    <p className="text-[11px] text-white/25">
      Can't find the email? Check your spam folder.
    </p>
  </motion.div>
);

/* ── Input field wrapper ────────────────────────────────────── */
const Field = ({ label, icon: Icon, error, children }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-amber-500/70 mb-1.5">
      {label}
    </label>
    <div className="relative">
      <Icon size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
      {children}
    </div>
    <AnimatePresence>
      {error && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1">
          <FiAlertCircle size={10} />{error}
        </motion.p>
      )}
    </AnimatePresence>
  </div>
);

const inputCls = `w-full pl-10 pr-4 py-3 rounded-2xl border border-white/8
                  bg-[#0D1017] text-[13px] text-white/85 placeholder-white/20
                  focus:outline-none focus:border-amber-500/40 focus:ring-1
                  focus:ring-amber-500/15 transition-all`;

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
const RegisterForm = ({ onSwitch }) => {
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPw,      setShowPw]      = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [apiError,    setApiError]    = useState(null); // { error, code, hint }
  const [success,     setSuccess]     = useState(null); // { email, nextSteps }

  const score      = pwScore(form.password);
  const canSubmit  = !submitting && form.name.trim() && form.email.trim() && score >= 3;

  const set = (k) => (e) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    if (fieldErrors[k]) setFieldErrors(fe => ({ ...fe, [k]: undefined }));
    if (apiError) setApiError(null);
  };

  /* ── Resend verification (from error banner) ────────────── */
  const handleResend = async (email) => {
    if (!email) return;
    try {
      const res  = await fetch('/api/auth/resend-verification', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      toast.success(data.message || 'Verification email sent! Check your inbox.', { duration: 5000 });
      setApiError(null);
    } catch {
      toast.error('Could not resend. Please try again.');
    }
  };

  /* ── client-side validation before hitting the network ──── */
  const validateLocally = () => {
    const errors = {};
    if (!form.name.trim())           errors.name    = 'Name is required.';
    else if (form.name.trim().length < 2) errors.name = 'Name is too short.';
    if (!form.email.trim())          errors.email   = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email.';
    if (!form.password)              errors.password= 'Password is required.';
    else if (score < 3)              errors.password= 'Password is too weak — see checklist below.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError(null);
    if (!validateLocally()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:     form.name.trim(),
          email:    form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Map specific field errors from backend
        if (data.missing?.includes('email'))    setFieldErrors(fe => ({ ...fe, email:    data.error }));
        if (data.missing?.includes('password')) setFieldErrors(fe => ({ ...fe, password: data.error }));
        if (data.missing?.includes('name'))     setFieldErrors(fe => ({ ...fe, name:     data.error }));
        if (data.failed)                        setFieldErrors(fe => ({ ...fe, password: data.error }));

        setApiError({
          error: data.error || 'Registration failed.',
          code:  data.code  || 'SERVER_ERROR',
          hint:  data.hint  || null,
        });
        return;
      }

      // ── SUCCESS ──────────────────────────────────────────────
      toast.success('Account created! Check your inbox.', { duration: 5000 });
      setSuccess({ email: data.user?.email || form.email, nextSteps: data.nextSteps });

      // Redirect after user has read the success card (1.5s — not 4.5s)
      setTimeout(() => {
        navigate('/auth/verify-pending', { replace: true });
      }, 1500);

    } catch (err) {
      // Network / parse error
      setApiError({
        error: 'Could not reach the server. Check your connection and try again.',
        code:  'SERVER_ERROR',
        hint:  null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[28px] border border-white/10 overflow-hidden"
         style={{ background: '#141924', boxShadow: '0 40px 80px rgba(0,0,0,0.55)' }}>

      {/* amber top bar */}
      <div className="h-[3px]"
           style={{ background: `linear-gradient(to right,${ACCENT},${ACCENT2},transparent)` }} />

      <div className="px-8 pt-8 pb-6">

        {/* logo */}
        <div className="flex items-center gap-2.5 mb-7">
          <div className="w-9 h-9 rounded-[11px] flex items-center justify-center font-black text-[16px]"
               style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, color: '#0A0E1A' }}>
            D
          </div>
          <span className="font-extrabold text-[18px] tracking-tight text-white">
            Damu<span style={{ color: ACCENT }}>chi</span>
          </span>
        </div>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SuccessCard email={success.email} nextSteps={success.nextSteps} />
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h1 className="text-[24px] font-black text-white mb-1 tracking-tight">Create account</h1>
              <p className="text-[13px] text-white/40 mb-6">Join Damuchi — free, no credit card.</p>

              {/* API error banner */}
              <AnimatePresence>
                {apiError && (
                  <ErrorBanner
                    error={apiError.error}
                    code={apiError.code}
                    backendHint={apiError.hint}
                    email={form.email.trim().toLowerCase()}
                    onResend={handleResend}
                    onSwitchToLogin={onSwitch}
                  />
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>

                {/* Name */}
                <Field label="Full name" icon={FiUser} error={fieldErrors.name}>
                  <input type="text" value={form.name} onChange={set('name')}
                    placeholder="Your name" autoComplete="name"
                    className={inputCls} />
                </Field>

                {/* Email */}
                <Field label="Email address" icon={FiMail} error={fieldErrors.email}>
                  <input type="email" value={form.email} onChange={set('email')}
                    placeholder="you@example.com" autoComplete="email"
                    className={inputCls} />
                </Field>

                {/* Password */}
                <Field label="Password" icon={FiLock} error={fieldErrors.password}>
                  <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')}
                    placeholder="••••••••" autoComplete="new-password"
                    className={`${inputCls} pr-10`} />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/55 transition-colors">
                    {showPw ? <FiEyeOff size={13} /> : <FiEye size={13} />}
                  </button>
                </Field>

                {form.password && <PasswordStrength password={form.password} />}

                {/* Submit */}
                <motion.button
                  whileHover={canSubmit ? { scale: 1.01 } : {}}
                  whileTap={canSubmit   ? { scale: 0.98 } : {}}
                  type="submit" disabled={!canSubmit}
                  className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-2xl
                             font-bold text-[14px] text-gray-950 transition-all
                             disabled:opacity-35 disabled:cursor-not-allowed"
                  style={{ background: `linear-gradient(to right,${ACCENT},${ACCENT2})` }}>
                  {submitting
                    ? <><FiRefreshCw size={13} className="animate-spin"/>Creating account…</>
                    : <><FiArrowRight size={13}/>Create account</>
                  }
                </motion.button>
              </form>

              {/* Trust indicators */}
              <div className="flex items-center justify-center gap-4 mt-5">
                {[
                  { icon: FiShield,       label: 'Secure' },
                  { icon: FiCheckCircle,  label: 'No spam' },
                  { icon: FiLock,         label: 'Private' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-[10px] text-white/20">
                    <Icon size={10} className="text-green-400/40" />{label}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* footer */}
      {!success && (
        <div className="px-8 py-5 border-t border-white/6 flex items-center justify-between"
             style={{ background: 'rgba(0,0,0,0.2)' }}>
          <p className="text-[12px] text-white/35">
            Already have an account?{' '}
            <button onClick={onSwitch}
              className="text-amber-500/70 hover:text-amber-500 font-semibold transition-colors">
              Sign in
            </button>
          </p>
          <p className="text-[10px] text-white/18">
            By signing up you agree to our{' '}
            <a href="/docs" className="text-amber-500/40 hover:text-amber-500/70 transition-colors">Terms</a>
          </p>
        </div>
      )}
    </div>
  );
};

export default RegisterForm;