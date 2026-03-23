// DailyCard.jsx
// Phone mockup component:
//  - Reads from `lyrics` Firestore collection (separate from quotes)
//  - Admin-only "Add Lyric" CTA inside phone
//  - All phone app icons are interactive (navigate on tap)
//  - Contact CTA button
//  - Exported as default (bare frame) + named DailyCardPage (standalone)

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FiChevronLeft, FiChevronRight, FiWifi, FiCamera,
  FiBookOpen, FiStar, FiSettings, FiCopy, FiShare2,
  FiPlus, FiMail, FiMusic, FiSearch, FiZap,
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import useRole from '../hooks/useRole';
import { ROLES } from '../store/authSlice';

/* ── helpers ──────────────────────────────────────────────── */
const getDaySuffix = (d) =>
  [1,21,31].includes(d) ? 'st' : [2,22].includes(d) ? 'nd' : [3,23].includes(d) ? 'rd' : 'th';

/* ── Full CAT_META with all categories ────────────────────── */
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
  // Lyrics-specific genres
  gospel:        { color: '#FCD34D', label: '🙏 Gospel'        },
  afrobeat:      { color: '#10B981', label: '🎵 Afrobeat'      },
  rnb:           { color: '#EC4899', label: '💿 R&B'           },
  hiphop:        { color: '#8B5CF6', label: '🎤 Hip-Hop'       },
  pop:           { color: '#06B6D4', label: '🎶 Pop'           },
  soul:          { color: '#F97316', label: '🎸 Soul'          },
};
const cc = (c) => CAT_META[c]?.color ?? '#F59E0B';
const cl = (c) => CAT_META[c]?.label ?? c;

const AUTO_INTERVAL = 10_000;
const RESUME_DELAY  = 30_000;

/* ── Fallback lyrics (used while API loads) ─────────────────── */
const FALLBACK_LYRICS = [
  { id: 'f1', text: 'You were made for more than this moment.', artist: 'Damuchi', genre: 'inspiration' },
  { id: 'f2', text: 'Every setback is the universe preparing a comeback.', artist: 'Damuchi', genre: 'resilience' },
  { id: 'f3', text: "Don't count the days, make the days count.", artist: 'Muhammad Ali', genre: 'motivation' },
];

/* ── Battery ──────────────────────────────────────────────── */
const Battery = ({ pct = 78 }) => (
  <div className="flex items-center gap-0.5">
    <span className="text-[9px] text-white/55">{pct}%</span>
    <div className="relative w-5 h-2.5 rounded-[2px] border border-white/35 flex items-center px-[1px]">
      <div className="h-[7px] rounded-[1px] transition-all"
           style={{ width: `${pct}%`, background: pct > 20 ? '#4ade80' : '#f87171' }} />
    </div>
    <div className="w-[2px] h-[5px] rounded-r-sm bg-white/30 ml-[-1px]" />
  </div>
);

