import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { tradingAccounts } from './trading-accounts';

// ===========================================
// PAYOUTS TABLE
// ===========================================
export const payouts = pgTable(
  'payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    accountId: uuid('account_id')
      .notNull()
      .references(() => tradingAccounts.id),

    // Amount
    requestedAmount: numeric('requested_amount', { precision: 18, scale: 8 }).notNull(),
    platformFee: numeric('platform_fee', { precision: 18, scale: 8 }).notNull(),
    netAmount: numeric('net_amount', { precision: 18, scale: 8 }).notNull(),

    // Destination
    payoutMethod: varchar('payout_method', { length: 50 }).notNull(),
    destinationAddress: varchar('destination_address', { length: 255 }).notNull(),
    destinationNetwork: varchar('destination_network', { length: 50 }),

    // Status
    status: varchar('status', { length: 20 }).default('pending').notNull(),

    // Processing
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),

    processedAt: timestamp('processed_at', { withTimezone: true }),
    txHash: varchar('tx_hash', { length: 255 }),

    // Rejection
    rejectedBy: uuid('rejected_by').references(() => users.id),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_payouts_user').on(table.userId),
    index('idx_payouts_status').on(table.status),
    index('idx_payouts_account').on(table.accountId),
    check(
      'valid_payout_method',
      sql`${table.payoutMethod} IN ('crypto_btc', 'crypto_usdt', 'crypto_eth', 'bank_wire')`
    ),
    check(
      'valid_payout_status',
      sql`${table.status} IN ('pending', 'approved', 'processing', 'completed', 'rejected')`
    ),
  ]
);

export type Payout = typeof payouts.$inferSelect;
export type NewPayout = typeof payouts.$inferInsert;



