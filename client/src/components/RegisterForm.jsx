// RegisterForm.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator';
import LoadingSpinner from '../components/LoadingSpinner';

const ACCENT_GRADIENT = 'from-[#F59E0B] to-[#F97316]';

const RegisterForm = ({ onSwitch }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      setMessage('✅ Verification email sent. Please check your inbox.');

      // Clear form
      setName('');
      setEmail('');
      setPassword('');

      // Navigate after a short delay
      setTimeout(() => {
        navigate('/auth/welcome', { state: { email }, replace: true });
      }, 2000);
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <motion.div className="w-full max-w-[500px] bg-[#1C2135] backdrop-blur-sm rounded-2xl p-8 text-white shadow-2xl border border-white/10">
        <div className="text-center mb-8">
          <h2 className={`text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r ${ACCENT_GRADIENT}`}>
            Create Account
          </h2>
          <p className="text-gray-400 text-sm">Join our community today</p>
        </div>

        <form onSubmit={handleRegister} className="flex flex-col space-y-4">
          {/* Name input */}
          <div className="relative group">
            <input
              type="text"
              placeholder="Your Name"
              className="w-full bg-black/20 rounded-lg p-3 pl-10 text-sm outline-none border border-white/10 focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 transition-all duration-300 group-hover:border-white/30 text-white placeholder-gray-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F59E0B]/80 group-hover:text-[#F59E0B] transition-colors" size={18} />
          </div>

          {/* Email input */}
          <div className="relative group">
            <input
              type="email"
              placeholder="Email"
              className="w-full bg-black/20 rounded-lg p-3 pl-10 text-sm outline-none border border-white/10 focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 transition-all duration-300 group-hover:border-white/30 text-white placeholder-gray-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F59E0B]/80 group-hover:text-[#F59E0B] transition-colors" size={18} />
          </div>

          {/* Password input */}
          <div className="relative group">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              className="w-full bg-black/20 rounded-lg p-3 pl-10 pr-10 text-sm outline-none border border-white/10 focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 transition-all duration-300 group-hover:border-white/30 text-white placeholder-gray-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          <PasswordStrengthIndicator password={password} />

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm"
            >
              {error}
            </motion.div>
          )}

          {/* Success message */}
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-green-300 text-sm"
            >
              {message}
            </motion.div>
          )}

          {/* Submit button */}
          <motion.button
            type="submit"
            disabled={isLoading}
            whileHover={{ scale: isLoading ? 1 : 1.02 }}
            whileTap={{ scale: isLoading ? 1 : 0.98 }}
            className={`relative bg-gradient-to-r ${ACCENT_GRADIENT} py-3 rounded-lg font-medium text-gray-950 hover:opacity-90 transition-opacity flex items-center justify-center`}
          >
            {isLoading ? (
              <>
                <span className="opacity-0">Register</span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <LoadingSpinner size="small" />
                </div>
              </>
            ) : (
              'Register'
            )}
          </motion.button>
        </form>

        <div className="mt-6 text-sm text-center text-gray-400">
          <span>Already have an account? </span>
          <button
            onClick={onSwitch}
            className="text-[#F59E0B] font-medium hover:text-[#F97316] transition-colors"
            disabled={isLoading}
          >
            Sign In
          </button>
        </div>

        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="text-xs text-center text-gray-500">
            By registering, you agree to our Terms and Privacy Policy
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterForm;