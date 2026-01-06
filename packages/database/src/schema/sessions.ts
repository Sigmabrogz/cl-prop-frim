import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  inet,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// ===========================================
// SESSIONS TABLE
// ===========================================
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Token
    tokenHash: varchar('token_hash', { length: 255 }).unique().notNull(),

    // Device info
    userAgent: text('user_agent'),
    ipAddress: inet('ip_address'),
    deviceFingerprint: varchar('device_fingerprint', { length: 255 }),

    // Validity
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),

    // Revocation
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokeReason: varchar('revoke_reason', { length: 100 }),
  },
  (table) => [
    index('idx_sessions_user').on(table.userId),
    index('idx_sessions_token').on(table.tokenHash),
    index('idx_sessions_expires').on(table.expiresAt),
  ]
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

