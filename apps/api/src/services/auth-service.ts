// ===========================================
// AUTH SERVICE
// ===========================================

import { db } from '@propfirm/database';
import { users, sessions, type User, type NewUser } from '@propfirm/database/schema';
import { eq, and, gt } from 'drizzle-orm';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../lib/password.js';
import { generateToken, hashToken, generateSecureToken } from '../lib/jwt.js';
import { AppError } from '../middleware/error-handler.js';

// Session duration in milliseconds (7 days)
const SESSION_DURATION = parseInt(process.env.SESSION_DURATION || '604800', 10) * 1000;

export interface SignupInput {
  email: string;
  username: string;
  password: string;
  fullName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: Omit<User, 'passwordHash' | 'twoFaSecret'>;
  token: string;
  expiresAt: Date;
}

/**
 * Register a new user
 */
export async function signup(
  input: SignupInput,
  meta: { ip?: string; userAgent?: string }
): Promise<AuthResult> {
  const { email, username, password, fullName } = input;

  // Validate password strength
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    throw new AppError(400, passwordError);
  }

  // Check if email already exists
  const existingEmail = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
  if (existingEmail) {
    throw new AppError(409, 'Email already registered');
  }

  // Check if username already exists
  const existingUsername = await db.query.users.findFirst({
    where: eq(users.username, username.toLowerCase()),
  });
  if (existingUsername) {
    throw new AppError(409, 'Username already taken');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      passwordHash,
      fullName,
      lastLoginAt: new Date(),
      lastLoginIp: meta.ip,
    })
    .returning();

  // Create session
  const { token, expiresAt } = await createSession(user.id, meta);

  // Return user without sensitive fields
  const { passwordHash: _, twoFaSecret: __, ...safeUser } = user;

  return {
    user: safeUser,
    token,
    expiresAt,
  };
}

/**
 * Login an existing user
 */
export async function login(
  input: LoginInput,
  meta: { ip?: string; userAgent?: string }
): Promise<AuthResult> {
  const { email, password } = input;

  // Find user by email
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (!user || !user.passwordHash) {
    throw new AppError(401, 'Invalid email or password');
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new AppError(401, 'Invalid email or password');
  }

  // Check if user is active
  if (user.status !== 'active') {
    throw new AppError(403, `Account ${user.status}`);
  }

  // Update last login
  await db
    .update(users)
    .set({
      lastLoginAt: new Date(),
      lastLoginIp: meta.ip,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Create session
  const { token, expiresAt } = await createSession(user.id, meta);

  // Return user without sensitive fields
  const { passwordHash: _, twoFaSecret: __, ...safeUser } = user;

  return {
    user: safeUser,
    token,
    expiresAt,
  };
}

/**
 * Logout - revoke session
 */
export async function logout(sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({
      revokedAt: new Date(),
      revokeReason: 'logout',
    })
    .where(eq(sessions.id, sessionId));
}

/**
 * Logout all sessions for a user
 */
export async function logoutAll(userId: string, exceptSessionId?: string): Promise<number> {
  const result = await db
    .update(sessions)
    .set({
      revokedAt: new Date(),
      revokeReason: 'logout_all',
    })
    .where(
      and(
        eq(sessions.userId, userId),
        gt(sessions.expiresAt, new Date())
      )
    )
    .returning();

  return result.length;
}

/**
 * Refresh session - extend expiration
 */
export async function refreshSession(
  sessionId: string,
  userId: string,
  meta: { ip?: string; userAgent?: string }
): Promise<{ token: string; expiresAt: Date }> {
  // Revoke old session
  await db
    .update(sessions)
    .set({
      revokedAt: new Date(),
      revokeReason: 'refreshed',
    })
    .where(eq(sessions.id, sessionId));

  // Create new session
  return createSession(userId, meta);
}

/**
 * Get user by ID
 */
export async function getUserById(
  userId: string
): Promise<Omit<User, 'passwordHash' | 'twoFaSecret'> | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) return null;

  const { passwordHash: _, twoFaSecret: __, ...safeUser } = user;
  return safeUser;
}

/**
 * Update user profile
 */
export async function updateProfile(
  userId: string,
  data: { fullName?: string; countryCode?: string }
): Promise<Omit<User, 'passwordHash' | 'twoFaSecret'>> {
  const [user] = await db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  const { passwordHash: _, twoFaSecret: __, ...safeUser } = user;
  return safeUser;
}

/**
 * Change password
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user || !user.passwordHash) {
    throw new AppError(404, 'User not found');
  }

  // Verify current password
  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new AppError(401, 'Current password is incorrect');
  }

  // Validate new password strength
  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    throw new AppError(400, passwordError);
  }

  // Hash and update password
  const passwordHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Get user sessions
 */
export async function getUserSessions(userId: string) {
  const userSessions = await db.query.sessions.findMany({
    where: and(
      eq(sessions.userId, userId),
      gt(sessions.expiresAt, new Date())
    ),
    orderBy: (sessions, { desc }) => [desc(sessions.lastActiveAt)],
  });

  return userSessions.map((session) => ({
    id: session.id,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    lastActiveAt: session.lastActiveAt,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  }));
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string, userId: string): Promise<void> {
  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.id, sessionId), eq(sessions.userId, userId)),
  });

  if (!session) {
    throw new AppError(404, 'Session not found');
  }

  await db
    .update(sessions)
    .set({
      revokedAt: new Date(),
      revokeReason: 'user_revoked',
    })
    .where(eq(sessions.id, sessionId));
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

async function createSession(
  userId: string,
  meta: { ip?: string; userAgent?: string }
): Promise<{ token: string; expiresAt: Date; sessionId: string }> {
  const sessionToken = generateSecureToken(32);
  const tokenHash = await hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash,
      userAgent: meta.userAgent,
      ipAddress: meta.ip,
      expiresAt,
    })
    .returning();

  // Get user for token payload
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new AppError(500, 'User not found after session creation');
  }

  // Generate JWT
  const token = await generateToken({
    userId,
    sessionId: session.id,
    email: user.email || '',
    role: user.role,
  });

  return { token, expiresAt, sessionId: session.id };
}

