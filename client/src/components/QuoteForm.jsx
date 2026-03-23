// QuoteForm.jsx — redesigned with constrained layout & refined aesthetics
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSave, FiEdit2, FiX, FiPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: 'motivation',  label: 'Motivation',  emoji: '🔥' },
  { value: 'mindset',     label: 'Mindset',     emoji: '🧠' },
  { value: 'discipline',  label: 'Discipline',  emoji: '⚡' },
  { value: 'success',     label: 'Success',     emoji: '🏆' },
  { value: 'growth',      label: 'Growth',      emoji: '🌱' },
  { value: 'resilience',  label: 'Resilience',  emoji: '💪' },
  { value: 'inspiration', label: 'Inspiration', emoji: '✨' },
  { value: 'persistence', label: 'Persistence', emoji: '🎯' },
];

const MAX_CHARS = 400;

/* ─── tiny atoms ─────────────────────────────────────────────── */

const Label = ({ children }) => (
  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-amber-500/80 mb-1.5">
    {children}
  </span>
);

const inputBase = `
  w-full bg-[#0D1017] text-[13px] text-white/90 placeholder-white/20
  border border-white/8 rounded-xl px-3.5 py-2.5
  focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20
  transition-all duration-200 disabled:opacity-40
`;

/* ─── main component ──────────────────────────────────────────── */

const QuoteForm = ({ onSubmit, editingQuote, onCancel }) => {
  const [form, setForm] = useState({ text: '', author: '', category: 'motivation' });
  const [submitting, setSubmitting] = useState(false);
  const textRef = useRef(null);
  const isEditing = Boolean(editingQuote);
  const chars = form.text.length;
  const ratio = chars / MAX_CHARS;

  useEffect(() => {
    const d = isEditing
      ? { text: editingQuote.text || '', author: editingQuote.author || '', category: editingQuote.category || 'motivation' }
      : { text: '', author: '', category: 'motivation' };
    setForm(d);
    setTimeout(() => textRef.current?.focus(), 80);
  }, [editingQuote]);

  const set = (name, value) =>
    setForm(p => ({ ...p, [name]: value }));

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!form.text.trim())   { toast.error('Quote text is required'); return; }
  if (!form.author.trim()) { toast.error('Author name is required'); return; }
  if (chars > MAX_CHARS)   { toast.error(`Keep it under ${MAX_CHARS} chars`); return; }

  setSubmitting(true);
  try {
    await onSubmit(form);   // parent will do the actual API call
    if (!isEditing) {
      setForm({ text: '', author: '', category: 'motivation' });
    }
  } catch (err) {
    toast.error(err.message || 'Failed to save');
  } finally {
    setSubmitting(false);
  }
};

  const barColor = ratio > 0.9 ? '#ef4444' : ratio > 0.75 ? '#f59e0b' : '#f59e0b';
  const countCls = ratio > 0.9 ? 'text-red-400' : ratio > 0.75 ? 'text-amber-400' : 'text-white/25';
  const canSubmit = !submitting && form.text.trim() && form.author.trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      /* ── max-width constraint + horizontal centering ── */
      className="w-full max-w-[520px] mx-auto mb-6"
    >
      {/* ── card ── */}
      <div className="rounded-2xl border border-white/8 overflow-hidden bg-[#141924]">

        {/* top strip */}
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/6">
          <div className="w-5 h-5 rounded-md flex items-center justify-center bg-amber-500">
            {isEditing
              ? <FiEdit2 size={10} className="text-gray-950" />
              : <FiPlus  size={10} className="text-gray-950" />}
          </div>
          <span className="text-[12px] font-semibold text-white/70 tracking-wide">
            {isEditing ? 'Edit quote' : 'New quote'}
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">

            {/* ── quote textarea ── */}
            <div>
              <Label>Quote</Label>
              <div className="relative">
                <textarea
                  ref={textRef}
                  name="text"
                  rows={4}
                  value={form.text}
                  onChange={e => set('text', e.target.value)}
                  disabled={submitting}
                  placeholder="Type something worth remembering…"
                  className={`${inputBase} resize-none leading-relaxed`}
                  maxLength={MAX_CHARS + 10}
                />
                {/* char progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 rounded-b-xl overflow-hidden">
                  <motion.div
                    style={{ background: barColor }}
                    className="h-full"
                    animate={{ width: `${Math.min(ratio * 100, 100)}%` }}
                    transition={{ duration: 0.15 }}
                  />
                </div>
              </div>
              {/* char count */}
              <div className={`text-right text-[10px] mt-1 ${countCls}`}>
                {chars} / {MAX_CHARS}
              </div>
            </div>

            {/* ── author + category row ── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Author</Label>
                <input
                  type="text"
                  name="author"
                  value={form.author}
                  onChange={e => set('author', e.target.value)}
                  disabled={submitting}
                  placeholder="Who said it?"
                  className={inputBase}
                />
              </div>
              <div>
                <Label>Category</Label>
                <select
                  name="category"
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                  disabled={submitting}
                  className={`${inputBase} cursor-pointer`}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value} className="bg-[#0D1017]">
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── category pills ── */}
            <div>
              <Label>Quick pick</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(c => {
                  const active = form.category === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => set('category', c.value)}
                      disabled={submitting}
                      className={`
                        flex items-center gap-1 px-2.5 py-[5px] rounded-full text-[11px] font-medium
                        border transition-all duration-150
                        ${active
                          ? 'bg-amber-500 text-gray-950 border-amber-500'
                          : 'bg-white/4 text-white/40 border-white/8 hover:border-white/20 hover:text-white/70'
                        }
                      `}
                    >
                      <span className="text-[11px]">{c.emoji}</span>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── footer actions ── */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 bg-black/20 border-t border-white/5">
            <AnimatePresence>
              {isEditing && (
                <motion.button
                  type="button"
                  onClick={onCancel}
                  disabled={submitting}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                             text-[12px] text-white/40 hover:text-white/70
                             hover:bg-white/6 transition-all"
                >
                  <FiX size={12} />
                  Cancel
                </motion.button>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              whileHover={canSubmit ? { scale: 1.02 } : {}}
              whileTap={canSubmit ? { scale: 0.97 } : {}}
              disabled={!canSubmit}
              className={`
                ml-auto flex items-center gap-2 px-4 py-2 rounded-xl
                text-[12px] font-semibold bg-amber-500 text-gray-950
                disabled:opacity-30 disabled:cursor-not-allowed
                transition-all duration-150 shadow-sm shadow-amber-500/20
              `}
            >
              {submitting ? (
                <span className="w-3.5 h-3.5 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
              ) : isEditing ? (
                <FiSave size={12} />
              ) : (
                <FiPlus size={12} />
              )}
              {submitting ? 'Saving…' : isEditing ? 'Update' : 'Add Quote'}
            </motion.button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default QuoteForm;