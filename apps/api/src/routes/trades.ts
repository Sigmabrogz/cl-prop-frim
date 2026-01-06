// ===========================================
// TRADES ROUTES
// ===========================================

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@propfirm/database';
import { trades, tradingAccounts } from '@propfirm/database/schema';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const tradesRouter = new Hono();

// All trade routes require authentication
tradesRouter.use('*', requireAuth);

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const listTradesSchema = z.object({
  accountId: z.string().uuid().optional(),
  symbol: z.string().optional(),
  side: z.enum(['LONG', 'SHORT']).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/trades
 * List all trades for the current user (across all accounts)
 */
tradesRouter.get('/', zValidator('query', listTradesSchema), async (c) => {
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
      trades: [],
      pagination: { total: 0, limit, offset, hasMore: false },
    });
  }

  // If specific account requested, verify ownership
  if (accountId) {
    if (!accountIds.includes(accountId)) {
      return c.json({ error: 'Account not found' }, 404);
    }
    conditions.push(eq(trades.accountId, accountId));
  } else {
    conditions.push(sql`${trades.accountId} = ANY(${accountIds})`);
  }

  // Additional filters
  if (symbol) {
    conditions.push(eq(trades.symbol, symbol.toUpperCase()));
  }
  if (side) {
    conditions.push(eq(trades.side, side));
  }
  if (fromDate) {
    conditions.push(gte(trades.closedAt, fromDate));
  }
  if (toDate) {
    conditions.push(lte(trades.closedAt, toDate));
  }

  // Get trades
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const tradeList = await db.query.trades.findMany({
    where: whereClause,
    orderBy: [desc(trades.closedAt)],
    limit,
    offset,
  });

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trades)
    .where(whereClause);

  return c.json({
    trades: tradeList,
    pagination: {
      total: count,
      limit,
      offset,
      hasMore: offset + tradeList.length < count,
    },
  });
});

/**
 * GET /api/trades/:id
 * Get a single trade by ID
 */
tradesRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const tradeId = c.req.param('id');

  const trade = await db.query.trades.findFirst({
    where: eq(trades.id, tradeId),
    with: {
      account: true,
    },
  });

  if (!trade) {
    return c.json({ error: 'Trade not found' }, 404);
  }

  // Verify ownership
  if (trade.account.userId !== user.id) {
    return c.json({ error: 'Trade not found' }, 404);
  }

  return c.json({ trade });
});

/**
 * GET /api/trades/export
 * Export trades as CSV
 */
