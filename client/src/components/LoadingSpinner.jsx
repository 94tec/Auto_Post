// LoadingSpinner.jsx
import { motion } from "framer-motion";

const ACCENT_GRADIENT = 'from-[#F59E0B] to-[#F97316]';

const LoadingSpinner = ({ 
  size = 'medium',
  color = 'primary',
  speed = 'normal',
  withText = false,
  text = 'Loading...',
  textPosition = 'bottom',
  className = ''
}) => {
  const sizes = {
    tiny: 'h-4 w-4',
    small: 'h-6 w-6',
    medium: 'h-8 w-8',
    large: 'h-12 w-12',
    xlarge: 'h-16 w-16'
  };

  const gradientColors = {
    primary: ACCENT_GRADIENT,
    secondary: 'from-gray-500 to-gray-700',
    success: 'from-green-500 to-teal-600',
    danger: 'from-red-500 to-pink-600',
    warning: 'from-yellow-500 to-amber-600',
    light: 'from-white to-gray-200',
    dark: 'from-gray-800 to-gray-900'
  };

  const speeds = {
    slow: 2,
    normal: 1,
    fast: 0.5
  };

  const textPositions = {
    top: 'flex-col-reverse',
    bottom: 'flex-col',
    left: 'flex-row-reverse',
    right: 'flex-row'
  };

  return (
    <div className={`flex items-center justify-center ${textPositions[textPosition]} gap-2 ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: speeds[speed],
          repeat: Infinity,
          ease: "linear"
        }}
        className={`rounded-full border-2 border-t-transparent bg-gradient-to-r ${
          gradientColors[color] || gradientColors.primary
        } ${sizes[size] || sizes.medium}`}
      />

      {withText && (
        <motion.span 
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.5 }}
          className={`text-${color} text-sm ${
            size === 'large' || size === 'xlarge' ? 'text-base' : ''
          } text-gray-300`}
        >
          {text}
        </motion.span>
      )}
    </div>
  );
};

export default LoadingSpinner;