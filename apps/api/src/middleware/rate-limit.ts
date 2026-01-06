// ===========================================
// RATE LIMITER MIDDLEWARE
// ===========================================

import type { MiddlewareHandler } from 'hono';
import { redis } from '@propfirm/redis';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix: string;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 1000, // 1000 requests per minute
  keyPrefix: 'ratelimit',
};

/**
 * Create a rate limiter middleware using Redis
 */
function createRateLimiter(config: Partial<RateLimitConfig> = {}): MiddlewareHandler {
  const { windowMs, maxRequests, keyPrefix } = { ...defaultConfig, ...config };

  return async (c, next) => {
    // Get client identifier (IP address)
    const clientIp =
      c.req.header('CF-Connecting-IP') || // Cloudflare
      c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
      c.req.header('X-Real-IP') ||
      'unknown';

    const key = `${keyPrefix}:${clientIp}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Use Redis sorted set for sliding window rate limiting
      // Remove old entries outside the window
      await redis.zremrangebyscore(key, 0, windowStart);

      // Count requests in current window
      const requestCount = await redis.zcard(key);

      if (requestCount >= maxRequests) {
        // Rate limit exceeded
        c.header('X-RateLimit-Limit', maxRequests.toString());
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000).toString());
        c.header('Retry-After', Math.ceil(windowMs / 1000).toString());

        return c.json(
          {
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil(windowMs / 1000),
          },
          429
        );
      }

      // Add current request to the window
      await redis.zadd(key, now, `${now}:${crypto.randomUUID()}`);

      // Set expiry on the key (cleanup)
      await redis.expire(key, Math.ceil(windowMs / 1000) + 1);

      // Set rate limit headers
      c.header('X-RateLimit-Limit', maxRequests.toString());
      c.header('X-RateLimit-Remaining', (maxRequests - requestCount - 1).toString());
      c.header('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000).toString());

      await next();
    } catch (error) {
      // If Redis fails, allow the request but log the error
      console.error('[RateLimiter] Redis error:', error);
      await next();
    }
  };
}

// Default rate limiter (1000 req/min)
export const rateLimiter = createRateLimiter();

// Strict rate limiter for auth endpoints (10 req/min)
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  keyPrefix: 'ratelimit:auth',
});

// Very strict rate limiter for sensitive operations (5 req/min)
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  keyPrefix: 'ratelimit:strict',
});

