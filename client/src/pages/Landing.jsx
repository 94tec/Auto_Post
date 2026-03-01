import { useEffect, useState, useContext, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { get, ref } from 'firebase/database';
import { db } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  FiSun, FiMoon, FiRefreshCw, FiLogIn, FiLogOut,
  FiUser, FiMenu, FiX, FiChevronLeft, FiPhone, FiMail,
  FiZap, FiBookOpen, FiBriefcase, FiStar, FiArrowRight,
  FiCopy, FiShare2, FiPause, FiPlay, FiHome, FiGrid,
} from 'react-icons/fi';

/* -------------------- CONSTANTS (Accent colors) -------------------- */
const ACCENT_GRADIENT = 'from-[#F59E0B] to-[#F97316]'; // burnished amber‑gold
const NAVY = '#0A0E1A';
const SLATE = '#1C2135';

const LOCAL_QUOTES = [
  { id:'q1',  text:'Stay hard.', author:'David Goggins', category:'motivation' },
  { id:'q2',  text:'You are in danger of living a life so comfortable and soft, that you will die without ever realizing your true potential.', author:'David Goggins', category:'motivation' },
  { id:'q3',  text:'The only thing more contagious than a good attitude is a bad one.', author:'David Goggins', category:'mindset' },
  { id:'q4',  text:'Suffering is a test. That\'s all it is. Suffering is the true test of life.', author:'David Goggins', category:'resilience' },
  { id:'q5',  text:'Arrogance is the enemy of growth.', author:'Andrew Tate', category:'growth' },
  { id:'q6',  text:'Discipline is the root of all good qualities.', author:'Andrew Tate', category:'discipline' },
  { id:'q7',  text:'Success is always stressful.', author:'Andrew Tate', category:'success' },
  { id:'q8',  text:'Your mind is your most powerful muscle. Train it well.', author:'Ed Mylett', category:'mindset' },
  { id:'q9',  text:'One more try is always worth it.', author:'Ed Mylett', category:'persistence' },
  { id:'q10', text:"You don't get what you want, you get what you are.", author:'Ed Mylett', category:'mindset' },
  { id:'q11', text:'The only way to achieve the impossible is to believe it is possible.', author:'Ben Nemtin', category:'belief' },
  { id:'q12', text:"Don't let your dreams be dreams.", author:'Ben Nemtin', category:'motivation' },
  { id:'q13', text:"You miss 100% of the shots you don't take.", author:'Ben Nemtin', category:'action' },
  { id:'q14', text:'Every day is a chance to get better.', author:'Michael Oher', category:'growth' },
  { id:'q15', text:"Don't ever let someone tell you that you can't do something.", author:'Michael Oher', category:'determination' },
  { id:'q16', text:'Success is not owned, it is leased. And rent is due every day.', author:'Ryan Harris', category:'success' },
  { id:'q17', text:'Champions behave like champions before they are champions.', author:'Ryan Harris', category:'motivation' },
];

const CAT_COLORS = {
  motivation:    'from-yellow-500 to-orange-500',
  mindset:       'from-blue-400 to-indigo-600',
  discipline:    'from-green-500 to-emerald-600',
  success:       'from-purple-500 to-pink-600',
  resilience:    'from-red-500 to-amber-600',
  persistence:   'from-cyan-400 to-blue-600',
  belief:        'from-violet-500 to-purple-600',
  action:        'from-lime-400 to-green-600',
  growth:        'from-teal-400 to-cyan-600',
  determination: 'from-rose-500 to-red-600',
  inspiration:   'from-sky-400 to-blue-500',
  default:       'from-gray-400 to-gray-600',
};

