/**
 * pages/AdminPanel.jsx
 * ═══════════════════════════════════════════════════════════════
 * Admin-only control centre.
 *
 * TABS (URL-driven: ?tab=overview)
 * ───────────────────────────────────────────────────────────────
 *  overview  — stats, role/status breakdown, quick approval list
 *  queue     — users awaiting admin approval
 *  users     — full user list with search, filter, inline actions
 *  logs      — audit log with configurable limit
 *
 * MODALS (external files — easy to extend)
 * ───────────────────────────────────────────────────────────────
 *  CreateAdminModal  ← components/modals/CreateAdminModal.jsx
 *  CreateUserModal   ← components/modals/CreateUserModal.jsx
 *
 * API
 * ───────────────────────────────────────────────────────────────
 *  All calls via adminApi from utils/api.js
 *  — auto Firebase token, CSRF header, ApiError shape
 * ═══════════════════════════════════════════════════════════════
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams }  from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence }             from 'framer-motion';
import { signOut }                             from 'firebase/auth';
import { auth }                                from '../config/firebase';
import { adminApi }                            from '../utils/api';
import { useAuth }                             from '../context/AuthContext';
import useRole                                 from '../hooks/useRole';
import toast                                   from 'react-hot-toast';

/* ── external modals ─────────────────────────────────────────── */
import CreateAdminModal from '../components/CreateAdminModal';
import CreateUserModal  from '../components/CreateUserModal';
import UserDetailPanel  from '../components/UserDetailPanel';
import UserRow from '../components/UserRow';

import {
  FiUsers, FiCheckCircle, FiShield, FiActivity, FiSearch,
  FiFilter, FiMoreVertical, FiX, FiHome, FiBookOpen,
  FiClock, FiAlertTriangle, FiLock, FiUnlock, FiRefreshCw,
  FiZap, FiChevronDown, FiLogOut, FiUserPlus, FiCheck,
  FiAlertCircle, FiArrowRight, FiSlash, FiGrid,
} from 'react-icons/fi';

/* ── design tokens ───────────────────────────────────────────── */
const C = {
  navy:   '#0A0E1A',
  slate:  '#141924',
  mid:    '#0D1220',
  amber:  '#F59E0B',
  orange: '#F97316',
  indigo: '#818CF8',
  green:  '#4ade80',
  red:    '#f87171',
  teal:   '#34D399',
  cyan:   '#38BDF8',
};

const ROLE_CFG = {
  admin: { color: C.indigo, bg: 'rgba(129,140,248,0.12)' },
  user:  { color: C.teal,   bg: 'rgba(52,211,153,0.10)'  },
  guest: { color: '#6B7280',bg: 'rgba(107,114,128,0.10)' },
};
const STATUS_CFG = {
  active:    { color: C.green,  bg: 'rgba(74,222,128,0.10)'  },
  awaiting:  { color: C.indigo, bg: 'rgba(129,140,248,0.10)' },
  pending:   { color: C.amber,  bg: `${C.amber}18`           },
  suspended: { color: C.red,    bg: 'rgba(248,113,113,0.10)' },
};

/* ════════════════════════════════════════════════════════════════
   ATOMS
════════════════════════════════════════════════════════════════ */
const Badge = ({ label, cfg }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full
                   text-[9px] font-bold uppercase tracking-wide"
        style={{ color: cfg?.color ?? '#6B7280', background: cfg?.bg ?? 'rgba(107,114,128,0.1)' }}>
    {label}
  </span>
);

const StatCard = ({ label, value, icon: Icon, accent, pulse, i }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.07, duration: 0.28 }}
    className="rounded-2xl border border-white/8 p-5 flex flex-col gap-3 relative overflow-hidden group"
    style={{ background: C.slate }}
  >
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
         style={{ background: `radial-gradient(circle at 20% 20%, ${accent}08, transparent 70%)` }} />
    <div className="flex items-center justify-between">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
           style={{ background: `${accent}18` }}>
        <Icon size={15} style={{ color: accent }} />
      </div>
      {pulse && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: accent }} />}
    </div>
    <div>
      <p className="text-[28px] font-black text-white leading-none tabular-nums">{value ?? '—'}</p>
      <p className="text-[11px] text-white/30 mt-0.5">{label}</p>
    </div>
  </motion.div>
);

