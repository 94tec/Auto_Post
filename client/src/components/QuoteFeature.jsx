// QuoteFeature.jsx — display-only, receives quotes as prop from parent
// Parent (Landing) owns the fetch via React Query and passes quotes down.
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  FiRefreshCw, FiPause, FiPlay,
  FiShare2, FiCopy, FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';

/* ── constants ──────────────────────────────────────────────── */
const CAT_META = {
  motivation:    { color: '#F59E0B', label: '🔥 Motivation'    },
  mindset:       { color: '#818CF8', label: '🧠 Mindset'       },
  discipline:    { color: '#34D399', label: '⚡ Discipline'     },
  success:       { color: '#A78BFA', label: '🏆 Success'       },
  resilience:    { color: '#FB923C', label: '💪 Resilience'    },
  persistence:   { color: '#38BDF8', label: '🎯 Persistence'   },
  belief:        { color: '#C084FC', label: '🌟 Belief'        },
  action:        { color: '#86EFAC', label: '⚡ Action'        },
  growth:        { color: '#2DD4BF', label: '🌱 Growth'        },
  determination: { color: '#F87171', label: '🔑 Determination' },
  inspiration:   { color: '#7DD3FC', label: '✨ Inspiration'   },
};
const DEFAULT_COLOR = '#6B7280';
const PLACEHOLDER   = [{ id: 'placeholder', text: 'Loading quotes…', author: '', category: 'motivation' }];

const AUTO_INTERVAL = 9000;
const RESUME_DELAY  = 30_000;
const MAX_DOTS      = 8;

