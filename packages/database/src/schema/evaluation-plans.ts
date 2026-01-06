import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ===========================================
// EVALUATION PLANS TABLE
// ===========================================
export const evaluationPlans = pgTable(
  'evaluation_plans',
  {
    id: serial('id').primaryKey(),

    // Identity
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 50 }).unique().notNull(),
    description: text('description'),

    // Type
    evaluationType: varchar('evaluation_type', { length: 20 }).notNull(), // '1-STEP', '2-STEP'
    accountTier: varchar('account_tier', { length: 20 }).default('CLASSIC').notNull(), // 'CLASSIC', 'ELITE', 'PRO'

    // Financials (stored as string for precision)
    accountSize: numeric('account_size', { precision: 18, scale: 2 }).notNull(),
    evaluationFee: numeric('evaluation_fee', { precision: 18, scale: 2 }).notNull(),

    // Profit Targets (percentage)
    step1ProfitTargetPct: numeric('step1_profit_target_pct', { precision: 5, scale: 2 }).notNull(),
    step2ProfitTargetPct: numeric('step2_profit_target_pct', { precision: 5, scale: 2 }),

    // Risk Limits (percentage)
    dailyLossLimitPct: numeric('daily_loss_limit_pct', { precision: 5, scale: 2 })
      .default('5.00')
      .notNull(),
    maxDrawdownPct: numeric('max_drawdown_pct', { precision: 5, scale: 2 })
      .default('10.00')
      .notNull(),
    trailingDrawdown: boolean('trailing_drawdown').default(false).notNull(),

    // Trading Rules
    minTradingDays: integer('min_trading_days').default(5).notNull(),
    maxDailyTrades: integer('max_daily_trades'), // NULL = unlimited
    minTradeDurationSeconds: integer('min_trade_duration_seconds').default(120).notNull(),

    // Leverage
    btcEthMaxLeverage: integer('btc_eth_max_leverage').default(10).notNull(),
    altcoinMaxLeverage: integer('altcoin_max_leverage').default(5).notNull(),

    // Profit Split
    profitSplitPct: integer('profit_split_pct').default(80).notNull(),

    // Consistency Rules
    maxProfitFromSingleTradePct: numeric('max_profit_from_single_trade_pct', {
      precision: 5,
      scale: 2,
    }).default('50.00'),

    // Status
    isActive: boolean('is_active').default(true).notNull(),
    displayOrder: integer('display_order').default(0).notNull(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_plans_active').on(table.isActive),
    index('idx_plans_type').on(table.evaluationType),
    check(
      'valid_evaluation_type',
      sql`${table.evaluationType} IN ('1-STEP', '2-STEP')`
    ),
    check(
      'valid_account_tier',
      sql`${table.accountTier} IN ('CLASSIC', 'ELITE', 'PRO')`
    ),
    check('positive_account_size', sql`${table.accountSize} > 0`),
    check('positive_evaluation_fee', sql`${table.evaluationFee} > 0`),
    check('valid_profit_split', sql`${table.profitSplitPct} BETWEEN 0 AND 100`),
  ]
);

export type EvaluationPlan = typeof evaluationPlans.$inferSelect;
export type NewEvaluationPlan = typeof evaluationPlans.$inferInsert;

