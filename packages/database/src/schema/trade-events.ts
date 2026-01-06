import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  bigserial,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ===========================================
// TRADE EVENTS TABLE (Immutable Audit Log)
// ===========================================
export const tradeEvents = pgTable(
  'trade_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),

    // References
    accountId: uuid('account_id').notNull(),
    positionId: uuid('position_id'),
    tradeId: uuid('trade_id'),
    orderId: uuid('order_id'),

    // Event
    eventType: varchar('event_type', { length: 50 }).notNull(),

    // Event Data
    symbol: varchar('symbol', { length: 20 }),
    side: varchar('side', { length: 10 }),
    quantity: numeric('quantity', { precision: 18, scale: 8 }),
    price: numeric('price', { precision: 18, scale: 8 }),

    // Additional Details
    details: jsonb('details').default({}).notNull(),

    // Price Proof
    binancePrice: numeric('binance_price', { precision: 18, scale: 8 }),
    priceTimestamp: timestamp('price_timestamp', { withTimezone: true }),

    // Integrity
    previousEventHash: varchar('previous_event_hash', { length: 64 }),
    eventHash: varchar('event_hash', { length: 64 }).notNull(),

    // Timestamp (with microsecond precision)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_events_account').on(table.accountId),
    index('idx_events_position').on(table.positionId),
    index('idx_events_type').on(table.eventType),
    index('idx_events_created').on(table.createdAt),
    check('no_future_events', sql`${table.createdAt} <= NOW()`),
    check(
      'valid_event_type',
      sql`${table.eventType} IN (
        'ORDER_PLACED', 'ORDER_VALIDATED', 'ORDER_REJECTED', 'ORDER_FILLED',
        'POSITION_OPENED', 'POSITION_MODIFIED', 'POSITION_CLOSED',
        'TP_SET', 'TP_MODIFIED', 'TP_TRIGGERED',
        'SL_SET', 'SL_MODIFIED', 'SL_TRIGGERED',
        'LIQUIDATION_WARNING', 'LIQUIDATION_TRIGGERED',
        'DAILY_LOSS_WARNING', 'DAILY_LOSS_BREACH',
        'DRAWDOWN_WARNING', 'DRAWDOWN_BREACH',
        'BALANCE_UPDATE', 'MARGIN_UPDATE'
      )`
    ),
  ]
);

export type TradeEvent = typeof tradeEvents.$inferSelect;
export type NewTradeEvent = typeof tradeEvents.$inferInsert;



