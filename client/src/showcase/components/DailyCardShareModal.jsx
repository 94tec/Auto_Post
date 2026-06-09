/**
 * DailyCardShareModal.jsx
 * Dedicated share modal for DailyCard — owns its own ref directly
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCopy, FiDownload } from 'react-icons/fi';
import { RiTwitterXLine } from 'react-icons/ri';
import { toast } from 'react-hot-toast';
import { createPortal } from 'react-dom';

import ShareBackdrop     from './ShareBackdrop';
import ShareActionButton from './ShareActionButton';

import { useXStatus }              from '../../hooks/useXStatus';
import { buildShareData, copyToClipboard } from '../../utils/shareUtils';
import {
  downloadDailyCard,
  previewAndPostDailyCard,
} from '../../utils/dailyCardCapture';

const DailyCardShareModal = ({
  isOpen,
  onClose,
  cardRef,   // ← ref to the lyric card div in DailyCard
  item,      // ← current lyric { id, text, author }
  accent,    // ← current accent color
}) => {
  const { connected, xUsername } = useXStatus();

  const [isCapturing, setIsCapturing] = useState(false);
  const [copied,      setCopied]      = useState(false);

  // Reset on new item
  useEffect(() => {
    if (!item) return;
    setCopied(false);
    setIsCapturing(false);
  }, [item]);

  // Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ── 1. Capture + preview + post to X
  const handlePostToX = async () => {
    if (isCapturing || !item) return;
    if (!cardRef?.current) {
      toast.error('Card not ready — try again');
      return;
    }
    setIsCapturing(true);
    try {
      const data = buildShareData({ item, type: 'lyric' });
      await previewAndPostDailyCard(cardRef, {
        text:       `"${item.text}" — ${item.author}`,
        url:        data.url,
        item,
        sourceType: 'lyric',
      });
    } catch (err) {
      toast.error('Could not capture card');
      console.error(err);
    } finally {
      setIsCapturing(false);
    }
  };

  // ── 2. Download only
  const handleDownload = async () => {
    if (isCapturing || !cardRef?.current) return;
    setIsCapturing(true);
    try {
      await downloadDailyCard(cardRef, 'damuchi-daily.png');
    } catch (err) {
      toast.error('Could not capture card');
      console.error(err);
    } finally {
      setIsCapturing(false);
    }
  };

  // ── 3. Copy text
  const handleCopyText = useCallback(async () => {
    if (!item) return;
    const ok = await copyToClipboard(`"${item.text}" — ${item.author}`);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [item]);

  const modal = (
    <AnimatePresence>
      {isOpen && item && (
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
              aria-label="Share Daily Card"
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
                    <p className="text-white font-semibold text-sm leading-none">Share</p>
                    <p className="text-white/40 text-xs mt-0.5">Daily Card</p>
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

              {/* X status */}
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
                      X not connected — post opens in browser
                    </span>
                  </div>
                )}
              </div>

              {/* Lyric preview */}
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
                      — {item.author}
                    </p>
                  </div>
                </div>
              )}

              {/* Capturing spinner */}
              <AnimatePresence>
                {isCapturing && (
                  <motion.div
                    initial={{ opacity: 0, height: 0      }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{    opacity: 0, height: 0      }}
                    className="mx-5 mb-2 px-4 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-2"
                  >
                    <span className="w-3 h-3 rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin flex-shrink-0" />
                    <span className="text-indigo-300 text-xs">Capturing card…</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="px-5 pb-4 pt-2 flex flex-col gap-2">
                <ShareActionButton
                  icon={RiTwitterXLine}
                  label={isCapturing ? 'Capturing…' : 'Post to X — saves card + opens X'}
                  accent={connected ? '#1D9BF0' : accent}
                  onClick={handlePostToX}
                />
                <ShareActionButton
                  icon={FiDownload}
                  label="Download card"
                  accent="#F59E0B"
                  onClick={handleDownload}
                />
                <ShareActionButton
                  icon={FiCopy}
                  label={copied ? '✓ Copied!' : 'Copy lyric text'}
                  accent="#10B981"
                  onClick={handleCopyText}
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
  );

  return createPortal(modal, document.body);
};

export default DailyCardShareModal;