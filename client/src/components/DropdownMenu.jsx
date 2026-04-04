// components/DropdownMenu.jsx
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function DropdownMenu({ isOpen, onClose, anchorRef, children }) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, anchorRef]);

  if (!isOpen || !anchorRef.current) return null;

  const rect = anchorRef.current.getBoundingClientRect();
  // Position dropdown near the button, but ensure it doesn't overflow viewport
  const top = rect.bottom + 4;
  const left = rect.right - 160; // align right edge

  const style = {
    position: 'fixed',
    top,
    left,
    zIndex: 1000,
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.12 }}
          style={style}
          className="w-44 bg-[#1A2235] border border-white/10 rounded-xl shadow-xl py-1"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}