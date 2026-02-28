import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { get, ref } from 'firebase/database';
import { db } from '../config/firebase';
import QuoteFeature from "../components/QuoteFeature";
import useTheme from '../hooks/UseTheme';
import { FiSun, FiMoon, FiRefreshCw } from 'react-icons/fi';
import LoadingSpinner from '../components/LoadingSpinner';

const Landing = () => {
  const { theme, toggleTheme } = useTheme();
  const [quote, setQuote] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);

  const fetchRandomQuote = async () => {
    try {
      setIsRefreshing(true);
      const snapshot = await get(ref(db, 'quotes'));
      const data = snapshot.val();
      const keys = Object.keys(data || {});
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      setQuote(data[randomKey]);
    } catch (err) {
      console.error('Error fetching quote:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRandomQuote();
  }, []);

  const handleRefresh = () => {
    fetchRandomQuote();
  };

  const toggleFeatures = () => {
    setShowFeatures(!showFeatures);
  };

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center px-4 py-10 transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100' 
          : 'bg-gradient-to-br from-blue-50 to-indigo-50 text-gray-900'
      }`}
    >
      <motion.div 
        className="max-w-4xl w-full mx-auto text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Header Section */}
        <motion.div
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">
            Daily Inspiration
          </h1>
          <p className="text-lg sm:text-xl mb-8 opacity-90">
            Discover wisdom that sparks creativity and motivation
          </p>
        </motion.div>

        {/* Quote Section */}
        <div className="min-h-[300px] flex items-center justify-center mb-10">
          {isLoading ? (
            <LoadingSpinner size="large" />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={quote?.text || 'empty'}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="w-full"
              >
                {quote && <QuoteFeature text={quote.text} author={quote.author} />}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`flex items-center justify-center px-6 py-3 rounded-lg ${
              theme === 'dark' 
                ? 'bg-indigo-700 hover:bg-indigo-600' 
                : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white shadow-md transition-all`}
          >
            {isRefreshing ? (
              <FiRefreshCw className="animate-spin mr-2" />
            ) : (
              <FiRefreshCw className="mr-2" />
            )}
            New Quote
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleTheme}
            className={`flex items-center justify-center px-6 py-3 rounded-lg ${
              theme === 'dark' 
                ? 'bg-gray-700 hover:bg-gray-600' 
                : 'bg-gray-200 hover:bg-gray-300'
            } shadow-md transition-all`}
          >
            {theme === 'dark' ? (
              <>
                <FiSun className="mr-2" />
                Light Mode
              </>
            ) : (
              <>
                <FiMoon className="mr-2" />
                Dark Mode
              </>
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleFeatures}
            className={`flex items-center justify-center px-6 py-3 rounded-lg ${
              theme === 'dark' 
                ? 'bg-purple-700 hover:bg-purple-600' 
                : 'bg-purple-600 hover:bg-purple-700'
            } text-white shadow-md transition-all`}
          >
            {showFeatures ? 'Hide Features' : 'Explore Features'}
          </motion.button>
        </div>

        {/* Features Section */}
        {showFeatures && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-12 overflow-hidden"
          >
            <div className={`p-6 rounded-xl ${
              theme === 'dark' 
                ? 'bg-gray-800 bg-opacity-60' 
                : 'bg-white bg-opacity-70'
            } backdrop-blur-sm`}
            >
              <h2 className="text-2xl font-bold mb-4">Why You'll Love This</h2>
              <div className="grid md:grid-cols-3 gap-6">
                <FeatureCard 
                  icon="💡"
                  title="Daily Inspiration"
                  description="Fresh quotes to start your day with motivation"
                  theme={theme}
                />
                <FeatureCard 
                  icon="🎨"
                  title="Beautiful Design"
                  description="Clean, modern interface with smooth animations"
                  theme={theme}
                />
                <FeatureCard 
                  icon="🌓"
                  title="Dark/Light Mode"
                  description="Choose what suits your eyes and mood"
                  theme={theme}
                />
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

const FeatureCard = ({ icon, title, description, theme }) => {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className={`p-5 rounded-lg ${
        theme === 'dark' 
          ? 'bg-gray-700 hover:bg-gray-600' 
          : 'bg-white hover:bg-gray-50'
      } shadow-md transition-all`}
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className={`${
        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
      }`}>{description}</p>
    </motion.div>
  );
};

export default Landing;