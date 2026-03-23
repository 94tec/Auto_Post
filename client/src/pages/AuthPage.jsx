import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useEffect } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';

const ACCENT = '#F59E0B';

const AuthPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === '/auth' || location.pathname === '/auth/') {
      navigate('/auth/login', { replace: true });
    }
  }, [location.pathname, navigate]);

  const isLogin = useMemo(
    () => location.pathname.includes('login'),
    [location.pathname],
  );

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center
                    bg-[#0A0E1A] overflow-hidden px-4 py-10">

      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2
                        w-[600px] h-[300px] rounded-full blur-[120px] opacity-10"
             style={{ background: ACCENT }} />
      </div>

      <motion.button
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 z-20 flex items-center gap-2
                   text-[13px] font-medium text-white/35 hover:text-white/70
                   transition-colors"
      >
        <FiArrowLeft size={16} />
        Home
      </motion.button>

      <div className={`relative z-10 w-full transition-all duration-300
                      ${isLogin ? 'max-w-[420px]' : 'max-w-[440px]'}`}>
        <AnimatePresence mode="wait">
          {/* ↓ removed location={location} — that was causing the crash */}
          <Routes key={location.pathname}>
            <Route
              path="login"
              element={
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0,  scale: 1    }}
                  exit={{    opacity: 0, y: -10, scale: 0.97 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <LoginForm onSwitch={() => navigate('/auth/register')} />
                </motion.div>
              }
            />
            <Route
              path="register"
              element={
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0,  scale: 1    }}
                  exit={{    opacity: 0, y: -10, scale: 0.97 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <RegisterForm onSwitch={() => navigate('/auth/login')} />
                </motion.div>
              }
            />
          </Routes>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AuthPage;