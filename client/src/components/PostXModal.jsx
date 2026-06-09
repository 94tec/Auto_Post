/**
 * PostToXModal.jsx
 * ─────────────────────────────────────────────────────────────
 * Self-contained — no Redux, no useRole.
 * Safe to render inside SharePortal / CinematicShareModal.
 *
 * Props:
 *   isOpen      boolean
 *   onClose     () => void
 *   item        { id, text, author|artist, category|genre }
 *   sourceType  'quote' | 'lyric' | 'daily'
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence }            from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  FiX, FiSend, FiCheck, FiAlertCircle,
  FiLink, FiRefreshCw, FiClock, FiExternalLink, FiUser,
} from 'react-icons/fi';
import { xApi }       from '../utils/xApi';
import { useXStatus } from '../hooks/useXStatus';

/* ─── Tokens ─────────────────────────────────────────────────── */
const T = {
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
  xBlue:   '#1D9BF0',
};

const X_MAX = 280;

/* ─── Helpers ────────────────────────────────────────────────── */
const buildText = (item) => {
  if (!item) return '';
  const author     = item.author ?? item.artist ?? '';
  const authorLine = author ? `\n— ${author}` : '';
  const maxQ       = X_MAX - authorLine.length - 2;
  const q          = item.text.length > maxQ ? item.text.slice(0, maxQ - 1) + '…' : item.text;
  return `"${q}"${authorLine}`;
};

const fmtDate = (ms) => {
  if (!ms) return '';
  return new Date(ms).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

/* ─── X Logo ─────────────────────────────────────────────────── */
const XLogo = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={T.xBlue}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

/* ─── Char ring ──────────────────────────────────────────────── */
const CharRing = memo(({ used }) => {
  const remaining = X_MAX - used;
  const r    = 13;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(used / X_MAX, 1);
  const color = remaining < 0 ? T.red : remaining < 20 ? T.amber : T.xBlue;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
      <svg width={30} height={30} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={15} cy={15} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={2.5}/>
        <circle cx={15} cy={15} r={r} fill="none" stroke={color} strokeWidth={2.5}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition:'stroke-dasharray 0.15s, stroke 0.15s' }}/>
      </svg>
      <span style={{ fontSize:11, fontWeight:700, color, minWidth:22, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
        {remaining < 0 ? remaining : remaining <= 20 ? remaining : ''}
      </span>
    </div>
  );
});

/* ─── X Profile badge ────────────────────────────────────────── */
const XBadge = memo(({ xUsername, xProfileImage, onDisconnect, isDisconnecting }) => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderRadius:12, background:'rgba(29,155,240,0.07)', border:'1px solid rgba(29,155,240,0.18)' }}>
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      {xProfileImage
        ? <img src={xProfileImage} alt={xUsername} style={{ width:26, height:26, borderRadius:'50%', objectFit:'cover' }}/>
        : <div style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:`${T.xBlue}22`, color:T.xBlue, fontSize:11, fontWeight:700 }}>{xUsername?.[0]?.toUpperCase() ?? 'X'}</div>
      }
      <div>
        <p style={{ fontSize:12, fontWeight:700, color:T.xBlue, margin:0 }}>@{xUsername}</p>
        <p style={{ fontSize:10, color:`${T.xBlue}60`, margin:0 }}>Connected</p>
      </div>
    </div>
    <button onClick={onDisconnect} disabled={isDisconnecting}
      style={{ fontSize:11, padding:'4px 10px', borderRadius:8, cursor:'pointer', background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.18)', color:T.red, fontFamily:'inherit' }}>
      {isDisconnecting ? '…' : 'Disconnect'}
    </button>
  </div>
));

/* ─── Tweet preview ──────────────────────────────────────────── */
const TweetPreview = memo(({ text, xUsername, xProfileImage }) => (
  <div style={{ borderRadius:12, padding:'12px 14px', background:'rgba(29,155,240,0.04)', border:'1px solid rgba(29,155,240,0.10)' }}>
    <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
      <div style={{ flexShrink:0 }}>
        {xProfileImage
          ? <img src={xProfileImage} alt="" style={{ width:32, height:32, borderRadius:'50%' }}/>
          : <div style={{ width:32, height:32, borderRadius:'50%', background:`${T.xBlue}18`, display:'flex', alignItems:'center', justifyContent:'center' }}><FiUser size={13} style={{ color:T.xBlue }}/></div>
        }
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:4 }}>
          <span style={{ fontSize:13, fontWeight:700, color:T.t1 }}>{xUsername ?? 'You'}</span>
          <span style={{ fontSize:11, color:T.t3 }}>@{xUsername ?? 'yourhandle'} · now</span>
        </div>
        <p style={{ fontSize:13, color:'rgba(231,233,234,0.88)', lineHeight:1.55, whiteSpace:'pre-wrap', wordBreak:'break-word', margin:0 }}>
          {text || <span style={{ color:T.t3, fontStyle:'italic' }}>Start typing…</span>}
        </p>
      </div>
    </div>
  </div>
));

