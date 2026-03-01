import { useContext, useState, useEffect, useMemo } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ref, onValue, push, set, update, remove, query, orderByChild } from 'firebase/database';
import { db } from '../config/firebase';
import toast, { Toaster } from 'react-hot-toast';
import {
  FiLogOut, FiPlus, FiSearch, FiX, FiBookOpen,
  FiUser, FiStar, FiEdit2, FiTrash2, FiGrid,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

import QuoteForm from '../components/QuoteForm';
import LoadingSpinner from '../components/LoadingSpinner';

/* -------------------- CONSTANTS (same as Landing) -------------------- */
const ACCENT_GRADIENT = 'from-[#F59E0B] to-[#F97316]';
const NAVY = '#0A0E1A';
const SLATE = '#1C2135';

/* -------------------- STATS COMPONENT -------------------- */
const Stats = ({ quotes }) => {
  const total = quotes.length;
  const categories = new Set(quotes.map(q => q.category).filter(Boolean)).size;
  const favorites = quotes.filter(q => q.isFavorite).length;

  const statItems = [
    { label: 'Total Quotes', value: total, icon: FiBookOpen },
    { label: 'Categories', value: categories, icon: FiGrid },
    { label: 'Favorites', value: favorites, icon: FiStar },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {statItems.map(({ label, value, icon: Icon }) => (
        <div
          key={label}
          className="bg-[#1C2135] rounded-xl p-4 border border-white/5 flex flex-col items-center justify-center text-center"
        >
          <Icon className="text-[#F59E0B] mb-2" size={20} />
          <span className="text-2xl font-bold text-white">{value}</span>
          <span className="text-xs text-gray-400 mt-1">{label}</span>
        </div>
      ))}
    </div>
  );
};

/* -------------------- SEARCH FILTER COMPONENT -------------------- */
const SearchFilter = ({ searchQuery, setSearchQuery, selectedCategory, setSelectedCategory, categories }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="Search quotes or authors..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-3 rounded-xl bg-[#1C2135] border border-white/10 text-white placeholder-gray-500 focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <FiX size={16} />
          </button>
        )}
      </div>

      {/* Category filter */}
      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-[#1C2135] border border-white/10 text-white focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 transition"
      >
        {categories.map(category => (
          <option key={category} value={category}>
            {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
};

/* -------------------- QUOTE CARD (redesigned) -------------------- */
const QuoteCard = ({ quote, onEdit, onDelete, onFavorite }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      className="bg-[#1C2135] rounded-2xl border border-white/10 p-5 flex flex-col h-full transition-all hover:border-[#F59E0B]/30 hover:shadow-lg hover:shadow-[#F59E0B]/5"
    >
      {/* Category badge */}
      {quote.category && (
        <div className="flex justify-between items-start mb-3">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#F97316] text-white tracking-wide uppercase`}>
            {quote.category}
          </span>
          <button
            onClick={() => onFavorite(quote.id, !quote.isFavorite)}
            className="text-gray-400 hover:text-[#F59E0B] transition"
          >
            <FiStar size={16} className={quote.isFavorite ? 'fill-[#F59E0B] text-[#F59E0B]' : ''} />
          </button>
        </div>
      )}

      {/* Quote text */}
      <p className="text-gray-200 text-sm leading-relaxed flex-1 mb-4">
        “{quote.text}”
      </p>

      {/* Author */}
      <p className="text-[#F59E0B] text-xs font-semibold mb-4">
        — {quote.author}
      </p>

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-auto border-t border-white/10 pt-3">
        <button
          onClick={() => onEdit(quote)}
          className="p-2 rounded-lg text-gray-400 hover:text-[#F59E0B] hover:bg-white/5 transition"
          aria-label="Edit"
        >
          <FiEdit2 size={14} />
        </button>
        <button
          onClick={() => onDelete(quote.id)}
          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-white/5 transition"
          aria-label="Delete"
        >
          <FiTrash2 size={14} />
        </button>
      </div>
    </motion.div>
  );
};

/* -------------------- QUOTE LIST GRID -------------------- */
const QuoteList = ({ quotes, onEdit, onDelete, onFavorite }) => {
  if (quotes.length === 0) {
    return (
      <div className="text-center py-16 bg-[#1C2135] rounded-2xl border border-white/5">
        <FiBookOpen className="mx-auto text-gray-600 mb-3" size={40} />
        <p className="text-gray-400">No quotes found. Add your first one!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence>
        {quotes.map(quote => (
          <QuoteCard
            key={quote.id}
            quote={quote}
            onEdit={onEdit}
            onDelete={onDelete}
            onFavorite={onFavorite}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

/* -------------------- MAIN DASHBOARD -------------------- */
const Dashboard = () => {
  const { user, setUser } = useContext(AuthContext);
  const [quotes, setQuotes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  // Authentication state listener
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((firebaseUser) => {
      if (!firebaseUser) {
        navigate('/login');
      } else {
        setUser(firebaseUser);
      }
    });
    return () => unsub();
  }, [navigate, setUser]);

  // Fetch quotes from Firebase
  useEffect(() => {
    const quotesRef = query(ref(db, 'quotes'), orderByChild('createdAt'));
    const unsubscribe = onValue(quotesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsed = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
          createdAt: value.createdAt || 0,
        }));
        setQuotes(parsed);
      } else {
        setQuotes([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddOrUpdate = async ({ text, author, category }) => {
    if (!text.trim() || !author.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    const duplicate = quotes.some(
      (q) =>
        q.text.trim().toLowerCase() === text.trim().toLowerCase() &&
        (!editing || q.id !== editing.id)
    );
    if (duplicate) {
      toast.error('This quote already exists');
      return;
    }

    try {
      if (editing) {
        await update(ref(db, `quotes/${editing.id}`), {
          text,
          author,
          category,
          updatedAt: Date.now(),
        });
        toast.success('Quote updated successfully');
      } else {
        const newRef = push(ref(db, 'quotes'));
        await set(newRef, {
          text,
          author,
          category,
          createdAt: Date.now(),
          userId: user.uid,
        });
        toast.success('Quote added successfully');
      }
      setEditing(null);
      setShowForm(false);
    } catch (error) {
      toast.error('Failed to save quote');
      console.error('Error saving quote:', error);
    }
  };

  const handleEdit = (quote) => {
    setEditing(quote);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this quote?')) {
      try {
        await remove(ref(db, `quotes/${id}`));
        toast.success('Quote deleted');
      } catch (error) {
        toast.error('Failed to delete quote');
      }
    }
  };

  const handleFavorite = async (id, isFavorite) => {
    try {
      await update(ref(db, `quotes/${id}`), { isFavorite });
      toast.success(isFavorite ? 'Quote favorited' : 'Quote unfavorited');
    } catch (error) {
      toast.error('Failed to update favorite status');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      navigate('/login');
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to logout');
    }
  };

  // Filtered quotes
  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      const matchesSearch = !searchQuery ||
        quote.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        quote.author.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || quote.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [quotes, searchQuery, selectedCategory]);

  // Available categories (including 'all')
  const categories = useMemo(() => {
    const all = quotes.map(q => q.category).filter(Boolean);
    return ['all', ...new Set(all)];
  }, [quotes]);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1C2135', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              <span className={`bg-gradient-to-r ${ACCENT_GRADIENT} bg-clip-text text-transparent`}>
                Quotes Dashboard
              </span>
            </h1>
            <div className="flex items-center gap-2 mt-1 text-gray-400 text-sm">
              <FiUser size={14} />
              <span>{user?.email || 'Welcome'}</span>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-semibold shadow-lg hover:from-red-400 hover:to-red-500 transition-all"
          >
            <FiLogOut size={16} />
            Logout
          </motion.button>
        </motion.div>

        {/* Stats */}
        <Stats quotes={quotes} />

        {/* Search & Filter */}
        <SearchFilter
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          categories={categories}
        />

        {/* Add Quote Button */}
        {!showForm && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className={`w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r ${ACCENT_GRADIENT} text-gray-950 font-bold shadow-lg hover:shadow-xl transition-all`}
          >
            <FiPlus size={18} />
            Add New Quote
          </motion.button>
        )}

        {/* Quote Form (styled to match) */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <QuoteForm
                initialData={editing}
                onSubmit={handleAddOrUpdate}
                onCancel={() => {
                  setEditing(null);
                  setShowForm(false);
                }}
                // We pass a dark mode flag so the form uses slate backgrounds
                theme="dark"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quote List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="large" />
          </div>
        ) : (
          <QuoteList
            quotes={filteredQuotes}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onFavorite={handleFavorite}
          />
        )}
      </div>

      {/* subtle background glow */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[#F59E0B]/5 rounded-full blur-[120px]" />
      </div>
    </div>
  );
};

export default Dashboard;