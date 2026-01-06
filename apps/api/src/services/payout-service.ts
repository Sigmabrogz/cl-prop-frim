// ===========================================
// PAYOUT SERVICE
// ===========================================

import { db } from '@propfirm/database';
import { payouts, tradingAccounts, type Payout, type NewPayout } from '@propfirm/database/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

// Minimum withdrawal amount
const MIN_WITHDRAWAL = 100;

// Platform fee percentage (0% for now)
const PLATFORM_FEE_PERCENT = 0;

export interface CreatePayoutInput {
  accountId: string;
  amount: number;
  payoutMethod: 'crypto_usdt' | 'crypto_btc' | 'crypto_eth' | 'bank_wire';
  destinationAddress: string;
  destinationNetwork?: string;
}

/**
 * Get all payouts for a user
 */
export async function getUserPayouts(userId: string) {
  const userPayouts = await db.query.payouts.findMany({
    where: eq(payouts.userId, userId),
    orderBy: [desc(payouts.createdAt)],
    with: {
      account: {
        columns: {
          accountNumber: true,
          planType: true,
        },
      },
    },
  });

  return userPayouts.map((payout) => ({
    id: payout.id,
    accountId: payout.accountId,
    accountNumber: payout.account?.accountNumber,
    requestedAmount: parseFloat(payout.requestedAmount),
    platformFee: parseFloat(payout.platformFee),
    netAmount: parseFloat(payout.netAmount),
    payoutMethod: payout.payoutMethod,
    destinationAddress: payout.destinationAddress,
    destinationNetwork: payout.destinationNetwork,
    status: payout.status,
    txHash: payout.txHash,
    rejectionReason: payout.rejectionReason,
    createdAt: payout.createdAt,
    approvedAt: payout.approvedAt,
    processedAt: payout.processedAt,
    rejectedAt: payout.rejectedAt,
  }));
}

/**
 * Get payout by ID
 */
export async function getPayoutById(payoutId: string, userId: string) {
  const payout = await db.query.payouts.findFirst({
    where: and(eq(payouts.id, payoutId), eq(payouts.userId, userId)),
    with: {
      account: {
        columns: {
          accountNumber: true,
          planType: true,
          currentBalance: true,
          startingBalance: true,
        },
      },
    },
  });

  if (!payout) {
    throw new AppError(404, 'Payout not found');
  }

  return {
    id: payout.id,
    accountId: payout.accountId,
    accountNumber: payout.account?.accountNumber,
    requestedAmount: parseFloat(payout.requestedAmount),
    platformFee: parseFloat(payout.platformFee),
    netAmount: parseFloat(payout.netAmount),
    payoutMethod: payout.payoutMethod,
    destinationAddress: payout.destinationAddress,
    destinationNetwork: payout.destinationNetwork,
    status: payout.status,
    txHash: payout.txHash,
    rejectionReason: payout.rejectionReason,
    createdAt: payout.createdAt,
    approvedAt: payout.approvedAt,
    processedAt: payout.processedAt,
    rejectedAt: payout.rejectedAt,
  };
}

/**
 * Calculate withdrawable amount for an account
 */
export async function getWithdrawableAmount(accountId: string, userId: string) {
  const account = await db.query.tradingAccounts.findFirst({
    where: and(
      eq(tradingAccounts.id, accountId),
      eq(tradingAccounts.userId, userId)
    ),
    with: {
      plan: {
        columns: {
          profitSplitPct: true,
        },
      },
    },
  });

  if (!account) {
    throw new AppError(404, 'Account not found');
  }

  // Get profit split from plan or use default 80%
  const profitSplit = account.plan?.profitSplitPct || 80;

  // Only funded accounts can withdraw
  if (account.status !== 'funded') {
    return {
      accountId: account.id,
      accountNumber: account.accountNumber,
      balance: parseFloat(account.currentBalance),
      startingBalance: parseFloat(account.startingBalance),
      profit: 0,
      profitSplit,
      withdrawable: 0,
      reason: 'Account must be funded to withdraw',
    };
  }

  const balance = parseFloat(account.currentBalance);
  const startingBalance = parseFloat(account.startingBalance);
  const profit = Math.max(0, balance - startingBalance);
  const withdrawable = profit * (profitSplit / 100);

  // Check for pending payouts
  const pendingPayouts = await db.query.payouts.findMany({
    where: and(
      eq(payouts.accountId, accountId),
      eq(payouts.status, 'pending')
    ),
  });

  const pendingAmount = pendingPayouts.reduce(
    (sum, p) => sum + parseFloat(p.requestedAmount),
    0
  );

  return {
    accountId: account.id,
    accountNumber: account.accountNumber,
    balance,
    startingBalance,
    profit,
    profitSplit,
    withdrawable: Math.max(0, withdrawable - pendingAmount),
    pendingAmount,
  };
}

