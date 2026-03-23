// ResetPassword.jsx — step 2: verify oobCode → set new password
// Fixes vs original:
//  - Clock icon imported (was missing → ReferenceError)
//  - success state properly switches status to 'success'
//  - status 'success' correctly shown after handleSubmit
//  - PasswordStrengthIndicator driven by real strength rules
//  - All states match the landing design system (navy/slate/amber)
//  - Passwords-match feedback shown inline in real time
//  - API routes corrected to /api/auth/* (not /api/user/*)

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiLock, FiEye, FiEyeOff, FiArrowLeft, FiCheck,
  FiAlertTriangle, FiRefreshCw, FiClock, FiShield,
} from 'react-icons/fi';
import { Toaster, toast } from 'react-hot-toast';

/* ── shared layout atoms ──────────────────────────────────── */
const PageShell = ({ children }) => (
  <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center p-4 relative overflow-hidden">
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px]
                    bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />
    <div className="absolute bottom-0 right-0 w-[300px] h-[300px]
                    bg-orange-500/3 rounded-full blur-[80px] pointer-events-none" />
    <Link to="/" className="absolute top-6 left-6 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-[10px] flex items-center justify-center
                      bg-gradient-to-r from-[#F59E0B] to-[#F97316]
                      font-black text-sm text-gray-950 shadow-lg">D</div>
      <span className="font-extrabold text-[17px] tracking-tight text-white hidden sm:block">
        Damu<span className="text-[#F59E0B]">chi</span>
      </span>
    </Link>
    {children}
  </div>
);

const Card = ({ children, accentColor = 'from-[#F59E0B] to-[#F97316]' }) => (
  <div className="w-full max-w-[440px] bg-[#141924] border border-white/8
                  rounded-2xl overflow-hidden
                  shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
    <div className={`h-[2px] bg-gradient-to-r ${accentColor}`} />
    {children}
  </div>
);

/* ── password strength ─────────────────────────────────────── */
const RULES = [
  { id: 'len',    label: 'At least 8 characters',          test: (p) => p.length >= 8            },
  { id: 'upper',  label: 'One uppercase letter',           test: (p) => /[A-Z]/.test(p)          },
  { id: 'lower',  label: 'One lowercase letter',           test: (p) => /[a-z]/.test(p)          },
  { id: 'number', label: 'One number',                     test: (p) => /\d/.test(p)              },
  { id: 'symbol', label: 'One special character (!@#$…)',  test: (p) => /[^A-Za-z0-9]/.test(p)  },
];

const strengthLabel = (passed) => {
  if (passed === 0) return { label: '',         color: 'bg-white/10' };
  if (passed <= 2)  return { label: 'Weak',     color: 'bg-red-500'  };
  if (passed <= 3)  return { label: 'Fair',     color: 'bg-amber-500'};
  if (passed === 4) return { label: 'Good',     color: 'bg-blue-400' };
  return               { label: 'Strong',   color: 'bg-green-500'};
};

