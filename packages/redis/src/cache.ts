import { redis } from './client.js';

// ===========================================
// REDIS CACHE UTILITIES
// ===========================================

export interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number;
}

const DEFAULT_TTL = 3600; // 1 hour

/**
 * Get a cached value
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const value = await redis.get(key);
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

/**
 * Set a cached value
 */
export async function setCache<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  const { ttl = DEFAULT_TTL } = options;
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);

  if (ttl > 0) {
    await redis.setex(key, ttl, serialized);
  } else {
    await redis.set(key, serialized);
  }
}

/**
 * Delete a cached value
 */
export async function deleteCache(key: string): Promise<void> {
  await redis.del(key);
}

/**
 * Delete multiple cached values by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  const keys = await redis.keys(pattern);
  if (keys.length === 0) return 0;
  return redis.del(...keys);
}

/**
 * Get or set cache (cache-aside pattern)
 */
export async function getOrSetCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  const value = await fetcher();
  await setCache(key, value, options);
  return value;
}

/**
 * Increment a counter
 */
export async function incrementCounter(key: string, by: number = 1): Promise<number> {
  if (by === 1) {
    return redis.incr(key);
  }
  return redis.incrby(key, by);
}

/**
 * Decrement a counter
 */
export async function decrementCounter(key: string, by: number = 1): Promise<number> {
  if (by === 1) {
    return redis.decr(key);
  }
  return redis.decrby(key, by);
}

/**
 * Set expiry on a key
 */
export async function setExpiry(key: string, ttlSeconds: number): Promise<boolean> {
  const result = await redis.expire(key, ttlSeconds);
  return result === 1;
}

/**
 * Check if key exists
 */
export async function exists(key: string): Promise<boolean> {
  const result = await redis.exists(key);
  return result === 1;
}

// ===========================================
// HASH OPERATIONS (for complex objects)
// ===========================================

/**
 * Set hash fields
 */
export async function setHash(
  key: string,
  data: Record<string, string | number | boolean>,
  options: CacheOptions = {}
): Promise<void> {
  const stringData: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    stringData[k] = String(v);
  }

  await redis.hset(key, stringData);

  if (options.ttl && options.ttl > 0) {
    await redis.expire(key, options.ttl);
  }
}

/**
 * Get all hash fields
 */
export async function getHash<T extends Record<string, string>>(key: string): Promise<T | null> {
  const result = await redis.hgetall(key);
  if (Object.keys(result).length === 0) return null;
  return result as T;
}

/**
 * Get specific hash field
 */
export async function getHashField(key: string, field: string): Promise<string | null> {
  return redis.hget(key, field);
}

/**
 * Delete hash field
 */
export async function deleteHashField(key: string, field: string): Promise<void> {
  await redis.hdel(key, field);
}

// ===========================================
// CACHE KEY BUILDERS
// ===========================================

export const CACHE_KEYS = {
  // Price cache
  PRICE: 'cache:price',
  price: (symbol: string) => `cache:price:${symbol}`,
  
  // Session cache
  SESSION: 'cache:session',
  session: (tokenHash: string) => `cache:session:${tokenHash}`,
  
  // User cache
  USER: 'cache:user',
  user: (userId: string) => `cache:user:${userId}`,
  
  // Account cache
  ACCOUNT: 'cache:account',
  ACCOUNT_STATE: 'cache:account:state',
  account: (accountId: string) => `cache:account:${accountId}`,
  accountState: (accountId: string) => `cache:account:${accountId}:state`,
  
  // Rate limiting
  RATE_LIMIT: 'ratelimit',
  rateLimit: (identifier: string, window: string) => `ratelimit:${identifier}:${window}`,
  
  // Idempotency
  IDEMPOTENCY: 'idempotency',
  idempotency: (key: string) => `idempotency:${key}`,
} as const;



