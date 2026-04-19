// Landing.jsx — authenticated users only, 5 chained sections
// AUTH GATE: unauthenticated / unapproved → /guest
// Sections: #hero  #features  #how  #stats  #contact
// Navbar tracks active section via IntersectionObserver
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import Navbar        from '../components/Navbar';
import DailyCard     from '../components/DailyCard';
import QuoteFeature  from '../components/QuoteFeature';
import NewQuoteModal from './QuoteModal';
import ContactModal  from '../components/ContactModal';
import AddLyricModal from '../components/AddLyricalModal';
import RoleGuard     from '../components/RoleGuard';
import useRole       from '../hooks/useRole';
import { useAuth }   from '../context/AuthContext';
import { ROLES }     from '../store/authSlice';
import { quotesApi } from '../utils/api';

import {
  FiPause, FiPlay, FiArrowRight, FiGrid, FiPlus, FiMail,
  FiLogIn, FiShield, FiBookOpen, FiEye, FiZap, FiStar,
  FiUsers, FiTrendingUp, FiLock, FiGlobe, FiTwitter,
  FiLinkedin, FiCheckCircle, FiClock, FiActivity, FiChevronDown,
} from 'react-icons/fi';

const ACCENT  = '#F59E0B';
const ACCENT2 = '#F97316';
const NAVY    = '#0A0E1A';
const SLATE   = '#141924';
const MID     = '#0D1220';

const CAT_COLOR = {
  motivation:'#F59E0B', mindset:'#818CF8', discipline:'#34D399',
  success:'#A78BFA', resilience:'#FB923C', persistence:'#38BDF8',
  growth:'#2DD4BF', inspiration:'#7DD3FC',
};
const catColor = (c) => CAT_COLOR[c] ?? '#6B7280';

/* ── useCountUp ─────────────────────────────────────────────── */
const useCountUp = (target, duration = 1600, active = false) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active || !target) return;
    let t0 = null;
    const frame = (ts) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [target, duration, active]);
  return val;
};

/* ── AnimatedStat ───────────────────────────────────────────── */
const AnimatedStat = ({ value, suffix = '', label, icon: Icon, color, inView }) => {
  const n = useCountUp(typeof value === 'number' ? value : 0, 1500, inView);
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.4 }}
      className="flex flex-col gap-3 p-5 rounded-2xl border border-white/8" style={{ background: SLATE }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div>
        <p className="text-[32px] font-black text-white leading-none tabular-nums">
          {typeof value === 'number' ? n : value}{suffix}
        </p>
        <p className="text-[12px] text-white/40 mt-1">{label}</p>
      </div>
    </motion.div>
  );
};

/* ── FeatureCard ────────────────────────────────────────────── */
const FeatureCard = ({ icon: Icon, color, title, desc, badge, delay }) => (
  <motion.div initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }} transition={{ delay, duration: 0.4 }}
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
    className="relative p-6 rounded-2xl border border-white/8 overflow-hidden group cursor-default"
    style={{ background: SLATE }}>
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
         style={{ background: `radial-gradient(ellipse at top left, ${color}08 0%, transparent 70%)` }} />
    {badge && (
      <span className="absolute top-4 right-4 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: `${ACCENT}18`, color: ACCENT }}>{badge}</span>
    )}
    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
         style={{ background: `${color}18`, border: `1px solid ${color}25` }}>
      <Icon size={18} style={{ color }} />
    </div>
    <h3 className="text-[15px] font-bold text-white mb-2">{title}</h3>
    <p className="text-[13px] text-white/45 leading-relaxed">{desc}</p>
  </motion.div>
);

