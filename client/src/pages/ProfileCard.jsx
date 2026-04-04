/**
 * pages/ProfileCard.jsx
 * ═══════════════════════════════════════════════════════════════
 * A comprehensive profile page that serves both regular users and admins.
 * Admin: stats, permissions, audit logs, admin actions.
 * User:  profile info, permissions, user actions.
 * Design is clean and modern, with a focus on usability and clarity.
 * This component fetches all necessary data on mount and handles loading states gracefully.
 * The code is organized into smaller components for better readability and maintainability.
 * ═══════════════════════════════════════════════════════════════
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  FiUser, FiActivity, FiShield, FiLock, FiLogOut,
  FiCheck, FiX, FiEdit2, FiChevronRight,
  FiEye, FiTrash2, FiSettings, FiUsers, FiZap,
  FiClock, FiGlobe, FiKey, FiAlertTriangle,
  FiTrendingUp, FiCpu, FiInfo, FiPercent,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import EditProfileModal from '../components/EditProfileModal';

/* ── design tokens (matches EditProfileModal) ───────────────── */
const C = {
  navy:    '#0A0E1A',
  slate:   '#141924',
  mid:     '#0D1220',
  card:    '#1A2235',
  border:  'rgba(255,255,255,0.07)',
  amber:   '#F59E0B',
  orange:  '#F97316',
  indigo:  '#818CF8',
  muted:   'rgba(255,255,255,0.38)',
  dim:     'rgba(255,255,255,0.18)',
  green:   '#34D399',
  red:     '#f87171',
};

/* ── helpers (same as before) ───────────────────────────────── */
const fmtDate = (iso) => iso
  ? new Date(iso).toLocaleDateString('en-KE', { day:'numeric', month:'short', year:'numeric', timeZone:'Africa/Nairobi' })
  : '—';

const fmtTime = (iso) => iso
  ? new Date(iso).toLocaleString('en-KE', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'Africa/Nairobi' })
  : '—';

const fmtTs = (ts) => {
  if (!ts) return '—';
  const ms = ts._seconds ? ts._seconds * 1000 : new Date(ts).getTime();
  return fmtTime(new Date(ms).toISOString());
};

const initials = (name, email) =>
  name ? name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
       : (email?.[0] || '?').toUpperCase();

/* ── badge component ─────────────────────────────────────────── */
const Badge = ({ label, color, bg }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{ color, background: bg }}>
    {label}
  </span>
);

const roleBadge = (role) => ({
  admin: <Badge label="admin" color={C.indigo} bg="rgba(129,140,248,0.15)" />,
  user:  <Badge label="user"  color={C.green}  bg="rgba(52,211,153,0.12)" />,
  guest: <Badge label="guest" color={C.muted}  bg="rgba(148,163,184,0.1)" />,
}[role] || null);

const statusBadge = (status) => ({
  active:    <Badge label="active"    color={C.green}  bg="rgba(52,211,153,0.12)" />,
  awaiting:  <Badge label="awaiting"  color={C.indigo} bg="rgba(129,140,248,0.12)" />,
  suspended: <Badge label="suspended" color={C.red}    bg="rgba(248,113,113,0.12)" />,
  pending:   <Badge label="pending"   color={C.amber}  bg="rgba(245,158,11,0.12)" />,
}[status] || null);

const Perm = ({ label, icon: Icon, granted }) => (
  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border"
       style={{
         background:   granted ? `${C.green}0C` : 'rgba(255,255,255,0.03)',
         borderColor:  granted ? `${C.green}28` : C.border,
       }}>
    <Icon size={11} style={{ color: granted ? C.green : C.muted }} />
    <span className="text-[11px] font-medium" style={{ color: granted ? 'rgba(255,255,255,0.7)' : C.muted }}>
      {label}
    </span>
    <div className="ml-auto">
      {granted ? <FiCheck size={10} style={{ color: C.green }} /> : <FiX size={10} style={{ color: C.muted }} />}
    </div>
  </div>
);

/* ── stat tile ───────────────────────────────────────────────── */
const StatTile = ({ label, value, color }) => (
  <div className="flex flex-col gap-1 p-4 rounded-2xl border"
       style={{ background: 'rgba(255,255,255,0.03)', borderColor: C.border }}>
    <p className="text-[26px] font-black leading-none tabular-nums" style={{ color }}>{value ?? '—'}</p>
    <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: C.muted }}>{label}</p>
  </div>
);

/* ── log color helper ────────────────────────────────────────── */
const logColor = (ev) =>
  !ev ? C.muted :
  ev.includes('LOGIN') ? C.indigo :
  ev.includes('CREATE') ? C.green :
  ev.includes('DELETE') || ev.includes('SUSPEND') ? C.red :
  ev.includes('APPROVE') ? C.green :
  ev.includes('PASSWORD') ? C.amber : C.indigo;

