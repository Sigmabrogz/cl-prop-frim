// ===========================================
// ACCOUNT SERVICE
// ===========================================

import { db } from '@propfirm/database';
import {
  tradingAccounts,
  evaluationPlans,
  positions,
  trades,
  type TradingAccount,
  type EvaluationPlan,
} from '@propfirm/database/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

// ===========================================
// TYPES
// ===========================================

export interface CreateAccountInput {
  userId: string;
  planId: number;
}

export interface AccountWithStats extends TradingAccount {
  plan: EvaluationPlan | null;
  openPositionsCount: number;
  unrealizedPnl: string;
}

// ===========================================
// ACCOUNT OPERATIONS
// ===========================================

/**
 * Get all accounts for a user
 */
export async function getUserAccounts(userId: string): Promise<TradingAccount[]> {
  const accounts = await db.query.tradingAccounts.findMany({
    where: eq(tradingAccounts.userId, userId),
    orderBy: [desc(tradingAccounts.createdAt)],
    with: {
      plan: true,
    },
  });

  return accounts;
}

/**
 * Get a single account by ID (with ownership check)
 */
export async function getAccountById(
  accountId: string,
  userId: string
): Promise<AccountWithStats> {
  const account = await db.query.tradingAccounts.findFirst({
    where: and(
      eq(tradingAccounts.id, accountId),
      eq(tradingAccounts.userId, userId)
    ),
    with: {
      plan: true,
    },
  });

  if (!account) {
    throw new AppError(404, 'Account not found');
  }

  // Get open positions count and unrealized P&L
  const positionStats = await db
    .select({
      count: sql<number>`count(*)::int`,
      unrealizedPnl: sql<string>`COALESCE(sum(${positions.unrealizedPnl}), 0)::text`,
    })
    .from(positions)
    .where(eq(positions.accountId, accountId));

  return {
    ...account,
    openPositionsCount: positionStats[0]?.count || 0,
    unrealizedPnl: positionStats[0]?.unrealizedPnl || '0',
  };
}

/**
 * Create a new evaluation account
 */
export async function createAccount(input: CreateAccountInput): Promise<TradingAccount> {
  const { userId, planId } = input;

  // Get the plan
  const plan = await db.query.evaluationPlans.findFirst({
    where: and(
      eq(evaluationPlans.id, planId),
      eq(evaluationPlans.isActive, true)
    ),
  });

  if (!plan) {
    throw new AppError(404, 'Evaluation plan not found or inactive');
  }

  // Generate unique account number
  const accountNumber = await generateAccountNumber();

  // Calculate risk limits from plan
  const accountSize = parseFloat(plan.accountSize);
  const dailyLossLimit = accountSize * (parseFloat(plan.dailyLossLimitPct) / 100);
  const maxDrawdownLimit = accountSize * (parseFloat(plan.maxDrawdownPct) / 100);
  const profitTarget = accountSize * (parseFloat(plan.step1ProfitTargetPct) / 100);

  // Calculate next daily reset (next UTC midnight)
  const now = new Date();
  const dailyResetAt = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));

  // Create account
  // TODO: Change status back to 'pending_payment' when payment gateway is integrated
  const [account] = await db
    .insert(tradingAccounts)
    .values({
      userId,
      planId,
      accountType: 'evaluation',
      accountNumber,
      currentStep: 1,
      startingBalance: plan.accountSize,
      currentBalance: plan.accountSize,
      peakBalance: plan.accountSize,
      availableMargin: plan.accountSize,
      dailyStartingBalance: plan.accountSize,
      dailyResetAt,
      dailyLossLimit: dailyLossLimit.toString(),
      maxDrawdownLimit: maxDrawdownLimit.toString(),
      profitTarget: profitTarget.toString(),
      status: 'active', // MOCK: Auto-activate for testing (change to 'pending_payment' when payment is ready)
    })
    .returning();

  return account;
}

/**
 * Activate account after payment
 */
export async function activateAccount(accountId: string): Promise<TradingAccount> {
  const [account] = await db
    .update(tradingAccounts)
    .set({
      status: 'active',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tradingAccounts.id, accountId),
        eq(tradingAccounts.status, 'pending_payment')
      )
    )
    .returning();

  if (!account) {
    throw new AppError(404, 'Account not found or already activated');
  }

  return account;
}

/**
 * Get account statistics (real-time)
 */
