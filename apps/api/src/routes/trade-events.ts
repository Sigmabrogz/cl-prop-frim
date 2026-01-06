// ===========================================
// TRADE EVENTS ROUTES
// ===========================================

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@propfirm/database';
import { tradeEvents, tradingAccounts } from '@propfirm/database/schema';
import { eq, and, desc, sql, gte, lte, inArray } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const tradeEventsRouter = new Hono();

// All routes require authentication
tradeEventsRouter.use('*', requireAuth);

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const eventTypes = [
  'ORDER_PLACED',
  'ORDER_VALIDATED',
  'ORDER_REJECTED',
  'ORDER_FILLED',
  'POSITION_OPENED',
  'POSITION_MODIFIED',
  'POSITION_CLOSED',
  'TP_SET',
  'TP_MODIFIED',
  'TP_TRIGGERED',
  'SL_SET',
  'SL_MODIFIED',
  'SL_TRIGGERED',
  'LIQUIDATION_WARNING',
  'LIQUIDATION_TRIGGERED',
] as const;

const listEventsSchema = z.object({
  accountId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  symbol: z.string().optional(),
  side: z.enum(['LONG', 'SHORT']).optional(),
  eventType: z.enum(eventTypes).optional(),
  eventTypes: z.string().optional(), // comma-separated list
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/trade-events
 * List trade events for the current user's accounts
 */
tradeEventsRouter.get('/', zValidator('query', listEventsSchema), async (c) => {
  const user = c.get('user');
  const {
    accountId,
    positionId,
    symbol,
    side,
    eventType,
    eventTypes: eventTypesStr,
    fromDate,
    toDate,
    limit,
    offset,
  } = c.req.valid('query');

  // Get user's accounts
  const userAccounts = await db.query.tradingAccounts.findMany({
    where: eq(tradingAccounts.userId, user.id),
    columns: { id: true },
  });
  const accountIds = userAccounts.map((a) => a.id);

  if (accountIds.length === 0) {
    return c.json({
      events: [],
      pagination: { total: 0, limit, offset, hasMore: false },
    });
  }

  // Build conditions
  const conditions = [];

  // Filter by user's accounts
  if (accountId) {
    if (!accountIds.includes(accountId)) {
      return c.json({ error: 'Account not found' }, 404);
    }
    conditions.push(eq(tradeEvents.accountId, accountId));
  } else {
    conditions.push(sql`${tradeEvents.accountId} = ANY(${accountIds})`);
  }

  // Filter by position
  if (positionId) {
    conditions.push(eq(tradeEvents.positionId, positionId));
  }

  // Filter by symbol
  if (symbol) {
    conditions.push(eq(tradeEvents.symbol, symbol.toUpperCase()));
  }

  // Filter by side
  if (side) {
    conditions.push(eq(tradeEvents.side, side));
  }

  // Filter by event type(s)
  if (eventType) {
    conditions.push(eq(tradeEvents.eventType, eventType));
  } else if (eventTypesStr) {
    const types = eventTypesStr.split(',').filter((t) => eventTypes.includes(t as typeof eventTypes[number]));
    if (types.length > 0) {
      conditions.push(inArray(tradeEvents.eventType, types));
    }
  }

  // Date range
  if (fromDate) {
    conditions.push(gte(tradeEvents.createdAt, fromDate));
  }
  if (toDate) {
    conditions.push(lte(tradeEvents.createdAt, toDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get events
  const events = await db.query.tradeEvents.findMany({
    where: whereClause,
    orderBy: [desc(tradeEvents.createdAt)],
    limit,
    offset,
  });

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tradeEvents)
    .where(whereClause);

  return c.json({
    events,
    pagination: {
      total: count,
      limit,
      offset,
      hasMore: offset + events.length < count,
    },
  });
});

/**
 * GET /api/trade-events/position/:positionId
 * Get all events for a specific position
 */
tradeEventsRouter.get('/position/:positionId', async (c) => {
  const user = c.get('user');
  const positionId = c.req.param('positionId');

  // Verify the position belongs to user
  const userAccounts = await db.query.tradingAccounts.findMany({
    where: eq(tradingAccounts.userId, user.id),
    columns: { id: true },
  });
  const accountIds = userAccounts.map((a) => a.id);

  if (accountIds.length === 0) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const events = await db.query.tradeEvents.findMany({
    where: and(
      eq(tradeEvents.positionId, positionId),
      sql`${tradeEvents.accountId} = ANY(${accountIds})`
    ),
    orderBy: [desc(tradeEvents.createdAt)],
  });

  if (events.length === 0) {
    return c.json({ error: 'Position not found or access denied' }, 404);
  }

  return c.json({ events });
});

/**
 * GET /api/trade-events/types
 * Get available event types
 */
tradeEventsRouter.get('/types', (c) => {
  const typeLabels: Record<string, string> = {
    ORDER_PLACED: 'Order Placed',
    ORDER_VALIDATED: 'Order Validated',
    ORDER_REJECTED: 'Order Rejected',
    ORDER_FILLED: 'Order Filled',
    POSITION_OPENED: 'Position Opened',
    POSITION_MODIFIED: 'Position Modified',
    POSITION_CLOSED: 'Position Closed',
    TP_SET: 'Take Profit Attached',
    TP_MODIFIED: 'Take Profit Modified',
    TP_TRIGGERED: 'Position Closed By Take Profit',
    SL_SET: 'Stop Loss Attached',
    SL_MODIFIED: 'Stop Loss Modified',
    SL_TRIGGERED: 'Position Closed By Stop Loss',
    LIQUIDATION_WARNING: 'Liquidation Warning',
    LIQUIDATION_TRIGGERED: 'Position Liquidated',
  };

  return c.json({
    types: eventTypes.map((type) => ({
      value: type,
      label: typeLabels[type] || type,
    })),
  });
});

export default tradeEventsRouter;
