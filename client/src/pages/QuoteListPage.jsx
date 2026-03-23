// pages/QuoteListPage.jsx
// Rich graphical public quotes page: charts, category breakdown,
// filterable grid, animated stats. Uses Recharts for data viz.

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { quotesApi } from '../utils/api';
import Navbar from '../components/Navbar';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  FiSearch, FiFilter, FiX, FiCopy, FiShare2,
  FiBarChart2, FiGrid, FiList, FiBookOpen,
  FiTrendingUp, FiUsers, FiStar,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const ACCENT  = '#F59E0B';
const ACCENT2 = '#F97316';
const NAVY    = '#0A0E1A';
const SLATE   = '#141924';

const CAT_COLORS = {
  motivation:  '#F59E0B', mindset:    '#818CF8', discipline: '#34D399',
  success:     '#A78BFA', resilience: '#FB923C', persistence:'#38BDF8',
  growth:      '#2DD4BF', inspiration:'#7DD3FC', default:    '#6B7280',
};
const cc = (c) => CAT_COLORS[c] ?? CAT_COLORS.default;

/* ── Custom tooltip for recharts ─────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 px-3 py-2.5"
         style={{ background: '#1C2535', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
      <p className="text-[11px] text-white/50 mb-1">{label}</p>
      <p className="text-[14px] font-black" style={{ color: ACCENT }}>{payload[0].value}</p>
    </div>
  );
};

/* ── Stat pill ───────────────────────────────────────────────── */
const Stat = ({ icon: Icon, label, value, color }) => (
  <div className="flex flex-col gap-2 p-4 rounded-2xl border border-white/8" style={{ background: SLATE }}>
    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
      <Icon size={14} style={{ color }} />
    </div>
    <p className="text-[24px] font-black text-white leading-none tabular-nums">{value}</p>
    <p className="text-[11px] text-white/35">{label}</p>
  </div>
);

