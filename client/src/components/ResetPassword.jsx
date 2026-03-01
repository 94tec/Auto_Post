// ResetPassword.jsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, ArrowLeft, Check, RotateCw, AlertTriangle, RefreshCw } from "lucide-react";
import PasswordStrengthIndicator from "../components/PasswordStrengthIndicator";
import { Toaster, toast } from 'react-hot-toast';

const ACCENT_GRADIENT = 'from-[#F59E0B] to-[#F97316]';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, expired, error, invalid
  const [oobCodeValid, setOobCodeValid] = useState(false);

  const oobCode = searchParams.get("oobCode");
  const email = searchParams.get("email");
  const uid = searchParams.get("uid");

  useEffect(() => {
    const verifyResetLink = async () => {
      if (!oobCode) {
        setStatus('invalid');
        setError('The password reset link is incomplete. Please use the full link from your email.');
        return;
      }

      try {
        setStatus('verifying');
        
        const response = await fetch('/api/user/verify-reset-link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ oobCode, email, uid }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.code === 'EXPIRED_OOB_CODE') {
            throw new Error('This password reset link has expired.');
          } else if (data.code === 'INVALID_OOB_CODE') {
            throw new Error('The password reset link is invalid.');
          }
          throw new Error(data.error || 'Failed to verify reset link');
        }

        setStatus('valid');
        setOobCodeValid(true);
      } catch (err) {
        console.error('Verification error:', err.message);
        setStatus('error');
        setError(err.message);
        
        if (err.message.includes('expired') || err.message.includes('invalid')) {
          setStatus('expired');
        }
      }
    };

    verifyResetLink();
  }, [oobCode, email, uid]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (newPassword !== confirmPassword) {
        throw new Error("Passwords don't match");
      }

      const response = await fetch('/api/user/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oobCode,
          newPassword,
          email,
          uid
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess(true);
      setTimeout(() => {
        navigate("/auth/login", { state: { passwordReset: true } });
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    const commonClasses = "w-full max-w-[500px] bg-[#1C2135] backdrop-blur-sm rounded-2xl p-8 text-white shadow-2xl border border-white/10";
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
              <h2 className="text-2xl font-bold text-center">Verifying your link</h2>
              <p className="text-gray-400 text-center">
                Please wait while we verify your password reset link...
              </p>
            </div>
          </motion.div>
        );
      case 'valid':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={commonClasses}
          >
            <button
              onClick={() => navigate("/auth/login")}
              className="flex items-center text-[#F59E0B] hover:text-[#F97316] mb-4 transition-colors"
            >
              <ArrowLeft size={18} className="mr-1" />
              Back to Login
            </button>

            <div className="text-center mb-6">
              <h2 className={`text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${ACCENT_GRADIENT}`}>
                Create New Password
              </h2>
              <p className="text-gray-400 mt-2 text-sm">
                Enter your new password below
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="New Password"
                  className="w-full bg-black/20 rounded-lg p-3 pl-10 pr-10 text-sm outline-none border border-white/10 focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 transition-all duration-300 group-hover:border-white/30 text-white placeholder-gray-500"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F59E0B]/80 group-hover:text-[#F59E0B] transition-colors" size={18} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="relative group">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm New Password"
                  className="w-full bg-black/20 rounded-lg p-3 pl-10 pr-10 text-sm outline-none border border-white/10 focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 transition-all duration-300 group-hover:border-white/30 text-white placeholder-gray-500"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F59E0B]/80 group-hover:text-[#F59E0B] transition-colors" size={18} />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <PasswordStrengthIndicator password={newPassword} />

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm"
                >
                  {error}
                </motion.div>
              )}

              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: isLoading ? 1 : 1.02 }}
                whileTap={{ scale: isLoading ? 1 : 0.98 }}
                className={`relative w-full bg-gradient-to-r ${ACCENT_GRADIENT} py-3 rounded-lg font-medium text-gray-950 hover:opacity-90 transition-opacity flex items-center justify-center`}
              >
                {isLoading ? (
                  <>
                    <span className="opacity-0">Updating...</span>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-5 w-5 border-2 border-gray-950 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  </>
                ) : (
                  "Reset Password"
                )}
              </motion.button>
            </form>

            <div className="mt-6 border-t border-white/10 pt-4">
              <p className="text-xs text-center text-gray-500">
                Use at least 6 characters with a mix of letters, numbers & symbols
              </p>
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
            <div className="flex justify-center mb-4">
              <Check className="text-green-500" size={iconSize} strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-500 mb-2">
                Password Reset!
              </h2>
              <p className="text-gray-400 mb-6">Your password has been successfully updated.</p>
              <p className="text-sm text-green-400 animate-pulse">Redirecting to login...</p>
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
                  onClick={() => navigate('/auth/reset-password')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-black/20 py-3 rounded-lg font-medium hover:bg-black/30 transition-colors border border-white/10 text-white"
                >
                  Request New Reset Link
                </motion.button>
              </div>
            </div>
          </motion.div>
        );
      case 'error':
      case 'invalid':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={commonClasses}
          >
            <div className="flex flex-col items-center space-y-4">
              <AlertTriangle className="text-red-500" size={iconSize} />
              <h2 className="text-2xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-rose-500">
                Invalid Link
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
                  onClick={() => navigate('/auth/reset-password')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-black/20 py-3 rounded-lg font-medium hover:bg-black/30 transition-colors border border-white/10 text-white"
                >
                  Request New Reset Link
                </motion.button>
              </div>
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-4 z-50">
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}