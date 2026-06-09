import { motion } from 'framer-motion';

const ShareBackdrop = ({ onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onClose}
    className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[120]"
  />
);

export default ShareBackdrop;