/* ── StepRow ────────────────────────────────────────────────── */
const StepRow = ({ num, icon: Icon, color, title, desc, isLast, delay }) => (
  <motion.div initial={{ opacity: 0, x: -14 }} whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }} transition={{ delay, duration: 0.4 }}
    className="flex gap-4 items-start">
    <div className="flex flex-col items-center">
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-[13px] shrink-0"
           style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}>{num}</div>
      {!isLast && <div className="w-px h-full min-h-[36px] mt-1" style={{ background: `${color}20` }} />}
    </div>
    <div className="pb-7 flex-1">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={13} style={{ color }} />
        <h3 className="text-[14px] font-bold text-white">{title}</h3>
      </div>
      <p className="text-[13px] text-white/45 leading-relaxed">{desc}</p>
    </div>
  </motion.div>
);

/* ── SectionHead ────────────────────────────────────────────── */
const SectionHead = ({ eyebrow, title, sub, left = false }) => (
  <div className={`mb-12 ${left ? '' : 'text-center'}`}>
    <motion.div initial={{ opacity: 0, y: -6 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.4 }}>
      <span className="text-[10px] font-bold tracking-[0.22em] uppercase" style={{ color: ACCENT }}>{eyebrow}</span>
      <h2 className="text-[28px] sm:text-[36px] font-black text-white tracking-tight mt-2 mb-3 leading-[1.08]">{title}</h2>
      {sub && <p className="text-[14px] text-white/40 leading-relaxed max-w-xl mx-auto">{sub}</p>}
    </motion.div>
  </div>
);

const Hr = () => (
  <div className="max-w-7xl mx-auto px-4">
    <div className="h-px" style={{ background: 'linear-gradient(to right,transparent,rgba(255,255,255,0.08),transparent)' }} />
  </div>
);

