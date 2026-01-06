import {
  pgTable,
  uuid,
  date,
  integer,
  numeric,
  timestamp,
  bigserial,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { tradingAccounts } from './trading-accounts';

// ===========================================
// DAILY SNAPSHOTS TABLE (End of Day State)
// ===========================================
export const dailySnapshots = pgTable(
  'daily_snapshots',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => tradingAccounts.id),
    snapshotDate: date('snapshot_date').notNull(),

    // Balance State
    startingBalance: numeric('starting_balance', { precision: 18, scale: 8 }).notNull(),
    endingBalance: numeric('ending_balance', { precision: 18, scale: 8 }).notNull(),
    peakBalance: numeric('peak_balance', { precision: 18, scale: 8 }).notNull(),

    // P&L
    dailyPnl: numeric('daily_pnl', { precision: 18, scale: 8 }).notNull(),
    dailyPnlPct: numeric('daily_pnl_pct', { precision: 8, scale: 4 }).notNull(),

    // Risk
    maxDailyDrawdown: numeric('max_daily_drawdown', { precision: 18, scale: 8 }).notNull(),
    maxTotalDrawdown: numeric('max_total_drawdown', { precision: 18, scale: 8 }).notNull(),

    // Activity
    tradesCount: integer('trades_count').notNull(),
    winningTrades: integer('winning_trades').notNull(),
    losingTrades: integer('losing_trades').notNull(),
    volume: numeric('volume', { precision: 18, scale: 8 }).notNull(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_snapshots_account_date').on(table.accountId, table.snapshotDate),
    unique('unique_daily_snapshot').on(table.accountId, table.snapshotDate),
  ]
);

export type DailySnapshot = typeof dailySnapshots.$inferSelect;
export type NewDailySnapshot = typeof dailySnapshots.$inferInsert;



