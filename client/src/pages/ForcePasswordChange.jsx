/**
 * pages/ForcePasswordChange.jsx
 * ═══════════════════════════════════════════════════════════════
 * Shown when admin.mustChangePassword === true.
 * Enforced by AuthGuard — all protected routes redirect here
 * until the password is changed.
 *
 * ON SUCCESS
 * ───────────────────────────────────────────────────────────────
 *  1. POST /api/users/change-password  → clears mustChangePassword
 *  2. All other sessions revoked       (Admin SDK revokeRefreshTokens)
 *  3. Bust Redux mustChangePassword flag
 *  4. Navigate → /  (full access unlocked)
 * ═══════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../utils/api';
import { fetchUserRole } from '../store/authSlice';
import toast from 'react-hot-toast';
import {
  FiLock, FiEye, FiEyeOff, FiAlertCircle,
  FiCheck, FiArrowRight, FiRefreshCw, FiShield,
  FiAlertTriangle, FiInfo,
} from 'react-icons/fi';

const ACCENT  = '#F59E0B';
const ACCENT2 = '#F97316';

/* ── Password rules ──────────────────────────────────────────── */
const RULES = [
  { label: '8+ characters',     test: p => p.length >= 8 },
  { label: 'Uppercase letter',  test: p => /[A-Z]/.test(p) },
  { label: 'Lowercase letter',  test: p => /[a-z]/.test(p) },
  { label: 'Number',            test: p => /\d/.test(p) },
  { label: 'Special character', test: p => /[^A-Za-z0-9]/.test(p) },
];
const pwScore = p => RULES.filter(r => r.test(p)).length;
const PW_COLORS = ['#ef4444','#f97316','#f59e0b','#84cc16','#22c55e'];
const PW_LABELS = ['Very weak','Weak','Fair','Good','Strong'];

