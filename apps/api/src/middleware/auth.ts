// ===========================================
// AUTH MIDDLEWARE
// ===========================================

import type { MiddlewareHandler, Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getCookie } from 'hono/cookie';
import { verifyToken, type TokenPayload } from '../lib/jwt.js';
import { db } from '@propfirm/database';
import { sessions, users } from '@propfirm/database/schema';
import { eq, and, gt } from 'drizzle-orm';

// Extend Hono context with user data
declare module 'hono' {
  interface ContextVariableMap {
    user: {
      id: string;
      email: string;
      username: string;
      role: string;
    };
    sessionId: string;
  }
}

/**
 * Extract token from request (cookie first, then Authorization header)
 */
function extractToken(c: Context): string | null {
  // Try httpOnly cookie first (more secure)
  const cookieToken = getCookie(c, 'auth_token');
  if (cookieToken) {
    return cookieToken;
  }

  // Fall back to Authorization header (for WebSocket token validation)
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

/**
 * Authentication middleware - requires valid JWT token
 */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const token = extractToken(c);

  if (!token) {
    throw new HTTPException(401, { message: 'Missing or invalid authorization' });
  }

  try {
    // Verify JWT token
    const payload = await verifyToken(token);

    // Validate session in database
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.id, payload.sessionId),
        eq(sessions.userId, payload.userId),
        gt(sessions.expiresAt, new Date())
      ),
      with: {
        user: true,
      },
    });

    if (!session || session.revokedAt) {
      throw new HTTPException(401, { message: 'Session expired or revoked' });
    }

    // Check if user is active
    if (session.user.status !== 'active') {
      throw new HTTPException(403, { message: `Account ${session.user.status}` });
    }

    // Update last active timestamp (fire and forget)
    db.update(sessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(sessions.id, session.id))
      .execute()
      .catch((err) => console.error('[Auth] Failed to update last active:', err));

    // Set user in context
    c.set('user', {
      id: session.user.id,
      email: session.user.email || '',
      username: session.user.username,
      role: session.user.role,
    });
    c.set('sessionId', session.id);

    await next();
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('[Auth] Token verification failed:', error);
    throw new HTTPException(401, { message: 'Invalid or expired token' });
  }
};

/**
 * Admin-only middleware - requires admin role
 */
export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');

  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  if (user.role !== 'admin') {
    throw new HTTPException(403, { message: 'Admin access required' });
  }

  await next();
};

/**
 * Optional auth middleware - sets user if token present, but doesn't require it
 */
export const optionalAuth: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    try {
      const payload = await verifyToken(token);

      const session = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.id, payload.sessionId),
          eq(sessions.userId, payload.userId),
          gt(sessions.expiresAt, new Date())
        ),
        with: {
          user: true,
        },
      });

      if (session && !session.revokedAt && session.user.status === 'active') {
        c.set('user', {
          id: session.user.id,
          email: session.user.email || '',
          username: session.user.username,
          role: session.user.role,
        });
        c.set('sessionId', session.id);
      }
    } catch {
      // Ignore errors for optional auth
    }
  }

  await next();
};

