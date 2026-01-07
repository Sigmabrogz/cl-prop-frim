// ===========================================
// RISK ENGINE - Continuous Monitoring
// ===========================================
// Now uses AccountManager for shared state and synchronous close executor

import { db } from '@propfirm/database';
import { tradingAccounts, tradeEvents } from '@propfirm/database/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { setHash, CACHE_KEYS } from '@propfirm/redis';
import type { PriceEngine, PriceData } from '../price/price-engine.js';
import type { WebSocketServer } from '../websocket/server.js';
import { getPositionManager } from '../engine/position-manager.js';
import { accountManager } from '../engine/account-manager.js';
import { closeAllPositionsSync } from '../engine/close-executor.js';

// ===========================================
// TYPES
// ===========================================

interface AccountRiskState {
  accountId: string;
  userId: string;
  status: string;

  // Balances
  startingBalance: number;
  currentBalance: number;
  dailyStartingBalance: number;

  // Limits
  dailyLossLimit: number;
  maxDrawdownLimit: number;

  // Calculated
  equity: number;
  unrealizedPnl: number;
  dailyPnl: number;
  dailyLossPercent: number;
  drawdownPercent: number;

  // Warnings sent
  dailyLossWarning: boolean;
  drawdownWarning: boolean;

  // Last update
  lastUpdate: number;
}

// ===========================================
// RISK ENGINE CLASS
// ===========================================

export class RiskEngine {
  private priceEngine: PriceEngine;
  private wsServer: WebSocketServer;
  private isRunning = false;

  // Account ID -> Risk State
  private accountStates: Map<string, AccountRiskState> = new Map();

  // Check interval (ms)
  private checkInterval = 1000;
  private intervalId: Timer | null = null;

  constructor(priceEngine: PriceEngine, wsServer: WebSocketServer) {
    this.priceEngine = priceEngine;
    this.wsServer = wsServer;
  }

  /**
   * Initialize from database
   */
  async initialize(): Promise<void> {
    console.log('[RiskEngine] Loading active accounts...');

    // Get all active accounts with open positions
    const positionManager = getPositionManager();
    const activeAccountIds = new Set<string>();

    for (const position of positionManager.getAllPositions()) {
      activeAccountIds.add(position.accountId);
    }

    if (activeAccountIds.size === 0) {
      console.log('[RiskEngine] No active accounts with positions');
      return;
    }

    // Load account data
    const accounts = await db.query.tradingAccounts.findMany({
      where: and(
        inArray(tradingAccounts.id, Array.from(activeAccountIds)),
        eq(tradingAccounts.status, 'active')
      ),
      with: {
        user: {
          columns: { id: true },
        },
      },
    });

    for (const account of accounts) {
      this.accountStates.set(account.id, {
        accountId: account.id,
        userId: account.userId,
        status: account.status,
        startingBalance: parseFloat(account.startingBalance),
        currentBalance: parseFloat(account.currentBalance),
        dailyStartingBalance: parseFloat(account.dailyStartingBalance),
        dailyLossLimit: parseFloat(account.dailyLossLimit),
        maxDrawdownLimit: parseFloat(account.maxDrawdownLimit),
        equity: parseFloat(account.currentBalance),
        unrealizedPnl: 0,
        dailyPnl: 0,
        dailyLossPercent: 0,
        drawdownPercent: 0,
        dailyLossWarning: false,
        drawdownWarning: false,
        lastUpdate: Date.now(),
      });
    }

    console.log(`[RiskEngine] Loaded ${this.accountStates.size} accounts`);
  }

  /**
   * Start risk monitoring
   */
  start(): void {
    this.isRunning = true;

    // Subscribe to price updates for real-time risk calculation
    this.priceEngine.onPriceUpdate((symbol, price) => {
      if (this.isRunning) {
        this.onPriceUpdate(symbol, price);
      }
    });

    // Periodic full check
    this.intervalId = setInterval(() => {
      if (this.isRunning) {
        this.runFullCheck();
      }
    }, this.checkInterval);

    console.log('[RiskEngine] Started');
  }