const Skeleton = ({ rows = 6 }) => (
  <div className="space-y-1.5">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-[58px] rounded-xl border border-white/5 animate-pulse"
           style={{ background: C.slate, animationDelay: `${i * 55}ms` }} />
    ))}
  </div>
);

/* ── actions dropdown per user row ───────────────────────────── */
const ActionsMenu = ({ user: u, currentUid, onAction, isOpen, onToggle }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onToggle(false); };
    if (isOpen) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [isOpen, onToggle]);

  const btn = (label, Icon, color, action) => (
    <button
      onClick={() => { onAction(action, u.uid); onToggle(false); }}
      className="w-full flex items-center gap-2.5 px-3.5 py-2.5
                 text-[12px] hover:bg-white/8 transition-colors text-left"
      style={{ color }}
    >
      <Icon size={12} />{label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={() => onToggle(!isOpen)}
        className="w-7 h-7 rounded-lg flex items-center justify-center
                   border border-white/8 bg-white/5 hover:bg-white/10
                   text-white/30 hover:text-white/65 transition-all"
      >
        <FiMoreVertical size={12} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.92, y: -4  }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-9 z-30 w-48 rounded-2xl
                       border border-white/10 overflow-hidden"
            style={{ background: '#1C2535', boxShadow: '0 16px 40px rgba(0,0,0,0.55)' }}
          >
            {u.status === 'awaiting' &&
              btn('Approve', FiCheckCircle, C.green, 'approve')}
            {!u.permissions?.write && u.role === 'user' && u.status === 'active' &&
              btn('Grant write', FiUnlock, C.amber, 'grantWrite')}
            {u.permissions?.write && u.role !== 'admin' &&
              btn('Revoke write', FiLock, 'rgba(255,255,255,0.45)', 'revokeWrite')}
            {u.uid !== currentUid && u.role !== 'admin' && u.status !== 'suspended' &&
              btn('Suspend', FiSlash, C.red, 'suspend')}
            {u.status === 'suspended' &&
              btn('Reactivate', FiCheckCircle, C.green, 'reactivate')}
            {u.uid === currentUid && (
              <p className="px-3.5 py-2.5 text-[11px] text-white/20 italic">Your own account</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── user row (used in Queue + Users tabs) ───────────────────── */

/* ── table shell ─────────────────────────────────────────────── */
const TableShell = ({ children }) => (
  <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: C.slate }}>
    <div className="hidden md:grid grid-cols-[2fr_1.6fr_1fr_1fr_auto] gap-4
                    px-4 py-2.5 border-b border-white/6"
         style={{ background: 'rgba(0,0,0,0.18)' }}>
      {['User', 'Email', 'Role', 'Status', ''].map((h, i) => (
        <span key={i} className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/22">{h}</span>
      ))}
    </div>
    <div className="divide-y divide-white/5">{children}</div>
  </div>
);

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════ */
const AdminPanel = () => {
  const { user: me }    = useAuth();
  const { isAdmin }     = useRole();
  const navigate        = useNavigate();
  const qc              = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  /* tabs are URL-driven so they survive refresh */
  const activeTab = searchParams.get('tab') || 'overview';
  const setTab    = t => setSearchParams({ tab: t }, { replace: true });

  /* modal state */
  const [adminModal, setAdminModal] = useState(false);
  const [userModal,  setUserModal]  = useState(false);

  /* list state */
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [logLimit,   setLogLimit]   = useState(50);
  const [openMenu,   setOpenMenu]   = useState(null);

  /* guard */
  useEffect(() => {
    if (!isAdmin) navigate('/dashboard', { replace: true });
  }, [isAdmin]);

  /* ── queries ─────────────────────────────────────────────────── */
  const { data: statsData } = useQuery({
    queryKey: ['adminStats'],
    queryFn:  adminApi.getStats,
    refetchInterval: 30_000,
    enabled: isAdmin,
  });
  const { data: queueData } = useQuery({
    queryKey: ['approvalQueue'],
    queryFn:  adminApi.getQueue,
    refetchInterval: 20_000,
    enabled: isAdmin,
  });
  const { data: usersData, isLoading: usersLoading, error: usersErr } = useQuery({
    queryKey: ['adminUsers', roleFilter],
    queryFn:  () => adminApi.listUsers(roleFilter !== 'all' ? { role: roleFilter } : {}),
    staleTime: 30_000,
    enabled: isAdmin,
  });
  const { data: logsData } = useQuery({
    queryKey: ['auditLogs', logLimit],
    queryFn:  () => adminApi.getAuditLogs({ limit: logLimit }),
    enabled: isAdmin && activeTab === 'logs',
  });

  const stats = statsData?.stats ?? {};
  const queue = queueData?.queue ?? [];
  const users = usersData?.users ?? [];
  const logs  = logsData?.logs   ?? [];

  const [selectedUser, setSelectedUser] = useState(null);

  // Fetch users invalidation
  const fetchUsers = () => {
    qc.invalidateQueries({ queryKey: ['adminUsers'] });
    qc.invalidateQueries({ queryKey: ['approvalQueue'] });
    qc.invalidateQueries({ queryKey: ['adminStats'] });
    qc.invalidateQueries({ queryKey: ['auditLogs'] });
  };

  // Define mutations
  const approveMut = useMutation({
    mutationFn: (uid) => adminApi.approveUser(uid),
    onSuccess: () => { toast.success('User approved');         fetchUsers(); },
    onError:   (err) => toast.error(err.error || 'Approval failed'),
  });

  const grantMut = useMutation({
    mutationFn: (uid) => adminApi.grantWrite(uid),
    onSuccess: () => { toast.success('Write access granted');  fetchUsers(); },
    onError:   (err) => toast.error(err.error || 'Failed to grant write access'),
  });

  const revokeMut = useMutation({
    mutationFn: (uid) => adminApi.revokeWrite(uid),
    onSuccess: () => { toast.success('Write access revoked');  fetchUsers(); },
    onError:   (err) => toast.error(err.error || 'Failed to revoke write access'),
  });

  const suspendMut = useMutation({
    mutationFn: (uid) => adminApi.suspendUser(uid),
    onSuccess: () => { toast.success('User suspended');        fetchUsers(); },
    onError:   (err) => toast.error(err.error || 'Failed to suspend user'),
  });

  const reactivateMut = useMutation({
    mutationFn: (uid) => adminApi.reactivateUser(uid),
    onSuccess: () => { toast.success('User reactivated');      fetchUsers(); },
    onError:   (err) => toast.error(err.error || 'Failed to reactivate user'),
  });

  // Unified action handler – takes action string and user uid
  const handleAction = (action, uid) => {
    const actions = {
      approve: approveMut,
      grantWrite: grantMut,
      revokeWrite: revokeMut,
      suspend: suspendMut,
      reactivate: reactivateMut,
    };
    const mutation = actions[action];
    if (mutation) {
      mutation.mutate(uid);
    }
  };

  /* ── derived ─────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      u.email?.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q) ||
      u.uid?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const mustChange = users.filter(u => u.mustChangePassword).length;

  const TABS = [
    { id: 'overview', label: 'Overview',  icon: FiGrid,     badge: null },
    { id: 'queue',    label: 'Queue',     icon: FiClock,    badge: queue.length || null },
    { id: 'users',    label: 'Users',     icon: FiUsers,    badge: null },
    { id: 'logs',     label: 'Audit',     icon: FiActivity, badge: null },
  ];

  const logDot = ev =>
    ev?.includes('DELETE') || ev?.includes('SUSPEND') ? C.red    :
    ev?.includes('CREATE') || ev?.includes('APPROVE') ? C.green  :
    ev?.includes('LOGIN')                              ? C.cyan   : C.amber;

  /* ─────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen text-white" style={{ background: C.navy }}>

      {/* ambient glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[300px] rounded-full blur-[130px]"
             style={{ background: C.indigo, opacity: 0.06 }} />
        <div className="absolute bottom-0 left-0 w-[320px] h-[320px] rounded-full blur-[100px]"
             style={{ background: C.amber, opacity: 0.04 }} />
      </div>

      {/* ── modals (external files) ─────────────────────────────── */}
      <CreateAdminModal
        isOpen={adminModal}
        onClose={() => setAdminModal(false)}
        onSuccess={fetchUsers}
      />
      <CreateUserModal
        isOpen={userModal}
        onClose={() => setUserModal(false)}
        onSuccess={fetchUsers}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">

          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                   style={{ background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.25)' }}>
                <FiShield size={11} style={{ color: C.indigo }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: C.indigo }}>Admin Panel</span>
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-black tracking-tight text-white leading-none">
              Control Centre
            </h1>
            <p className="text-[11px] text-white/28 mt-1.5">
              {me?.displayName || me?.email}
              {' · '}
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => setUserModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px]
                         font-bold text-gray-950"
              style={{ background: `linear-gradient(to right,${C.amber},${C.orange})` }}>
              <FiUserPlus size={13} />
              <span className="hidden sm:inline">Add user</span>
              <span className="sm:hidden">User</span>
            </motion.button>

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => setAdminModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px]
                         font-bold text-white"
              style={{ background: `linear-gradient(to right,${C.indigo},#6366f1)` }}>
              <FiShield size={13} />
              <span className="hidden sm:inline">Add admin</span>
              <span className="sm:hidden">Admin</span>
            </motion.button>

            <Link to="/"
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/8
                         flex items-center justify-center text-white/35
                         hover:text-white/65 hover:bg-white/8 transition-all"
              title="Home">
              <FiHome size={14} />
            </Link>
            <Link to="/dashboard"
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/8
                         flex items-center justify-center text-white/35
                         hover:text-white/65 hover:bg-white/8 transition-all"
              title="Dashboard">
              <FiBookOpen size={14} />
            </Link>
            <motion.button whileTap={{ scale: 0.94 }}
              onClick={() => signOut(auth).then(() => navigate('/'))}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/8
                         flex items-center justify-center text-white/35
                         hover:text-red-400/70 hover:bg-red-500/8 transition-all"
              title="Sign out">
              <FiLogOut size={13} />
            </motion.button>
          </div>
        </motion.div>

        {/* ── STAT CARDS ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard i={0} label="Total users"       value={stats.total}               icon={FiUsers}       accent={C.indigo} />
          <StatCard i={1} label="Awaiting approval" value={queue.length}              icon={FiClock}       accent={C.amber}  pulse={queue.length > 0} />
          <StatCard i={2} label="Active users"      value={stats.byStatus?.active}    icon={FiCheckCircle} accent={C.green}  />
          <StatCard i={3} label="Need write access" value={stats.awaitingWriteAccess} icon={FiZap}         accent="#FB923C"  />
        </div>

        {/* ── must-change-pw alert ─────────────────────────────────── */}
        <AnimatePresence>
          {mustChange > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-3 p-4 rounded-2xl border
                         border-amber-500/20 overflow-hidden"
              style={{ background: 'rgba(245,158,11,0.06)' }}>
              <FiAlertTriangle size={14} style={{ color: C.amber }} className="mt-0.5 shrink-0" />
              <p className="text-[12px] text-white/55 leading-relaxed">
                <span className="font-bold text-amber-400">
                  {mustChange} admin{mustChange > 1 ? 's have' : ' has'} not changed their temporary password.
                </span>
                {' '}They have restricted access until the password change is complete on first login.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TAB NAV ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px]
                         font-semibold border whitespace-nowrap transition-all shrink-0"
              style={activeTab === t.id
                ? { background: 'rgba(129,140,248,0.14)', borderColor: 'rgba(129,140,248,0.28)', color: C.indigo }
                : { background: 'transparent', borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.33)' }
              }
            >
              <t.icon size={12} />
              {t.label}
              {t.badge ? (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black text-gray-950"
                      style={{ background: C.amber }}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════
            TAB CONTENT
        ════════════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">

          {/* ── OVERVIEW ──────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <motion.div key="overview"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}
              className="space-y-5">

              {/* role + status breakdown */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/8 p-5" style={{ background: C.slate }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/25 mb-4">By role</p>
                  {[
                    { label: 'Admin', val: stats.byRole?.admin, color: C.indigo },
                    { label: 'User',  val: stats.byRole?.user,  color: C.teal   },
                    { label: 'Guest', val: stats.byRole?.guest, color: '#6B7280' },
                  ].map(({ label, val, color }) => {
                    const pct = stats.total ? Math.round(((val ?? 0) / stats.total) * 100) : 0;
                    return (
                      <div key={label} className="flex items-center gap-3 mb-2.5">
                        <span className="text-[11px] text-white/40 w-12 shrink-0">{label}</span>
                        <div className="flex-1 h-1.5 bg-white/6 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="h-full rounded-full" style={{ background: color }} />
                        </div>
                        <span className="text-[10px] text-white/25 tabular-nums w-6 text-right">
                          {val ?? 0}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-white/8 p-5" style={{ background: C.slate }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/25 mb-4">By status</p>
                  {[
                    { label: 'Active',    val: stats.byStatus?.active,    color: C.green   },
                    { label: 'Awaiting',  val: stats.byStatus?.awaiting,  color: C.indigo  },
                    { label: 'Pending',   val: stats.byStatus?.pending,   color: C.amber   },
                    { label: 'Suspended', val: stats.byStatus?.suspended, color: C.red     },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] text-white/40">{label}</span>
                      <span className="text-[13px] font-black tabular-nums" style={{ color }}>
                        {val ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* quick approval queue preview */}
              {queue.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 p-5"
                     style={{ background: 'rgba(245,158,11,0.05)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[12px] font-bold text-amber-400 flex items-center gap-2">
                      <FiClock size={12} />
                      {queue.length} user{queue.length !== 1 ? 's' : ''} awaiting approval
                    </p>
                    <button onClick={() => setTab('queue')}
                      className="text-[11px] text-amber-500/55 hover:text-amber-400
                                 transition-colors flex items-center gap-1">
                      View all <FiArrowRight size={10} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {queue.slice(0, 3).map(u => (
                      <div key={u.uid}
                           className="flex items-center gap-3 p-3 rounded-xl border border-white/6"
                           style={{ background: C.mid }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center
                                        text-[11px] font-black"
                             style={{ background: `${C.amber}18`, color: C.amber }}>
                          {(u.displayName?.[0] || u.email?.[0] || '?').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-white/70 truncate">
                            {u.displayName || u.email}
                          </p>
                          <p className="text-[10px] text-white/25 truncate">{u.email}</p>
                        </div>
                        <motion.button whileTap={{ scale: 0.92 }}
                          onClick={() => approveMut.mutate(u.uid)}
                          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg
                                     text-gray-950 transition-all shrink-0"
                          style={{ background: `linear-gradient(to right,${C.amber},${C.orange})` }}>
                          Approve
                        </motion.button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── QUEUE ─────────────────────────────────────────────── */}
          {activeTab === 'queue' && (
            <motion.div key="queue"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}
              className="space-y-3">
              <p className="text-[12px] text-white/30">
                {queue.length} user{queue.length !== 1 ? 's' : ''} have verified their email
                and are waiting for approval.
              </p>
              {queue.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 rounded-2xl
                                border border-white/6" style={{ background: C.slate }}>
                  <FiCheckCircle size={24} className="text-green-400/50" />
                  <p className="text-[13px] text-white/30">Queue is empty — all caught up!</p>
                </div>
              ) : (
                <TableShell>
                  {queue.map((u, i) => (
                    <UserRow key={u.uid} u={u} idx={i} currentUid={me?.uid}
                      onAction={handleAction} openMenu={openMenu} setOpenMenu={setOpenMenu} />
                  ))}
                </TableShell>
              )}
            </motion.div>
          )}

          {/* ── USERS ─────────────────────────────────────────────── */}
          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="space-y-4"
            >
              {/* filters (same as before) */}
              <div className="flex flex-col sm:flex-row gap-2">
                {/* search input, role filter – unchanged */}
              </div>

              <p className="text-[11px] text-white/22">
                Showing {filtered.length} of {users.length} accounts
              </p>

              {usersLoading ? (
                <Skeleton rows={8} />
              ) : usersErr ? (
                <div className="flex flex-col items-center gap-3 py-14 rounded-2xl border border-red-500/15" style={{ background: 'rgba(248,113,113,0.05)' }}>
                  <FiAlertCircle size={20} className="text-red-400" />
                  <p className="text-[13px] text-red-300">Failed to load users. Please refresh.</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 rounded-2xl border border-white/6" style={{ background: C.slate }}>
                  <FiUsers size={24} className="text-white/14" />
                  <p className="text-[13px] text-white/28">
                    {search ? `No users match "${search}"` : 'No users in this filter.'}
                  </p>
                  {search && (
                    <button onClick={() => setSearch('')} className="text-[12px] text-amber-500/55 hover:text-amber-500 transition-colors">
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/8 overflow-x-auto" style={{ background: C.slate }}>
                  <table className="w-full text-sm min-w-[800px]">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-[10px] font-medium uppercase tracking-wider text-white/40">User</th>
                        <th className="text-left py-3 px-4 text-[10px] font-medium uppercase tracking-wider text-white/40">Role</th>
                        <th className="text-left py-3 px-4 text-[10px] font-medium uppercase tracking-wider text-white/40">Status</th>
                        <th className="text-left py-3 px-4 text-[10px] font-medium uppercase tracking-wider text-white/40">Verified</th>
                        <th className="text-left py-3 px-4 text-[10px] font-medium uppercase tracking-wider text-white/40">Write</th>
                        <th className="text-left py-3 px-4 text-[10px] font-medium uppercase tracking-wider text-white/40">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((user) => (
                        <UserRow
                          key={user.uid}
                          user={user}
                          currentUid={me?.uid}
                          onAction={handleAction}
                          onOpenDetail={(user) => setSelectedUser(user)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <UserDetailPanel
                user={selectedUser}
                isOpen={!!selectedUser}
                onClose={() => setSelectedUser(null)}
                onAction={handleAction}
              />
            </motion.div>
          )}

          {/* ── AUDIT LOGS ────────────────────────────────────────── */}
          {activeTab === 'logs' && (
            <motion.div key="logs"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}
              className="space-y-4">

              <div className="flex items-center justify-between">
                <p className="text-[12px] text-white/30">{logs.length} entries</p>
                <select value={logLimit} onChange={e => setLogLimit(Number(e.target.value))}
                  className="appearance-none px-3 py-1.5 rounded-xl bg-[#141924]
                             border border-white/8 text-[12px] text-white/50
                             focus:outline-none cursor-pointer">
                  {[25, 50, 100, 200].map(n => (
                    <option key={n} value={n} className="bg-[#0D1017]">Last {n}</option>
                  ))}
                </select>
              </div>

              {logs.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-14 rounded-2xl
                                border border-white/6" style={{ background: C.slate }}>
                  <FiActivity size={20} className="text-white/20" />
                  <p className="text-[13px] text-white/28">No audit logs yet.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/8 overflow-hidden"
                     style={{ background: C.slate }}>
                  <div className="divide-y divide-white/5">
                    {logs.map((log, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.012 }}
                        className="flex items-start gap-3 px-4 py-3
                                   hover:bg-white/[0.02] transition-colors">
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                             style={{ background: logDot(log.event) }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-white/68 font-medium">{log.event}</p>
                          <p className="text-[10px] text-white/28 mt-0.5 truncate">
                            {log.userId}
                            {' · '}
                            {new Date(log.timestamp || log.createdAt).toLocaleString('en-KE', {
                              timeZone: 'Africa/Nairobi',
                            })}
                            {log.metadata?.email && ` · ${log.metadata.email}`}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminPanel;