// ===========================================
// WEBSOCKET RATE LIMITER (REDIS-BASED)
// ===========================================
// Cluster-safe rate limiting using Redis for distributed state

import { redis } from '@propfirm/redis';
import { db } from '@propfirm/database';
import { auditLogs } from '@propfirm/database/schema';

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  // Order placement: max 10 per second
  PLACE_ORDER: { windowMs: 1000, maxRequests: 10 },
  // Position modifications: max 20 per second
  MODIFY_POSITION: { windowMs: 1000, maxRequests: 20 },
  CLOSE_POSITION: { windowMs: 1000, maxRequests: 20 },
  // Subscriptions: max 5 per second
  SUBSCRIBE: { windowMs: 1000, maxRequests: 5 },
  UNSUBSCRIBE: { windowMs: 1000, maxRequests: 5 },
  // General messages: max 100 per second
  DEFAULT: { windowMs: 1000, maxRequests: 100 },
};

class RateLimiter {
  private readonly keyPrefix = 'ratelimit:';
  // In-memory fallback for when Redis is unavailable
  private localLimits: Map<string, { count: number; windowStart: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private useLocalFallback = false;

  constructor() {
    // Clean up local fallback entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a user is rate limited for a specific action (async, Redis-based)
   * @returns true if rate limited (should reject), false if allowed
   */
  async isRateLimitedAsync(userId: string, action: string): Promise<boolean> {
    const config = DEFAULT_CONFIGS[action] || DEFAULT_CONFIGS.DEFAULT;
    const key = `${this.keyPrefix}${action}:${userId}`;
    const windowSeconds = Math.ceil(config.windowMs / 1000);

    try {
      // Atomic increment with expiry using Redis
      const current = await redis.incr(key);
      
      if (current === 1) {
        // First request in window, set expiry
        await redis.expire(key, windowSeconds);
      }

      this.useLocalFallback = false;
      return current > config.maxRequests;
    } catch (error) {
      console.error('[RateLimiter] Redis error, using local fallback:', error);
      this.useLocalFallback = true;
      return this.isRateLimitedLocal(userId, action);
    }
  }

  /**
   * Synchronous rate limiting (uses local fallback or cached state)
   * For backwards compatibility with existing code
   */
  isRateLimited(userId: string, action: string): boolean {
    // If we know Redis is down, use local immediately
    if (this.useLocalFallback) {
      return this.isRateLimitedLocal(userId, action);
    }

    // For sync calls, use local and trigger async Redis update
    const isLimited = this.isRateLimitedLocal(userId, action);
    
    // Fire async Redis check in background
    this.isRateLimitedAsync(userId, action).catch(err => {
      console.error('[RateLimiter] Background Redis check failed:', err);
    });

    return isLimited;
  }

  /**
   * Local in-memory rate limiting (fallback)
   */
  private isRateLimitedLocal(userId: string, action: string): boolean {
    const config = DEFAULT_CONFIGS[action] || DEFAULT_CONFIGS.DEFAULT;
    const key = `${userId}:${action}`;
    const now = Date.now();

    const entry = this.localLimits.get(key);

    if (!entry || now - entry.windowStart >= config.windowMs) {
      // New window
      this.localLimits.set(key, { count: 1, windowStart: now });
      return false;
    }

    if (entry.count >= config.maxRequests) {
      return true;
    }

    entry.count++;
    return false;
  }

  /**
   * Get remaining requests for a user/action (async)
   */
  async getRemainingRequestsAsync(userId: string, action: string): Promise<number> {
    const config = DEFAULT_CONFIGS[action] || DEFAULT_CONFIGS.DEFAULT;
    const key = `${this.keyPrefix}${action}:${userId}`;

    try {
      const current = await redis.get(key);
      return Math.max(0, config.maxRequests - (parseInt(current || '0', 10)));
    } catch {
      return this.getRemainingRequestsLocal(userId, action);
    }
  }

  /**
   * Get remaining requests (sync version)
   */
  getRemainingRequests(userId: string, action: string): number {
    return this.getRemainingRequestsLocal(userId, action);
  }

  private getRemainingRequestsLocal(userId: string, action: string): number {
    const config = DEFAULT_CONFIGS[action] || DEFAULT_CONFIGS.DEFAULT;
    const key = `${userId}:${action}`;
    const now = Date.now();

    const entry = this.localLimits.get(key);

    if (!entry || now - entry.windowStart >= config.windowMs) {
      return config.maxRequests;
    }

    return Math.max(0, config.maxRequests - entry.count);
  }

  /**
   * Get time until rate limit resets
   */
  getResetTime(userId: string, action: string): number {
    const config = DEFAULT_CONFIGS[action] || DEFAULT_CONFIGS.DEFAULT;
    const key = `${userId}:${action}`;
    const now = Date.now();

    const entry = this.localLimits.get(key);

    if (!entry) {
      return 0;
    }

    const elapsed = now - entry.windowStart;
    return Math.max(0, config.windowMs - elapsed);
  }

  /**
   * Clean up expired local entries
   */
  private cleanup(): void {
    const now = Date.now();
    const maxWindowMs = Math.max(...Object.values(DEFAULT_CONFIGS).map(c => c.windowMs));

    for (const [key, entry] of this.localLimits.entries()) {
      if (now - entry.windowStart > maxWindowMs * 2) {
        this.localLimits.delete(key);
      }
    }
  }

  /**
   * Stop the cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// ===========================================
// ORDER TIMESTAMP VALIDATION
// ===========================================

const MAX_ORDER_AGE_MS = 3000; // Orders older than 3 seconds are rejected (reduced from 5s)
const MAX_FUTURE_TOLERANCE_MS = 1000; // Allow 1 second clock skew into future

/**
 * Validate that an order timestamp is recent enough
 * @returns null if valid, error message if invalid
 */
export function validateOrderTimestamp(timestamp: number | undefined): string | null {
  // SECURITY: Timestamp is REQUIRED - no backwards compatibility
  if (timestamp === undefined || timestamp === null) {
    return 'Order timestamp is required';
  }

  if (typeof timestamp !== 'number' || isNaN(timestamp)) {
    return 'Invalid timestamp format';
  }

  const now = Date.now();
  const age = now - timestamp;

  // Check if order is too old
  if (age > MAX_ORDER_AGE_MS) {
    return `Order timestamp expired (${Math.round(age / 1000)}s old, max ${MAX_ORDER_AGE_MS / 1000}s)`;
  }

  // Check if order is from the future (clock skew protection)
  if (age < -MAX_FUTURE_TOLERANCE_MS) {
    return 'Order timestamp is in the future';
  }

  return null;
}

// ===========================================
// AUDIT LOGGING (DATABASE-BACKED)
// ===========================================

interface AuditLogEntry {
  timestamp: number;
  userId: string;
  accountId?: string;
  connectionId: string;
  action: string;
  data: Record<string, unknown>;
  ip?: string;
  success?: boolean;
  error?: string;
}

class AuditLogger {
  private buffer: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private maxBufferSize = 100;
  private isShuttingDown = false;

  constructor() {
    // Flush every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  log(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    const fullEntry: AuditLogEntry = {
      ...entry,
      timestamp: Date.now(),
      success: entry.success ?? true,
    };

    this.buffer.push(fullEntry);

    // Immediate flush for critical events
    const criticalActions = ['ACCOUNT_BREACH', 'PAYOUT_REQUEST', 'PAYOUT_APPROVED', 'PAYOUT_REJECTED', 'SECURITY_ALERT'];
    if (criticalActions.some(action => entry.action.includes(action))) {
      this.flush();
    }

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      // Insert into database
      await db.insert(auditLogs).values(
        entries.map(e => ({
          userId: e.userId,
          accountId: e.accountId,
          action: e.action,
          details: e.data,
          ipAddress: e.ip,
          success: e.success ?? true,
          errorMessage: e.error,
          createdAt: new Date(e.timestamp),
        }))
      );

      console.log(`[AuditLog] Flushed ${entries.length} entries to database`);
    } catch (error) {
      console.error('[AuditLog] Failed to flush to database:', error);
      
      // Re-add to buffer for retry (only if not shutting down)
      if (!this.isShuttingDown) {
        this.buffer.unshift(...entries);
        
        // Prevent buffer from growing too large
        if (this.buffer.length > this.maxBufferSize * 2) {
          const dropped = this.buffer.splice(this.maxBufferSize * 2);
          console.error(`[AuditLog] Dropped ${dropped.length} entries due to buffer overflow`);
        }
      }
      
      // Log to console as fallback
      for (const entry of entries) {
        console.log(`[AuditLog:Fallback] ${JSON.stringify(entry)}`);
      }
    }
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Final flush
    await this.flush();
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
  }
}

export const auditLogger = new AuditLogger();
