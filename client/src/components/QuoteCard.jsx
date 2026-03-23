// QuoteCard.jsx — refactored to match Landing design system
import { motion, AnimatePresence } from 'framer-motion';
import { FiEdit2, FiTrash2, FiCopy, FiShare2, FiMoreVertical, FiStar } from 'react-icons/fi';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';


const ACCENT_GRADIENT = 'from-[#F59E0B] to-[#F97316]';
const ACCENT = '#F59E0B';

const CAT_COLORS = {
  motivation:    'from-yellow-500 to-orange-500',
  mindset:       'from-blue-400 to-indigo-600',
  discipline:    'from-green-500 to-emerald-600',
  success:       'from-purple-500 to-pink-600',
  resilience:    'from-red-500 to-amber-600',
  persistence:   'from-cyan-400 to-blue-600',
  belief:        'from-violet-500 to-purple-600',
  action:        'from-lime-400 to-green-600',
  growth:        'from-teal-400 to-cyan-600',
  determination: 'from-rose-500 to-red-600',
  inspiration:   'from-sky-400 to-blue-500',
  default:       'from-gray-500 to-gray-600',
};

const QuoteCard = ({ quote, onEdit, onDelete, onFavorite, index = 0 }) => {
  
  const { user } = useAuth();
 
  const canEdit = user && (user.role === 'admin' || quote.userId === user.uid);

  const canDelete = user && (user.role === 'admin' || quote.userId === user.uid);

  const [menuOpen, setMenuOpen] = useState(false);
  const [isExpanded, setIsExpanded]   = useState(false);
  const [isDeleting, setIsDeleting]   = useState(false);
  const menuRef = useRef(null);

  const catColor = CAT_COLORS[quote?.category] || CAT_COLORS.default;
  const isLong = quote?.text?.length > 120;

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(`"${quote.text}" — ${quote.author}`);
    toast.success('Copied to clipboard!');
    setMenuOpen(false);
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: 'Damuchi',
        text: `"${quote.text}" — ${quote.author}`,
        url: window.location.href,
      });
    } catch {
      handleCopy();
    }
    setMenuOpen(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setMenuOpen(false);
    try {
      await onDelete(quote.id);
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: isDeleting ? 0 : 1, y: 0, scale: isDeleting ? 0.94 : 1 }}
      exit={{ opacity: 0, scale: 0.94, y: -8 }}
      transition={{
        layout: { type: 'spring', stiffness: 300, damping: 28 },
        default: { duration: 0.32, delay: index * 0.05 },
      }}
      className="group relative flex flex-col bg-[#1C2135] rounded-2xl border border-white/8
                 hover:border-white/16 transition-all duration-300
                 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden"
    >
      {/* Top accent line (category colour) */}
      <div className={`h-0.5 w-full bg-gradient-to-r ${catColor}`} />

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Header row: category chip + favorite + menu */}
        <div className="flex items-start justify-between gap-2">
          {quote.category && (
            <span className={`shrink-0 inline-flex items-center text-[10px] font-bold px-2.5 py-0.5
                              rounded-full bg-gradient-to-r ${catColor} text-white tracking-wide uppercase`}>
              {quote.category}
            </span>
          )}

          <div className="ml-auto flex items-center gap-0.5 shrink-0">
            {/* favorite star */}
            {onFavorite && (
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => onFavorite(quote.id, !quote.isFavorite)}
                aria-label={quote.isFavorite ? 'Unfavourite' : 'Favourite'}
                className="w-7 h-7 rounded-lg flex items-center justify-center
                           transition-colors hover:bg-white/8"
              >
                <FiStar
                  size={13}
                  style={quote.isFavorite
                    ? { fill: ACCENT, color: ACCENT }
                    : { color: 'rgba(255,255,255,0.18)' }}
                />
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Quote actions"
              className="w-7 h-7 rounded-lg flex items-center justify-center
                         text-gray-500 hover:text-white hover:bg-white/10
                         opacity-0 group-hover:opacity-100 focus:opacity-100
                         transition-all duration-200"
            >
              <FiMoreVertical size={15} />
            </motion.button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 z-30 min-w-[140px]
                             bg-[#0F1422] border border-white/12 rounded-xl
                             shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden"
                >
                  {[
                    { icon: FiEdit2,  label: 'Edit',   action: () => { canEdit && onEdit(quote); setMenuOpen(false); }, color: 'hover:text-[#F59E0B]' },
                    { icon: FiCopy,   label: 'Copy',   action: handleCopy,  color: 'hover:text-white' },
                    { icon: FiShare2, label: 'Share',  action: handleShare, color: 'hover:text-white' },
                    { icon: FiTrash2, label: 'Delete', action: handleDelete, color: 'hover:text-red-400' },
                  ].map(({ icon: Icon, label, action, color }) => (
                    <button
                      key={label}
                      onClick={action}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5
                                  text-[13px] font-medium text-gray-400 ${color}
                                  transition-colors hover:bg-white/5`}
                    >
                      <Icon size={13} />
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Quote text */}
        <div className="flex-1">
          <p
            className={`text-[15px] leading-relaxed text-gray-200 font-medium
                        transition-all duration-300
                        ${!isExpanded && isLong ? 'line-clamp-3' : ''}`}
          >
            "{quote.text}"
          </p>

          {isLong && (
            <button
              onClick={() => setIsExpanded(e => !e)}
              className="mt-1 text-[11px] font-semibold text-[#F59E0B]/70
                         hover:text-[#F59E0B] transition-colors"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Author + inline actions */}
        <div className="flex items-center justify-between pt-2
                        border-t border-white/6">
          <p className="text-[12px] font-semibold tracking-wide text-[#F59E0B] uppercase">
            — {quote.author}
          </p>

          {/* Inline quick-actions (always visible on mobile, hover on desktop) */}
          <div className="flex items-center gap-0.5
                          sm:opacity-0 sm:group-hover:opacity-100
                          transition-opacity duration-200">
            {[
              { icon: FiEdit2,  label: 'Edit',  action: () => canEdit && onEdit(quote),  cls: 'hover:text-[#F59E0B]' },
              { icon: FiCopy,   label: 'Copy',  action: handleCopy,           cls: 'hover:text-white' },
              { icon: FiTrash2, label: 'Delete', action: () => canDelete && onDelete(quote),        cls: 'hover:text-red-400' },
            ].map(({ icon: Icon, label, action, cls }) => (
              <motion.button
                key={label}
                whileTap={{ scale: 0.88 }}
                onClick={action}
                aria-label={label}
                className={`p-1.5 rounded-lg text-gray-500 ${cls} transition-colors`}
              >
                <Icon size={13} />
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default QuoteCard;