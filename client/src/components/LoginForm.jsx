import { useState } from "react";
import { auth } from "../config/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import { Toaster, toast } from 'react-hot-toast';

const LoginForm = ({ onSwitch }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // 🔒 allow secure cookie
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      toast.success('User signed in successfully!');
      navigate("/landing");
    } catch (err) {
      toast.error(err.message)
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError("")
    if (!email) {
      setError("Please enter your email first");
      return;
    }

    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/user/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setResetEmailSent(true);
      setMessage(data.message || "Reset link sent! Check your email.");
      toast.success(data.message || "Check your inbox for a reset link.");
      navigate('/auth/reset/password');
    } catch (err) {
      setError(err.message || "Failed to send reset email.");
      toast.error(err.message || "Error processing request.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <motion.div
        className="w-full max-w-[500px] bg-[#0c0c1e]/90 backdrop-blur-sm rounded-2xl p-8 text-white shadow-2xl border border-white/10"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
            Welcome Back
          </h2>
          <p className="text-white/70 text-sm">Sign in to continue</p>
        </div>

        {showResetForm ? (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-center">Reset Password</h3>
            <p className="text-sm text-white/70 text-center">
              Enter your email to receive a reset link
            </p>
            
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

            {resetEmailSent ? (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-green-300 text-sm"
              >
                Password reset email sent. Check your inbox.
              </motion.div>
            ) : (
              <motion.button
                onClick={handlePasswordReset}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Send Reset Link
              </motion.button>
            )}

            <button 
              onClick={() => setShowResetForm(false)}
              className="w-full text-center text-blue-400 text-sm hover:text-blue-300 transition-colors"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="flex flex-col space-y-4">
            {/* Email */}
            <div className="relative group">
              <input
                type="email"
                placeholder="Email"
                className="w-full bg-black/20 rounded-lg p-3 pl-10 text-sm outline-none border border-white/10 focus:border-blue-500/50 transition-all duration-300 group-hover:border-white/30"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400/80 group-hover:text-blue-400 transition-colors" size={18} />
            </div>

            {/* Password */}
            <div className="relative group">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="w-full bg-black/20 rounded-lg p-3 pl-10 pr-10 text-sm outline-none border border-white/10 focus:border-blue-500/50 transition-all duration-300 group-hover:border-white/30"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400/80 group-hover:text-blue-400 transition-colors" size={18} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="flex justify-end">
              <button 
                type="button"
                onClick={() => setShowResetForm(true)}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Forgot Password?
              </button>
            </div>

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
              className="relative bg-gradient-to-r from-blue-600 to-indigo-600 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <span className="opacity-0">Login</span>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                </>
              ) : (
                "Login"
              )}
            </motion.button>
          </form>
        )}

        <div className="mt-6 text-sm text-center text-white/70">
          <span>Don't have an account? </span>
          <button 
            onClick={onSwitch} 
            className="text-blue-400 font-medium hover:text-blue-300 transition-colors"
          >
            Sign Up
          </button>
        </div>

        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="text-xs text-center text-white/50">
            By continuing, you agree to our Terms and Privacy Policy
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginForm;