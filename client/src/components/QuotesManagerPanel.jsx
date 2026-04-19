// QuotesManagerPanel.jsx
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiX, FiPlus, FiEdit2, FiTrash2, FiCheck, FiXCircle,
  FiUsers, FiFileText, FiMusic, FiCalendar, FiTrendingUp,
  FiRefreshCw, FiBookOpen, FiAlertCircle, FiChevronLeft,
  FiChevronRight, FiCopy, FiChevronDown,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi, lyricsApi, adminApi } from '../utils/api';

import QuoteModal    from '../pages/QuoteModal';
import AddLyricModal from './AddLyricalModal';

/* ── Design tokens ─────────────────────────────────────────── */
const T = {
  bg:       '#0B0E14',
  surface:  '#111620',
  surface2: '#141924',
  surface3: '#1C2230',
  border:   'rgba(255,255,255,0.07)',
  border2:  'rgba(255,255,255,0.12)',
  t1:       '#E8EAF0',
  t2:       'rgba(232,234,240,0.55)',
  t3:       'rgba(232,234,240,0.28)',
  amber:    '#F59E0B',
  amber2:   '#F97316',
  indigo:   '#818CF8',
  teal:     '#2DD4BF',
  green:    '#34D399',
  red:      '#F87171',
  purple:   '#A78BFA',
  coral:    '#FB7185',
};

const CAT_COLORS = {
  motivation:'#F59E0B', mindset:'#818CF8',   discipline:'#34D399',
  success:   '#A78BFA', resilience:'#FB923C', persistence:'#38BDF8',
  belief:    '#C084FC', action:'#86EFAC',     growth:'#2DD4BF',
  determination:'#F87171', inspiration:'#7DD3FC',
  gospel:    '#FCD34D', afrobeat:'#10B981',   rnb:'#EC4899',
  hiphop:    '#8B5CF6', pop:'#06B6D4',        soul:'#F97316',
};
const cc = (c) => CAT_COLORS[c] ?? T.indigo;

const GENRES = [
  'motivation','mindset','discipline','success','resilience','persistence',
  'belief','action','growth','determination','inspiration',
  'gospel','afrobeat','rnb','hiphop','pop','soul',
];

const DEFAULT_CATEGORIES = [
  'motivation','mindset','discipline','success','growth','resilience','inspiration',
];

/* ── Timestamp helper (Firestore _seconds) ─────────────────── */
const toMs = (ts) => {
  if (!ts) return 0;
  if (ts?.toDate)   return ts.toDate().getTime();
  if (ts?._seconds) return ts._seconds * 1000;
  if (ts?.seconds)  return ts.seconds * 1000;
  const d = new Date(ts);
  return isNaN(d) ? 0 : d.getTime();
};

const isToday = (ts) => {
  const d = new Date(toMs(ts)), n = new Date();
  return d.toDateString() === n.toDateString();
};
const isWeek = (ts) => (Date.now() - toMs(ts)) < 7 * 24 * 60 * 60 * 1000;

/* ── Small shared components ───────────────────────────────── */
const Label = ({ children, color }) => (
  <span style={{
    display:'block', fontSize:10, fontWeight:700,
    letterSpacing:'0.12em', textTransform:'uppercase',
    color: color ?? `${T.amber}90`, marginBottom:6,
  }}>{children}</span>
);

const inputStyle = {
  width:'100%', background:'#0D1017', color:T.t1,
  border:`1px solid ${T.border}`, borderRadius:12,
  padding:'10px 14px', fontSize:13, fontFamily:'inherit',
  outline:'none', transition:'border-color 0.2s',
};

const StatusBadge = ({ status }) => {
  const map = {
    approved: { color:T.green, label:'Approved' },
    pending:  { color:T.amber, label:'Pending'  },
    rejected: { color:T.red,   label:'Rejected' },
  };
  const { color, label } = map[status] ?? map.pending;
  return (
    <span style={{
      background:`${color}18`, color, fontSize:10, fontWeight:700,
      padding:'3px 9px', borderRadius:20, letterSpacing:'0.05em',
      border:`1px solid ${color}30`,
    }}>{label}</span>
  );
};

/* ── StatCard ───────────────────────────────────────────────── */
const StatCard = ({ label, value, color, icon: Icon, delay=0 }) => (
  <motion.div
    initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
    transition={{ duration:0.3, delay }}
    style={{
      background:T.surface, border:`1px solid ${T.border}`,
      borderRadius:14, padding:'14px 16px',
      position:'relative', overflow:'hidden',
    }}
  >
    <div style={{
      position:'absolute', top:0, left:0, right:0, height:2,
      background:`linear-gradient(90deg,${color}70,transparent)`,
    }}/>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
      <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:T.t3 }}>
        {label}
      </span>
      {Icon && <Icon size={13} style={{ color:`${color}70` }}/>}
    </div>
    <div style={{ fontSize:24, fontWeight:700, color, letterSpacing:'-0.5px' }}>{value}</div>
  </motion.div>
);

/* ── Pagination ─────────────────────────────────────────────── */
const Pagination = ({ page, total, pageSize, onPage }) => {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;

  const nums = [];
  if (pages <= 6) {
    for (let i = 1; i <= pages; i++) nums.push(i);
  } else {
    nums.push(1);
    if (page > 3) nums.push('…');
    for (let i = Math.max(2, page-1); i <= Math.min(pages-1, page+1); i++) nums.push(i);
    if (page < pages - 2) nums.push('…');
    nums.push(pages);
  }

  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'12px 16px', borderTop:`1px solid ${T.border}`,
      flexWrap:'wrap', gap:8,
    }}>
      <span style={{ fontSize:11, color:T.t3 }}>
        {(page-1)*pageSize+1}–{Math.min(page*pageSize, total)} of {total}
      </span>
      <div style={{ display:'flex', gap:4 }}>
        <button disabled={page===1} onClick={() => onPage(page-1)} style={{
          width:30, height:30, borderRadius:8, border:`1px solid ${T.border}`,
          background:'transparent', cursor:page===1?'not-allowed':'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          color:T.t3, opacity:page===1?0.3:1,
        }}><FiChevronLeft size={13}/></button>

        {nums.map((n, i) => n === '…'
          ? <span key={`d${i}`} style={{ width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:T.t3 }}>…</span>
          : <button key={n} onClick={() => onPage(n)} style={{
              width:30, height:30, borderRadius:8, cursor:'pointer', fontSize:12,
              border:`1px solid ${page===n ? T.border2 : T.border}`,
              background: page===n ? T.surface3 : 'transparent',
              color: page===n ? T.t1 : T.t3,
            }}>{n}</button>
        )}

        <button disabled={page===pages} onClick={() => onPage(page+1)} style={{
          width:30, height:30, borderRadius:8, border:`1px solid ${T.border}`,
          background:'transparent', cursor:page===pages?'not-allowed':'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          color:T.t3, opacity:page===pages?0.3:1,
        }}><FiChevronRight size={13}/></button>
      </div>
    </div>
  );
};

