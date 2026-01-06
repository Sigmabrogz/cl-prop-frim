// ===========================================
// REDIS PACKAGE - Main Export
// ===========================================

// Client
export { redis, createPubSubClient, checkRedisHealth, closeRedis } from './client.js';
export type { RedisClient } from './client.js';

// Distributed Locks
export {
  redlock,
  acquireLock,
  withLock,
  withAccountLock,
  withPositionLock,
} from './locks.js';
export type { Lock, LockOptions } from './locks.js';

// Streams (Message Queue)
export {
  addToStream,
  readFromStream,
  createConsumerGroup,
  acknowledgeMessage,
  acknowledgeMessages,
  getPendingMessages,
  trimStream,
  STREAMS,
  CONSUMER_GROUPS,
} from './streams.js';
export type { StreamMessage, StreamEntry } from './streams.js';

// Pub/Sub
export { publish, Subscriber, CHANNELS, PATTERNS } from './pubsub.js';

// Cache
export {
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  getOrSetCache,
  incrementCounter,
  decrementCounter,
  setExpiry,
  exists,
  setHash,
  getHash,
  getHashField,
  deleteHashField,
  CACHE_KEYS,
} from './cache.js';
export type { CacheOptions } from './cache.js';



