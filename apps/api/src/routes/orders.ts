// ===========================================
// ORDERS ROUTES
// ===========================================

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@propfirm/database';
import { orders, tradingAccounts } from '@propfirm/database/schema';
import { eq, and, desc, sql, gte, lte, or, inArray } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const ordersRouter = new Hono();

// All order routes require authentication
ordersRouter.use('*', requireAuth);

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const listOrdersSchema = z.object({
  accountId: z.string().uuid().optional(),
  symbol: z.string().optional(),
  side: z.enum(['LONG', 'SHORT']).optional(),
  status: z.enum(['pending', 'validating', 'executing', 'filled', 'rejected', 'cancelled', 'expired']).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/orders
 * List all orders for the current user (across all accounts)
 */
ordersRouter.get('/', zValidator('query', listOrdersSchema), async (c) => {
  const user = c.get('user');
  const { accountId, symbol, side, status, fromDate, toDate, limit, offset } = c.req.valid('query');

  // Build conditions
  const conditions = [];

  // Filter by user's accounts
  const userAccounts = await db.query.tradingAccounts.findMany({
    where: eq(tradingAccounts.userId, user.id),
    columns: { id: true },
  });
  const accountIds = userAccounts.map((a) => a.id);

  if (accountIds.length === 0) {
    return c.json({
      orders: [],
      pagination: { total: 0, limit, offset, hasMore: false },
    });
  }

  // If specific account requested, verify ownership
  if (accountId) {
    if (!accountIds.includes(accountId)) {
      return c.json({ error: 'Account not found' }, 404);
    }
    conditions.push(eq(orders.accountId, accountId));
  } else {
    conditions.push(inArray(orders.accountId, accountIds));
  }

  // Additional filters
  if (symbol) {
    conditions.push(eq(orders.symbol, symbol.toUpperCase()));
  }
  if (side) {
    conditions.push(eq(orders.side, side));
  }
  if (status) {
    conditions.push(eq(orders.status, status));
  }
  if (fromDate) {
    conditions.push(gte(orders.createdAt, fromDate));
  }
  if (toDate) {
    conditions.push(lte(orders.createdAt, toDate));
  }

  // Get orders
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const orderList = await db.query.orders.findMany({
    where: whereClause,
    orderBy: [desc(orders.createdAt)],
    limit,
    offset,
  });

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(whereClause);

  return c.json({
    orders: orderList,
    pagination: {
      total: count,
      limit,
      offset,
      hasMore: offset + orderList.length < count,
    },
  });
});

/**
 * GET /api/orders/history
 * Get order history (filled, cancelled, expired, rejected orders)
 */
ordersRouter.get('/history', zValidator('query', listOrdersSchema), async (c) => {
  const user = c.get('user');
  const { accountId, symbol, side, fromDate, toDate, limit, offset } = c.req.valid('query');

  // Build conditions
  const conditions = [];

  // Filter by user's accounts
  const userAccounts = await db.query.tradingAccounts.findMany({
    where: eq(tradingAccounts.userId, user.id),
    columns: { id: true },
  });
  const accountIds = userAccounts.map((a) => a.id);

  if (accountIds.length === 0) {
    return c.json({
      orders: [],
      pagination: { total: 0, limit, offset, hasMore: false },
    });
  }

  // If specific account requested, verify ownership
  if (accountId) {
    if (!accountIds.includes(accountId)) {
      return c.json({ error: 'Account not found' }, 404);
    }
    conditions.push(eq(orders.accountId, accountId));
  } else {
    conditions.push(inArray(orders.accountId, accountIds));
  }

  // Only show completed orders (not pending)
  conditions.push(
    or(
      eq(orders.status, 'filled'),
      eq(orders.status, 'cancelled'),
      eq(orders.status, 'expired'),
      eq(orders.status, 'rejected')
    )!
  );

  // Additional filters
  if (symbol) {
    conditions.push(eq(orders.symbol, symbol.toUpperCase()));
  }
  if (side) {
    conditions.push(eq(orders.side, side));
  }
  if (fromDate) {
    conditions.push(gte(orders.createdAt, fromDate));
  }
  if (toDate) {
    conditions.push(lte(orders.createdAt, toDate));
  }

  // Get orders
  const whereClause = and(...conditions);

  const orderList = await db.query.orders.findMany({
    where: whereClause,
    orderBy: [desc(orders.createdAt)],
    limit,
    offset,
  });

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(whereClause);

  return c.json({
    orders: orderList,
    pagination: {
      total: count,
      limit,
      offset,
      hasMore: offset + orderList.length < count,
    },
  });
});

/**
 * GET /api/orders/:id
 * Get a single order by ID
 */
ordersRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const orderId = c.req.param('id');

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      account: true,
    },
  });

  if (!order) {
    return c.json({ error: 'Order not found' }, 404);
  }

  // Verify ownership - return 403 to prevent info disclosure about which IDs exist
  if (order.account.userId !== user.id) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json({ order });
});

export default ordersRouter;
