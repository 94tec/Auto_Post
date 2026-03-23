// pages/DocsPage.jsx
// 3-section chained docs: Overview → Features → API Reference
// Smooth scroll nav, modal for social auth, responsive, production-ready.

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  FiBookOpen, FiZap, FiCode, FiTwitter, FiLinkedin,
  FiShield, FiUsers, FiStar, FiArrowRight, FiX,
  FiCheck, FiChevronRight, FiExternalLink, FiMail,
  FiClock, FiGlobe, FiLock, FiActivity, FiPackage,
  FiCopy, FiCheckCircle, FiMenu,
} from 'react-icons/fi';

const ACCENT  = '#F59E0B';
const ACCENT2 = '#F97316';
const NAVY    = '#0A0E1A';
const SLATE   = '#141924';

/* ── Code block ─────────────────────────────────────────────── */
const CodeBlock = ({ code, lang = 'bash' }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-2xl border border-white/8 overflow-hidden my-4"
         style={{ background: '#0D1017' }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/6">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">{lang}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors">
          {copied ? <FiCheckCircle size={12} className="text-green-400" /> : <FiCopy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="px-4 py-4 text-[12px] text-white/70 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};

/* ── Feature badge ───────────────────────────────────────────── */
const Badge = ({ label, color }) => (
  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-[0.1em]"
        style={{ background: `${color}18`, color }}>
    {label}
  </span>
);

/* ── Social modal ────────────────────────────────────────────── */
const SocialModal = ({ platform, onClose }) => {
  const cfg = {
    twitter:  { icon: FiTwitter,  color: '#1DA1F2', name: 'X (Twitter)', handle: '@DamuchiApp', url: 'https://twitter.com/damuchiapp' },
    linkedin: { icon: FiLinkedin, color: '#0A66C2', name: 'LinkedIn',    handle: 'Damuchi',     url: 'https://linkedin.com/company/damuchi' },
  }[platform];
  if (!cfg) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 16 }} transition={{ duration: 0.22, ease: [0.22,1,0.36,1] }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-white/10 overflow-hidden"
        style={{ background: '#141924', boxShadow: '0 24px 48px rgba(0,0,0,0.6)' }}>
        <div className="h-[3px]" style={{ background: cfg.color }} />
        <div className="p-7">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                 style={{ background: `${cfg.color}20` }}>
              <cfg.icon size={20} style={{ color: cfg.color }} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-white">{cfg.name}</h3>
              <p className="text-[12px] text-white/40">{cfg.handle}</p>
            </div>
            <button onClick={onClose} className="ml-auto w-7 h-7 rounded-xl flex items-center justify-center bg-white/6 text-white/40 hover:text-white transition-colors">
              <FiX size={13} />
            </button>
          </div>
          <p className="text-[13px] text-white/55 leading-relaxed mb-5">
            Follow Damuchi on {cfg.name} for daily inspiration, product updates, and community quotes.
            Auto-posting your quotes to {cfg.name} is a premium feature coming soon.
          </p>
          <div className="flex gap-2.5">
            <a href={cfg.url} target="_blank" rel="noopener noreferrer"
               className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl font-semibold text-[13px] text-white transition-all"
               style={{ background: cfg.color }}>
              <FiExternalLink size={13} />Follow us
            </a>
            <button onClick={onClose}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl font-medium text-[13px] border border-white/10 bg-white/5 text-white/55 hover:text-white hover:bg-white/8 transition-all">
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ── Section heading ─────────────────────────────────────────── */
const SectionHead = ({ eyebrow, title, sub }) => (
  <div className="mb-10">
    <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: ACCENT }}>{eyebrow}</span>
    <h2 className="text-[28px] sm:text-[34px] font-black text-white tracking-tight mt-1 mb-2">{title}</h2>
    {sub && <p className="text-[14px] text-white/45 max-w-lg leading-relaxed">{sub}</p>}
  </div>
);

/* ── Main ────────────────────────────────────────────────────── */
const DocsPage = () => {
  const navigate      = useNavigate();
  const [modal, setModal]     = useState(null); // 'twitter' | 'linkedin' | null
  const [mobileNav, setMobileNav] = useState(false);
  const [activeSection, setActive] = useState('overview');

  const sections = [
    { id: 'overview',  label: 'Overview',      icon: FiBookOpen },
    { id: 'features',  label: 'Features',      icon: FiZap      },
    { id: 'api',       label: 'API Reference',  icon: FiCode     },
    { id: 'social',    label: 'Social Posting', icon: FiTwitter  },
    { id: 'contact',   label: 'Contact',        icon: FiMail     },
  ];

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileNav(false);
  };

  // Highlight active section on scroll
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: '-30% 0px -60% 0px' }
    );
    sections.forEach(s => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="min-h-screen text-white" style={{ background: NAVY }}>
      <Navbar />

      {/* Social modal */}
      <AnimatePresence>
        {modal && <SocialModal platform={modal} onClose={() => setModal(null)} />}
      </AnimatePresence>

      <div className="pt-16 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex gap-8 py-12">

          {/* ── Sidebar nav (desktop) ── */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/25 mb-4 px-3">
                Contents
              </p>
              {sections.map(s => (
                <button key={s.id} onClick={() => scrollTo(s.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all"
                  style={activeSection === s.id
                    ? { background: `${ACCENT}15`, color: ACCENT }
                    : { color: 'rgba(255,255,255,0.4)' }
                  }>
                  <s.icon size={13} />{s.label}
                  {activeSection === s.id && <FiChevronRight size={11} className="ml-auto" />}
                </button>
              ))}

              <div className="mt-6 pt-4 border-t border-white/6 space-y-2">
                <button onClick={() => setModal('twitter')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium text-white/35 hover:text-white/65 hover:bg-white/5 transition-all">
                  <FiTwitter size={12} style={{ color: '#1DA1F2' }} />X (Twitter)
                </button>
                <button onClick={() => setModal('linkedin')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium text-white/35 hover:text-white/65 hover:bg-white/5 transition-all">
                  <FiLinkedin size={12} style={{ color: '#0A66C2' }} />LinkedIn
                </button>
              </div>
            </div>
          </aside>

          {/* ── Mobile nav ── */}
          <div className="lg:hidden fixed bottom-6 right-4 z-40">
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => setMobileNav(o => !o)}
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, color: '#0A0E1A' }}>
              {mobileNav ? <FiX size={18} /> : <FiMenu size={18} />}
            </motion.button>
            <AnimatePresence>
              {mobileNav && (
                <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }} transition={{ duration: 0.18 }}
                  className="absolute bottom-14 right-0 w-48 rounded-2xl border border-white/10 overflow-hidden"
                  style={{ background: '#1C2535', boxShadow: '0 16px 32px rgba(0,0,0,0.5)' }}>
                  {sections.map(s => (
                    <button key={s.id} onClick={() => scrollTo(s.id)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-[13px] font-medium text-white/60 hover:bg-white/8 hover:text-white transition-colors">
                      <s.icon size={13} />{s.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Main content ── */}
          <main className="flex-1 min-w-0 space-y-24">

            {/* PAGE 1 — OVERVIEW */}
            <section id="overview">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 mb-6"
                     style={{ background: `${ACCENT}10` }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: ACCENT }}>Documentation</span>
                </div>

                <h1 className="text-[40px] sm:text-[52px] font-black tracking-tight leading-[1.04] mb-5">
                  <span className="text-white">Damuchi</span><br />
                  <span className="bg-clip-text text-transparent"
                        style={{ backgroundImage: `linear-gradient(to right,${ACCENT},${ACCENT2})` }}>
                    App Guide
                  </span>
                </h1>
                <p className="text-[15px] text-white/50 leading-relaxed mb-8 max-w-xl">
                  Damuchi is a daily inspiration platform for curating, managing, and sharing
                  powerful quotes — with built-in social media automation for X and LinkedIn.
                </p>

                <div className="flex flex-wrap gap-2 mb-10">
                  {['React + Vite', 'Node.js', 'Firebase', 'Redis', 'React Query', 'Framer Motion'].map(t => (
                    <Badge key={t} label={t} color={ACCENT} />
                  ))}
                </div>

                {/* Quick start */}
                <div className="rounded-2xl border border-white/8 p-6" style={{ background: SLATE }}>
                  <h3 className="text-[16px] font-bold text-white mb-4">Quick start</h3>
                  <CodeBlock lang="bash" code={`# 1. Clone and install
git clone https://github.com/your-org/damuchi.git
cd damuchi && npm install

# 2. Set environment variables
cp .env.example .env   # fill in Firebase + Redis + Resend keys

# 3. Seed admin account
node server/scripts/seedAdmin.js

# 4. Run development servers
npm run dev        # client (Vite, port 5173)
npm run server     # backend (Node, port 3000)`} />
                </div>

                {/* Architecture overview */}
                <div className="mt-8 grid sm:grid-cols-3 gap-4">
                  {[
                    { icon: FiGlobe,   color: ACCENT,    title: 'Frontend',  items: ['React 18 + Vite', 'Framer Motion', 'React Query', 'Redux Toolkit', 'Tailwind CSS'] },
                    { icon: FiPackage, color: '#818CF8',  title: 'Backend',   items: ['Node.js + Express', 'Firebase Admin SDK', 'Redis (caching)', 'Socket.io', 'Resend (email)'] },
                    { icon: FiShield,  color: '#34D399',  title: 'Security',  items: ['Firebase Auth tokens', 'Role-based access', 'Rate limiting', 'Session tracking', 'Audit logging'] },
                  ].map(({ icon: Icon, color, title, items }) => (
                    <div key={title} className="p-5 rounded-2xl border border-white/8" style={{ background: '#0D1220' }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-4"
                           style={{ background: `${color}18` }}>
                        <Icon size={15} style={{ color }} />
                      </div>
                      <h4 className="text-[13px] font-bold text-white mb-3">{title}</h4>
                      <ul className="space-y-1.5">
                        {items.map(it => (
                          <li key={it} className="flex items-center gap-2 text-[12px] text-white/45">
                            <FiCheck size={10} style={{ color }} className="shrink-0" />{it}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </motion.div>
            </section>

            {/* PAGE 2 — FEATURES */}
            <section id="features">
              <SectionHead eyebrow="Platform features" title="Everything you need"
                sub="Damuchi is built for creators who want their wisdom to reach the world automatically." />

              <div className="space-y-6">
                {[
                  { icon: FiUsers,    color: '#818CF8', title: 'Role-based access control',
                    desc: 'Three-tier system: Guest → User → Admin. Guests browse public quotes. Users create their own collection after email verification + admin approval. Admins manage everything.',
                    code: `// Roles
GUEST  → read public quotes only
USER   → create, edit, delete own quotes
ADMIN  → manage all resources + users` },
                  { icon: FiStar,     color: ACCENT,    title: 'Personal quote library',
                    desc: 'Each user gets their own curated collection. Add, edit, tag by category, and mark favourites. The dashboard fetches only your own quotes for privacy.',
                    code: null },
                  { icon: FiLock,     color: '#34D399', title: 'Two-step guest approval',
                    desc: 'New registrations start as guests. Email verification triggers an admin notification. Admin reviews and approves — user instantly gets write access and receives a welcome email.',
                    code: `// Auth flow
Register → guest (pending)
Verify email → guest (awaiting)  ← admin notified
Admin approves → user (active)   ← welcome email sent` },
                  { icon: FiActivity, color: '#FB923C', title: 'Redis caching + rate limiting',
                    desc: 'All read endpoints are cached in Redis with 5-minute TTL. Writes invalidate relevant cache keys. Rate limiting uses sliding-window Lua scripts — 60 req/min general, 10/15min on auth.',
                    code: null },
                  { icon: FiZap,      color: '#F87171', title: 'Auto-post to X & LinkedIn',
                    desc: 'Schedule or instantly post quotes (text or designed image cards) to your connected social accounts. Built on OAuth 2.0 — your tokens are encrypted before storage.',
                    code: null },
                ].map(({ icon: Icon, color, title, desc, code }) => (
                  <motion.div key={title} initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                    className="p-6 rounded-2xl border border-white/8" style={{ background: SLATE }}>
                    <div className="flex items-start gap-4">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                           style={{ background: `${color}18` }}>
                        <Icon size={16} style={{ color }} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-[15px] font-bold text-white mb-2">{title}</h3>
                        <p className="text-[13px] text-white/50 leading-relaxed">{desc}</p>
                        {code && <CodeBlock code={code} lang="text" />}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* PAGE 3 — API REFERENCE */}
            <section id="api">
              <SectionHead eyebrow="API reference" title="REST endpoints"
                sub="All authenticated endpoints require a Firebase ID token in the Authorization header." />

              <div className="space-y-4">
                {[
                  { method: 'GET',    path: '/api/quotes',              auth: false, desc: 'List all public quotes. Supports ?category= and ?pageSize=' },
                  { method: 'GET',    path: '/api/quotes/my',           auth: true,  desc: 'List the authenticated user\'s own quotes only' },
                  { method: 'GET',    path: '/api/quotes/:id',          auth: false, desc: 'Get a single quote by ID' },
                  { method: 'POST',   path: '/api/quotes',              auth: true,  desc: 'Create a quote (requires write permission)' },
                  { method: 'PATCH',  path: '/api/quotes/:id',          auth: true,  desc: 'Update a quote (owner or admin only)' },
                  { method: 'DELETE', path: '/api/quotes/:id',          auth: true,  desc: 'Delete a quote (owner with delete perm, or admin)' },
                  { method: 'POST',   path: '/api/auth/register',       auth: false, desc: 'Register new account (starts as guest)' },
                  { method: 'POST',   path: '/api/auth/login',          auth: false, desc: 'Exchange Firebase idToken for session data + role' },
                  { method: 'POST',   path: '/api/auth/verify-email',   auth: false, desc: 'Confirm email with oobCode from Firebase link' },
                  { method: 'GET',    path: '/api/admin/stats',         auth: true,  desc: 'System stats — admin only' },
                  { method: 'GET',    path: '/api/admin/approval-queue',auth: true,  desc: 'Users awaiting admin approval' },
                  { method: 'POST',   path: '/api/admin/users/:uid/approve', auth: true, desc: 'Approve a guest user' },
                ].map(({ method, path, auth, desc }) => {
                  const mc = { GET:'#34D399', POST:'#818CF8', PATCH:ACCENT, DELETE:'#f87171' }[method] ?? '#6B7280';
                  return (
                    <div key={path} className="flex flex-col sm:flex-row gap-3 p-4 rounded-xl border border-white/6"
                         style={{ background: '#0D1220' }}>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md min-w-[52px] text-center"
                              style={{ background: `${mc}18`, color: mc }}>{method}</span>
                        {!auth && <span className="text-[9px] px-2 py-0.5 rounded-md bg-white/6 text-white/30">public</span>}
                      </div>
                      <code className="text-[12px] text-white/70 font-mono flex-1">{path}</code>
                      <p className="text-[12px] text-white/40 sm:text-right">{desc}</p>
                    </div>
                  );
                })}
              </div>

              <CodeBlock lang="javascript" code={`// Example: fetch authenticated quotes
const token = await firebase.auth().currentUser.getIdToken();

const res = await fetch('/api/quotes/my', {
  headers: { Authorization: \`Bearer \${token}\` },
});
const { quotes } = await res.json();`} />
            </section>

            {/* PAGE 4 — SOCIAL POSTING */}
            <section id="social">
              <SectionHead eyebrow="Social automation" title="Post to X & LinkedIn"
                sub="Connect your social accounts and let Damuchi handle publishing your quotes automatically." />

              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                {[
                  { platform: 'twitter',  icon: FiTwitter,  color: '#1DA1F2', name: 'X (Twitter)', status: 'Coming soon' },
                  { platform: 'linkedin', icon: FiLinkedin, color: '#0A66C2', name: 'LinkedIn',     status: 'Coming soon' },
                ].map(({ platform, icon: Icon, color, name, status }) => (
                  <motion.div key={platform} whileHover={{ y: -2 }}
                    className="p-5 rounded-2xl border border-white/8 cursor-pointer transition-all hover:border-white/15"
                    style={{ background: SLATE }}
                    onClick={() => setModal(platform)}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                           style={{ background: `${color}15` }}>
                        <Icon size={20} style={{ color }} />
                      </div>
                      <Badge label={status} color={ACCENT} />
                    </div>
                    <h3 className="text-[15px] font-bold text-white mb-1">{name}</h3>
                    <p className="text-[12px] text-white/40 leading-relaxed">
                      Connect your {name} account to auto-publish quotes as text or designed image cards.
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 text-[11px]" style={{ color }}>
                      <FiExternalLink size={11} />Follow us on {name}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="p-6 rounded-2xl border border-white/8" style={{ background: SLATE }}>
                <h3 className="text-[15px] font-bold text-white mb-3">Planned posting workflow</h3>
                <div className="space-y-3">
                  {['Write or select a quote', 'Choose post format: text or image card', 'Pick schedule: now, or set date/time', 'Platform posts automatically via OAuth 2.0'].map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black"
                           style={{ background: `${ACCENT}18`, color: ACCENT }}>{i + 1}</div>
                      <p className="text-[13px] text-white/60">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* PAGE 5 — CONTACT */}
            <section id="contact">
              <SectionHead eyebrow="Get in touch" title="We're here to help"
                sub="Whether you have a question, found a bug, or want to collaborate — reach out." />

              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                {[
                  { icon: FiMail,     color: ACCENT,    title: 'Email support', desc: 'hello@damuchi.app', link: 'mailto:hello@damuchi.app' },
                  { icon: FiTwitter,  color: '#1DA1F2', title: 'X (Twitter)',   desc: '@DamuchiApp',       link: 'https://twitter.com/damuchiapp' },
                  { icon: FiLinkedin, color: '#0A66C2', title: 'LinkedIn',      desc: 'Damuchi Company',   link: 'https://linkedin.com/company/damuchi' },
                  { icon: FiGlobe,    color: '#34D399', title: 'Website',       desc: 'damuchi.app',       link: 'https://damuchi.app' },
                ].map(({ icon: Icon, color, title, desc, link }) => (
                  <a key={title} href={link} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-4 p-4 rounded-2xl border border-white/8 hover:border-white/15 transition-all group"
                     style={{ background: SLATE }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                         style={{ background: `${color}18` }}>
                      <Icon size={16} style={{ color }} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-white">{title}</p>
                      <p className="text-[12px] text-white/40">{desc}</p>
                    </div>
                    <FiArrowRight size={14} className="ml-auto text-white/20 group-hover:text-white/50 transition-colors" />
                  </a>
                ))}
              </div>

              {/* CTA back to app */}
              <motion.div whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 12 }}
                viewport={{ once: true }}
                className="text-center p-10 rounded-3xl border border-white/8"
                style={{ background: `${SLATE}CC`, backdropFilter: 'blur(12px)' }}>
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: ACCENT }}>
                  Ready to start?
                </p>
                <h3 className="text-[24px] font-black text-white mb-4">Back to Damuchi</h3>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-[13px] text-gray-950"
                    style={{ background: `linear-gradient(to right, ${ACCENT}, ${ACCENT2})` }}>
                    <FiArrowRight size={14} />Go to landing
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/auth/login')}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl font-medium text-[13px] border border-white/10 bg-white/5 text-white/60 hover:text-white transition-all">
                    Sign in
                  </motion.button>
                </div>
              </motion.div>
            </section>

          </main>
        </div>
      </div>
    </div>
  );
};

export default DocsPage;