/**
 * Get all funded accounts with withdrawable amounts
 */
export async function getFundedAccountsWithWithdrawable(userId: string) {
  const accounts = await db.query.tradingAccounts.findMany({
    where: and(
      eq(tradingAccounts.userId, userId),
      eq(tradingAccounts.status, 'funded')
    ),
  });

  const results = await Promise.all(
    accounts.map(async (account) => {
      const withdrawInfo = await getWithdrawableAmount(account.id, userId);
      return {
        ...withdrawInfo,
        planType: account.planType,
      };
    })
  );

  return results;
}

/**
 * Request a payout
 */
export async function createPayout(userId: string, input: CreatePayoutInput) {
  const { accountId, amount, payoutMethod, destinationAddress, destinationNetwork } = input;

  // Validate minimum amount
  if (amount < MIN_WITHDRAWAL) {
    throw new AppError(400, `Minimum withdrawal amount is $${MIN_WITHDRAWAL}`);
  }

  // Get withdrawable amount
  const withdrawInfo = await getWithdrawableAmount(accountId, userId);

  if (amount > withdrawInfo.withdrawable) {
    throw new AppError(
      400,
      `Requested amount ($${amount}) exceeds withdrawable amount ($${withdrawInfo.withdrawable.toFixed(2)})`
    );
  }

  // Calculate fees
  const platformFee = amount * (PLATFORM_FEE_PERCENT / 100);
  const netAmount = amount - platformFee;

  // Create payout request
  const [payout] = await db
    .insert(payouts)
    .values({
      userId,
      accountId,
      requestedAmount: amount.toString(),
      platformFee: platformFee.toString(),
      netAmount: netAmount.toString(),
      payoutMethod,
      destinationAddress,
      destinationNetwork,
      status: 'pending',
    })
    .returning();

  return {
    id: payout.id,
    accountId: payout.accountId,
    requestedAmount: parseFloat(payout.requestedAmount),
    platformFee: parseFloat(payout.platformFee),
    netAmount: parseFloat(payout.netAmount),
    payoutMethod: payout.payoutMethod,
    destinationAddress: payout.destinationAddress,
    status: payout.status,
    createdAt: payout.createdAt,
  };
}

/**
 * Cancel a pending payout
 */
export async function cancelPayout(payoutId: string, userId: string) {
  const payout = await db.query.payouts.findFirst({
    where: and(eq(payouts.id, payoutId), eq(payouts.userId, userId)),
  });

  if (!payout) {
    throw new AppError(404, 'Payout not found');
  }

  if (payout.status !== 'pending') {
    throw new AppError(400, 'Only pending payouts can be cancelled');
  }

  await db
    .update(payouts)
    .set({
      status: 'rejected',
      rejectionReason: 'Cancelled by user',
      rejectedAt: new Date(),
    })
    .where(eq(payouts.id, payoutId));

  return { message: 'Payout cancelled successfully' };
}

/**
 * Get payout statistics for a user
 */
export async function getPayoutStats(userId: string) {
  const allPayouts = await db.query.payouts.findMany({
    where: eq(payouts.userId, userId),
  });

  const completed = allPayouts.filter((p) => p.status === 'completed');
  const pending = allPayouts.filter((p) => p.status === 'pending');

  return {
    totalPaidOut: completed.reduce((sum, p) => sum + parseFloat(p.netAmount), 0),
    pendingAmount: pending.reduce((sum, p) => sum + parseFloat(p.requestedAmount), 0),
    totalRequests: allPayouts.length,
    completedRequests: completed.length,
    pendingRequests: pending.length,
  };
}

