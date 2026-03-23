/**
 * components/AuthGuard.jsx
 * ═══════════════════════════════════════════════════════════════
 * Handles ALL auth states before rendering protected content.
 *
 * STATE ROUTING TABLE
 * ───────────────────────────────────────────────────────────────
 *  No session                → /auth/login       (with toast)
 *  Suspended                 → /auth/login       (suspended toast)
 *  Email not verified        → /auth/verify-pending
 *  Verified, not approved    → /guest
 *  Admin + mustChangePassword → /auth/change-password
 *  Active (user or admin)    → render children ✓
 *
 * USAGE
 * ───────────────────────────────────────────────────────────────
 *  // Require active approved account (default)
 *  <AuthGuard><Dashboard /></AuthGuard>
 *
 *  // Allow any logged-in user (e.g. change-password page itself)
 *  <AuthGuard requireApproved={false}><ChangePassword /></AuthGuard>
 * ═══════════════════════════════════════════════════════════════
 */

import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ACCENT = '#F59E0B';

/* ── Loading screen ──────────────────────────────────────────── */
const FullScreenLoader = ({ message = 'Checking session…' }) => (
  <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 z-50"
       style={{ background: '#0A0E1A' }}>
    <motion.div
      animate={{ scale: [1, 1.12, 1], opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
      <div className="w-12 h-12 rounded-[16px] flex items-center justify-center font-black text-xl"
           style={{ background: `linear-gradient(135deg, ${ACCENT}, #F97316)`, color: '#0A0E1A' }}>
        D
      </div>
    </motion.div>
    <p className="text-[13px] text-white/40 font-medium tracking-wide">{message}</p>
  </div>
);

/* ════════════════════════════════════════════════════════════════
   AUTH GUARD
════════════════════════════════════════════════════════════════ */
const AuthGuard = ({ children, requireApproved = true }) => {
  const { user, loading } = useAuth();
  const navigate          = useNavigate();
  const location          = useLocation();
  const toastShown        = useRef(false);

  useEffect(() => {
    if (loading) return;

    /* ── 1. No session ────────────────────────────────────── */
    if (!user) {
      if (!toastShown.current) {
        toast('Please sign in to continue.', {
          id:   'auth-required',
          icon: '🔒',
          style: {
            background: '#141924',
            color:      'rgba(255,255,255,0.75)',
            border:     '1px solid rgba(255,255,255,0.08)',
            fontSize:   '13px',
          },
        });
        toastShown.current = true;
      }
      navigate('/auth/login', {
        state:   { from: location },
        replace: true,
      });
      return;
    }

    const isAdmin = user.role === 'admin';

    /* ── 2. Suspended ─────────────────────────────────────── */
    if (user.status === 'suspended') {
      if (!toastShown.current) {
        toast.error('Your account is suspended. Contact support.', {
          id:       'account-suspended',
          duration: 6000,
        });
        toastShown.current = true;
      }
      navigate('/auth/login', { replace: true });
      return;
    }

    /* ── 3. Admin: must change password first ─────────────── */
    // Only block if NOT already on the change-password page
    if (isAdmin && user.mustChangePassword && location.pathname !== '/auth/force-password-change') {
      navigate('/auth/force-password-change', { replace: true });
      return;
    }

    /* ── 4. Non-admin: email not verified ─────────────────── */
    if (!isAdmin && !user.emailVerified) {
      navigate('/auth/verify-pending', { replace: true });
      return;
    }

    /* ── 5. Non-admin: verified but not approved ──────────── */
    if (requireApproved && !isAdmin && !user.adminApproved) {
      navigate('/guest', { replace: true });
      return;
    }

    // All clear — reset toast flag so it can fire again on next session expiry
    toastShown.current = false;

  }, [user, loading, navigate, location, requireApproved]);

  /* ── Render decisions ─────────────────────────────────────── */
  if (loading) return <FullScreenLoader />;
  if (!user)   return null;

  const isAdmin = user.role === 'admin';

  // Block render until redirects above execute
  if (user.status === 'suspended') return null;
  if (isAdmin && user.mustChangePassword && location.pathname !== '/auth/change-password') return null;
  if (!isAdmin && !user.emailVerified) return null;
  if (requireApproved && !isAdmin && !user.adminApproved) return null;

  return children;
};

export default AuthGuard;