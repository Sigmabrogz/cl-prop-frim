import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { evaluationPlans } from './evaluation-plans';

// ===========================================
// TRADING ACCOUNTS TABLE
// ===========================================
export const tradingAccounts = pgTable(
  'trading_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planId: integer('plan_id').references(() => evaluationPlans.id),

    // Type
    accountType: varchar('account_type', { length: 20 }).notNull(), // 'evaluation', 'funded'
    accountNumber: varchar('account_number', { length: 20 }).unique().notNull(),

    // For 2-step evaluations
    currentStep: integer('current_step').default(1).notNull(),
    parentAccountId: uuid('parent_account_id'), // Self-reference for funded->eval link

    // Balance State (DECIMAL for precision - 18,8 for crypto)
    startingBalance: numeric('starting_balance', { precision: 18, scale: 8 }).notNull(),
    currentBalance: numeric('current_balance', { precision: 18, scale: 8 }).notNull(),
    peakBalance: numeric('peak_balance', { precision: 18, scale: 8 }).notNull(),

    // Margin State
    totalMarginUsed: numeric('total_margin_used', { precision: 18, scale: 8 })
      .default('0')
      .notNull(),
    availableMargin: numeric('available_margin', { precision: 18, scale: 8 }).notNull(),

    // Daily Tracking
    dailyStartingBalance: numeric('daily_starting_balance', { precision: 18, scale: 8 }).notNull(),
    dailyPnl: numeric('daily_pnl', { precision: 18, scale: 8 }).default('0').notNull(),
    dailyResetAt: timestamp('daily_reset_at', { withTimezone: true }).notNull(),

    // Risk Limits (Cached from plan)
    dailyLossLimit: numeric('daily_loss_limit', { precision: 18, scale: 8 }).notNull(),
    maxDrawdownLimit: numeric('max_drawdown_limit', { precision: 18, scale: 8 }).notNull(),

    // Progress
    profitTarget: numeric('profit_target', { precision: 18, scale: 8 }).notNull(),
    currentProfit: numeric('current_profit', { precision: 18, scale: 8 }).default('0').notNull(),

    // Trading Stats
    totalTrades: integer('total_trades').default(0).notNull(),
    winningTrades: integer('winning_trades').default(0).notNull(),
    losingTrades: integer('losing_trades').default(0).notNull(),
    totalVolume: numeric('total_volume', { precision: 18, scale: 8 }).default('0').notNull(),
    tradingDays: integer('trading_days').default(0).notNull(),
    lastTradeAt: timestamp('last_trade_at', { withTimezone: true }),

    // Status
    status: varchar('status', { length: 30 }).default('pending_payment').notNull(),

    // Breach Info
    breachType: varchar('breach_type', { length: 50 }),
    breachReason: text('breach_reason'),
    breachedAt: timestamp('breached_at', { withTimezone: true }),

    // Pass Info
    step1PassedAt: timestamp('step1_passed_at', { withTimezone: true }),
    passedAt: timestamp('passed_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_accounts_user').on(table.userId),
    index('idx_accounts_status').on(table.status),
    index('idx_accounts_type').on(table.accountType),
    index('idx_accounts_number').on(table.accountNumber),
    check('valid_account_type', sql`${table.accountType} IN ('evaluation', 'funded')`),
    check(
      'valid_account_status',
      sql`${table.status} IN ('pending_payment', 'active', 'step1_passed', 'passed', 'breached', 'expired', 'suspended')`
    ),
    check('valid_balance', sql`${table.currentBalance}::numeric >= 0`),
    check('valid_margin', sql`${table.availableMargin}::numeric >= 0`),
  ]
);

export type TradingAccount = typeof tradingAccounts.$inferSelect;
export type NewTradingAccount = typeof tradingAccounts.$inferInsert;

