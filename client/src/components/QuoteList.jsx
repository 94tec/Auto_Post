// QuoteList.jsx
import { motion, AnimatePresence } from 'framer-motion';
import QuoteCard from './QuoteCard';
import { FiInbox } from 'react-icons/fi';
import { useState } from 'react';

const QuoteList = ({
  quotes,
  onEdit,
  onDelete,
  onFavorite,
  selectedCategory = null,
  searchQuery = '',
}) => {
  const [expandedQuoteId, setExpandedQuoteId] = useState(null);

  const filteredQuotes = quotes.filter((quote) => {
    const matchesCategory = !selectedCategory || quote.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      quote.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleExpandQuote = (quoteId) => {
    setExpandedQuoteId(expandedQuoteId === quoteId ? null : quoteId);
  };

  if (!filteredQuotes.length) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-12 text-center"
      >
        <FiInbox className="text-gray-400 text-4xl mb-4" />
        <h3 className="text-lg font-medium text-gray-300">
          {searchQuery ? 'No matching quotes found' : 'No quotes yet'}
        </h3>
        <p className="text-gray-500 mt-1">
          {searchQuery ? 'Try a different search term' : 'Add your first quote to get started'}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {filteredQuotes.map((quote) => (
          <motion.div
            key={quote.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30, duration: 0.3 }}
          >
            <QuoteCard
              quote={quote}
              onEdit={onEdit}
              onDelete={onDelete}
              onFavorite={onFavorite}
              isExpanded={expandedQuoteId === quote.id}
              onToggleExpand={() => toggleExpandQuote(quote.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default QuoteList;