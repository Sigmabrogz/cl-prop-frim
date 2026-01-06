// ===========================================
// ADMIN ROUTES - INDEX
// ===========================================

import { Hono } from 'hono';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import usersAdmin from './users.js';
import payoutsAdmin from './payouts.js';
import accountsAdmin from './accounts.js';

const admin = new Hono();

// All admin routes require authentication and admin role
admin.use('*', requireAuth);
admin.use('*', requireAdmin);

// Mount sub-routes
admin.route('/users', usersAdmin);
admin.route('/payouts', payoutsAdmin);
admin.route('/accounts', accountsAdmin);

// Admin dashboard stats
admin.get('/stats', async (c) => {
  const { db } = await import('@propfirm/database');
  const { users, tradingAccounts, payouts, trades } = await import('@propfirm/database/schema');
  const { sql, eq, gte, and } = await import('drizzle-orm');

  // Get date ranges as ISO strings for SQL
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // User stats
  const [userStats] = await db
    .select({
      totalUsers: sql<number>`count(*)::int`,
      activeUsers: sql<number>`count(*) filter (where ${users.status} = 'active')::int`,
      newUsersToday: sql<number>`count(*) filter (where ${users.createdAt} >= ${today}::timestamptz)::int`,
      newUsersThisMonth: sql<number>`count(*) filter (where ${users.createdAt} >= ${thisMonth}::timestamptz)::int`,
    })
    .from(users);

  // Account stats
  const [accountStats] = await db
    .select({
      totalAccounts: sql<number>`count(*)::int`,
      activeAccounts: sql<number>`count(*) filter (where ${tradingAccounts.status} = 'active')::int`,
      fundedAccounts: sql<number>`count(*) filter (where ${tradingAccounts.status} = 'funded')::int`,
      breachedAccounts: sql<number>`count(*) filter (where ${tradingAccounts.status} = 'breached')::int`,
      pendingPayment: sql<number>`count(*) filter (where ${tradingAccounts.status} = 'pending_payment')::int`,
    })
    .from(tradingAccounts);

  // Payout stats
  const [payoutStats] = await db
    .select({
      totalPayouts: sql<number>`count(*)::int`,
      pendingPayouts: sql<number>`count(*) filter (where ${payouts.status} = 'pending')::int`,
      completedPayouts: sql<number>`count(*) filter (where ${payouts.status} = 'completed')::int`,
      totalPaidOut: sql<number>`coalesce(sum(${payouts.netAmount}) filter (where ${payouts.status} = 'completed'), 0)::numeric`,
      pendingAmount: sql<number>`coalesce(sum(${payouts.netAmount}) filter (where ${payouts.status} = 'pending'), 0)::numeric`,
    })
    .from(payouts);

  // Trading stats
  const [tradingStats] = await db
    .select({
      totalTrades: sql<number>`count(*)::int`,
      tradesToday: sql<number>`count(*) filter (where ${trades.closedAt} >= ${today}::timestamptz)::int`,
      totalVolume: sql<number>`coalesce(sum(${trades.entryPrice}::numeric * ${trades.quantity}::numeric), 0)::numeric`,
      totalPnl: sql<number>`coalesce(sum(${trades.netPnl}), 0)::numeric`,
    })
    .from(trades);

  // Account status breakdown for chart
  const accountStatusBreakdown = await db
    .select({
      status: tradingAccounts.status,
      count: sql<number>`count(*)::int`,
    })
    .from(tradingAccounts)
    .groupBy(tradingAccounts.status);

  // Recent activity (last 7 days signups)
  const recentSignups = await db
    .select({
      date: sql<string>`to_char(${users.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(users)
    .where(sql`${users.createdAt} >= ${sevenDaysAgo}::timestamptz`)
    .groupBy(sql`to_char(${users.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${users.createdAt}, 'YYYY-MM-DD')`);

  return c.json({
    users: userStats,
    accounts: accountStats,
    payouts: {
      total: payoutStats.totalPayouts,
      pending: payoutStats.pendingPayouts,
      completed: payoutStats.completedPayouts,
      totalPaidOut: parseFloat(payoutStats.totalPaidOut as any) || 0,
      pendingAmount: parseFloat(payoutStats.pendingAmount as any) || 0,
    },
    trading: {
      totalTrades: tradingStats.totalTrades,
      tradesToday: tradingStats.tradesToday,
      totalVolume: parseFloat(tradingStats.totalVolume as any) || 0,
      totalPnl: parseFloat(tradingStats.totalPnl as any) || 0,
    },
    charts: {
      accountStatusBreakdown: Object.fromEntries(
        accountStatusBreakdown.map((s) => [s.status, s.count])
      ),
      recentSignups,
    },
  });
});

export default admin;

