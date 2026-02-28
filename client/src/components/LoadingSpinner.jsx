import { motion } from "framer-motion";
import { FiLoader } from "react-icons/fi";

const LoadingSpinner = ({ 
  size = 'medium',
  color = 'primary',
  speed = 'normal',
  withText = false,
  text = 'Loading...',
  textPosition = 'bottom',
  className = ''
}) => {
  // Size definitions
  const sizes = {
    tiny: 'h-4 w-4',
    small: 'h-6 w-6',
    medium: 'h-8 w-8',
    large: 'h-12 w-12',
    xlarge: 'h-16 w-16'
  };

  // Color definitions
  const colors = {
    primary: 'border-indigo-500',
    secondary: 'border-gray-500',
    success: 'border-green-500',
    danger: 'border-red-500',
    warning: 'border-yellow-500',
    light: 'border-white',
    dark: 'border-gray-800'
  };

  // Animation speed
  const speeds = {
    slow: 'animate-[spin_2s_linear_infinite]',
    normal: 'animate-[spin_1s_linear_infinite]',
    fast: 'animate-[spin_0.5s_linear_infinite]'
  };

  // Text position classes
  const textPositions = {
    top: 'flex-col-reverse',
    bottom: 'flex-col',
    left: 'flex-row-reverse',
    right: 'flex-row'
  };

  // Optional: Gradient colors for more visual appeal
  const gradientColors = {
    primary: 'from-indigo-500 to-purple-600',
    secondary: 'from-gray-500 to-gray-700',
    success: 'from-green-500 to-teal-600',
    danger: 'from-red-500 to-pink-600',
    warning: 'from-yellow-500 to-amber-600',
    light: 'from-white to-gray-200',
    dark: 'from-gray-800 to-gray-900'
  };

  return (
    <div className={`flex items-center justify-center ${textPositions[textPosition]} gap-2 ${className}`}>
      {/* Option 1: Simple spinner with border */}
      {/* <div
        className={`rounded-full border-2 border-t-transparent ${
          colors[color] || colors.primary
        } ${
          sizes[size] || sizes.medium
        } ${
          speeds[speed] || speeds.normal
        }`}
      /> */}

      {/* Option 2: Gradient spinner (more visually appealing) */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: speed === 'slow' ? 2 : speed === 'fast' ? 0.5 : 1,
          repeat: Infinity,
          ease: "linear"
        }}
        className={`rounded-full border-2 border-t-transparent bg-gradient-to-r ${
          gradientColors[color] || gradientColors.primary
        } ${
          sizes[size] || sizes.medium
        }`}
      />

      {/* Option 3: Icon-based spinner (uncomment to use) */}
      {/* <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: speed === 'slow' ? 2 : speed === 'fast' ? 0.5 : 1,
          repeat: Infinity,
          ease: "linear"
        }}
        className={`text-${color} ${
          sizes[size] || sizes.medium
        }`}
      >
        <FiLoader className="w-full h-full" />
      </motion.div> */}

      {withText && (
        <motion.span 
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.5 }}
          className={`text-${color} text-sm ${
            size === 'large' || size === 'xlarge' ? 'text-base' : ''
          }`}
        >
          {text}
        </motion.span>
      )}
    </div>
  );
};

export default LoadingSpinner;