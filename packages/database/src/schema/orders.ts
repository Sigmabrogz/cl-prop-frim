import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  index,
  check,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tradingAccounts } from './trading-accounts';
import { positions } from './positions';

// ===========================================
// ORDERS TABLE (Order Queue)
// ===========================================
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => tradingAccounts.id),

    // Order Details
    symbol: varchar('symbol', { length: 20 }).notNull(),
    side: varchar('side', { length: 10 }).notNull(), // 'LONG', 'SHORT'
    orderType: varchar('order_type', { length: 20 }).notNull(), // 'MARKET', 'LIMIT'

    // Size
    quantity: numeric('quantity', { precision: 18, scale: 8 }).notNull(),

    // Price (for limit orders)
    limitPrice: numeric('limit_price', { precision: 18, scale: 8 }),

    // TP/SL
    takeProfit: numeric('take_profit', { precision: 18, scale: 8 }),
    stopLoss: numeric('stop_loss', { precision: 18, scale: 8 }),

    // Status
    status: varchar('status', { length: 20 }).default('pending').notNull(),

    // Execution
    filledAt: timestamp('filled_at', { withTimezone: true }),
    filledPrice: numeric('filled_price', { precision: 18, scale: 8 }),
    positionId: uuid('position_id').references(() => positions.id),

    // Rejection
    rejectionReason: text('rejection_reason'),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // Client Reference (for idempotency)
    clientOrderId: varchar('client_order_id', { length: 100 }),
  },
  (table) => [
    index('idx_orders_account').on(table.accountId),
    index('idx_orders_status').on(table.status),
    index('idx_orders_client').on(table.clientOrderId),
    unique('unique_client_order').on(table.accountId, table.clientOrderId),
    check('valid_order_side', sql`${table.side} IN ('LONG', 'SHORT')`),
    check('valid_order_type', sql`${table.orderType} IN ('MARKET', 'LIMIT')`),
    check(
      'valid_order_status',
      sql`${table.status} IN ('pending', 'validating', 'executing', 'filled', 'rejected', 'cancelled', 'expired')`
    ),
  ]
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;



