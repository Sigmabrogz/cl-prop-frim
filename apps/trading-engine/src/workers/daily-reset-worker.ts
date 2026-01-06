// ===========================================
// DAILY RESET WORKER
// ===========================================

import { db } from '@propfirm/database';
import { tradingAccounts, dailySnapshots, tradeEvents } from '@propfirm/database/schema';
import { eq, and, lt, inArray } from 'drizzle-orm';

// ===========================================
// DAILY RESET WORKER CLASS
// ===========================================

export class DailyResetWorker {
  private isRunning = false;
  private checkInterval = 60000; // Check every minute
  private intervalId: Timer | null = null;

  /**
   * Start the daily reset worker
   */
  start(): void {
    this.isRunning = true;

    // Check immediately on start
    this.checkAndReset();

    // Then check every minute
    this.intervalId = setInterval(() => {
      if (this.isRunning) {
        this.checkAndReset();
      }
    }, this.checkInterval);

    console.log('[DailyResetWorker] Started');
  }

  /**
   * Stop the worker
   */
  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[DailyResetWorker] Stopped');
  }

  /**
   * Check for accounts that need daily reset
   */
  private async checkAndReset(): Promise<void> {
    const now = new Date();

    try {
      // Find accounts where daily reset is due
      const accountsToReset = await db.query.tradingAccounts.findMany({
        where: and(
          lt(tradingAccounts.dailyResetAt, now),
          inArray(tradingAccounts.status, ['active', 'step1_passed'])
        ),
      });

      if (accountsToReset.length === 0) {
        return;
      }

      console.log(`[DailyResetWorker] Resetting ${accountsToReset.length} accounts`);

      for (const account of accountsToReset) {
        await this.resetAccount(account);
      }
    } catch (error) {
      console.error('[DailyResetWorker] Error checking for resets:', error);
    }
  }

  /**
   * Reset daily metrics for an account
   */
  private async resetAccount(account: typeof tradingAccounts.$inferSelect): Promise<void> {
    try {
      const currentBalance = parseFloat(account.currentBalance);
      const dailyStartingBalance = parseFloat(account.dailyStartingBalance);
      const dailyPnl = parseFloat(account.dailyPnl);
      const peakBalance = parseFloat(account.peakBalance);

      // Calculate next reset time (next UTC midnight)
      const now = new Date();
      const nextReset = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0, 0, 0, 0
      ));

      // Create daily snapshot before reset
      await db.insert(dailySnapshots).values({
        accountId: account.id,
        snapshotDate: new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate()
        )),
        startingBalance: dailyStartingBalance.toString(),
        endingBalance: currentBalance.toString(),
        peakBalance: peakBalance.toString(),
        dailyPnl: dailyPnl.toString(),
        dailyPnlPct: ((dailyPnl / dailyStartingBalance) * 100).toFixed(4),
        maxDailyDrawdown: Math.max(0, dailyStartingBalance - currentBalance).toString(),
        maxTotalDrawdown: Math.max(
          0,
          parseFloat(account.startingBalance) - currentBalance
        ).toString(),
        tradesCount: account.totalTrades,
        winningTrades: account.winningTrades,
        losingTrades: account.losingTrades,
        volume: account.totalVolume,
      });

      // Check if this is a new trading day
      const previousTradingDays = account.tradingDays;
      const hadTradesToday = dailyPnl !== 0 || account.lastTradeAt?.toDateString() === now.toDateString();
      const newTradingDays = hadTradesToday ? previousTradingDays + 1 : previousTradingDays;

      // Update account with new daily values
      await db
        .update(tradingAccounts)
        .set({
          dailyStartingBalance: currentBalance.toString(),
          dailyPnl: '0',
          dailyResetAt: nextReset,
          tradingDays: newTradingDays,
          updatedAt: new Date(),
        })
        .where(eq(tradingAccounts.id, account.id));

      // Log event
      await db.insert(tradeEvents).values({
        accountId: account.id,
        eventType: 'DAILY_RESET',
        details: {
          previousDailyStartingBalance: dailyStartingBalance,
          previousDailyPnl: dailyPnl,
          newDailyStartingBalance: currentBalance,
          tradingDays: newTradingDays,
          nextResetAt: nextReset.toISOString(),
        },
      });

      console.log(
        `[DailyResetWorker] Reset account ${account.accountNumber}: ` +
        `P&L ${dailyPnl >= 0 ? '+' : ''}${dailyPnl.toFixed(2)}, ` +
        `Trading days: ${newTradingDays}`
      );
    } catch (error) {
      console.error(`[DailyResetWorker] Failed to reset account ${account.id}:`, error);
    }
  }

  /**
   * Force reset for a specific account (admin use)
   */
  async forceReset(accountId: string): Promise<void> {
    const account = await db.query.tradingAccounts.findFirst({
      where: eq(tradingAccounts.id, accountId),
    });

    if (!account) {
      throw new Error('Account not found');
    }

    await this.resetAccount(account);
  }
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

let dailyResetWorker: DailyResetWorker | null = null;

export function startDailyResetWorker(): DailyResetWorker {
  if (!dailyResetWorker) {
    dailyResetWorker = new DailyResetWorker();
    dailyResetWorker.start();
  }
  return dailyResetWorker;
}

export function getDailyResetWorker(): DailyResetWorker | null {
  return dailyResetWorker;
}

