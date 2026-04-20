/**
 * Dashboard.jsx — fully refactored
 * ─────────────────────────────────────────────────────────────
 * CHANGES vs previous version
 * ───────────────────────────────
 *  1. Added View icon (eye) per row — opens a beautiful full
 *     view modal with smooth animations.
 *  2. Fixed pagination overflow — container clips properly.
 *  3. Edit now pre-fills the QuoteModal with the clicked quote.
 *  4. No changes to data access — user only sees their own quotes.
 * ─────────────────────────────────────────────────────────────
 */

import {
  useState, useMemo, useCallback, useRef, useEffect,
  memo,
} from 'react';
import { signOut }              from 'firebase/auth';
import { auth }                 from '../config/firebase';
import { useNavigate, Link }    from 'react-router-dom';
import { useAuth }              from '../context/AuthContext';
import {
  useQuery, useMutation, useQueryClient,
} from '@tanstack/react-query';
import { quotesApi, lyricsApi, adminApi } from '../utils/api';
import { Pagination }    from '../components/Pagination';
import toast, { Toaster }       from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiLogOut, FiPlus, FiSearch, FiX, FiBookOpen,
  FiStar, FiGrid, FiTrendingUp, FiFilter,
  FiChevronDown, FiList, FiLayout, FiHome,
  FiAlertTriangle, FiMenu, FiShield, FiLock,
  FiMusic, FiCheck, FiXCircle, FiUsers,
  FiActivity, FiClock, FiZap, FiChevronLeft,
  FiChevronRight, FiRefreshCw, FiEdit2, FiTrash2,
  FiCopy, FiCalendar, FiBarChart2, FiEye,
} from 'react-icons/fi';

import RoleGuard   from '../components/RoleGuard';
import useRole     from '../hooks/useRole';
import { ROLES }   from '../store/authSlice';
import QuoteModal  from '../pages/QuoteModal';
import { toMs } from '../utils/time';

/* ─── Design tokens ─────────────────────────────────────────── */
const T = {
  surface:  '#111620',
  surface2: '#141924',
  surface3: '#1C2230',
  border:   'rgba(255,255,255,0.07)',
  border2:  'rgba(255,255,255,0.12)',
  t1:       '#E8EAF0',
  t2:       'rgba(232,234,240,0.55)',
  t3:       'rgba(232,234,240,0.28)',
  green:    '#34D399',
  red:      '#F87171',
  amber:    '#F59E0B',
  indigo:   '#818CF8',
};

const ACCENT  = '#F59E0B';
const ACCENT2 = '#F97316';
const SLATE   = '#141924';
const DEEP    = '#0A0E1A';

const CAT_COLOR = {
  motivation:'#F59E0B', mindset:'#818CF8',    discipline:'#34D399',
  success:'#A78BFA',    resilience:'#FB923C',  persistence:'#38BDF8',
  growth:'#2DD4BF',     inspiration:'#7DD3FC', default:'#6B7280',
};
const catColor = (c) => CAT_COLOR[c] ?? CAT_COLOR.default;

const PAGE_SIZE = 6;

const timeAgo = (ts) => {
  const ms = toMs(ts);
  if (!ms) return '?';
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const stagger = (i, base = 0) => ({
  initial:    { opacity: 0, y: 12 },
  animate:    { opacity: 1, y: 0  },
  transition: { delay: base + i * 0.055, duration: 0.26, ease: 'easeOut' },
});

const cc = (c) => ({
  motivation:'#F59E0B', mindset:'#818CF8',   discipline:'#34D399',
  success:   '#A78BFA', resilience:'#FB923C', persistence:'#38BDF8',
  belief:    '#C084FC', action:'#86EFAC',     growth:'#2DD4BF',
  determination:'#F87171', inspiration:'#7DD3FC',
  gospel:    '#FCD34D', afrobeat:'#10B981',   rnb:'#EC4899',
  hiphop:    '#8B5CF6', pop:'#06B6D4',        soul:'#F97316',
}[c] ?? T.indigo);

/* ─── Role pill ─────────────────────────────────────────────── */
const RolePill = ({ role }) => {
  const map = {
    admin: { color:'#818CF8', bg:'rgba(129,140,248,0.12)', border:'rgba(129,140,248,0.22)', Icon:FiShield, label:'Admin' },
    user:  { color:'#34D399', bg:'rgba(52,211,153,0.10)',  border:'rgba(52,211,153,0.20)',  Icon:FiUsers,  label:'User'  },
    guest: { color:'#6B7280', bg:'rgba(107,114,128,0.10)', border:'rgba(107,114,128,0.18)', Icon:FiLock,   label:'Guest' },
  };
  const { color, bg, border, Icon, label } = map[role] ?? map.guest;
  return (
    <motion.span
      initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }}
      transition={{ delay:0.3, duration:0.2 }}
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ background:bg, color, border:`1px solid ${border}` }}
    >
      {Icon && <Icon size={9}/>}
      {label}
    </motion.span>
  );
};

/* ─── Stat card ─────────────────────────────────────────────── */
const StatCard = memo(({ label, value, icon:Icon, accent, i, sub }) => (
  <motion.div {...stagger(i)}
    className="relative bg-[#141924] border border-white/8 rounded-2xl p-4 flex flex-col gap-3 overflow-hidden"
  >
    <div className="absolute top-0 left-0 right-0 h-[1.5px] opacity-60"
         style={{ background:`linear-gradient(90deg,${accent}90,transparent)` }}/>
    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
         style={{ background:`${accent}18` }}>
      <Icon size={14} style={{ color:accent }}/>
    </div>
    <div>
      <p className="text-[26px] font-black text-white leading-none tabular-nums">{value}</p>
      <p className="text-[11px] text-white/30 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] mt-1 font-medium" style={{ color:`${accent}80` }}>{sub}</p>}
    </div>
  </motion.div>
));

