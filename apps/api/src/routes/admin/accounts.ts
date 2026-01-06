// ===========================================
// ADMIN - ACCOUNTS ROUTES
// ===========================================

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@propfirm/database';
import { tradingAccounts, users, positions, tradeEvents } from '@propfirm/database/schema';
import { eq, desc, sql } from 'drizzle-orm';

const accountsAdmin = new Hono();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const listAccountsSchema = z.object({
  status: z
    .enum(['pending_payment', 'active', 'step1_passed', 'passed', 'breached', 'expired', 'suspended'])
    .optional(),
  accountType: z.enum(['evaluation', 'funded']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const breachAccountSchema = z.object({
  breachType: z.enum(['daily_loss', 'max_drawdown', 'rule_violation']),
  reason: z.string().min(1, 'Breach reason is required').max(500),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/admin/accounts
 * List all accounts
 */
accountsAdmin.get('/', zValidator('query', listAccountsSchema), async (c) => {
  const { status, accountType, limit, offset } = c.req.valid('query');

  // Build conditions
  const conditions = [];
  if (status) conditions.push(eq(tradingAccounts.status, status));
  if (accountType) conditions.push(eq(tradingAccounts.accountType, accountType));

  const whereClause = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

  const accountList = await db
    .select({
      id: tradingAccounts.id,
      accountNumber: tradingAccounts.accountNumber,
      accountType: tradingAccounts.accountType,
      status: tradingAccounts.status,
      currentStep: tradingAccounts.currentStep,
      startingBalance: tradingAccounts.startingBalance,
      currentBalance: tradingAccounts.currentBalance,
      dailyPnl: tradingAccounts.dailyPnl,
      currentProfit: tradingAccounts.currentProfit,
      totalTrades: tradingAccounts.totalTrades,
      tradingDays: tradingAccounts.tradingDays,
      createdAt: tradingAccounts.createdAt,
      breachType: tradingAccounts.breachType,
      breachedAt: tradingAccounts.breachedAt,
      user: {
        id: users.id,
        email: users.email,
        username: users.username,
      },
    })
    .from(tradingAccounts)
    .leftJoin(users, eq(tradingAccounts.userId, users.id))
    .where(whereClause)
    .orderBy(desc(tradingAccounts.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tradingAccounts)
    .where(whereClause);

  // Get status counts
  const statusCounts = await db
    .select({
      status: tradingAccounts.status,
      count: sql<number>`count(*)::int`,
    })
    .from(tradingAccounts)
    .groupBy(tradingAccounts.status);

  return c.json({
    accounts: accountList,
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s.count])),
    pagination: {
      total: count,
      limit,
      offset,
      hasMore: offset + accountList.length < count,
    },
  });
});

/**
 * GET /api/admin/accounts/:id
 * Get a single account with full details
 */
accountsAdmin.get('/:id', async (c) => {
  const accountId = c.req.param('id');

  const account = await db.query.tradingAccounts.findFirst({
    where: eq(tradingAccounts.id, accountId),
    with: {
      user: {
        columns: {
          id: true,
          email: true,
          username: true,
          fullName: true,
        },
      },
      plan: true,
      positions: true,
    },
  });

  if (!account) {
    return c.json({ error: 'Account not found' }, 404);
  }

  return c.json({ account });
});

/**
 * POST /api/admin/accounts/:id/breach
 * Manually breach an account
 */
accountsAdmin.post('/:id/breach', zValidator('json', breachAccountSchema), async (c) => {
  const accountId = c.req.param('id');
  const admin = c.get('user');
  const { breachType, reason } = c.req.valid('json');

  // Get current account
  const currentAccount = await db.query.tradingAccounts.findFirst({
    where: eq(tradingAccounts.id, accountId),
  });

  if (!currentAccount) {
    return c.json({ error: 'Account not found' }, 404);
  }

  if (currentAccount.status === 'breached') {
    return c.json({ error: 'Account is already breached' }, 400);
  }

  // Close all open positions first
  const openPositions = await db.query.positions.findMany({
    where: eq(positions.accountId, accountId),
  });

  if (openPositions.length > 0) {
    // In production, this would trigger position closes through the trading engine
    // For now, we'll just note that positions need to be closed
    return c.json({
      error: 'Account has open positions. Close them first or use the trading engine breach handler.',
      openPositions: openPositions.length,
    }, 400);
  }

  // Update account status
  const [account] = await db
    .update(tradingAccounts)
    .set({
      status: 'breached',
      breachType,
      breachReason: `[Admin: ${admin.username}] ${reason}`,
      breachedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tradingAccounts.id, accountId))
    .returning();

  // Log the event
  await db.insert(tradeEvents).values({
    accountId,
    eventType: 'ADMIN_BREACH',
    details: {
      breachType,
      reason,
      adminId: admin.id,
      adminUsername: admin.username,
    },
  });

  return c.json({
    message: 'Account breached',
    account,
  });
});

/**
 * POST /api/admin/accounts/:id/activate
 * Activate a pending_payment account (for manual payment confirmation)
 */
accountsAdmin.post('/:id/activate', async (c) => {
  const accountId = c.req.param('id');

  const currentAccount = await db.query.tradingAccounts.findFirst({
    where: eq(tradingAccounts.id, accountId),
  });

  if (!currentAccount) {
    return c.json({ error: 'Account not found' }, 404);
  }

  if (currentAccount.status !== 'pending_payment') {
    return c.json({ error: 'Account is not pending payment' }, 400);
  }

  const [account] = await db
    .update(tradingAccounts)
    .set({
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(tradingAccounts.id, accountId))
    .returning();

  return c.json({
    message: 'Account activated',
    account,
  });
});

/**
 * POST /api/admin/accounts/:id/suspend
 * Suspend an active account
 */
accountsAdmin.post('/:id/suspend', async (c) => {
  const accountId = c.req.param('id');

  const [account] = await db
    .update(tradingAccounts)
    .set({
      status: 'suspended',
      updatedAt: new Date(),
    })
    .where(eq(tradingAccounts.id, accountId))
    .returning();

  if (!account) {
    return c.json({ error: 'Account not found' }, 404);
  }

  return c.json({
    message: 'Account suspended',
    account,
  });
});

/**
 * POST /api/admin/accounts/:id/unsuspend
 * Unsuspend a suspended account
 */
accountsAdmin.post('/:id/unsuspend', async (c) => {
  const accountId = c.req.param('id');

  const currentAccount = await db.query.tradingAccounts.findFirst({
    where: eq(tradingAccounts.id, accountId),
  });

  if (!currentAccount) {
    return c.json({ error: 'Account not found' }, 404);
  }

  if (currentAccount.status !== 'suspended') {
    return c.json({ error: 'Account is not suspended' }, 400);
  }

  const [account] = await db
    .update(tradingAccounts)
    .set({
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(tradingAccounts.id, accountId))
    .returning();

  return c.json({
    message: 'Account unsuspended',
    account,
  });
});

export default accountsAdmin;

