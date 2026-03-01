// DailyCard.jsx 
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { FiChevronLeft, FiMenu, FiPhone, FiMail } from "react-icons/fi";
import quotes from "../assets/quotes2.json";

const ACCENT_GRADIENT = 'from-[#F59E0B] to-[#F97316]';

const DailyCard = () => {
  const [month, setMonth] = useState("");
  const [dayWithSuffix, setDayWithSuffix] = useState("");
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isAutoRotating) {
      intervalRef.current = setInterval(() => {
        setQuoteIndex((prevIndex) => (prevIndex + 1) % quotes.length);
      }, 10000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isAutoRotating]);

  useEffect(() => {
    const date = new Date();
    const monthStr = new Intl.DateTimeFormat("en-US", { month: "long" }).format(date);
    const day = date.getDate();
    const suffix = [1,21,31].includes(day) ? "st" : [2,22].includes(day) ? "nd" : [3,23].includes(day) ? "rd" : "th";
    setMonth(monthStr);
    setDayWithSuffix(`${day}${suffix}`);
  }, []);

  const quote = quotes[quoteIndex];

  const handleNextQuote = () => {
    setQuoteIndex((prevIndex) => (prevIndex + 1) % quotes.length);
    setIsAutoRotating(false);
    setTimeout(() => setIsAutoRotating(true), 30000);
  };

  const handlePrevQuote = () => {
    setQuoteIndex((prevIndex) => (prevIndex - 1 + quotes.length) % quotes.length);
    setIsAutoRotating(false);
    setTimeout(() => setIsAutoRotating(true), 30000);
  };

  const getCategoryColor = (category) => {
    // Use gold for all categories? Or keep original? We'll use gold gradient for consistency.
    return ACCENT_GRADIENT;
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center p-4 font-sans">
      <div className="relative w-full max-w-[360px] h-[640px] bg-[linear-gradient(180deg,_#0A0E1A_0%,_#050505_25%,_#1a1a1a_50%,_#0A0E1A_95%,_#050505_100%)] rounded-[36px] shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden border border-gray-700/50">

        {/* Screen glare */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-1/2 h-1/3 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-xl"></div>
        </div>

        {/* Notch */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[130px] h-[30px] bg-black/90 rounded-full z-10 border border-gray-700/50" />

        {/* Top buttons */}
        <div className="absolute top-3 left-3 z-20">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-8 h-8 bg-white/10 border border-white/20 rounded-full flex items-center justify-center text-white/80 backdrop-blur-md shadow-sm hover:text-white transition-colors"
          >
            <FiChevronLeft size={16} />
          </motion.button>
        </div>
        <div className="absolute top-3 right-3 z-20">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-8 h-8 bg-white/10 border border-white/20 rounded-full flex items-center justify-center text-white/80 backdrop-blur-md shadow-sm hover:text-white transition-colors"
          >
            <FiMenu size={16} />
          </motion.button>
        </div>

        {/* Status bar */}
        <div className="absolute top-5 left-0 right-0 px-16 flex justify-between items-center z-10">
          <span className="text-xs text-white/70 font-medium">94tec</span>
          <div className="flex items-center gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm" />
            ))}
          </div>
        </div>

        {/* Date section */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="absolute top-20 left-0 right-0 px-4 pointer-events-none z-10"
        >
          <div className="relative w-full max-w-[95%] mx-auto px-4 py-6 flex flex-col items-center justify-center overflow-hidden">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border-[6px] border-transparent border-t-white/10 border-r-white/5"
            />
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-24 h-24 bg-[#F59E0B]/20 rounded-full blur-3xl animate-ping z-[-1]" />
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-[#F97316]/15 rounded-full blur-2xl z-[-1]" />
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute bg-white/20 rounded-full pointer-events-none"
                style={{
                  width: `${Math.random() * 4 + 2}px`,
                  height: `${Math.random() * 4 + 2}px`,
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animation: `floatGlow ${Math.random() * 12 + 8}s ease-in-out infinite`,
                  opacity: Math.random() * 0.3 + 0.1,
                }}
              />
            ))}
            <motion.h1
              whileHover={{ scale: 1.05 }}
              className={`text-xl tracking-widest uppercase select-none bg-gradient-to-r ${ACCENT_GRADIENT} bg-clip-text text-transparent drop-shadow-md`}
            >
              {month}
            </motion.h1>
            <motion.h2
              whileHover={{ scale: 1.08 }}
              className={`text-5xl font-bold tracking-tight leading-none mt-1 drop-shadow-xl select-none bg-gradient-to-br ${ACCENT_GRADIENT} bg-clip-text text-transparent`}
            >
              {dayWithSuffix}
            </motion.h2>
          </div>
        </motion.div>

        {/* Quote card */}
        <div className="absolute top-[250px] left-0 right-0 px-4 z-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="w-full max-w-[97%] mx-auto px-5 py-6 rounded-3xl relative overflow-hidden"
            style={{
              background: "#1C2135",
              boxShadow: "0 4px 30px rgba(0,0,0,0.5)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {quote?.category && (
              <div className={`absolute top-2 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${ACCENT_GRADIENT} text-white tracking-wide`}>
                {quote.category}
              </div>
            )}

            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-36 h-36 bg-[#F59E0B]/10 blur-3xl rounded-full z-[-1] animate-pulse" />

            <AnimatePresence mode="wait">
              <motion.div
                key={quote.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.55 }}
                className="mt-3"
              >
                <p className="text-gray-200 text-[15px] leading-relaxed text-center font-medium tracking-tight">
                  "{quote.text}"
                </p>
                <p className="text-[11px] mt-3 text-center font-semibold tracking-[0.1em] uppercase text-[#F59E0B]">
                  — {quote.author}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Prev/Next arrows */}
            <div className="absolute bottom-2.5 left-0 right-0 flex justify-between px-4">
              <motion.button
                onClick={handlePrevQuote}
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.9 }}
                className="w-8 h-8 bg-[#1C2135] border border-white/20 rounded-full flex items-center justify-center shadow-md hover:bg-[#2a3045] text-[#F59E0B]"
              >
                <FiChevronLeft size={15} />
              </motion.button>
              <motion.button
                onClick={handleNextQuote}
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.9 }}
                className="w-8 h-8 bg-[#1C2135] border border-white/20 rounded-full flex items-center justify-center shadow-md hover:bg-[#2a3045] text-[#F59E0B]"
              >
                <FiChevronLeft className="rotate-180" size={15} />
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Bottom nav */}
        <motion.div
          className="absolute bottom-6 left-0 right-0 px-6 z-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <div className="flex justify-between items-center w-full max-w-[90%] mx-auto gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative w-12 h-12 rounded-2xl overflow-hidden backdrop-blur-lg border border-white/30 bg-white/10 hover:bg-white/20 transition-all shadow-lg flex items-center justify-center text-[#F59E0B]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5" />
              <FiPhone className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="relative flex-1 h-12 rounded-2xl overflow-hidden backdrop-blur-lg border border-white/30 bg-gradient-to-r from-[#F59E0B]/30 to-[#F97316]/40 hover:from-[#F59E0B]/40 hover:to-[#F97316]/50 transition-all shadow-lg flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5" />
              <span className={`text-lg font-semibold tracking-widest bg-gradient-to-r ${ACCENT_GRADIENT} bg-clip-text text-transparent drop-shadow-lg`}>
                Damuchi
              </span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative w-12 h-12 rounded-2xl overflow-hidden backdrop-blur-lg border border-white/30 bg-white/10 hover:bg-white/20 transition-all shadow-lg flex items-center justify-center text-[#F59E0B]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5" />
              <FiMail className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes floatGlow {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.2; }
          50% { transform: translateY(-20px) scale(1.2); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};

export default DailyCard;