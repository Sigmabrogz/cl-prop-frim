import {
  pgTable,
  varchar,
  numeric,
  timestamp,
  bigserial,
  index,
} from 'drizzle-orm/pg-core';

// ===========================================
// PRICE SNAPSHOTS TABLE (For Disputes & Audits)
// Note: In production, this should be partitioned by date
// ===========================================
export const priceSnapshots = pgTable(
  'price_snapshots',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    symbol: varchar('symbol', { length: 20 }).notNull(),

    // Prices
    bidPrice: numeric('bid_price', { precision: 18, scale: 8 }).notNull(),
    askPrice: numeric('ask_price', { precision: 18, scale: 8 }).notNull(),
    midPrice: numeric('mid_price', { precision: 18, scale: 8 }).notNull(),

    // Volume
    volume24h: numeric('volume_24h', { precision: 18, scale: 8 }),

    // Source
    source: varchar('source', { length: 50 }).default('binance').notNull(),

    // Timestamp (millisecond precision)
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),

    // Created at
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_prices_symbol_time').on(table.symbol, table.timestamp),
    index('idx_prices_created').on(table.createdAt),
  ]
);

export type PriceSnapshot = typeof priceSnapshots.$inferSelect;
export type NewPriceSnapshot = typeof priceSnapshots.$inferInsert;