tradesRouter.get('/export/csv', zValidator('query', listTradesSchema), async (c) => {
  const user = c.get('user');
  const { accountId, symbol, side, fromDate, toDate } = c.req.valid('query');

  // Build conditions (same as list)
  const conditions = [];

  const userAccounts = await db.query.tradingAccounts.findMany({
    where: eq(tradingAccounts.userId, user.id),
    columns: { id: true },
  });
  const accountIds = userAccounts.map((a) => a.id);

  if (accountIds.length === 0) {
    return c.text('No trades found', 200);
  }

  if (accountId) {
    if (!accountIds.includes(accountId)) {
      return c.json({ error: 'Account not found' }, 404);
    }
    conditions.push(eq(trades.accountId, accountId));
  } else {
    conditions.push(sql`${trades.accountId} = ANY(${accountIds})`);
  }

  if (symbol) conditions.push(eq(trades.symbol, symbol.toUpperCase()));
  if (side) conditions.push(eq(trades.side, side));
  if (fromDate) conditions.push(gte(trades.closedAt, fromDate));
  if (toDate) conditions.push(lte(trades.closedAt, toDate));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const tradeList = await db.query.trades.findMany({
    where: whereClause,
    orderBy: [desc(trades.closedAt)],
    limit: 10000, // Max export limit
  });

  // Generate CSV
  const headers = [
    'ID',
    'Account',
    'Symbol',
    'Side',
    'Quantity',
    'Leverage',
    'Entry Price',
    'Exit Price',
    'Gross P&L',
    'Fees',
    'Net P&L',
    'Close Reason',
    'Duration (s)',
    'Opened At',
    'Closed At',
  ];

  const rows = tradeList.map((t) => [
    t.id,
    t.accountId,
    t.symbol,
    t.side,
    t.quantity,
    t.leverage,
    t.entryPrice,
    t.exitPrice,
    t.grossPnl,
    t.totalFees,
    t.netPnl,
    t.closeReason,
    t.durationSeconds,
    t.openedAt.toISOString(),
    t.closedAt.toISOString(),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  c.header('Content-Type', 'text/csv');
  c.header('Content-Disposition', `attachment; filename="trades-${Date.now()}.csv"`);

  return c.text(csv);
});

/**
 * GET /api/trades/stats
 * Get trading statistics summary
 */
tradesRouter.get('/stats/summary', async (c) => {
  const user = c.get('user');

  // Get user's accounts
  const userAccounts = await db.query.tradingAccounts.findMany({
    where: eq(tradingAccounts.userId, user.id),
    columns: { id: true },
  });
  const accountIds = userAccounts.map((a) => a.id);

  if (accountIds.length === 0) {
    return c.json({
      stats: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnl: '0',
        avgWin: '0',
        avgLoss: '0',
        largestWin: '0',
        largestLoss: '0',
        profitFactor: 0,
      },
    });
  }

  // Calculate stats
  const stats = await db
    .select({
      totalTrades: sql<number>`count(*)::int`,
      winningTrades: sql<number>`count(*) FILTER (WHERE ${trades.netPnl}::numeric > 0)::int`,
      losingTrades: sql<number>`count(*) FILTER (WHERE ${trades.netPnl}::numeric < 0)::int`,
      totalPnl: sql<string>`COALESCE(sum(${trades.netPnl}::numeric), 0)::text`,
      totalWins: sql<string>`COALESCE(sum(${trades.netPnl}::numeric) FILTER (WHERE ${trades.netPnl}::numeric > 0), 0)::text`,
      totalLosses: sql<string>`COALESCE(abs(sum(${trades.netPnl}::numeric) FILTER (WHERE ${trades.netPnl}::numeric < 0)), 0)::text`,
      avgWin: sql<string>`COALESCE(avg(${trades.netPnl}::numeric) FILTER (WHERE ${trades.netPnl}::numeric > 0), 0)::text`,
      avgLoss: sql<string>`COALESCE(avg(${trades.netPnl}::numeric) FILTER (WHERE ${trades.netPnl}::numeric < 0), 0)::text`,
      largestWin: sql<string>`COALESCE(max(${trades.netPnl}::numeric), 0)::text`,
      largestLoss: sql<string>`COALESCE(min(${trades.netPnl}::numeric), 0)::text`,
    })
    .from(trades)
    .where(sql`${trades.accountId} = ANY(${accountIds})`);

  const s = stats[0];
  const winRate = s.totalTrades > 0 ? (s.winningTrades / s.totalTrades) * 100 : 0;
  const profitFactor =
    parseFloat(s.totalLosses) > 0
      ? parseFloat(s.totalWins) / parseFloat(s.totalLosses)
      : parseFloat(s.totalWins) > 0
        ? Infinity
        : 0;

  return c.json({
    stats: {
      totalTrades: s.totalTrades,
      winningTrades: s.winningTrades,
      losingTrades: s.losingTrades,
      winRate: winRate.toFixed(2),
      totalPnl: s.totalPnl,
      avgWin: s.avgWin,
      avgLoss: s.avgLoss,
      largestWin: s.largestWin,
      largestLoss: s.largestLoss,
      profitFactor: profitFactor === Infinity ? 'Infinity' : profitFactor.toFixed(2),
    },
  });
});

export default tradesRouter;