/* ── component ──────────────────────────────────────────────── */
const QuoteFeature = ({
  quotes: propQuotes = [],   // ← fed by parent, no internal fetch
  autoPlay: externalAutoPlay,
  onAutoPlay,
  className = '',
}) => {
  // Use placeholder while parent is loading so the card always renders
  const allQuotes = propQuotes.length ? propQuotes : PLACEHOLDER;

  const [index,        setIndex]   = useState(0);
  const [internalAuto, setInternal] = useState(true);
  const intervalRef = useRef(null);
  const resumeRef   = useRef(null);

  const isAuto = externalAutoPlay !== undefined ? externalAutoPlay : internalAuto;

  /* reset index when quotes load in for the first time */
  useEffect(() => {
    if (propQuotes.length > 1) {
      setIndex(Math.floor(Math.random() * propQuotes.length));
    }
  }, [propQuotes.length > 0]); // only trigger once when quotes arrive

  /* auto-rotate */
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (isAuto && allQuotes.length > 1) {
      intervalRef.current = setInterval(
        () => setIndex(i => (i + 1) % allQuotes.length),
        AUTO_INTERVAL,
      );
    }
    return () => clearInterval(intervalRef.current);
  }, [isAuto, allQuotes.length]);

  const pauseWithResume = useCallback(() => {
    clearTimeout(resumeRef.current);
    setInternal(false);
    onAutoPlay?.(false);
    resumeRef.current = setTimeout(() => {
      setInternal(true);
      onAutoPlay?.(true);
    }, RESUME_DELAY);
  }, [onAutoPlay]);

  const bump = useCallback((dir) => {
    setIndex(i => (i + dir + allQuotes.length) % allQuotes.length);
    pauseWithResume();
  }, [allQuotes.length, pauseWithResume]);

  const jumpTo = useCallback((i) => {
    setIndex(i);
    pauseWithResume();
  }, [pauseWithResume]);

  const toggleAuto = () => {
    const next = !isAuto;
    setInternal(next);
    onAutoPlay?.(next);
    clearTimeout(resumeRef.current);
  };

  const handleCopy = () => {
    const q = allQuotes[index];
    if (!q?.text) return;
    navigator.clipboard.writeText(`"${q.text}"${q.author ? ` — ${q.author}` : ''}`);
    toast.success('Copied to clipboard');
  };

  const handleShare = async () => {
    const q = allQuotes[index];
    if (!q?.text) return;
    try {
      await navigator.share({
        title: 'Quote',
        text:  `"${q.text}"${q.author ? ` — ${q.author}` : ''}`,
        url:   window.location.href,
      });
    } catch { handleCopy(); }
  };

  const handleRandom = () => {
    const next = Math.floor(Math.random() * allQuotes.length);
    setIndex(next);
    pauseWithResume();
  };

  const quote      = allQuotes[Math.min(index, allQuotes.length - 1)];
  const catMeta    = CAT_META[quote?.category];
  const accentColor = catMeta?.color ?? DEFAULT_COLOR;
  const isPlaceholder = propQuotes.length === 0;

  const iconBtn = `w-8 h-8 rounded-xl flex items-center justify-center border border-white/8
                   bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80
                   transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed`;

  return (
    <div className={`w-full max-w-[520px] mx-auto ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative bg-[#141924] rounded-2xl border border-white/8 overflow-hidden"
      >
        {/* category accent line */}
        <div className="h-[2px] w-full"
             style={{ background: `linear-gradient(to right, ${accentColor}99, ${accentColor}22)` }} />

        {/* auto-progress bar */}
        <AnimatePresence>
          {isAuto && !isPlaceholder && (
            <motion.div
              key={`prog-${index}`}
              className="absolute top-0 left-0 h-[2px]"
              style={{ background: accentColor, opacity: 0.35 }}
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: AUTO_INTERVAL / 1000, ease: 'linear' }}
            />
          )}
        </AnimatePresence>

        <div className="p-5">

          {/* top row */}
          <div className="flex items-center justify-between mb-5">
            {catMeta && !isPlaceholder ? (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-[0.1em]"
                    style={{ background: `${accentColor}18`, color: accentColor }}>
                {catMeta.label}
              </span>
            ) : <span />}
            <span className="text-[11px] text-white/20 font-medium tabular-nums">
              {isPlaceholder ? '…' : `${index + 1} / ${allQuotes.length}`}
            </span>
          </div>

          {/* quote body */}
          <div className="min-h-[96px] flex items-start">
            <AnimatePresence mode="wait">
              <motion.div
                key={quote?.id ?? index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="w-full"
              >
                <div className="text-[36px] leading-none font-serif mb-1 select-none"
                     style={{ color: `${accentColor}40` }}>&ldquo;</div>

                <p className={`text-[15px] sm:text-[16px] font-medium leading-[1.7] mb-4 ${isPlaceholder ? 'text-white/30 animate-pulse' : 'text-white/85'}`}>
                  {quote?.text}
                </p>

                {quote?.author && !isPlaceholder && (
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em]"
                     style={{ color: accentColor }}>
                    — {quote.author}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* divider */}
          <div className="mt-5 mb-4 h-px bg-white/6" />

          {/* controls */}
          <div className="flex items-center justify-between gap-2">

            {/* prev / play-pause / next */}
            <div className="flex items-center gap-1.5">
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => bump(-1)}
                disabled={isPlaceholder} aria-label="Previous" className={iconBtn}>
                <FiChevronLeft size={14} />
              </motion.button>

              <motion.button whileTap={{ scale: 0.88 }} onClick={toggleAuto}
                disabled={isPlaceholder}
                aria-label={isAuto ? 'Pause' : 'Resume'}
                className="w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-150 disabled:opacity-30"
                style={isAuto
                  ? { background: `${accentColor}18`, borderColor: `${accentColor}40`, color: accentColor }
                  : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }
                }>
                {isAuto ? <FiPause size={12} /> : <FiPlay size={12} />}
              </motion.button>

              <motion.button whileTap={{ scale: 0.88 }} onClick={() => bump(1)}
                disabled={isPlaceholder} aria-label="Next" className={iconBtn}>
                <FiChevronRight size={14} />
              </motion.button>
            </div>

            {/* dot indicators */}
            <div className="flex items-center gap-[5px]">
              {!isPlaceholder && allQuotes.slice(0, Math.min(allQuotes.length, MAX_DOTS)).map((_, i) => (
                <button key={i} onClick={() => jumpTo(i)} aria-label={`Quote ${i + 1}`}
                  className="transition-all duration-200 rounded-full"
                  style={i === index
                    ? { width: 16, height: 5, background: accentColor }
                    : { width: 5, height: 5, background: 'rgba(255,255,255,0.18)' }
                  } />
              ))}
              {!isPlaceholder && allQuotes.length > MAX_DOTS && (
                <span className="text-[10px] text-white/20 ml-0.5">+{allQuotes.length - MAX_DOTS}</span>
              )}
              {isPlaceholder && (
                <span className="text-[10px] text-white/15">loading…</span>
              )}
            </div>

            {/* action buttons */}
            <div className="flex items-center gap-1.5">
              {[
                { icon: FiCopy,      label: 'Copy',   action: handleCopy   },
                { icon: FiShare2,    label: 'Share',  action: handleShare  },
                { icon: FiRefreshCw, label: 'Random', action: handleRandom },
              ].map(({ icon: Icon, label, action }) => (
                <motion.button key={label} whileTap={{ scale: 0.88 }}
                  onClick={action} disabled={isPlaceholder}
                  aria-label={label} className={iconBtn}>
                  <Icon size={13} />
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* paused pill */}
      <AnimatePresence>
        {!isAuto && !isPlaceholder && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.18 }}
            className="mt-2 flex justify-center"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/4 border border-white/6 text-[11px] text-white/25">
              <FiPause size={9} />
              Paused · resumes in 30s
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuoteFeature;