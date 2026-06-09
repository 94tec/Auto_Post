/**
 * x.routes.js
 */

import express        from 'express';
import axios          from 'axios';
import crypto         from 'crypto';
import CryptoJS       from 'crypto-js';
import OAuth          from 'oauth-1.0a';
import FormData       from 'form-data';
import { adminFirestore } from '../config/firebase.js';
import { verifyToken as requireAuth, verifyTokenLight, requireAdmin } from '../middlewares/auth.js';
import multer         from 'multer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = express.Router();

/* ─── Constants ─────────────────────────────────────────────── */
const X_AUTH_URL   = 'https://twitter.com/i/oauth2/authorize';
const X_TOKEN_URL  = 'https://api.twitter.com/2/oauth2/token';
const X_REVOKE_URL = 'https://api.twitter.com/2/oauth2/revoke';
const X_TWEET_URL  = 'https://api.twitter.com/2/tweets';
const X_ME_URL     = 'https://api.twitter.com/2/users/me';
const X_MEDIA_URL  = 'https://upload.twitter.com/1.1/media/upload.json';

const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'].join(' ');

const {
  X_CLIENT_ID,
  X_CLIENT_SECRET,
  X_REDIRECT_URI,
  X_TOKEN_ENCRYPT_SECRET,
  FRONTEND_URL,
} = process.env;

/* ─── Helpers ────────────────────────────────────────────────── */
const encryptToken  = (t) => CryptoJS.AES.encrypt(t, X_TOKEN_ENCRYPT_SECRET).toString();
const decryptToken  = (c) => CryptoJS.AES.decrypt(c, X_TOKEN_ENCRYPT_SECRET).toString(CryptoJS.enc.Utf8);
const basicAuthHeader = () => 'Basic ' + Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64');
const generateCodeVerifier  = () => crypto.randomBytes(64).toString('base64url').slice(0, 128);
const generateCodeChallenge = (v) => crypto.createHash('sha256').update(v).digest('base64url');
const tokenRef = (uid) => adminFirestore.collection('xTokens').doc(uid);

/* ─── OAuth 1.0a header builder (uses oauth-1.0a package) ───── */
const buildOAuth1Header = ({ method, url, consumerKey, consumerSecret, accessToken, accessSecret, bodyParams = {} }) => {
  const oauth = new OAuth({
    consumer: { key: consumerKey, secret: consumerSecret },
    signature_method: 'HMAC-SHA1',
    hash_function(base, key) {
      return crypto.createHmac('sha1', key).update(base).digest('base64');
    },
  });

  const authHeader = oauth.toHeader(
    oauth.authorize(
      { url, method: method.toUpperCase(), data: bodyParams },
      { key: accessToken, secret: accessSecret }
    )
  );

  return authHeader.Authorization;
};

/* ─── Token Management ───────────────────────────────────────── */
const refreshAccessToken = async (uid, refreshTokenCipher) => {
  const refreshToken = decryptToken(refreshTokenCipher);
  const params = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
    client_id:     X_CLIENT_ID,
  });
  const { data } = await axios.post(X_TOKEN_URL, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:  basicAuthHeader(),
    },
  });
  await tokenRef(uid).set({
    accessToken:  encryptToken(data.access_token),
    refreshToken: encryptToken(data.refresh_token ?? refreshToken),
    expiresAt:    Date.now() + data.expires_in * 1000,
    updatedAt:    Date.now(),
  }, { merge: true });
  return data.access_token;
};

const getValidAccessToken = async (uid) => {
  const snap = await tokenRef(uid).get();
  if (!snap.exists) throw new Error('X account not connected');
  const { accessToken, refreshToken, expiresAt } = snap.data();
  if (Date.now() >= expiresAt - 60_000) return refreshAccessToken(uid, refreshToken);
  return decryptToken(accessToken);
};

/* ─── Routes ─────────────────────────────────────────────────── */

