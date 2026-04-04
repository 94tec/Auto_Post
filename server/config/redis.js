// config/redis.js
import { createClient } from 'redis';

let client = null;
let isRedisReady = false;

const createRedisClient = () => {
  return createClient({
    username: 'default',
    password: process.env.REDIS_PASSWORD,
    socket: {
      host: process.env.REDIS_CLOUD_HOST,
      port: Number(process.env.REDIS_CLOUD_PORT) || 11784,
      tls: false,

      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('[Redis] Max reconnection attempts reached');
          return new Error('Max retries exceeded');
        }
        return Math.min(retries * 100, 5000);
      },
    },
  });
};

/**
 * Initialize Redis connection ONCE at startup
 */
export const connectRedis = async () => {
  try {
    client = createRedisClient();

    client.on('connect', () => console.log('[Redis] Connecting...'));
    client.on('ready', () => {
      console.log('[Redis] ✅ Ready');
      isRedisReady = true;
    });

    client.on('error', (err) => {
      console.error('[Redis] ❌ Error:', err.message);
      isRedisReady = false;
    });

    client.on('reconnecting', () => {
      console.warn('[Redis] Reconnecting...');
      isRedisReady = false;
    });

    client.on('end', () => {
      console.warn('[Redis] Connection closed');
      isRedisReady = false;
    });

    await client.connect();

    // ✅ Smoke test
    await client.set('ping', 'pong', { EX: 10 });
    const pong = await client.get('ping');

    console.log(`[Redis] Smoke test: ${pong === 'pong' ? '✅ OK' : '❌ Failed'}`);

  } catch (err) {
    console.error('[Redis] Initial connection failed:', err.message);
    isRedisReady = false;
  }
};

/**
 * Safe getter — NEVER export raw client directly
 */
export const getRedis = () => {
  if (!client || !client.isOpen || !isRedisReady) {
    throw new Error('Redis not available');
  }
  return client;
};

/**
 * Safe wrapper — prevents crashes
 */
export const safeRedis = async (operation) => {
  try {
    const redis = getRedis();
    return await operation(redis);
  } catch (err) {
    console.warn('[Redis Fallback]', err.message);
    return null; // graceful fallback
  }
};

/**
 * Health check flag
 */
export const isRedisAlive = () => isRedisReady;
