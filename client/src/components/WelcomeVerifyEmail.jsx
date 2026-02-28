import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../config/firebase";
import { sendEmailVerification, onAuthStateChanged } from "firebase/auth";
import { motion } from "framer-motion";
import { Mail, CheckCircle, AlertCircle, RotateCw } from "lucide-react";

const WelcomeVerifyEmail = () => {
  const [email, setEmail] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // Check verification status periodically
  useEffect(() => {
    setEmail(location.state?.email || auth.currentUser?.email || "");

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setEmail(user.email);
        setIsVerified(user.emailVerified);
        setIsLoading(false);
        
        // If verified, navigate to login after short delay
        if (user.emailVerified) {
          setTimeout(() => {
            navigate("/login", { 
              state: { email: user.email, verified: true },
              replace: true 
            });
          }, 2000);
        }
      } else {
        // No user logged in, navigate to login
        navigate("/login", { replace: true });
      }
    });

    // Check verification every 5 seconds
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
      <div className="w-full h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0c0c1e] to-[#1a1a2e]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-md rounded-2xl p-8 text-white shadow-xl border border-white/10"
      >
        <div className="text-center mb-8">
          {isVerified ? (
            <>
              <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
              <h2 className="text-3xl font-bold mb-2">Email Verified!</h2>
              <p className="text-white/80">Redirecting you to login...</p>
            </>
          ) : (
            <>
              <Mail className="mx-auto h-16 w-16 text-purple-400 mb-4" />
              <h2 className="text-3xl font-bold mb-2">Verify Your Email</h2>
              <p className="text-white/80">
                We've sent a verification link to <span className="font-semibold">{email}</span>
              </p>
            </>
          )}
        </div>

        {!isVerified && (
          <>
            <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertCircle className="flex-shrink-0 h-5 w-5 text-yellow-400 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-300">Check your inbox</h3>
                  <div className="mt-2 text-sm text-yellow-200">
                    <p>
                      Click the link in the email we sent to verify your account. 
                      If you don't see it, check your spam folder.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-center text-sm text-white/70 mb-4">
                Didn't receive the email?
              </p>
              
              <motion.button
                onClick={handleResendVerification}
                disabled={isSending}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center bg-purple-600 hover:bg-purple-700 py-3 px-4 rounded-lg font-medium transition-colors"
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