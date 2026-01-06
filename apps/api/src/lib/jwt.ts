// ===========================================
// JWT UTILITIES
// ===========================================

import * as jose from 'jose';

// SECURITY: JWT_SECRET is required - no fallback allowed
const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW) {
  throw new Error('FATAL: JWT_SECRET environment variable is required');
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);

const JWT_ISSUER = 'propfirm-api';
const JWT_AUDIENCE = 'propfirm-client';

export interface TokenPayload {
  userId: string;
  sessionId: string;
  email: string;
  role: string;
}

/**
 * Generate a JWT token
 */
export async function generateToken(
  payload: TokenPayload,
  expiresIn: string = '7d'
): Promise<string> {
  const token = await new jose.SignJWT({
    userId: payload.userId,
    sessionId: payload.sessionId,
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  return {
    userId: payload.userId as string,
    sessionId: payload.sessionId as string,
    email: payload.email as string,
    role: payload.role as string,
  };
}

/**
 * Decode a JWT token without verification (for debugging)
 */
export function decodeToken(token: string): jose.JWTPayload | null {
  try {
    return jose.decodeJwt(token);
  } catch {
    return null;
  }
}

/**
 * Generate a secure random token (for password reset, etc.)
 */
export function generateSecureToken(length: number = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a token for storage (e.g., session tokens)
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

