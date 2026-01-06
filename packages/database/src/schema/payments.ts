import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { tradingAccounts } from './trading-accounts';

// ===========================================
// PAYMENTS TABLE
// ===========================================
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    accountId: uuid('account_id').references(() => tradingAccounts.id),

    // Payment Details
    paymentType: varchar('payment_type', { length: 20 }).notNull(),
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 10 }).default('USD').notNull(),

    // Provider
    provider: varchar('provider', { length: 50 }).notNull(),
    providerPaymentId: varchar('provider_payment_id', { length: 255 }),
    providerData: jsonb('provider_data').default({}).notNull(),

    // Status
    status: varchar('status', { length: 20 }).default('pending').notNull(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Refund
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    refundReason: text('refund_reason'),
  },
  (table) => [
    index('idx_payments_user').on(table.userId),
    index('idx_payments_status').on(table.status),
    index('idx_payments_provider').on(table.providerPaymentId),
    check(
      'valid_payment_type',
      sql`${table.paymentType} IN ('evaluation_fee', 'addon', 'reset')`
    ),
    check(
      'valid_payment_provider',
      sql`${table.provider} IN ('stripe', 'coinbase', 'crypto_manual')`
    ),
    check(
      'valid_payment_status',
      sql`${table.status} IN ('pending', 'processing', 'completed', 'failed', 'refunded')`
    ),
  ]
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;