/* ── navigation sections ─────────────────────────────────────── */
const SECTIONS = {
  admin: [
    { id: 'overview', label: 'Overview',    icon: FiUser        },
    { id: 'stats',    label: 'Statistics',  icon: FiTrendingUp  },
    { id: 'perms',    label: 'Permissions', icon: FiShield      },
    { id: 'activity', label: 'Activity',    icon: FiActivity    },
    { id: 'actions',  label: 'Actions',     icon: FiLock        },
  ],
  user: [
    { id: 'overview', label: 'Overview',    icon: FiUser        },
    { id: 'perms',    label: 'Permissions', icon: FiShield      },
    { id: 'actions',  label: 'Actions',     icon: FiLock        },
  ],
};

/* ══════════════════════════════════════════════════════════════
   ENHANCED PANELS
══════════════════════════════════════════════════════════════ */

// Overview panel (common to both) – now with richer content
const OverviewPanel = ({ me, profile, isAdmin }) => {
  const accountCompleteness = 70; // example – you can compute from profile fields
  const hasProfilePic = !!profile?.profileImage;
  const hasBio = !!profile?.bio;
  const hasPhone = !!profile?.phone;
  const completionPercent = 30 + (hasProfilePic ? 20 : 0) + (hasBio ? 20 : 0) + (hasPhone ? 10 : 0);
  return (
    <div className="space-y-6">
      {/* header with avatar and name */}
      <div className="flex flex-wrap gap-6 items-start">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold"
             style={{ background: `linear-gradient(135deg, ${isAdmin ? C.indigo : C.amber}30, ${isAdmin ? C.indigo : C.orange}10)`,
                      border: `1px solid ${isAdmin ? C.indigo : C.amber}40` }}>
          {initials(me?.displayName, me?.email)}
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white">{me?.displayName || (isAdmin ? 'Administrator' : 'Member')}</h2>
          <p className="text-sm text-dim mt-1">{me?.email}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {roleBadge(me?.role)}
            {statusBadge(me?.status)}
            {me?.emailVerified && <Badge label="Verified" color={C.indigo} bg="rgba(129,140,248,0.12)" />}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-dim">User ID</p>
          <p className="text-xs font-mono text-dim">{me?.uid?.slice(0, 8)}...{me?.uid?.slice(-4)}</p>
        </div>
      </div>

      {/* two-column details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1">
            <FiInfo size={12} /> Account Details
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-dim">Member since</span>
              <span className="text-xs text-white">{fmtDate(profile?.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-dim">Last login</span>
              <span className="text-xs text-white">{fmtTime(profile?.lastLogin)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-dim">Status</span>
              <span className="text-xs capitalize text-white">{me?.status}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-dim">Role</span>
              <span className="text-xs capitalize text-white">{me?.role}</span>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1">
            <FiShield size={12} /> Security
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-dim">Email verified</span>
              <span className="text-xs" style={{ color: me?.emailVerified ? C.green : C.red }}>
                {me?.emailVerified ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-dim">Password status</span>
              <span className="text-xs" style={{ color: me?.mustChangePassword ? C.amber : C.green }}>
                {me?.mustChangePassword ? 'Needs change' : 'Up to date'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-dim">2FA</span>
              <span className="text-xs text-dim">Not enabled</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-dim">Admin approved</span>
              <span className="text-xs" style={{ color: me?.adminApproved ? C.green : C.red }}>
                {me?.adminApproved ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* profile completion progress */}
      <div>
        <div className="flex justify-between text-xs text-dim mb-1">
          <span>Profile completion</span>
          <span>{completionPercent}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPercent}%` }}
            transition={{ duration: 0.6 }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(to right, ${C.amber}, ${C.orange})` }}
          />
        </div>
        <p className="text-[10px] text-dim mt-1">
          {completionPercent < 100 ? 'Add a profile picture, bio, and phone number to complete your profile.' : 'Profile complete!'}
        </p>
      </div>

      {/* additional admin note */}
      {isAdmin && (
        <div className="mt-4 p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
          <p className="text-xs text-indigo-400 flex items-center gap-1">
            <FiShield size={12} /> Admin privileges – you have full system access.
          </p>
        </div>
      )}
    </div>
  );
};

