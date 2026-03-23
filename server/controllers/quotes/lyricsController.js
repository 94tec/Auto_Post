// ══════════════════════════════════════════════════════════════
// controllers/lyricsController.js
// Stores lyrics in Firebase Realtime DB under `lyrics/`
// Separate from `quotes/` — displayed only in DailyCard mockup.
// Only admins can write. Anyone can read.
// ══════════════════════════════════════════════════════════════
 
import { admin }    from '../../config/firebase.js';
import { cacheGet, cacheSet, cacheDel } from '../../services/cache.js';
import AuditLog     from '../../services/auditLog.js';
 
const db      = admin.database();
const REF     = 'lyrics';
const CACHE_K = 'lyrics:all';
const TTL     = 60 * 10; // 10 min
 
const snap2arr = (snap) => {
  const v = snap.val();
  if (!v) return [];
  return Object.entries(v).map(([id, d]) => ({ id, ...d }));
};
 
export const getLyrics = async (req, res) => {
  try {
    const cached = await cacheGet(CACHE_K);
    if (cached) return res.json({ lyrics: cached, total: cached.length, fromCache: true });
 
    const snap   = await db.ref(REF).once('value');
    const lyrics = snap2arr(snap);
    await cacheSet(CACHE_K, lyrics, TTL);
    return res.json({ lyrics, total: lyrics.length });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch lyrics', code: 'SERVER_ERROR' });
  }
};
 
export const getLyric = async (req, res) => {
  try {
    const snap = await db.ref(`${REF}/${req.params.id}`).once('value');
    if (!snap.exists()) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    return res.json({ lyric: { id: snap.key, ...snap.val() } });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch', code: 'SERVER_ERROR' });
  }
};
 
export const createLyric = async (req, res) => {
  const { text, artist, genre } = req.body;
  if (!text?.trim() || !artist?.trim())
    return res.status(400).json({ error: 'text and artist are required', code: 'MISSING_FIELDS' });
  if (text.trim().length < 5)
    return res.status(400).json({ error: 'Text too short (min 5 chars)', code: 'TEXT_TOO_SHORT' });
  if (text.trim().length > 300)
    return res.status(400).json({ error: 'Text too long (max 300 chars)', code: 'TEXT_TOO_LONG' });
 
  try {
    const ref  = db.ref(REF).push();
    const data = {
      text:      text.trim(),
      artist:    artist.trim(),
      genre:     genre?.trim() || 'motivation',
      createdBy: req.uid,
      createdAt: new Date().toISOString(),
    };
    await ref.set(data);
    await cacheDel(CACHE_K);
 
    AuditLog.record('LYRIC_CREATED', {
      userId: req.uid, ip: req.ip, metadata: { lyricId: ref.key, artist },
    }).catch(() => {});
 
    return res.status(201).json({ message: 'Lyric created', lyric: { id: ref.key, ...data } });
  } catch {
    return res.status(500).json({ error: 'Failed to create', code: 'SERVER_ERROR' });
  }
};
 
export const updateLyric = async (req, res) => {
  const { id } = req.params;
  try {
    const snap = await db.ref(`${REF}/${id}`).once('value');
    if (!snap.exists()) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
 
    const up = { updatedAt: new Date().toISOString() };
    if (req.body.text)   up.text   = req.body.text.trim();
    if (req.body.artist) up.artist = req.body.artist.trim();
    if (req.body.genre)  up.genre  = req.body.genre.trim();
 
    await db.ref(`${REF}/${id}`).update(up);
    await cacheDel(CACHE_K);
    return res.json({ message: 'Updated', lyric: { id, ...snap.val(), ...up } });
  } catch {
    return res.status(500).json({ error: 'Failed to update', code: 'SERVER_ERROR' });
  }
};
 
export const deleteLyric = async (req, res) => {
  const { id } = req.params;
  try {
    const snap = await db.ref(`${REF}/${id}`).once('value');
    if (!snap.exists()) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    await db.ref(`${REF}/${id}`).remove();
    await cacheDel(CACHE_K);
    AuditLog.record('LYRIC_DELETED', { userId: req.uid, ip: req.ip, metadata: { lyricId: id } }).catch(() => {});
    return res.json({ message: 'Deleted', id });
  } catch {
    return res.status(500).json({ error: 'Failed to delete', code: 'SERVER_ERROR' });
  }
};