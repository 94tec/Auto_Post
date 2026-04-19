// NewQuoteModal.jsx — smooth modal that opens QuoteForm from Landing page
import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import QuoteForm from '../components/QuoteForm';

/* ── backdrop variants ──────────────────────────────────────── */
const backdropV = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.22 } },
  exit:    { opacity: 0, transition: { duration: 0.2, delay: 0.05 } },
};

/* ── panel variants ─────────────────────────────────────────── */
const panelV = {
  hidden:  { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0, y: 16, scale: 0.97,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

/* ────────────────────────────────────────────────────────────── */

const QuoteModal = ({ isOpen, onClose, onSubmit }) => {

  /* close on Escape */
  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKey]);

  const handleSubmit = async (data) => {
    await onSubmit(data);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        /* ── backdrop ── */
        <motion.div
          variants={backdropV}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(5, 8, 18, 0.82)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 1000 }}
        >
          {/* ── panel ── */}
          <motion.div
            variants={panelV}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[520px] relative"
            zIndex={1001}
          >
            {/* close button — floats above the card */}
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, transition: { delay: 0.18, duration: 0.18 } }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileTap={{ scale: 0.88 }}
              onClick={onClose}
              className="absolute -top-3 -right-3 z-10
                         w-7 h-7 rounded-full
                         bg-[#1C2535] border border-white/12
                         flex items-center justify-center
                         text-white/40 hover:text-white/80
                         shadow-lg transition-colors"
            >
              <FiX size={13} />
            </motion.button>

            {/* QuoteForm — mb-6 removed since modal handles spacing */}
            <QuoteForm
              onSubmit={handleSubmit}
              editingQuote={null}
              onCancel={onClose}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QuoteModal;