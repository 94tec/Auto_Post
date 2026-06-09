// components/ShareActionButton.jsx
import { motion } from 'framer-motion';

const ShareActionButton = ({
  icon: Icon,
  label,
  onClick,
  accent,
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 transition-all hover:bg-white/[0.07]"
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: `radial-gradient(circle at top left, ${accent}30, transparent 60%)`,
        }}
      />

      <div className="relative flex items-center gap-3 text-white">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: `${accent}20`,
            color: accent,
          }}
        >
          <Icon size={18} />
        </div>

        <span className="font-medium text-sm">
          {label}
        </span>
      </div>
    </motion.button>
  );
};

export default ShareActionButton;