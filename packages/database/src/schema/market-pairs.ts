import {
  pgTable,
  serial,
  varchar,
  boolean,
  integer,
  numeric,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ===========================================
// MARKET PAIRS TABLE (Tradeable Symbols)
// ===========================================
export const marketPairs = pgTable(
  'market_pairs',
  {
    id: serial('id').primaryKey(),
    symbol: varchar('symbol', { length: 20 }).unique().notNull(),
    baseCurrency: varchar('base_currency', { length: 10 }).notNull(),
    quoteCurrency: varchar('quote_currency', { length: 10 }).notNull(),

    // Display
    displayName: varchar('display_name', { length: 50 }).notNull(),

    // Trading Config
    isEnabled: boolean('is_enabled').default(true).notNull(),
    spreadBps: integer('spread_bps').default(5).notNull(), // 5 = 0.05%
    maxLeverage: integer('max_leverage').default(10).notNull(),
    minQuantity: numeric('min_quantity', { precision: 18, scale: 8 }).notNull(),
    maxQuantity: numeric('max_quantity', { precision: 18, scale: 8 }),
    quantityPrecision: integer('quantity_precision').default(8).notNull(),
    pricePrecision: integer('price_precision').default(2).notNull(),

    // Category
    category: varchar('category', { length: 20 }).default('major').notNull(),

    // Risk
    volatilityTier: varchar('volatility_tier', { length: 20 }).default('normal').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_pairs_symbol').on(table.symbol),
    index('idx_pairs_enabled').on(table.isEnabled),
    index('idx_pairs_category').on(table.category),
    check(
      'valid_category',
      sql`${table.category} IN ('major', 'altcoin', 'defi', 'meme')`
    ),
    check(
      'valid_volatility',
      sql`${table.volatilityTier} IN ('low', 'normal', 'high', 'extreme')`
    ),
    check('positive_spread', sql`${table.spreadBps} >= 0`),
    check('positive_leverage', sql`${table.maxLeverage} >= 1`),
  ]
);

export type MarketPair = typeof marketPairs.$inferSelect;
export type NewMarketPair = typeof marketPairs.$inferInsert;



