import { useState }  from 'react';
import { motion }    from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiClock, FiCheck, FiX, FiRefreshCw, FiTrash2,
         FiBarChart2, FiZap, FiAlertCircle } from 'react-icons/fi';
import { queueApi }  from '../utils/queueApi';
import { toast }     from 'react-hot-toast';

const STATUS_COLOR = {
  pending:  { bg: 'rgba(245,158,11,.12)',  border: 'rgba(245,158,11,.25)',  text: '#F59E0B'  },
  posted:   { bg: 'rgba(52,211,153,.12)',  border: 'rgba(52,211,153,.25)',  text: '#34d399'  },
  failed:   { bg: 'rgba(248,113,113,.12)', border: 'rgba(248,113,113,.25)', text: '#f87171'  },
  retry:    { bg: 'rgba(99,102,241,.12)',  border: 'rgba(99,102,241,.25)',  text: '#818cf8'  },
  skipped:  { bg: 'rgba(107,114,128,.12)', border: 'rgba(107,114,128,.25)', text: '#6b7280'  },
};

const StatusPill = ({ status }) => {
  const c = STATUS_COLOR[status] ?? STATUS_COLOR.skipped;
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      {status}
    </span>
  );
};

const QueueDashboard = () => {
  const qc = useQueryClient();
  const [tab,    setTab]    = useState('queue');
  const [filter, setFilter] = useState('');


  const { data: queueData, isLoading: qLoading, error: qError } = useQuery({
    queryKey: ['queueList'],
    queryFn:  queueApi.list,  // ← no args
    refetchInterval: 30_000,
  });
  console.log('queue items:', queueData?.items, 'error:', qError);

  const { data: analytics } = useQuery({
    queryKey: ['queueAnalytics'],
    queryFn:  queueApi.analytics,
    enabled:  tab === 'analytics',
    refetchInterval: 60_000,
  });

  const { data: slotsData } = useQuery({
    queryKey: ['queueSlots'],
    queryFn:  queueApi.slots,
  });

  const removeMutation = useMutation({
    mutationFn: queueApi.remove,
    onSuccess:  () => {
      toast.success('Removed from queue');
      qc.invalidateQueries({ queryKey: ['queueList'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: queueApi.retry,
    onSuccess:  () => {
      toast.success('Queued for retry');
      qc.invalidateQueries({ queryKey: ['queueList'] });
    },
  });

  const items  = (queueData?.items ?? []).filter(i => filter ? i.status === filter : true);
  const counts = analytics?.counts ?? {};

  return (
    <div className="min-h-screen p-6" style={{ background: '#0A0E1A' }}>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Queue Dashboard</h1>
            <p className="text-white/40 text-sm mt-1">
              Auto-posts 5 quotes/day at AI-optimized times
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <FiZap size={13} className="text-indigo-400" />
            <span className="text-xs text-indigo-300">
              Next slots: {(slotsData?.slots ?? []).map(h => `${h}:00`).join(', ')} UTC
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['queue', 'analytics'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all"
              style={{
                background: tab === t ? 'rgba(255,255,255,0.1)' : 'transparent',
                border:     `1px solid ${tab === t ? 'rgba(255,255,255,0.15)' : 'transparent'}`,
                color:      tab === t ? '#fff' : 'rgba(255,255,255,0.4)',
              }}
            >
              {t === 'queue'
                ? <><FiClock size={13} className="inline mr-1.5" />Queue</>
                : <><FiBarChart2 size={13} className="inline mr-1.5" />Analytics</>
              }
            </button>
          ))}
        </div>

        {/* ── QUEUE TAB ── */}
        {tab === 'queue' && (
          <>
            {/* Status filter */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {['', 'pending', 'posted', 'failed', 'retry'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: filter === s ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                    border:     '1px solid rgba(255,255,255,0.08)',
                    color:      filter === s ? '#fff' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {s || 'All'} {s && counts[s] != null ? `(${counts[s]})` : ''}
                </button>
              ))}
            </div>

            {/* Queue list */}
            {qLoading ? (
              <div className="flex items-center justify-center py-20 text-white/30">
                <FiRefreshCw className="animate-spin mr-2" /> Loading…
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <FiClock size={32} className="text-white/20" />
                <p className="text-white/30 text-sm">Queue is empty</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map(item => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-4 p-4 rounded-2xl border"
                    style={{ background: '#111620', borderColor: 'rgba(255,255,255,0.07)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white/85 text-sm leading-relaxed line-clamp-2">
                        "{item.text}"
                      </p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <StatusPill status={item.status} />
                        <span className="text-white/30 text-xs">— {item.author}</span>

                        {/* ✅ Fixed: restored <a opening tag */}
                        {item.tweetUrl && (
                          <a
                            href={item.tweetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                          >
                            View tweet ↗
                          </a>
                        )}

                        {item.error && (
                          <span className="text-xs text-red-400 flex items-center gap-1">
                            <FiAlertCircle size={10} /> {item.error}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {(item.status === 'failed' || item.status === 'retry') && (
                        <motion.button
                          whileTap={{ scale: 0.88 }}
                          onClick={() => retryMutation.mutate(item.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 transition-all"
                        >
                          <FiRefreshCw size={12} />
                        </motion.button>
                      )}
                      {item.status !== 'posted' && (
                        <motion.button
                          whileTap={{ scale: 0.88 }}
                          onClick={() => removeMutation.mutate(item.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400/60 hover:text-red-400 bg-red-500/8 border border-red-500/15 transition-all"
                        >
                          <FiTrash2 size={12} />
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && (
          <div className="flex flex-col gap-6">

            {/* Counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(counts).map(([status, count]) => {
                const c = STATUS_COLOR[status] ?? STATUS_COLOR.skipped;
                return (
                  <div
                    key={status}
                    className="p-4 rounded-2xl border flex flex-col gap-1"
                    style={{ background: c.bg, borderColor: c.border }}
                  >
                    <span className="text-2xl font-black" style={{ color: c.text }}>{count}</span>
                    <span className="text-xs capitalize" style={{ color: c.text + 'aa' }}>{status}</span>
                  </div>
                );
              })}
            </div>

            {/* Weekly chart */}
            <div className="p-5 rounded-2xl border" style={{ background: '#111620', borderColor: 'rgba(255,255,255,0.07)' }}>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-4">
                Posts this week
              </p>
              <div className="flex items-end gap-3 h-24">
                {Object.entries(analytics?.weeklyChart ?? {}).map(([day, count]) => (
                  <div key={day} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="w-full rounded-t-lg transition-all"
                      style={{ height: `${Math.max(8, (count / 5) * 80)}px`, background: 'rgba(99,102,241,0.5)' }}
                    />
                    <span className="text-[10px] text-white/30">{day}</span>
                    <span className="text-[10px] text-white/50 font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI slots + engagement */}
            <div className="p-5 rounded-2xl border" style={{ background: '#111620', borderColor: 'rgba(255,255,255,0.07)' }}>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-4">
                AI-Optimized Time Slots
              </p>
              <div className="flex gap-3 flex-wrap">
                {(analytics?.slots ?? []).map(hour => {
                  const eng   = analytics?.engagement?.[hour];
                  const score = eng?.score ?? 50;
                  return (
                    <div
                      key={hour}
                      className="flex flex-col items-center gap-1 p-3 rounded-xl border"
                      style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.2)' }}
                    >
                      <span className="text-indigo-300 font-bold text-sm">{hour}:00</span>
                      <span className="text-white/30 text-[10px]">UTC</span>
                      <div className="w-full h-1 rounded-full bg-white/10 mt-1">
                        <div className="h-full rounded-full bg-indigo-400" style={{ width: `${score}%` }} />
                      </div>
                      <span className="text-[9px] text-white/25">{score} score</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent posts */}
            <div className="p-5 rounded-2xl border" style={{ background: '#111620', borderColor: 'rgba(255,255,255,0.07)' }}>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-4">
                Recent Posts
              </p>
              {(analytics?.recentPosts ?? []).map(post => (
                <div
                  key={post.id}
                  className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
                >
                  <FiCheck size={12} className="text-emerald-400 flex-shrink-0" />
                  <p className="text-white/60 text-xs flex-1 truncate">"{post.text}"</p>

                  {/* ✅ Fixed: closing </a> now correctly paired */}
                  {post.tweetUrl && (
                    <a
                      href={post.tweetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex-shrink-0 transition-colors"
                    >
                      View tweet ↗
                    </a>
                  )}
                </div>
              ))}
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default QueueDashboard;