/* -------------------- SECTION 1: NAVBAR (30% slate) -------------------- */
const Navbar = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dark = theme === 'dark';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: 'Home',      to: '/',            icon: FiHome,     section: true },
    { label: 'Quotes',    to: '/#quotes',     icon: FiBookOpen, section: true },
    { label: 'Features',  to: '/#features',   icon: FiGrid,     section: true },
    { label: 'Contact',   to: '/#contact',    icon: FiMail,     section: true },
  ];

  const handleNavClick = (e, to) => {
    e.preventDefault();
    if (to.startsWith('/#')) {
      const id = to.substring(2);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        navigate('/', { replace: true });
      }
    } else {
      navigate(to);
    }
    setMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
  };

  return (
    <motion.nav
      initial={{ y: -72, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#1C2135]/90 backdrop-blur-2xl border-b border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
          : 'bg-transparent'
      }`}
      style={{ backgroundColor: scrolled ? `${SLATE}E6` : 'transparent' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          to="/"
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-2.5 shrink-0"
        >
          <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center text-white font-black text-sm shadow-lg bg-gradient-to-r ${ACCENT_GRADIENT}`}>
            D
          </div>
          <span className="font-extrabold text-[17px] tracking-tight leading-none text-white">
            Damu<span className="text-[#F59E0B]">chi</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-0.5">
          {links.map(({ label, to, icon: Icon }) => (
            <Link
              key={label}
              to={to}
              onClick={(e) => handleNavClick(e, to)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors text-gray-400 hover:text-white hover:bg-white/8"
            >
              <Icon size={13} />
              {label}
            </Link>
          ))}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <motion.button
            whileHover={{ scale: 1.08, rotate: 15 }}
            whileTap={{ scale: 0.92 }}
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors bg-white/8 hover:bg-white/15 text-[#F59E0B]"
          >
            {dark ? <FiSun size={15} /> : <FiMoon size={15} />}
          </motion.button>

          {/* Auth block */}
          {user ? (
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                onClick={() => navigate('/dashboard')}
                className="hidden sm:flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-xl text-[13px] font-medium transition-all bg-white/8 hover:bg-white/15 text-white border border-white/10"
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-black shrink-0 bg-gradient-to-r ${ACCENT_GRADIENT}`}>
                  {user.displayName
                    ? user.displayName[0].toUpperCase()
                    : user.email
                      ? user.email[0].toUpperCase()
                      : <FiUser size={10} />}
                </div>
                <span className="max-w-[110px] truncate">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-semibold transition-all bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/25"
              >
                <FiLogOut size={13} />
                <span className="hidden sm:inline">Sign out</span>
              </motion.button>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/auth/login')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[13px] font-semibold shadow-md transition-all bg-gradient-to-r ${ACCENT_GRADIENT} text-gray-950`}
            >
              <FiLogIn size={13} />
              Sign in
            </motion.button>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center transition-colors text-white hover:bg-white/10"
            aria-label="Menu"
          >
            {menuOpen ? <FiX size={17} /> : <FiMenu size={17} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="md:hidden overflow-hidden border-t bg-[#1C2135]/95 border-white/8 backdrop-blur-2xl"
          >
            <div className="px-4 py-3 space-y-0.5">
              {links.map(({ label, to, icon: Icon }) => (
                <Link
                  key={label}
                  to={to}
                  onClick={(e) => handleNavClick(e, to)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-gray-300 hover:bg-white/8 hover:text-white"
                >
                  <Icon size={14} />
                  {label}
                </Link>
              ))}
              {/* Mobile auth */}
              <div className="pt-2 border-t mt-2 border-white/8">
                {user ? (
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/15 transition-colors"
                  >
                    <FiLogOut size={14} />
                    Sign out ({user.displayName || user.email?.split('@')[0]})
                  </button>
                ) : (
                  <button
                    onClick={() => { navigate('/auth/login'); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-[#F59E0B] hover:bg-amber-500/10"
                  >
                    <FiLogIn size={14} />
                    Sign in
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

/* -------------------- SECTION 2: HERO CARD (phone mockup) -------------------- */
const HeroCard = ({ quotes = [], externalIndex, onIndexChange }) => {
  const allQuotes = quotes.length ? quotes : LOCAL_QUOTES;
  const [month, setMonth] = useState('');
  const [dayWithSuffix, setDayWithSuffix] = useState('');
  const [internalIdx, setInternalIdx] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const intervalRef = useRef(null);

  const setIdx = useCallback((val) => {
    const next = typeof val === 'function' ? val(externalIndex ?? internalIdx) : val;
    if (externalIndex !== undefined) onIndexChange?.(next);
    else setInternalIdx(next);
  }, [externalIndex, internalIdx, onIndexChange]);

  const bump = useCallback((dir) => {
    setIdx(p => (p + dir + allQuotes.length) % allQuotes.length);
    setIsAutoRotating(false);
    setTimeout(() => setIsAutoRotating(true), 30000);
  }, [allQuotes.length, setIdx]);

  useEffect(() => {
    if (isAutoRotating) {
      intervalRef.current = setInterval(() => setIdx(p => (p + 1) % allQuotes.length), 10000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isAutoRotating, allQuotes.length, setIdx]);

  useEffect(() => {
    const d = new Date();
    const m = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(d);
    const day = d.getDate();
    const s = [1,21,31].includes(day) ? 'st' : [2,22].includes(day) ? 'nd' : [3,23].includes(day) ? 'rd' : 'th';
    setMonth(m);
    setDayWithSuffix(`${day}${s}`);
  }, []);

  const idx = externalIndex !== undefined ? externalIndex : internalIdx;
  const quote = allQuotes[idx] || allQuotes[0];
  const catColor = CAT_COLORS[quote?.category] || CAT_COLORS.default;

  return (
    <div className="relative w-[340px] sm:w-[360px] h-[600px] sm:h-[640px] shrink-0
      bg-[linear-gradient(180deg,_#0A0E1A_0%,_#050505_25%,_#1a1a1a_50%,_#0A0E1A_95%,_#050505_100%)]
      rounded-[36px] shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden
      border border-gray-700/50 font-sans mx-auto">

      {/* Screen glare */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-1/2 h-1/3 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-xl" />
      </div>

      {/* Notch */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[130px] h-[30px] bg-black/90 rounded-full z-10 border border-gray-700/50" />

      {/* Top icon buttons */}
      <div className="absolute top-3 left-3 z-20">
        <motion.button
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={() => bump(-1)}
          className="w-8 h-8 bg-white/10 border border-white/20 rounded-full flex items-center justify-center text-white/80 backdrop-blur-md shadow-sm hover:text-white transition-colors"
          aria-label="Previous quote"
        >
          <FiChevronLeft size={16} />
        </motion.button>
      </div>
      <div className="absolute top-3 right-3 z-20">
        <motion.button
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          className="w-8 h-8 bg-white/10 border border-white/20 rounded-full flex items-center justify-center text-white/80 backdrop-blur-md shadow-sm hover:text-white transition-colors"
          aria-label="Menu"
        >
          <FiMenu size={16} />
        </motion.button>
      </div>

      {/* Status bar */}
      <div className="absolute top-5 left-0 right-0 px-16 flex justify-between items-center z-10">
        <span className="text-[11px] text-white/70 font-medium tracking-wider">94tec</span>
        <div className="flex items-center gap-1">
          {[...Array(3)].map((_,i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm" />
          ))}
        </div>
      </div>

      {/* Date section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="absolute top-20 left-0 right-0 px-4 pointer-events-none z-10"
      >
        <div className="relative w-full max-w-[95%] mx-auto px-4 py-6 flex flex-col items-center justify-center overflow-hidden">
          {/* Animated ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border-[6px] border-transparent border-t-white/10 border-r-white/5"
          />
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-24 h-24 bg-[#F59E0B]/20 rounded-full blur-3xl animate-ping z-[-1]" />
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-[#F97316]/15 rounded-full blur-2xl z-[-1]" />
          {/* Particles */}
          {[...Array(8)].map((_,i) => (
            <div key={i} className="absolute bg-white/20 rounded-full pointer-events-none"
              style={{
                width: `${Math.random()*4+2}px`, height: `${Math.random()*4+2}px`,
                top: `${Math.random()*100}%`, left: `${Math.random()*100}%`,
                animation: `floatGlow ${Math.random()*12+8}s ease-in-out infinite`,
                opacity: Math.random()*0.3+0.1,
              }}
            />
          ))}
          <motion.h1
            whileHover={{ scale: 1.05 }}
            className="text-xl tracking-widest uppercase select-none bg-gradient-to-r from-[#F59E0B] via-[#F97316] to-[#F59E0B] bg-clip-text text-transparent drop-shadow-md"
          >
            {month}
          </motion.h1>
          <motion.h2
            whileHover={{ scale: 1.08 }}
            className="text-5xl font-bold tracking-tight leading-none mt-1 drop-shadow-xl select-none bg-gradient-to-br from-[#F59E0B] via-[#F97316] to-[#F59E0B] bg-clip-text text-transparent"
          >
            {dayWithSuffix}
          </motion.h2>
        </div>
      </motion.div>

      {/* Quote card */}
      <div className="absolute top-[250px] left-0 right-0 px-4 z-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="w-full max-w-[97%] mx-auto px-5 py-6 rounded-3xl relative overflow-hidden"
          style={{
            background: '#1C2135',
            boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {quote?.category && (
            <div className={`absolute top-2 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${catColor} text-white tracking-wide`}>
              {quote.category}
            </div>
          )}

          <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-36 h-36 bg-[#F59E0B]/10 blur-3xl rounded-full z-[-1] animate-pulse" />

          <AnimatePresence mode="wait">
            <motion.div
              key={quote?.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.55 }}
              className="mt-3"
            >
              <p className="text-gray-200 text-[15px] leading-relaxed text-center font-medium tracking-tight">
                "{quote?.text}"
              </p>
              <p className="text-[11px] mt-3 text-center font-semibold tracking-[0.1em] uppercase text-[#F59E0B]">
                — {quote?.author}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Prev/Next arrows */}
          <div className="absolute bottom-2.5 left-0 right-0 flex justify-between px-4">
            <motion.button
              onClick={() => bump(-1)}
              whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
              className="w-8 h-8 bg-[#1C2135] border border-white/20 rounded-full flex items-center justify-center shadow-md hover:bg-[#2a3045] text-[#F59E0B]"
              aria-label="Previous quote"
            >
              <FiChevronLeft size={15} />
            </motion.button>
            <motion.button
              onClick={() => bump(1)}
              whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
              className="w-8 h-8 bg-[#1C2135] border border-white/20 rounded-full flex items-center justify-center shadow-md hover:bg-[#2a3045] text-[#F59E0B]"
              aria-label="Next quote"
            >
              <FiChevronLeft className="rotate-180" size={15} />
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Bottom nav */}
      <motion.div
        className="absolute bottom-6 left-0 right-0 px-6 z-20"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <div className="flex justify-between items-center w-full max-w-[90%] mx-auto gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="relative w-12 h-12 rounded-2xl overflow-hidden backdrop-blur-lg border border-white/30 bg-white/10 hover:bg-white/20 transition-all shadow-lg flex items-center justify-center text-[#F59E0B]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5" />
            <FiPhone className="w-5 h-5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="relative flex-1 h-12 rounded-2xl overflow-hidden backdrop-blur-lg border border-white/30 bg-gradient-to-r from-[#F59E0B]/30 to-[#F97316]/40 hover:from-[#F59E0B]/40 hover:to-[#F97316]/50 transition-all shadow-lg flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5" />
            <span className="text-lg font-semibold tracking-widest text-[#F59E0B] drop-shadow-lg">
              Damuchi
            </span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="relative w-12 h-12 rounded-2xl overflow-hidden backdrop-blur-lg border border-white/30 bg-white/10 hover:bg-white/20 transition-all shadow-lg flex items-center justify-center text-[#F59E0B]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5" />
            <FiMail className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

/* -------------------- SECTION 3: QUOTE PANEL (live quote) -------------------- */
const QuotePanel = ({ quote, dark }) => {
  const catColor = CAT_COLORS[quote?.category] || CAT_COLORS.default;

  const handleCopy = () => {
    navigator.clipboard.writeText(`"${quote.text}" — ${quote.author}`);
    toast.success('Copied to clipboard!');
  };

  const handleShare = async () => {
    try {
      await navigator.share({ title: 'Damuchi', text: `"${quote.text}" — ${quote.author}`, url: window.location.href });
    } catch {
      handleCopy();
    }
  };

  if (!quote) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={quote.id}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -18 }}
        transition={{ duration: 0.45 }}
        className="relative p-5 rounded-2xl border mb-7 bg-[#1C2135] border-white/10 backdrop-blur-sm"
      >
        {quote.category && (
          <span className={`inline-flex mb-3 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r ${catColor} text-white tracking-wide uppercase`}>
            {quote.category}
          </span>
        )}
        <p className="text-lg font-medium italic leading-relaxed mb-3 text-gray-200">
          "{quote.text}"
        </p>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#F59E0B]">
            — {quote.author}
          </p>
          <div className="flex items-center gap-1">
            <motion.button
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={handleCopy}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/10 text-gray-400 hover:text-white"
              aria-label="Copy quote"
            >
              <FiCopy size={13} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={handleShare}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/10 text-gray-400 hover:text-white"
              aria-label="Share quote"
            >
              <FiShare2 size={13} />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/* -------------------- STAT PILL (small stats) -------------------- */
const Stat = ({ value, label }) => (
  <div className="flex flex-col items-center px-5 py-2.5 rounded-xl bg-[#1C2135] border border-white/8">
    <span className="text-xl font-black text-[#F59E0B]">{value}</span>
    <span className="text-[11px] font-medium mt-0.5 text-gray-400">{label}</span>
  </div>
);

/* -------------------- FEATURE CARD (30% slate) -------------------- */
const FeatureCard = ({ icon: Icon, title, description, from, to, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 28 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.45, delay }}
    whileHover={{ y: -5, scale: 1.02 }}
    className="relative p-5 rounded-2xl border overflow-hidden group cursor-default transition-all duration-300 bg-[#1C2135] border-white/8 hover:border-white/15 hover:bg-[#23283d]"
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-r ${from} ${to} shadow-lg`}>
      <Icon className="text-white" size={18} />
    </div>
    <h3 className="text-[15px] font-bold mb-1 text-white">{title}</h3>
    <p className="text-[13px] leading-relaxed text-gray-400">{description}</p>
  </motion.div>
);

/* -------------------- FEATURES GRID (container) -------------------- */
const FeaturesGrid = ({ dark }) => {
  const features = [
    { icon: FiZap,       title: 'Instant Inspiration',  description: 'Fresh quotes every 10 s or on demand from a curated Firebase collection.',    from: 'from-yellow-500', to: 'to-orange-500' },
    { icon: FiBookOpen,  title: 'Curated Wisdom',       description: 'Hand-picked quotes by category — mindset, discipline, growth and more.',       from: 'from-blue-400',   to: 'to-indigo-600' },
    { icon: FiBriefcase, title: 'Full Dashboard',       description: 'Add, edit, delete and search your own quotes with category filtering.',         from: 'from-purple-500', to: 'to-pink-600'   },
    { icon: FiStar,      title: 'Save Favourites',      description: 'Bookmark quotes that move you and return to them whenever you need a boost.',   from: 'from-amber-500',  to: 'to-red-500'    },
  ];
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {features.map((f, i) => (
        <FeatureCard key={f.title} {...f} delay={i * 0.1} />
      ))}
    </div>
  );
};

/* -------------------- CONTACT SECTION (30% slate) -------------------- */
const ContactSection = () => (
  <section id="contact" className="py-12 border-t border-white/5">
    <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
        <div>
          <h3 className="text-base font-bold text-white">Get in touch</h3>
          <p className="text-sm mt-0.5 text-gray-400">
            Questions, feedback, or collaboration ideas?
          </p>
        </div>
        <div className="flex gap-3">
          <motion.a
            href="mailto:hello@damuchi.app"
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all border-white/15 bg-white/5 hover:bg-white/10 text-white"
          >
            <FiMail size={13} />
            Email us
          </motion.a>
          <motion.a
            href="tel:+254700000000"
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-md transition-all bg-gradient-to-r ${ACCENT_GRADIENT} text-gray-950`}
          >
            <FiPhone size={13} />
            Call us
          </motion.a>
        </div>
      </div>
    </div>
  </section>
);

/* -------------------- MAIN LANDING (60% navy background) -------------------- */
const Landing = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [allQuotes, setAllQuotes] = useState(LOCAL_QUOTES);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cardIdx, setCardIdx] = useState(0);
  const [showFeatures, setShowFeatures] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const autoRef = useRef(null);

  // Fetch Firebase quotes
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await get(ref(db, 'quotes'));
        const data = snap.val();
        if (data) {
          const arr = Object.values(data);
          setAllQuotes(arr);
          setCardIdx(Math.floor(Math.random() * arr.length));
        }
      } catch (e) {
        console.error('Firebase error:', e);
        toast.error('Could not load quotes, using local ones.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Auto‑rotate interval
  useEffect(() => {
    if (isAutoPlay) {
      autoRef.current = setInterval(() => setCardIdx(i => (i + 1) % allQuotes.length), 10000);
    } else {
      clearInterval(autoRef.current);
    }
    return () => clearInterval(autoRef.current);
  }, [isAutoPlay, allQuotes.length]);

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const timeout = setTimeout(() => {
      setCardIdx(prev => {
        let next = Math.floor(Math.random() * allQuotes.length);
        while (next === prev && allQuotes.length > 1) {
          next = Math.floor(Math.random() * allQuotes.length);
        }
        return next;
      });
      setIsRefreshing(false);
    }, 500);
    return () => clearTimeout(timeout);
  }, [allQuotes.length, isRefreshing]);

  const currentQuote = useMemo(() => allQuotes[cardIdx] || allQuotes[0], [allQuotes, cardIdx]);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white transition-colors duration-300">
      <Navbar />

      <main className="pt-16">
        {/* HERO SECTION */}
        <section
          id="home"
          className="min-h-[calc(100vh-4rem)] flex flex-col xl:flex-row items-center justify-center gap-10 xl:gap-20 px-4 sm:px-8 lg:px-16 py-12 max-w-7xl mx-auto"
        >
          {/* Left column */}
          <motion.div
            initial={{ opacity: 0, x: -36 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="flex-1 min-w-0 max-w-lg"
          >
            <div className="flex items-center gap-2 mb-5">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-[#F59E0B]" />
              <span className="text-[11px] font-bold tracking-[0.22em] uppercase text-[#F59E0B]">
                Daily Inspiration Platform
              </span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.04] mb-5">
              Words that<br />
              <span className={`bg-clip-text text-transparent bg-gradient-to-r ${ACCENT_GRADIENT}`}>
                move you.
              </span>
            </h1>

            <p className="text-[15px] sm:text-base leading-relaxed mb-7 max-w-md text-gray-400">
              Discover wisdom from the world's greatest minds. A fresh quote every day to fuel your purpose, sharpen your mindset, and drive you forward.
            </p>

            <div id="quotes">
              {isLoading
                ? <div className="mb-7"><LoadingSpinner size="medium" /></div>
                : <QuotePanel quote={currentQuote} dark={true} />
              }
            </div>

            <div className="flex flex-wrap gap-3 mb-6">
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-lg transition-all bg-gradient-to-r ${ACCENT_GRADIENT} text-gray-950 disabled:opacity-50`}
              >
                <FiRefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                New Quote
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => setIsAutoPlay(p => !p)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border transition-all border-white/15 bg-white/5 hover:bg-white/10 text-white"
              >
                {isAutoPlay ? <FiPause size={14} /> : <FiPlay size={14} />}
                {isAutoPlay ? 'Pause' : 'Resume'}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => setShowFeatures(s => !s)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border transition-all border-white/15 bg-white/5 hover:bg-white/10 text-white"
              >
                <FiArrowRight size={14} className={`transition-transform duration-300 ${showFeatures ? 'rotate-90' : ''}`} />
                {showFeatures ? 'Hide' : 'Features'}
              </motion.button>

              {user && (
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all bg-white/10 hover:bg-white/15 text-white border border-white/15"
                >
                  <FiGrid size={14} />
                  Dashboard
                </motion.button>
              )}
            </div>

            <div className="flex gap-2.5 flex-wrap">
              <Stat value={`${allQuotes.length}+`} label="Quotes" />
              <Stat value="10s"                    label="Auto-rotate" />
              <Stat value="Free"                   label="Always" />
            </div>
          </motion.div>

          {/* Right column: HeroCard */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.82, delay: 0.22, type: 'spring', stiffness: 62 }}
            className="shrink-0 flex items-center justify-center"
            style={{
              filter: 'drop-shadow(0 40px 56px rgba(245,158,11,0.22))'
            }}
          >
            <HeroCard
              quotes={allQuotes}
              externalIndex={cardIdx}
              onIndexChange={setCardIdx}
            />
          </motion.div>
        </section>

        {/* FEATURES SECTION (toggleable) */}
        <AnimatePresence>
          {showFeatures && (
            <motion.section
              id="features"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.38 }}
              className="overflow-hidden"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 pb-20">
                <div className="rounded-3xl p-8 sm:p-12 border bg-[#1C2135]/55 border-white/8 backdrop-blur-sm">
                  <div className="text-center mb-10">
                    <span className="text-[11px] font-bold tracking-[0.22em] uppercase text-[#F59E0B]">
                      Platform Features
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-black mt-2 tracking-tight text-white">
                      Why You'll Love This
                    </h2>
                    <p className="text-sm mt-2 max-w-sm mx-auto text-gray-400">
                      Built for people who demand more from every day.
                    </p>
                  </div>
                  <FeaturesGrid dark={true} />
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <ContactSection />

        {/* FOOTER */}
        <footer className="py-5 text-center text-xs border-t border-white/5 text-gray-600">
          © {new Date().getFullYear()} Damuchi · Built with purpose in Nairobi
        </footer>
      </main>

      {/* Global animation styles for floating particles */}
      <style>{`
        @keyframes floatGlow {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.2; }
          50% { transform: translateY(-20px) scale(1.2); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};

export default Landing;