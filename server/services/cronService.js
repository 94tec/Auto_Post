/**
 * cronService.js
 * Same behaviour as before — reads xQueue, posts at AI-optimized slots.
 * UPGRADED: now generates a QuoteFeature card image and posts with media.
 *
 * npm install @napi-rs/canvas twitter-api-v2
 */

import cron      from 'node-cron';
import axios     from 'axios';
import CryptoJS  from 'crypto-js';
import OAuth     from 'oauth-1.0a';
import crypto    from 'crypto';
import { TwitterApi }           from 'twitter-api-v2';
import { queueService }         from './queueService.js';
import { adminFirestore }       from '../config/firebase.js';
import { generateQuoteCard }    from './generateQuoteCard.js';   // ← new

const {
  X_CLIENT_ID,
  X_CLIENT_SECRET,
  X_API_KEY,
  X_API_SECRET,
  X_ACCESS_TOKEN,
  X_ACCESS_SECRET,
  X_TOKEN_ENCRYPT_SECRET,
  ADMIN_UID,
} = process.env;

const X_TWEET_URL = 'https://api.twitter.com/2/tweets';

// ── Token helpers (unchanged from your original) ──────────────
const decryptToken = (c) =>
  CryptoJS.AES.decrypt(c, X_TOKEN_ENCRYPT_SECRET).toString(CryptoJS.enc.Utf8);

const encryptToken = (t) =>
  CryptoJS.AES.encrypt(t, X_TOKEN_ENCRYPT_SECRET).toString();

const getAdminAccessToken = async () => {
  const snap = await adminFirestore.collection('xTokens').doc(ADMIN_UID).get();
  if (!snap.exists) throw new Error('Admin X account not connected');

  const { accessToken, refreshToken, expiresAt } = snap.data();

  if (Date.now() >= expiresAt - 60_000) {
    const params = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: decryptToken(refreshToken),
      client_id:     X_CLIENT_ID,
    });
    const { data } = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:  'Basic ' + Buffer.from(
            `${X_CLIENT_ID}:${X_CLIENT_SECRET}`
          ).toString('base64'),
        },
      }
    );
    await adminFirestore.collection('xTokens').doc(ADMIN_UID).update({
      accessToken:  encryptToken(data.access_token),
      refreshToken: encryptToken(data.refresh_token ?? decryptToken(refreshToken)),
      expiresAt:    Date.now() + data.expires_in * 1000,
      updatedAt:    Date.now(),
    });
    return data.access_token;
  }

  return decryptToken(accessToken);
};

// ── Build tweet text ──────────────────────────────────────────
const buildTweetText = (item) => {
  const tag  = item.category ? ` #${item.category}` : '';
  const base = `"${item.text}"\n\n— ${item.author}`;
  const tail = `${tag} #Damuchi #quotes`;
  const full = `${base}${tail}`;
  return full.length <= 280 ? full : `${base.slice(0, 270 - tail.length)}…${tail}`;
};

// ── Post with media using twitter-api-v2 ──────────────────────
// Uses OAuth 1.0a (v1 media upload) + Bearer token (v2 tweet)
const postWithMedia = async (item) => {
  // 1. Generate card image
  console.log('[Cron] Generating card image…');
  const imageBuffer = await generateQuoteCard({
    text:     item.text,
    author:   item.author,
    category: item.category,
  });

  // 2. Upload image via v1 (requires OAuth 1.0a app-level credentials)
  //    twitter-api-v2 handles chunked upload automatically for large files
  const v1Client = new TwitterApi({
    appKey:       X_API_KEY,
    appSecret:    X_API_SECRET,
    accessToken:  X_ACCESS_TOKEN,  // app-level tokens for media upload
    accessSecret: X_ACCESS_SECRET,
  });

  console.log('[Cron] Uploading media to X…');
  const mediaId = await v1Client.v1.uploadMedia(imageBuffer, { mimeType: 'image/png' });
  console.log('[Cron] Media uploaded:', mediaId);

  // 3. Post tweet with media via v2 (Bearer token)
  const accessToken = await getAdminAccessToken();
  const tweetText   = buildTweetText(item);

  const { data: tweet } = await axios.post(
    X_TWEET_URL,
    {
      text:  tweetText,
      media: { media_ids: [mediaId] },
    },
    {
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return {
    tweetId:  tweet.data.id,
    tweetUrl: `https://x.com/i/web/status/${tweet.data.id}`,
  };
};

// ── Fallback: text-only if image generation fails ─────────────
const postTextOnly = async (item) => {
  const accessToken = await getAdminAccessToken();
  const tweetText   = buildTweetText(item);

  const { data: tweet } = await axios.post(
    X_TWEET_URL,
    { text: tweetText },
    {
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return {
    tweetId:  tweet.data.id,
    tweetUrl: `https://x.com/i/web/status/${tweet.data.id}`,
  };
};

// ── Core: post next item from queue ──────────────────────────
const postNextFromQueue = async (scheduledSlot) => {
  const item = await queueService.getNext();
  if (!item) {
    console.log(`[Cron] Slot ${scheduledSlot}h — queue empty, skipping`);
    return;
  }

  console.log(`[Cron] Posting "${item.text?.slice(0, 50)}…" at slot ${scheduledSlot}h`);

  try {
    // Try with media first, fall back to text-only
    let result;
    try {
      result = await postWithMedia(item);
      console.log(`[Cron] ✅ Posted with media — ${result.tweetUrl}`);
    } catch (mediaErr) {
      console.warn('[Cron] ⚠️  Media post failed, falling back to text:', mediaErr.message);
      result = await postTextOnly(item);
      console.log(`[Cron] ✅ Posted (text-only) — ${result.tweetUrl}`);
    }

    await queueService.markPosted(item.id, {
      tweetId:      result.tweetId,
      tweetUrl:     result.tweetUrl,
      scheduledSlot,
    });

  } catch (err) {
    console.error(`[Cron] ❌ Failed:`, err?.response?.data || err.message);
    await queueService.markFailed(item.id, err);
    await queueService.recordSlotFailure(scheduledSlot);
  }
};

// ── Scheduler (unchanged from your original) ─────────────────
let activeCrons = [];

const stopAllCrons = () => {
  activeCrons.forEach(c => c.stop());
  activeCrons = [];
};

export const startCronScheduler = async () => {
  stopAllCrons();

  const slots = await queueService.getSlots();
  console.log(`[Cron] Starting scheduler with slots:`, slots.map(h => `${h}:00`).join(', '));

  slots.forEach(hour => {
    const task = cron.schedule(`0 ${hour} * * *`, async () => {
      console.log(`[Cron] Firing slot ${hour}:00 UTC`);
      await postNextFromQueue(hour);
    }, { timezone: 'UTC' });

    activeCrons.push(task);
  });

  console.log(`[Cron] ${activeCrons.length} slots scheduled`);
};

// Refresh schedule at midnight to pick up updated AI slots
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Midnight — refreshing schedule with updated AI slots');
  await startCronScheduler();
}, { timezone: 'UTC' });

export const stopCronScheduler = stopAllCrons;