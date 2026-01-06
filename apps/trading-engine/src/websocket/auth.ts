// ===========================================
// JWT VERIFICATION FOR WEBSOCKET
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

