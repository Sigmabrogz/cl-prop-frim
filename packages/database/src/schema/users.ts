import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  inet,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ===========================================
// USERS TABLE
// ===========================================
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Identity
    email: varchar('email', { length: 255 }).unique(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    phone: varchar('phone', { length: 20 }),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),

    // Auth
    passwordHash: varchar('password_hash', { length: 255 }),
    twoFaSecret: varchar('two_fa_secret', { length: 255 }),
    twoFaEnabled: boolean('two_fa_enabled').default(false).notNull(),

    // Profile
    username: varchar('username', { length: 50 }).unique().notNull(),
    fullName: varchar('full_name', { length: 255 }),
    countryCode: varchar('country_code', { length: 2 }),

    // KYC
    kycStatus: varchar('kyc_status', { length: 20 }).default('none').notNull(),
    kycSubmittedAt: timestamp('kyc_submitted_at', { withTimezone: true }),
    kycApprovedAt: timestamp('kyc_approved_at', { withTimezone: true }),
    kycDocuments: jsonb('kyc_documents').default({}).notNull(),

    // Status
    status: varchar('status', { length: 20 }).default('active').notNull(),
    role: varchar('role', { length: 20 }).default('user').notNull(),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastLoginIp: inet('last_login_ip'),
  },
  (table) => [
    index('idx_users_email').on(table.email),
    index('idx_users_status').on(table.status),
    index('idx_users_username').on(table.username),
    check(
      'valid_email',
      sql`${table.email} ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'`
    ),
    check(
      'valid_kyc_status',
      sql`${table.kycStatus} IN ('none', 'pending', 'approved', 'rejected')`
    ),
    check('valid_status', sql`${table.status} IN ('active', 'suspended', 'banned')`),
    check('valid_role', sql`${table.role} IN ('user', 'admin', 'support')`),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

