// utils/shareUtils.js

import toast from 'react-hot-toast';

/**
 * Create share payload for showcase items
 */
export const createSharePayload = ({
  showcase,
  item,
  type = 'quote',
}) => ({
  showcase,
  item,
  type,
});

/** Global share handler (for modals) */
let shareHandler = null;

export const registerShareHandler = (fn) => {
  shareHandler = fn;
};

export const openShare = (payload) => {
  if (typeof shareHandler === 'function') {
    shareHandler(payload);
  } else {
    console.warn('Share handler not registered. Falling back to native share.');
    nativeShare(payload);
  }
};

/**
 * Build optimized share data
 */
export const buildShareData = ({
  showcase,
  item,
  type = 'quote',
  url,
}) => {
  const baseText = item?.text 
    ? `"${item.text}"${item.author || item.artist ? ` — ${item.author || item.artist}` : ''}`
    : showcase?.description;

  return {
    title: showcase?.title || 'Damuchi Showcase',
    text: baseText + (type === 'quote' ? ' #Damuchi' : ''),
    url: url || window.location.href,
  };
};

/**
 * Native Web Share API with fallback
 */
export const nativeShare = async (payload) => {
  const data = buildShareData(payload);

  if (navigator.share) {
    try {
      await navigator.share({
        title: data.title,
        text: data.text,
        url: data.url,
      });
      return true;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Native share failed, falling back to copy');
      }
    }
  }

  // Fallback: Copy to clipboard
  await navigator.clipboard.writeText(`${data.text}\n\n${data.url}`);
  toast.success('Link copied to clipboard');
  return true;
};

/**
 * Open X (Twitter) intent
 */
export const openXIntent = ({ text, url, hashtags = ['Damuchi'] }) => {
  const params = new URLSearchParams({
    text: text || '',
    url: url || window.location.href,
    hashtags: hashtags.join(','),
  });

  window.open(
    `https://twitter.com/intent/tweet?${params.toString()}`,
    '_blank',
    'noopener,noreferrer'
  );
};

/**
 * Copy link to clipboard
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
    return true;   // ← was missing, caused copied state to never set
  } catch {
    toast.error('Failed to copy');
    return false;
  }
};

/**
 * Download image
 */
export const downloadImage = async (url, filename = 'damuchi-showcase') => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);

    toast.success('Image downloaded');
  } catch {
    toast.error('Failed to download image');
  }
};