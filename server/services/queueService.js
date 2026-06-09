/**
 * queueService.js
 * Core queue operations — add, pop, update, analytics
 */

import { adminFirestore } from '../config/firebase.js';

const QUEUE_COL     = 'xQueue';
const ANALYTICS_COL = 'xQueueAnalytics';
const SLOTS_DOC     = 'xScheduleSlots';

// ── Default AI-optimized time slots (24h, UTC) ──────────────
// Based on X engagement research — updated dynamically over time
const DEFAULT_SLOTS = [8, 12, 16, 20, 23]; // hours in UTC

export const queueService = {
 
  // ── Add item to queue ──────────────────────────────────────
  async add({ quoteId, text, author, category, addedBy }) {
    // Check for duplicates
    const existing = await adminFirestore
      .collection(QUEUE_COL)
      .where('quoteId', '==', quoteId)
      .where('status', 'in', ['pending', 'retry'])
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new Error('This quote is already in the queue');
    }

    const ref = await adminFirestore.collection(QUEUE_COL).add({
      quoteId,
      text,
      author,
      category,
      addedBy,
      status:     'pending',   // pending | posted | failed | retry | skipped
      retries:    0,
      maxRetries: 3,
      createdAt:  Date.now(),
      scheduledAt: null,
      postedAt:    null,
      tweetId:     null,
      tweetUrl:    null,
      error:       null,
    });

    return { id: ref.id };
  },

  // ── Get next pending item ──────────────────────────────────
  async getNext() {
    const snap = await adminFirestore
      .collection(QUEUE_COL)
      .where('status', 'in', ['pending', 'retry'])
      .orderBy('createdAt', 'asc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  },

  // ── Mark as posted ─────────────────────────────────────────
  async markPosted(id, { tweetId, tweetUrl, scheduledSlot }) {
    await adminFirestore.collection(QUEUE_COL).doc(id).update({
      status:   'posted',
      tweetId,
      tweetUrl,
      postedAt: Date.now(),
      error:    null,
    });

    // Record engagement slot for AI optimization
    await queueService.recordSlotSuccess(scheduledSlot);
  },

  // ── Mark as failed ─────────────────────────────────────────
  async markFailed(id, error) {
    const snap = await adminFirestore.collection(QUEUE_COL).doc(id).get();
    const data = snap.data();
    const retries = (data.retries ?? 0) + 1;

    await adminFirestore.collection(QUEUE_COL).doc(id).update({
      status:  retries >= (data.maxRetries ?? 3) ? 'failed' : 'retry',
      retries,
      error:   error?.message ?? String(error),
    });
  },

  // ── Get queue (admin) ──────────────────────────────────────
  async getAll({ limit = 50, status } = {}) {
  let q = adminFirestore.collection(QUEUE_COL);

  // Apply where BEFORE orderBy to avoid composite index requirement
  if (status) {
    q = q.where('status', '==', status).orderBy('createdAt', 'desc');
  } else {
    q = q.orderBy('createdAt', 'desc');
  }

  const snap = await q.limit(limit).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
},

  // ── Delete from queue ──────────────────────────────────────
  async remove(id) {
    await adminFirestore.collection(QUEUE_COL).doc(id).delete();
  },

  // ── Count by status ────────────────────────────────────────
  async getCounts() {
    const statuses = ['pending', 'posted', 'failed', 'retry', 'skipped'];
    const counts   = {};

    await Promise.all(statuses.map(async (s) => {
      const snap = await adminFirestore
        .collection(QUEUE_COL)
        .where('status', '==', s)
        .count()
        .get();
      counts[s] = snap.data().count;
    }));

    return counts;
  },

  // ── AI slot optimization ───────────────────────────────────

  async getSlots() {
    const doc = await adminFirestore
      .collection(ANALYTICS_COL)
      .doc(SLOTS_DOC)
      .get();

    if (!doc.exists) return DEFAULT_SLOTS;
    return doc.data().slots ?? DEFAULT_SLOTS;
  },

  async recordSlotSuccess(hour) {
    if (hour == null) return;

    const ref  = adminFirestore.collection(ANALYTICS_COL).doc(SLOTS_DOC);
    const snap = await ref.get();

    const engagement = snap.exists
      ? (snap.data().engagement ?? {})
      : {};

    const current = engagement[hour] ?? { posts: 0, score: 50 };
    engagement[hour] = {
      posts: current.posts + 1,
      score: Math.min(100, current.score + 2), // success bumps score
    };

    // Recalculate optimal slots from top 5 scored hours
    const scored = Object.entries(engagement)
      .map(([h, v]) => ({ hour: parseInt(h), score: v.score }))
      .sort((a, b) => b.score - a.score);

    // Always keep at least 5 slots — fill with defaults if not enough data
    const topHours = scored.slice(0, 5).map(s => s.hour);
    while (topHours.length < 5) {
      const fallback = DEFAULT_SLOTS.find(h => !topHours.includes(h));
      if (fallback != null) topHours.push(fallback);
      else break;
    }

    const slots = topHours.sort((a, b) => a - b);

    await ref.set({ slots, engagement, updatedAt: Date.now() }, { merge: true });
    return slots;
  },

  async recordSlotFailure(hour) {
    if (hour == null) return;

    const ref  = adminFirestore.collection(ANALYTICS_COL).doc(SLOTS_DOC);
    const snap = await ref.get();
    const engagement = snap.exists ? (snap.data().engagement ?? {}) : {};
    const current    = engagement[hour] ?? { posts: 0, score: 50 };

    engagement[hour] = {
      posts: current.posts + 1,
      score: Math.max(10, current.score - 3), // failure drops score
    };

    await ref.set({ engagement, updatedAt: Date.now() }, { merge: true });
  },

  // ── Analytics ──────────────────────────────────────────────
  async getAnalytics() {
    const [counts, slotsDoc, recentSnap] = await Promise.all([
      queueService.getCounts(),
      adminFirestore.collection(ANALYTICS_COL).doc(SLOTS_DOC).get(),
      adminFirestore
        .collection(QUEUE_COL)
        .where('status', '==', 'posted')
        .orderBy('postedAt', 'desc')
        .limit(10)
        .get(),
    ]);

    const slotsData  = slotsDoc.exists ? slotsDoc.data() : {};
    const recentPosts = recentSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Posts per day (last 7 days)
    const now     = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const weekSnap = await adminFirestore
      .collection(QUEUE_COL)
      .where('status', '==', 'posted')
      .where('postedAt', '>=', weekAgo)
      .get();

    const byDay = {};
    weekSnap.docs.forEach(d => {
      const day = new Date(d.data().postedAt).toLocaleDateString('en-US', { weekday: 'short' });
      byDay[day] = (byDay[day] ?? 0) + 1;
    });

    return {
      counts,
      slots:       slotsData.slots      ?? DEFAULT_SLOTS,
      engagement:  slotsData.engagement ?? {},
      recentPosts,
      weeklyChart: byDay,
      updatedAt:   Date.now(),
    };
  },
};