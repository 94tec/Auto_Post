import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, Check } from "lucide-react";
import axios from "axios";


export default function ResendVerification() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleResend = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const res = await fetch('/api/resend-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Resend failed');
      }

      setMessage(data.message || "Verification email sent. Please check your inbox.");
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-4 z-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[500px] bg-[#0c0c1e]/90 backdrop-blur-sm rounded-2xl p-8 text-white shadow-2xl border border-white/10"
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-blue-400 hover:text-blue-300 mb-4 transition-colors"
        >
          <ArrowLeft size={18} className="mr-1" />
          Back
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
            Resend Verification Email
          </h2>
          <p className="text-white/70 mt-2 text-sm">
            Enter your email to receive a new verification link
          </p>
        </div>

        <form onSubmit={handleResend} className="space-y-4">
          <div className="relative group">
            <input
              type="email"
              placeholder="Your Email"
              className="w-full bg-black/20 rounded-lg p-3 pl-10 text-sm outline-none border border-white/10 focus:border-blue-500/50 transition-all duration-300 group-hover:border-white/30"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400/80 group-hover:text-blue-400 transition-colors" size={18} />
          </div>

          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-green-300 text-sm flex items-center"
            >
              <Check className="mr-2" size={18} />
              {message}
            </motion.div>
          )}

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
            className="relative w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <span className="opacity-0">Sending...</span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              </>
            ) : (
              "Send Verification Email"
            )}
          </motion.button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="text-xs text-center text-white/50">
            Didn't receive the email? Check your spam folder
          </p>
        </div>
      </motion.div>
    </div>
  );
}