/* ── Quote card ──────────────────────────────────────────────── */
const QuoteItem = ({ quote, view }) => {
  const color = cc(quote.category);
  const copy  = () => { navigator.clipboard.writeText(`"${quote.text}" — ${quote.author}`); toast.success('Copied!'); };

  if (view === 'list') return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex gap-4 items-start p-4 rounded-xl border border-white/6 hover:border-white/12 transition-all"
      style={{ background: '#0D1220' }}>
      <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-white/75 leading-relaxed mb-1.5">"{quote.text}"</p>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color }}>— {quote.author}</p>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full capitalize"
              style={{ background: `${color}18`, color }}>{quote.category}</span>
        <button onClick={copy} className="w-6 h-6 rounded-lg flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/6 transition-all">
          <FiCopy size={10} />
        </button>
      </div>
    </motion.div>
  );

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col rounded-2xl border border-white/8 overflow-hidden hover:border-white/15 transition-all"
      style={{ background: SLATE }}>
      <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${color}80, ${color}11)` }} />
      <div className="p-4 flex flex-col flex-1">
        <span className="self-start text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full mb-3"
              style={{ background: `${color}18`, color }}>{quote.category}</span>
        <div className="text-[26px] leading-none font-serif mb-1 select-none" style={{ color: `${color}30` }}>&ldquo;</div>
        <p className="text-[13px] text-white/75 leading-relaxed flex-1 mb-3">{quote.text}</p>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color }}>— {quote.author}</p>
          <button onClick={copy} className="w-6 h-6 rounded-lg flex items-center justify-center text-white/20 hover:text-white/50 transition-all">
            <FiCopy size={10} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

/* ── Main ────────────────────────────────────────────────────── */
const QuoteListPage = () => {
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('all');
  const [view,     setView]     = useState('grid'); // 'grid' | 'list'
  const [showCharts, setShowCharts] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['publicQuotes'],
    queryFn:  () => quotesApi.getAll(),
    staleTime: 60_000,
  });
  const quotes = data?.quotes ?? [];

  /* derived stats */
  const catCounts = useMemo(() => {
    const map = {};
    quotes.forEach(q => { if (q.category) map[q.category] = (map[q.category] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [quotes]);

  const authorCounts = useMemo(() => {
    const map = {};
    quotes.forEach(q => { if (q.author) map[q.author] = (map[q.author] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [quotes]);

  const categories = useMemo(() => ['all', ...new Set(quotes.map(q => q.category).filter(Boolean))], [quotes]);

  const filtered = useMemo(() => quotes.filter(q => {
    const ms = !search || q.text?.toLowerCase().includes(search.toLowerCase()) || q.author?.toLowerCase().includes(search.toLowerCase());
    const mc = category === 'all' || q.category === category;
    return ms && mc;
  }), [quotes, search, category]);

  const pieData  = catCounts.slice(0, 6).map(([name, value]) => ({ name, value, color: cc(name) }));
  const barData  = authorCounts.map(([name, count]) => ({ name: name.split(' ').slice(-1)[0], count }));

  return (
    <div className="min-h-screen text-white" style={{ background: NAVY }}>
      <Navbar onContactOpen={() => {}} />

      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">

          {/* header */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
              Quote collection
            </span>
            <h1 className="text-[32px] font-black text-white tracking-tight mt-1">
              Explore wisdom
            </h1>
            <p className="text-[13px] text-white/40 mt-1">
              {quotes.length} curated quotes across {catCounts.length} categories.
            </p>
          </motion.div>

          {/* stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat icon={FiBookOpen}   color={ACCENT}    label="Total quotes"   value={quotes.length} />
            <Stat icon={FiUsers}      color="#818CF8"   label="Authors"        value={new Set(quotes.map(q=>q.author)).size} />
            <Stat icon={FiBarChart2}  color="#34D399"   label="Categories"     value={catCounts.length} />
            <Stat icon={FiTrendingUp} color="#FB923C"   label="Showing"        value={filtered.length} />
          </div>

          {/* charts */}
          <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: SLATE }}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/6">
              <span className="text-[12px] font-bold text-white/60">Data overview</span>
              <button onClick={() => setShowCharts(s => !s)}
                className="text-[11px] text-white/30 hover:text-white/55 transition-colors flex items-center gap-1">
                <FiBarChart2 size={12} />{showCharts ? 'Hide' : 'Show'} charts
              </button>
            </div>
            <AnimatePresence>
              {showCharts && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
                  className="overflow-hidden">
                  <div className="grid sm:grid-cols-2 gap-0 divide-x divide-white/6">

                    {/* Pie chart - categories */}
                    <div className="p-5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/25 mb-4">By category</p>
                      <div style={{ height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                              innerRadius={55} outerRadius={85} paddingAngle={3}>
                              {pieData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} stroke="transparent" />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
                        {pieData.map(d => (
                          <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-white/40">
                            <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                            {d.name} ({d.value})
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bar chart - top authors */}
                    <div className="p-5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/25 mb-4">Top authors</p>
                      <div style={{ height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={ACCENT} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* filter + view controls */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <FiSearch size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search quotes or authors…"
                className="w-full pl-8 pr-8 py-2.5 rounded-xl bg-[#141924] border border-white/8 text-[13px] text-white/75 placeholder-white/20 focus:outline-none focus:border-amber-500/35 transition-all" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/55 transition-colors"><FiX size={12} /></button>}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              {categories.slice(0, 6).map(cat => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className="px-3 py-2 rounded-xl text-[12px] font-medium border whitespace-nowrap transition-all shrink-0"
                  style={category === cat
                    ? { background: `${ACCENT}15`, borderColor: `${ACCENT}35`, color: ACCENT }
                    : { background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }
                  }>
                  {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-[#141924] border border-white/8 rounded-xl p-1 gap-0.5 shrink-0">
              {[{ v: 'grid', Icon: FiGrid }, { v: 'list', Icon: FiList }].map(({ v, Icon }) => (
                <button key={v} onClick={() => setView(v)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={view === v ? { background: `${ACCENT}18`, color: ACCENT } : { color: 'rgba(255,255,255,0.25)' }}>
                  <Icon size={13} />
                </button>
              ))}
            </div>
          </div>

          {/* count */}
          <p className="text-[11px] text-white/25">
            {filtered.length} of {quotes.length} quotes
            {category !== 'all' && ` in ${category}`}
            {search && ` matching "${search}"`}
          </p>

          {/* quote grid/list */}
          {isLoading ? (
            <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3' : 'flex flex-col gap-2'}>
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/6 p-4 space-y-3 animate-pulse" style={{ background: SLATE }}>
                  <div className="w-16 h-3 bg-white/8 rounded-full" />
                  <div className="space-y-1.5"><div className="h-3 bg-white/6 rounded-full" /><div className="h-3 bg-white/6 rounded-full w-4/5" /></div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 rounded-2xl border border-white/6" style={{ background: SLATE }}>
              <FiBookOpen size={22} className="text-white/20" />
              <p className="text-[13px] text-white/35">No quotes match your filters.</p>
            </div>
          ) : (
            <motion.div layout className={view === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
              : 'flex flex-col gap-2'
            }>
              <AnimatePresence initial={false}>
                {filtered.map(q => (
                  <QuoteItem key={q.id} quote={q} view={view} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
};

export default QuoteListPage;