// Stats panel (admin only) – add placeholder for chart
const StatsPanel = ({ stats }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 gap-3">
      <StatTile label="Total users" value={stats.total} color={C.indigo} />
      <StatTile label="Active"      value={stats.byStatus?.active}    color={C.green} />
      <StatTile label="Awaiting"    value={stats.awaitingApproval}    color={C.amber} />
      <StatTile label="Need write"  value={stats.awaitingWriteAccess} color={C.orange} />
    </div>
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-3" style={{ color: C.muted }}>
        Role breakdown
      </p>
      {[
        { label: 'Admins', val: stats.byRole?.admin, color: C.indigo },
        { label: 'Users',  val: stats.byRole?.user,  color: C.green },
        { label: 'Guests', val: stats.byRole?.guest, color: C.dim },
      ].map(({ label, val, color }) => {
        const pct = stats.total ? Math.round(((val || 0) / stats.total) * 100) : 0;
        return (
          <div key={label} className="flex items-center gap-3 mt-2">
            <span className="text-[10px] w-12 shrink-0" style={{ color: C.muted }}>{label}</span>
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6 }}
                className="h-full rounded-full" style={{ background: color }}
              />
            </div>
            <span className="text-[10px] tabular-nums w-6 text-right" style={{ color: C.muted }}>{val || 0}</span>
          </div>
        );
      })}
    </div>
    {/* placeholder for chart – could be extended with real data */}
    <div className="mt-4 p-3 rounded-xl border border-white/10 bg-white/5">
      <p className="text-xs text-dim flex items-center gap-1"><FiTrendingUp size={12} /> User growth (coming soon)</p>
    </div>
  </div>
);

// Permissions panel (common) – add note about role inheritance
const PermissionsPanel = ({ permissions, role }) => {
  const permKeys = [
    { label: 'Read',         icon: FiEye,    key: 'read'        },
    { label: 'Write',        icon: FiEdit2,  key: 'write'       },
    { label: 'Delete',       icon: FiTrash2, key: 'delete'      },
    { label: 'Manage Users', icon: FiUsers,  key: 'manageUsers' },
    { label: 'Admin Access', icon: FiShield, key: 'accessAdmin' },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {permKeys.map(p => (
          <Perm key={p.label} {...p} granted={!!permissions[p.key]} />
        ))}
      </div>
      {!permissions.write && (
        <div className="mt-4 flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <FiAlertTriangle size={12} style={{ color: C.amber }} className="mt-0.5 shrink-0" />
          <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(245,158,11,0.8)' }}>
            Write access is pending. An admin will grant it once your account is reviewed.
          </p>
        </div>
      )}
      <div className="mt-4 p-3 rounded-xl border border-white/10 bg-white/5">
        <p className="text-[10px] text-dim flex items-center gap-1">
          <FiInfo size={10} /> Permissions are derived from your role ({role || 'user'}). Admins can grant additional overrides.
        </p>
      </div>
    </div>
  );
};

