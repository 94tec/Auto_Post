// QuoteForm.jsx
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSave, FiEdit2, FiX, FiPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';

const ACCENT_GRADIENT = 'from-[#F59E0B] to-[#F97316]';

const QuoteForm = ({ onSubmit, editingQuote, onCancel }) => {
  const [formData, setFormData] = useState({
    text: '',
    author: '',
    category: 'motivation',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textInputRef = useRef(null);

  const categories = [
    { value: 'motivation', label: 'Motivation' },
    { value: 'success', label: 'Success' },
    { value: 'mindset', label: 'Mindset' },
    { value: 'discipline', label: 'Discipline' },
    { value: 'inspiration', label: 'Inspiration' },
    { value: 'growth', label: 'Growth' },
  ];

  useEffect(() => {
    if (editingQuote) {
      setFormData({
        text: editingQuote.text || '',
        author: editingQuote.author || '',
        category: editingQuote.category || 'motivation',
      });
    } else {
      setFormData({
        text: '',
        author: '',
        category: 'motivation',
      });
    }

    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    }, 100);
  }, [editingQuote]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!formData.text.trim()) {
      toast.error('Quote text is required');
      setIsSubmitting(false);
      return;
    }

    if (!formData.author.trim()) {
      toast.error('Author name is required');
      setIsSubmitting(false);
      return;
    }

    try {
      await onSubmit({
        text: formData.text.trim(),
        author: formData.author.trim(),
        category: formData.category,
      });

      if (!editingQuote) {
        setFormData({
          text: '',
          author: '',
          category: 'motivation',
        });
      }
    } catch (error) {
      toast.error(error.message || 'Failed to save quote');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-[#1C2135] rounded-xl shadow-lg overflow-hidden border border-white/10"
      >
        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="text" className="block text-sm font-medium text-gray-300 mb-1">
              Quote
            </label>
            <textarea
              ref={textInputRef}
              id="text"
              name="text"
              placeholder="Enter an inspiring quote..."
              className="w-full p-3 rounded-lg bg-black/20 text-white border border-white/10 focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 transition placeholder-gray-500"
              rows={3}
              value={formData.text}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="author" className="block text-sm font-medium text-gray-300 mb-1">
                Author
              </label>
              <input
                id="author"
                type="text"
                name="author"
                placeholder="Who said it?"
                className="w-full p-3 rounded-lg bg-black/20 text-white border border-white/10 focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 transition placeholder-gray-500"
                value={formData.author}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-1">
                Category
              </label>
              <select
                id="category"
                name="category"
                className="w-full p-3 rounded-lg bg-black/20 text-white border border-white/10 focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 transition"
                value={formData.category}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-black/20 px-5 py-3 flex justify-between items-center border-t border-white/10">
          <AnimatePresence>
            {editingQuote && (
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                type="button"
                onClick={onCancel}
                className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
                disabled={isSubmitting}
              >
                <FiX />
                Cancel
              </motion.button>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ml-auto bg-gradient-to-r ${ACCENT_GRADIENT} text-gray-950 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="inline-block h-4 w-4 border-2 border-gray-950 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                {editingQuote ? <FiEdit2 /> : <FiPlus />}
                {editingQuote ? 'Update Quote' : 'Add Quote'}
              </>
            )}
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
};

export default QuoteForm;