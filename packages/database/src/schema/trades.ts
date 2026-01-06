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
// TRADES TABLE (Closed Positions - Immutable)
// ===========================================
export const trades = pgTable(
  'trades',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => tradingAccounts.id),
    positionId: uuid('position_id'), // Links to original position

    // Symbol
    symbol: varchar('symbol', { length: 20 }).notNull(),
    side: varchar('side', { length: 10 }).notNull(),

    // Size
    quantity: numeric('quantity', { precision: 18, scale: 8 }).notNull(),
    leverage: integer('leverage').notNull(),

    // Entry
    entryPrice: numeric('entry_price', { precision: 18, scale: 8 }).notNull(),
    entryValue: numeric('entry_value', { precision: 18, scale: 8 }).notNull(),
    marginUsed: numeric('margin_used', { precision: 18, scale: 8 }).notNull(),
    entryFee: numeric('entry_fee', { precision: 18, scale: 8 }).notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),

    // Exit
    exitPrice: numeric('exit_price', { precision: 18, scale: 8 }).notNull(),
    exitValue: numeric('exit_value', { precision: 18, scale: 8 }).notNull(),
    exitFee: numeric('exit_fee', { precision: 18, scale: 8 }).notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }).notNull(),

    // Close Reason
    closeReason: varchar('close_reason', { length: 50 }).notNull(),

    // P&L
    grossPnl: numeric('gross_pnl', { precision: 18, scale: 8 }).notNull(),
    totalFees: numeric('total_fees', { precision: 18, scale: 8 }).notNull(),
    netPnl: numeric('net_pnl', { precision: 18, scale: 8 }).notNull(),

    // Duration
    durationSeconds: integer('duration_seconds').notNull(),

    // Price Proof
    binancePriceAtEntry: numeric('binance_price_at_entry', { precision: 18, scale: 8 }).notNull(),
    binancePriceAtExit: numeric('binance_price_at_exit', { precision: 18, scale: 8 }).notNull(),

    // TP/SL at close
    takeProfitWas: numeric('take_profit_was', { precision: 18, scale: 8 }),
    stopLossWas: numeric('stop_loss_was', { precision: 18, scale: 8 }),

    // Immutable timestamp
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_trades_account').on(table.accountId),
    index('idx_trades_closed_at').on(table.closedAt),
    index('idx_trades_symbol').on(table.symbol),
    index('idx_trades_position').on(table.positionId),
    check('valid_trade_side', sql`${table.side} IN ('LONG', 'SHORT')`),
    check(
      'valid_close_reason',
      sql`${table.closeReason} IN ('MANUAL', 'TAKE_PROFIT', 'STOP_LOSS', 'LIQUIDATION', 'BREACH')`
    ),
  ]
);

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;



