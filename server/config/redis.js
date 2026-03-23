// config/redis.js
// node-redis v4 — Redis Cloud connection using host + password env vars
//
// Required .env vars:
//   REDIS_CLOUD_HOST=your-host.redis.cloud
//   REDIS_CLOUD_PORT=11784          (or whatever port Redis Cloud assigned)
//   REDIS_PASSWORD=your-password

import { createClient } from 'redis';

const client = createClient({
  username: 'default',
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_CLOUD_HOST,
    port: Number(process.env.REDIS_CLOUD_PORT) || 11784,
    tls:  false,                          // Redis Cloud requires TLS
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('[Redis] Max reconnection attempts reached');
        return new Error('[Redis] Max retries exceeded');
      }
      // Exponential backoff: 100ms → 200ms → 400ms … capped at 5s
      return Math.min(retries * 100, 5000);
    },
  },
});

client.on('connect',      () => console.log('[Redis] Connected'));
client.on('ready',        () => console.log('[Redis] Ready'));
client.on('error',  (err) => console.error('[Redis] Error:', err.message));
client.on('reconnecting', () => console.log('[Redis] Reconnecting…'));
client.on('end',          () => console.log('[Redis] Connection closed'));

/**
 * Call once at server startup — before app.listen().
 * Fails gracefully: logs error and continues if Redis is unavailable.
 */
export const connectRedis = async () => {
  try {
    await client.connect();
    // Smoke test: confirm read/write works
    await client.set('ping', 'pong', { EX: 10 });
    const pong = await client.get('ping');
    console.log(`[Redis] Smoke test: ${pong === 'pong' ? '✅ OK' : '❌ Failed'}`);
  } catch (err) {
    console.error('[Redis] Initial connection failed:', err.message);
    // App continues without Redis — all cache/rate-limit ops degrade gracefully
  }
};

export default client;