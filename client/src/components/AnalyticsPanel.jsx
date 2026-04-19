/**
 * AnalyticsPanel.jsx — fetches real data from your API
 */
import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { adminApi, quotesApi } from '../utils/api';

/* ── Design tokens ─────────────────────────────────────────── */
const T = {
  bg:        '#0B0E14',
  surface:   '#111620',
  surface2:  '#161B26',
  surface3:  '#1C2230',
  border:    'rgba(255,255,255,0.07)',
  border2:   'rgba(255,255,255,0.12)',
  text1:     '#E8EAF0',
  text2:     'rgba(232,234,240,0.55)',
  text3:     'rgba(232,234,240,0.28)',
  indigo:    '#818CF8',
  teal:      '#2DD4BF',
  amber:     '#F59E0B',
  green:     '#34D399',
  red:       '#F87171',
  purple:    '#A78BFA',
  coral:     '#FB7185',
};

const card = (extra = {}) => ({
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  padding: '18px 20px',
  ...extra,
});

const labelStyle = {
  fontSize: 10, fontWeight: 700,
  letterSpacing: '0.12em', textTransform: 'uppercase',
  color: T.text3, marginBottom: 10, display: 'block',
};

/* ── Timestamp helper ───────────────────────────────────────── */
const toMs = (ts) => {
  if (!ts) return 0;
  if (ts?.toDate)   return ts.toDate().getTime();
  if (ts?._seconds) return ts._seconds * 1000;
  if (ts?.seconds)  return ts.seconds * 1000;
  const d = new Date(ts);
  return isNaN(d) ? 0 : d.getTime();
};

/* ── Data derivation helpers ────────────────────────────────── */

// Build 8-week cumulative growth from users array
const buildGrowth = (users = []) => {
  const now = Date.now();
  return Array.from({ length: 8 }, (_, i) => {
    const weekEnd   = now - (7 - i) * 7 * 86400000;
    const count     = users.filter(u => toMs(u.createdAt) <= weekEnd).length;
    return { week: `W${i + 1}`, users: count };
  });
};

// Build daily signups + approvals for last 7 days from audit logs
const buildDailyActivity = (logs = []) => {
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const now  = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d     = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const label = DAYS[d.getDay()];
    const dateStr = d.toDateString();
    const signups   = logs.filter(l => l.event === 'user_registered'  && new Date(toMs(l.timestamp || l.createdAt)).toDateString() === dateStr).length;
    const approvals = logs.filter(l => l.event === 'user_approved'    && new Date(toMs(l.timestamp || l.createdAt)).toDateString() === dateStr).length;
    return { day: label, signups, approvals };
  });
};

// Role distribution from users
const buildRoleDistribution = (users = []) => [
  { name: 'User',  value: users.filter(u => u.role === 'user').length,  color: T.teal   },
  { name: 'Admin', value: users.filter(u => u.role === 'admin').length, color: T.indigo },
  { name: 'Guest', value: users.filter(u => u.role === 'guest').length, color: T.border2},
];

