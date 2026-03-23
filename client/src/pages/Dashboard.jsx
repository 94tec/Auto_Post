// Dashboard.jsx — quotes via API + React Query, optimistic updates, role-aware
import { useState, useMemo, useCallback, useRef } from 'react';
import { signOut }           from 'firebase/auth';
import { auth }              from '../config/firebase';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth }           from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi }         from '../utils/api';
import toast, { Toaster }    from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiLogOut, FiPlus, FiSearch, FiX, FiBookOpen,
  FiStar, FiGrid, FiTrendingUp, FiFilter,
  FiChevronDown, FiList, FiLayout, FiHome,
  FiAlertTriangle, FiMenu, FiShield, FiLock,
} from 'react-icons/fi';

import QuoteCard  from '../components/QuoteCard';
import QuoteForm  from '../components/QuoteForm';
import RoleGuard  from '../components/RoleGuard';
import useRole    from '../hooks/useRole';
import { ROLES }  from '../store/authSlice';

/* ── tokens ─────────────────────────────────────────────────── */
const ACCENT  = '#F59E0B';
const ACCENT2 = '#F97316';
const SLATE   = '#141924';

const CAT_COLOR = {
  motivation: '#F59E0B', mindset:    '#818CF8', discipline: '#34D399',
  success:    '#A78BFA', resilience: '#FB923C', persistence:'#38BDF8',
  growth:     '#2DD4BF', inspiration:'#7DD3FC', default:    '#6B7280',
};
const catColor = (c) => CAT_COLOR[c] ?? CAT_COLOR.default;

const stagger = (i) => ({
  initial:    { opacity: 0, y: 14 },
  animate:    { opacity: 1, y: 0  },
  transition: { delay: i * 0.06, duration: 0.28, ease: 'easeOut' },
});

/* ── role pill ───────────────────────────────────────────────── */
const RolePill = ({ role }) => {
  const cfgMap = {
    admin: { color: '#818CF8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.22)', icon: FiShield, label: 'Admin' },
    user:  { color: '#34D399', bg: 'rgba(52,211,153,0.10)',  border: 'rgba(52,211,153,0.20)',  icon: null,     label: 'User'  },
    guest: { color: '#6B7280', bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.18)', icon: FiLock,   label: 'Guest' },
  };
  const cfg  = cfgMap[role] ?? cfgMap.guest;
  const Icon = cfg.icon;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, duration: 0.2 }}
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {Icon && <Icon size={9} />}
      {cfg.label}
    </motion.span>
  );
};

/* ── skeleton ────────────────────────────────────────────────── */
const SkeletonCard = () => (
  <div className="bg-[#141924] border border-white/6 rounded-2xl p-4 space-y-3 animate-pulse">
    <div className="flex justify-between">
      <div className="w-16 h-3 rounded-full bg-white/8" />
      <div className="w-3 h-3 rounded-full bg-white/8" />
    </div>
    <div className="space-y-1.5">
      <div className="w-full h-3 rounded-full bg-white/6" />
      <div className="w-5/6 h-3 rounded-full bg-white/6" />
      <div className="w-3/4 h-3 rounded-full bg-white/6" />
    </div>
    <div className="w-20 h-2.5 rounded-full bg-white/5" />
  </div>
);