  /**
   * Stop risk monitoring
   */
  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[RiskEngine] Stopped');
  }

  /**
   * Add account to monitoring
   */
  addAccount(accountId: string, data: Partial<AccountRiskState>): void {
    if (!this.accountStates.has(accountId)) {
      this.accountStates.set(accountId, {
        accountId,
        userId: data.userId || '',
        status: 'active',
        startingBalance: data.startingBalance || 0,
        currentBalance: data.currentBalance || 0,
        dailyStartingBalance: data.dailyStartingBalance || 0,
        dailyLossLimit: data.dailyLossLimit || 0,
        maxDrawdownLimit: data.maxDrawdownLimit || 0,
        equity: data.currentBalance || 0,
        unrealizedPnl: 0,
        dailyPnl: 0,
        dailyLossPercent: 0,
        drawdownPercent: 0,
        dailyLossWarning: false,
        drawdownWarning: false,
        lastUpdate: Date.now(),
      });
    }
  }

  /**
   * Remove account from monitoring
   */
  removeAccount(accountId: string): void {
    this.accountStates.delete(accountId);
  }

  /**
   * Handle price update - recalculate affected accounts
   */
  private onPriceUpdate(symbol: string, price: PriceData): void {
    const positionManager = getPositionManager();
    const positions = positionManager.getBySymbol(symbol);

    // Get affected accounts
    const affectedAccounts = new Set<string>();
    for (const position of positions) {
      affectedAccounts.add(position.accountId);
    }

    // Update each affected account
    for (const accountId of affectedAccounts) {
      this.updateAccountRisk(accountId);
    }
  }

  /**
   * Update risk metrics for an account
   */
  private async updateAccountRisk(accountId: string): Promise<void> {
    const state = this.accountStates.get(accountId);
    if (!state || state.status !== 'active') return;

    const positionManager = getPositionManager();

    // Calculate unrealized P&L
    const unrealizedPnl = positionManager.getAccountUnrealizedPnL(accountId);

    // Calculate equity
    const equity = state.currentBalance + unrealizedPnl;

    // Calculate daily P&L
    const dailyPnl = equity - state.dailyStartingBalance;

    // Calculate daily loss percentage
    const dailyLossUsed = dailyPnl < 0 ? Math.abs(dailyPnl) : 0;
    const dailyLossPercent = (dailyLossUsed / state.dailyStartingBalance) * 100;

    // Calculate drawdown percentage
    const drawdown = state.startingBalance - equity;
    const drawdownPercent = drawdown > 0 ? (drawdown / state.startingBalance) * 100 : 0;

    // Update state
    state.equity = equity;
    state.unrealizedPnl = unrealizedPnl;
    state.dailyPnl = dailyPnl;
    state.dailyLossPercent = dailyLossPercent;
    state.drawdownPercent = drawdownPercent;
    state.lastUpdate = Date.now();

    // Check for breaches
    await this.checkBreaches(state);

    // Update Redis cache for real-time dashboard
    await this.updateRedisCache(state);
  }

  /**
   * Check for risk breaches
   * Uses plan-specific limits from account state
   */
  private async checkBreaches(state: AccountRiskState): Promise<void> {
    // Calculate limit percentages from account-specific limits
    const dailyLossLimitPct = (state.dailyLossLimit / state.dailyStartingBalance) * 100;
    const maxDrawdownLimitPct = (state.maxDrawdownLimit / state.startingBalance) * 100;
    
    // Check daily loss breach (using account-specific limit)
    if (state.dailyLossPercent >= dailyLossLimitPct) {
      await this.triggerBreach(state.accountId, 'DAILY_LOSS', {
        dailyLossPercent: state.dailyLossPercent,
        dailyLossLimitPct,
        dailyLossLimit: state.dailyLossLimit,
        dailyPnl: state.dailyPnl,
      });
      return;
    }

    // Check daily loss warning (80% of limit)
    const dailyLossWarningThreshold = dailyLossLimitPct * 0.8;
    if (state.dailyLossPercent >= dailyLossWarningThreshold && !state.dailyLossWarning) {
      state.dailyLossWarning = true;
      this.sendWarning(state, 'DAILY_LOSS_WARNING', {
        dailyLossPercent: state.dailyLossPercent,
        dailyLossLimitPct,
        remaining: state.dailyLossLimit - Math.abs(state.dailyPnl),
      });
    }

    // Check max drawdown breach (using account-specific limit)
    if (state.drawdownPercent >= maxDrawdownLimitPct) {
      await this.triggerBreach(state.accountId, 'MAX_DRAWDOWN', {
        drawdownPercent: state.drawdownPercent,
        maxDrawdownLimitPct,
        maxDrawdownLimit: state.maxDrawdownLimit,
        equity: state.equity,
      });
      return;
    }

    // Check drawdown warning (80% of limit)
    const drawdownWarningThreshold = maxDrawdownLimitPct * 0.8;
    if (state.drawdownPercent >= drawdownWarningThreshold && !state.drawdownWarning) {
      state.drawdownWarning = true;
      this.sendWarning(state, 'DRAWDOWN_WARNING', {
        drawdownPercent: state.drawdownPercent,
        maxDrawdownLimitPct,
        remaining: state.maxDrawdownLimit - (state.startingBalance - state.equity),
      });
    }
  }

  /**
   * Trigger a breach - close all positions and mark account
   * Now uses synchronous close executor instead of Redis Streams
   */
  private async triggerBreach(
    accountId: string,
    breachType: string,
    details: Record<string, unknown>
  ): Promise<void> {
    console.log(`[RiskEngine] BREACH: ${breachType} for account ${accountId}`);

    const state = this.accountStates.get(accountId);
    if (!state) return;

    // Mark as breached locally to prevent further processing
    state.status = 'breached';

    // Close all positions SYNCHRONOUSLY
    const closeResult = await closeAllPositionsSync(accountId, 'BREACH', this.priceEngine);
    console.log(
      `[RiskEngine] Closed ${closeResult.closed} positions for breach. Total P&L: ${closeResult.totalPnl.toFixed(2)}`
    );

    // Update database
    await db
      .update(tradingAccounts)
      .set({
        status: 'breached',
        breachType: breachType.toLowerCase(),
        breachReason: JSON.stringify(details),
        breachedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tradingAccounts.id, accountId));

    // Log event
    await db.insert(tradeEvents).values({
      accountId,
      eventType: `${breachType}_BREACH`,
      details,
    });

    // Invalidate account cache
    accountManager.invalidate(accountId);

    // Notify user
    this.wsServer.sendToUser(state.userId, {
      type: 'ACCOUNT_BREACHED',
      accountId,
      breachType,
      details,
      positionsClosed: closeResult.closed,
      totalPnl: closeResult.totalPnl,
      message: `Account breached due to ${breachType.replace('_', ' ').toLowerCase()}`,
    });

    // Remove from monitoring
    this.accountStates.delete(accountId);
  }

  /**
   * Send risk warning to user
   */
  private sendWarning(
    state: AccountRiskState,
    warningType: string,
    details: Record<string, unknown>
  ): void {
    console.log(`[RiskEngine] WARNING: ${warningType} for account ${state.accountId}`);

    this.wsServer.sendToUser(state.userId, {
      type: 'RISK_WARNING',
      accountId: state.accountId,
      warningType,
      details,
      message: `Risk warning: approaching ${warningType.replace('_', ' ').toLowerCase()}`,
    });
  }

  /**
   * Update Redis cache with current risk state
   */
  private async updateRedisCache(state: AccountRiskState): Promise<void> {
    try {
      await setHash(`${CACHE_KEYS.ACCOUNT_STATE}:${state.accountId}`, {
        equity: state.equity.toFixed(8),
        unrealizedPnl: state.unrealizedPnl.toFixed(8),
        dailyPnl: state.dailyPnl.toFixed(8),
        dailyLossPercent: state.dailyLossPercent.toFixed(2),
        drawdownPercent: state.drawdownPercent.toFixed(2),
        lastUpdate: state.lastUpdate.toString(),
      });
    } catch (error) {
      // Non-critical, log and continue
      console.error('[RiskEngine] Failed to update Redis cache:', error);
    }
  }

  /**
   * Run full check on all accounts
   */
  private async runFullCheck(): Promise<void> {
    for (const accountId of this.accountStates.keys()) {
      await this.updateAccountRisk(accountId);
    }
  }

  /**
   * Get risk state for an account
   */
  getAccountRiskState(accountId: string): AccountRiskState | undefined {
    return this.accountStates.get(accountId);
  }

  /**
   * Get all monitored accounts
   */
  getMonitoredAccounts(): string[] {
    return Array.from(this.accountStates.keys());
  }
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

let riskEngine: RiskEngine | null = null;

export function startRiskEngine(
  priceEngine: PriceEngine,
  wsServer: WebSocketServer
): RiskEngine {
  if (!riskEngine) {
    riskEngine = new RiskEngine(priceEngine, wsServer);
    riskEngine.initialize();
    riskEngine.start();
  }
  return riskEngine;
}

export function getRiskEngine(): RiskEngine | null {
  return riskEngine;
}