// Recent events from audit logs
const buildRecentEvents = (logs = []) => {
  const colorMap = {
    user_approved:    T.green,
    user_registered:  T.teal,
    user_suspended:   T.red,
    write_granted:    T.indigo,
    write_revoked:    T.amber,
    login_failed:     T.amber,
    user_reactivated: T.green,
    role_changed:     T.purple,
  };
  const timeAgo = (ts) => {
    const m = Math.floor((Date.now() - toMs(ts)) / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };
  return [...logs]
    .sort((a, b) => toMs(b.timestamp || b.createdAt) - toMs(a.timestamp || a.createdAt))
    .slice(0, 5)
    .map((l, i) => ({
      id:    i,
      type:  l.event,
      text:  `${l.event.replace(/_/g, ' ')}${l.metadata?.email ? ` — ${l.metadata.email}` : ''}`,
      time:  timeAgo(l.timestamp || l.createdAt),
      color: colorMap[l.event] ?? T.text3,
    }));
};

// Period filter helper
const filterByPeriod = (items, period, tsKey = 'createdAt') => {
  const ms = { '24h': 86400000, '7d': 7*86400000, '30d': 30*86400000, '90d': 90*86400000 }[period] ?? 7*86400000;
  return items.filter(i => Date.now() - toMs(i[tsKey]) <= ms);
};

/* ── Sub-components ─────────────────────────────────────────── */
function Counter({ target, suffix = '', decimals = 0 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p    = Math.min((ts - start) / 900, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(+(target * ease).toFixed(decimals));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, decimals]);
  return <>{val.toLocaleString()}{suffix}</>;
}

function KPICard({ label, value, change, suffix = '', decimals = 0, accent, delay = 0 }) {
  const up    = change > 0;
  const flat  = change === 0;
  const color = flat ? T.text3 : up ? T.green : T.red;
  const arrow = flat ? '→' : up ? '↑' : '↓';
  return (
    <div style={{ ...card({ padding:'16px 18px' }), animation:`apFadeUp 0.4s ${delay}ms both ease`, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${accent}60,transparent)`, borderRadius:'16px 16px 0 0' }}/>
      <span style={labelStyle}>{label}</span>
      <div style={{ fontSize:28, fontWeight:600, color:T.text1, letterSpacing:'-0.5px', lineHeight:1 }}>
        <Counter target={value} suffix={suffix} decimals={decimals}/>
      </div>
      {change !== undefined && (
        <div style={{ fontSize:11, color, marginTop:7, display:'flex', alignItems:'center', gap:4 }}>
          <span>{arrow} {Math.abs(change)}{suffix === '%' ? 'pp' : flat ? '' : '%'}</span>
          <span style={{ color:T.text3 }}>vs last period</span>
        </div>
      )}
    </div>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:T.surface3, border:`1px solid ${T.border2}`, borderRadius:10, padding:'9px 13px', fontSize:12, color:T.text1 }}>
      <div style={{ color:T.text3, fontSize:10, marginBottom:5 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}>
          <span style={{ width:8, height:8, borderRadius:2, background:p.color, flexShrink:0 }}/>
          <span style={{ color:T.text2 }}>{p.name}:</span>
          <span style={{ fontWeight:600, fontFamily:'monospace' }}>{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function Legend({ color, label, value }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <span style={{ width:10, height:10, borderRadius:2, background:color, flexShrink:0 }}/>
      <span style={{ fontSize:11, color:T.text2 }}>{label}</span>
      {value && <span style={{ fontSize:11, color:T.text3, fontFamily:'monospace' }}>{value}</span>}
    </div>
  );
}

function PeriodSelector({ options, active, onChange }) {
  return (
    <div style={{ display:'flex', gap:3, background:T.surface2, borderRadius:10, padding:3 }}>
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)} style={{
          padding:'4px 10px', borderRadius:8, border:'none', cursor:'pointer',
          fontSize:11, fontWeight:600, fontFamily:'inherit', transition:'all 0.15s',
          background: active === o ? T.surface3 : 'transparent',
          color:      active === o ? T.text1    : T.text3,
        }}>{o}</button>
      ))}
    </div>
  );
}

function Skeleton({ height = 180 }) {
  return (
    <div style={{ height, borderRadius:10, background:'rgba(255,255,255,0.04)', animation:'apPulse 1.5s infinite' }}/>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function AnalyticsPanel() {
  const [period, setPeriod] = useState('7d');

  /* ── keyframes ── */
  useEffect(() => {
    if (document.getElementById('ap-keyframes')) return;
    const s = document.createElement('style');
    s.id = 'ap-keyframes';
    s.textContent = `
      @keyframes apFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      @keyframes apPulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
      .ap-kpi-grid   { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:14px; }
      .ap-chart-row  { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
      @media(max-width:900px){
        .ap-chart-row { grid-template-columns:1fr; }
        .ap-kpi-grid  { grid-template-columns:repeat(2,1fr); }
      }
    `;
    document.head.appendChild(s);
  }, []);

  /* ════════════════════════════════════════════════════════════
     DATA FETCHING
  ════════════════════════════════════════════════════════════ */
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn:  adminApi.getStats,
    select:   (res) => res?.stats ?? res,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn:  adminApi.listUsers,
    select:   (res) => res?.users ?? res ?? [],
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['admin-logs', 200],
    queryFn:  () => adminApi.getAuditLogs({ limit: 200 }),
    select:   (res) => res?.logs ?? res ?? [],
  });

  const { data: quotesData } = useQuery({
    queryKey: ['admin-quotes'],
    queryFn:  quotesApi.getAll,
    select:   (res) => res?.quotes ?? res ?? [],
  });

  const users  = usersData  ?? [];
  const logs   = logsData   ?? [];
  const quotes = quotesData ?? [];
  const stats  = statsData  ?? {};
  const loading = statsLoading || usersLoading || logsLoading;

  /* ════════════════════════════════════════════════════════════
     DERIVED ANALYTICS  (all computed from real data)
  ════════════════════════════════════════════════════════════ */
  const periodUsers = useMemo(() => filterByPeriod(users, period), [users, period]);
  const periodLogs  = useMemo(() => filterByPeriod(logs,  period, 'timestamp'), [logs, period]);
  const prevUsers   = useMemo(() => {
    const ms  = { '24h':86400000,'7d':7*86400000,'30d':30*86400000,'90d':90*86400000 }[period];
    return users.filter(u => {
      const age = Date.now() - toMs(u.createdAt);
      return age > ms && age <= ms * 2;
    });
  }, [users, period]);

  const kpis = useMemo(() => {
    const total     = users.length;
    const newCount  = periodUsers.length;
    const prevCount = prevUsers.length;
    const approved  = users.filter(u => u.status === 'active').length;
    const approvalRate  = total ? Math.round((approved / total) * 100) : 0;
    const suspended     = users.filter(u => u.status === 'suspended').length;
    const churnRate     = total ? +((suspended / total) * 100).toFixed(1) : 0;
    return {
      totalUsers:        total,
      totalUsersChange:  newCount,
      newSignups:        newCount,
      newSignupsChange:  newCount - prevCount,
      approvalRate,
      approvalRateChange: stats?.approvalRateChange ?? 0,
      churnRate,
      churnRateChange:   stats?.churnRateChange ?? 0,
    };
  }, [users, periodUsers, prevUsers, stats]);

  const growth          = useMemo(() => buildGrowth(users),            [users]);
  const dailyActivity   = useMemo(() => buildDailyActivity(logs),      [logs]);
  const roleDistribution= useMemo(() => buildRoleDistribution(users),  [users]);
  const recentEvents    = useMemo(() => buildRecentEvents(logs),        [logs]);

  // Signup sources — derived from logs event types
  const signupSources = useMemo(() => {
    const direct = logs.filter(l => l.event === 'user_registered' && !l.metadata?.source).length;
    const invite  = logs.filter(l => l.metadata?.source === 'invite').length;
    const sso     = logs.filter(l => l.metadata?.source === 'sso').length;
    const api     = logs.filter(l => l.metadata?.source === 'api').length;
    const total   = Math.max(direct + invite + sso + api, 1);
    return [
      { source:'Direct',      count: direct || users.length, color:T.indigo },
      { source:'Invite link', count: invite,                 color:T.teal   },
      { source:'SSO',         count: sso,                    color:T.purple },
      { source:'API',         count: api,                    color:T.amber  },
    ].filter(s => s.count > 0);
  }, [logs, users]);

  const totalSources = signupSources.reduce((s, x) => s + x.count, 0);

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <section style={{ fontFamily:"'DM Sans',system-ui,sans-serif", color:T.text1 }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:15, fontWeight:600, color:T.text1, margin:0, letterSpacing:'-0.2px' }}>Analytics</h2>
          <p style={{ fontSize:11, color:T.text3, margin:'3px 0 0' }}>Workspace growth &amp; user behaviour</p>
        </div>
        <PeriodSelector options={['24h','7d','30d','90d']} active={period} onChange={setPeriod}/>
      </div>

      {/* ── KPI Row ── */}
      <div className="ap-kpi-grid">
        <KPICard label="Total users"   value={kpis.totalUsers}    change={kpis.totalUsersChange}    accent={T.indigo} delay={0}  />
        <KPICard label="New signups"   value={kpis.newSignups}    change={kpis.newSignupsChange}    accent={T.teal}   delay={60} />
        <KPICard label="Approval rate" value={kpis.approvalRate}  change={kpis.approvalRateChange}  suffix="%" accent={T.green} delay={120}/>
        <KPICard label="Churn rate"    value={kpis.churnRate}     change={kpis.churnRateChange}     suffix="%" decimals={1} accent={T.amber} delay={180}/>
      </div>

      {/* ── Chart Row 1: Growth + Sources ── */}
      <div className="ap-chart-row" style={{ marginBottom:14 }}>

        <div style={{ ...card(), animation:'apFadeUp 0.4s 220ms both ease' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <span style={labelStyle}>User growth</span>
            <span style={{ fontSize:10, color:T.text3, fontFamily:'monospace' }}>cumulative · 8 weeks</span>
          </div>
          {loading ? <Skeleton height={180}/> : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={growth} margin={{ top:4, right:4, left:-18, bottom:0 }}>
                <defs>
                  <linearGradient id="apGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={T.indigo} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={T.indigo} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                <XAxis dataKey="week" tick={{ fill:T.text3, fontSize:10 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill:T.text3, fontSize:10 }} axisLine={false} tickLine={false} domain={['auto','auto']}/>
                <Tooltip content={<ChartTip/>} cursor={{ stroke:'rgba(129,140,248,0.2)', strokeWidth:1 }}/>
                <Area type="monotone" dataKey="users" name="Users" stroke={T.indigo} strokeWidth={2}
                  fill="url(#apGrowthGrad)" dot={{ fill:T.indigo, r:3, strokeWidth:0 }}
                  activeDot={{ r:5, fill:T.indigo, stroke:T.surface3, strokeWidth:2 }}/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ ...card(), animation:'apFadeUp 0.4s 280ms both ease' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <span style={labelStyle}>Signup sources</span>
            <span style={{ fontSize:10, color:T.text3, fontFamily:'monospace' }}>{totalSources} total</span>
          </div>
          {loading ? <Skeleton height={140}/> : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={signupSources} layout="vertical" margin={{ top:0, right:8, left:0, bottom:0 }} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false}/>
                  <XAxis type="number" tick={{ fill:T.text3, fontSize:10 }} axisLine={false} tickLine={false}/>
                  <YAxis type="category" dataKey="source" tick={{ fill:T.text2, fontSize:11 }} axisLine={false} tickLine={false} width={76}/>
                  <Tooltip content={<ChartTip/>} cursor={{ fill:'rgba(255,255,255,0.03)' }}/>
                  <Bar dataKey="count" name="Signups" radius={[0,6,6,0]}>
                    {signupSources.map((s, i) => <Cell key={i} fill={s.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 16px', marginTop:14 }}>
                {signupSources.map(s => (
                  <Legend key={s.source} color={s.color} label={s.source}
                    value={`${Math.round((s.count / totalSources) * 100)}%`}/>
                ))}
              </div>
            </>
          )}
        </div>

      </div>

      {/* ── Chart Row 2: Daily Activity + Role Doughnut ── */}
      <div className="ap-chart-row" style={{ marginBottom:14 }}>

        <div style={{ ...card(), animation:'apFadeUp 0.4s 340ms both ease' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:8 }}>
            <span style={labelStyle}>Daily activity</span>
            <div style={{ display:'flex', gap:12 }}>
              <Legend color={T.teal}  label="Signups"  />
              <Legend color={T.indigo} label="Approvals"/>
            </div>
          </div>
          {loading ? <Skeleton height={170}/> : (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={dailyActivity} margin={{ top:4, right:4, left:-18, bottom:0 }} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                <XAxis dataKey="day" tick={{ fill:T.text3, fontSize:10 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill:T.text3, fontSize:10 }} axisLine={false} tickLine={false}/>
                <Tooltip content={<ChartTip/>} cursor={{ fill:'rgba(255,255,255,0.03)' }}/>
                <Bar dataKey="signups"   name="Signups"   fill={T.teal}   radius={[4,4,0,0]} barSize={14}/>
                <Bar dataKey="approvals" name="Approvals" fill={T.indigo} radius={[4,4,0,0]} barSize={14}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ ...card(), animation:'apFadeUp 0.4s 400ms both ease', display:'flex', flexDirection:'column' }}>
          <span style={labelStyle}>Role distribution</span>
          {loading ? <Skeleton height={150}/> : (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'space-around', flexWrap:'wrap', gap:16 }}>
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie data={roleDistribution} dataKey="value" cx="50%" cy="50%"
                    innerRadius={42} outerRadius={68} strokeWidth={0} paddingAngle={3}>
                    {roleDistribution.map((r, i) => <Cell key={i} fill={r.color}/>)}
                  </Pie>
                  <Tooltip content={<ChartTip/>}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {roleDistribution.map(r => (
                  <div key={r.name} style={{ display:'flex', alignItems:'center', gap:9 }}>
                    <span style={{ width:10, height:10, borderRadius:3, background:r.color, flexShrink:0 }}/>
                    <span style={{ fontSize:12, color:T.text2, minWidth:44 }}>{r.name}</span>
                    <span style={{ fontSize:13, fontWeight:600, color:T.text1, fontFamily:'monospace' }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Recent events ── */}
      <div style={{ ...card(), animation:'apFadeUp 0.4s 460ms both ease' }}>
        <span style={labelStyle}>Recent highlights</span>
        {loading ? <Skeleton height={120}/> : recentEvents.length === 0 ? (
          <p style={{ fontSize:12, color:T.text3, textAlign:'center', padding:'20px 0' }}>No recent activity</p>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {recentEvents.map((e, i) => (
              <div key={e.id} style={{
                display:'flex', alignItems:'center', gap:14, padding:'10px 0',
                borderBottom: i < recentEvents.length - 1 ? `1px solid ${T.border}` : 'none',
              }}>
                <div style={{ position:'relative', flexShrink:0, width:20, display:'flex', justifyContent:'center' }}>
                  <div style={{
                    width:8, height:8, borderRadius:'50%', background:e.color,
                    boxShadow:`0 0 8px ${e.color}66`,
                    animation: i === 0 ? 'apPulse 2s infinite' : 'none',
                  }}/>
                </div>
                <span style={{ flex:1, fontSize:12, color:T.text2 }}>{e.text}</span>
                <span style={{ fontSize:10, color:T.text3, fontFamily:'monospace', flexShrink:0 }}>{e.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </section>
  );
}