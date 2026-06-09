import domtoimage from 'dom-to-image-more';
import { xApi } from './xApi';

const SCALE = 2;

export const captureCardAsBlob = async (ref) => {
  if (!ref?.current) throw new Error('No ref to capture');
  const node   = ref.current;
  const rect   = node.getBoundingClientRect();
  const width  = Math.round(rect.width);
  const height = Math.round(rect.height);

  if (width === 0 || height === 0) throw new Error('Element has no dimensions');

  // Hide elements marked for capture exclusion
  const hidden = [];
  node.querySelectorAll('[data-capture-hide]').forEach(el => {
    hidden.push({ el, visibility: el.style.visibility });
    el.style.visibility = 'hidden';
  });

  // Strip borders from data-capture-clean elements
  const cleaned = [];
  node.querySelectorAll('[data-capture-clean]').forEach(el => {
    [el, ...el.querySelectorAll('*')].forEach(child => {
      cleaned.push({ child, border: child.style.border, outline: child.style.outline });
      child.style.border  = 'none';
      child.style.outline = 'none';
    });
  });

  let blob;
  try {
    blob = await domtoimage.toBlob(node, {
      width:   width  * SCALE,
      height:  height * SCALE,
      style: {
        transform:       `scale(${SCALE})`,
        transformOrigin: 'top left',
      },
      bgcolor: '#141924',
    });
  } finally {
    hidden.forEach(({ el, visibility }) => { el.style.visibility = visibility; });
    cleaned.forEach(({ child, border, outline }) => {
      child.style.border  = border;
      child.style.outline = outline;
    });
  }

  return blob;
};

export const downloadCard = async (ref, filename = 'damuchi-share.png') => {
  const blob = await captureCardAsBlob(ref);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href        = url;
  a.download    = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return blob;
};

export const previewAndPostToX = async (ref, { text, url, item, sourceType = 'quote' }) => {
  const blob = await captureCardAsBlob(ref);

  // Convert to base64 — object URLs don't survive cross-tab
  const base64 = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });

  // Expose xApi.postWithMedia on opener so preview tab can call it directly
  // This keeps auth entirely in the main window — no token passing needed
  window.__damuchiPostWithMedia = async ({ imageBase64, text: t, sourceId, sourceType: st }) => {
    const res      = await fetch(imageBase64);
    const imgBlob  = await res.blob();
    return xApi.postWithMedia({ imageBlob: imgBlob, text: t, sourceId, sourceType: st });
  };

  //const fullText = `${text}\n\n${hashtags.map(h => `#${h}`).join(' ')}`;
  const fullText = text;
  const API_BASE = import.meta.env.VITE_API_URL ?? '';

  const preview = window.open('', '_blank');
  if (!preview) {
    alert('Popup blocked — please allow popups for this site and try again.');
    return;
  }

  preview.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Share Preview — Damuchi</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #07090f;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 28px;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
      padding: 40px 24px;
      color: #fff;
    }
    .label-top {
      font-size: 12px; color: rgba(255,255,255,.35);
      letter-spacing: .08em; text-transform: uppercase;
    }
    .card-wrap {
      width: 100%; max-width: 560px; border-radius: 20px; overflow: hidden;
      box-shadow: 0 32px 96px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.08);
    }
    .card-wrap img { display: block; width: 100%; height: auto; }
    .actions { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: center; }
    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 13px 28px; border-radius: 14px; font-size: 14px;
      font-weight: 600; cursor: pointer;
      transition: opacity .15s, transform .1s;
      border: none; outline: none; text-decoration: none;
    }
    .btn:hover  { opacity: .88; }
    .btn:active { transform: scale(.97); }
    .btn-x {
      background: #1D9BF0; color: #fff;
      box-shadow: 0 4px 20px rgba(29,155,240,.4);
    }
    .btn-x:disabled { opacity: .5; cursor: not-allowed; }
    .btn-dl {
      background: rgba(255,255,255,.06); color: rgba(255,255,255,.65);
      border: 1px solid rgba(255,255,255,.12);
    }
    .status {
      font-size: 13px; color: rgba(255,255,255,.4);
      min-height: 20px; text-align: center; padding: 0 16px;
    }
    .status.success { color: #34d399; }
    .status.error   { color: #f87171; }
    .spinner {
      display: inline-block; width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,.3);
      border-top-color: #fff; border-radius: 50%;
      animation: spin .7s linear infinite;
      margin-right: 6px; vertical-align: middle;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .label-bottom {
      font-size: 12px; color: rgba(255,255,255,.2);
      text-align: center; max-width: 420px; line-height: 1.7;
    }
  </style>
</head>
<body>
  <p class="label-top">Your share card preview</p>

  <div class="card-wrap">
    <img id="cardImg" src="${base64}" alt="Share card"/>
  </div>

  <div class="actions">
    <button class="btn btn-x" id="postBtn" onclick="postToX()">
      𝕏 &nbsp; Post to X
    </button>
    <a class="btn btn-dl" href="${base64}" download="damuchi-share.png">
      ↓ &nbsp; Download
    </a>
  </div>

  <p class="status" id="status"></p>
  <p class="label-bottom">
    This card will be posted directly to your connected X account with the image attached.
  </p>

  <script>
    const BASE64   = document.getElementById('cardImg').src;
    const TEXT     = ${JSON.stringify(fullText)};
    const SOURCE_ID   = ${JSON.stringify(item?.id   ?? '')};
    const SOURCE_TYPE = ${JSON.stringify(sourceType ?? 'quote')};

    async function postToX() {
      const btn    = document.getElementById('postBtn');
      const status = document.getElementById('status');

      btn.disabled  = true;
      btn.innerHTML = '<span class="spinner"></span> Posting…';
      status.className   = 'status';
      status.textContent = '';

      try {
        // Call xApi.postWithMedia on the opener — auth stays in main window
        const poster = window.opener?.__damuchiPostWithMedia;
        if (!poster) throw new Error('Connection to app lost — please close and try again');

        const result = await poster({
          imageBase64: BASE64,
          text:        TEXT,
          sourceId:    SOURCE_ID,
          sourceType:  SOURCE_TYPE,
        });

        status.className   = 'status success';
        status.textContent = '✓ Posted successfully!';
        btn.innerHTML      = '𝕏 &nbsp; Posted!';

        if (result?.tweetUrl) {
          setTimeout(() => window.open(result.tweetUrl, '_blank'), 900);
        }

      } catch (err) {
        status.className   = 'status error';
        status.textContent = '✗ ' + (err.message || 'Post failed');
        btn.disabled       = false;
        btn.innerHTML      = '𝕏 &nbsp; Retry';
      }
    }
  </script>
</body>
</html>`);
  preview.document.close();
};

export const nativeShareCard = async (ref, { title, text, url }) => {
  if (navigator.share && navigator.canShare) {
    try {
      const blob = await captureCardAsBlob(ref);
      const file = new File([blob], 'damuchi-share.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        return;
      }
    } catch { /* user cancelled */ }
  }
  if (navigator.share) {
    await navigator.share({ title, text, url });
  } else {
    await navigator.clipboard.writeText(`${text}\n\n${url}`);
  }
};

export const openXIntentWithText = ({ text, url, hashtags = [] }) => {
  const params = new URLSearchParams({
    text: `${text}\n\n${hashtags.map(h => `#${h}`).join(' ')}`,
    url,
  });
  window.open(`https://x.com/intent/tweet?${params}`, '_blank', 'noopener,noreferrer');
};