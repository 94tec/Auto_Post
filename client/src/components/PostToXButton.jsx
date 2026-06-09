import { useState } from 'react';
import { motion } from 'framer-motion';
import PostToXModal from './PostToXModal';
import { useXStatus } from '../hooks/useXStatus';

const X_BLUE = '#1D9BF0';

const XLogo = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const Spinner = () => (
  <motion.div
    animate={{ rotate: 360 }}
    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
    className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"
  />
);

const PostToXButton = ({
  item,
  sourceType = 'quote',
  variant = 'pill',
  className = '',
  size = 12,
  isPosting = false,
  isPosted = false,
  onPost
}) => {

  const [open, setOpen] = useState(false);
  const { connected } = useXStatus();           // ← know if X is linked

  const handleClick = () => {
    if (isPosting || isPosted) return;
    if (onPost) onPost(item);
    else setOpen(true);
  };

  /* ── MINI ─────────────────────────────────────────────────── */
  if (variant === 'mini') {
    return (
      <>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setOpen(true)}
          className="group relative overflow-hidden w-7 h-7 rounded-xl flex items-center justify-center transition-all"
          style={{
            background: connected ? 'rgba(29,155,240,0.12)' : 'rgba(255,255,255,0.05)',
            border:     connected ? '1px solid rgba(29,155,240,0.25)' : '1px solid rgba(255,255,255,0.08)',
            color: X_BLUE,
          }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
               style={{ background:'radial-gradient(circle at center, rgba(29,155,240,0.18), transparent 70%)' }}/>
          <XLogo size={10}/>
        </motion.button>
        <PostToXModal isOpen={open} onClose={() => setOpen(false)} item={item} sourceType={sourceType}/>
      </>
    );
  }

  /* ── COMPACT ──────────────────────────────────────────────── */
  if (variant === 'compact') {
    return (
      <>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleClick}
          disabled={isPosting || isPosted}
          className={`group relative overflow-hidden inline-flex items-center justify-center gap-1.5 h-7 px-2.5 rounded-xl text-[11px] font-semibold shrink-0 transition-all disabled:opacity-70 disabled:cursor-not-allowed ${className}`}
          style={{
            background: isPosted
              ? 'linear-gradient(135deg,#16a34a,#22c55e)'
              : connected
              ? 'rgba(29,155,240,0.12)'
              : 'rgba(255,255,255,0.05)',
            border: isPosted
              ? '1px solid rgba(34,197,94,0.35)'
              : connected
              ? '1px solid rgba(29,155,240,0.25)'
              : '1px solid rgba(255,255,255,0.08)',
            color: isPosted ? '#fff' : connected ? X_BLUE : 'rgba(255,255,255,0.7)',
          }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
               style={{ background:'radial-gradient(circle at center, rgba(29,155,240,0.18), transparent 70%)' }}/>
          <span className="relative z-10 flex items-center gap-1.5">
            {isPosting ? <Spinner/> : isPosted ? '✓' : <XLogo size={10}/>}
            {isPosted ? 'Posted' : connected ? 'Share' : 'Connect X'}
          </span>
        </motion.button>

        {!onPost && (
          <PostToXModal isOpen={open} onClose={() => setOpen(false)} item={item} sourceType={sourceType}/>
        )}
      </>
    );
  }

  /* ── PILL / FULL (new design) ─────────────────────────────── */
  return (
    <>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.94 }}
        onClick={handleClick}
        disabled={isPosting || isPosted}
        className={`group relative overflow-hidden flex items-center gap-2 px-4 py-2 rounded-2xl font-semibold transition-all disabled:opacity-70 disabled:cursor-not-allowed ${className}`}
        style={{
          background: isPosted
            ? 'linear-gradient(135deg,#16a34a,#22c55e)'
            : isPosting
            ? 'rgba(255,255,255,0.08)'
            : connected
            ? 'linear-gradient(135deg, rgba(29,155,240,0.18), rgba(29,155,240,0.08))'
            : 'rgba(255,255,255,0.05)',
          border: isPosted
            ? '1px solid rgba(34,197,94,0.4)'
            : connected
            ? '1px solid rgba(29,155,240,0.25)'
            : '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* glow on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
             style={{ background:'radial-gradient(circle at center, rgba(29,155,240,0.18), transparent 70%)' }}/>

        <span className="relative z-10 flex items-center gap-2">
          {isPosted ? (
            <>
              <span className="text-sm">✅</span>
              <span className="text-[11px]" style={{ color:'#fff' }}>Posted</span>
            </>
          ) : isPosting ? (
            <>
              <Spinner/>
              <span className="text-[11px]" style={{ color:'rgba(255,255,255,0.7)' }}>Posting…</span>
            </>
          ) : (
            <>
              <svg width={14} height={14} viewBox="0 0 24 24" fill={X_BLUE}>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span className="text-[11px] font-semibold"
                    style={{ color: connected ? X_BLUE : 'rgba(255,255,255,0.7)' }}>
                {connected ? 'Share to X' : 'Connect X'}
              </span>
            </>
          )}
        </span>
      </motion.button>

      {!onPost && (
        <PostToXModal isOpen={open} onClose={() => setOpen(false)} item={item} sourceType={sourceType}/>
      )}
    </>
  );
};

export default PostToXButton;