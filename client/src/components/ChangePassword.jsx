import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { auth } from "../config/firebase";
import { updatePassword } from "firebase/auth";

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      return;
    }

    setIsLoading(true);

    try {
      await updatePassword(auth.currentUser, newPassword);
      setMessage("Password updated successfully");
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-4 z-50">
      <motion.div
        initial={{ y: -20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 20,
          duration: 0.3
        }}
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
            Change Password
          </h2>
          <p className="text-white/70 mt-2 text-sm">
            Create a new secure password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative group">
            <input
              type={showCurrent ? "text" : "password"}
              placeholder="Current Password"
              className="w-full bg-black/20 rounded-lg p-3 pl-10 pr-10 text-sm outline-none border border-white/10 focus:border-blue-500/50 transition-all duration-300 group-hover:border-white/30"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400/80 group-hover:text-blue-400 transition-colors" size={18} />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
            >
              {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="relative group">
            <input
              type={showNew ? "text" : "password"}
              placeholder="New Password"
              className="w-full bg-black/20 rounded-lg p-3 pl-10 pr-10 text-sm outline-none border border-white/10 focus:border-blue-500/50 transition-all duration-300 group-hover:border-white/30"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400/80 group-hover:text-blue-400 transition-colors" size={18} />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
            >
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="relative group">
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm New Password"
              className="w-full bg-black/20 rounded-lg p-3 pl-10 pr-10 text-sm outline-none border border-white/10 focus:border-blue-500/50 transition-all duration-300 group-hover:border-white/30"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400/80 group-hover:text-blue-400 transition-colors" size={18} />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-green-300 text-sm"
            >
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
                <span className="opacity-0">Updating...</span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              </>
            ) : (
              "Update Password"
            )}
          </motion.button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="text-xs text-center text-white/50">
            Use at least 6 characters with a mix of letters, numbers & symbols
          </p>
        </div>
      </motion.div>
    </div>
  );
}