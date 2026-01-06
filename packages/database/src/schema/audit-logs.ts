import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

// ===========================================
// AUDIT LOGS TABLE
// ===========================================
// Persistent audit logging for security and compliance

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Who
    userId: uuid('user_id'),
    accountId: uuid('account_id'),

    // What
    action: text('action').notNull(),
    details: jsonb('details'),

    // Context
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),

    // Result
    success: boolean('success').default(true).notNull(),
    errorMessage: text('error_message'),

    // When
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_audit_logs_user_id').on(table.userId),
    index('idx_audit_logs_account_id').on(table.accountId),
    index('idx_audit_logs_action').on(table.action),
    index('idx_audit_logs_created_at').on(table.createdAt),
    // Composite index for common queries
    index('idx_audit_logs_user_action').on(table.userId, table.action),
  ]
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

