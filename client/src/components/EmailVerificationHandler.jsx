import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Clock, RotateCw } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import '../assets/glow.css';

export default function EmailVerificationHandler() {
  //const [searchParams] = useSearchParams();
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
      // Skip if already processing or verified
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
          // Verification already in progress
          return;
        }

        if (!res.ok) {
        // Handle specific error cases
          if (data.code === 'TOKEN_CONSUMED') {
            throw new Error('This verification link has already been used.');
          } else if (data.code === 'INVALID_TOKEN') {
            throw new Error('The verification link is invalid.');
          }
          throw new Error(data.userMessage || data.error || 'Verification failed');
        }
        if (data.alreadyVerified) {
          setStatus('alreadyVerified');
          //toast.success('Your email is already verified. You can proceed to login.');
          return;
        }

        //toast.success('Email verified successfully!');
        setStatus('success');
        setHasVerified(true);
        //setTimeout(() => navigate('/auth/login', { state: { emailVerified: true } }), 2000);

      } catch (err) {
        console.error('Verification error:', err.message);
        setStatus('error');
        setError(err.message);
        
        // Handle specific error cases
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
  }, [oobCode, email, uid, navigate, hasVerified,isVerified]);

  const renderContent = () => {
    const commonClasses = "w-full max-w-md bg-[#0c0c1e]/90 backdrop-blur-sm rounded-2xl p-8 text-white shadow-2xl border";
    const iconSize = 48;

    switch (status) {
      case 'verifying':
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`${commonClasses} border-blue-500/30`}
          >
            <div className="flex flex-col items-center space-y-4">
              <RotateCw className="animate-spin text-blue-400" size={iconSize} />
              <h2 className="text-2xl font-bold text-center">Verifying your email</h2>
              <p className="text-white/70 text-center">
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
          className={`${commonClasses} border-green-500/30 shadow-lg backdrop-blur-lg bg-gradient-to-br from-green-800/10 to-green-700/5`}
        >
          <div className="flex flex-col items-center space-y-5">
            {/* Animated icon */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="p-4 bg-green-900/20 rounded-full border border-green-500/40 shadow-green-500/20 shadow-md"
            >
              <CheckCircle
                className="glow-icon"
                size={iconSize}
                strokeWidth={1.5}
                aria-hidden="true"
              />

            </motion.div>

            {/* Heading */}
            <h2 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
              You’re Already Verified
            </h2>

            {/* Subtext */}
            <p className="text-white/70 text-center max-w-sm">
              Your email is already verified. You can safely log in to your account.
            </p>

            {/* CTA button */}
            <div className="pt-2 w-full">
              <motion.button
                onClick={() => navigate('/auth/login', { state: { emailVerified: true } })}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-3 rounded-lg font-medium text-white hover:opacity-90 transition-opacity shadow-md"
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
            className={`${commonClasses} border-green-500/30`}
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-green-900/20 rounded-full border border-green-500/50">
                <CheckCircle className="text-green-500" size={iconSize} strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-500">
                Email Verified!
              </h2>
              <p className="text-white/70 text-center">
                Your email has been successfully verified.
              </p>
              <div className="pt-2 w-full">
                <motion.button
                  onClick={() => navigate('/auth/login', { state: { emailVerified: true } })}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
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
            className={`${commonClasses} border-yellow-500/30`}
          >
            <div className="flex flex-col items-center space-y-4">
              <Clock className="text-yellow-500" size={iconSize} />
              <h2 className="text-2xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-amber-500">
                Link Expired
              </h2>
              <p className="text-white/70 text-center">{error}</p>
              <div className="w-full space-y-3">
                <motion.button
                  onClick={() => navigate('/auth/login')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  Go to Login
                </motion.button>
                <motion.button
                  onClick={() => navigate('/auth/resend-verification')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-black/20 py-3 rounded-lg font-medium hover:bg-black/30 transition-colors border border-white/10"
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
            className={`${commonClasses} border-amber-500/30 bg-gradient-to-br from-amber-900/10 to-amber-800/5 shadow-lg shadow-amber-500/10 backdrop-blur-lg`}
          >
            <div className="flex flex-col items-center space-y-5">
              {/* Glowing warning icon with pulse animation */}
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
                className="p-4 bg-amber-900/20 rounded-full border border-amber-500/40 shadow-amber-500/20 shadow-lg"
              >
                <AlertTriangle
                  className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse"
                  size={iconSize}
                  strokeWidth={1.8}
                />
              </motion.div>

              {/* Animated gradient heading */}
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-500"
              >
                Invalid Verification Link
              </motion.h2>

              {/* Error details with fade-in */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-center space-y-3"
              >
                <p className="text-amber-100/80">
                  The verification link contains invalid characters.
                </p>
                <div className="px-4 py-2 bg-amber-900/30 rounded-lg border border-amber-800/50 text-amber-200 text-sm font-mono">
                  {error.includes('@') ? error : 'Invalid email format detected'}
                </div>
                <p className="text-amber-100/60 text-sm">
                  Please request a new verification email.
                </p>
              </motion.div>

              {/* Action buttons with staggered animation */}
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
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600 py-3 rounded-lg font-medium text-white hover:opacity-90 transition-all shadow-lg"
                  onClick={() => navigate('/auth/resend-verification')}
                >
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw size={18} className="animate-spin-slow" />
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

            {/* Decorative elements */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
              <div className="absolute -top-20 -left-20 w-40 h-40 bg-amber-500/5 rounded-full blur-xl"></div>
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-orange-500/5 rounded-full blur-lg"></div>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/50 backdrop-blur-sm">
      <Toaster position="top-center" />
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 20,
            duration: 0.3
          }}
        >
          {renderContent()}
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="text-xs text-center text-white/50">
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