/* ════════════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════════════ */
const Landing = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isAllowed }         = useRole();
  const navigate                       = useNavigate();
  const queryClient                    = useQueryClient();

  /* AUTH GATE */
  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.emailVerified || !user.adminApproved) {
      navigate('/guest', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const [contactOpen,   setContactOpen]   = useState(false);
  const [lyricOpen,     setLyricOpen]     = useState(false);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [isAutoPlay,    setIsAutoPlay]    = useState(true);
  const [statsInView,   setStatsInView]   = useState(false);
  const [activeSection, setActiveSection] = useState('hero');

  const statsRef = useRef(null);
  const SECTIONS  = ['hero','features','how','stats','contact'];

  /* active section tracking */
  useEffect(() => {
    const observers = SECTIONS.map(id => {
      const el = document.getElementById(id);
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) setActiveSection(id); },
        { threshold: 0.3 }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach(o => o?.disconnect());
  }, []);

  /* stats inView trigger */
  useEffect(() => {
    if (!statsRef.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsInView(true); }, { threshold: 0.25 });
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // role-aware fetching ────────

  // Admins see all quotes; regular users see only their own
  const { data, isLoading } = useQuery({
    queryKey: isAdmin ? ['quotes'] : ['quotes', 'my', user?.uid],
    queryFn:  isAdmin
      ? () => quotesApi.getAll()
      : () => quotesApi.getMy(),   // → GET /api/quotes/my
    staleTime: 60_000,
    enabled: !!user,
  });
  const allQuotes = data?.quotes ?? [];

  const catBreakdown = allQuotes.reduce((acc, q) => {
    if (q.category) acc[q.category] = (acc[q.category] || 0) + 1;
    return acc;
  }, {});
  const topCats = Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCat  = topCats[0]?.[1] ?? 1;

  const createMutation = useMutation({
    mutationFn: quotesApi.create,
    onSuccess: (res) => {
      queryClient.setQueryData(['quotes'], old => ({ ...old, quotes: [res.quote, ...(old?.quotes ?? [])] }));
      toast.success('Quote added!');
      setModalOpen(false);
    },
    onError: (err) => toast.error(err.message || 'Failed'),
  });
  const handleAddQuote = useCallback(d => createMutation.mutate(d), [createMutation]);

  /* block render while resolving */
  if (authLoading || !user || !user.emailVerified || !user.adminApproved) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: NAVY }}>
        <motion.div animate={{ scale: [1,1.12,1], opacity: [0.5,1,0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-12 h-12 rounded-[14px] flex items-center justify-center font-black text-xl"
          style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, color: NAVY }}>D</motion.div>
      </div>
    );
  }

  const firstName = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'there';

  return (
    <div className="text-white overflow-x-hidden" style={{ background: NAVY }}>

      {/* Navbar — passes section data for active highlighting */}
      <Navbar
        activeSection={activeSection}
        onSectionClick={scrollTo}
        onContactOpen={() => setContactOpen(true)}
      />

      {/* Modals */}
      <ContactModal  isOpen={contactOpen} onClose={() => setContactOpen(false)} />
      <AddLyricModal isOpen={lyricOpen}   onClose={() => setLyricOpen(false)}
                     onSuccess={() => queryClient.invalidateQueries(['lyrics'])} />
      {isAdmin && (
        <NewQuoteModal isOpen={modalOpen} onClose={() => setModalOpen(false)}
                       onSubmit={handleAddQuote} isSubmitting={createMutation.isPending} />
      )}

      {/* ambient glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full blur-[130px] opacity-10"
             style={{ background: ACCENT }} />
        <div className="absolute top-[55vh] -right-32 w-[400px] h-[400px] rounded-full blur-[100px] opacity-6"
             style={{ background: '#818CF8' }} />
        <div className="absolute bottom-[20vh] -left-32 w-[350px] h-[350px] rounded-full blur-[90px] opacity-5"
             style={{ background: '#34D399' }} />
      </div>

      <main className="relative z-10">

        {/* ══════════════════════════════════════════════
            §1  HERO
        ══════════════════════════════════════════════ */}
        <section id="hero" className="min-h-screen pt-16 flex flex-col xl:flex-row
                                       items-center justify-center gap-10 xl:gap-16
                                       px-4 sm:px-8 lg:px-16 max-w-7xl mx-auto">
          {/* LEFT */}
          <motion.div initial={{ opacity: 0, x: -28 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22,1,0.36,1] }}
            className="flex-1 min-w-0 max-w-xl py-16 xl:py-0">

            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10"
                   style={{ background: `${ACCENT}10` }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: ACCENT }}>
                  Daily Inspiration Platform
                </span>
              </div>
              {isAdmin && (
                <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase"
                  style={{ background: 'rgba(129,140,248,0.12)', color: '#818CF8', border: '1px solid rgba(129,140,248,0.22)' }}>
                  <FiShield size={9} />Admin
                </motion.span>
              )}
            </div>

            <div className="mb-5 overflow-hidden">
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.45 }}
                className="text-[13px] sm:text-[14px] text-white/35 font-medium tracking-wider mb-3">
                Good to have you, {firstName} —
              </motion.p>
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.55, ease: [0.22,1,0.36,1] }}
                className="text-[44px] sm:text-[58px] font-black tracking-tight leading-[1.04] text-white">
                Words that<br />
                <span className="bg-clip-text text-transparent"
                      style={{ backgroundImage: `linear-gradient(110deg,${ACCENT} 20%,${ACCENT2} 80%)` }}>
                  move you.
                </span>
              </motion.h1>
            </div>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="text-[14px] sm:text-[15px] leading-relaxed mb-6 max-w-md text-white/45">
              Curate wisdom, track inspiration, and automatically share powerful quotes to X and LinkedIn — all from one elegant platform.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.45 }} className="mb-5 -ml-12">
              <QuoteFeature quotes={allQuotes} autoPlay={isAutoPlay} onAutoPlay={setIsAutoPlay} />
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.4 }}
              className="flex flex-wrap items-center gap-2 mb-6">

              {isAdmin ? (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-gray-950"
                  style={{ background: `linear-gradient(to right,${ACCENT},${ACCENT2})`, boxShadow: `0 4px 20px ${ACCENT}28` }}>
                  <FiPlus size={14} />New Quote
                </motion.button>
              ) : (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-gray-950"
                  style={{ background: `linear-gradient(to right,${ACCENT},${ACCENT2})`, boxShadow: `0 4px 20px ${ACCENT}28` }}>
                  <FiEye size={14} />My Collection
                </motion.button>
              )}

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => setIsAutoPlay(p => !p)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border transition-all"
                style={isAutoPlay
                  ? { background:`${ACCENT}15`, borderColor:`${ACCENT}35`, color:ACCENT }
                  : { background:'rgba(255,255,255,0.05)', borderColor:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.45)' }
                }>
                {isAutoPlay ? <FiPause size={12}/> : <FiPlay size={12}/>}
                {isAutoPlay ? 'Pause' : 'Resume'}
              </motion.button>

              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.USER]}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-white/10 bg-white/5 text-white/50 hover:text-white hover:bg-white/8 transition-all">
                  <FiGrid size={13}/>Dashboard
                </motion.button>
              </RoleGuard>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => setContactOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-white/10 bg-white/5 text-white/50 hover:text-white hover:bg-white/8 transition-all">
                <FiMail size={13}/>Contact
              </motion.button>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => scrollTo('features')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-white/10 bg-white/5 text-white/50 hover:text-white hover:bg-white/8 transition-all">
                <FiArrowRight size={13}/>Explore
              </motion.button>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }} className="flex gap-3 flex-wrap">
              {[
                { v: isLoading ? '…' : `${allQuotes.length}+`, l: 'Quotes' },
                { v: '10s', l: 'Auto-rotate' },
                { v: 'Free', l: 'Always' },
              ].map(({ v, l }) => (
                <div key={l} className="flex flex-col items-center px-4 py-2 rounded-xl border border-white/8" style={{ background: SLATE }}>
                  <span className="text-[17px] font-black" style={{ color: ACCENT }}>{v}</span>
                  <span className="text-[10px] text-white/35 mt-0.5">{l}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* RIGHT — phone */}
          <motion.div initial={{ opacity: 0, y: 52 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, type: 'spring', stiffness: 52, damping: 14 }}
            className="shrink-0 hidden xl:flex items-center justify-center"
            style={{ filter: `drop-shadow(0 40px 60px ${ACCENT}1C)` }}>
            <DailyCard
              onContactOpen={() => setContactOpen(true)}
              onAddLyric={isAdmin ? () => setLyricOpen(true) : undefined}
            />
          </motion.div>

          {/* scroll hint */}
          <motion.button onClick={() => scrollTo('features')}
            animate={{ y:[0,7,0] }} transition={{ duration:2, repeat:Infinity }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/20 hover:text-white/40 transition-colors xl:hidden">
            <span className="text-[10px] uppercase tracking-widest">Scroll</span>
            <FiChevronDown size={16}/>
          </motion.button>
        </section>

        <Hr />

        {/* ══════════════════════════════════════════════
            §2  FEATURES
        ══════════════════════════════════════════════ */}
        <section id="features" className="py-24 px-4 sm:px-8 lg:px-16 max-w-7xl mx-auto">
          <SectionHead eyebrow="Platform features" title="Everything you need to thrive"
            sub="Damuchi is built for creators who want their wisdom to reach the world — beautifully and automatically." />

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[
              { icon: FiBookOpen, color: ACCENT,   title: 'Personal quote library',    desc: 'Build and manage your own curated collection of quotes, organised by category, author, and date added.', delay: 0 },
              { icon: FiStar,     color: '#818CF8', title: 'Favourites system',         desc: 'Bookmark quotes that resonate most. Access your saved gems instantly from your personal dashboard at any time.', delay: 0.07 },
              { icon: FiShield,   color: '#34D399', title: 'Role-based access control', desc: 'Three-tier system — Guest, User, Admin. Every action is gated by role and permission, keeping your data secure.', delay: 0.14 },
              { icon: FiZap,      color: '#FB923C', title: 'Auto-post to social media', desc: 'Connect X and LinkedIn. Schedule quotes to publish automatically as text or designed image cards.', badge: 'Soon', delay: 0.21 },
              { icon: FiActivity, color: '#F87171', title: 'Redis caching + rate limits',desc: 'All reads cached with 5-min TTL. Writes invalidate caches. Rate limiting via sliding-window counters.', delay: 0.28 },
              { icon: FiGlobe,    color: '#7DD3FC', title: 'Multi-platform ready',      desc: 'Responsive across all devices. Smooth animations, optimistic UI updates, and offline-friendly data caching.', delay: 0.35 },
            ].map(f => <FeatureCard key={f.title} {...f} />)}
          </div>

          {/* social post preview */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.5 }}
            className="p-8 rounded-3xl border border-white/8 relative overflow-hidden"
            style={{ background: `${SLATE}CC`, backdropFilter: 'blur(16px)' }}>
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-6 pointer-events-none"
                 style={{ background: ACCENT }} />
            <div className="relative grid md:grid-cols-2 gap-8 items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>Coming soon</span>
                <h3 className="text-[22px] font-black text-white mt-2 mb-3 tracking-tight">Auto-post quotes to X & LinkedIn</h3>
                <p className="text-[13px] text-white/50 leading-relaxed mb-5">
                  Select a quote, pick your format, set a schedule — Damuchi posts automatically via OAuth 2.0. Tokens are encrypted at rest.
                </p>
                <div className="flex gap-2.5">
                  {[{icon:FiTwitter,color:'#1DA1F2',label:'X (Twitter)'},{icon:FiLinkedin,color:'#0A66C2',label:'LinkedIn'}].map(({icon:Icon,color,label})=>(
                    <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/8" style={{background:`${color}12`}}>
                      <Icon size={13} style={{color}} /><span className="text-[12px] text-white/60">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {['Write quote','Pick format','Set schedule','Auto-published'].map((s,i)=>(
                  <div key={s} className="flex items-center gap-2.5 p-3 rounded-xl border border-white/6" style={{background:MID}}>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0"
                         style={{background:`${ACCENT}18`,color:ACCENT}}>{i+1}</div>
                    <span className="text-[12px] text-white/55">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        <Hr />

        {/* ══════════════════════════════════════════════
            §3  HOW IT WORKS
        ══════════════════════════════════════════════ */}
        <section id="how" className="py-24 px-4 sm:px-8 lg:px-16 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <SectionHead eyebrow="How it works" left
                title={<>From zero to curator<br/>in minutes</>}
                sub="Damuchi's approval flow ensures every member is verified and trusted." />
              <div className="space-y-0">
                {[
                  {num:1,icon:FiUsers,       color:ACCENT,   title:'Create an account',    desc:'Sign up with your email. Your account starts as a guest with read-only access to public quotes.',isLast:false,delay:0},
                  {num:2,icon:FiCheckCircle, color:'#4ade80',title:'Verify your email',     desc:'Click the verification link in your inbox. This confirms your identity and queues you for admin review.',isLast:false,delay:0.1},
                  {num:3,icon:FiClock,       color:'#818CF8',title:'Admin approval',         desc:'An admin reviews and approves your account. You receive a welcome email with full access unlocked.',isLast:false,delay:0.2},
                  {num:4,icon:FiZap,         color:ACCENT2,  title:'Full access activated', desc:'Create quotes, manage your collection, connect social accounts, and enjoy the full Damuchi experience.',isLast:true, delay:0.3},
                ].map(s=><StepRow key={s.num} {...s}/>)}
              </div>
            </div>

            <div className="space-y-4">
              <motion.div initial={{opacity:0,x:18}} whileInView={{opacity:1,x:0}}
                viewport={{once:true}} transition={{duration:0.5}}
                className="p-6 rounded-2xl border border-white/8" style={{background:SLATE}}>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/25 mb-4">Tech stack</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {[['Frontend','React 18 + Vite',ACCENT],['Animation','Framer Motion','#818CF8'],['State','Redux Toolkit','#34D399'],['Data','React Query','#FB923C'],['Backend','Node.js + Express','#38BDF8'],['Database','Firebase RTDB + Firestore','#F87171'],['Cache','Redis Cloud','#FCD34D'],['Email','Resend','#7DD3FC']].map(([label,value,color])=>(
                    <div key={label} className="flex flex-col gap-0.5 p-3 rounded-xl border border-white/6" style={{background:MID}}>
                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{color}}>{label}</span>
                      <span className="text-[12px] text-white/60">{value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div initial={{opacity:0,x:18}} whileInView={{opacity:1,x:0}}
                viewport={{once:true}} transition={{delay:0.15,duration:0.5}}
                className="p-6 rounded-2xl border border-white/8" style={{background:SLATE}}>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/25 mb-4">Security</p>
                <div className="space-y-2.5">
                  {[
                    {icon:FiLock,    color:'#34D399',text:'Firebase Auth — industry-standard JWT tokens'},
                    {icon:FiShield,  color:'#818CF8',text:'Role-based access control on every endpoint'},
                    {icon:FiActivity,color:ACCENT,   text:'Rate limiting — 60/min general, 10/15min auth'},
                    {icon:FiGlobe,   color:'#FB923C',text:'Redis sessions + full audit logging'},
                  ].map(({icon:Icon,color,text})=>(
                    <div key={text} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{background:`${color}18`}}>
                        <Icon size={13} style={{color}}/>
                      </div>
                      <p className="text-[12px] text-white/55 leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <Hr />

        {/* ══════════════════════════════════════════════
            §4  STATS
        ══════════════════════════════════════════════ */}
        <section id="stats" ref={statsRef} className="py-24 px-4 sm:px-8 lg:px-16 max-w-7xl mx-auto">
          <SectionHead eyebrow="By the numbers" title="Your collection at a glance"
            sub="Live data from your Damuchi account — updated in real time." />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <AnimatedStat value={allQuotes.length} suffix="+" label="Total quotes" icon={FiBookOpen} color={ACCENT} inView={statsInView} />
            <AnimatedStat value={new Set(allQuotes.map(q=>q.author)).size} label="Unique authors" icon={FiUsers} color="#818CF8" inView={statsInView} />
            <AnimatedStat value={new Set(allQuotes.map(q=>q.category).filter(Boolean)).size} label="Categories" icon={FiGrid} color="#34D399" inView={statsInView} />
            <AnimatedStat value={allQuotes.filter(q=>new Date(q.createdAt)>new Date(Date.now()-7*86400000)).length} label="This week" icon={FiTrendingUp} color="#FB923C" inView={statsInView} />
          </div>

          {topCats.length > 0 && (
            <motion.div initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}}
              viewport={{once:true}} transition={{duration:0.5}}
              className="p-6 rounded-2xl border border-white/8" style={{background:SLATE}}>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/25 mb-5">Category breakdown</p>
              <div className="space-y-3">
                {topCats.map(([cat,count])=>{
                  const color=catColor(cat), pct=Math.round((count/maxCat)*100);
                  return (
                    <div key={cat} className="flex items-center gap-4">
                      <span className="text-[12px] text-white/50 capitalize w-24 shrink-0">{cat}</span>
                      <div className="flex-1 h-2 bg-white/6 rounded-full overflow-hidden">
                        <motion.div initial={{width:0}} whileInView={{width:`${pct}%`}}
                          viewport={{once:true}} transition={{duration:0.7,delay:0.1,ease:'easeOut'}}
                          className="h-full rounded-full" style={{background:color}} />
                      </div>
                      <span className="text-[11px] text-white/30 tabular-nums w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </section>

        <Hr />

        {/* ══════════════════════════════════════════════
            §5  CONTACT
        ══════════════════════════════════════════════ */}
        <section id="contact" className="py-24 px-4 sm:px-8 lg:px-16 max-w-7xl mx-auto">
          <SectionHead eyebrow="Get in touch" title="We're here for you"
            sub="Questions, feedback, bug reports, or collaboration — we typically respond within 24 hours." />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              {icon:FiMail,    color:ACCENT,   title:'Email',   value:'hello@damuchi.app',href:'mailto:hello@damuchi.app'},
              {icon:FiTwitter, color:'#1DA1F2',title:'X',       value:'@DamuchiApp',      href:'https://twitter.com/damuchiapp'},
              {icon:FiLinkedin,color:'#0A66C2',title:'LinkedIn',value:'Damuchi',           href:'https://linkedin.com/company/damuchi'},
              {icon:FiBookOpen,color:'#34D399',title:'Docs',    value:'damuchi.app/docs',  href:'/docs'},
            ].map(({icon:Icon,color,title,value,href})=>(
              <motion.a key={title} href={href}
                target={href.startsWith('http')?'_blank':undefined}
                rel={href.startsWith('http')?'noopener noreferrer':undefined}
                initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}}
                viewport={{once:true}} transition={{duration:0.35}}
                whileHover={{y:-3}}
                className="flex flex-col gap-3 p-5 rounded-2xl border border-white/8 hover:border-white/15 transition-all group"
                style={{background:SLATE}}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:`${color}18`}}>
                  <Icon size={16} style={{color}}/>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-white/35 uppercase tracking-wide">{title}</p>
                  <p className="text-[13px] text-white/70 group-hover:text-white transition-colors mt-0.5">{value}</p>
                </div>
              </motion.a>
            ))}
          </div>

          <motion.div initial={{opacity:0,scale:0.98}} whileInView={{opacity:1,scale:1}}
            viewport={{once:true}}
            className="text-center p-12 rounded-3xl border border-white/8 relative overflow-hidden"
            style={{background:`${SLATE}CC`,backdropFilter:'blur(12px)'}}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[200px] rounded-full blur-[80px] opacity-8"
                   style={{background:ACCENT}}/>
            </div>
            <div className="relative">
              <div className="text-4xl mb-4">✨</div>
              <h3 className="text-[26px] font-black text-white mb-3 tracking-tight">Send us a message</h3>
              <p className="text-[14px] text-white/45 mb-7 max-w-md mx-auto leading-relaxed">
                Have a feature idea, found a bug, or want to collaborate? Open the contact form — we read every message.
              </p>
              <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}}
                onClick={() => setContactOpen(true)}
                className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl font-bold text-[14px] text-gray-950"
                style={{background:`linear-gradient(to right,${ACCENT},${ACCENT2})`,boxShadow:`0 8px 32px ${ACCENT}28`}}>
                <FiMail size={15}/>Open contact form
              </motion.button>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="py-8 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[8px] flex items-center justify-center font-black text-sm"
                   style={{background:`linear-gradient(135deg,${ACCENT},${ACCENT2})`,color:NAVY}}>D</div>
              <span className="font-extrabold text-[15px] text-white">Damu<span style={{color:ACCENT}}>chi</span></span>
            </div>
            <p className="text-[11px] text-white/20">© {new Date().getFullYear()} Damuchi · Built with purpose 🇰🇪</p>
            <div className="flex items-center gap-4">
              {[{href:'/docs',l:'Docs'},{href:'https://twitter.com/damuchiapp',l:'X'},{href:'/dashboard',l:'Dashboard'}].map(({href,l})=>(
                <a key={l} href={href} className="text-[11px] text-white/30 hover:text-white/65 transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Landing;