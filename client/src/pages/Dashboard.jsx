import { useContext, useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { ref, onValue, push, set, update, remove, query, orderByChild } from "firebase/database";
import { db } from "../config/firebase";
import toast, { Toaster } from "react-hot-toast";
import { FiLogOut, FiPlus, FiSearch, FiX } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

import QuoteForm from "../components/QuoteForm";
import QuoteList from "../components/QuoteList";
import LoadingSpinner from "../components/LoadingSpinner";

const Dashboard = () => {
  const { user, setUser } = useContext(AuthContext);
  const [quotes, setQuotes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  // Authentication state listener
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((firebaseUser) => {
      if (!firebaseUser) {
        navigate("/login");
      } else {
        setUser(firebaseUser);
      }
    });
    return () => unsub();
  }, [navigate, setUser]);

  // Fetch quotes from Firebase
  useEffect(() => {
    const quotesRef = query(ref(db, "quotes"), orderByChild("createdAt"));
    const unsubscribe = onValue(quotesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsed = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
          createdAt: value.createdAt || 0
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
      toast.error("Please fill in all required fields");
      return;
    }

    const duplicate = quotes.some(
      (q) =>
        q.text.trim().toLowerCase() === text.trim().toLowerCase() &&
        (!editing || q.id !== editing.id)
    );
    if (duplicate) {
      toast.error("This quote already exists");
      return;
    }

    try {
      if (editing) {
        await update(ref(db, `quotes/${editing.id}`), { 
          text, 
          author, 
          category,
          updatedAt: Date.now() 
        });
        toast.success("Quote updated successfully");
      } else {
        const newRef = push(ref(db, "quotes"));
        await set(newRef, { 
          text, 
          author, 
          category,
          createdAt: Date.now(),
          userId: user.uid
        });
        toast.success("Quote added successfully");
      }
      setEditing(null);
      setShowForm(false);
    } catch (error) {
      toast.error("Failed to save quote");
      console.error("Error saving quote:", error);
    }
  };

  const handleEdit = (quote) => {
    setEditing(quote);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this quote?")) {
      try {
        await remove(ref(db, `quotes/${id}`));
        toast.success("Quote deleted");
      } catch (error) {
        toast.error("Failed to delete quote");
      }
    }
  };

  const handleFavorite = async (id, isFavorite) => {
    try {
      await update(ref(db, `quotes/${id}`), { isFavorite });
      toast.success(isFavorite ? "Quote favorited" : "Quote unfavorited");
    } catch (error) {
      toast.error("Failed to update favorite status");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      navigate("/login");
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = !searchQuery || 
      quote.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
      quote.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || quote.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ["all", "motivation", "success", "mindset", "discipline", "inspiration", "growth"];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6">
      <Toaster position="top-right" />
      
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              📋 Quotes Dashboard
            </h1>
            <p className="text-gray-400 text-sm">
              {user?.email || "Welcome to your quotes collection"}
            </p>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm md:text-base"
          >
            <FiLogOut />
            Logout
          </motion.button>
        </motion.header>

        {/* Search and Filter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search quotes..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <FiX />
              </button>
            )}
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === "all" ? "All Categories" : category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </motion.div>

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
            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            <FiPlus />
            Add New Quote
          </motion.button>
        )}

        {/* Quote Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <QuoteForm
                initialData={editing}
                onSubmit={handleAddOrUpdate}
                onCancel={() => {
                  setEditing(null);
                  setShowForm(false);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quote List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="large" />
          </div>
        ) : (
          <QuoteList
            quotes={filteredQuotes}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onFavorite={handleFavorite}
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;