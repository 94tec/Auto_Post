// QuoteList.jsx — responsive grid layout, constrained width, polished empty state
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { FiInbox, FiSearch } from 'react-icons/fi';
import QuoteCard from './QuoteCard';

const QuoteList = ({
  quotes = [],
  onEdit,
  onDelete,
  onFavorite,
  selectedCategory = null,
  searchQuery = '',
}) => {
  const [expandedQuoteId, setExpandedQuoteId] = useState(null);

  const filtered = quotes.filter((q) => {
    const matchCat    = !selectedCategory || q.category === selectedCategory;
    const matchSearch = !searchQuery ||
      q.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const toggleExpand = (id) =>
    setExpandedQuoteId(prev => (prev === id ? null : id));

  /* ── empty state ── */
  if (!filtered.length) {
    const isFiltered = searchQuery || selectedCategory;
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-[520px] mx-auto"
      >
        <div className="flex flex-col items-center gap-3 py-14 px-6 text-center
                        rounded-2xl border border-white/6 bg-[#141924]">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            {isFiltered
              ? <FiSearch size={18} className="text-white/30" />
              : <FiInbox  size={18} className="text-white/30" />}
          </div>
          <div>
            <p className="text-[14px] font-medium text-white/60">
              {searchQuery ? 'No results found' : selectedCategory ? 'No quotes in this category' : 'No quotes yet'}
            </p>
            <p className="text-[12px] text-white/25 mt-1">
              {searchQuery
                ? `Nothing matched "${searchQuery}"`
                : selectedCategory
                  ? 'Try another category or add one'
                  : 'Add your first quote to get started'}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── list ── */
  return (
    <div className="w-full max-w-[520px] mx-auto">

      {/* result count */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/25">
          {filtered.length === quotes.length
            ? `${quotes.length} quote${quotes.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${quotes.length}`}
        </span>
        {(searchQuery || selectedCategory) && (
          <span className="text-[11px] text-amber-500/60 font-medium">
            {searchQuery && selectedCategory
              ? 'filtered by search + category'
              : searchQuery
                ? `matching "${searchQuery}"`
                : `in ${selectedCategory}`}
        </span>
        )}
      </div>

      {/* cards */}
      <div className="space-y-2.5">
        <AnimatePresence initial={false}>
          {filtered.map((quote, i) => (
            <motion.div
              key={quote.id}
              layout
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
              transition={{
                type: 'spring',
                stiffness: 420,
                damping: 32,
                delay: i < 6 ? i * 0.04 : 0,
              }}
            >
              <QuoteCard
                quote={quote}
                onEdit={onEdit}
                onDelete={onDelete}
                onFavorite={onFavorite}
                isExpanded={expandedQuoteId === quote.id}
                onToggleExpand={() => toggleExpand(quote.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default QuoteList;