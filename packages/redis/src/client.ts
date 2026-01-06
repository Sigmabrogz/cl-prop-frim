import Redis from 'ioredis';

const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';

// Parse Redis URL for cluster support detection
const isCluster = redisUrl.includes(',');

// Create Redis client
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Only reconnect when the error contains "READONLY"
      return true;
    }
    return false;
  },
});

// Connection event handlers
redis.on('connect', () => {
  console.log('[Redis] Connected to Redis server');
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('close', () => {
  console.log('[Redis] Connection closed');
});

// Create a duplicate for pub/sub (pub/sub needs dedicated connection)
export const createPubSubClient = () => {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
  });
};

// Health check
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
};

// Graceful shutdown
export const closeRedis = async (): Promise<void> => {
  await redis.quit();
};

export type RedisClient = typeof redis;



