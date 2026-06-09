/**
 * CinematicShareModal.jsx
 * ─────────────────────────────────────────────────────────────
 * Actions:
 *   1. Post to X — with image  (capture card → upload)
 *   2. Post to X — text only   → opens PostToXModal
 *   3. Download card PNG
 *   4. Copy quote text
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCopy, FiDownload } from 'react-icons/fi';
import { RiTwitterXLine } from 'react-icons/ri';
import { toast } from 'react-hot-toast';

import ShareBackdrop     from './ShareBackdrop';
import ShareActionButton from './ShareActionButton';
import PostXModal       from '../../components/PostXModal';

import { useXStatus }                    from '../../hooks/useXStatus';
import { getCaptureRef, clearCaptureRef } from '../../utils/captureRefStore';
import { buildShareData, copyToClipboard } from '../../utils/shareUtils';
import { downloadCard, previewAndPostToX } from '../../utils/captureShare';

const CinematicShareModal = ({ isOpen, onClose, shareData }) => {
  const { connected, xUsername } = useXStatus();

  const [isCapturing, setIsCapturing] = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [textModalOpen, setTextModalOpen] = useState(false);

  const item       = shareData?.item;
  const sourceType = shareData?.type             || 'quote';
  const accent     = shareData?.showcase?.accent || '#6366F1';
  const title      = shareData?.showcase?.title  || 'Damuchi';

  // Reset when new item arrives
  useEffect(() => {
    if (!item) return;
    setCopied(false);
    setTextModalOpen(false);
    setIsCapturing(false);
  }, [item]);

  // Esc to close
  useEffect(() => {
    if (!isOpen || textModalOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, textModalOpen]);

  // Clear ref when modal closes
  useEffect(() => {
    if (!isOpen) clearCaptureRef();
  }, [isOpen]);
 
  // ── 1. Capture card → preview page → post to X
  const handlePostToX = async () => {
    if (isCapturing || !item) return;
    setIsCapturing(true);
    try {
      const cardRef = getCaptureRef();
      const data    = buildShareData({ item, type: sourceType });

      await previewAndPostToX(cardRef, {
        text:      `"${item.text}"`,
        url:       data.url,
        //hashtags,
      });
    } catch (err) {
      toast.error('Could not capture card');
      console.error(err);
    } finally {
      setIsCapturing(false);
    }
  };
  // ── 2. Post text only → delegate to PostToXModal
  const handlePostTextOnly = () => {
    setTextModalOpen(true);
  };

  // ── 3. Download card PNG only
  const handleDownload = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    try {
      await downloadCard(getCaptureRef(), 'damuchi-share.png');
    } catch (err) {
      toast.error('Could not capture card');
      console.error(err);
    } finally {
      setIsCapturing(false);
    }
  };

  // ── 4. Copy quote text + hashtags + link
  const handleShareText = useCallback(async () => {
    if (!item) return;
    const data    = buildShareData({ item, type: sourceType });
    /* const payload = `"${item.text}" — ${item.author || item.artist}\n\n${
      hashtags.map(h => `#${h}`).join(' ')
    }\n\n${data.url || window.location.href}`; */
    const payload = `"${item.text}"`;
    const ok = await copyToClipboard(payload);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [item, sourceType]);

  return (
    <>
      <AnimatePresence>
        {isOpen && shareData && (
          <>
            <ShareBackdrop onClose={onClose} />

            <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ y: 60, opacity: 0, scale: 0.95 }}
                animate={{ y: 0,  opacity: 1, scale: 1    }}
                exit={{    y: 60, opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
                className="pointer-events-auto w-full max-w-[400px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
                style={{ background: '#0D1320' }}
                role="dialog"
                aria-modal="true"
                aria-label="Share"
              >
                {/* Accent strip */}
                <div
                  className="h-[2px] w-full"
                  style={{ background: `linear-gradient(90deg,transparent,${accent},transparent)` }}
                />

                {/* Header */}
                <div className="px-5 py-4 flex items-center justify-between border-b border-white/8">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
                      style={{ background: `${accent}25`, color: accent }}
                    >
                      𝕏
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm leading-none">
                        Share
                      </p>
                      <p className="text-white/40 text-xs mt-0.5">{title}</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-all"
                  >
                    <FiX size={16} />
                  </button>
                </div>

                {/* X connection status */}
                <div className="px-5 pt-3">
                  {connected ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                      <span className="text-xs text-white/50">
                        Connected as{' '}
                        <span className="text-emerald-400 font-medium">@{xUsername}</span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/4 border border-white/8">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
                      <span className="text-xs text-white/30">
                        X account not connected — post will open in browser
                      </span>
                    </div>
                  )}
                </div>

                {/* Quote preview */}
                {item && (
                  <div className="px-5 pt-3 pb-3">
                    <div
                      className="rounded-2xl p-4 border"
                      style={{ background: `${accent}08`, borderColor: `${accent}25` }}
                    >
                      <p className="text-white/85 text-sm leading-relaxed line-clamp-3">
                        "{item.text}"
                      </p>
                      <p className="text-white/40 text-xs mt-2">
                        — {item.author || item.artist}
                      </p>
                    </div>
                  </div>
                )}

                {/* Capture notice */}
                <AnimatePresence>
                  {isCapturing && (
                    <motion.div
                      initial={{ opacity: 0, height: 0   }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{    opacity: 0, height: 0   }}
                      className="mx-5 mb-2 px-4 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-2"
                    >
                      <span className="w-3 h-3 rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin flex-shrink-0" />
                      <span className="text-indigo-300 text-xs">Capturing card…</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 3 actions */}
                <div className="px-5 pb-4 pt-2 flex flex-col gap-2">

                  <ShareActionButton
                    icon={RiTwitterXLine}
                    label={isCapturing ? 'Capturing…' : 'Post to X — with image'}
                    accent={connected ? '#1D9BF0' : accent}
                    onClick={handlePostToX}
                  />

                  <ShareActionButton
                    icon={RiTwitterXLine}
                    label="Post to X — text only"
                    accent={connected ? '#1D9BF0' : accent}
                    onClick={handlePostTextOnly}
                    disabled={isCapturing}
                  />

                  <ShareActionButton
                    icon={FiDownload}
                    label="Download card"
                    accent="#F59E0B"
                    onClick={handleDownload}
                  />

                  <ShareActionButton
                    icon={FiCopy}
                    label={copied ? '✓ Copied!' : 'Copy quote text + link'}
                    accent="#10B981"
                    onClick={handleShareText}
                  />

                </div>

                {/* Cancel */}
                <div className="px-5 pb-5">
                  <button
                    onClick={onClose}
                    className="w-full py-3 rounded-2xl border border-white/8 text-white/40 hover:text-white/70 hover:border-white/15 transition-all text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>

              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
      {/* ── PostXModal — opens on "text only" ── */}
        <PostXModal
          isOpen={textModalOpen}
          onClose={() => setTextModalOpen(false)}
          item={item}
          sourceType={sourceType}
        />
    </>
  );
};

export default CinematicShareModal;