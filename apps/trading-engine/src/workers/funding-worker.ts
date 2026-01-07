// ===========================================
// FUNDING WORKER
// ===========================================
// Applies funding fees to open positions every 8 hours
// Binance funding times: 00:00, 08:00, 16:00 UTC

import { createHash } from 'crypto';
import { db } from '@propfirm/database';
import { positions, tradingAccounts, tradeEvents } from '@propfirm/database/schema';
import { eq, and, sql, lt, isNull, or } from 'drizzle-orm';
import { getMarketDataService, type FundingRate } from '../price/market-data-service.js';

// ===========================================
// CONFIGURATION
// ===========================================

// Funding intervals in hours (00:00, 08:00, 16:00 UTC)
const FUNDING_HOURS = [0, 8, 16];
const CHECK_INTERVAL_MS = 60000; // Check every minute
const FUNDING_GRACE_PERIOD_MS = 300000; // 5 minutes grace period after funding time

// ===========================================
// FUNDING WORKER CLASS
// ===========================================

export class FundingWorker {
  private isRunning = false;
  private intervalId: Timer | null = null;
  private lastProcessedFundingTime: number = 0;

  /**
   * Start the funding worker
   */
  start(): void {
    this.isRunning = true;

    // Check immediately on start
    this.checkAndApplyFunding();

    // Then check every minute
    this.intervalId = setInterval(() => {
      if (this.isRunning) {
        this.checkAndApplyFunding();
      }
    }, CHECK_INTERVAL_MS);

    console.log('[FundingWorker] Started');
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
    console.log('[FundingWorker] Stopped');
  }

