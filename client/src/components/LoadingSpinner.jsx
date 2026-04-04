// components/LoadingSpinner.jsx
import { motion } from 'framer-motion';

/* ── constants ───────────────────────────────────────────────── */
const SIZES = {
  tiny:   'h-4 w-4',
  small:  'h-6 w-6',
  medium: 'h-8 w-8',
  large:  'h-12 w-12',
  xlarge: 'h-16 w-16',
};

const GRADIENTS = {
  primary:   'from-[#F59E0B] to-[#F97316]',
  secondary: 'from-gray-500 to-gray-700',
  success:   'from-green-500 to-teal-600',
  danger:    'from-red-500 to-pink-600',
  warning:   'from-yellow-500 to-amber-600',
  light:     'from-white to-gray-200',
  dark:      'from-gray-800 to-gray-900',
};

const SPEEDS = {
  slow:   2,
  normal: 1,
  fast:   0.5,
};

const TEXT_LAYOUT = {
  top:    'flex-col-reverse',
  bottom: 'flex-col',
  left:   'flex-row-reverse',
  right:  'flex-row',
};

/* ── component ───────────────────────────────────────────────── */
const LoadingSpinner = ({
  size         = 'medium',
  color        = 'primary',
  speed        = 'normal',
  withText     = false,
  text         = 'Loading...',
  textPosition = 'bottom',
  className    = '',
}) => {
  const sizeClass    = SIZES[size]      ?? SIZES.medium;
  const gradientClass = GRADIENTS[color] ?? GRADIENTS.primary;
  const duration     = SPEEDS[speed]    ?? SPEEDS.normal;
  const layoutClass  = TEXT_LAYOUT[textPosition] ?? TEXT_LAYOUT.bottom;
  const isLarge      = size === 'large' || size === 'xlarge';

  return (
    <div className={`flex items-center justify-center ${layoutClass} gap-2 ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
        className={`rounded-full border-2 border-t-transparent bg-gradient-to-r ${gradientClass} ${sizeClass}`}
      />

      {withText && (
        <motion.span
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1.5 }}
          className={`text-gray-300 ${isLarge ? 'text-base' : 'text-sm'}`}
        >
          {text}
        </motion.span>
      )}
    </div>
  );
};

export default LoadingSpinner;