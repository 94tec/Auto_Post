// ForgotPassword.jsx — step 1: user enters email → receives reset link
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiArrowLeft, FiSend, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import { Toaster, toast } from 'react-hot-toast';

const NAVY  = '#0A0E1A';
const SLATE = '#141924';

/* ── tiny shared atoms ───────────────────────────────────────── */
const PageShell = ({ children }) => (
  <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center p-4 relative overflow-hidden">
    {/* ambient glow */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px]
                    bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />
    <div className="absolute bottom-0 right-0 w-[300px] h-[300px]
                    bg-orange-500/3 rounded-full blur-[80px] pointer-events-none" />
    {/* logo */}
    <Link to="/" className="absolute top-6 left-6 flex items-center gap-2.5 group">
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

const Card = ({ children, className = '' }) => (
  <div className={`w-full max-w-[440px] bg-[#141924] border border-white/8
                   rounded-2xl overflow-hidden
                   shadow-[0_32px_64px_rgba(0,0,0,0.6)] ${className}`}>
    {children}
  </div>
);

/* ══════════════════════════════════════════════════════════════
   FORGOT PASSWORD
══════════════════════════════════════════════════════════════ */
export default function ForgotPassword() {
  const [email,       setEmail]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [sent,        setSent]        = useState(false);
  const [error,       setError]       = useState('');
  const [cooldown,    setCooldown]    = useState(0);  // seconds until resend allowed
  const navigate = useNavigate();

  /* cooldown timer */
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res  = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Request failed');

      setSent(true);
      setCooldown(60); // prevent spam — 60 s before resend
    } catch (err) {
      // Generic message — never reveal whether email exists
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setSent(false);
    setError('');
  };

  /* ── sent state ─────────────────────────────────────────────── */
  if (sent) {
    return (
      <PageShell>
        <Toaster position="top-center" toastOptions={{
          style: { background: '#141924', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', fontSize: '13px' },
        }} />
        <AnimatePresence mode="wait">
          <motion.div
            key="sent"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <Card>
              {/* top accent */}
              <div className="h-[2px] bg-gradient-to-r from-green-500 to-emerald-400" />
              <div className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 20 }}
                  className="w-14 h-14 rounded-2xl bg-green-500/15 border border-green-500/25
                             flex items-center justify-center mx-auto mb-5"
                >
                  <FiCheck size={24} className="text-green-400" />
                </motion.div>

                <h2 className="text-[20px] font-black text-white mb-2 tracking-tight">
                  Check your inbox
                </h2>
                <p className="text-[13px] text-white/45 leading-relaxed mb-1">
                  If <span className="text-white/70 font-medium">{email}</span> exists
                  in our system, you'll receive a reset link shortly.
                </p>
                <p className="text-[12px] text-white/25 mb-7">
                  The link expires in <span className="text-amber-500/70">15 minutes</span>.
                  Check your spam folder if it doesn't arrive.
                </p>

                {/* resend / cooldown */}
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={handleResend}
                    disabled={cooldown > 0}
                    className="w-full py-2.5 rounded-xl text-[13px] font-medium border
                               border-white/8 text-white/40 hover:text-white/65
                               hover:bg-white/5 transition-all disabled:opacity-30
                               disabled:cursor-not-allowed"
                  >
                    {cooldown > 0
                      ? `Resend available in ${cooldown}s`
                      : 'Send another link'}
                  </button>
                  <button
                    onClick={() => navigate('/auth/login')}
                    className="w-full py-2.5 rounded-xl text-[13px] font-semibold
                               bg-gradient-to-r from-[#F59E0B] to-[#F97316]
                               text-gray-950 transition-all hover:opacity-90"
                  >
                    Back to sign in
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </PageShell>
    );
  }

  /* ── request form ────────────────────────────────────────────── */
  return (
    <PageShell>
      <Toaster position="top-center" toastOptions={{
        style: { background: '#141924', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', fontSize: '13px' },
      }} />
      <AnimatePresence mode="wait">
        <motion.div
          key="form"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full max-w-[440px]"
        >
          <Card>
            <div className="h-[2px] bg-gradient-to-r from-[#F59E0B] to-[#F97316]" />
            <div className="p-8">

              {/* back link */}
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
                  <FiMail size={18} className="text-[#F59E0B]" />
                </div>
                <h1 className="text-[22px] font-black text-white tracking-tight mb-1">
                  Reset your password
                </h1>
                <p className="text-[13px] text-white/40 leading-relaxed">
                  Enter your email and we'll send you a secure link to create a new password.
                </p>
              </div>

              {/* form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.12em]
                                    text-amber-500/80 mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <FiMail size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2
                                                  text-white/25 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      disabled={loading}
                      className="w-full bg-[#0D1017] text-[13px] text-white/90
                                 placeholder-white/20 border border-white/8 rounded-xl
                                 pl-9 pr-4 py-2.5
                                 focus:outline-none focus:border-amber-500/50
                                 focus:ring-1 focus:ring-amber-500/20
                                 transition-all disabled:opacity-40"
                    />
                  </div>
                </div>

                {/* error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1,  y: 0  }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl
                                 bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]"
                    >
                      <FiAlertTriangle size={13} className="shrink-0" />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={loading || !email.trim()}
                  whileHover={!loading ? { scale: 1.02 } : {}}
                  whileTap={!loading  ? { scale: 0.97 } : {}}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                             text-[13px] font-semibold
                             bg-gradient-to-r from-[#F59E0B] to-[#F97316]
                             text-gray-950 shadow-sm shadow-amber-500/20
                             disabled:opacity-40 disabled:cursor-not-allowed
                             transition-all"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-gray-950
                                     border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FiSend size={13} />
                  )}
                  {loading ? 'Sending…' : 'Send reset link'}
                </motion.button>
              </form>

              <p className="mt-5 text-center text-[11px] text-white/20">
                Remember your password?{' '}
                <Link to="/auth/login"
                      className="text-amber-500/60 hover:text-amber-500 transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </PageShell>
  );
}