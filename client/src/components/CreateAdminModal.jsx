/**
 * components/modals/CreateAdminModal.jsx
 * ═══════════════════════════════════════════════════════════════
 * Standalone modal — create a new admin account.
 * Called from AdminPanel. External file for easy extension.
 *
 * BEHAVIOUR
 * ───────────────────────────────────────────────────────────────
 *  • POST /api/admin/users via adminApi.createAdmin
 *  • Sets mustChangePassword=true on the new admin (backend)
 *  • Backend sends branded admin welcome email with temp password
 *  • Password strength meter + per-field validation
 *  • Full ERROR_MAP matches every backend code adminController emits
 *  • Slide-up on mobile, centred on sm+
 *
 * PROPS
 * ───────────────────────────────────────────────────────────────
 *  isOpen    boolean  — controls visibility
 *  onClose   fn       — called on cancel / backdrop click
 *  onSuccess fn       — called after successful creation (refetch)
 * ═══════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../utils/api';
import toast from 'react-hot-toast';
import {
  FiShield, FiX, FiUser, FiMail, FiLock,
  FiEye, FiEyeOff, FiCheck, FiAlertCircle,
  FiInfo, FiAlertTriangle, FiRefreshCw,
} from 'react-icons/fi';

/* ── design tokens ───────────────────────────────────────────── */
const ACCENT  = '#F59E0B';
const SLATE   = '#141924';
const NAVY    = '#0A0E1A';
const INDIGO  = '#818CF8';

/* ── password rules ──────────────────────────────────────────── */
const PW_RULES = [
  { label: '8+ chars',  test: p => p.length >= 8           },
  { label: 'Upper',     test: p => /[A-Z]/.test(p)         },
  { label: 'Lower',     test: p => /[a-z]/.test(p)         },
  { label: 'Number',    test: p => /\d/.test(p)             },
  { label: 'Symbol',    test: p => /[^A-Za-z0-9]/.test(p) },
];
const pwScore   = p => PW_RULES.filter(r => r.test(p)).length;
const PW_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e'];
const PW_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];

/* ── error map — every code adminController.createAdmin emits ── */
const ERROR_MAP = {
  MISSING_FIELDS:      { color: '#f87171', title: 'Missing information' },
  WEAK_PASSWORD:       { color: '#fb923c', title: 'Password too weak',     hint: '8+ chars: uppercase, lowercase, number, symbol.' },
  EMAIL_EXISTS:        { color: '#fb923c', title: 'Email already registered', hint: 'This email already has an account.' },
  ADMIN_CREATE_FAILED: { color: '#f87171', title: 'Creation failed',         hint: 'Check server logs for details.' },
  SERVER_ERROR:        { color: '#f87171', title: 'Server error',             hint: 'Please try again.' },
};

/* ── sub-components ──────────────────────────────────────────── */
const PwStrength = ({ pw }) => {
  if (!pw) return null;
  const score = pwScore(pw);
  const color = PW_COLORS[score - 1] ?? PW_COLORS[0];
  return (
    <motion.div initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mt-2 overflow-hidden space-y-1.5">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div key={i}
            animate={{ background: i < score ? color : 'rgba(255,255,255,0.07)' }}
            transition={{ duration: 0.2 }}
            className="flex-1 h-1 rounded-full" />
        ))}
      </div>
      <p className="text-[10px] font-semibold" style={{ color }}>
        {PW_LABELS[score - 1] ?? 'Very weak'}
      </p>
      <div className="flex flex-wrap gap-3">
        {PW_RULES.map(r => {
          const ok = r.test(pw);
          return (
            <span key={r.label} className="flex items-center gap-1 text-[9px]"
                  style={{ color: ok ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)' }}>
              <FiCheck size={8} style={{ color: ok ? '#22c55e' : 'rgba(255,255,255,0.18)' }} />
              {r.label}
            </span>
          );
        })}
      </div>
    </motion.div>
  );
};

