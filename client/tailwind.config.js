/** @type {import('tailwindcss').Config} */
// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      transform: ['group-hover'],
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.backface-hidden': { backfaceVisibility: 'hidden' },
        '.transform-style-3d': { transformStyle: 'preserve-3d' },
        '.rotateY-180': { transform: 'rotateY(180deg)' },
        '.perspective': { perspective: '1000px' },
      });
    },
  ],
};

