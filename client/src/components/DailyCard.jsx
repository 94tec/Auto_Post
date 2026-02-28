import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { FiChevronLeft, FiMenu, FiPhone, FiMail } from "react-icons/fi";
//import quotes from "../assets/quotes-warmup.json";
import quotes from "../assets/quotes2.json";

const DailyCard = () => {
  const [month, setMonth] = useState("");
  const [dayWithSuffix, setDayWithSuffix] = useState("");
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const intervalRef = useRef(null);

  // Rotate quote every 10 seconds
  useEffect(() => {
    if (isAutoRotating) {
      intervalRef.current = setInterval(() => {
        setQuoteIndex((prevIndex) => (prevIndex + 1) % quotes.length);
      }, 10000); // 10 seconds
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isAutoRotating]);

  useEffect(() => {
    const date = new Date();
    const options = { month: "long" };
    const monthStr = new Intl.DateTimeFormat("en-US", options).format(date);
    const day = date.getDate();
    const suffix =
      day === 1 || day === 21 || day === 31 ? "st" :
      day === 2 || day === 22 ? "nd" :
      day === 3 || day === 23 ? "rd" : "th";
    setMonth(monthStr);
    setDayWithSuffix(`${day}${suffix}`);
  }, []);

  const quote = quotes[quoteIndex];

  const handleNextQuote = () => {
    setQuoteIndex((prevIndex) => (prevIndex + 1) % quotes.length);
    setIsAutoRotating(false);
    setTimeout(() => setIsAutoRotating(true), 30000); // Resume auto-rotate after 30s
  };

  const handlePrevQuote = () => {
    setQuoteIndex((prevIndex) => (prevIndex - 1 + quotes.length) % quotes.length);
    setIsAutoRotating(false);
    setTimeout(() => setIsAutoRotating(true), 30000); // Resume auto-rotate after 30s
  };

  const getCategoryColor = (category) => {
    switch(category) {
      case 'motivation': return 'from-yellow-500 to-orange-500';
      case 'mindset': return 'from-blue-400 to-indigo-600';
      case 'discipline': return 'from-green-500 to-emerald-600';
      case 'success': return 'from-purple-500 to-pink-600';
      case 'resilience': return 'from-red-500 to-amber-600';
      case 'persistence': return 'from-cyan-400 to-blue-600';
      case 'belief': return 'from-violet-500 to-purple-600';
      case 'action': return 'from-lime-400 to-green-600';
      case 'growth': return 'from-teal-400 to-cyan-600';
      case 'determination': return 'from-rose-500 to-red-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4 font-sans">
      {/* Phone frame container */}
      <div className="relative w-full max-w-[360px] h-[640px] bg-[linear-gradient(180deg,_#0d1433_0%,_#050505_25%,_#1a1a1a_50%,_#0d1433_95%,_#050505_100%)] rounded-[36px] shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden border border-gray-700/50">
        
        {/* Screen glare effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-1/2 h-1/3 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-xl"></div>
        </div>

        {/* Notch Simulation */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[130px] h-[30px] bg-black/90 rounded-full z-10 border border-gray-700/50" />

        {/* Top Buttons */}
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

        {/* Status Bar */}
        <div className="absolute top-5 left-0 right-0 px-16 flex justify-between items-center z-10">
          <span className="text-xs text-white/80 font-medium">94tec</span>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm"></div>
            <div className="w-3 h-3 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm"></div>
            <div className="w-3 h-3 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm"></div>
          </div>
        </div>

        {/* Date Card */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="absolute top-20 left-0 right-0 px-4 pointer-events-none z-10"
        >
          <div className="relative w-full max-w-[95%] mx-auto px-4 py-6 flex flex-col items-center justify-center overflow-hidden">
            {/* Animated gradient ring */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border-[6px] border-transparent border-t-white/10 border-r-white/5"
            ></motion.div>

            {/* Month */}
            <motion.h1
              className="text-xl tracking-widest uppercase select-none bg-gradient-to-r from-yellow-500 via-orange-400 to-red-400 bg-clip-text text-transparent drop-shadow-md"
              whileHover={{ scale: 1.05 }}
            >
              {month}
            </motion.h1>

            {/* Day */}
            <motion.h2
              className="text-5xl font-bold tracking-tight leading-none mt-1 drop-shadow-xl select-none bg-gradient-to-br from-amber-500 via-yellow-400 to-orange-400 bg-clip-text text-transparent"
              whileHover={{ scale: 1.1 }}
            >
              {dayWithSuffix}
            </motion.h2>
          </div>
        </motion.div>

        {/* Quote Card */}
        <div className="absolute top-[250px] left-0 right-0 px-4 z-20 font-sans">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="w-full max-w-[97%] mx-auto px-5 py-6 rounded-3xl relative overflow-hidden"
            style={{
              background: "rgba(255, 255, 255, 0.85)",
              boxShadow: "0 4px 30px rgba(238, 227, 227, 0.3)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            {/* Category indicator */}
            <div className={`absolute top-1 right-2 text-xs font-semibold px-2 py-1 rounded-2xl bg-gradient-to-r ${getCategoryColor(quote.category)} text-white`}>
              {quote.category}
            </div>

            {/* Quote content with AnimatePresence */}
            <AnimatePresence mode="wait">
              <motion.div
                key={quote.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6 }}
                className="relative"
              >
                <p className="text-gray-800 text-lg mt-4 leading-relaxed text-center font-medium tracking-tight">
                  “{quote.text}”
                </p>
                <p className="text-sm mt-4 text-center font-medium pr-2 tracking-wide" style={{ color: '#A86523' }}>
                  — {quote.author}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Navigation arrows */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-between px-4">
              <motion.button
                onClick={handlePrevQuote}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow-md hover:bg-white"
              >
                <FiChevronLeft className="text-gray-700" />
              </motion.button>
              <motion.button
                onClick={handleNextQuote}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow-md hover:bg-white"
              >
                <FiChevronLeft className="text-gray-700 rotate-180" />
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Bottom Navigation */}
        <motion.div 
          className="absolute bottom-6 left-0 right-0 px-6 z-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <div className="flex justify-between items-center w-full max-w-[90%] mx-auto gap-3">
            {/* Call Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative w-12 h-12 rounded-2xl overflow-hidden backdrop-blur-lg border border-white/30 bg-white/10 hover:bg-white/20 transition-all duration-300 shadow-lg flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5"></div>
              <FiPhone className="w-6 h-6 text-white/90" />
            </motion.button>

            {/* Damuchi Text Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="relative flex-1 h-12 rounded-2xl overflow-hidden backdrop-blur-lg border border-white/30 bg-gradient-to-r from-amber-700/40 to-amber-600/60 hover:from-amber-700/50 hover:to-amber-600/70 transition-all duration-300 shadow-lg flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5"></div>
              <span className="text-white/90 text-lg font-medium tracking-wider">
                Damuchi
              </span>
            </motion.button>

            {/* Message Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative w-12 h-12 rounded-2xl overflow-hidden backdrop-blur-lg border border-white/30 bg-white/10 hover:bg-white/20 transition-all duration-300 shadow-lg flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5"></div>
              <FiMail className="w-6 h-6 text-white/90" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DailyCard;