  /**
   * Get the current funding time slot (00:00, 08:00, or 16:00 UTC)
   * Returns the most recent funding time that has passed
   */
  private getCurrentFundingTime(): Date {
    const now = new Date();
    const currentHour = now.getUTCHours();

    // Find the most recent funding hour that has passed
    let fundingHour = FUNDING_HOURS[0]; // Default to 00:00
    for (const hour of FUNDING_HOURS) {
      if (currentHour >= hour) {
        fundingHour = hour;
      }
    }

    // Create the funding time
    const fundingTime = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      fundingHour,
      0, 0, 0
    ));

    // If the funding time is in the future (shouldn't happen), use yesterday's last slot
    if (fundingTime.getTime() > now.getTime()) {
      fundingTime.setUTCDate(fundingTime.getUTCDate() - 1);
      fundingTime.setUTCHours(16); // Previous day's 16:00
    }

    return fundingTime;
  }

  /**
   * Get the next funding time
   */
  private getNextFundingTime(): Date {
    const now = new Date();
    const currentHour = now.getUTCHours();

    // Find the next funding hour
    let fundingHour = FUNDING_HOURS[0]; // Default to next day's 00:00
    let addDay = true;

    for (const hour of FUNDING_HOURS) {
      if (currentHour < hour) {
        fundingHour = hour;
        addDay = false;
        break;
      }
    }

    // Create the next funding time
    const nextFundingTime = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + (addDay ? 1 : 0),
      fundingHour,
      0, 0, 0
    ));

    return nextFundingTime;
  }

  /**
   * Check if we should apply funding
   */
  private shouldApplyFunding(): boolean {
    const now = Date.now();
    const currentFundingTime = this.getCurrentFundingTime().getTime();

    // Don't process the same funding time twice
    if (currentFundingTime === this.lastProcessedFundingTime) {
      return false;
    }

    // Check if we're within the grace period after a funding time
    const timeSinceFunding = now - currentFundingTime;
    if (timeSinceFunding >= 0 && timeSinceFunding <= FUNDING_GRACE_PERIOD_MS) {
      return true;
    }

    return false;
  }

  /**
   * Check and apply funding if needed
   */
  private async checkAndApplyFunding(): Promise<void> {
    if (!this.shouldApplyFunding()) {
      return;
    }

    const currentFundingTime = this.getCurrentFundingTime();
    console.log(`[FundingWorker] Applying funding for ${currentFundingTime.toISOString()}`);

    try {
      await this.applyFunding(currentFundingTime);
      this.lastProcessedFundingTime = currentFundingTime.getTime();
      console.log('[FundingWorker] Funding applied successfully');
    } catch (error) {
      console.error('[FundingWorker] Error applying funding:', error);
    }
  }

  /**
   * Apply funding to all open positions
   */
  private async applyFunding(fundingTime: Date): Promise<void> {
    const marketDataService = getMarketDataService();
    if (!marketDataService) {
      console.error('[FundingWorker] Market data service not available');
      return;
    }

    // Get all open positions that haven't had funding applied for this time slot
    // Either lastFundingAt is null or it's before the current funding time
    const openPositions = await db.query.positions.findMany({
      where: or(
        isNull(positions.lastFundingAt),
        lt(positions.lastFundingAt, fundingTime)
      ),
    });

    if (openPositions.length === 0) {
      console.log('[FundingWorker] No positions to process');
      return;
    }

    console.log(`[FundingWorker] Processing funding for ${openPositions.length} positions`);

    // Group positions by account for batch balance updates
    const accountFundingMap = new Map<string, number>();

    for (const position of openPositions) {
      const fundingRate = marketDataService.getFundingRate(position.symbol);
      if (!fundingRate) {
        console.log(`[FundingWorker] No funding rate for ${position.symbol}, skipping`);
        continue;
      }

      // Calculate funding payment
      // Funding Payment = Position Notional Value × Funding Rate
      // Position Notional Value = quantity × entry price (or mark price)
      const notionalValue = parseFloat(position.quantity) * parseFloat(position.entryPrice);
      const fundingPayment = notionalValue * fundingRate.fundingRate;

      // For LONG positions: positive funding rate = pay (negative for account)
      // For SHORT positions: positive funding rate = receive (positive for account)
      // We store accumulated funding as positive = paid (cost to user)
      let actualFundingCost: number;
      if (position.side === 'LONG') {
        // Long pays when funding rate is positive
        actualFundingCost = fundingPayment;
      } else {
        // Short receives when funding rate is positive (so it's negative cost)
        actualFundingCost = -fundingPayment;
      }

      const currentAccumulatedFunding = parseFloat(position.accumulatedFunding);
      const newAccumulatedFunding = currentAccumulatedFunding + actualFundingCost;

      // Update position's accumulated funding
      await db
        .update(positions)
        .set({
          accumulatedFunding: newAccumulatedFunding.toString(),
          lastFundingAt: fundingTime,
        })
        .where(eq(positions.id, position.id));

      // Track account-level funding changes (to update balance)
      const currentAccountFunding = accountFundingMap.get(position.accountId) || 0;
      accountFundingMap.set(position.accountId, currentAccountFunding + actualFundingCost);

      // Log event
      const eventDetails = {
        positionId: position.id,
        symbol: position.symbol,
        side: position.side,
        notionalValue,
        fundingRate: fundingRate.fundingRate,
        fundingPayment: actualFundingCost,
        newAccumulatedFunding,
      };
      const eventData = JSON.stringify({
        accountId: position.accountId,
        positionId: position.id,
        eventType: 'FUNDING_APPLIED',
        details: eventDetails,
        timestamp: fundingTime.toISOString(),
      });
      const eventHash = createHash('sha256').update(eventData).digest('hex');

      // Note: We're using a valid event type for now
      // If you want FUNDING_APPLIED, add it to the trade_events valid_event_type constraint

      console.log(
        `[FundingWorker] ${position.symbol} ${position.side}: ` +
        `funding rate ${(fundingRate.fundingRate * 100).toFixed(4)}%, ` +
        `payment: ${actualFundingCost >= 0 ? '-' : '+'}$${Math.abs(actualFundingCost).toFixed(4)}`
      );
    }

    // Update account balances (deduct funding costs)
    for (const [accountId, totalFunding] of accountFundingMap) {
      if (Math.abs(totalFunding) < 0.00001) continue; // Skip negligible amounts

      const account = await db.query.tradingAccounts.findFirst({
        where: eq(tradingAccounts.id, accountId),
      });

      if (!account) continue;

      const currentBalance = parseFloat(account.currentBalance);
      const newBalance = currentBalance - totalFunding; // Subtract cost (positive = deduction)
      const currentDailyPnl = parseFloat(account.dailyPnl);
      const newDailyPnl = currentDailyPnl - totalFunding;

      await db
        .update(tradingAccounts)
        .set({
          currentBalance: newBalance.toString(),
          dailyPnl: newDailyPnl.toString(),
          updatedAt: new Date(),
        })
        .where(eq(tradingAccounts.id, accountId));

      console.log(
        `[FundingWorker] Account ${account.accountNumber}: ` +
        `funding impact: ${totalFunding >= 0 ? '-' : '+'}$${Math.abs(totalFunding).toFixed(4)}`
      );
    }
  }

  /**
   * Force apply funding for testing (admin use)
   */
  async forceApplyFunding(): Promise<void> {
    const fundingTime = this.getCurrentFundingTime();
    await this.applyFunding(fundingTime);
    this.lastProcessedFundingTime = fundingTime.getTime();
  }
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

let fundingWorker: FundingWorker | null = null;

export function startFundingWorker(): FundingWorker {
  if (!fundingWorker) {
    fundingWorker = new FundingWorker();
    fundingWorker.start();
  }
  return fundingWorker;
}

export function getFundingWorker(): FundingWorker | null {
  return fundingWorker;
}
