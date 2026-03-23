// components/ContactModal.jsx
// Full-featured contact modal: animated form, social links,
// success state, validation, email send via /api/contact.
// Usage: <ContactModal isOpen={open} onClose={() => setOpen(false)} />

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX, FiMail, FiUser, FiMessageSquare, FiSend,
  FiTwitter, FiLinkedin, FiCheckCircle, FiAlertCircle,
  FiRefreshCw, FiPhone, FiMapPin,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const ACCENT  = '#F59E0B';
const ACCENT2 = '#F97316';

const TOPICS = [
  'General enquiry',
  'Bug report',
  'Feature request',
  'Partnership',
  'Account issue',
  'Other',
];

/* ── Input ─────────────────────────────────────────────────── */
const Field = ({ label, icon: Icon, error, children }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5"
           style={{ color: error ? '#f87171' : `${ACCENT}90` }}>
      {label}
    </label>
    <div className="relative">
      <Icon size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
           style={{ color: error ? '#f87171' : 'rgba(255,255,255,0.25)' }} />
      {children}
    </div>
    <AnimatePresence>
      {error && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }} className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
          <FiAlertCircle size={10} />{error}
        </motion.p>
      )}
    </AnimatePresence>
  </div>
);

const inputCls = (err) =>
  `w-full pl-10 pr-4 py-3 rounded-2xl border text-[13px] text-white/80 placeholder-white/20
   focus:outline-none focus:ring-1 transition-all bg-[#0D1017]
   ${err
     ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/15'
     : 'border-white/8 focus:border-amber-500/40 focus:ring-amber-500/15'
   }`;

/* ── Success state ─────────────────────────────────────────── */
const SuccessView = ({ onClose }) => (
  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center py-10 px-6 text-center">
    <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.5, times: [0, 0.5, 1] }}
      className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-5"
      style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)' }}>
      <FiCheckCircle size={28} className="text-green-400" />
    </motion.div>
    <h3 className="text-[20px] font-black text-white mb-2">Message sent!</h3>
    <p className="text-[13px] text-white/45 leading-relaxed mb-7 max-w-xs">
      Thanks for reaching out. We typically respond within 24 hours.
    </p>
    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onClose}
      className="px-8 py-3 rounded-2xl font-bold text-[13px] text-gray-950"
      style={{ background: `linear-gradient(to right, ${ACCENT}, ${ACCENT2})` }}>
      Close
    </motion.button>
  </motion.div>
);

/* ── Main modal ────────────────────────────────────────────── */
const ContactModal = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  const [form, setForm] = useState({
    name:    user?.displayName || '',
    email:   user?.email       || '',
    topic:   TOPICS[0],
    message: '',
  });
  const [errors,    setErrors]    = useState({});
  const [sending,   setSending]   = useState(false);
  const [success,   setSuccess]   = useState(false);

  // Pre-fill from user
  useEffect(() => {
    if (user) setForm(f => ({ ...f, name: user.displayName || '', email: user.email || '' }));
  }, [user]);

  // Close on Escape
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const validate = () => {
    const e = {};
    if (!form.name.trim())                      e.name    = 'Name is required';
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email   = 'Valid email required';
    if (form.message.trim().length < 10)        e.message = 'Message must be at least 10 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to send');
      setSuccess(true);
    } catch {
      toast.error('Failed to send message. Please try emailing us directly.');
    } finally {
      setSending(false);
    }
  };

  const set = (key) => (e) => {
    setForm(f => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors(er => ({ ...er, [key]: undefined }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* backdrop */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />

          {/* panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1,    y: 0   }}
            exit={{    opacity: 0, scale: 0.96, y: 20   }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh]
                            overflow-y-auto rounded-t-[28px] sm:rounded-[28px] border border-white/10"
                 style={{ background: '#141924', boxShadow: '0 32px 64px rgba(0,0,0,0.7)' }}>

              <div className="h-[3px] rounded-t-[28px] sm:rounded-t-[28px]"
                   style={{ background: `linear-gradient(to right, ${ACCENT}, ${ACCENT2}, transparent)` }} />

              <div className="p-6 sm:p-7">

                {/* header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-[20px] font-black text-white tracking-tight">Get in touch</h2>
                    <p className="text-[12px] text-white/40 mt-0.5">We reply within 24 hours.</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
                    className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/6 border border-white/8 text-white/40 hover:text-white transition-colors">
                    <FiX size={14} />
                  </motion.button>
                </div>

                {success ? <SuccessView onClose={onClose} /> : (
                  <div className="space-y-5">

                    {/* social + info strip */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { icon: FiMail,    label: 'Email',    value: 'hello@damuchi.app', href: 'mailto:hello@damuchi.app', color: ACCENT },
                        { icon: FiTwitter, label: 'X',        value: '@DamuchiApp',       href: 'https://twitter.com/damuchiapp', color: '#1DA1F2' },
                        { icon: FiLinkedin,label: 'LinkedIn', value: 'Damuchi',            href: 'https://linkedin.com/company/damuchi', color: '#0A66C2' },
                      ].map(({ icon: Icon, label, value, href, color }) => (
                        <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                           className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-white/8 hover:border-white/15 transition-all group"
                           style={{ background: '#0D1220' }}>
                          <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                               style={{ background: `${color}18` }}>
                            <Icon size={14} style={{ color }} />
                          </div>
                          <span className="text-[9px] font-semibold text-white/50 group-hover:text-white/75 transition-colors">{label}</span>
                        </a>
                      ))}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-white/6" />
                      <span className="text-[10px] text-white/25">or send a message</span>
                      <div className="flex-1 h-px bg-white/6" />
                    </div>

                    {/* form */}
                    <form onSubmit={handleSubmit} className="space-y-4">

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Your name" icon={FiUser} error={errors.name}>
                          <input value={form.name} onChange={set('name')} placeholder="Jane Doe"
                            className={inputCls(errors.name)} />
                        </Field>
                        <Field label="Email" icon={FiMail} error={errors.email}>
                          <input type="email" value={form.email} onChange={set('email')}
                            placeholder="you@example.com" className={inputCls(errors.email)} />
                        </Field>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-amber-500/70 mb-1.5">
                          Topic
                        </label>
                        <select value={form.topic} onChange={set('topic')}
                          className="w-full px-4 py-3 rounded-2xl border border-white/8 bg-[#0D1017] text-[13px] text-white/70 focus:outline-none focus:border-amber-500/40 transition-all cursor-pointer appearance-none">
                          {TOPICS.map(t => <option key={t} value={t} className="bg-[#0D1017]">{t}</option>)}
                        </select>
                      </div>

                      <Field label="Message" icon={FiMessageSquare} error={errors.message}>
                        <textarea value={form.message} onChange={set('message')}
                          placeholder="Tell us what's on your mind…"
                          rows={4}
                          className={`${inputCls(errors.message)} pt-3 pl-10 resize-none`} />
                        <span className="absolute right-3 bottom-3 text-[10px] text-white/20">
                          {form.message.length}/500
                        </span>
                      </Field>

                      <motion.button type="submit" disabled={sending}
                        whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[14px] text-gray-950 transition-all disabled:opacity-50"
                        style={{ background: `linear-gradient(to right, ${ACCENT}, ${ACCENT2})` }}>
                        {sending
                          ? <><FiRefreshCw size={14} className="animate-spin" />Sending…</>
                          : <><FiSend size={14} />Send message</>
                        }
                      </motion.button>
                    </form>

                    <p className="text-center text-[11px] text-white/25">
                      Based in Nairobi, Kenya 🇰🇪 · We respect your privacy
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ContactModal;