// @ts-ignore - redlock types issue with package.json exports
import Redlock from 'redlock';
import { redis } from './client.js';

// ===========================================
// DISTRIBUTED LOCKING WITH REDLOCK
// ===========================================

// Redlock instance for distributed locking
export const redlock = new Redlock([redis], {
  // The expected clock drift; for more details see:
  // http://redis.io/topics/distlock
  driftFactor: 0.01, // multiplied by lock ttl to determine drift time

  // The max number of times Redlock will attempt to lock a resource
  retryCount: 10,

  // The time in ms between attempts
  retryDelay: 200, // time in ms

  // The max time in ms randomly added to retries
  retryJitter: 200, // time in ms

  // The minimum remaining time on a lock before an extension is automatically
  // attempted with the `using` API.
  automaticExtensionThreshold: 500, // time in ms
});

// Error handler
redlock.on('error', (error: Error) => {
  // Ignore resource locked errors (expected behavior)
  if (error.name === 'ResourceLockedError') {
    return;
  }
  console.error('[Redlock] Error:', error);
});

// ===========================================
// LOCK UTILITIES
// ===========================================

export interface LockOptions {
  /** Lock duration in milliseconds */
  duration?: number;
  /** Number of retry attempts */
  retryCount?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
}

const DEFAULT_LOCK_DURATION = 10000; // 10 seconds

/**
 * Acquire a distributed lock for a resource
 */
export async function acquireLock(
  resource: string,
  options: LockOptions = {}
): Promise<Redlock.Lock | null> {
  const { duration = DEFAULT_LOCK_DURATION } = options;

  try {
    const lock = await redlock.acquire([`lock:${resource}`], duration);
    return lock;
  } catch (error) {
    if (error instanceof Error && error.name === 'ResourceLockedError') {
      return null;
    }
    throw error;
  }
}

/**
 * Execute a function with a distributed lock
 * Automatically releases lock after execution
 */
export async function withLock<T>(
  resource: string,
  fn: () => Promise<T>,
  options: LockOptions = {}
): Promise<T> {
  const { duration = DEFAULT_LOCK_DURATION } = options;

  return redlock.using([`lock:${resource}`], duration, async (signal: { aborted: boolean }) => {
    // Check if lock was lost
    if (signal.aborted) {
      throw new Error(`Lock lost for resource: ${resource}`);
    }

    return fn();
  });
}

/**
 * Account-specific lock for trading operations
 * Critical for preventing race conditions in trade execution
 */
export async function withAccountLock<T>(
  accountId: string,
  fn: () => Promise<T>,
  options: LockOptions = {}
): Promise<T> {
  return withLock(`account:${accountId}`, fn, {
    duration: 15000, // 15 seconds for trade operations
    ...options,
  });
}

/**
 * Position-specific lock for modifications
 */
export async function withPositionLock<T>(
  positionId: string,
  fn: () => Promise<T>,
  options: LockOptions = {}
): Promise<T> {
  return withLock(`position:${positionId}`, fn, {
    duration: 10000,
    ...options,
  });
}

export type Lock = Awaited<ReturnType<typeof redlock.acquire>>;



