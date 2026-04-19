// components/AddLyricModal.jsx
// Admin-only modal to add a lyric to the `lyrics` collection.
// Separate from quotes — displayed in DailyCard phone mockup.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiMusic, FiUser, FiTag, FiPlus, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { lyricsApi } from '../utils/api.js';

const ACCENT  = '#F59E0B';
const ACCENT2 = '#F97316';

const GENRES = [
  'motivation', 'mindset', 'discipline', 'success', 'resilience',
  'persistence', 'belief', 'action', 'growth', 'determination',
  'inspiration', 'gospel', 'afrobeat', 'rnb', 'hiphop', 'pop', 'soul',
];

const CAT_COLORS = {
  motivation:'#F59E0B', mindset:'#818CF8', discipline:'#34D399',
  success:'#A78BFA', resilience:'#FB923C', persistence:'#38BDF8',
  belief:'#C084FC', action:'#86EFAC', growth:'#2DD4BF',
  determination:'#F87171', inspiration:'#7DD3FC',
  gospel:'#FCD34D', afrobeat:'#10B981', rnb:'#EC4899',
  hiphop:'#8B5CF6', pop:'#06B6D4', soul:'#F97316',
};

const AddLyricModal = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [form, setForm] = useState({ text: '', artist: '', genre: 'motivation' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors(er => ({ ...er, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (form.text.trim().length < 5)   e.text   = 'Lyric text too short (min 5 chars)';
    if (form.text.trim().length > 300) e.text   = 'Max 300 characters';
    if (!form.artist.trim())           e.artist = 'Artist name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

 const handleSubmit = async (e) => {
  e.preventDefault();
  if (!validate()) return;
    setSaving(true);
    try {
      await lyricsApi.create({
        text: form.text.trim(),
        artist: form.artist.trim(),
        genre: form.genre,
      });
      toast.success('Lyric added to phone display!');
      setForm({ text: '', artist: '', genre: 'motivation' });
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const accentColor = CAT_COLORS[form.genre] ?? ACCENT;
  const charPct = Math.min((form.text.length / 300) * 100, 100);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" style={{ zIndex: 1000 }} onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 32, scale: 0.96  }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
            style={{ zIndex: 1001 }}
          >
            <div className="pointer-events-auto w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px]
                            border border-white/10 overflow-hidden"
                 style={{ background: '#141924', boxShadow: '0 32px 64px rgba(0,0,0,0.7)' }}>

              <div className="h-[3px] transition-all duration-500"
                   style={{ background: `linear-gradient(to right, ${accentColor}, ${accentColor}44, transparent)` }} />

              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                         style={{ background: `${accentColor}18` }}>
                      <FiMusic size={14} style={{ color: accentColor }} />
                    </div>
                    <div>
                      <h3 className="text-[16px] font-black text-white">Add Lyric</h3>
                      <p className="text-[10px] text-white/35">Displayed in phone mockup</p>
                    </div>
                  </div>
                  <button onClick={onClose}
                    className="w-7 h-7 rounded-xl flex items-center justify-center bg-white/6 border border-white/8 text-white/40 hover:text-white transition-colors">
                    <FiX size={13} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

                  {/* genre picker */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.12em] mb-2"
                           style={{ color: `${accentColor}99` }}>Genre / Category</label>
                    <div className="flex flex-wrap gap-1.5">
                      {GENRES.map(g => (
                        <button key={g} type="button" onClick={() => setForm(f => ({ ...f, genre: g }))}
                          className="px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all capitalize"
                          style={form.genre === g
                            ? { background: `${CAT_COLORS[g] || ACCENT}20`, borderColor: `${CAT_COLORS[g] || ACCENT}50`, color: CAT_COLORS[g] || ACCENT }
                            : { background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }
                          }>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* lyric text */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5"
                           style={{ color: errors.text ? '#f87171' : `${accentColor}90` }}>
                      Lyric / Text
                    </label>
                    <div className="relative">
                      <textarea value={form.text} onChange={set('text')}
                        placeholder="Enter the lyric or inspirational line…"
                        rows={3}
                        className={`w-full px-4 py-3 rounded-2xl border text-[13px] text-white/80 placeholder-white/20
                                    focus:outline-none focus:ring-1 transition-all bg-[#0D1017] resize-none
                                    ${errors.text ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/15' : 'border-white/8 focus:border-amber-500/40 focus:ring-amber-500/15'}`}
                      />
                      {/* char progress */}
                      <div className="absolute bottom-3 right-3 flex items-center gap-2">
                        <span className="text-[10px] text-white/25">{form.text.length}/300</span>
                        <div className="w-10 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                               style={{ width: `${charPct}%`, background: charPct > 90 ? '#f87171' : accentColor }} />
                        </div>
                      </div>
                    </div>
                    {errors.text && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.text}</p>
                    )}
                  </div>

                  {/* artist */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5"
                           style={{ color: errors.artist ? '#f87171' : `${accentColor}90` }}>
                      Artist / Author
                    </label>
                    <div className="relative">
                      <FiUser size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/25" />
                      <input value={form.artist} onChange={set('artist')}
                        placeholder="e.g. Burna Boy, Kanye West, Damuchi…"
                        className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-[13px] text-white/80 placeholder-white/20
                                    focus:outline-none focus:ring-1 transition-all bg-[#0D1017]
                                    ${errors.artist ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/15' : 'border-white/8 focus:border-amber-500/40 focus:ring-amber-500/15'}`}
                      />
                    </div>
                    {errors.artist && <p className="text-[11px] text-red-400 mt-1">{errors.artist}</p>}
                  </div>

                  {/* preview */}
                  {(form.text || form.artist) && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-white/6 p-4"
                      style={{ background: '#0D1220', borderLeftColor: accentColor, borderLeftWidth: 2 }}>
                      <p className="text-[10px] text-white/30 mb-2 uppercase tracking-wider">Preview</p>
                      <div className="text-[22px] leading-none font-serif mb-1" style={{ color: `${accentColor}30` }}>&ldquo;</div>
                      <p className="text-[12px] text-white/75 leading-relaxed mb-2">{form.text || '…'}</p>
                      <p className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: accentColor }}>
                        — {form.artist || 'Artist name'}
                      </p>
                    </motion.div>
                  )}

                  <div className="flex gap-2.5 pt-1">
                    <button type="button" onClick={onClose}
                      className="flex-1 py-3 rounded-2xl text-[13px] font-medium border border-white/8 bg-white/5 text-white/50 hover:text-white hover:bg-white/8 transition-all">
                      Cancel
                    </button>
                    <motion.button type="submit" disabled={saving}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[13px] text-gray-950 disabled:opacity-50"
                      style={{ background: `linear-gradient(to right, ${accentColor}, ${ACCENT2})` }}>
                      {saving
                        ? <><FiRefreshCw size={13} className="animate-spin" />Saving…</>
                        : <><FiPlus size={13} />Add lyric</>
                      }
                    </motion.button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AddLyricModal;