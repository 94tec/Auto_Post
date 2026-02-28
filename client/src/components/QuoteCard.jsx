import { motion, AnimatePresence } from "framer-motion";
import { FiEdit2, FiTrash2, FiCopy, FiShare2 } from "react-icons/fi";
import { useState } from "react";
import { toast } from "react-hot-toast";

const QuoteCard = ({ quote, onEdit, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="bg-gradient-to-br from-gray-800 to-gray-900 p-5 rounded-xl relative shadow-lg border border-gray-700 hover:border-gray-600 transition-all"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Quote Content */}
      <div className="space-y-3">
        <motion.p 
          className="text-lg text-gray-100 leading-relaxed cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
          animate={{ 
            WebkitLineClamp: isExpanded ? 'unset' : 3,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          “{quote.text}”
        </motion.p>
        
        <p className="text-sm text-gray-400 text-right italic">
          — {quote.author}
        </p>
      </div>

      {/* Action Buttons */}
      <AnimatePresence>
        {(isHovered || isExpanded) && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.2 }}
            className="absolute top-3 right-3 flex space-x-2 bg-gray-900/80 backdrop-blur-sm rounded-lg p-1 shadow-lg border border-gray-700"
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onEdit(quote)}
              className="p-1.5 text-gray-300 hover:text-yellow-400 transition-colors"
              title="Edit quote"
            >
              <FiEdit2 size={16} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleCopy}
              className="p-1.5 text-gray-300 hover:text-blue-400 transition-colors"
              title="Copy quote"
            >
              <FiCopy size={16} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleShare}
              className="p-1.5 text-gray-300 hover:text-green-400 transition-colors"
              title="Share quote"
            >
              <FiShare2 size={16} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onDelete(quote.id)}
              className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
              title="Delete quote"
            >
              <FiTrash2 size={16} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expand/Collapse Indicator */}
      <motion.div
        className="absolute bottom-2 right-2 text-xs text-gray-500 hover:text-gray-400 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.1 }}
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </motion.div>
    </motion.div>
  );
};

export default QuoteCard;