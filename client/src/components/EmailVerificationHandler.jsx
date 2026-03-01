// EmailVerificationHandler.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Clock, RotateCw, AlertTriangle, RefreshCw } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import '../assets/glow.css';

const ACCENT_GRADIENT = 'from-[#F59E0B] to-[#F97316]';

export default function EmailVerificationHandler() {
  const searchParams = new URLSearchParams(window.location.search);
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, expired, error
  const [error, setError] = useState('');
  const oobCode = decodeURIComponent(searchParams.get('oobCode') || '');
  const email = decodeURIComponent(searchParams.get('email') || '');
  const uid = searchParams.get('uid') || ''; 
  const [hasVerified, setHasVerified] = useState(false);
  const isVerified = searchParams.get('verified') === 'true';

  useEffect(() => {
    const verificationKey = `verify-${uid}-${oobCode}`;
    const isProcessing = sessionStorage.getItem(verificationKey);
    const verifyEmail = async () => {
      if (isProcessing || isVerified || hasVerified) return;
      sessionStorage.setItem(verificationKey, 'true')
     
      try {
        if (!oobCode || !email || !uid) {
          throw new Error('The verification link is incomplete. Please use the full link from your email.');
        }

        const res = await fetch("/api/verify-email-link", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
           body: JSON.stringify({ 
            oobCode,
            uid,
            email,
            isFromFrontend: true
          }),
        });

        const data = await res.json();
        if (res.status === 409) {
          return;
        }

        if (!res.ok) {
          if (data.code === 'TOKEN_CONSUMED') {
            throw new Error('This verification link has already been used.');
          } else if (data.code === 'INVALID_TOKEN') {
            throw new Error('The verification link is invalid.');
          }
          throw new Error(data.userMessage || data.error || 'Verification failed');
        }
        if (data.alreadyVerified) {
          setStatus('alreadyVerified');
          return;
        }

        setStatus('success');
        setHasVerified(true);
      } catch (err) {
        console.error('Verification error:', err.message);
        setStatus('error');
        setError(err.message);
        
        if (err.message.includes('expired') || err.message.includes('invalid')) {
          setStatus('expired');
          setError('The verification link has expired. Please request a new one.');
        } else if (err.message.includes('user not found')) {
          setError('No account found with this email address.');
        }
      } finally {
        sessionStorage.removeItem(verificationKey);
      }
    };

    if (oobCode && email && !hasVerified) {
      verifyEmail();
    } else if (!oobCode || !email) {
      setStatus('error');
      setError('The verification link is invalid. Please request a new verification email.');
    }
    return () => {
      sessionStorage.removeItem(verificationKey);
    };
  }, [oobCode, email, uid, navigate, hasVerified, isVerified]);

  const renderContent = () => {
    const commonClasses = "w-full max-w-md bg-[#1C2135] backdrop-blur-sm rounded-2xl p-8 text-white shadow-2xl border border-white/10";
    const iconSize = 48;

    switch (status) {
      case 'verifying':
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={commonClasses}
          >
            <div className="flex flex-col items-center space-y-4">
              <RotateCw className="animate-spin text-[#F59E0B]" size={iconSize} />
              <h2 className="text-2xl font-bold text-center">Verifying your email</h2>
              <p className="text-gray-400 text-center">
                Please wait while we verify your email address...
              </p>
            </div>
          </motion.div>
        );
      case 'alreadyVerified':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            role="alert"
            aria-live="polite"
            className={commonClasses}
          >
            <div className="flex flex-col items-center space-y-5">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="p-4 bg-green-900/20 rounded-full border border-green-500/40 shadow-green-500/20 shadow-md"
              >
                <CheckCircle
                  className="text-green-500"
                  size={iconSize}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </motion.div>
              <h2 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                You’re Already Verified
              </h2>
              <p className="text-gray-400 text-center max-w-sm">
                Your email is already verified. You can safely log in to your account.
              </p>
              <div className="pt-2 w-full">
                <motion.button
                  onClick={() => navigate('/auth/login', { state: { emailVerified: true } })}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full bg-gradient-to-r ${ACCENT_GRADIENT} py-3 rounded-lg font-medium text-gray-950 hover:opacity-90 transition-opacity shadow-md`}
                >
                  Continue to Login
                </motion.button>
              </div>
            </div>
          </motion.div>
        );
      case 'success':
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={commonClasses}
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-green-900/20 rounded-full border border-green-500/40">
                <CheckCircle className="text-green-500" size={iconSize} strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-500">
                Email Verified!
              </h2>
              <p className="text-gray-400 text-center">
                Your email has been successfully verified.
              </p>
              <div className="pt-2 w-full">
                <motion.button
                  onClick={() => navigate('/auth/login', { state: { emailVerified: true } })}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full bg-gradient-to-r ${ACCENT_GRADIENT} py-3 rounded-lg font-medium text-gray-950 hover:opacity-90 transition-opacity`}
                >
                  Continue to Login
                </motion.button>
              </div>
            </div>
          </motion.div>
        );
      case 'expired':
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={commonClasses}
          >
            <div className="flex flex-col items-center space-y-4">
              <Clock className="text-yellow-500" size={iconSize} />
              <h2 className="text-2xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-amber-500">
                Link Expired
              </h2>
              <p className="text-gray-400 text-center">{error}</p>
              <div className="w-full space-y-3">
                <motion.button
                  onClick={() => navigate('/auth/login')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full bg-gradient-to-r ${ACCENT_GRADIENT} py-3 rounded-lg font-medium text-gray-950 hover:opacity-90 transition-opacity`}
                >
                  Go to Login
                </motion.button>
                <motion.button
                  onClick={() => navigate('/auth/resend-verification')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-black/20 py-3 rounded-lg font-medium hover:bg-black/30 transition-colors border border-white/10 text-white"
                >
                  Resend Verification
                </motion.button>
              </div>
            </div>
          </motion.div>
        );
      case 'error':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={commonClasses}
          >
            <div className="flex flex-col items-center space-y-5">
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 1.5,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatType: "mirror"
                }}
                className="p-4 bg-amber-900/20 rounded-full border border-amber-500/40"
              >
                <AlertTriangle
                  className="text-amber-400"
                  size={iconSize}
                  strokeWidth={1.8}
                />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-500"
              >
                Invalid Verification Link
              </motion.h2>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-center space-y-3"
              >
                <p className="text-gray-400">
                  The verification link contains invalid characters.
                </p>
                <div className="px-4 py-2 bg-amber-900/30 rounded-lg border border-amber-800/50 text-amber-200 text-sm font-mono">
                  {error.includes('@') ? error : 'Invalid email format detected'}
                </div>
                <p className="text-gray-500 text-sm">
                  Please request a new verification email.
                </p>
              </motion.div>
              <motion.div 
                className="w-full space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <motion.button
                  whileHover={{ 
                    scale: 1.02,
                    boxShadow: "0 0 12px rgba(251, 191, 36, 0.4)"
                  }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full bg-gradient-to-r ${ACCENT_GRADIENT} py-3 rounded-lg font-medium text-gray-950 hover:opacity-90 transition-all shadow-lg`}
                  onClick={() => navigate('/auth/resend-verification')}
                >
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw size={18} />
                    Resend Verification
                  </div>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full bg-transparent border border-amber-700/50 text-amber-300 py-3 rounded-lg font-medium hover:bg-amber-900/20 transition-colors"
                  onClick={() => navigate('/auth/login')}
                >
                  Back to Login
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/50 backdrop-blur-sm">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1C2135', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }} />
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {renderContent()}
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="text-xs text-center text-gray-500">
              {status === 'expired' 
                ? 'Verification links expire after 24 hours' 
                : 'Need help? Contact our support team'}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}