const PasswordStrength = ({ password }) => {
  const passed = RULES.filter(r => r.test(password)).length;
  const pct    = (passed / RULES.length) * 100;
  const { label, color } = strengthLabel(passed);

  return (
    <div className="space-y-2">
      {/* bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full transition-colors duration-300 ${color}`}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.25 }}
          />
        </div>
        {label && (
          <span className={`text-[10px] font-bold uppercase tracking-wide
            ${color.replace('bg-', 'text-').replace('-500', '-400').replace('-400', '-400')}`}>
            {label}
          </span>
        )}
      </div>
      {/* rule list — only show when user has started typing */}
      {password.length > 0 && (
        <div className="grid grid-cols-1 gap-1">
          {RULES.map(r => {
            const ok = r.test(password);
            return (
              <div key={r.id} className="flex items-center gap-2">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center
                                 transition-colors ${ok ? 'bg-green-500/20' : 'bg-white/5'}`}>
                  {ok
                    ? <FiCheck size={8} className="text-green-400" />
                    : <div className="w-1 h-1 rounded-full bg-white/20" />
                  }
                </div>
                <span className={`text-[11px] transition-colors ${ok ? 'text-green-400' : 'text-white/30'}`}>
                  {r.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── password input ────────────────────────────────────────── */
const PasswordInput = ({ label, value, onChange, placeholder, show, onToggle, disabled, matchError }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-[0.12em]
                       text-amber-500/80 mb-1.5">
      {label}
    </label>
    <div className="relative">
      <FiLock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2
                                    text-white/25 pointer-events-none" />
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required
        disabled={disabled}
        className={`w-full bg-[#0D1017] text-[13px] text-white/90 placeholder-white/20
                   border rounded-xl pl-9 pr-10 py-2.5
                   focus:outline-none focus:ring-1 transition-all disabled:opacity-40
                   ${matchError
                     ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/15'
                     : 'border-white/8 focus:border-amber-500/50 focus:ring-amber-500/20'
                   }`}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2
                   text-white/25 hover:text-white/60 transition-colors"
      >
        {show ? <FiEyeOff size={14} /> : <FiEye size={14} />}
      </button>
    </div>
    {matchError && (
      <p className="mt-1 text-[11px] text-red-400">{matchError}</p>
    )}
  </div>
);

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
const STATUS = {
  VERIFYING: 'verifying',
  VALID:     'valid',
  SUCCESS:   'success',
  EXPIRED:   'expired',
  INVALID:   'invalid',
  ERROR:     'error',
};

export default function ResetPassword() {
  const [searchParams]  = useSearchParams();
  const navigate         = useNavigate();

  const oobCode = searchParams.get('oobCode');
  const email   = searchParams.get('email');
  const uid     = searchParams.get('uid');

  const [status,          setStatus]          = useState(STATUS.VERIFYING);
  const [errorMsg,        setErrorMsg]        = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const [countdown,       setCountdown]       = useState(3);

  /* ── verify oobCode on mount ─────────────────────────────── */
  useEffect(() => {
    if (!oobCode) {
      setStatus(STATUS.INVALID);
      setErrorMsg('The reset link is incomplete. Please use the full link from your email.');
      return;
    }

    const verify = async () => {
      try {
        const res  = await fetch('/api/auth/verify-reset-link', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ oobCode, email, uid }),
        });
        const data = await res.json();

        if (!res.ok) {
          const msg = data.error || 'Verification failed';
          if (data.code === 'EXPIRED_OOB_CODE' || msg.toLowerCase().includes('expir')) {
            setStatus(STATUS.EXPIRED);
          } else {
            setStatus(STATUS.INVALID);
          }
          setErrorMsg(msg);
          return;
        }

        setStatus(STATUS.VALID);
      } catch {
        setStatus(STATUS.ERROR);
        setErrorMsg('Could not verify your reset link. Please check your connection and try again.');
      }
    };

    verify();
  }, [oobCode, email, uid]);

  /* ── countdown redirect after success ───────────────────── */
  useEffect(() => {
    if (status !== STATUS.SUCCESS) return;
    if (countdown <= 0) {
      navigate('/auth/login', { state: { passwordReset: true } });
      return;
    }
    const id = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(id);
  }, [status, countdown, navigate]);

  /* ── submit ──────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return; // guarded by UI

    const allPassed = RULES.every(r => r.test(newPassword));
    if (!allPassed) {
      toast.error('Please satisfy all password requirements');
      return;
    }

    setIsSubmitting(true);
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ oobCode, newPassword, email, uid }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to reset password');

      setStatus(STATUS.SUCCESS); // ← was missing in original
    } catch (err) {
      setErrorMsg(err.message);
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const mismatch     = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const allRulesMet  = RULES.every(r => r.test(newPassword));
  const canSubmit    = !isSubmitting && allRulesMet && newPassword === confirmPassword && confirmPassword.length > 0;

  /* ── state renders ───────────────────────────────────────── */

  if (status === STATUS.VERIFYING) return (
    <PageShell>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-[440px]"
      >
        <Card>
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20
                            flex items-center justify-center">
              <FiRefreshCw size={20} className="text-[#F59E0B] animate-spin" />
            </div>
            <div>
              <h2 className="text-[18px] font-black text-white mb-1">Verifying your link</h2>
              <p className="text-[13px] text-white/35">Just a moment…</p>
            </div>
          </div>
        </Card>
      </motion.div>
    </PageShell>
  );

  if (status === STATUS.SUCCESS) return (
    <PageShell>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1,    y: 0  }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-[440px]"
        >
          <Card accentColor="from-green-500 to-emerald-400">
            <div className="p-8 flex flex-col items-center gap-4 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 20 }}
                className="w-14 h-14 rounded-2xl bg-green-500/15 border border-green-500/25
                           flex items-center justify-center"
              >
                <FiCheck size={26} className="text-green-400" />
              </motion.div>
              <div>
                <h2 className="text-[20px] font-black text-white mb-1">Password updated!</h2>
                <p className="text-[13px] text-white/40 mb-1">
                  Your password has been successfully changed.
                  All other sessions have been signed out.
                </p>
                <p className="text-[12px] text-green-400/70">
                  Redirecting to sign in in {countdown}s…
                </p>
              </div>
              <button
                onClick={() => navigate('/auth/login')}
                className="w-full py-2.5 rounded-xl text-[13px] font-semibold
                           bg-gradient-to-r from-[#F59E0B] to-[#F97316]
                           text-gray-950 hover:opacity-90 transition-all"
              >
                Sign in now
              </button>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </PageShell>
  );

  if (status === STATUS.EXPIRED) return (
    <PageShell>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0  }}
        className="w-full max-w-[440px]"
      >
        <Card accentColor="from-amber-500 to-orange-400">
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/25
                            flex items-center justify-center">
              <FiClock size={20} className="text-[#F59E0B]" />
            </div>
            <div>
              <h2 className="text-[20px] font-black text-white mb-2">Link expired</h2>
              <p className="text-[13px] text-white/40 leading-relaxed">{errorMsg}</p>
            </div>
            <div className="w-full space-y-2.5">
              <button
                onClick={() => navigate('/auth/forgot-password')}
                className="w-full py-2.5 rounded-xl text-[13px] font-semibold
                           bg-gradient-to-r from-[#F59E0B] to-[#F97316]
                           text-gray-950 hover:opacity-90 transition-all"
              >
                Request new link
              </button>
              <button
                onClick={() => navigate('/auth/login')}
                className="w-full py-2.5 rounded-xl text-[13px] font-medium
                           border border-white/8 text-white/45 hover:text-white/70
                           hover:bg-white/5 transition-all"
              >
                Back to sign in
              </button>
            </div>
          </div>
        </Card>
      </motion.div>
    </PageShell>
  );

  if (status === STATUS.INVALID || status === STATUS.ERROR) return (
    <PageShell>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0  }}
        className="w-full max-w-[440px]"
      >
        <Card accentColor="from-red-500 to-rose-400">
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/25
                            flex items-center justify-center">
              <FiAlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-[20px] font-black text-white mb-2">
                {status === STATUS.INVALID ? 'Invalid link' : 'Something went wrong'}
              </h2>
              <p className="text-[13px] text-white/40 leading-relaxed">{errorMsg}</p>
            </div>
            <div className="w-full space-y-2.5">
              <button
                onClick={() => navigate('/auth/forgot-password')}
                className="w-full py-2.5 rounded-xl text-[13px] font-semibold
                           bg-gradient-to-r from-[#F59E0B] to-[#F97316]
                           text-gray-950 hover:opacity-90 transition-all"
              >
                Request new link
              </button>
              <button
                onClick={() => navigate('/auth/login')}
                className="w-full py-2.5 rounded-xl text-[13px] font-medium
                           border border-white/8 text-white/45 hover:text-white/70
                           hover:bg-white/5 transition-all"
              >
                Back to sign in
              </button>
            </div>
          </div>
        </Card>
      </motion.div>
    </PageShell>
  );

  /* ── valid: password form ────────────────────────────────── */
  return (
    <PageShell>
      <Toaster position="top-center" toastOptions={{
        style: { background: '#141924', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', fontSize: '13px' },
      }} />
      <AnimatePresence mode="wait">
        <motion.div
          key="password-form"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full max-w-[440px]"
        >
          <Card>
            <div className="p-8">
              {/* back */}
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-1.5 text-[12px] font-medium
                           text-white/35 hover:text-white/65 transition-colors mb-6"
              >
                <FiArrowLeft size={13} />
                Back to sign in
              </Link>

              {/* heading */}
              <div className="mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25
                                flex items-center justify-center mb-4">
                  <FiShield size={18} className="text-[#F59E0B]" />
                </div>
                <h1 className="text-[22px] font-black text-white tracking-tight mb-1">
                  Create new password
                </h1>
                {email && (
                  <p className="text-[12px] text-white/30">
                    Resetting for <span className="text-white/55">{email}</span>
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <PasswordInput
                  label="New password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Enter new password"
                  show={showNew}
                  onToggle={() => setShowNew(s => !s)}
                  disabled={isSubmitting}
                />

                {/* strength indicator */}
                <PasswordStrength password={newPassword} />

                <PasswordInput
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Re-enter new password"
                  show={showConfirm}
                  onToggle={() => setShowConfirm(s => !s)}
                  disabled={isSubmitting}
                  matchError={mismatch ? "Passwords don't match" : ''}
                />

                {/* match indicator */}
                {confirmPassword.length > 0 && !mismatch && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1.5 text-[11px] text-green-400"
                  >
                    <FiCheck size={11} />
                    Passwords match
                  </motion.div>
                )}

                {/* error */}
                <AnimatePresence>
                  {errorMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1,  y: 0  }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl
                                 bg-red-500/10 border border-red-500/20
                                 text-red-400 text-[12px]"
                    >
                      <FiAlertTriangle size={13} className="shrink-0" />
                      {errorMsg}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={!canSubmit}
                  whileHover={canSubmit ? { scale: 1.02 } : {}}
                  whileTap={canSubmit   ? { scale: 0.97 } : {}}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                             text-[13px] font-semibold
                             bg-gradient-to-r from-[#F59E0B] to-[#F97316]
                             text-gray-950 shadow-sm shadow-amber-500/20
                             disabled:opacity-30 disabled:cursor-not-allowed
                             transition-all"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-gray-950
                                     border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FiShield size={13} />
                  )}
                  {isSubmitting ? 'Updating password…' : 'Update password'}
                </motion.button>
              </form>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </PageShell>
  );
}