/* ── Signal ───────────────────────────────────────────────── */
const Signal = ({ bars = 4 }) => (
  <div className="flex items-end gap-[2px]">
    {[1,2,3,4].map(i => (
      <div key={i} className="w-[3px] rounded-[1px]"
           style={{ height: `${4 + i * 2.5}px`, background: i <= bars ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.18)' }} />
    ))}
  </div>
);

/* ── App icon (interactive) ────────────────────────────────── */
const AppIcon = ({ icon: Icon, label, color, onClick }) => (
  <motion.button
    whileTap={{ scale: 0.8 }}
    whileHover={{ scale: 1.08 }}
    onClick={onClick}
    className="flex flex-col items-center gap-1 cursor-pointer"
  >
    <div className="w-11 h-11 rounded-[14px] flex items-center justify-center shadow-lg transition-all"
         style={{ background: `${color}22`, border: `1px solid ${color}35` }}>
      <Icon size={18} style={{ color }} />
    </div>
    <span className="text-[8px] text-white/45 font-medium leading-none">{label}</span>
  </motion.button>
);

/* ════════════════════════════════════════════════════════════
   DAILY CARD
════════════════════════════════════════════════════════════ */
const DailyCard = ({ onContactOpen, onAddLyric }) => {
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  const [dateLabel, setDateLabel] = useState({ month: '', day: '', weekday: '', time: '' });
  const [idx,    setIdx]    = useState(0);
  const [autoOn, setAutoOn] = useState(true);
  const [battery]           = useState(Math.floor(Math.random() * 40) + 55);
  const intervalRef = useRef(null);
  const resumeRef   = useRef(null);

  /* ── Fetch lyrics from API ──────────────────────────────── */
  const { data } = useQuery({
    queryKey: ['lyrics'],
    queryFn:  async () => {
      const res = await fetch('/api/lyrics');
      if (!res.ok) throw new Error('Failed to load lyrics');
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
  const lyrics = data?.lyrics?.length ? data.lyrics : FALLBACK_LYRICS;

  /* live clock */
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setDateLabel({
        weekday: new Intl.DateTimeFormat('en-US', { weekday: 'long'  }).format(d),
        month:   new Intl.DateTimeFormat('en-US', { month:   'long'  }).format(d),
        day:     `${d.getDate()}${getDaySuffix(d.getDate())}`,
        time:    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      });
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  /* auto-rotate */
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (autoOn) intervalRef.current = setInterval(
      () => setIdx(i => (i + 1) % lyrics.length), AUTO_INTERVAL,
    );
    return () => clearInterval(intervalRef.current);
  }, [autoOn, lyrics.length]);

  const pauseWithResume = () => {
    clearTimeout(resumeRef.current);
    setAutoOn(false);
    resumeRef.current = setTimeout(() => setAutoOn(true), RESUME_DELAY);
  };

  const bump = (dir) => {
    setIdx(i => (i + dir + lyrics.length) % lyrics.length);
    pauseWithResume();
  };

  const handleCopy = () => {
    const l = lyrics[idx];
    navigator.clipboard.writeText(`"${l.text}" — ${l.artist}`);
    toast.success('Copied!');
  };

  const handleShare = async () => {
    const l = lyrics[idx];
    try {
      await navigator.share({ title: 'Damuchi', text: `"${l.text}" — ${l.artist}`, url: window.location.href });
    } catch { handleCopy(); }
  };

  const lyric  = lyrics[Math.min(idx, lyrics.length - 1)];
  const accent = cc(lyric?.genre || lyric?.category);

  const apps = [
    { icon: FiBookOpen, label: 'Quotes',  color: accent,    onClick: () => navigate('/quotes') },
    { icon: FiStar,     label: 'Favs',    color: '#818CF8', onClick: () => navigate('/dashboard') },
    { icon: FiSearch,   label: 'Search',  color: '#38BDF8', onClick: () => navigate('/quotes?search=') },
    { icon: FiSettings, label: 'Settings',color: '#6B7280', onClick: () => navigate('/dashboard') },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative select-none"
      style={{ width: 300 }}
    >
      {/* glow behind phone */}
      <div className="absolute inset-0 rounded-[44px] blur-[40px] opacity-20"
           style={{ background: accent, transform: 'scale(0.85) translateY(8%)' }} />

      {/* phone shell */}
      <div className="relative rounded-[44px] overflow-hidden border border-white/12 shadow-[0_32px_64px_rgba(0,0,0,0.7)]"
           style={{ background: 'linear-gradient(165deg,#141E2E,#0A0E1A,#0D1520)' }}>

        {/* side buttons */}
        <div className="absolute -right-[2px] top-24 w-[3px] h-12 rounded-l-full bg-white/10" />
        <div className="absolute -left-[2px] top-20 w-[3px] h-8 rounded-r-full bg-white/10" />
        <div className="absolute -left-[2px] top-32 w-[3px] h-8 rounded-r-full bg-white/10" />

        <div className="relative px-5 pt-4 pb-5 flex flex-col gap-3">

          {/* status bar */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold text-white/60">{dateLabel.time}</span>
            <div className="w-20 h-5 rounded-full bg-black/60 flex items-center justify-center gap-2 border border-white/8">
              <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
              <div className="w-1 h-1 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center gap-1.5">
              <Signal bars={4} />
              <FiWifi size={10} className="text-white/55" />
              <Battery pct={battery} />
            </div>
          </div>

          {/* date */}
          <div className="text-center py-1">
            <p className="text-[10px] text-white/35 uppercase tracking-[0.18em]">{dateLabel.weekday}</p>
            <h2 className="text-[32px] font-black text-white leading-tight tracking-tight">
              {dateLabel.day}
            </h2>
            <p className="text-[11px] text-white/40 tracking-wide">{dateLabel.month}</p>
          </div>

          {/* category glow accent */}
          <div className="h-[1px] mx-2 rounded-full opacity-60"
               style={{ background: `linear-gradient(to right, transparent, ${accent}, transparent)` }} />

          {/* ── LYRIC CARD ── */}
          <div className="relative rounded-[20px] overflow-hidden border border-white/8 p-4"
               style={{
                 background: `linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))`,
                 boxShadow: `0 0 30px ${accent}18`,
               }}>

            {/* progress bar */}
            {autoOn && (
              <motion.div key={idx}
                className="absolute top-0 left-0 h-[2px] rounded-full"
                style={{ background: accent, opacity: 0.5 }}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: AUTO_INTERVAL / 1000, ease: 'linear' }} />
            )}

            {/* genre pill */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-[0.1em]"
                    style={{ background: `${accent}20`, color: accent }}>
                {cl(lyric?.genre || lyric?.category)}
              </span>
              <span className="text-[9px] text-white/25 tabular-nums">{idx + 1}/{lyrics.length}</span>
            </div>

            {/* lyric text */}
            <AnimatePresence mode="wait">
              <motion.div key={lyric?.id ?? idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}>

                <div className="text-[26px] leading-none font-serif mb-1.5 select-none"
                     style={{ color: `${accent}35` }}>&ldquo;</div>

                <p className="text-[12px] font-medium leading-[1.7] text-white/85 mb-2.5">
                  {lyric?.text}
                </p>

                <p className="text-[9px] font-bold uppercase tracking-[0.14em]"
                   style={{ color: accent }}>
                  — {lyric?.artist || lyric?.author}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* controls */}
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/6">
              <div className="flex gap-1">
                {[-1, 1].map((d, i) => (
                  <motion.button key={i} whileTap={{ scale: 0.8 }} onClick={() => bump(d)}
                    className="w-7 h-7 rounded-xl flex items-center justify-center border border-white/8 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-all">
                    {d < 0 ? <FiChevronLeft size={12} /> : <FiChevronRight size={12} />}
                  </motion.button>
                ))}
              </div>

              {/* dot nav */}
              <div className="flex items-center gap-[4px]">
                {lyrics.slice(0, Math.min(lyrics.length, 5)).map((_, i) => (
                  <motion.button key={i} onClick={() => { setIdx(i); pauseWithResume(); }}
                    animate={i === idx ? { width: 12 } : { width: 4 }}
                    className="h-[4px] rounded-full transition-colors"
                    style={{ background: i === idx ? accent : 'rgba(255,255,255,0.2)' }} />
                ))}
              </div>

              <div className="flex gap-1">
                <motion.button whileTap={{ scale: 0.8 }} onClick={handleCopy}
                  className="w-7 h-7 rounded-xl flex items-center justify-center border border-white/8 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-all">
                  <FiCopy size={11} />
                </motion.button>
                <motion.button whileTap={{ scale: 0.8 }} onClick={handleShare}
                  className="w-7 h-7 rounded-xl flex items-center justify-center border border-white/8 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-all">
                  <FiShare2 size={11} />
                </motion.button>
              </div>
            </div>
          </div>

          {/* ── CTA BUTTONS ── */}
          <div className="flex gap-2 mt-1">
            {/* Contact CTA — always visible */}
            <motion.button
              whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.02 }}
              onClick={onContactOpen}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-2xl text-[10px] font-semibold border border-white/10 bg-white/5 hover:bg-white/10 text-white/55 hover:text-white transition-all"
            >
              <FiMail size={11} />Contact
            </motion.button>

            {/* Add Lyric — ADMIN ONLY */}
            {isAdmin && (
              <motion.button
                whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.02 }}
                onClick={onAddLyric}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-2xl text-[10px] font-bold text-[#0A0E1A] transition-all"
                style={{ background: `linear-gradient(to right, #F59E0B, #F97316)` }}
              >
                <FiPlus size={11} />Add Lyric
              </motion.button>
            )}
          </div>

          {/* app grid */}
          <div className="grid grid-cols-4 gap-1 mt-1">
            {apps.map((app) => (
              <AppIcon key={app.label} {...app} />
            ))}
          </div>

          {/* bottom bar */}
          <div className="flex items-center justify-center gap-6 mt-1 px-2">
            <motion.button whileTap={{ scale: 0.8 }} onClick={() => navigate('/quotes')}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/8 text-white/35 hover:text-white/65 transition-all">
              <FiCamera size={13} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/')}
              className="w-12 h-12 rounded-[14px] flex items-center justify-center font-black text-[16px] shadow-lg"
              style={{ background: `linear-gradient(135deg, #F59E0B, #F97316)`, color: '#0A0E1A' }}>
              D
            </motion.button>
            <motion.button whileTap={{ scale: 0.8 }} onClick={() => navigate('/quotes')}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/8 text-white/35 hover:text-white/65 transition-all">
              <FiSearch size={13} />
            </motion.button>
          </div>

          {/* home indicator */}
          <div className="flex justify-center mt-1">
            <div className="w-24 h-1 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ── Standalone page wrapper ────────────────────────────────── */
export const DailyCardPage = () => {
  const [contactOpen, setContactOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  return (
    <div className="min-h-screen flex items-center justify-center p-8"
         style={{ background: '#0A0E1A' }}>
      <DailyCard onContactOpen={() => setContactOpen(true)} onAddLyric={() => setAddOpen(true)} />
      {/* Import ContactModal and LyricModal here if needed */}
    </div>
  );
};

export default DailyCard;