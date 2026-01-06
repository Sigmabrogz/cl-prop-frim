// ===========================================
// AUTH ROUTES
// ===========================================

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { setCookie, deleteCookie } from 'hono/cookie';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rate-limit.js';
import * as authService from '../services/auth-service.js';

const auth = new Hono();

// ===========================================
// COOKIE CONFIGURATION
// ===========================================

const isProduction = process.env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  // In development, use 'Lax' to allow cross-port cookies on localhost
  // In production with same domain, use 'Strict' for maximum security
  sameSite: isProduction ? 'Strict' as const : 'Lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().max(255).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const updateProfileSchema = z.object({
  fullName: z.string().max(255).optional(),
  countryCode: z.string().length(2).optional(),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * POST /api/auth/signup
 * Register a new user
 */
auth.post('/signup', authRateLimiter, zValidator('json', signupSchema), async (c) => {
  const data = c.req.valid('json');
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim();
  const userAgent = c.req.header('User-Agent');

  const result = await authService.signup(data, { ip, userAgent });

  // Set httpOnly cookie for API authentication
  setCookie(c, 'auth_token', result.token, COOKIE_OPTIONS);

  return c.json(
    {
      message: 'Account created successfully',
      user: result.user,
      token: result.token, // Still return token for WebSocket auth
      expiresAt: result.expiresAt.toISOString(),
    },
    201
  );
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
auth.post('/login', authRateLimiter, zValidator('json', loginSchema), async (c) => {
  const data = c.req.valid('json');
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim();
  const userAgent = c.req.header('User-Agent');

  const result = await authService.login(data, { ip, userAgent });

  // Set httpOnly cookie for API authentication
  setCookie(c, 'auth_token', result.token, COOKIE_OPTIONS);

  return c.json({
    message: 'Login successful',
    user: result.user,
    token: result.token, // Still return token for WebSocket auth
    expiresAt: result.expiresAt.toISOString(),
  });
});

/**
 * POST /api/auth/logout
 * Logout current session
 */
auth.post('/logout', requireAuth, async (c) => {
  const sessionId = c.get('sessionId');
  await authService.logout(sessionId);

  // Clear the auth cookie
  deleteCookie(c, 'auth_token', { path: '/' });

  return c.json({ message: 'Logged out successfully' });
});

/**
 * POST /api/auth/logout-all
 * Logout all sessions
 */
auth.post('/logout-all', requireAuth, async (c) => {
  const user = c.get('user');
  const count = await authService.logoutAll(user.id);

  // Clear the auth cookie
  deleteCookie(c, 'auth_token', { path: '/' });

  return c.json({
    message: `Logged out from ${count} sessions`,
    sessionsRevoked: count,
  });
});

/**
 * POST /api/auth/refresh
 * Refresh session token
 */
auth.post('/refresh', requireAuth, async (c) => {
  const user = c.get('user');
  const sessionId = c.get('sessionId');
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim();
  const userAgent = c.req.header('User-Agent');

  const result = await authService.refreshSession(sessionId, user.id, { ip, userAgent });

  return c.json({
    message: 'Session refreshed',
    token: result.token,
    expiresAt: result.expiresAt.toISOString(),
  });
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
auth.get('/me', requireAuth, async (c) => {
  const user = c.get('user');
  const sessionId = c.get('sessionId');
  const fullUser = await authService.getUserById(user.id);

  if (!fullUser) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Generate a fresh token for WebSocket authentication
  // This ensures the token is available after page refresh
  const { generateToken } = await import('../lib/jwt.js');
  const wsToken = await generateToken({
    userId: user.id,
    sessionId,
    email: fullUser.email,
    role: fullUser.role,
  });

  return c.json({ 
    user: fullUser,
    token: wsToken, // Return token for WebSocket auth
  });
});

/**
 * PATCH /api/auth/me
 * Update current user profile
 */
auth.patch('/me', requireAuth, zValidator('json', updateProfileSchema), async (c) => {
  const user = c.get('user');
  const data = c.req.valid('json');

  const updatedUser = await authService.updateProfile(user.id, data);

  return c.json({
    message: 'Profile updated',
    user: updatedUser,
  });
});

/**
 * POST /api/auth/change-password
 * Change password
 */
auth.post(
  '/change-password',
  requireAuth,
  authRateLimiter,
  zValidator('json', changePasswordSchema),
  async (c) => {
    const user = c.get('user');
    const { currentPassword, newPassword } = c.req.valid('json');

    await authService.changePassword(user.id, currentPassword, newPassword);

    return c.json({ message: 'Password changed successfully' });
  }
);

/**
 * GET /api/auth/sessions
 * Get all active sessions for current user
 */
auth.get('/sessions', requireAuth, async (c) => {
  const user = c.get('user');
  const currentSessionId = c.get('sessionId');
  const sessions = await authService.getUserSessions(user.id);

  // Mark current session
  const sessionsWithCurrent = sessions.map((session) => ({
    ...session,
    isCurrent: session.id === currentSessionId,
  }));

  return c.json({ sessions: sessionsWithCurrent });
});

/**
 * DELETE /api/auth/sessions/:id
 * Revoke a specific session
 */
auth.delete('/sessions/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const sessionId = c.req.param('id');
  const currentSessionId = c.get('sessionId');

  if (sessionId === currentSessionId) {
    return c.json({ error: 'Cannot revoke current session. Use logout instead.' }, 400);
  }

  await authService.revokeSession(sessionId, user.id);

  return c.json({ message: 'Session revoked successfully' });
});

export default auth;

