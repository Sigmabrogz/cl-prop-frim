import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tradingAccounts } from './trading-accounts';

// ===========================================
// POSITIONS TABLE (Open Trades)
// ===========================================
export const positions = pgTable(
  'positions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => tradingAccounts.id, { onDelete: 'cascade' }),

    // Symbol
    symbol: varchar('symbol', { length: 20 }).notNull(),

    // Direction
    side: varchar('side', { length: 10 }).notNull(), // 'LONG', 'SHORT'

    // Size
    quantity: numeric('quantity', { precision: 18, scale: 8 }).notNull(),
    leverage: integer('leverage').notNull(),

    // Entry
    entryPrice: numeric('entry_price', { precision: 18, scale: 8 }).notNull(),
    entryValue: numeric('entry_value', { precision: 18, scale: 8 }).notNull(),
    marginUsed: numeric('margin_used', { precision: 18, scale: 8 }).notNull(),

    // Fees
    entryFee: numeric('entry_fee', { precision: 18, scale: 8 }).notNull(),

    // Accumulated funding fees (positive = paid, negative = received)
    accumulatedFunding: numeric('accumulated_funding', { precision: 18, scale: 8 }).default('0').notNull(),
    lastFundingAt: timestamp('last_funding_at', { withTimezone: true }),

    // TP/SL
    takeProfit: numeric('take_profit', { precision: 18, scale: 8 }),
    stopLoss: numeric('stop_loss', { precision: 18, scale: 8 }),

    // Liquidation
    liquidationPrice: numeric('liquidation_price', { precision: 18, scale: 8 }).notNull(),

    // Current State (Updated in real-time)
    currentPrice: numeric('current_price', { precision: 18, scale: 8 }),
    unrealizedPnl: numeric('unrealized_pnl', { precision: 18, scale: 8 }).default('0').notNull(),
    lastPriceUpdate: timestamp('last_price_update', { withTimezone: true }),

    // Timestamps
    openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),

    // Price Proof
    binancePriceAtEntry: numeric('binance_price_at_entry', { precision: 18, scale: 8 }).notNull(),
    priceSource: varchar('price_source', { length: 50 }).default('binance').notNull(),
  },
  (table) => [
    index('idx_positions_account').on(table.accountId),
    index('idx_positions_symbol').on(table.symbol),
    index('idx_positions_side').on(table.side),
    check('valid_side', sql`${table.side} IN ('LONG', 'SHORT')`),
    check('valid_quantity', sql`${table.quantity}::numeric > 0`),
    check('valid_leverage', sql`${table.leverage} >= 1`),
  ]
);

export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;



