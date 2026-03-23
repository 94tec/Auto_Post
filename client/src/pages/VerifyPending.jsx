// pages/VerifyPending.jsx
// Shown when user is logged in but emailVerified = false.
// Friendly, specific error message + resend link.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../utils/api';
import toast from 'react-hot-toast';
import {
  FiMail, FiRefreshCw, FiLogOut, FiCheckCircle,
  FiAlertCircle, FiArrowRight, FiClock,
} from 'react-icons/fi';

const ACCENT  = '#F59E0B';
const ACCENT2 = '#F97316';

const VerifyPending = () => {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const [sending,    setSending]    = useState(false);
  const [sent,       setSent]       = useState(false);
  const [cooldown,   setCooldown]   = useState(0);
  const [checking,   setChecking]   = useState(false);

  const handleResend = async () => {
    if (sending || cooldown > 0) return;
    setSending(true);
    try {
      await authApi.resendVerification(user?.email);
      setSent(true);
      toast.success('Verification email sent! Check your inbox.');
      // 2 min cooldown
      let secs = 120;
      setCooldown(secs);
      const t = setInterval(() => {
        secs -= 1;
        setCooldown(secs);
        if (secs <= 0) clearInterval(t);
      }, 1000);
    } catch (err) {
      toast.error(err.message || 'Failed to resend. Try again shortly.');
    } finally {
      setSending(false);
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      // Force reload auth state from Firebase
      const { auth } = await import('../config/firebase');
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        toast.success('Email verified! Redirecting…');
        setTimeout(() => navigate('/guest'), 800);
      } else {
        toast.error('Email not yet verified. Check your inbox and click the link.');
      }
    } catch {
      toast.error('Could not check status. Try refreshing.');
    } finally {
      setChecking(false);
    }
  };

  const maskedEmail = user?.email
    ? user.email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) =>
        a + '*'.repeat(Math.min(b.length, 6)) + c)
    : 'your email';

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: 'linear-gradient(135deg, #0A0E1A 0%, #0D1220 50%, #0A0E1A 100%)' }}>

      {/* background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[120px] opacity-15"
             style={{ background: ACCENT }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        {/* card */}
        <div className="rounded-3xl border border-white/10 overflow-hidden"
             style={{ background: '#141924', boxShadow: '0 32px 64px rgba(0,0,0,0.5)' }}>

          {/* amber accent top */}
          <div className="h-[3px]"
               style={{ background: `linear-gradient(to right, ${ACCENT}, ${ACCENT2}, transparent)` }} />

          <div className="p-8">
            {/* icon */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}30` }}
            >
              <FiMail size={28} style={{ color: ACCENT }} />
            </motion.div>

            <h1 className="text-[22px] font-black text-white text-center mb-2">
              Verify your email
            </h1>
            <p className="text-[13px] text-white/50 text-center leading-relaxed mb-6">
              We sent a verification link to{' '}
              <span className="text-white/80 font-semibold">{maskedEmail}</span>.
              Click the link in your email to continue.
            </p>

            {/* status box */}
            <div className="rounded-2xl border border-white/8 p-4 mb-6"
                 style={{ background: '#0D1220' }}>
              <div className="flex items-start gap-3">
                <FiAlertCircle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div className="text-[12px] text-white/55 leading-relaxed">
                  <p className="font-semibold text-white/75 mb-1">Why am I seeing this?</p>
                  <p>Your account was created but your email address hasn't been confirmed yet.
                  Until verified, you cannot access the app. Check spam/junk if you don't see the email.</p>
                </div>
              </div>
            </div>

            {/* actions */}
            <div className="space-y-3">

              {/* check status */}
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleCheckStatus}
                disabled={checking}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-[13px] text-gray-950 transition-all disabled:opacity-50"
                style={{ background: `linear-gradient(to right, ${ACCENT}, ${ACCENT2})` }}
              >
                {checking
                  ? <><FiRefreshCw size={14} className="animate-spin" />Checking…</>
                  : <><FiCheckCircle size={14} />I've verified my email</>
                }
              </motion.button>

              {/* resend */}
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleResend}
                disabled={sending || cooldown > 0}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-[13px] border transition-all"
                style={sent && cooldown > 0
                  ? { background: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.25)', color: '#4ade80' }
                  : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }
                }
              >
                {cooldown > 0 ? (
                  <><FiClock size={13} />Resend in {cooldown}s</>
                ) : sending ? (
                  <><FiRefreshCw size={13} className="animate-spin" />Sending…</>
                ) : (
                  <><FiRefreshCw size={13} />Resend verification email</>
                )}
              </motion.button>
            </div>

            {/* sign out */}
            <div className="mt-6 pt-5 border-t border-white/6 flex items-center justify-between">
              <p className="text-[11px] text-white/30">Wrong account?</p>
              <button
                onClick={async () => { await logout(); navigate('/auth/login'); }}
                className="flex items-center gap-1.5 text-[12px] text-red-400/70 hover:text-red-400 transition-colors"
              >
                <FiLogOut size={12} />Sign out
              </button>
            </div>
          </div>
        </div>

        {/* help link */}
        <p className="text-center text-[11px] text-white/25 mt-4">
          Having trouble?{' '}
          <a href="mailto:hello@damuchi.app" className="text-amber-500/60 hover:text-amber-500 transition-colors">
            Contact support
          </a>
        </p>
      </motion.div>
    </div>
  );
};

export default VerifyPending;