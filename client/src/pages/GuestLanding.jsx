// pages/GuestLanding.jsx
// Shown to: guests (no account), verified-but-not-approved users.
// Fetches guest-only public quotes. Admin controls those quotes.
// Has full Navbar, docs link, social links, contact.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { quotesApi } from '../utils/api';
import toast from 'react-hot-toast';
import {
  FiLogIn, FiUserPlus, FiBookOpen, FiZap, FiStar,
  FiArrowRight, FiExternalLink, FiTwitter, FiLinkedin,
  FiMail, FiChevronLeft, FiChevronRight, FiCopy, FiShare2,
  FiLock, FiCheckCircle, FiClock,
} from 'react-icons/fi';

const ACCENT  = '#F59E0B';
const ACCENT2 = '#F97316';
const NAVY    = '#0A0E1A';
const SLATE   = '#141924';

const CAT_META = {
  motivation:    { color: '#F59E0B', emoji: '🔥' },
  mindset:       { color: '#818CF8', emoji: '🧠' },
  discipline:    { color: '#34D399', emoji: '⚡' },
  success:       { color: '#A78BFA', emoji: '🏆' },
  resilience:    { color: '#FB923C', emoji: '💪' },
  inspiration:   { color: '#7DD3FC', emoji: '✨' },
  growth:        { color: '#2DD4BF', emoji: '🌱' },
};
const cc = (c) => CAT_META[c]?.color ?? '#6B7280';
const ce = (c) => CAT_META[c]?.emoji ?? '💬';

