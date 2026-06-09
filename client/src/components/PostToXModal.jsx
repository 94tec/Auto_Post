/**
 * PostToXModal.jsx
 * ─────────────────────────────────────────────────────────────
 * Beautiful publish-to-X modal for Damuchi.
 *
 * Props:
 *   isOpen      boolean
 *   onClose     () => void
 *   item        { id, text, author|artist, category|genre, status? }
 *   sourceType  'quote' | 'lyric' | 'daily'
 *
 * Features:
 *   • Live 280-char counter with color feedback
 *   • X account connection status inline
 *   • Preview of how the tweet will look
 *   • Post history panel (last 5 posts for this item)
 *   • Connect-to-X CTA if not linked
 *   • Smooth spring animations throughout
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence }            from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import  useRole  from '../hooks/useRole';
import {
  FiX, FiTwitter, FiSend, FiCheck, FiAlertCircle,
  FiLink, FiRefreshCw, FiClock, FiExternalLink,
  FiZap, FiUser,
} from 'react-icons/fi';
import { xApi }      from '../utils/xApi';
import { useXStatus } from '../hooks/useXStatus';

/* ─── Tokens (mirror your Dashboard palette) ─────────────────── */
const T = {
  bg:      '#0A0E1A',
  surface: '#111620',
  card:    '#141924',
  border:  'rgba(255,255,255,0.07)',
  border2: 'rgba(255,255,255,0.13)',
  t1:      '#E8EAF0',
  t2:      'rgba(232,234,240,0.55)',
  t3:      'rgba(232,234,240,0.28)',
  amber:   '#F59E0B',
  amber2:  '#F97316',
  indigo:  '#818CF8',
  green:   '#34D399',
  red:     '#F87171',
  xBlue:   '#1D9BF0',   // X brand blue
};

const X_MAX = 280;

