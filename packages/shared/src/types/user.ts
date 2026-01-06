// ===========================================
// USER TYPES
// ===========================================

export type UserStatus = 'active' | 'suspended' | 'banned';
export type UserRole = 'user' | 'admin' | 'support';
export type KycStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  email: string | null;
  emailVerifiedAt: Date | null;
  phone: string | null;
  phoneVerifiedAt: Date | null;
  username: string;
  fullName: string | null;
  countryCode: string | null;
  kycStatus: KycStatus;
  kycSubmittedAt: Date | null;
  kycApprovedAt: Date | null;
  status: UserStatus;
  role: UserRole;
  twoFaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  deviceFingerprint: string | null;
  createdAt: Date;
  expiresAt: Date;
  lastActiveAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
}

export interface AuthUser {
  id: string;
  email: string | null;
  username: string;
  role: UserRole;
  status: UserStatus;
  twoFaEnabled: boolean;
}