// Activity panel (admin only) – show more logs (10)
const ActivityPanel = ({ logs }) => {
  const getEventColor = (event) => {
    if (!event) return 'bg-gray-500';
    if (event.includes('LOGIN')) return 'bg-indigo-500';
    if (event.includes('CREATE')) return 'bg-green-500';
    if (event.includes('DELETE')) return 'bg-red-500';
    if (event.includes('SUSPEND')) return 'bg-red-500';
    if (event.includes('APPROVE')) return 'bg-green-500';
    if (event.includes('PASSWORD')) return 'bg-amber-500';
    return 'bg-gray-500';
  };

  if (!logs?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FiActivity size={32} className="text-dim mb-2" />
        <p className="text-sm text-dim">No recent activity</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
        <button className="text-xs text-dim hover:text-white transition">View all logs</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 text-[10px] uppercase tracking-wider font-medium text-dim">Event</th>
              <th className="text-left py-2 text-[10px] uppercase tracking-wider font-medium text-dim">Details</th>
              <th className="text-left py-2 text-[10px] uppercase tracking-wider font-medium text-dim">Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getEventColor(log.event)}`} />
                    <span className="font-medium text-white/80">{log.event || 'Unknown'}</span>
                  </div>
                </td>
                <td className="py-2 text-dim">
                  {log.metadata?.email || log.ip || (log.userId && log.userId !== 'null') ? (
                    <div className="flex flex-wrap gap-1">
                      {log.metadata?.email && <span className="truncate max-w-[180px]">{log.metadata.email}</span>}
                      {log.ip && <span className="font-mono">{log.ip}</span>}
                      {log.userId && log.userId !== 'null' && <span className="font-mono">{log.userId.slice(0, 8)}…</span>}
                    </div>
                  ) : '—'}
                </td>
                <td className="py-2 whitespace-nowrap text-dim">{fmtTs(log.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Actions panel (common) – unchanged
const ActionsPanel = ({ isAdmin, onChangePassword, onLogout }) => (
  <div className="space-y-2">
    <button
      onClick={onChangePassword}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold"
      style={{ background: `linear-gradient(135deg, ${C.amber}, ${C.orange})`, color: C.navy }}
    >
      <FiLock size={12} /> Change password
    </button>
    {isAdmin && (
      <>
        <button
          onClick={() => window.location.href = '/admin'}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold"
          style={{ background: `linear-gradient(135deg, ${C.indigo}, #6366f1)`, color: '#fff' }}
        >
          <FiSettings size={12} /> Admin panel
        </button>
        <button
          onClick={() => window.location.href = '/admin?tab=users'}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', border: `1px solid ${C.border}` }}
        >
          <FiUsers size={12} /> Manage users
        </button>
      </>
    )}
    <button
      onClick={onLogout}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold"
      style={{ background: 'rgba(255,255,255,0.05)', color: C.red, border: `1px solid rgba(248,113,113,0.2)` }}
    >
      <FiLogOut size={12} /> Sign out
    </button>
  </div>
);

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT (unchanged except API limit for logs)
══════════════════════════════════════════════════════════════ */
export default function ProfileCard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [meData, profileData] = await Promise.all([
          fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/users/profile', { credentials: 'include' }).then(r => r.json()),
        ]);
        setMe(meData);
        setProfile(profileData);
        if (meData.role === 'admin') {
          const [statsData, logsData] = await Promise.all([
            fetch('/api/admin/stats', { credentials: 'include' }).then(r => r.json()),
            fetch('/api/admin/audit-logs?limit=10', { credentials: 'include' }).then(r => r.json()), // increased limit
          ]);
          setStats(statsData.stats);
          setLogs(logsData.logs?.slice(0, 10) || []);
        }
      } catch (err) {
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleChangePassword = () => navigate('/auth/change-password');
  const handleLogout = async () => {
    await logout();
    navigate('/auth/login');
  };

  const handleUpdate = (updatedUser, updatedProfile) => {
    setMe(prev => ({ ...prev, ...updatedUser }));
    setProfile(prev => ({ ...prev, ...updatedProfile }));
  };

  // Panel content based on active section
  const renderPanel = () => {
    switch (activeSection) {
      case 'overview':
        return <OverviewPanel me={me} profile={profile} isAdmin={isAdmin} />;
      case 'stats':
        if (!isAdmin) return null;
        return <StatsPanel stats={stats} />;
      case 'perms':
        return <PermissionsPanel permissions={me?.permissions || {}} role={me?.role} />;
      case 'activity':
        if (!isAdmin) return null;
        return <ActivityPanel logs={logs} />;
      case 'actions':
        return <ActionsPanel isAdmin={isAdmin} onChangePassword={handleChangePassword} onLogout={handleLogout} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.navy }}>
        <div className="w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sections = isAdmin ? SECTIONS.admin : SECTIONS.user;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.navy }}>
      {/* ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[100px]"
             style={{ background: isAdmin ? C.indigo : C.amber, opacity: 0.05 }} />
      </div>

      {/* main card – slightly taller to accommodate more content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          width: '100%',
          maxWidth: 860,
          height: 'min(85vh, 680px)', // increased from 620px
          background: C.slate,
          border: `1px solid ${C.border}`,
          borderRadius: 24,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}
      >
        {/* header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <span className="text-lg font-bold text-amber-400">
                {initials(me?.displayName, me?.email)}
              </span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">My Profile</h1>
              <p className="text-xs text-dim">{me?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              style={{ color: C.amber }}
            >
              <FiEdit2 size={14} />
            </button>
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              style={{ color: C.muted }}
            >
              <FiChevronRight size={14} className="rotate-180" />
            </button>
          </div>
        </div>

        {/* body: sidebar + panel */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* sidebar navigation */}
          <nav style={{
            width: 148,
            flexShrink: 0,
            borderRight: `1px solid ${C.border}`,
            padding: '12px 8px',
            background: C.navy,
            overflowY: 'auto',
          }}>
            {sections.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '8px 10px',
                    borderRadius: 10,
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    background: isActive ? `linear-gradient(135deg, ${C.amber}18, ${C.orange}0A)` : 'none',
                    borderLeft: isActive ? `2px solid ${C.amber}` : '2px solid transparent',
                    color: isActive ? C.amber : C.muted,
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = C.border;
                      e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = C.muted;
                    }
                  }}
                >
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* scrollable panel */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.14 }}
              >
                {renderPanel()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        currentUser={me}
        profile={profile}
        onUpdate={handleUpdate}
      />
    </div>
  );
}