router.get('/connect', requireAuth, requireAdmin, async (req, res) => {
  try {
    const uid          = req.user.uid;
    const state        = crypto.randomBytes(16).toString('hex');
    const codeVerifier = generateCodeVerifier();
    const challenge    = generateCodeChallenge(codeVerifier);
    await adminFirestore.collection('xOAuthState').doc(uid).set({
      state, codeVerifier,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    const params = new URLSearchParams({
      response_type:         'code',
      client_id:             X_CLIENT_ID,
      redirect_uri:          X_REDIRECT_URI,
      scope:                 SCOPES,
      state:                 `${uid}:${state}`,
      code_challenge:        challenge,
      code_challenge_method: 'S256',
    });
    res.redirect(`${X_AUTH_URL}?${params}`);
  } catch (err) {
    console.error('[X connect]', err);
    res.redirect(`${FRONTEND_URL}/dashboard?x_error=connect_failed`);
  }
});

router.get('/connect-url', requireAuth, requireAdmin, async (req, res) => {
  try {
    const uid          = req.user.uid;
    const state        = crypto.randomBytes(16).toString('hex');
    const codeVerifier = generateCodeVerifier();
    const challenge    = generateCodeChallenge(codeVerifier);
    await adminFirestore.collection('xOAuthState').doc(uid).set({
      state, codeVerifier,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    const params = new URLSearchParams({
      response_type:         'code',
      client_id:             X_CLIENT_ID,
      redirect_uri:          X_REDIRECT_URI,
      scope:                 SCOPES,
      state:                 `${uid}:${state}`,
      code_challenge:        challenge,
      code_challenge_method: 'S256',
    });
    res.json({ url: `${X_AUTH_URL}?${params}` });
  } catch (err) {
    console.error('[X connect-url]', err);
    res.status(500).json({ error: 'Failed to start OAuth' });
  }
});

router.get('/callback', async (req, res) => {
  const { code, state: rawState, error } = req.query;
  if (error) return res.redirect(`${FRONTEND_URL}/dashboard?x_error=${encodeURIComponent(error)}`);
  try {
    const [uid, returnedState] = rawState.split(':');
    const stateSnap = await adminFirestore.collection('xOAuthState').doc(uid).get();
    if (!stateSnap.exists) throw new Error('No OAuth state found');
    const { state: storedState, codeVerifier, expiresAt } = stateSnap.data();
    if (storedState !== returnedState) throw new Error('State mismatch');
    if (Date.now() > expiresAt)        throw new Error('OAuth state expired');
    await adminFirestore.collection('xOAuthState').doc(uid).delete();

    const params = new URLSearchParams({
      code,
      grant_type:    'authorization_code',
      redirect_uri:  X_REDIRECT_URI,
      client_id:     X_CLIENT_ID,
      code_verifier: codeVerifier,
    });
    const { data: tokenData } = await axios.post(X_TOKEN_URL, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization:  basicAuthHeader(),
      },
    });

    let xUserData = { id: null, username: null, profile_image_url: null };
    try {
      const userRes = await axios.get(`${X_ME_URL}?user.fields=username,profile_image_url`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        timeout: 10000,
      });
      xUserData = userRes.data.data || xUserData;
    } catch (e) {
      console.warn('[X callback] Could not fetch user profile:', e.message);
    }

    await tokenRef(uid).set({
      accessToken:   encryptToken(tokenData.access_token),
      refreshToken:  encryptToken(tokenData.refresh_token),
      expiresAt:     Date.now() + tokenData.expires_in * 1000,
      xUserId:       xUserData.id,
      xUsername:     xUserData.username || 'unknown',
      xProfileImage: xUserData.profile_image_url ?? null,
      connectedAt:   Date.now(),
      updatedAt:     Date.now(),
    }, { merge: true });

    res.redirect(`${FRONTEND_URL}/dashboard?x_connected=1&x_user=${encodeURIComponent(xUserData.username || 'connected')}`);
  } catch (err) {
    console.error('[X callback]', err?.response?.data || err);
    res.redirect(`${FRONTEND_URL}/dashboard?x_error=callback_failed`);
  }
});

router.post('/post', requireAuth, requireAdmin, async (req, res) => {
  const uid = req.user.uid;
  const { text, sourceId, sourceType } = req.body;
  if (!text?.trim())                    return res.status(400).json({ error: 'text is required' });
  if (text.trim().length > 280)         return res.status(400).json({ error: 'text exceeds 280 characters' });
  if (!sourceId || !sourceType)         return res.status(400).json({ error: 'sourceId and sourceType are required' });
  try {
    const accessToken = await getValidAccessToken(uid);
    const { data: tweetData } = await axios.post(X_TWEET_URL, { text: text.trim() }, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    const tweetId  = tweetData.data.id;
    const tweetUrl = `https://twitter.com/i/web/status/${tweetId}`;
    await adminFirestore.collection('xPostLog').add({
      uid, sourceId, sourceType,
      text: text.trim(), tweetId, tweetUrl,
      status: 'success', postedAt: Date.now(),
    });
    res.json({ success: true, tweetId, tweetUrl });
  } catch (err) {
    console.error('[X post]', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to post tweet' });
  }
});

router.get('/status', verifyTokenLight, async (req, res) => {
  try {
    const snap = await tokenRef(req.user.uid).get();
    if (!snap.exists) return res.json({ connected: false });
    const { xUsername, xProfileImage, connectedAt } = snap.data();
    res.json({ connected: true, xUsername, xProfileImage, connectedAt });
  } catch (err) {
    console.error('[X status]', err);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

router.post('/disconnect', requireAuth, requireAdmin, async (req, res) => {
  const uid = req.user.uid;
  try {
    const snap = await tokenRef(uid).get();
    if (snap.exists) {
      const { accessToken } = snap.data();
      try {
        await axios.post(X_REVOKE_URL, new URLSearchParams({
          token:            decryptToken(accessToken),
          token_type_hint:  'access_token',
          client_id:        X_CLIENT_ID,
        }).toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization:  basicAuthHeader(),
          },
        });
      } catch (_) { /* non-fatal */ }
      await tokenRef(uid).delete();
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[X disconnect]', err);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

router.get('/history', requireAuth, requireAdmin, async (req, res) => {
  const uid   = req.user.uid;
  const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 100);
  try {
    const snap = await adminFirestore.collection('xPostLog')
      .where('uid', '==', uid)
      .orderBy('postedAt', 'desc')
      .limit(limit)
      .get();
    res.json({ posts: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    console.error('[X history]', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/** POST /x/post-with-media */
router.post('/post-with-media', requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
  const uid = req.user.uid;
  const { text, sourceId, sourceType } = req.body;

  if (!req.file)     return res.status(400).json({ error: 'image is required' });
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

  const {
    X_API_KEY,
    X_API_SECRET,
    X_ACCESS_TOKEN,
    X_ACCESS_SECRET,
  } = process.env;

  try {
    const accessToken = await getValidAccessToken(uid);

    // ── Step 1: Upload media via OAuth 1.0a ──
    const oauthHeader = buildOAuth1Header({
      method:         'POST',
      url:            X_MEDIA_URL,
      consumerKey:    X_API_KEY,
      consumerSecret: X_API_SECRET,
      accessToken:    X_ACCESS_TOKEN,
      accessSecret:   X_ACCESS_SECRET,
      bodyParams:     {},
    });

    const mediaForm = new FormData();
    mediaForm.append('media', req.file.buffer, {
      filename:    'share.png',
      contentType: 'image/png',
    });

    const mediaRes = await axios.post(X_MEDIA_URL, mediaForm, {
      headers: {
        Authorization: oauthHeader,
        ...mediaForm.getHeaders(),
      },
    });

    const mediaId = mediaRes.data.media_id_string;

    // ── Step 2: Post tweet with media via OAuth 2.0 ──
    const { data: tweetData } = await axios.post(
      X_TWEET_URL,
      { text: text.trim(), media: { media_ids: [mediaId] } },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );

    const tweetId  = tweetData.data.id;
    const tweetUrl = `https://twitter.com/i/web/status/${tweetId}`;

    await adminFirestore.collection('xPostLog').add({
      uid, sourceId, sourceType,
      text:     text.trim(),
      tweetId,  tweetUrl,
      hasMedia: true,
      status:   'success',
      postedAt: Date.now(),
    });

    res.json({ success: true, tweetId, tweetUrl });

  } catch (err) {
    console.error('[X post-with-media]', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to post tweet with media' });
  }
});

export default router;