/* ── UserSelector ───────────────────────────────────────────── */
const UserSelector = ({ users, selected, onSelect, forceClose }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ]       = useState('');
  const ref             = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
    // close whenever a modal opens
  useEffect(() => {
    if (forceClose) setOpen(false);
  }, [forceClose]);

  const filtered = useMemo(() =>
    users.filter(u =>
      u.displayName?.toLowerCase().includes(q.toLowerCase()) ||
      u.email?.toLowerCase().includes(q.toLowerCase())
    ), [users, q]);

  const initials    = (u) => (u?.displayName || u?.email || '?')[0].toUpperCase();
  const avatarColor = (u) => {
    const colors = [T.indigo, T.teal, T.purple, T.coral, T.amber, T.green];
    let hash = 0;
    for (const c of (u?.uid || '')) hash = (hash * 31 + c.charCodeAt(0)) | 0;
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display:'flex', alignItems:'center', gap:10, width:'100%',
        background:T.surface2, border:`1px solid ${open ? T.border2 : T.border}`,
        borderRadius:14, padding:'10px 14px', cursor:'pointer',
        color:T.t1, fontFamily:'inherit', transition:'all 0.15s',
      }}>
        {selected ? (
          <>
            <div style={{
              width:28, height:28, borderRadius:8, flexShrink:0,
              background:`${avatarColor(selected)}20`, color:avatarColor(selected),
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, fontWeight:700,
            }}>{initials(selected)}</div>
            <div style={{ flex:1, textAlign:'left', minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:T.t1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {selected.displayName || selected.email}
              </div>
              {selected.displayName && (
                <div style={{ fontSize:10, color:T.t3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {selected.email}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{
              width:28, height:28, borderRadius:8, flexShrink:0,
              background:`${T.indigo}18`, display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <FiUsers size={13} style={{ color:T.indigo }}/>
            </div>
            <span style={{ flex:1, textAlign:'left', fontSize:13, color:T.t3 }}>Select a user…</span>
          </>
        )}
        <FiChevronDown size={13} style={{
          color:T.t3, flexShrink:0,
          transform:open ? 'rotate(180deg)' : 'none', transition:'transform 0.2s',
        }}/>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:-8 }} transition={{ duration:0.15 }}
            style={{
              position:'absolute', top:'calc(100% + 6px)', left:0, right:0,
              zIndex: 300,
              background:T.surface3, border:`1px solid ${T.border2}`,
              borderRadius:14, overflow:'hidden', boxShadow:'0 16px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ padding:'8px 10px', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ position:'relative' }}>
                <FiSearch size={12} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:T.t3 }}/>
                <input
                  value={q} onChange={e => setQ(e.target.value)}
                  placeholder="Search users…" autoFocus
                  style={{ ...inputStyle, padding:'7px 10px 7px 30px', borderRadius:8, fontSize:12 }}
                />
              </div>
            </div>
            <div style={{ maxHeight:240, overflowY:'auto' }}>
              <div
                onClick={() => { onSelect(null); setOpen(false); setQ(''); }}
                style={{
                  display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                  cursor:'pointer', borderBottom:`1px solid ${T.border}`,
                  background:!selected ? `${T.indigo}10` : 'transparent', transition:'background 0.1s',
                }}
              >
                <div style={{ width:26, height:26, borderRadius:7, background:`${T.indigo}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <FiUsers size={11} style={{ color:T.indigo }}/>
                </div>
                <span style={{ fontSize:12, fontWeight:600, color:T.t1 }}>All users</span>
              </div>
              {filtered.map(u => (
                <div key={u.uid}
                  onClick={() => { onSelect(u); setOpen(false); setQ(''); }}
                  style={{
                    display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                    cursor:'pointer', borderBottom:`1px solid ${T.border}`,
                    background:selected?.uid===u.uid ? `${avatarColor(u)}10` : 'transparent',
                    transition:'background 0.1s',
                  }}
                >
                  <div style={{
                    width:26, height:26, borderRadius:7, flexShrink:0,
                    background:`${avatarColor(u)}20`, color:avatarColor(u),
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:10, fontWeight:700,
                  }}>{initials(u)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:T.t1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {u.displayName || u.email}
                    </div>
                    {u.displayName && <div style={{ fontSize:10, color:T.t3 }}>{u.email}</div>}
                  </div>
                  <span style={{
                    fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:8,
                    background:`${avatarColor(u)}18`, color:avatarColor(u),
                    textTransform:'uppercase', letterSpacing:'0.08em',
                  }}>{u.role ?? 'user'}</span>
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ padding:'20px', textAlign:'center', fontSize:12, color:T.t3 }}>No users found</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── QuoteRow ───────────────────────────────────────────────── */
const QuoteRow = ({ item, type, onEdit, onDelete, onApprove, onReject, isMobile }) => {
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
          {!isLyric && item.status === 'pending' && (
            <>
              <button onClick={() => onApprove(item.id)} style={{ flex:1, padding:'8px 0', borderRadius:10, border:`1px solid ${T.green}40`, background:`${T.green}12`, color:T.green, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                <FiCheck size={12}/> Approve
              </button>
              <button onClick={() => onReject(item.id)} style={{ flex:1, padding:'8px 0', borderRadius:10, border:`1px solid ${T.red}40`, background:`${T.red}12`, color:T.red, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                <FiXCircle size={12}/> Reject
              </button>
            </>
          )}
          <button onClick={() => onEdit(item)} style={{ flex:1, padding:'8px 0', borderRadius:10, border:`1px solid ${T.indigo}40`, background:`${T.indigo}12`, color:T.indigo, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
            <FiEdit2 size={12}/> Edit
          </button>
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
      <td style={{ padding:'11px 12px', maxWidth:280 }}>
        <div style={{ fontSize:12, color:T.t1, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
          {item.text}
        </div>
      </td>
      <td style={{ padding:'11px 12px' }}>
        <span style={{ fontSize:12, color:T.t2 }}>{item.author ?? item.artist}</span>
      </td>
      <td style={{ padding:'11px 12px' }}>
        <span style={{ fontSize:10, padding:'3px 9px', borderRadius:20, background:`${color}18`, color, border:`1px solid ${color}30` }}>
          {item.category ?? item.genre}
        </span>
      </td>
      {!isLyric && <td style={{ padding:'11px 12px' }}><StatusBadge status={item.status}/></td>}
      <td style={{ padding:'11px 12px' }}>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {!isLyric && item.status === 'pending' && (
            <>
              <button onClick={() => onApprove(item.id)} title="Approve" style={{ width:28, height:28, borderRadius:8, border:`1px solid ${T.green}40`, background:`${T.green}12`, color:T.green, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <FiCheck size={12}/>
              </button>
              <button onClick={() => onReject(item.id)} title="Reject" style={{ width:28, height:28, borderRadius:8, border:`1px solid ${T.red}40`, background:`${T.red}12`, color:T.red, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <FiXCircle size={12}/>
              </button>
            </>
          )}
          <button onClick={() => onEdit(item)} title="Edit" style={{ width:28, height:28, borderRadius:8, border:`1px solid ${T.indigo}40`, background:`${T.indigo}12`, color:T.indigo, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <FiEdit2 size={12}/>
          </button>
          <button onClick={() => onDelete(item.id)} title="Delete" style={{ width:28, height:28, borderRadius:8, border:`1px solid ${T.red}30`, background:`${T.red}08`, color:T.red, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <FiTrash2 size={12}/>
          </button>
        </div>
      </td>
    </tr>
  );
};

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
const PAGE_SIZE = 8;

export default function QuotesManagerPanel({
  categories = DEFAULT_CATEGORIES,
}) {
  const qc = useQueryClient();

  /* ── UI state ── */
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeTab,    setActiveTab]    = useState('quotes');
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [catFilter,    setCatFilter]    = useState('all');
  const [page,         setPage]         = useState(1);
  const [isMobile,     setIsMobile]     = useState(false);
  const [editingItem,  setEditingItem]  = useState(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [lyricModalOpen, setLyricModalOpen] = useState(false);

  /* ── responsive ── */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /* ── reset page on any filter change ── */
  useEffect(() => { setPage(1); }, [search, statusFilter, catFilter, selectedUser, activeTab]);

  /* ── keyframes ── */
  useEffect(() => {
    if (document.getElementById('qmp-kf')) return;
    const s = document.createElement('style');
    s.id = 'qmp-kf';
    s.textContent = '@keyframes spin { to { transform:rotate(360deg); } }';
    document.head.appendChild(s);
  }, []);

  /* ════════════════════════════════════════════════════════════
     DATA FETCHING
  ════════════════════════════════════════════════════════════ */
  const {
    data: quotesData,
    isLoading: quotesLoading,
    isError: quotesErr,
  } = useQuery({
    queryKey: ['admin-quotes'],
    queryFn:  quotesApi.getAll,         // GET /api/quotes
    select:   (res) => res?.quotes ?? res ?? [],
  });

  const {
    data: lyricsData,
    isLoading: lyricsLoading,
  } = useQuery({
    queryKey: ['admin-lyrics'],
    queryFn:  lyricsApi.getAll,         // GET /api/lyrics
    select:   (res) => res?.lyrics ?? res ?? [],
  });

  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn:  adminApi.listUsers,       // GET /api/admin/users
    select:   (res) => res?.users ?? res ?? [],
  });

  // Safe arrays — never undefined downstream
  const quotes = quotesData ?? [];
  const lyrics = lyricsData ?? [];
  const users  = usersData  ?? [];
  const loading = quotesLoading || lyricsLoading;

  /* ════════════════════════════════════════════════════════════
     MUTATIONS
  ════════════════════════════════════════════════════════════ */
  const createQuoteMut = useMutation({
    mutationFn: (data) => quotesApi.create(data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['admin-quotes'] });
      toast.success('Quote added!');
    },
    onError: (err) => toast.error(err.message || 'Failed to add quote'),
  });

  const updateQuoteMut = useMutation({
    mutationFn: ({ id, data }) => quotesApi.update(id, data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['admin-quotes'] });
      toast.success('Quote updated!');
    },
    onError: (err) => toast.error(err.message || 'Failed to update'),
  });

  const createLyricMut = useMutation({
    mutationFn: (data) => lyricsApi.create(data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['admin-lyrics'] });
      toast.success('Lyric added!');
    },
    onError: (err) => toast.error(err.message || 'Failed to add lyric'),
  });

  // Unified update for lyrics (quotesApi.update reused — adjust if you have lyricsApi.update)
  const updateLyricMut = useMutation({
    mutationFn: ({ id, data }) => quotesApi.update(id, data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['admin-lyrics'] });
      toast.success('Lyric updated!');
    },
    onError: (err) => toast.error(err.message || 'Failed to update lyric'),
  });

  const deleteMut = useMutation({
    mutationFn: ({ id, type }) =>
      type === 'lyric' ? lyricsApi.delete(id) : quotesApi.delete(id),
    onSuccess: (_, { type }) => {
      qc.invalidateQueries({ queryKey: [type === 'lyric' ? 'admin-lyrics' : 'admin-quotes'] });
      toast.success('Deleted');
    },
    onError: (err) => toast.error(err.message || 'Failed to delete'),
  });

  const approveMut = useMutation({
    mutationFn: (id) => quotesApi.update(id, { status: 'approved' }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['admin-quotes'] });
      toast.success('Approved!');
    },
    onError: (err) => toast.error(err.message || 'Failed to approve'),
  });

  const rejectMut = useMutation({
    mutationFn: (id) => quotesApi.update(id, { status: 'rejected' }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['admin-quotes'] });
      toast.error('Rejected');
    },
    onError: (err) => toast.error(err.message || 'Failed to reject'),
  });

  /* ════════════════════════════════════════════════════════════
     DERIVED DATA
  ════════════════════════════════════════════════════════════ */
  const isLyricTab = activeTab === 'lyrics';
  const rawItems   = isLyricTab ? lyrics : quotes;

  const userItems = useMemo(() =>
    selectedUser
      ? rawItems.filter(q => q.userId === selectedUser.uid || q.authorId === selectedUser.uid)
      : rawItems,
  [rawItems, selectedUser]);

  const filtered = useMemo(() => userItems.filter(q => {
    const text = q.text?.toLowerCase() ?? '';
    const auth = (q.author ?? q.artist ?? '').toLowerCase();
    const ms   = !search || text.includes(search.toLowerCase()) || auth.includes(search.toLowerCase());
    const mst  = isLyricTab || statusFilter === 'all' || q.status === statusFilter;
    const mcat = catFilter === 'all' || (isLyricTab ? q.genre === catFilter : q.category === catFilter);
    return ms && mst && mcat;
  }), [userItems, search, statusFilter, catFilter, isLyricTab]);

  const paginated = useMemo(() => {
    const s = (page - 1) * PAGE_SIZE;
    return filtered.slice(s, s + PAGE_SIZE);
  }, [filtered, page]);

  const stats = useMemo(() => {
    const base = selectedUser
      ? quotes.filter(q => q.userId === selectedUser.uid || q.authorId === selectedUser.uid)
      : quotes;
    return {
      total:    base.length,
      approved: base.filter(q => q.status === 'approved').length,
      pending:  base.filter(q => q.status === 'pending').length,
      today:    base.filter(q => isToday(q.createdAt)).length,
      week:     base.filter(q => isWeek(q.createdAt)).length,
      lyrics:   selectedUser
        ? lyrics.filter(l => l.userId === selectedUser.uid || l.authorId === selectedUser.uid).length
        : lyrics.length,
    };
  }, [quotes, lyrics, selectedUser]);

  const catOptions = useMemo(() => {
    const all = isLyricTab
      ? [...new Set(lyrics.map(l => l.genre).filter(Boolean))]
      : [...new Set(quotes.map(q => q.category).filter(Boolean))];
    return all;
  }, [quotes, lyrics, isLyricTab]);

  /* ════════════════════════════════════════════════════════════
     HANDLERS
  ════════════════════════════════════════════════════════════ */
  const openAddQuote = () => { setEditingItem(null); setQuoteModalOpen(true); };
  const openAddLyric = () => { setEditingItem(null); setLyricModalOpen(true); };

  const openEdit = (item) => {
    setEditingItem(item);
    if (isLyricTab) setLyricModalOpen(true);
    else setQuoteModalOpen(true);
  };

  const handleQuoteSave = async (data) => {
    if (editingItem) {
      await updateQuoteMut.mutateAsync({ id: editingItem.id, data });
    } else {
      await createQuoteMut.mutateAsync(data);
    }
    setQuoteModalOpen(false);
    setEditingItem(null);
  };

  const handleLyricSave = async (data) => {
    if (editingItem) {
      await updateLyricMut.mutateAsync({ id: editingItem.id, data });
    } else {
      await createLyricMut.mutateAsync(data);
    }
    setLyricModalOpen(false);
    setEditingItem(null);
  };

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Delete permanently?')) return;
    await deleteMut.mutateAsync({ id, type: isLyricTab ? 'lyric' : 'quote' });
  }, [deleteMut, isLyricTab]);

  const handleApprove = useCallback((id) => approveMut.mutate(id), [approveMut]);
  const handleReject  = useCallback((id) => rejectMut.mutate(id),  [rejectMut]);

  /* ── Tab button ── */
  const TabBtn = ({ id, label, icon: Icon, count }) => {
    const active = activeTab === id;
    return (
      <button onClick={() => setActiveTab(id)} style={{
        display:'flex', alignItems:'center', gap:7,
        padding:'7px 16px', borderRadius:10, border:'none', cursor:'pointer',
        fontFamily:'inherit', fontSize:12, fontWeight:600, transition:'all 0.15s',
        background: active ? T.surface3 : 'transparent',
        color: active ? T.t1 : T.t3,
      }}>
        <Icon size={13}/> {label}
        <span style={{
          fontSize:10, padding:'1px 6px', borderRadius:8,
          background: active ? `${T.amber}25` : T.surface3,
          color: active ? T.amber : T.t3,
        }}>{count}</span>
      </button>
    );
  };

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif", color:T.t1 }}>

      {/* ── Header with two CTAs ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:17, fontWeight:700, margin:0, letterSpacing:'-0.3px' }}>Content Manager</h2>
          <p style={{ fontSize:11, color:T.t3, margin:'3px 0 0' }}>Quotes &amp; lyrics — moderation and curation</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <motion.button
            whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
            onClick={openAddQuote}
            style={{
              display:'flex', alignItems:'center', gap:7,
              background:`linear-gradient(135deg,${T.amber},${T.amber2})`,
              border:'none', borderRadius:20, padding:'9px 16px',
              fontSize:12, fontWeight:700, color:'#111', cursor:'pointer', fontFamily:'inherit',
            }}
          >
            <FiPlus size={12}/> Add Quote
          </motion.button>
          <motion.button
            whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
            onClick={openAddLyric}
            style={{
              display:'flex', alignItems:'center', gap:7,
              background:`linear-gradient(135deg,${T.purple},${T.indigo})`,
              border:'none', borderRadius:20, padding:'9px 16px',
              fontSize:12, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit',
            }}
          >
            <FiMusic size={12}/> Add Lyric
          </motion.button>
        </div>
      </div>

      {/* ── User selector ── */}
      <div style={{ marginBottom:16, position:'relative', zIndex:300 }}>
        <Label>Filter by user</Label>
        <UserSelector users={users} selected={selectedUser} onSelect={setSelectedUser} forceClose={quoteModalOpen || lyricModalOpen} />
      </div>

      {/* ── Stats ── */}
      <div style={{
        display:'grid',
        gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)',
        gap:10, marginBottom:16,
      }}>
        <StatCard label="Total quotes"   value={stats.total}    color={T.indigo} icon={FiFileText}     delay={0}   />
        <StatCard label="Approved"       value={stats.approved} color={T.green}  icon={FiCheck}        delay={0.05}/>
        <StatCard label="Pending review" value={stats.pending}  color={T.amber}  icon={FiAlertCircle}  delay={0.1} />
        <StatCard label="Posted today"   value={stats.today}    color={T.teal}   icon={FiCalendar}     delay={0.15}/>
        <StatCard label="This week"      value={stats.week}     color={T.purple} icon={FiTrendingUp}   delay={0.2} />
        <StatCard label="Lyrics"         value={stats.lyrics}   color={T.coral}  icon={FiMusic}        delay={0.25}/>
      </div>

      {/* ── Tab nav ── */}
      <div style={{
        display:'flex', gap:3, background:T.surface, border:`1px solid ${T.border}`,
        borderRadius:12, padding:4, marginBottom:16, width:'fit-content',
      }}>
        <TabBtn id="quotes" label="Quotes" icon={FiBookOpen} count={quotes.length}/>
        <TabBtn id="lyrics" label="Lyrics" icon={FiMusic}    count={lyrics.length}/>
      </div>

      {/* ── Filters ── */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
        <div style={{ position:'relative', flex:'1 1 200px' }}>
          <FiSearch size={12} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:T.t3 }}/>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search text or author…"
            style={{ ...inputStyle, paddingLeft:34, borderRadius:20 }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
              background:'none', border:'none', cursor:'pointer', color:T.t3,
            }}><FiX size={12}/></button>
          )}
        </div>
        {!isLyricTab && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ ...inputStyle, width:'auto', borderRadius:20, padding:'9px 14px', cursor:'pointer' }}>
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        )}
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ ...inputStyle, width:'auto', borderRadius:20, padding:'9px 14px', cursor:'pointer' }}>
          <option value="all">All {isLyricTab ? 'genres' : 'categories'}</option>
          {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* ── Result count ── */}
      <div style={{ fontSize:11, color:T.t3, marginBottom:10 }}>
        {filtered.length} {isLyricTab ? 'lyrics' : 'quotes'}
        {selectedUser && ` by ${selectedUser.displayName || selectedUser.email}`}
        {search && ` matching "${search}"`}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:48, color:T.t3, gap:10 }}>
          <FiRefreshCw size={16} style={{ animation:'spin 1s linear infinite' }}/> Loading…
        </div>
      ) : quotesErr ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'40px 20px', background:T.surface, border:`1px solid ${T.red}20`, borderRadius:16, textAlign:'center' }}>
          <FiAlertCircle size={20} style={{ color:T.red }}/>
          <p style={{ fontSize:13, color:T.t2 }}>Failed to load. Please refresh.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'48px 20px', background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, textAlign:'center' }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <FiBookOpen size={18} style={{ color:T.t3 }}/>
          </div>
          <p style={{ fontSize:13, color:T.t2 }}>
            {search ? `No results for "${search}"` : `No ${isLyricTab ? 'lyrics' : 'quotes'} found`}
          </p>
          <button
            onClick={isLyricTab ? openAddLyric : openAddQuote}
            style={{ marginTop:4, padding:'8px 18px', borderRadius:20, background:T.amber, border:'none', color:'#111', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}
          >
            + Add {isLyricTab ? 'lyric' : 'quote'}
          </button>
        </div>
      ) : isMobile ? (
        <div>
          <AnimatePresence>
            {paginated.map(item => (
              <QuoteRow key={item.id} item={item} type={isLyricTab ? 'lyric' : 'quote'}
                onEdit={openEdit} onDelete={handleDelete}
                onApprove={handleApprove} onReject={handleReject}
                isMobile={true}/>
            ))}
          </AnimatePresence>
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage}/>
        </div>
      ) : (
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:580 }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                  {['Text', 'Author', isLyricTab ? 'Genre' : 'Category', ...(!isLyricTab ? ['Status'] : []), 'Actions'].map(h => (
                    <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:T.t3 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(item => (
                  <QuoteRow key={item.id} item={item} type={isLyricTab ? 'lyric' : 'quote'}
                    onEdit={openEdit} onDelete={handleDelete}
                    onApprove={handleApprove} onReject={handleReject}
                    isMobile={false}/>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage}/>
        </div>
      )}

      {/* ── Modals ── */}
      <QuoteModal
        isOpen={quoteModalOpen}
        onClose={() => { setQuoteModalOpen(false); setEditingItem(null); }}
        onSave={handleQuoteSave}
        initialData={editingItem}
        categories={categories}
      />

      <AddLyricModal
        isOpen={lyricModalOpen}
        onClose={() => { setLyricModalOpen(false); setEditingItem(null); }}
        onSave={handleLyricSave}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-lyrics'] })}
        initialData={editingItem}
      />
    </div>
  );
}