export async function getAccountStats(accountId: string, userId: string) {
  const account = await getAccountById(accountId, userId);

  // Calculate equity (balance + unrealized P&L)
  const currentBalance = parseFloat(account.currentBalance);
  const unrealizedPnl = parseFloat(account.unrealizedPnl);
  const equity = currentBalance + unrealizedPnl;

  // Calculate daily P&L
  const dailyStartingBalance = parseFloat(account.dailyStartingBalance);
  const dailyPnl = equity - dailyStartingBalance;
  const dailyPnlPercent = (dailyPnl / dailyStartingBalance) * 100;

  // Calculate drawdown
  const startingBalance = parseFloat(account.startingBalance);
  const drawdown = startingBalance - equity;
  const drawdownPercent = (drawdown / startingBalance) * 100;

  // Calculate daily loss usage
  const dailyLossLimit = parseFloat(account.dailyLossLimit);
  const dailyLossUsed = dailyPnl < 0 ? Math.abs(dailyPnl) : 0;
  const dailyLossPercent = (dailyLossUsed / dailyLossLimit) * 100;

  // Calculate max drawdown usage
  const maxDrawdownLimit = parseFloat(account.maxDrawdownLimit);
  const maxDrawdownUsed = drawdown > 0 ? drawdown : 0;
  const maxDrawdownPercent = (maxDrawdownUsed / maxDrawdownLimit) * 100;

  // Calculate profit progress
  const profitTarget = parseFloat(account.profitTarget);
  const currentProfit = equity - startingBalance;
  const profitProgress = (currentProfit / profitTarget) * 100;

  // Calculate win rate
  const totalTrades = account.totalTrades;
  const winRate = totalTrades > 0 ? (account.winningTrades / totalTrades) * 100 : 0;

  // Calculate margin usage
  const totalMarginUsed = parseFloat(account.totalMarginUsed);
  const marginUsedPercent = (totalMarginUsed / equity) * 100;

  return {
    accountId: account.id,
    accountNumber: account.accountNumber,
    status: account.status,

    // Balances
    startingBalance: account.startingBalance,
    currentBalance: account.currentBalance,
    equity: equity.toFixed(8),
    unrealizedPnl: account.unrealizedPnl,

    // Daily
    dailyStartingBalance: account.dailyStartingBalance,
    dailyPnl: dailyPnl.toFixed(8),
    dailyPnlPercent: dailyPnlPercent.toFixed(2),

    // Risk metrics
    dailyLossLimit: account.dailyLossLimit,
    dailyLossUsed: dailyLossUsed.toFixed(8),
    dailyLossPercent: Math.min(dailyLossPercent, 100).toFixed(2),

    maxDrawdownLimit: account.maxDrawdownLimit,
    maxDrawdownUsed: maxDrawdownUsed.toFixed(8),
    maxDrawdownPercent: Math.min(maxDrawdownPercent, 100).toFixed(2),

    // Profit target
    profitTarget: account.profitTarget,
    currentProfit: currentProfit.toFixed(8),
    profitProgress: Math.max(0, profitProgress).toFixed(2),

    // Margin
    totalMarginUsed: account.totalMarginUsed,
    availableMargin: account.availableMargin,
    marginUsedPercent: marginUsedPercent.toFixed(2),

    // Trading stats
    totalTrades: account.totalTrades,
    winningTrades: account.winningTrades,
    losingTrades: account.losingTrades,
    winRate: winRate.toFixed(2),
    tradingDays: account.tradingDays,

    // Positions
    openPositionsCount: account.openPositionsCount,

    // Timestamps
    createdAt: account.createdAt,
    lastTradeAt: account.lastTradeAt,
    dailyResetAt: account.dailyResetAt,
  };
}

/**
 * Get account trade history
 */
export async function getAccountTrades(
  accountId: string,
  userId: string,
  options: { limit?: number; offset?: number } = {}
) {
  const { limit = 50, offset = 0 } = options;

  // Verify ownership
  const account = await db.query.tradingAccounts.findFirst({
    where: and(
      eq(tradingAccounts.id, accountId),
      eq(tradingAccounts.userId, userId)
    ),
  });

  if (!account) {
    throw new AppError(404, 'Account not found');
  }

  // Get trades
  const tradeList = await db.query.trades.findMany({
    where: eq(trades.accountId, accountId),
    orderBy: [desc(trades.closedAt)],
    limit,
    offset,
  });

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trades)
    .where(eq(trades.accountId, accountId));

  return {
    trades: tradeList,
    pagination: {
      total: count,
      limit,
      offset,
      hasMore: offset + tradeList.length < count,
    },
  };
}

/**
 * Get account open positions
 */
export async function getAccountPositions(accountId: string, userId: string) {
  // Verify ownership
  const account = await db.query.tradingAccounts.findFirst({
    where: and(
      eq(tradingAccounts.id, accountId),
      eq(tradingAccounts.userId, userId)
    ),
  });

  if (!account) {
    throw new AppError(404, 'Account not found');
  }

  // Get positions
  const positionList = await db.query.positions.findMany({
    where: eq(positions.accountId, accountId),
    orderBy: [desc(positions.openedAt)],
  });

  return positionList;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

async function generateAccountNumber(): Promise<string> {
  // Format: EVAL-XXXXXX (6 digit number)
  const prefix = 'EVAL';

  // Get the last account number
  const lastAccount = await db.query.tradingAccounts.findFirst({
    orderBy: [desc(tradingAccounts.createdAt)],
    columns: { accountNumber: true },
  });

  let nextNumber = 1;
  if (lastAccount?.accountNumber) {
    const match = lastAccount.accountNumber.match(/\d+$/);
    if (match) {
      nextNumber = parseInt(match[0], 10) + 1;
    }
  }

  return `${prefix}-${nextNumber.toString().padStart(6, '0')}`;
}