/* ─── Helpers ────────────────────────────────────────────────── */
const formatDate = (ms) => {
  if (!ms) return '';
  return new Date(ms).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const buildDefaultText = (item, sourceType) => {
  if (!item) return '';

  const author = item.author ?? item.artist ?? '';

  // Reserve space for author line within X limit
  const authorLine = author ? `\n— ${author}` : '';
  const maxQuote = X_MAX - authorLine.length - 2; // account for quotes

  const truncated =
    item.text.length > maxQuote
      ? item.text.slice(0, maxQuote - 1) + '…'
      : item.text;

  return `"${truncated}"${authorLine}`;
};

/* ─── Char counter ring ──────────────────────────────────────── */
const CharRing = memo(({ used, max }) => {
  const pct       = used / max;
  const remaining = max - used;
  const r         = 14;
  const circ      = 2 * Math.PI * r;
  const dash      = circ * Math.min(pct, 1);
  const color     = remaining < 0 ? T.red : remaining < 20 ? T.amber : T.xBlue;

  return (
    <div className="flex items-center gap-1.5">
      <svg width={34} height={34} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={17} cy={17} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={2.5}/>
        <circle
          cx={17} cy={17} r={r} fill="none"
          stroke={color} strokeWidth={2.5}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition:'stroke-dasharray 0.15s, stroke 0.15s' }}
        />
      </svg>
      <span style={{
        fontSize: 11, fontWeight: 700, color,
        minWidth: 24, textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {remaining < 0 ? remaining : remaining <= 20 ? remaining : ''}
      </span>
    </div>
  );
});

/* ─── X profile badge ────────────────────────────────────────── */
const XProfileBadge = memo(({ xUsername, xProfileImage, onDisconnect, isDisconnecting }) => (
  <div className="flex items-center justify-between px-3 py-2 rounded-xl"
       style={{ background:'rgba(29,155,240,0.07)', border:'1px solid rgba(29,155,240,0.18)' }}>
    <div className="flex items-center gap-2.5">
      {xProfileImage
        ? <img src={xProfileImage} alt={xUsername} className="w-7 h-7 rounded-full object-cover"/>
        : (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black"
               style={{ background:`${T.xBlue}22`, color:T.xBlue }}>
            {xUsername?.[0]?.toUpperCase() ?? 'X'}
          </div>
        )
      }
      <div>
        <p className="text-[12px] font-bold" style={{ color:T.xBlue }}>@{xUsername}</p>
        <p className="text-[10px]" style={{ color:`${T.xBlue}60` }}>Connected</p>
      </div>
    </div>
    <button
      onClick={onDisconnect}
      disabled={isDisconnecting}
      className="text-[11px] px-2.5 py-1 rounded-lg transition-all"
      style={{ background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.18)', color:T.red }}
    >
      {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
    </button>
  </div>
));

/* ─── Tweet preview ──────────────────────────────────────────── */
const TweetPreview = memo(({ text, xUsername, xProfileImage }) => (
  <div className="rounded-xl p-3.5"
       style={{ background:'rgba(29,155,240,0.04)', border:'1px solid rgba(29,155,240,0.12)' }}>
    <div className="flex gap-2.5 items-start">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {xProfileImage
          ? <img src={xProfileImage} alt="" className="w-9 h-9 rounded-full"/>
          : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center"
                 style={{ background:`${T.xBlue}22` }}>
              <FiUser size={14} style={{ color:T.xBlue }}/>
            </div>
          )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[13px] font-bold" style={{ color:T.t1 }}>
            {xUsername ?? 'You'}
          </span>
          <span className="text-[12px]" style={{ color:T.t3 }}>@{xUsername ?? 'yourhandle'}</span>
          <span className="text-[11px]" style={{ color:T.t3 }}>· just now</span>
        </div>
        <p className="text-[13px] leading-[1.55] whitespace-pre-wrap break-words"
           style={{ color:'rgba(231,233,234,0.9)' }}>
          {text || <span style={{ color:T.t3, fontStyle:'italic' }}>Start typing to preview…</span>}
        </p>
      </div>
    </div>
  </div>
));

/* ─── Post history row ───────────────────────────────────────── */
const HistoryRow = memo(({ post }) => {
  const success = post.status === 'success';
  return (
    <div className="flex items-center gap-2.5 py-2"
         style={{ borderBottom:`1px solid ${T.border}` }}>
      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
           style={{ background: success ? `${T.green}15` : `${T.red}15` }}>
        {success
          ? <FiCheck size={10} style={{ color:T.green }}/>
          : <FiAlertCircle size={10} style={{ color:T.red }}/>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] truncate" style={{ color:T.t2 }}>{post.text}</p>
        <p className="text-[10px]" style={{ color:T.t3 }}>{formatDate(post.postedAt)}</p>
      </div>
      {success && post.tweetUrl && (
        <a href={post.tweetUrl} target="_blank" rel="noreferrer"
           className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all"
           style={{ background:`${T.xBlue}12`, color:T.xBlue }}>
          <FiExternalLink size={10}/>
        </a>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   MAIN MODAL
════════════════════════════════════════════════════════════ */
const PostToXModal = ({
  isOpen,
  onClose,
  item,
  sourceType = 'quote',
}) => {
  const { isAdmin } = useRole();
  const {connected, xUsername, xProfileImage,connect, disconnect, isDisconnecting, isLoading: statusLoading,} = useXStatus();

  const [text,        setText]        = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const qc = useQueryClient();

  // Build default tweet text when item loads
  useEffect(() => {
    if (item) setText(buildDefaultText(item, sourceType));
  }, [item, sourceType]);

  const remaining = X_MAX - text.length;
  const canPost   = connected && text.trim().length > 0 && remaining >= 0;

/* ── Post mutation ── */
const postMutation = useMutation({
  mutationFn: () => xApi.postWithFeedback({
    text: text.trim(),
    sourceId: item.id,
    sourceType,
  }),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['xHistory', item?.id] });
    onClose();           // close modal after success
  },
});

  /* ── History query ── */
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['xHistory', item?.id],
    queryFn:  () => xApi.getHistory(10),
    enabled:  showHistory && !!item,
    staleTime: 30_000,
  });
  const history = useMemo(() => {
    if (!historyData?.posts || !item) return [];
    return historyData.posts.filter(p => p.sourceId === item.id);
  }, [historyData, item]);

  if (!item) return null;

  const color = {
    quote: T.amber,
    lyric: '#EC4899',
    daily: T.indigo,
  }[sourceType] ?? T.amber;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="x-modal-overlay"
          initial={{ opacity:0 }}
          animate={{ opacity:1 }}
          exit={{ opacity:0 }}
          transition={{ duration:0.18 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 rounded-[44px]"
          style={{ background:'rgba(5,8,18,0.80)', backdropFilter:'blur(16px)' }}
          onClick={onClose}
        >
          <motion.div
            key="x-modal-panel"
            initial={{ scale:0.90, opacity:0, y:20 }}
            animate={{ scale:1,    opacity:1, y:0  }}
            exit={{ scale:0.90,    opacity:0, y:20 }}
            transition={{ type:'spring', stiffness:340, damping:28 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md flex flex-col"
            style={{
              background: T.card,
              border:     `1px solid ${T.border2}`,
              borderRadius: 22,
              boxShadow: '0 40px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)',
              maxHeight: '92vh',
              overflow: 'hidden',
            }}
          >
            {/* ── Top accent line ── */}
            <div className="h-[2px] flex-shrink-0"
                 style={{ background:`linear-gradient(90deg, transparent, ${T.xBlue}80, ${T.xBlue}40, transparent)` }}/>

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
                 style={{ borderBottom:`1px solid ${T.border}` }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                     style={{ background:`${T.xBlue}15`, border:`1px solid ${T.xBlue}25` }}>
                  {/* X logo SVG */}
                  <svg width={14} height={14} viewBox="0 0 24 24" fill={T.xBlue}>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-[14px] font-bold" style={{ color:T.t1 }}>Post to X</h2>
                  <p className="text-[10px] capitalize" style={{ color:`${color}70` }}>
                    Sharing {sourceType}
                  </p>
                </div>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                style={{ background:'rgba(255,255,255,0.05)', border:`1px solid ${T.border}`, color:T.t3 }}>
                <FiX size={13}/>
              </button>
            </div>

            {/* ── Scrollable body ── */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4"
                 style={{ scrollbarWidth:'thin', scrollbarColor:`${T.border} transparent` }}>

              {/* Source preview chip */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl"
                   style={{ background:`${color}09`, border:`1px solid ${color}20` }}>
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background:color }}/>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] leading-relaxed line-clamp-2"
                     style={{ color:T.t2 }}>"{item.text}"</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] mt-1"
                     style={{ color }}>
                    — {item.author ?? item.artist}
                  </p>
                </div>
              </div>

              {/* X account status */}
              {statusLoading ? (
                <div className="flex items-center gap-2 text-[12px]" style={{ color:T.t3 }}>
                  <FiRefreshCw size={12} className="animate-spin"/> Checking X connection…
                </div>
              ) : connected ? (
                <XProfileBadge
                  xUsername={xUsername}
                  xProfileImage={xProfileImage}
                  onDisconnect={disconnect}
                  isDisconnecting={isDisconnecting}
                />
              ) : (
                /* Connect CTA */
                <div className="rounded-xl p-4 text-center"
                     style={{ background:'rgba(29,155,240,0.06)', border:'1px dashed rgba(29,155,240,0.22)' }}>
                  <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center"
                       style={{ background:`${T.xBlue}15` }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill={T.xBlue}>
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <p className="text-[13px] font-semibold mb-1" style={{ color:T.t1 }}>
                    Connect your X account
                  </p>
                  <p className="text-[11px] mb-3" style={{ color:T.t3 }}>
                    Authorize Damuchi to post on your behalf via X OAuth.
                  </p>
                  {isAdmin && (
                    <button
                      onClick={connect}
                      className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:scale-105"
                      style={{ background:`linear-gradient(135deg, ${T.xBlue}, #1a6fb5)`, color:'#fff' }}
                    >
                      <FiLink size={13}/> Connect X Account
                    </button>
                  )}
                  {!isAdmin && (
                    <p className="text-[10px] mt-3" style={{ color:T.amber }}>
                      Admin note: If you have already connected your X account but it's not showing here, please disconnect and reconnect to refresh your status.
                    </p>
                  )}
                </div>
              )}

              {/* Tweet composer */}
              {connected && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-[0.12em]"
                             style={{ color:T.t3 }}>
                        Your tweet
                      </label>
                      <CharRing used={text.length} max={X_MAX}/>
                    </div>
                    <textarea
                      value={text}
                      onChange={e => setText(e.target.value)}
                      rows={5}
                      placeholder="Compose your tweet…"
                      className="w-full resize-none rounded-xl px-3.5 py-3 text-[13px] leading-relaxed focus:outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: `1px solid ${remaining < 0 ? T.red+'60' : T.border2}`,
                        color: T.t1,
                        caretColor: T.xBlue,
                      }}
                    />
                    {remaining < 0 && (
                      <p className="text-[11px] mt-1" style={{ color:T.red }}>
                        {Math.abs(remaining)} character{Math.abs(remaining)!==1?'s':''} over the limit
                      </p>
                    )}
                  </div>

                  {/* Live tweet preview */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5"
                       style={{ color:T.t3 }}>Preview</p>
                    <TweetPreview
                      text={text}
                      xUsername={xUsername}
                      xProfileImage={xProfileImage}
                    />
                  </div>
                </>
              )}

              {/* Post history */}
              <div>
                <button
                  onClick={() => setShowHistory(s => !s)}
                  className="flex items-center gap-2 text-[11px] font-medium transition-colors hover:opacity-80"
                  style={{ color:T.t3 }}
                >
                  <FiClock size={11}/>
                  {showHistory ? 'Hide' : 'Show'} post history for this {sourceType}
                </button>

                <AnimatePresence>
                  {showHistory && (
                    <motion.div
                      initial={{ height:0, opacity:0 }}
                      animate={{ height:'auto', opacity:1 }}
                      exit={{ height:0, opacity:0 }}
                      transition={{ duration:0.22 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2">
                        {historyLoading ? (
                          <div className="flex items-center gap-2 text-[12px] py-2" style={{ color:T.t3 }}>
                            <FiRefreshCw size={11} className="animate-spin"/> Loading…
                          </div>
                        ) : history.length === 0 ? (
                          <p className="text-[12px] py-2" style={{ color:T.t3 }}>
                            No posts yet for this {sourceType}.
                          </p>
                        ) : (
                          history.map(p => <HistoryRow key={p.id} post={p}/>)
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>

            {/* ── Footer ── */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.01 }}
              onClick={() => postMutation.mutate()}
              disabled={!canPost || postMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: canPost
                  ? `linear-gradient(135deg, ${T.xBlue}, #1477bd)`
                  : 'rgba(255,255,255,0.05)',
                color: canPost ? '#fff' : T.t3,
                border: canPost
                  ? 'none'
                  : `1px solid ${T.border}`,
                boxShadow: canPost
                  ? '0 10px 25px rgba(29,155,240,0.25)'
                  : 'none',
              }}
            >
              {postMutation.isPending ? (
                <>
                  <FiRefreshCw size={13} className="animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <FiSend size={13} />
                  Post to X
                </>
              )}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PostToXModal;