const ErrBanner = ({ err }) => {
  if (!err) return null;
  const cfg  = ERROR_MAP[err.code] ?? ERROR_MAP.SERVER_ERROR;
  const hint = err.hint || cfg.hint;
  return (
    <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border p-3.5 mb-4"
      style={{ background: `${cfg.color}0D`, borderColor: `${cfg.color}30` }}>
      <div className="flex items-start gap-2.5">
        <FiAlertCircle size={13} style={{ color: cfg.color }} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-[12px] font-bold mb-0.5" style={{ color: cfg.color }}>{cfg.title}</p>
          <p className="text-[11px] text-white/60 leading-relaxed">{err.error}</p>
          {hint && (
            <p className="text-[10px] mt-1.5 flex items-center gap-1"
               style={{ color: `${cfg.color}70` }}>
              <FiInfo size={9} />{hint}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const inputCls = (extra = '') =>
  `w-full pl-9 pr-4 py-2.5 rounded-xl border border-white/8 bg-[#0A0E18]
   text-[13px] text-white/80 placeholder-white/18 focus:outline-none
   focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/12 transition-all ${extra}`;

const Field = ({ label, icon: Icon, children }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5"
           style={{ color: 'rgba(129,140,248,0.7)' }}>
      {label}
    </label>
    <div className="relative">
      <Icon size={12} className="absolute left-3 top-1/2 -translate-y-1/2
                                  text-white/25 pointer-events-none" />
      {children}
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════ */
const CreateAdminModal = ({ isOpen, onClose, onSuccess }) => {
  const [form,   setForm]   = useState({ displayName: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [apiErr, setApiErr] = useState(null);
  const [saving, setSaving] = useState(false);

  const score     = pwScore(form.password);
  const canSubmit = !saving
    && form.displayName.trim().length >= 2
    && form.email.trim().length > 0
    && score >= 3;

  const set = k => e => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    setApiErr(null);
  };

  const handleClose = () => {
    setForm({ displayName: '', email: '', password: '' });
    setApiErr(null);
    onClose();
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setApiErr(null);
    try {
      await adminApi.createAdmin({
        email:       form.email.trim().toLowerCase(),
        password:    form.password,
        displayName: form.displayName.trim(),
      });
      toast.success(
        `Admin account created! Welcome email sent to ${form.email.trim()}.`,
        { duration: 5000 },
      );
      onSuccess?.();
      handleClose();
    } catch (err) {
      setApiErr({ error: err.message, code: err.code, hint: err.hint });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* panel — slide-up mobile, centred sm+ */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.96, y: 16  }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-end sm:items-center
                       justify-center p-0 sm:p-6 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full sm:max-w-[440px]
                         rounded-t-[28px] sm:rounded-[24px]
                         border border-white/10 overflow-hidden"
              style={{ background: SLATE, boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}
            >
              {/* indigo accent bar — admin colour */}
              <div className="h-[3px]"
                   style={{ background: `linear-gradient(to right,${INDIGO},#6366f1,transparent)` }} />

              <div className="p-6">
                {/* header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[12px] flex items-center justify-center"
                         style={{
                           background: 'rgba(129,140,248,0.14)',
                           border:     '1px solid rgba(129,140,248,0.22)',
                         }}>
                      <FiShield size={16} style={{ color: INDIGO }} />
                    </div>
                    <div>
                      <h2 className="text-[17px] font-black text-white tracking-tight">
                        Create Admin
                      </h2>
                      <p className="text-[10px] text-white/30">Full platform access</p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="w-7 h-7 rounded-xl flex items-center justify-center
                               bg-white/5 text-white/30 hover:text-white
                               hover:bg-white/10 transition-all"
                  >
                    <FiX size={13} />
                  </button>
                </div>

                {/* temp-password notice */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl
                                border border-amber-500/20 mb-4"
                     style={{ background: 'rgba(245,158,11,0.07)' }}>
                  <FiAlertTriangle size={12} style={{ color: ACCENT }}
                    className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-amber-400 mb-0.5">
                      Password change required on first login
                    </p>
                    <p className="text-[10px] text-white/45 leading-relaxed">
                      The new admin has{' '}
                      <strong className="text-white/65">restricted access</strong> until
                      they change this temporary password. A branded welcome email will
                      be sent automatically.
                    </p>
                  </div>
                </div>

                <ErrBanner err={apiErr} />

                <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
                  <Field label="Display name" icon={FiUser}>
                    <input
                      value={form.displayName}
                      onChange={set('displayName')}
                      placeholder="Jane Admin"
                      autoComplete="off"
                      className={inputCls()}
                    />
                  </Field>

                  <Field label="Email address" icon={FiMail}>
                    <input
                      type="email"
                      value={form.email}
                      onChange={set('email')}
                      placeholder="admin@company.com"
                      autoComplete="off"
                      className={inputCls()}
                    />
                  </Field>

                  <Field label="Temporary password" icon={FiLock}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={form.password}
                      onChange={set('password')}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className={inputCls('pr-9')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2
                                 text-white/25 hover:text-white/55 transition-colors"
                    >
                      {showPw ? <FiEyeOff size={12} /> : <FiEye size={12} />}
                    </button>
                  </Field>

                  {form.password && <PwStrength pw={form.password} />}

                  {/* action row */}
                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 py-2.5 rounded-xl text-[13px] font-medium
                                 border border-white/8 bg-white/4 text-white/45
                                 hover:text-white hover:bg-white/8 transition-all"
                    >
                      Cancel
                    </button>
                    <motion.button
                      type="submit"
                      disabled={!canSubmit}
                      whileHover={canSubmit ? { scale: 1.01 } : {}}
                      whileTap={canSubmit   ? { scale: 0.97 } : {}}
                      className="flex-1 flex items-center justify-center gap-2
                                 py-2.5 rounded-xl font-bold text-[13px] text-white
                                 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      style={{ background: `linear-gradient(to right,${INDIGO},#6366f1)` }}
                    >
                      {saving
                        ? <><FiRefreshCw size={12} className="animate-spin" />Creating…</>
                        : <><FiShield size={12} />Create admin</>
                      }
                    </motion.button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreateAdminModal;