import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useContext } from "react";
import { ThemeContext } from "../context/ThemeContext";
import { FiRefreshCw, FiPause, FiPlay, FiShare2, FiCopy } from "react-icons/fi";
import { toast } from "react-hot-toast";

const quotes = [
  {
    id: "q1",
    text: "Stay hard.",
    author: "David Goggins",
    category: "motivation"
  },
  {
    id: "q2",
    text: "Success is always stressful.",
    author: "Andrew Tate",
    category: "success"
  },
  {
    id: "q3",
    text: "You don't get what you want, you get what you are.",
    author: "Ed Mylett",
    category: "mindset"
  },
  {
    id: "q4",
    text: "Every day is a chance to get better.",
    author: "Michael Oher",
    category: "growth"
  },
  {
    id: "q5",
    text: "Discipline is the bridge between goals and accomplishment.",
    author: "Jim Rohn",
    category: "discipline"
  },
  {
    id: "q6",
    text: "The only limit to our realization of tomorrow is our doubts of today.",
    author: "Franklin D. Roosevelt",
    category: "inspiration"
  }
];

const QuoteFeature = () => {
  const [index, setIndex] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const { theme } = useContext(ThemeContext);

  // Get random quote on first render
  useEffect(() => {
    setIndex(Math.floor(Math.random() * quotes.length));
  }, []);

  // Auto-rotation effect
  useEffect(() => {
    let interval;
    if (isAutoRotating) {
      interval = setInterval(() => {
        setIndex((prev) => (prev + 1) % quotes.length);
      }, 8000); // 8 seconds
    }
    return () => clearInterval(interval);
  }, [isAutoRotating]);

  const quote = quotes[index];

  const handleNextQuote = () => {
    setIndex((prev) => (prev + 1) % quotes.length);
    setIsAutoRotating(false);
    setTimeout(() => setIsAutoRotating(true), 30000); // Resume after 30s
  };

  const handlePrevQuote = () => {
    setIndex((prev) => (prev - 1 + quotes.length) % quotes.length);
    setIsAutoRotating(false);
    setTimeout(() => setIsAutoRotating(true), 30000); // Resume after 30s
  };

  const toggleRotation = () => {
    setIsAutoRotating(!isAutoRotating);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`"${quote.text}" — ${quote.author}`);
    toast.success("Quote copied to clipboard!");
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: "Inspirational Quote",
        text: `"${quote.text}" — ${quote.author}`,
        url: window.location.href,
      });
    } catch (err) {
      console.error("Sharing failed:", err);
      handleCopy();
    }
  };

  const getCategoryColor = () => {
    switch(quote.category) {
      case 'motivation': return 'bg-gradient-to-r from-yellow-500 to-orange-500';
      case 'success': return 'bg-gradient-to-r from-purple-500 to-pink-500';
      case 'mindset': return 'bg-gradient-to-r from-blue-500 to-indigo-500';
      case 'growth': return 'bg-gradient-to-r from-green-500 to-teal-500';
      case 'discipline': return 'bg-gradient-to-r from-red-500 to-amber-500';
      case 'inspiration': return 'bg-gradient-to-r from-cyan-500 to-blue-500';
      default: return 'bg-gradient-to-r from-gray-500 to-gray-700';
    }
  };

  return (
    <div 
      className="max-w-2xl mt-10 mx-auto relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Category indicator */}
      <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold text-white px-2 py-1 rounded-full ${getCategoryColor()}`}>
        {quote.category}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`p-6 rounded-xl shadow-lg transition-all duration-300 backdrop-blur-md border
          ${theme === "dark" 
            ? "bg-white/10 text-white border-white/20" 
            : "bg-black/5 text-black border-black/10"}`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={quote.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            <motion.p
              className="text-xl md:text-2xl font-medium italic leading-relaxed"
            >
              “{quote.text}”
            </motion.p>
            <p className="text-sm md:text-base font-medium tracking-wide opacity-80">
              — {quote.author}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Controls */}
        {(isHovered || !isAutoRotating) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="flex justify-center mt-4 space-x-4"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePrevQuote}
              className={`p-2 rounded-full ${theme === "dark" ? "bg-white/10" : "bg-black/10"}`}
              aria-label="Previous quote"
            >
              <FiRefreshCw className="rotate-180" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleRotation}
              className={`p-2 rounded-full ${theme === "dark" ? "bg-white/10" : "bg-black/10"}`}
              aria-label={isAutoRotating ? "Pause rotation" : "Resume rotation"}
            >
              {isAutoRotating ? <FiPause /> : <FiPlay />}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNextQuote}
              className={`p-2 rounded-full ${theme === "dark" ? "bg-white/10" : "bg-black/10"}`}
              aria-label="Next quote"
            >
              <FiRefreshCw />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCopy}
              className={`p-2 rounded-full ${theme === "dark" ? "bg-white/10" : "bg-black/10"}`}
              aria-label="Copy quote"
            >
              <FiCopy />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleShare}
              className={`p-2 rounded-full ${theme === "dark" ? "bg-white/10" : "bg-black/10"}`}
              aria-label="Share quote"
            >
              <FiShare2 />
            </motion.button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default QuoteFeature;