/* ── stat card ───────────────────────────────────────────────── */
const StatCard = ({ label, value, icon: Icon, accent, i }) => (
  <motion.div {...stagger(i)} className="bg-[#141924] border border-white/8 rounded-2xl p-4 flex flex-col gap-3">
    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${accent}18` }}>
      <Icon size={14} style={{ color: accent }} />
    </div>
    <div>
      <p className="text-[26px] font-black text-white leading-none tabular-nums">{value}</p>
      <p className="text-[11px] text-white/30 mt-0.5">{label}</p>
    </div>
  </motion.div>
);

/* ── sidebar widgets ─────────────────────────────────────────── */
const CategoryBar = ({ quotes }) => {
  const counts = useMemo(() => {
    const map = {};
    quotes.forEach(q => { if (q.category) map[q.category] = (map[q.category] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [quotes]);
  const max = counts[0]?.[1] ?? 1;
  return (
    <div className="bg-[#141924] border border-white/8 rounded-2xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/25 mb-4">By category</p>
      {counts.length === 0 ? <p className="text-[12px] text-white/20 text-center py-3">No data yet</p> : (
        <div className="space-y-2.5">
          {counts.map(([cat, count]) => {
            const color = catColor(cat);
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-[11px] text-white/40 w-[72px] shrink-0 capitalize truncate">{cat}</span>
                <div className="flex-1 h-1.5 bg-white/6 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }}
                    animate={{ width: `${Math.round((count / max) * 100)}%` }}
                    transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
                    className="h-full rounded-full" style={{ background: color }} />
                </div>
                <span className="text-[10px] text-white/25 tabular-nums w-4 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TopAuthors = ({ quotes }) => {
  const authors = useMemo(() => {
    const map = {};
    quotes.forEach(q => { if (q.author) map[q.author] = (map[q.author] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [quotes]);
  return (
    <div className="bg-[#141924] border border-white/8 rounded-2xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/25 mb-4">Top authors</p>
      {authors.length === 0 ? <p className="text-[12px] text-white/20 text-center py-3">No authors yet</p> : (
        <div className="space-y-2.5">
          {authors.map(([author, count], i) => (
            <div key={author} className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0"
                   style={{ background: `${ACCENT}18`, color: ACCENT }}>{i + 1}</div>
              <span className="flex-1 text-[12px] text-white/55 truncate">{author}</span>
              <span className="text-[10px] text-white/25 tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const RecentActivity = ({ quotes }) => {
  const recent = useMemo(() =>
    [...quotes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
    [quotes],
  );
  const timeAgo = (ts) => {
    if (!ts) return '—';
    const m = Math.floor((Date.now() - new Date(ts)) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };
  return (
    <div className="bg-[#141924] border border-white/8 rounded-2xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/25 mb-4">Recent</p>
      {recent.length === 0 ? <p className="text-[12px] text-white/20 text-center py-3">Nothing yet</p> : (
        <div className="space-y-3">
          {recent.map(q => (
            <div key={q.id} className="flex gap-2.5 items-start">
              <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: catColor(q.category) }} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-white/60 truncate">"{q.text}"</p>
                <p className="text-[10px] text-white/22 mt-0.5">{q.author} · {timeAgo(q.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SidebarContent = ({ quotes }) => (
  <div className="space-y-4">
    <CategoryBar quotes={quotes} />
    <TopAuthors quotes={quotes} />
    <RecentActivity quotes={quotes} />
  </div>
);

/* ── delete modal ────────────────────────────────────────────── */
const DeleteModal = ({ onConfirm, onCancel }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    onClick={onCancel}>
    <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.92, opacity: 0 }} transition={{ duration: 0.2 }}
      onClick={e => e.stopPropagation()}
      className="w-full max-w-sm bg-[#141924] border border-white/10 rounded-2xl p-6 shadow-[0_24px_48px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
          <FiAlertTriangle size={16} className="text-red-400" />
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-white">Delete quote?</h3>
          <p className="text-[12px] text-white/40">This cannot be undone.</p>
        </div>
      </div>
      <div className="flex gap-2.5 mt-2">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-[13px] font-medium bg-white/6 hover:bg-white/10 text-white/60 hover:text-white border border-white/8 transition-all">
          Cancel
        </button>
        <button onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/25 transition-all">
          Delete
        </button>
      </div>
    </motion.div>
  </motion.div>
);

/* ── filter bar ──────────────────────────────────────────────── */
const FilterBar = ({ searchQuery, setSearchQuery, selectedCategory, setSelectedCategory, categories, view, setView, total, filtered }) => (
  <div className="flex flex-col sm:flex-row gap-2">
    <div className="relative flex-1">
      <FiSearch size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
      <input type="text" placeholder="Search quotes or authors…" value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="w-full pl-8 pr-8 py-2.5 rounded-xl bg-[#141924] border border-white/8 text-[13px] text-white/75 placeholder-white/20 focus:outline-none focus:border-amber-500/35 focus:ring-1 focus:ring-amber-500/12 transition-all" />
      {searchQuery && (
        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/55 transition-colors">
          <FiX size={12} />
        </button>
      )}
    </div>
    <div className="relative">
      <FiFilter size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
      <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
        className="appearance-none pl-8 pr-7 py-2.5 rounded-xl bg-[#141924] border border-white/8 text-[13px] text-white/60 focus:outline-none focus:border-amber-500/35 transition-all cursor-pointer">
        {categories.map(c => (
          <option key={c} value={c} className="bg-[#0D1017]">
            {c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}
          </option>
        ))}
      </select>
      <FiChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
    </div>
    <div className="flex items-center bg-[#141924] border border-white/8 rounded-xl p-1 gap-0.5">
      {[{ v: 'grid', Icon: FiLayout }, { v: 'list', Icon: FiList }].map(({ v, Icon }) => (
        <button key={v} onClick={() => setView(v)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
          style={view === v ? { background: `${ACCENT}18`, color: ACCENT } : { color: 'rgba(255,255,255,0.22)' }}>
          <Icon size={12} />
        </button>
      ))}
    </div>
    {(searchQuery || selectedCategory !== 'all') && (
      <div className="flex items-center px-3 rounded-xl bg-[#141924] border border-white/8 text-[11px] text-white/25 whitespace-nowrap">
        {filtered} / {total}
      </div>
    )}
  </div>
);

/* ── empty state ─────────────────────────────────────────────── */
const EmptyState = ({ hasFilter, onAdd }) => (
  <div className="flex flex-col items-center gap-3 py-16 rounded-2xl border border-white/6 bg-[#141924]">
    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
      <FiBookOpen size={17} className="text-white/20" />
    </div>
    <p className="text-[13px] text-white/35">{hasFilter ? 'No quotes match your filters.' : 'No quotes yet.'}</p>
    {!hasFilter && (
      <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.USER]}>
        <button onClick={onAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-gray-950 transition-all"
          style={{ background: `linear-gradient(to right, ${ACCENT}, ${ACCENT2})` }}>
          <FiPlus size={12} />Add your first quote
        </button>
      </RoleGuard>
    )}
  </div>
);

/* ════════════════════════════════════════════════════════════
   MAIN DASHBOARD
════════════════════════════════════════════════════════════ */
const Dashboard = () => {
  const { user, setUser }            = useAuth();
  const { role, isAdmin, isAllowed } = useRole();
  const navigate                     = useNavigate();
  const queryClient                  = useQueryClient();

  const [editing,          setEditing]          = useState(null);
  const [searchQuery,      setSearchQuery]       = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showForm,         setShowForm]         = useState(false);
  const [view,             setView]             = useState('grid');
  const [activeTab,        setActiveTab]        = useState('all');
  const [deleteTarget,     setDeleteTarget]     = useState(null);
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const formRef = useRef(null);

  /* ── fetch my quotes from API ── */
  const { data, isLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn:  quotesApi.getMy,
    enabled:  !!user,           // only fetch when logged in
    onError:  (err) => toast.error(err.message || 'Failed to load quotes'),
  });
  const quotes = data?.quotes ?? [];

  /* ── create ── */
  const createMutation = useMutation({
    mutationFn: quotesApi.create,
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['myQuotes'] });
      const prev = queryClient.getQueryData(['myQuotes']);
      const tempId = `temp-${Date.now()}`;
      queryClient.setQueryData(['myQuotes'], (old) => ({
        ...old,
        quotes: [{ id: tempId, ...newData, createdAt: new Date().toISOString(), optimistic: true }, ...(old?.quotes ?? [])],
      }));
      return { prev, tempId };
    },
    onSuccess: (res, _, ctx) => {
      queryClient.setQueryData(['myQuotes'], (old) => ({
        ...old,
        quotes: (old?.quotes ?? []).map(q => q.id === ctx.tempId ? res.quote : q),
      }));
      // Also invalidate global quotes so Landing updates
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote added!');
      setShowForm(false);
    },
    onError: (err, _, ctx) => {
      queryClient.setQueryData(['myQuotes'], ctx.prev);
      toast.error(err.message || 'Failed to add quote');
    },
  });

  /* ── update ── */
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => quotesApi.update(id, data),
    onMutate: async ({ id, data: newData }) => {
      await queryClient.cancelQueries({ queryKey: ['myQuotes'] });
      const prev = queryClient.getQueryData(['myQuotes']);
      queryClient.setQueryData(['myQuotes'], (old) => ({
        ...old,
        quotes: (old?.quotes ?? []).map(q => q.id === id ? { ...q, ...newData } : q),
      }));
      return { prev };
    },
    onSuccess: (res) => {
      queryClient.setQueryData(['myQuotes'], (old) => ({
        ...old,
        quotes: (old?.quotes ?? []).map(q => q.id === res.quote.id ? res.quote : q),
      }));
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote updated!');
      setEditing(null);
      setShowForm(false);
    },
    onError: (err, _, ctx) => {
      queryClient.setQueryData(['myQuotes'], ctx.prev);
      toast.error(err.message || 'Failed to update');
    },
  });

  /* ── delete ── */
  const deleteMutation = useMutation({
    mutationFn: quotesApi.delete,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['myQuotes'] });
      const prev = queryClient.getQueryData(['myQuotes']);
      queryClient.setQueryData(['myQuotes'], (old) => ({
        ...old,
        quotes: (old?.quotes ?? []).filter(q => q.id !== id),
      }));
      return { prev };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote deleted');
      setDeleteTarget(null);
    },
    onError: (err, _, ctx) => {
      queryClient.setQueryData(['myQuotes'], ctx.prev);
      toast.error(err.message || 'Failed to delete');
      setDeleteTarget(null);
    },
  });

  /* ── favorite (local optimistic only — add API if needed) ── */
  const handleFavorite = useCallback(async (id, isFavorite) => {
    queryClient.setQueryData(['myQuotes'], (old) => ({
      ...old,
      quotes: (old?.quotes ?? []).map(q => q.id === id ? { ...q, isFavorite } : q),
    }));
    try {
      await quotesApi.update(id, { isFavorite });
    } catch {
      // rollback
      queryClient.setQueryData(['myQuotes'], (old) => ({
        ...old,
        quotes: (old?.quotes ?? []).map(q => q.id === id ? { ...q, isFavorite: !isFavorite } : q),
      }));
    }
  }, [queryClient]);

  const handleAddOrUpdate = useCallback((formData) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }, [editing, createMutation, updateMutation]);

  const handleEdit = useCallback((q) => {
    setEditing(q);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      queryClient.clear();
      navigate('/');
    } catch { toast.error('Logout failed'); }
  };

  /* ── derived ── */
  const favCount  = quotes.filter(q => q.isFavorite).length;
  const catCount  = new Set(quotes.map(q => q.category).filter(Boolean)).size;
  const weekCount = quotes.filter(q => {
    const ts = new Date(q.createdAt).getTime();
    return ts > Date.now() - 7 * 86400000;
  }).length;

  const latestDate = useMemo(() => {
    if (!quotes.length) return '—';
    const sorted = [...quotes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return new Date(sorted[0].createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, [quotes]);

  const categories = useMemo(() => {
    const all = quotes.map(q => q.category).filter(Boolean);
    return ['all', ...new Set(all)];
  }, [quotes]);

  const visibleQuotes = useMemo(() => quotes.filter(q => {
    if (activeTab === 'favorites' && !q.isFavorite) return false;
    const matchSearch   = !searchQuery ||
      q.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = selectedCategory === 'all' || q.category === selectedCategory;
    return matchSearch && matchCategory;
  }), [quotes, searchQuery, selectedCategory, activeTab]);

  const hasFilter  = searchQuery || selectedCategory !== 'all' || activeTab !== 'all';
  const isSaving   = createMutation.isPending || updateMutation.isPending;

  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white">
      <Toaster position="top-right" toastOptions={{
        style: { background: '#141924', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', fontSize: '13px' },
      }} />

      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            onConfirm={() => deleteMutation.mutate(deleteTarget)}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" />
            <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              className="fixed top-0 left-0 h-full w-72 z-40 lg:hidden bg-[#0D1220] border-r border-white/8 overflow-y-auto p-5">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[14px] font-bold text-white">Overview</span>
                <button onClick={() => setSidebarOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/6 text-white/40 hover:text-white transition-colors">
                  <FiX size={13} />
                </button>
              </div>
              <SidebarContent quotes={quotes} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[260px] bg-amber-500/4 rounded-full blur-[90px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* header */}
        <motion.div {...stagger(0)} className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-8 h-8 rounded-xl bg-white/6 border border-white/8 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors">
              <FiMenu size={14} />
            </button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500/55 mb-0.5">{greeting}</p>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[24px] sm:text-[28px] font-black text-white tracking-tight leading-tight">
                  {firstName}<span className="text-white/18">'s collection</span>
                </h1>
                <RolePill role={role} />
              </div>
              <p className="text-[11px] text-white/22 mt-0.5">
                {quotes.length} quote{quotes.length !== 1 ? 's' : ''} · last added {latestDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link to="/"
              className="hidden sm:flex w-9 h-9 rounded-xl bg-white/5 border border-white/8 items-center justify-center text-white/35 hover:text-white/65 hover:bg-white/8 transition-all"
              title="Back to home">
              <FiHome size={14} />
            </Link>

            <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.USER]}>
              <motion.button whileTap={{ scale: 0.94 }}
                onClick={() => { setEditing(null); setShowForm(s => !s); }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-gray-950 shadow-sm shadow-amber-500/15 transition-all"
                style={{ background: `linear-gradient(to right, ${ACCENT}, ${ACCENT2})` }}>
                {showForm && !editing ? <FiX size={13} /> : <FiPlus size={13} />}
                <span className="hidden sm:inline">
                  {showForm && !editing ? 'Cancel' : 'Add quote'}
                </span>
              </motion.button>
            </RoleGuard>

            <motion.button whileTap={{ scale: 0.94 }} onClick={handleLogout}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-white/35 hover:text-red-400/70 hover:bg-red-500/8 transition-all"
              title="Sign out">
              <FiLogOut size={13} />
            </motion.button>
          </div>
        </motion.div>

        {/* quote form */}
        <div ref={formRef}>
          <AnimatePresence>
            {showForm && isAllowed([ROLES.ADMIN, ROLES.USER]) && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                <QuoteForm
                  editingQuote={editing}
                  onSubmit={handleAddOrUpdate}
                  onCancel={() => { setEditing(null); setShowForm(false); }}
                  isSubmitting={isSaving}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard i={0} label="My quotes"    value={quotes.length} icon={FiBookOpen}   accent={ACCENT}   />
          <StatCard i={1} label="Favorites"    value={favCount}       icon={FiStar}       accent="#818CF8"  />
          <StatCard i={2} label="Categories"   value={catCount}       icon={FiGrid}       accent="#34D399"  />
          <StatCard i={3} label="This week"    value={weekCount}      icon={FiTrendingUp} accent="#FB923C"  />
        </div>

        {/* sidebar + main */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <div className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              <SidebarContent quotes={quotes} />
            </div>
          </div>

          <div className="space-y-4 min-w-0">
            {/* tabs */}
            <motion.div {...stagger(1)} className="flex items-center gap-1.5">
              {[
                { id: 'all',       label: 'All',        count: quotes.length },
                { id: 'favorites', label: 'Favourites', count: favCount      },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12px] font-semibold border transition-all"
                  style={activeTab === t.id
                    ? { background: `${ACCENT}16`, borderColor: `${ACCENT}30`, color: ACCENT }
                    : { background: 'transparent', borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.30)' }
                  }>
                  {t.label}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums"
                    style={{ background: activeTab === t.id ? `${ACCENT}22` : 'rgba(255,255,255,0.05)' }}>
                    {t.count}
                  </span>
                </button>
              ))}
            </motion.div>

            {/* filter bar */}
            <motion.div {...stagger(2)}>
              <FilterBar
                searchQuery={searchQuery}            setSearchQuery={setSearchQuery}
                selectedCategory={selectedCategory}  setSelectedCategory={setSelectedCategory}
                categories={categories}
                view={view}                          setView={setView}
                total={quotes.length}                filtered={visibleQuotes.length}
              />
            </motion.div>

            {/* quotes */}
            {isLoading ? (
              <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'flex flex-col gap-2'}>
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : visibleQuotes.length === 0 ? (
              <EmptyState hasFilter={hasFilter} onAdd={() => { setEditing(null); setShowForm(true); }} />
            ) : (
              <motion.div {...stagger(3)}>
                <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'flex flex-col gap-2'}>
                  <AnimatePresence initial={false}>
                    {visibleQuotes.map((q, i) => (
                      <QuoteCard
                        key={q.id}
                        quote={q}
                        index={i}
                        onEdit={handleEdit}
                        onDelete={isAdmin ? (id) => setDeleteTarget(id) : null}
                        onFavorite={handleFavorite}
                        canDelete={isAdmin}
                        canEdit={isAllowed([ROLES.ADMIN, ROLES.USER])}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;