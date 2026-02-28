import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import LoginForm from "../components/LoginForm";
import RegisterForm from "../components/RegisterForm";
import { useEffect, useMemo } from "react";
import { FiArrowLeft } from "react-icons/fi";
import ParticlesBackground from "../components/ParticlesBackground";
import LoadingSpinner from "../components/LoadingSpinner";

const AuthPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Sync back to /auth/login if at root
  useEffect(() => {
    if (location.pathname === "/auth" || location.pathname === "/") {
      navigate("/auth/login", { replace: true });
    }
  }, [location.pathname, navigate]);

  const isLogin = useMemo(() => location.pathname.includes("login"), [location.pathname]);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0b0b1a] to-[#1a1a2e] transition-colors duration-500 overflow-hidden">
      {/* Particles Background */}
      {/* <ParticlesBackground /> */}
      
      {/* Back Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 z-10 flex items-center gap-2 text-white/80 hover:text-white transition-colors"
      >
        <FiArrowLeft size={20} />
        <span className="text-sm font-medium">Back to Home</span>
      </motion.button>

      {/* Auth Container */}
      <div className="relative w-[90%] max-w-[500px] min-h-[520px] z-10">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="login"
              element={
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
                >
                  <LoginForm 
                    onSwitch={() => navigate("/auth/register")} 
                  />
                </motion.div>
              }
            />
            <Route
              path="register"
              element={
                <motion.div
                  initial={{ y: -20, opacity: 0, scale: 0.8 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 20, opacity: 0, scale: 0.8 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 300, 
                    damping: 20,
                    duration: 0.3
                  }}
                >
                  <RegisterForm 
                    onSwitch={() => navigate("/auth/login")} 
                  />
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