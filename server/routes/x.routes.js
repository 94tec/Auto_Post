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

router.get(
  '/connect',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    // ← capture origin before try so catch can use it
    const origin = req.headers.origin ||
      req.headers.referer?.replace(/\/$/, '') ||
      process.env.CLIENT_URL;

    // Whitelist — prevent open redirect
    const ALLOWED = [
      'http://localhost:5173',
      'http://localhost:3000',
      process.env.CLIENT_URL,
    ].filter(Boolean);
    const safeOrigin = ALLOWED.includes(origin) ? origin : process.env.CLIENT_URL;

    try {
      const uid = req.user.uid;

      const state        = crypto.randomBytes(16).toString('hex');
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      await adminFirestore.collection('xOAuthState').doc(uid).set({
        state,
        origin:    safeOrigin,   // ← use safeOrigin
        codeVerifier,
        createdAt: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      const encodedState = Buffer.from(
        JSON.stringify({ uid, state })
      ).toString('base64url');

      const params = new URLSearchParams({
        response_type:         'code',
        client_id:             process.env.X_CLIENT_ID,
        redirect_uri:          process.env.X_CALLBACK_URL,
        scope:                 process.env.X_SCOPES,
        state:                 encodedState,
        code_challenge:        codeChallenge,
        code_challenge_method: 'S256',
      });

      res.redirect(`https://twitter.com/i/oauth2/authorize?${params}`);

    } catch (err) {
      console.error('[X connect]', err);
      // ← was CLIENT_URL, now uses safeOrigin
      res.redirect(`${safeOrigin}/dashboard?x_error=connect_failed`);
    }
  }
);

router.get('/connect-url', requireAuth, requireAdmin, async (req, res) => {
  // Detect and whitelist origin
  const origin = req.headers.origin ||
    req.headers.referer?.replace(/\/$/, '') ||
    process.env.CLIENT_URL;

  const ALLOWED = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.CLIENT_URL,
  ].filter(Boolean);

  const safeOrigin = ALLOWED.includes(origin) ? origin : process.env.CLIENT_URL;

  try {
    const uid          = req.user.uid;
    const state        = crypto.randomBytes(16).toString('hex');
    const codeVerifier = generateCodeVerifier();
    const challenge    = generateCodeChallenge(codeVerifier);

    await adminFirestore.collection('xOAuthState').doc(uid).set({
      state,
      codeVerifier,
      origin:    safeOrigin,   // ← add this
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
  let redirectOrigin = process.env.CLIENT_URL;

  try {
    const { code, state: rawState } = req.query;
    if (!code || !rawState) throw new Error('Missing code or state');

    // Handle both state formats:
    // Format A (connect-url): "uid:statehex"
    // Format B (connect):     base64url JSON { uid, state }
    let uid, state;

    if (rawState.includes(':')) {
      // Format A — old connect-url format
      [uid, state] = rawState.split(':');
    } else {
      // Format B — new connect format
      const parsed = JSON.parse(Buffer.from(rawState, 'base64url').toString());
      uid   = parsed.uid;
      state = parsed.state;
    }

    const stateDoc = await adminFirestore.collection('xOAuthState').doc(uid).get();
    if (!stateDoc.exists) throw new Error('OAuth state not found');

    const saved = stateDoc.data();

    // Set redirectOrigin early so catch can use it
    redirectOrigin = saved.origin ?? process.env.CLIENT_URL;

    if (saved.state !== state)         throw new Error('Invalid OAuth state');
    if (Date.now() > saved.expiresAt)  throw new Error('OAuth state expired');

    const tokenResponse = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      new URLSearchParams({
        code,
        grant_type:    'authorization_code',
        redirect_uri:  process.env.X_CALLBACK_URL ?? X_REDIRECT_URI,
        code_verifier: saved.codeVerifier,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:  basicAuthHeader(),
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Fetch X profile
    const { data: meData } = await axios.get(
      `${X_ME_URL}?user.fields=profile_image_url,username`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const xUsername     = meData.data?.username     ?? '';
    const xProfileImage = meData.data?.profile_image_url ?? '';

    // Save to xTokens (encrypted)
    await tokenRef(uid).set({
      accessToken:  encryptToken(access_token),
      refreshToken: encryptToken(refresh_token ?? ''),
      expiresAt:    Date.now() + expires_in * 1000,
      xUsername,
      xProfileImage,
      connectedAt:  Date.now(),
    }, { merge: true });

    // Also save to xConnections (plain — for status checks)
    await adminFirestore.collection('xConnections').doc(uid).set({
      accessToken:  access_token,
      refreshToken: refresh_token,
      expiresIn:    expires_in,
      xUsername,
      xProfileImage,
      connectedAt:  Date.now(),
    });

    await adminFirestore.collection('xOAuthState').doc(uid).delete();

    // Redirect to wherever the flow started
    res.redirect(`${redirectOrigin}/dashboard?x_connected=true&x_user=${xUsername}`);

  } catch (err) {
    console.error('[X callback]', err.message);
    res.redirect(`${redirectOrigin}/dashboard?x_error=oauth_failed`);
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