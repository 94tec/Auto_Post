// services/jobQueue.js
// Simple, reliable job queue backed by Redis Lists.
// Uses LPUSH to enqueue and BRPOP to dequeue (blocking pop = no polling).
//
// Supported jobs:
//   - send_welcome_email   (after user registers)
//   - send_quote_digest    (daily quote digest email)
//   - audit_log_flush      (batch-write audit logs to Firestore)
//   - cache_warmup         (pre-fill cache after cold start)

import redis from '../config/redis.js';
import { KEYS } from './cache.js';

/* ── job definitions ────────────────────────────────────────── */
export const JOBS = {
  WELCOME_EMAIL:   'send_welcome_email',
  QUOTE_DIGEST:    'send_quote_digest',
  AUDIT_LOG_FLUSH: 'audit_log_flush',
  CACHE_WARMUP:    'cache_warmup',
};

const QUEUE_KEY   = (name) => KEYS.jobQueue(name);
const DEFAULT_Q   = 'default';
const DEAD_LETTER = 'queue:dead';

/* ── enqueue ────────────────────────────────────────────────── */
/**
 * Add a job to the queue.
 * @param {string} type    Job type from JOBS
 * @param {object} payload Job data
 * @param {string} queue   Queue name (default: 'default')
 */
export const enqueue = async (type, payload = {}, queue = DEFAULT_Q) => {
  if (!redis.isReady) {
    console.warn(`[Queue] Redis not ready — job ${type} dropped`);
    return null;
  }
  try {
    const job = {
      id:        `${type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
      attempts:  0,
    };
    await redis.lPush(QUEUE_KEY(queue), JSON.stringify(job));
    console.log(`[Queue] Enqueued ${job.id}`);
    return job;
  } catch (err) {
    console.error('[Queue] enqueue error:', err.message);
    return null;
  }
};

/* ── worker ─────────────────────────────────────────────────── */
/**
 * Register a handler and start processing jobs from a queue.
 * Runs in a loop — call once at server startup.
 *
 * @param {object}   handlers  { [JOBS.TYPE]: async (payload) => void }
 * @param {string}   queue     Queue name (default: 'default')
 * @param {number}   maxRetries  Max retry attempts before dead-lettering
 */
export const startWorker = async (handlers, queue = DEFAULT_Q, maxRetries = 3) => {
  if (!redis.isReady) {
    console.warn('[Queue] Worker not started — Redis not ready');
    return;
  }

  console.log(`[Queue] Worker started on queue: ${queue}`);

  // Use a second client for blocking operations so we don't block the main client
  const workerClient = redis.duplicate();
  await workerClient.connect();

  const process = async () => {
    while (true) {
      try {
        // BRPOP blocks for up to 5s, then loops — allows graceful shutdown
        const result = await workerClient.brPop(QUEUE_KEY(queue), 5);
        if (!result) continue;

        const job = JSON.parse(result.element);
        job.attempts += 1;

        const handler = handlers[job.type];
        if (!handler) {
          console.warn(`[Queue] No handler for job type: ${job.type}`);
          continue;
        }

        try {
          await handler(job.payload);
          console.log(`[Queue] ✅ Completed ${job.id}`);
        } catch (err) {
          console.error(`[Queue] ❌ Failed ${job.id} (attempt ${job.attempts}):`, err.message);

          if (job.attempts < maxRetries) {
            // Re-queue with backoff delay (simple version: just re-push)
            job.lastError = err.message;
            await redis.lPush(QUEUE_KEY(queue), JSON.stringify(job));
            console.log(`[Queue] ↩️  Re-queued ${job.id} (attempt ${job.attempts}/${maxRetries})`);
          } else {
            // Dead-letter: save for inspection
            await redis.lPush(DEAD_LETTER, JSON.stringify({
              ...job,
              deadAt:    new Date().toISOString(),
              lastError: err.message,
            }));
            console.error(`[Queue] 💀 Dead-lettered ${job.id}`);
          }
        }
      } catch (err) {
        // Worker loop error (e.g. Redis disconnect) — wait before retrying
        console.error('[Queue] Worker loop error:', err.message);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  };

  // Run non-blocking
  process().catch(err => console.error('[Queue] Worker crashed:', err));
};

/* ── inspect ─────────────────────────────────────────────────── */
export const getQueueLength  = (queue = DEFAULT_Q) =>
  redis.isReady ? redis.lLen(QUEUE_KEY(queue)).catch(() => 0) : Promise.resolve(0);

export const getDeadLetters  = async (count = 20) => {
  if (!redis.isReady) return [];
  try {
    const items = await redis.lRange(DEAD_LETTER, 0, count - 1);
    return items.map(i => JSON.parse(i));
  } catch { return []; }
};

export const clearDeadLetters = () =>
  redis.isReady ? redis.del(DEAD_LETTER).catch(() => {}) : Promise.resolve();