/* ─── Sparkline (7-day activity strip) ──────────────────────── */
const Sparkline = memo(({ items }) => {
  const days = useMemo(() => {
    const counts = Array(7).fill(0);
    const now = Date.now();
    items.forEach(q => {
      const ms = toMs(q.createdAt);
      const dayIdx = Math.floor((now - ms) / 86400000);
      if (dayIdx >= 0 && dayIdx < 7) counts[6 - dayIdx]++;
    });
    return counts;
  }, [items]);

  const max  = Math.max(...days, 1);
  const dows = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const today = new Date().getDay();

  return (
    <div className="flex items-end gap-1.5 h-14">
      {days.map((count, i) => {
        const dayLabel = dows[(today - 6 + i + 7) % 7];
        const height   = Math.max((count / max) * 44, 4);
        const isToday  = i === 6;
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <div className="w-full rounded-t-md transition-all duration-500"
                 style={{
                   height,
                   background: isToday
                     ? `linear-gradient(to top,${ACCENT},${ACCENT2})`
                     : count > 0 ? `${ACCENT}50` : 'rgba(255,255,255,0.06)',
                 }}
                 title={`${count} on ${dayLabel}`}
            />
            <span className="text-[9px] font-medium"
                  style={{ color: isToday ? ACCENT : 'rgba(255,255,255,0.2)' }}>
              {dayLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
});

/* ─── Daily spotlight card ──────────────────────────────────── */
const DailySpotlight = memo(({ quotes }) => {
  const pick = useMemo(() => {
    const approved = quotes.filter(q => q.status === 'approved' || !q.status);
    if (!approved.length) return null;
    const idx = Math.floor(Date.now() / 86400000) % approved.length;
    return approved[idx];
  }, [quotes]);

  if (!pick) return null;
  const color = catColor(pick.category);

  return (
    <motion.div
      initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.4, delay:0.1 }}
      className="relative rounded-2xl border overflow-hidden p-5"
      style={{
        background: `linear-gradient(135deg, ${color}12 0%, rgba(20,25,36,0) 60%), #141924`,
        borderColor: `${color}25`,
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]"
           style={{ background:`linear-gradient(90deg,${color}80,${color}20,transparent)` }}/>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
             style={{ background:`${color}18` }}>
          <FiZap size={13} style={{ color }}/>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2"
             style={{ color:`${color}80` }}>Daily spotlight</p>
          <div className="text-[20px] leading-none mb-2 font-serif select-none"
               style={{ color:`${color}30` }}>&ldquo;</div>
          <p className="text-[13px] text-white/75 leading-relaxed mb-3">{pick.text}</p>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em]"
               style={{ color }}>— {pick.author}</p>
            <span className="text-[9px] px-2 py-0.5 rounded-full border capitalize"
                  style={{ background:`${color}12`, color, borderColor:`${color}30` }}>
              {pick.category}
            </span>
          </div>
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(`"${pick.text}" — ${pick.author}`); toast.success('Copied!'); }}
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-white/50 transition-colors"
          style={{ background:'rgba(255,255,255,0.04)' }}>
          <FiCopy size={11}/>
        </button>
      </div>
    </motion.div>
  );
});

/* ─── Admin quick-actions panel ─────────────────────────────── */
const AdminQuickActions = memo(({ onApprove, onReject }) => {
  const { data: queueData, isLoading } = useQuery({
    queryKey: ['adminQueue'],
    queryFn:  adminApi.getQueue,
    staleTime: 30_000,
    retry: false,
  });
  const queue   = queueData?.queue ?? [];
  const preview = queue.slice(0, 3);

  if (isLoading) return null;
  if (!queue.length) return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/6 bg-[#141924]">
      <FiCheck size={13} className="text-green-400/60"/>
      <span className="text-[12px] text-white/30">Approval queue is empty — all clear.</span>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
      className="rounded-2xl border overflow-hidden"
      style={{ background:'rgba(245,158,11,0.04)', borderColor:'rgba(245,158,11,0.18)' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/12">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"/>
          <span className="text-[12px] font-semibold text-amber-400">
            {queue.length} user{queue.length !== 1 ? 's' : ''} awaiting approval
          </span>
        </div>
        <Link to="/admin" className="text-[11px] text-amber-500/50 hover:text-amber-400 transition-colors flex items-center gap-1">
          Manage all <FiChevronRight size={10}/>
        </Link>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {preview.map(u => (
          <div key={u.uid} className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0"
                 style={{ background:`${ACCENT}18`, color:ACCENT }}>
              {(u.displayName?.[0] || u.email?.[0] || '?').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-white/70 font-medium truncate">{u.displayName || u.email}</p>
              <p className="text-[10px] text-white/25 truncate">{u.email}</p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button onClick={() => onApprove(u.uid)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-950 transition-all"
                style={{ background:`linear-gradient(to right,${ACCENT},${ACCENT2})` }}>
                Approve
              </button>
              <button onClick={() => onReject(u.uid)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium border border-red-500/25 text-red-400 hover:bg-red-500/10 transition-all bg-transparent">
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
});

/* ─── Sidebar: Category bar ─────────────────────────────────── */
const CategoryBar = memo(({ quotes }) => {
  const counts = useMemo(() => {
    const map = {};
    quotes.forEach(q => { if (q.category) map[q.category] = (map[q.category] || 0) + 1; });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,6);
  }, [quotes]);
  const max = counts[0]?.[1] ?? 1;

  return (
    <div className="bg-[#141924] border border-white/8 rounded-2xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/25 mb-3">By category</p>
      {counts.length === 0
        ? <p className="text-[12px] text-white/20 text-center py-3">No data yet</p>
        : (
          <div className="space-y-2.5">
            {counts.map(([cat, count]) => {
              const color = catColor(cat);
              const pct   = Math.round((count / max) * 100);
              return (
                <div key={cat} className="flex items-center gap-2.5">
                  <span className="text-[11px] text-white/40 w-[68px] flex-shrink-0 capitalize truncate">{cat}</span>
                  <div className="flex-1 h-1.5 bg-white/6 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width:0 }} animate={{ width:`${pct}%` }}
                      transition={{ duration:0.55, ease:'easeOut', delay:0.1 }}
                      className="h-full rounded-full" style={{ background:color }}/>
                  </div>
                  <span className="text-[10px] text-white/25 tabular-nums w-4 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
});

/* ─── Sidebar: Top authors ──────────────────────────────────── */
const TopAuthors = memo(({ quotes }) => {
  const authors = useMemo(() => {
    const map = {};
    quotes.forEach(q => { if (q.author) map[q.author] = (map[q.author]||0)+1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5);
  }, [quotes]);

  return (
    <div className="bg-[#141924] border border-white/8 rounded-2xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/25 mb-3">Top authors</p>
      {authors.length === 0
        ? <p className="text-[12px] text-white/20 text-center py-3">No authors yet</p>
        : (
          <div className="space-y-2">
            {authors.map(([author, count], i) => (
              <div key={author} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black flex-shrink-0"
                     style={{ background:`${ACCENT}18`, color:ACCENT }}>{i+1}</div>
                <span className="flex-1 text-[12px] text-white/55 truncate">{author}</span>
                <span className="text-[10px] text-white/25 tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
});

/* ─── Sidebar: Recent activity ──────────────────────────────── */
const RecentActivity = memo(({ quotes }) => {
  const recent = useMemo(() =>
    [...quotes].sort((a,b)=>toMs(b.createdAt)-toMs(a.createdAt)).slice(0,5)
  , [quotes]);

  return (
    <div className="bg-[#141924] border border-white/8 rounded-2xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/25 mb-3">Recent</p>
      {recent.length === 0
        ? <p className="text-[12px] text-white/20 text-center py-3">Nothing yet</p>
        : (
          <div className="space-y-2.5">
            {recent.map(q => (
              <div key={q.id} className="flex gap-2.5 items-start">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                     style={{ background:catColor(q.category) }}/>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white/55 truncate">"{q.text}"</p>
                  <p className="text-[10px] text-white/22 mt-0.5">{q.author} · {timeAgo(q.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
});

/* ─── Sidebar: Activity calendar (dot grid) ─────────────────── */
const ActivityCalendar = memo(({ quotes }) => {
  const WEEKS = 10;
  const grid  = useMemo(() => {
    const now    = Date.now();
    const days   = WEEKS * 7;
    const counts = Array(days).fill(0);
    quotes.forEach(q => {
      const ms = toMs(q.createdAt);
      if (!ms) return;
      const dayIdx = Math.floor((now - ms) / 86400000);
      if (dayIdx >= 0 && dayIdx < days) counts[days - 1 - dayIdx]++;
    });
    return counts;
  }, [quotes]);

  const maxCount = Math.max(...grid, 1);

  return (
    <div className="bg-[#141924] border border-white/8 rounded-2xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/25 mb-3">Activity (10 weeks)</p>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${WEEKS},1fr)`, gap:3 }}>
        {Array.from({ length:WEEKS }).map((_,week) =>
          <div key={week} className="flex flex-col gap-[3px]">
            {Array.from({ length:7 }).map((_,day) => {
              const idx   = week * 7 + day;
              const count = grid[idx] ?? 0;
              const alpha = count === 0 ? 0.06 : 0.2 + (count / maxCount) * 0.75;
              return (
                <div key={day} className="rounded-sm"
                     style={{ width:9, height:9, background:`rgba(245,158,11,${alpha})` }}
                     title={`${count} quote${count!==1?'s':''}`}/>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[9px] text-white/20">Less</span>
        <div className="flex gap-1 items-center">
          {[0.06,0.25,0.45,0.65,0.90].map((a,i) => (
            <div key={i} className="w-2 h-2 rounded-sm"
                 style={{ background:`rgba(245,158,11,${a})` }}/>
          ))}
        </div>
        <span className="text-[9px] text-white/20">More</span>
      </div>
    </div>
  );
});

/* ─── Sidebar composite ─────────────────────────────────────── */
const SidebarContent = memo(({ quotes, lyrics }) => (
  <div className="space-y-4">
    <CategoryBar      quotes={quotes}/>
    <TopAuthors       quotes={quotes}/>
    <ActivityCalendar quotes={quotes}/>
    <RecentActivity   quotes={quotes}/>
    {lyrics.length > 0 && (
      <div className="bg-[#141924] border border-white/8 rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/25 mb-3">Recent lyrics</p>
        <div className="space-y-2.5">
          {[...lyrics].sort((a,b)=>toMs(b.createdAt)-toMs(a.createdAt)).slice(0,4).map(l => {
            const color = CAT_COLOR[l.genre] ?? CAT_COLOR.default;
            return (
              <div key={l.id} className="flex gap-2.5 items-start">
                <FiMusic size={10} style={{ color, flexShrink:0, marginTop:2 }}/>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white/55 truncate">"{l.text}"</p>
                  <p className="text-[10px] text-white/22 mt-0.5">{l.artist}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
  </div>
));

/* ─── Delete modal ──────────────────────────────────────────── */
const DeleteModal = memo(({ label = 'quote', onConfirm, onCancel }) => (
  <motion.div
    initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    onClick={onCancel}
  >
    <motion.div
      initial={{ scale:0.92, opacity:0 }} animate={{ scale:1, opacity:1 }}
      exit={{ scale:0.92, opacity:0 }} transition={{ duration:0.18 }}
      onClick={e=>e.stopPropagation()}
      className="w-full max-w-sm bg-[#141924] border border-white/10 rounded-2xl p-6 shadow-[0_24px_48px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
          <FiAlertTriangle size={16} className="text-red-400"/>
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-white">Delete {label}?</h3>
          <p className="text-[12px] text-white/40">This cannot be undone.</p>
        </div>
      </div>
      <div className="flex gap-2.5 mt-2">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-[13px] font-medium bg-white/6 hover:bg-white/10 text-white/60 border border-white/8 transition-all">
          Cancel
        </button>
        <button onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/25 transition-all">
          Delete
        </button>
      </div>
    </motion.div>
  </motion.div>
));

/* ─── View modal ──────────────────────────────────────── */
const ViewModal = memo(({ item, type, onClose, onEdit }) => {
  if (!item) return null;
  const isLyric = type === 'lyric';
  const color   = cc(item.category ?? item.genre);
  const label   = isLyric ? item.artist : item.author;
  const cat     = item.category ?? item.genre;

  const statusMap = {
    approved: { color: T.green, label: 'Approved' },
    pending:  { color: T.amber, label: 'Pending'  },
    rejected: { color: T.red,   label: 'Rejected' },
  };
  const statusInfo = statusMap[item.status] ?? statusMap.pending;

  return (
    <motion.div
      initial={{ opacity:0 }}
      animate={{ opacity:1 }}
      exit={{ opacity:0 }}
      transition={{ duration:0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(5,8,18,0.82)', backdropFilter:'blur(18px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale:0.88, opacity:0, y:24 }}
        animate={{ scale:1, opacity:1, y:0 }}
        exit={{ scale:0.88, opacity:0, y:24 }}
        transition={{ type:'spring', stiffness:320, damping:28 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden"
        style={{
          background: `linear-gradient(145deg, ${color}0e 0%, #141924 45%)`,
          border: `1px solid ${color}30`,
          borderRadius: 24,
          boxShadow: `0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px ${color}12, inset 0 1px 0 ${color}18`,
        }}
      >
        {/* Ambient glow top */}
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[24px]"
             style={{ background:`linear-gradient(90deg, transparent, ${color}90, ${color}60, transparent)` }}/>

        {/* Decorative large quote mark */}
        <div className="absolute top-4 right-6 text-[88px] leading-none font-serif pointer-events-none select-none"
             style={{ color:`${color}08`, lineHeight:1 }}>"</div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                 style={{ background:`${color}18`, border:`1px solid ${color}25` }}>
              {isLyric ? <FiMusic size={13} style={{ color }}/> : <FiBookOpen size={13} style={{ color }}/>}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color:`${color}80` }}>
                {isLyric ? 'Lyric' : 'Quote'}
              </p>
              {cat && (
                <span className="text-[9px] capitalize" style={{ color:`${color}55` }}>{cat}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110"
            style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.35)' }}
          >
            <FiX size={13}/>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-4 relative z-10">
          {/* Quote text */}
          <div className="mb-5">
            <p className="text-[18px] sm:text-[20px] text-white/88 leading-[1.65] font-light tracking-wide"
               style={{ fontFamily:'"Georgia", serif' }}>
              {item.text}
            </p>
          </div>

          {/* Author / artist */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-px h-4 rounded-full" style={{ background:color }}/>
            <p className="text-[13px] font-bold uppercase tracking-[0.12em]" style={{ color }}>
              {label}
            </p>
          </div>

          {/* Tags row */}
          <div className="flex items-center flex-wrap gap-2 mb-5">
            {cat && (
              <span className="text-[10px] px-2.5 py-1 rounded-full capitalize font-semibold"
                    style={{ background:`${color}15`, color, border:`1px solid ${color}28` }}>
                {cat}
              </span>
            )}
            {!isLyric && item.status && (
              <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
                    style={{ background:`${statusInfo.color}15`, color:statusInfo.color, border:`1px solid ${statusInfo.color}28` }}>
                {statusInfo.label}
              </span>
            )}
            {item.isFavorite && (
              <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold flex items-center gap-1"
                    style={{ background:'rgba(129,140,248,0.12)', color:'#818CF8', border:'1px solid rgba(129,140,248,0.22)' }}>
                <FiStar size={9}/> Favourite
              </span>
            )}
            {item.createdAt && (
              <span className="text-[10px] text-white/25 ml-auto">{timeAgo(item.createdAt)}</span>
            )}
          </div>

          {/* Divider */}
          <div className="h-px mb-4" style={{ background:`linear-gradient(90deg, ${color}20, transparent)` }}/>

          {/* Action buttons */}
          <div className="flex gap-2.5">
            <button
              onClick={() => { navigator.clipboard.writeText(`"${item.text}" — ${label}`); toast.success('Copied to clipboard!'); }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all hover:scale-105"
              style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)', color:'rgba(255,255,255,0.50)' }}
            >
              <FiCopy size={11}/> Copy
            </button>
            {!isLyric && onEdit && (
              <button
                onClick={() => { onClose(); onEdit(item); }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all hover:scale-105"
                style={{ background:`${T.indigo}15`, border:`1px solid ${T.indigo}28`, color:T.indigo }}
              >
                <FiEdit2 size={11}/> Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-gray-950 transition-all hover:scale-105"
              style={{ background:`linear-gradient(to right,${ACCENT},${ACCENT2})` }}
            >
              Done
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});

/* ─── Filter bar ────────────────────────────────────────────── */
const FilterBar = memo(({
  searchQuery, setSearchQuery,
  selectedCategory, setSelectedCategory,
  categories, view, setView, total, filtered,
}) => (
  <div className="flex flex-col sm:flex-row gap-2">
    <div className="relative flex-1">
      <FiSearch size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none"/>
      <input
        type="text" placeholder="Search quotes or authors…"
        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
        className="w-full pl-8 pr-8 py-2.5 rounded-xl bg-[#141924] border border-white/8 text-[13px] text-white/75 placeholder-white/20 focus:outline-none focus:border-amber-500/35 focus:ring-1 focus:ring-amber-500/12 transition-all"
      />
      {searchQuery && (
        <button onClick={() => setSearchQuery('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/55 transition-colors">
          <FiX size={12}/>
        </button>
      )}
    </div>

    <div className="relative">
      <FiFilter size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none"/>
      <select
        value={selectedCategory}
        onChange={e => setSelectedCategory(e.target.value)}
        className="appearance-none pl-8 pr-7 py-2.5 rounded-xl bg-[#141924] border border-white/8 text-[13px] text-white/60 focus:outline-none focus:border-amber-500/35 transition-all cursor-pointer"
      >
        {categories.map(c => (
          <option key={c} value={c} className="bg-[#0D1017]">
            {c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}
          </option>
        ))}
      </select>
      <FiChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none"/>
    </div>

    <div className="flex items-center bg-[#141924] border border-white/8 rounded-xl p-1 gap-0.5">
      {[{ v:'grid', Icon:FiLayout },{ v:'list', Icon:FiList }].map(({ v, Icon }) => (
        <button key={v} onClick={() => setView(v)}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
          style={view===v ? { background:`${ACCENT}18`, color:ACCENT } : { color:'rgba(255,255,255,0.22)' }}>
          <Icon size={12}/>
        </button>
      ))}
    </div>

    {(searchQuery || selectedCategory !== 'all') && (
      <div className="flex items-center px-3 rounded-xl bg-[#141924] border border-white/8 text-[11px] text-white/25 whitespace-nowrap">
        {filtered} / {total}
      </div>
    )}
  </div>
));

/* ─── Empty state ───────────────────────────────────────────── */
const EmptyState = memo(({ hasFilter, onAdd, label = 'quotes' }) => (
  <div className="flex flex-col items-center gap-3 py-14 rounded-2xl border border-white/6 bg-[#141924]">
    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
      <FiBookOpen size={17} className="text-white/20"/>
    </div>
    <p className="text-[13px] text-white/35">
      {hasFilter ? `No ${label} match your filters.` : `No ${label} yet.`}
    </p>
    {!hasFilter && (
      <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.USER]}>
        <button onClick={onAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-gray-950 transition-all"
          style={{ background:`linear-gradient(to right,${ACCENT},${ACCENT2})` }}>
          <FiPlus size={12}/> Add your first {label.slice(0,-1)}
        </button>
      </RoleGuard>
    )}
  </div>
));

/* ─── Status badge ──────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const map = {
    approved: { color: T.green, label: 'Approved' },
    pending:  { color: T.amber, label: 'Pending'  },
    rejected: { color: T.red,   label: 'Rejected' },
  };
  const { color, label } = map[status] ?? map.pending;
  return (
    <span style={{
      background: `${color}18`, color, fontSize: 10, fontWeight: 700,
      padding: '3px 9px', borderRadius: 20, letterSpacing: '0.05em',
      border: `1px solid ${color}30`, whiteSpace:'nowrap',
    }}>{label}</span>
  );
};

/* ─── Quote row ─────────────────────────────────────────────── */
const QuoteRow = ({ item, type, onEdit, onDelete, onApprove, onReject, onView, isMobile }) => {
  const isLyric = type === 'lyric';
  const color   = cc(item.category ?? item.genre);

  const copy = () => {
    navigator.clipboard.writeText(`"${item.text}" — ${item.author ?? item.artist}`);
    toast.success('Copied!');
  };

  if (isMobile) {
    return (
      <motion.div
        initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
        style={{
          background:T.surface2, border:`1px solid ${T.border}`,
          borderRadius:14, padding:'13px 14px', marginBottom:10,
          borderLeft:`2px solid ${color}`,
        }}
      >
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:8 }}>
          <p style={{ fontSize:12, color:T.t1, lineHeight:1.55, flex:1 }}>"{item.text}"</p>
          <button onClick={copy} style={{ background:'none', border:'none', cursor:'pointer', color:T.t3, flexShrink:0, padding:2 }}>
            <FiCopy size={12}/>
          </button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10, flexWrap:'wrap' }}>
          <span style={{ fontSize:10, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            — {item.author ?? item.artist}
          </span>
          <span style={{ fontSize:9, padding:'2px 7px', borderRadius:10, background:`${color}18`, color, border:`1px solid ${color}30` }}>
            {item.category ?? item.genre}
          </span>
          {!isLyric && <StatusBadge status={item.status}/>}
        </div>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
          <button onClick={() => onView(item)} style={{ flex:1, padding:'8px 0', borderRadius:10, border:`1px solid ${ACCENT}40`, background:`${ACCENT}12`, color:ACCENT, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
            <FiEye size={12}/> View
          </button>
          {!isLyric && (
            <button onClick={() => onEdit(item)} style={{ flex:1, padding:'8px 0', borderRadius:10, border:`1px solid ${T.indigo}40`, background:`${T.indigo}12`, color:T.indigo, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
              <FiEdit2 size={12}/> Edit
            </button>
          )}
          <button onClick={() => onDelete(item.id)} style={{ flex:1, padding:'8px 0', borderRadius:10, border:`1px solid ${T.red}30`, background:`${T.red}08`, color:T.red, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
            <FiTrash2 size={12}/> Delete
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <tr
      style={{ borderBottom:`1px solid ${T.border}`, transition:'background 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <td style={{ padding:'11px 12px', maxWidth:260 }}>
        <div style={{ fontSize:12, color:T.t1, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
          {item.text}
        </div>
      </td>
      <td style={{ padding:'11px 12px' }}>
        <span style={{ fontSize:12, color:T.t2, whiteSpace:'nowrap' }}>{item.author ?? item.artist}</span>
      </td>
      <td style={{ padding:'11px 12px' }}>
        <span style={{ fontSize:10, padding:'3px 9px', borderRadius:20, background:`${color}18`, color, border:`1px solid ${color}30`, whiteSpace:'nowrap' }}>
          {item.category ?? item.genre}
        </span>
      </td>
      {!isLyric && (
        <td style={{ padding:'11px 12px' }}>
          <StatusBadge status={item.status}/>
        </td>
      )}
      <td style={{ padding:'11px 12px' }}>
        <div style={{ display:'flex', gap:5, alignItems:'center' }}>
          {/* View */}
          <button onClick={() => onView(item)} title="View"
            style={{ width:28, height:28, borderRadius:8, border:`1px solid ${ACCENT}35`, background:`${ACCENT}10`, color:ACCENT, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background=`${ACCENT}22`}
            onMouseLeave={e => e.currentTarget.style.background=`${ACCENT}10`}
          >
            <FiEye size={12}/>
          </button>
          {/* Edit (quotes only) */}
          {!isLyric && (
            <button onClick={() => onEdit(item)} title="Edit"
              style={{ width:28, height:28, borderRadius:8, border:`1px solid ${T.indigo}40`, background:`${T.indigo}12`, color:T.indigo, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background=`${T.indigo}25`}
              onMouseLeave={e => e.currentTarget.style.background=`${T.indigo}12`}
            >
              <FiEdit2 size={12}/>
            </button>
          )}
          {/* Delete */}
          <button onClick={() => onDelete(item.id)} title="Delete"
            style={{ width:28, height:28, borderRadius:8, border:`1px solid ${T.red}30`, background:`${T.red}08`, color:T.red, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background=`${T.red}20`}
            onMouseLeave={e => e.currentTarget.style.background=`${T.red}08`}
          >
            <FiTrash2 size={12}/>
          </button>
        </div>
      </td>
    </tr>
  );
};
/* ── Pagination wrapper — constrained to content width ──────── */
const PaginationBar = ({ page, total, count, from, to, onPage }) => {
  if (!count || total <= 1) return null;
  return (
    <div style={{
      borderTop:`1px solid ${T.border}`,
      padding:'10px 14px',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      flexWrap:'wrap', gap:8,
      width:'100%', boxSizing:'border-box',  // ← prevents overflow
    }}>
      <span style={{ fontSize:11, color:T.t3, whiteSpace:'nowrap' }}>
        {from}–{to} of {count}
      </span>
      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
        <PgBtn onClick={() => onPage(page - 1)} disabled={page === 1}>‹</PgBtn>
        {buildNums(page, total).map((n, i) =>
          n === '…'
            ? <span key={`d${i}`} style={{ width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:T.t3 }}>…</span>
            : <PgBtn key={n} active={n === page} onClick={() => onPage(n)}>{n}</PgBtn>
        )}
        <PgBtn onClick={() => onPage(page + 1)} disabled={page === total}>›</PgBtn>
      </div>
    </div>
  );
};
const buildNums = (page, total) => {
  const nums = [];
  if (total <= 6) { for (let i = 1; i <= total; i++) nums.push(i); }
  else {
    nums.push(1);
    if (page > 3) nums.push('…');
    for (let i = Math.max(2, page-1); i <= Math.min(total-1, page+1); i++) nums.push(i);
    if (page < total - 2) nums.push('…');
    nums.push(total);
  }
  return nums;
};

const PgBtn = ({ children, onClick, disabled, active }) => (
  <button onClick={onClick} disabled={disabled} style={{
    minWidth:30, height:30, padding:'0 6px', borderRadius:8, fontSize:12, fontWeight:500,
    border:`1px solid ${active ? 'rgba(129,140,248,0.3)' : T.border}`,
    background: active ? 'rgba(129,140,248,0.15)' : 'transparent',
    color: active ? '#818CF8' : T.t3,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.25 : 1,
    transition:'all 0.15s', flexShrink:0,
  }}>{children}</button>
);
/* ── Shared table shell ─────────────────────────────────────── */
// headers and rows always use the same 5 columns regardless of role
const QuoteTable = ({ headers, rows, page, totalPages, count, from, to, onPage }) => (
  <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, overflow:'hidden', width:'100%' }}>
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', minWidth:520 }}>
        <thead>
          <tr style={{ borderBottom:`1px solid ${T.border}` }}>
            {headers.map(h => (
              <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:T.t3, whiteSpace:'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
    <PaginationBar page={page} total={totalPages} count={count} from={from} to={to} onPage={onPage}/>
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

  /* ── UI state ── */
  const [editing,          setEditing]          = useState(null);
  const [searchQuery,      setSearchQuery]       = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showForm,         setShowForm]         = useState(false);
  const [view,             setView]             = useState('grid');
  const [activeTab,        setActiveTab]        = useState('quotes');
  const [deleteTarget,     setDeleteTarget]     = useState(null);
  const [viewTarget,       setViewTarget]       = useState(null); // { item, type }
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const formRef = useRef(null);

  const [quotePage, setQuotePage] = useState(1);
  const [lyricPage, setLyricPage] = useState(1);

  /* ── Queries ── */
  const { data: quotesData, isLoading: quotesLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn:  quotesApi.getMy,
    enabled:  !!user,
    onError:  err => toast.error(err.message || 'Failed to load quotes'),
  });
  const quotes = quotesData?.quotes ?? [];

  const { data: lyricsData, isLoading: lyricsLoading } = useQuery({
    queryKey: ['lyrics'],
    queryFn:  lyricsApi.getAll,
    enabled:  !!user,
    retry:    false,
    onError:  () => {},
  });
  const lyrics = lyricsData?.lyrics ?? [];

  /* ── Mutations ── */
  const qc = queryClient;

  const createMutation = useMutation({
    mutationFn: quotesApi.create,
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey:['quotes'] });
      const prev   = qc.getQueryData(['quotes']);
      const tempId = `temp-${Date.now()}`;
      qc.setQueryData(['quotes'], old => ({
        ...old,
        quotes:[{ id:tempId, ...newData, createdAt:new Date().toISOString(), optimistic:true }, ...(old?.quotes??[])],
      }));
      return { prev, tempId };
    },
    onSuccess: (res, _, ctx) => {
      qc.setQueryData(['quotes'], old => ({
        ...old,
        quotes:(old?.quotes??[]).map(q => q.id===ctx.tempId ? res.quote : q),
      }));
      qc.invalidateQueries({ queryKey:['quotes'] });
      toast.success('Quote added!');
      setShowForm(false);
    },
    onError: (err, _, ctx) => {
      qc.setQueryData(['quotes'], ctx.prev);
      toast.error(err.message || 'Failed to add');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => quotesApi.update(id, data),
    onMutate: async ({ id, data:newData }) => {
      await qc.cancelQueries({ queryKey:['quotes'] });
      const prev = qc.getQueryData(['quotes']);
      qc.setQueryData(['quotes'], old => ({
        ...old,
        quotes:(old?.quotes??[]).map(q => q.id===id ? { ...q, ...newData } : q),
      }));
      return { prev };
    },
    onSuccess: (res) => {
      qc.setQueryData(['quotes'], old => ({
        ...old,
        quotes:(old?.quotes??[]).map(q => q.id===res.quote.id ? res.quote : q),
      }));
      qc.invalidateQueries({ queryKey:['quotes'] });
      toast.success('Quote updated!');
      setEditing(null);
      setShowForm(false);
    },
    onError: (err, _, ctx) => {
      qc.setQueryData(['quotes'], ctx.prev);
      toast.error(err.message || 'Failed to update');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, type }) => type==='lyric' ? lyricsApi.delete(id) : quotesApi.delete(id),
    onMutate: async ({ id, type }) => {
      const key = type==='lyric' ? ['lyrics'] : ['quotes'];
      await qc.cancelQueries({ queryKey:key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, old => ({
        ...old,
        [type==='lyric'?'lyrics':'quotes']: (old?.[type==='lyric'?'lyrics':'quotes']??[]).filter(q=>q.id!==id),
      }));
      return { prev, key };
    },
    onSuccess: (_,{ type }) => {
      qc.invalidateQueries({ queryKey: type==='lyric' ? ['lyrics'] : ['quotes'] });
      toast.success(`${type==='lyric'?'Lyric':'Quote'} deleted`);
      setDeleteTarget(null);
    },
    onError: (err, _, ctx) => {
      qc.setQueryData(ctx.key, ctx.prev);
      toast.error(err.message || 'Failed to delete');
      setDeleteTarget(null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: adminApi.approveUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey:['adminQueue'] }); toast.success('Approved!'); },
    onError:   err => toast.error(err.message || 'Failed to approve'),
  });
  const rejectMutation = useMutation({
    mutationFn: adminApi.suspendUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey:['adminQueue'] }); toast.success('Denied'); },
    onError:   err => toast.error(err.message || 'Failed to deny'),
  });

  const handleFavorite = useCallback(async (id, isFavorite) => {
    qc.setQueryData(['quotes'], old => ({
      ...old,
      quotes:(old?.quotes??[]).map(q => q.id===id ? { ...q, isFavorite } : q),
    }));
    try { await quotesApi.update(id, { isFavorite }); }
    catch {
      qc.setQueryData(['quotes'], old => ({
        ...old,
        quotes:(old?.quotes??[]).map(q => q.id===id ? { ...q, isFavorite:!isFavorite } : q),
      }));
    }
  }, [qc]);

  const handleAddOrUpdate = useCallback((formData) => {
    if (editing) updateMutation.mutate({ id:editing.id, data:formData });
    else         createMutation.mutate(formData);
  }, [editing, createMutation, updateMutation]);

  /* ── Edit: opens form with quote details pre-filled ── */
  const handleEdit = useCallback((q) => {
    setEditing(q);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 80);
  }, []);

  /* ── View: opens view modal ── */
  const handleView = useCallback((item, type = 'quote') => {
    setViewTarget({ item, type });
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      qc.clear();
      navigate('/');
    } catch { toast.error('Logout failed'); }
  };

  /* ── Derived ── */
  const favCount  = quotes.filter(q => q.isFavorite).length;
  const catCount  = new Set(quotes.map(q=>q.category).filter(Boolean)).size;
  const weekCount = quotes.filter(q => (Date.now() - toMs(q.createdAt)) < 7*86400000).length;

  const latestDate = useMemo(() => {
    if (!quotes.length) return '?';
    const sorted = [...quotes].sort((a,b)=>toMs(b.createdAt)-toMs(a.createdAt));
    const ms     = toMs(sorted[0].createdAt);
    if (!ms) return '?';
    return new Date(ms).toLocaleDateString('en-US',{ month:'short', day:'numeric' });
  }, [quotes]);

  const categories = useMemo(() => {
    const all = quotes.map(q=>q.category).filter(Boolean);
    return ['all', ...new Set(all)];
  }, [quotes]);

  /* ── Filtered arrays — declared before pagination ── */
  const visibleQuotes = useMemo(() => quotes.filter(q => {
    if (activeTab==='favorites' && !q.isFavorite) return false;
    const ms = !searchQuery || q.text.toLowerCase().includes(searchQuery.toLowerCase()) || q.author.toLowerCase().includes(searchQuery.toLowerCase());
    const mc = selectedCategory==='all' || q.category===selectedCategory;
    return ms && mc;
  }), [quotes, searchQuery, selectedCategory, activeTab]);

  const visibleLyrics = useMemo(() => lyrics.filter(l => {
    const ms = !searchQuery || l.text.toLowerCase().includes(searchQuery.toLowerCase()) || l.artist.toLowerCase().includes(searchQuery.toLowerCase());
    return ms;
  }), [lyrics, searchQuery]);

  /* ── Pagination effects — after visible arrays ── */
  /* ── Pagination — AFTER visible arrays ── */
  useEffect(() => { setQuotePage(1); }, [searchQuery, selectedCategory, activeTab]);
  useEffect(() => { setLyricPage(1); }, [searchQuery, activeTab]);

  const paginatedQuotes = useMemo(() => visibleQuotes.slice((quotePage-1)*PAGE_SIZE, quotePage*PAGE_SIZE), [visibleQuotes, quotePage]);
  const paginatedLyrics = useMemo(() => visibleLyrics.slice((lyricPage-1)*PAGE_SIZE, lyricPage*PAGE_SIZE), [visibleLyrics, lyricPage]);

  const qTotalPages = Math.ceil(visibleQuotes.length / PAGE_SIZE);
  const lTotalPages = Math.ceil(visibleLyrics.length / PAGE_SIZE);;

  const isQuoteTab = activeTab==='quotes' || activeTab==='favorites';
  const hasFilter  = searchQuery || selectedCategory !== 'all' || activeTab==='favorites';
  const hour       = new Date().getHours();
  const greeting   = hour<12 ? 'Good morning' : hour<17 ? 'Good afternoon' : 'Good evening';
  const firstName  = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const isLoading  = isQuoteTab ? quotesLoading : lyricsLoading;

  const TABS = [
    { id:'quotes',    label:'Quotes',     count:quotes.length },
    { id:'lyrics',    label:'Lyrics',     count:lyrics.length, icon:FiMusic },
    { id:'favorites', label:'Favourites', count:favCount,      icon:FiStar  },
  ];

  // Always 5 columns — same for both admin and user
  const QUOTE_HEADERS  = ['Text', 'Author', 'Category', 'Status', 'Actions'];
  const LYRIC_HEADERS  = ['Text', 'Artist', 'Genre', '', 'Actions'];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white">
      <Toaster position="top-right" toastOptions={{
        style:{ background:SLATE, color:'#fff', border:'1px solid rgba(255,255,255,0.08)', fontSize:'13px' },
      }}/>

      {/* ── Modals ── */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            label={deleteTarget.type}
            onConfirm={() => deleteMutation.mutate(deleteTarget)}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewTarget && (
          <ViewModal
            item={viewTarget.item}
            type={viewTarget.type}
            onClose={() => setViewTarget(null)}
            onEdit={handleEdit}
          />
        )}
      </AnimatePresence>

      {/* ── Mobile sidebar drawer ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x:'-100%' }} animate={{ x:0 }} exit={{ x:'-100%' }}
              transition={{ type:'spring', stiffness:280, damping:30 }}
              className="fixed top-0 left-0 h-full w-72 z-40 lg:hidden bg-[#0D1220] border-r border-white/8 overflow-y-auto p-5"
            >
              <div className="flex items-center justify-between mb-5">
                <span className="text-[13px] font-bold text-white">Overview</span>
                <button onClick={() => setSidebarOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/6 text-white/40 hover:text-white transition-colors">
                  <FiX size={13}/>
                </button>
              </div>
              <SidebarContent quotes={quotes} lyrics={lyrics}/>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[280px] bg-amber-500/4 rounded-full blur-[100px]"/>
      </div>

      <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* ── Header ── */}
        <motion.div {...stagger(0)} className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-8 h-8 rounded-xl bg-white/6 border border-white/8 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors">
              <FiMenu size={14}/>
            </button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-0.5"
                 style={{ color:`${ACCENT}55` }}>{greeting}</p>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-[24px] sm:text-[28px] font-black text-white tracking-tight leading-tight">
                  {firstName}<span className="text-white/18">'s collection</span>
                </h1>
                <RolePill role={role}/>
              </div>
              <p className="text-[11px] text-white/22 mt-0.5">
                {quotes.length} quote{quotes.length!==1?'s':''} · {lyrics.length} lyric{lyrics.length!==1?'s':''} · last added {latestDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link to="/"
              className="hidden sm:flex w-9 h-9 rounded-xl bg-white/5 border border-white/8 items-center justify-center text-white/35 hover:text-white/65 hover:bg-white/8 transition-all"
              title="Home">
              <FiHome size={14}/>
            </Link>
            {isAdmin && (
              <Link to="/admin"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-[12px] text-white/45 hover:text-white/70 hover:bg-white/8 transition-all"
                title="Admin panel">
                <FiShield size={12}/><span>Admin</span>
              </Link>
            )}
            <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.USER]}>
              <motion.button
                whileTap={{ scale:0.94 }}
                onClick={() => { setEditing(null); setShowForm(s=>!s); }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-gray-950 shadow-sm shadow-amber-500/15"
                style={{ background:`linear-gradient(to right,${ACCENT},${ACCENT2})` }}
              >
                {showForm && !editing ? <FiX size={13}/> : <FiPlus size={13}/>}
                <span className="hidden sm:inline">{showForm && !editing ? 'Cancel' : 'Add quote'}</span>
              </motion.button>
            </RoleGuard>
            <motion.button whileTap={{ scale:0.94 }} onClick={handleLogout}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-white/35 hover:text-red-400/70 hover:bg-red-500/8 transition-all"
              title="Sign out">
              <FiLogOut size={13}/>
            </motion.button>
          </div>
        </motion.div>

        {/* ── Quote form modal ── */}
        <div ref={formRef}>
          <AnimatePresence>
            {showForm && (
              <QuoteModal
                isOpen={showForm}
                onClose={() => { setShowForm(false); setEditing(null); }}
                onSubmit={handleAddOrUpdate}
                initialData={editing}
              />
            )}
          </AnimatePresence>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard i={0} label="My quotes"  value={quotes.length}  icon={FiBookOpen} accent={ACCENT}   sub={`+${weekCount} this week`}/>
          <StatCard i={1} label="Favourites" value={favCount}       icon={FiStar}     accent="#818CF8"  />
          <StatCard i={2} label="Categories" value={catCount}       icon={FiGrid}     accent="#34D399"  />
          <StatCard i={3} label="Lyrics"     value={lyrics.length}  icon={FiMusic}    accent="#FB7185"  />
        </div>

        {/* ── Admin quick-actions ── */}
        {isAdmin && (
          <AdminQuickActions
            onApprove={uid => approveMutation.mutate(uid)}
            onReject={uid  => rejectMutation.mutate(uid)}
          />
        )}

        {/* ── Main 2-col layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">

          {/* Sticky sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-6">
              <SidebarContent quotes={quotes} lyrics={lyrics}/>
            </div>
          </div>

          {/* Main content */}
          <div className="space-y-4 min-w-0">

            {/* Daily spotlight */}
            {quotes.length > 0 && <DailySpotlight quotes={quotes}/>}

            {/* Sparkline */}
            {quotes.length > 0 && (
              <motion.div {...stagger(1)}
                className="bg-[#141924] border border-white/8 rounded-2xl px-4 pt-3 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">7-day activity</p>
                  <span className="text-[10px] text-white/20 font-medium">{weekCount} this week</span>
                </div>
                <Sparkline items={quotes}/>
              </motion.div>
            )}

            {/* Tabs */}
            <motion.div {...stagger(2)} className="flex items-center gap-1.5 flex-wrap">
              {TABS.map(t => {
                const TIcon = t.icon;
                return (
                  <button key={t.id}
                    onClick={() => { setActiveTab(t.id); setSearchQuery(''); setSelectedCategory('all'); }}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12px] font-semibold border transition-all"
                    style={activeTab===t.id
                      ? { background:`${ACCENT}16`, borderColor:`${ACCENT}30`, color:ACCENT }
                      : { background:'transparent', borderColor:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.30)' }
                    }
                  >
                    {TIcon && <TIcon size={11}/>}
                    {t.label}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums"
                          style={{ background:activeTab===t.id ? `${ACCENT}22`:'rgba(255,255,255,0.05)' }}>
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </motion.div>

            {/* Filter bar */}
            <motion.div {...stagger(3)}>
              <FilterBar
                searchQuery={searchQuery}            setSearchQuery={setSearchQuery}
                selectedCategory={selectedCategory}  setSelectedCategory={setSelectedCategory}
                categories={categories}
                view={view}                          setView={setView}
                total={isQuoteTab ? quotes.length : lyrics.length}
                filtered={isQuoteTab ? visibleQuotes.length : visibleLyrics.length}
              />
            </motion.div>

            {/* Content */}
            <motion.div {...stagger(4)}>
              {isLoading ? (
                <div className="flex items-center justify-center gap-3 py-12 text-white/30">
                  <FiRefreshCw size={16} className="animate-spin"/> Loading…
                </div>

              ) : isQuoteTab && visibleQuotes.length === 0 ? (
                <EmptyState hasFilter={hasFilter} label="quotes"
                  onAdd={() => { setEditing(null); setShowForm(true); }}/>

              ) : !isQuoteTab && visibleLyrics.length === 0 ? (
                <EmptyState hasFilter={!!searchQuery} label="lyrics" onAdd={() => {}}/>

              ) : isQuoteTab ? (
                <>
                {/* Desktop table */}
                  <div className="hidden sm:block">
                    <QuoteTable
                      headers={QUOTE_HEADERS}
                      rows={paginatedQuotes.map(q => (
                        <QuoteRow key={q.id} item={q} type="quote"
                          onEdit={handleEdit}
                          onDelete={id => setDeleteTarget({ id, type:'quote' })}
                          onView={(item) => handleView(item, 'quote')}
                          isAdmin={isAdmin}
                          isMobile={false}/>
                      ))}
                      page={quotePage} totalPages={qTotalPages}
                      count={visibleQuotes.length}
                      from={(quotePage-1)*PAGE_SIZE+1}
                      to={Math.min(quotePage*PAGE_SIZE, visibleQuotes.length)}
                      onPage={setQuotePage}
                    />
                  </div>
                  {/* Mobile cards */}
                  <div className="sm:hidden">
                    {paginatedQuotes.map(q => (
                      <QuoteRow key={q.id} item={q} type="quote"
                        onEdit={handleEdit}
                        onDelete={id => setDeleteTarget({ id, type:'quote' })}
                        onView={(item) => handleView(item, 'quote')}
                        isAdmin={isAdmin}
                        isMobile={true}/>
                    ))}
                    <PaginationBar
                      page={quotePage} total={qTotalPages}
                      count={visibleQuotes.length}
                      from={(quotePage-1)*PAGE_SIZE+1}
                      to={Math.min(quotePage*PAGE_SIZE, visibleQuotes.length)}
                      onPage={setQuotePage}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Desktop lyrics table */}
                  <div className="hidden sm:block">
                    <QuoteTable
                      headers={LYRIC_HEADERS}
                      rows={paginatedLyrics.map(l => (
                        <QuoteRow key={l.id} item={l} type="lyric"
                          onEdit={() => {}}
                          onDelete={id => setDeleteTarget({ id, type:'lyric' })}
                          onView={(item) => handleView(item, 'lyric')}
                          isAdmin={isAdmin}
                          isMobile={false}/>
                      ))}
                      page={lyricPage} totalPages={lTotalPages}
                      count={visibleLyrics.length}
                      from={(lyricPage-1)*PAGE_SIZE+1}
                      to={Math.min(lyricPage*PAGE_SIZE, visibleLyrics.length)}
                      onPage={setLyricPage}
                    />
                  </div>
                  {/* Mobile lyrics cards */}
                  <div className="sm:hidden">
                    {paginatedLyrics.map(l => (
                      <QuoteRow key={l.id} item={l} type="lyric"
                        onEdit={() => {}}
                        onDelete={id => setDeleteTarget({ id, type:'lyric' })}
                        onView={(item) => handleView(item, 'lyric')}
                        isAdmin={isAdmin}
                        isMobile={true}/>
                    ))}
                    <PaginationBar
                      page={lyricPage} total={lTotalPages}
                      count={visibleLyrics.length}
                      from={(lyricPage-1)*PAGE_SIZE+1}
                      to={Math.min(lyricPage*PAGE_SIZE, visibleLyrics.length)}
                      onPage={setLyricPage}
                    />
                  </div>
                </>
              )}
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;