/* ── Password strength ───────────────────────────────────────── */
const PwStrength = ({ pw }) => {
  if (!pw) return null;
  const score = pwScore(pw);
  const color = PW_COLORS[score - 1] ?? PW_COLORS[0];
  return (
    <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
      className="mt-2.5 space-y-2 overflow-hidden">
      <div className="flex gap-1">
        {Array.from({length:5}).map((_,i) => (
          <motion.div key={i}
            animate={{ background: i < score ? color : 'rgba(255,255,255,0.08)' }}
            transition={{ duration:0.2 }}
            className="flex-1 h-1 rounded-full" />
        ))}
      </div>
      <p className="text-[11px] font-semibold" style={{ color }}>{PW_LABELS[score-1] ?? 'Very weak'}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {RULES.map(r => {
          const ok = r.test(pw);
          return (
            <div key={r.label} className="flex items-center gap-1.5">
              <FiCheck size={9} style={{ color: ok ? '#22c55e' : 'rgba(255,255,255,0.18)' }} />
              <span className="text-[10px]"
                    style={{ color: ok ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.22)' }}>
                {r.label}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

/* ── Error banner ────────────────────────────────────────────── */
const ErrBanner = ({ error, code }) => {
  const isWeak = code === 'WEAK_PASSWORD';
  const color  = isWeak ? '#fb923c' : '#f87171';
  return (
    <motion.div initial={{ opacity:0, y:-6, scale:0.98 }}
      animate={{ opacity:1, y:0, scale:1 }} transition={{ duration:0.2 }}
      className="rounded-2xl border p-3.5 mb-4"
      style={{ background:`${color}0D`, borderColor:`${color}30` }}>
      <div className="flex items-start gap-2.5">
        <FiAlertCircle size={13} style={{ color }} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-[12px] font-semibold mb-0.5" style={{ color }}>
            {isWeak ? 'Password too weak' : 'Error'}
          </p>
          <p className="text-[11px] text-white/60 leading-relaxed">{error}</p>
        </div>
      </div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════ */
const ChangePasswordPage = () => {
  const { user }   = useAuth();
  const dispatch   = useDispatch();
  const navigate   = useNavigate();

  const [newPw,    setNewPw]    = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showNew,  setShowNew]  = useState(false);
  const [showCon,  setShowCon]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [apiErr,   setApiErr]   = useState(null);
  const [done,     setDone]     = useState(false);

  const score     = pwScore(newPw);
  const mismatch  = confirm.length > 0 && confirm !== newPw;
  const canSubmit = !saving && score >= 3 && newPw === confirm && newPw.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true); setApiErr(null);

    try {
      await userApi.changePassword(newPw);

      // Re-fetch role to clear mustChangePassword from Redux/AuthContext
      if (user?.uid) await dispatch(fetchUserRole(user.uid));

      setDone(true);
      toast.success('Password changed! Full access granted.', { duration:5000 });

      // Navigate after short delay so user sees success state
      setTimeout(() => navigate('/', { replace:true }), 1800);

    } catch (err) {
      setApiErr({ error: err.message, code: err.code });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (hasError = false) =>
    `w-full pl-10 pr-10 py-3 rounded-2xl border bg-[#0D1017] text-[13px]
     text-white/85 placeholder-white/20 focus:outline-none transition-all
     ${hasError
       ? 'border-red-500/40 focus:border-red-500/60 focus:ring-1 focus:ring-red-500/15'
       : 'border-white/8 focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/15'
     }`;

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background:'linear-gradient(135deg,#0A0E1A 0%,#0D1220 60%,#0A0E1A 100%)' }}>

      {/* glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[260px] rounded-full blur-[120px] opacity-10"
             style={{ background:'#818CF8' }} />
      </div>

      <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }}
        transition={{ duration:0.45, ease:[0.22,1,0.36,1] }}
        className="w-full max-w-[420px] relative z-10">

        <div className="rounded-[28px] border border-white/10 overflow-hidden"
             style={{ background:'#141924', boxShadow:'0 40px 80px rgba(0,0,0,0.55)' }}>

          {/* purple top bar — admin colour */}
          <div className="h-[3px]"
               style={{ background:'linear-gradient(to right,#818CF8,#6366f1,transparent)' }} />

          <div className="px-8 pt-8 pb-6">

            {/* header */}
            <div className="flex items-center gap-3 mb-7">
              <div className="w-10 h-10 rounded-[14px] flex items-center justify-center"
                   style={{ background:'rgba(129,140,248,0.14)', border:'1px solid rgba(129,140,248,0.22)' }}>
                <FiShield size={18} style={{ color:'#818CF8' }} />
              </div>
              <div>
                <h1 className="text-[20px] font-black text-white tracking-tight leading-none mb-0.5">
                  Change your password
                </h1>
                <p className="text-[11px] text-white/35">Required before accessing your admin account</p>
              </div>
            </div>

            {/* context notice */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl border border-amber-500/20 mb-5"
                 style={{ background:'rgba(245,158,11,0.07)' }}>
              <FiAlertTriangle size={13} style={{ color:ACCENT }} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-[12px] font-semibold text-amber-400 mb-0.5">
                  Temporary password detected
                </p>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Your account was created with a temporary password.
                  {user?.displayName && <> Hi <strong className="text-white/70">{user.displayName.split(' ')[0]}</strong> —</>}
                  {' '}you must set a new password to gain full admin access.
                  Your new password will replace this temporary one.
                </p>
              </div>
            </div>

            <AnimatePresence>
              {done && (
                <motion.div initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }}
                  className="flex flex-col items-center gap-3 py-8 text-center">
                  <motion.div animate={{ scale:[1,1.18,1] }} transition={{ duration:0.45 }}
                    className="w-14 h-14 rounded-[18px] flex items-center justify-center"
                    style={{ background:'rgba(74,222,128,0.12)', border:'1px solid rgba(74,222,128,0.25)' }}>
                    <FiCheck size={26} className="text-green-400" />
                  </motion.div>
                  <p className="text-[17px] font-black text-white">Password changed!</p>
                  <p className="text-[12px] text-white/45 leading-relaxed">
                    Full admin access granted. Redirecting…
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {!done && (
              <>
                <ErrBanner {...(apiErr ?? {})} />

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>

                  {/* New password */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.12em]
                                      text-amber-500/70 mb-1.5">New password</label>
                    <div className="relative">
                      <FiLock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2
                                                    text-white/30 pointer-events-none" />
                      <input type={showNew ? 'text' : 'password'}
                        value={newPw} onChange={e => { setNewPw(e.target.value); setApiErr(null); }}
                        placeholder="Choose a strong password"
                        autoComplete="new-password"
                        className={inputCls()} />
                      <button type="button" onClick={() => setShowNew(p=>!p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30
                                   hover:text-white/55 transition-colors">
                        {showNew ? <FiEyeOff size={13}/> : <FiEye size={13}/>}
                      </button>
                    </div>
                    {newPw && <PwStrength pw={newPw} />}
                  </div>

                  {/* Confirm */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.12em]
                                      text-amber-500/70 mb-1.5">Confirm password</label>
                    <div className="relative">
                      <FiLock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2
                                                    text-white/30 pointer-events-none" />
                      <input type={showCon ? 'text' : 'password'}
                        value={confirm} onChange={e => setConfirm(e.target.value)}
                        placeholder="Repeat your new password"
                        autoComplete="new-password"
                        className={inputCls(mismatch)} />
                      <button type="button" onClick={() => setShowCon(p=>!p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30
                                   hover:text-white/55 transition-colors">
                        {showCon ? <FiEyeOff size={13}/> : <FiEye size={13}/>}
                      </button>
                    </div>
                    <AnimatePresence>
                      {mismatch && (
                        <motion.p initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                          className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                          <FiAlertCircle size={9}/>Passwords don't match.
                        </motion.p>
                      )}
                      {!mismatch && confirm.length > 0 && confirm === newPw && (
                        <motion.p initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                          className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
                          <FiCheck size={9}/>Passwords match.
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Security tip */}
                  <div className="flex items-start gap-2 p-3 rounded-xl border border-white/5"
                       style={{ background:'rgba(0,0,0,0.25)' }}>
                    <FiInfo size={11} className="text-white/25 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-white/30 leading-relaxed">
                      Use a unique password you don't use elsewhere. We recommend a passphrase of 4+ random words. All other sessions will be signed out after the change.
                    </p>
                  </div>

                  {/* Submit */}
                  <motion.button type="submit" disabled={!canSubmit}
                    whileHover={canSubmit ? {scale:1.01} : {}}
                    whileTap={canSubmit   ? {scale:0.97} : {}}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
                               font-bold text-[14px] text-white transition-all
                               disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ background:'linear-gradient(to right,#818CF8,#6366f1)' }}>
                    {saving
                      ? <><FiRefreshCw size={13} className="animate-spin"/>Changing password…</>
                      : <><FiShield size={13}/>Set new password & unlock access</>
                    }
                  </motion.button>
                </form>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ChangePasswordPage;