// WelcomeVerifyEmail.jsx
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../config/firebase";
import { sendEmailVerification, onAuthStateChanged } from "firebase/auth";
import { motion } from "framer-motion";
import { Mail, CheckCircle, AlertCircle, RotateCw } from "lucide-react";

const ACCENT_GRADIENT = 'from-[#F59E0B] to-[#F97316]';

const WelcomeVerifyEmail = () => {
  const [email, setEmail] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setEmail(location.state?.email || auth.currentUser?.email || "");

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setEmail(user.email);
        setIsVerified(user.emailVerified);
        setIsLoading(false);
        
        if (user.emailVerified) {
          setTimeout(() => {
            navigate("/login", { 
              state: { email: user.email, verified: true },
              replace: true 
            });
          }, 2000);
        }
      } else {
        navigate("/login", { replace: true });
      }
    });

    const interval = setInterval(() => {
      auth.currentUser?.reload().then(() => {
        setIsVerified(auth.currentUser?.emailVerified || false);
      });
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [navigate, location]);

  const handleResendVerification = async () => {
    try {
      setIsSending(true);
      setError("");
      setSuccess("");
      
      if (!auth.currentUser) {
        throw new Error("No user found. Please try logging in again.");
      }

      await sendEmailVerification(auth.currentUser);
      setSuccess("Verification email resent successfully!");
    } catch (err) {
      setError(err.message || "Failed to resend verification email");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#0A0E1A]">
        <div className="h-12 w-12 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex items-center justify-center p-4 bg-[#0A0E1A]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#1C2135] backdrop-blur-md rounded-2xl p-8 text-white shadow-xl border border-white/10"
      >
        <div className="text-center mb-8">
          {isVerified ? (
            <>
              <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
              <h2 className="text-3xl font-bold mb-2">Email Verified!</h2>
              <p className="text-gray-400">Redirecting you to login...</p>
            </>
          ) : (
            <>
              <Mail className="mx-auto h-16 w-16 text-[#F59E0B] mb-4" />
              <h2 className={`text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r ${ACCENT_GRADIENT}`}>
                Verify Your Email
              </h2>
              <p className="text-gray-400">
                We've sent a verification link to <span className="font-semibold text-white">{email}</span>
              </p>
            </>
          )}
        </div>

        {!isVerified && (
          <>
            <div className="bg-amber-900/20 border border-amber-500/50 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertCircle className="flex-shrink-0 h-5 w-5 text-amber-400 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-amber-300">Check your inbox</h3>
                  <div className="mt-2 text-sm text-amber-200">
                    <p>
                      Click the link in the email we sent to verify your account. 
                      If you don't see it, check your spam folder.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-center text-sm text-gray-400 mb-4">
                Didn't receive the email?
              </p>
              
              <motion.button
                onClick={handleResendVerification}
                disabled={isSending}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center justify-center bg-gradient-to-r ${ACCENT_GRADIENT} py-3 px-4 rounded-lg font-medium text-gray-950 hover:opacity-90 transition-opacity`}
              >
                {isSending ? (
                  <>
                    <RotateCw className="animate-spin h-5 w-5 mr-2" />
                    Sending...
                  </>
                ) : (
                  "Resend Verification Email"
                )}
              </motion.button>
            </div>
          </>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm"
          >
            {error}
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-green-300 text-sm"
          >
            {success}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default WelcomeVerifyEmail;