/* ─── History row ────────────────────────────────────────────── */
const HistoryRow = memo(({ post }) => {
  const ok = post.status === 'success';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
      <div style={{ width:18, height:18, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background: ok ? `${T.green}15` : `${T.red}15` }}>
        {ok ? <FiCheck size={9} style={{ color:T.green }}/> : <FiAlertCircle size={9} style={{ color:T.red }}/>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:11, color:T.t2, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{post.text}</p>
        <p style={{ fontSize:10, color:T.t3, margin:0 }}>{fmtDate(post.postedAt)}</p>
      </div>
      {ok && post.tweetUrl && (
        <a href={post.tweetUrl} target="_blank" rel="noreferrer"
          style={{ flexShrink:0, width:24, height:24, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:`${T.xBlue}12`, color:T.xBlue }}>
          <FiExternalLink size={10}/>
        </a>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════════════ */
const PostXModal = ({ isOpen, onClose, item, sourceType = 'quote' }) => {
  const {
    connected, xUsername, xProfileImage,
    connect, disconnect, isDisconnecting, isLoading: statusLoading,
  } = useXStatus();

  const [text,        setText]        = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (item) setText(buildText(item));
  }, [item?.id, sourceType]);

  // Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  const remaining = X_MAX - text.length;
  const canPost   = connected && text.trim().length > 0 && remaining >= 0;

  /* ── Post ── */
  const postMut = useMutation({
    mutationFn: () => xApi.post({ text: text.trim(), sourceId: item.id, sourceType }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['xHistory', item?.id] });
      toast.success(
        <span>Posted! {data?.tweetUrl && <a href={data.tweetUrl} target="_blank" rel="noreferrer" style={{ color:T.xBlue, textDecoration:'underline' }}>View</a>}</span>,
        { duration: 5000 }
      );
      onClose();
    },
    onError: (err) => toast.error(err.message || 'Failed to post'),
  });

  /* ── History ── */
  const { data: histData, isLoading: histLoading } = useQuery({
    queryKey: ['xHistory', item?.id],
    queryFn:  () => xApi.getHistory(10),
    enabled:  showHistory && !!item,
    staleTime: 30_000,
  });
  const history = useMemo(() => {
    if (!histData?.posts || !item) return [];
    return histData.posts.filter(p => p.sourceId === item.id);
  }, [histData, item]);

  const color = { quote: T.amber, lyric: '#EC4899', daily: T.indigo }[sourceType] ?? T.amber;

  if (!item) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="ptx-overlay"
          initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
          transition={{ duration:0.16 }}
          onClick={onClose}
          style={{
            position:'fixed', inset:0,
            // sits above CinematicShareModal (z-130) and ShareBackdrop (z-120)
            zIndex: 140,
            display:'flex', alignItems:'center', justifyContent:'center', padding:16,
            background:'rgba(4,6,14,0.72)', backdropFilter:'blur(20px)',
          }}
        >
          <motion.div
            key="ptx-panel"
            initial={{ scale:0.88, opacity:0, y:20 }}
            animate={{ scale:1,    opacity:1, y:0  }}
            exit={{ scale:0.88,    opacity:0, y:20 }}
            transition={{ type:'spring', stiffness:340, damping:28 }}
            onClick={e => e.stopPropagation()}
            style={{
              width:'100%', maxWidth:440,
              background: T.card,
              border: `1px solid ${T.border2}`,
              borderRadius: 22,
              boxShadow:'0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
              maxHeight:'90vh',
              display:'flex', flexDirection:'column',
              overflow:'hidden',
            }}
          >
            {/* Accent line */}
            <div style={{ height:2, flexShrink:0, background:`linear-gradient(90deg,transparent,${T.xBlue}80,${T.xBlue}40,transparent)` }}/>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px 14px', borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:`${T.xBlue}15`, border:`1px solid ${T.xBlue}25` }}>
                  <XLogo size={14}/>
                </div>
                <div>
                  <h2 style={{ fontSize:14, fontWeight:700, color:T.t1, margin:0 }}>Post to X</h2>
                  <p style={{ fontSize:10, color:`${color}70`, margin:0, textTransform:'capitalize' }}>Sharing {sourceType}</p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale:1.1 }} whileTap={{ scale:0.9 }}
                onClick={onClose}
                style={{ width:32, height:32, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.05)', border:`1px solid ${T.border}`, color:T.t3, cursor:'pointer' }}
              >
                <FiX size={13}/>
              </motion.button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:14, scrollbarWidth:'thin', scrollbarColor:`${T.border} transparent` }}>

              {/* Quote chip */}
              <div style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'10px 12px', borderRadius:12, background:`${color}09`, border:`1px solid ${color}20` }}>
                <div style={{ width:2, alignSelf:'stretch', borderRadius:1, background:color, flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:12, color:T.t2, lineHeight:1.55, margin:0, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>"{item.text}"</p>
                  <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color, margin:'4px 0 0' }}>— {item.author ?? item.artist}</p>
                </div>
              </div>

              {/* X status */}
              {statusLoading ? (
                <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:T.t3 }}>
                  <FiRefreshCw size={12} style={{ animation:'spin 1s linear infinite' }}/> Checking connection…
                </div>
              ) : connected ? (
                <XBadge xUsername={xUsername} xProfileImage={xProfileImage} onDisconnect={disconnect} isDisconnecting={isDisconnecting}/>
              ) : (
                <div style={{ borderRadius:14, padding:16, textAlign:'center', background:'rgba(29,155,240,0.05)', border:'1px dashed rgba(29,155,240,0.20)' }}>
                  <div style={{ width:40, height:40, borderRadius:12, margin:'0 auto 10px', display:'flex', alignItems:'center', justifyContent:'center', background:`${T.xBlue}15` }}>
                    <XLogo size={18}/>
                  </div>
                  <p style={{ fontSize:13, fontWeight:600, color:T.t1, margin:'0 0 4px' }}>Connect your X account</p>
                  <p style={{ fontSize:11, color:T.t3, margin:'0 0 12px' }}>Authorize once to post directly from Damuchi.</p>
                  <button onClick={connect} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:10, cursor:'pointer', background:`linear-gradient(135deg,${T.xBlue},#1a6fb5)`, border:'none', color:'#fff', fontSize:13, fontWeight:600, fontFamily:'inherit' }}>
                    <FiLink size={12}/> Connect X
                  </button>
                </div>
              )}

              {/* Composer */}
              {connected && (
                <>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                      <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:T.t3 }}>Your tweet</span>
                      <CharRing used={text.length}/>
                    </div>
                    <textarea
                      value={text}
                      onChange={e => setText(e.target.value)}
                      rows={5}
                      placeholder="Compose your tweet…"
                      style={{
                        width:'100%', resize:'none', borderRadius:12, padding:'10px 14px',
                        fontSize:13, lineHeight:1.6, fontFamily:'inherit',
                        background:'rgba(255,255,255,0.04)',
                        border:`1px solid ${remaining < 0 ? T.red+'60' : T.border2}`,
                        color:T.t1, caretColor:T.xBlue, outline:'none', boxSizing:'border-box',
                      }}
                    />
                    {remaining < 0 && (
                      <p style={{ fontSize:11, color:T.red, margin:'4px 0 0' }}>
                        {Math.abs(remaining)} char{Math.abs(remaining)!==1?'s':''} over limit
                      </p>
                    )}
                  </div>

                  {/* Preview */}
                  <div>
                    <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:T.t3, margin:'0 0 8px' }}>Preview</p>
                    <TweetPreview text={text} xUsername={xUsername} xProfileImage={xProfileImage}/>
                  </div>
                </>
              )}

              {/* History toggle */}
              <div>
                <button onClick={() => setShowHistory(s => !s)}
                  style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:T.t3, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}>
                  <FiClock size={11}/>
                  {showHistory ? 'Hide' : 'Show'} post history for this {sourceType}
                </button>
                <AnimatePresence>
                  {showHistory && (
                    <motion.div
                      initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
                      exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
                      style={{ overflow:'hidden' }}
                    >
                      <div style={{ marginTop:8 }}>
                        {histLoading
                          ? <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:T.t3, padding:'8px 0' }}><FiRefreshCw size={11} style={{ animation:'spin 1s linear infinite' }}/> Loading…</div>
                          : history.length === 0
                          ? <p style={{ fontSize:12, color:T.t3, padding:'8px 0', margin:0 }}>No posts yet for this {sourceType}.</p>
                          : history.map(p => <HistoryRow key={p.id} post={p}/>)
                        }
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>

            {/* Footer */}
            <div style={{ padding:'12px 20px 16px', borderTop:`1px solid ${T.border}`, flexShrink:0, display:'flex', gap:10 }}>
              <button onClick={onClose}
                style={{ flex:1, padding:'10px 0', borderRadius:12, fontSize:13, fontWeight:500, background:'rgba(255,255,255,0.05)', border:`1px solid ${T.border}`, color:T.t2, cursor:'pointer', fontFamily:'inherit' }}>
                Cancel
              </button>
              <motion.button
                whileTap={{ scale:0.97 }}
                onClick={() => postMut.mutate()}
                disabled={!canPost || postMut.isPending}
                style={{
                  flex:2, padding:'10px 0', borderRadius:12, fontSize:13, fontWeight:700,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  cursor: canPost ? 'pointer' : 'not-allowed',
                  opacity: !canPost && !postMut.isPending ? 0.4 : 1,
                  background: canPost ? `linear-gradient(135deg,${T.xBlue},#1477bd)` : 'rgba(255,255,255,0.05)',
                  border: canPost ? 'none' : `1px solid ${T.border}`,
                  color: canPost ? '#fff' : T.t3,
                  boxShadow: canPost ? '0 8px 20px rgba(29,155,240,0.25)' : 'none',
                  fontFamily:'inherit',
                  transition:'all 0.15s',
                }}
              >
                {postMut.isPending
                  ? <><FiRefreshCw size={13} style={{ animation:'spin 1s linear infinite' }}/> Posting…</>
                  : <><FiSend size={13}/> Post to X</>
                }
              </motion.button>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PostXModal;