/* ── Quote carousel ─────────────────────────────────────────── */
const QuoteCarousel = ({ quotes = [] }) => {
  const [idx, setIdx] = useState(0);
  if (!quotes.length) return null;

  const q      = quotes[idx];
  const accent = cc(q?.category);
  const bump   = (d) => setIdx(i => (i + d + quotes.length) % quotes.length);

  const handleCopy = () => {
    navigator.clipboard.writeText(`"${q.text}" — ${q.author}`);
    toast.success('Copied!');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="w-full max-w-[560px] mx-auto"
    >
      <div className="rounded-3xl border border-white/8 overflow-hidden"
           style={{ background: SLATE }}>
        <div className="h-[2px]"
             style={{ background: `linear-gradient(to right, ${accent}88, ${accent}11)` }} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-[0.1em]"
                  style={{ background: `${accent}18`, color: accent }}>
              {ce(q?.category)} {q?.category}
            </span>
            <span className="text-[11px] text-white/20 tabular-nums">
              {idx + 1} / {quotes.length}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={q?.id ?? idx}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <div className="text-[32px] leading-none font-serif mb-2 select-none"
                   style={{ color: `${accent}30` }}>&ldquo;</div>
              <p className="text-[15px] leading-[1.75] text-white/80 font-medium mb-3">{q?.text}</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]"
                 style={{ color: accent }}>— {q?.author}</p>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/6">
            <div className="flex gap-1.5">
              {[-1, 1].map((d, i) => (
                <motion.button key={i} whileTap={{ scale: 0.88 }} onClick={() => bump(d)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/8 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-all">
                  {d < 0 ? <FiChevronLeft size={14} /> : <FiChevronRight size={14} />}
                </motion.button>
              ))}
            </div>
            <div className="flex gap-1">
              {quotes.slice(0, Math.min(quotes.length, 6)).map((_, i) => (
                <button key={i} onClick={() => setIdx(i)}
                  className="rounded-full transition-all"
                  style={i === idx
                    ? { width: 14, height: 4, background: accent }
                    : { width: 4, height: 4, background: 'rgba(255,255,255,0.2)' }
                  } />
              ))}
            </div>
            <motion.button whileTap={{ scale: 0.88 }} onClick={handleCopy}
              className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/8 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-all">
              <FiCopy size={13} />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ── Step card ───────────────────────────────────────────────── */
const StepCard = ({ num, title, desc, icon: Icon, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.4 }}
    className="flex flex-col gap-3 p-5 rounded-2xl border border-white/8"
    style={{ background: SLATE }}
  >
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black"
           style={{ background: `${color}18`, color }}>
        {num}
      </div>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center"
           style={{ background: `${color}10` }}>
        <Icon size={15} style={{ color }} />
      </div>
    </div>
    <h3 className="text-[14px] font-bold text-white">{title}</h3>
    <p className="text-[12px] text-white/45 leading-relaxed">{desc}</p>
  </motion.div>
);

/* ── Main ────────────────────────────────────────────────────── */
const GuestLanding = () => {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const isApprovalPending = user?.emailVerified && !user?.adminApproved;

  /* fetch guest quotes (public endpoint) */
  const { data, isLoading } = useQuery({
    queryKey: ['guestQuotes'],
    queryFn:  () => quotesApi.getAll({ type: 'guest' }),
    staleTime: 5 * 60_000,
  });
  const quotes = data?.quotes ?? [];

  const steps = [
    { num: '01', icon: FiUserPlus,    color: ACCENT,    title: 'Create account',      desc: 'Sign up with your email. Takes under 30 seconds.' },
    { num: '02', icon: FiCheckCircle, color: '#4ade80', title: 'Verify your email',   desc: 'Click the link we send you to confirm your address.' },
    { num: '03', icon: FiClock,       color: '#818CF8', title: 'Await admin approval', desc: 'We review each account to maintain quality. Usually within 24h.' },
    { num: '04', icon: FiZap,         color: ACCENT2,   title: 'Full access unlocked', desc: 'Create, share and manage your personal quote collection.' },
  ];

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: NAVY }}>
      <Navbar />

      <main className="pt-16">

        {/* ── APPROVAL PENDING BANNER ── */}
        {isApprovalPending && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-b border-amber-500/20"
            style={{ background: 'rgba(245,158,11,0.08)' }}
          >
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
              <FiClock size={14} style={{ color: ACCENT }} className="shrink-0" />
              <p className="text-[13px] text-white/70">
                <span className="font-semibold text-amber-400">Verification complete!</span>
                {' '}Your account is pending admin approval. You'll receive an email once approved.
              </p>
              <button onClick={() => { logout(); navigate('/auth/login'); }}
                className="ml-auto text-[11px] text-white/30 hover:text-white/60 transition-colors shrink-0">
                Sign out
              </button>
            </div>
          </motion.div>
        )}

        {/* ── HERO ── */}
        <section className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center
                            gap-12 px-4 sm:px-8 py-16 max-w-5xl mx-auto">

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl"
          >
            {/* eyebrow */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 mb-6"
                 style={{ background: 'rgba(245,158,11,0.08)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: ACCENT }}>
                {isApprovalPending ? 'Awaiting Approval' : 'Guest Preview'}
              </span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.05] mb-5">
              Words that<br />
              <span className="bg-clip-text text-transparent"
                    style={{ backgroundImage: `linear-gradient(to right, ${ACCENT}, ${ACCENT2})` }}>
                ignite action.
              </span>
            </h1>

            <p className="text-[15px] text-white/45 leading-relaxed mb-8 max-w-md mx-auto">
              {isApprovalPending
                ? 'Your email is verified. Hang tight — an admin will approve your account shortly. Meanwhile, explore our curated quotes.'
                : 'Discover wisdom from great minds. Create an account to build your personal collection, share insights, and automate posting to social media.'
              }
            </p>

            {!isApprovalPending && (
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/auth/register')}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-[14px] text-gray-950 shadow-lg"
                  style={{ background: `linear-gradient(to right, ${ACCENT}, ${ACCENT2})`, boxShadow: `0 4px 24px ${ACCENT}30` }}>
                  <FiUserPlus size={15} />Get started — free
                </motion.button>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/auth/login')}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl font-medium text-[14px] border border-white/12 bg-white/5 hover:bg-white/8 text-white/70 transition-all">
                  <FiLogIn size={14} />Sign in
                </motion.button>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/docs')}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl font-medium text-[14px] border border-white/8 text-white/40 hover:text-white/65 transition-all">
                  <FiBookOpen size={14} />Learn more <FiArrowRight size={12} />
                </motion.button>
              </div>
            )}
          </motion.div>

          {/* quote carousel */}
          {isLoading
            ? <div className="w-full max-w-[560px] mx-auto rounded-3xl border border-white/8 p-6 animate-pulse" style={{ background: SLATE }}>
                <div className="h-4 bg-white/8 rounded-full w-1/4 mb-4" />
                <div className="space-y-2 mb-4">
                  <div className="h-3 bg-white/6 rounded-full" />
                  <div className="h-3 bg-white/6 rounded-full w-5/6" />
                  <div className="h-3 bg-white/6 rounded-full w-3/4" />
                </div>
                <div className="h-2.5 bg-white/5 rounded-full w-1/3" />
              </div>
            : <QuoteCarousel quotes={quotes} />
          }
        </section>

        {/* ── HOW IT WORKS ── */}
        {!isApprovalPending && (
          <section className="py-16 px-4 sm:px-8 max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: ACCENT }}>
                How it works
              </span>
              <h2 className="text-3xl sm:text-4xl font-black mt-2 text-white tracking-tight">
                From guest to creator
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {steps.map((s, i) => (
                <StepCard key={s.num} {...s} delay={i * 0.08} />
              ))}
            </div>
          </section>
        )}

        {/* ── LOCKED FEATURES PREVIEW ── */}
        <section className="py-16 px-4 sm:px-8 max-w-5xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: ACCENT }}>
              Member features
            </span>
            <h2 className="text-3xl font-black mt-2 text-white tracking-tight">
              Unlock the full experience
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: FiBookOpen, color: ACCENT,    title: 'Personal collection', desc: 'Build, organise and search your own quote library.' },
              { icon: FiStar,     color: '#818CF8', title: 'Favourites',          desc: 'Bookmark quotes that resonate with you.' },
              { icon: FiZap,      color: '#34D399', title: 'Auto-post to X & LinkedIn', desc: 'Schedule quotes to post automatically to your social profiles.' },
            ].map(({ icon: Icon, color, title, desc }, i) => (
              <motion.div key={title}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.4 }}
                className="relative p-5 rounded-2xl border border-white/8 overflow-hidden group"
                style={{ background: SLATE }}>
                <div className="absolute top-3 right-3 w-6 h-6 rounded-lg flex items-center justify-center"
                     style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <FiLock size={10} className="text-white/30" />
                </div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                     style={{ background: `${color}18` }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <h3 className="text-[14px] font-bold text-white mb-1.5">{title}</h3>
                <p className="text-[12px] text-white/40 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        {!isApprovalPending && (
          <section className="py-16 px-4 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="max-w-lg mx-auto rounded-3xl p-10 border border-white/8"
              style={{ background: `${SLATE}CC`, backdropFilter: 'blur(16px)' }}
            >
              <div className="text-4xl mb-4">✨</div>
              <h2 className="text-[24px] font-black text-white mb-3">Join Damuchi</h2>
              <p className="text-[13px] text-white/45 mb-6">
                Free. No credit card. Just wisdom at your fingertips.
              </p>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/auth/register')}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-[14px] text-gray-950"
                style={{ background: `linear-gradient(to right, ${ACCENT}, ${ACCENT2})` }}>
                <FiUserPlus size={15} />Create free account
              </motion.button>
            </motion.div>
          </section>
        )}

        {/* ── FOOTER ── */}
        <footer className="py-8 px-4 border-t border-white/5">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[8px] flex items-center justify-center font-black text-sm"
                   style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, color: '#0A0E1A' }}>D</div>
              <span className="font-extrabold text-[15px] text-white">
                Damu<span style={{ color: ACCENT }}>chi</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://twitter.com/damuchi" target="_blank" rel="noopener noreferrer"
                 className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/8 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
                <FiTwitter size={14} />
              </a>
              <a href="https://linkedin.com/company/damuchi" target="_blank" rel="noopener noreferrer"
                 className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/8 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
                <FiLinkedin size={14} />
              </a>
              <a href="/docs"
                 className="text-[12px] text-white/35 hover:text-white/65 transition-colors flex items-center gap-1">
                <FiBookOpen size={12} />Docs
              </a>
              <a href="mailto:hello@damuchi.app"
                 className="text-[12px] text-white/35 hover:text-white/65 transition-colors flex items-center gap-1">
                <FiMail size={12} />Contact
              </a>
            </div>
            <p className="text-[11px] text-white/20">
              © {new Date().getFullYear()} Damuchi
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default GuestLanding;