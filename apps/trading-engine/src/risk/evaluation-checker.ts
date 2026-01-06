// ===========================================
// EVALUATION CHECKER
// ===========================================

import { db } from '@propfirm/database';
import {
  tradingAccounts,
  evaluationPlans,
  tradeEvents,
  trades,
} from '@propfirm/database/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import type { WebSocketServer } from '../websocket/server.js';
import { getPositionManager } from '../engine/position-manager.js';

// ===========================================
// TYPES
// ===========================================

interface PassCheckResult {
  passed: boolean;
  reason?: string;
  details: {
    profitTargetMet: boolean;
    minTradingDaysMet: boolean;
    noBreaches: boolean;
    minHoldTimeMet: boolean;
    currentProfit: number;
    profitTarget: number;
    tradingDays: number;
    minTradingDays: number;
  };
}

// ===========================================
// EVALUATION CHECKER CLASS
// ===========================================

export class EvaluationChecker {
  private wsServer: WebSocketServer;
  private isRunning = false;
  private checkInterval = 5000; // Check every 5 seconds
  private intervalId: Timer | null = null;

  constructor(wsServer: WebSocketServer) {
    this.wsServer = wsServer;
  }

  /**
   * Start evaluation checking
   */
  start(): void {
    this.isRunning = true;

    this.intervalId = setInterval(() => {
      if (this.isRunning) {
        this.checkAllEvaluations();
      }
    }, this.checkInterval);

    console.log('[EvaluationChecker] Started');
  }

  /**
   * Stop checking
   */
  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[EvaluationChecker] Stopped');
  }

  /**
   * Check all active evaluation accounts
   */
  private async checkAllEvaluations(): Promise<void> {
    try {
      // Get active evaluation accounts
      const accounts = await db.query.tradingAccounts.findMany({
        where: and(
          eq(tradingAccounts.accountType, 'evaluation'),
          eq(tradingAccounts.status, 'active')
        ),
        with: {
          plan: true,
          user: {
            columns: { id: true },
          },
        },
      });

      for (const account of accounts) {
        if (account.plan) {
          await this.checkAccount(account, account.plan);
        }
      }
    } catch (error) {
      console.error('[EvaluationChecker] Error checking evaluations:', error);
    }
  }

  /**
   * Check if an account has passed evaluation
   */
  async checkAccount(
    account: typeof tradingAccounts.$inferSelect,
    plan: typeof evaluationPlans.$inferSelect
  ): Promise<PassCheckResult> {
    const positionManager = getPositionManager();

    // Get current equity (balance + unrealized P&L)
    const currentBalance = parseFloat(account.currentBalance);
    const unrealizedPnl = positionManager.getAccountUnrealizedPnL(account.id);
    const equity = currentBalance + unrealizedPnl;

    // Calculate current profit
    const startingBalance = parseFloat(account.startingBalance);
    const currentProfit = equity - startingBalance;

    // Get profit target for current step
    const profitTargetPct = account.currentStep === 1
      ? parseFloat(plan.step1ProfitTargetPct)
      : plan.step2ProfitTargetPct
        ? parseFloat(plan.step2ProfitTargetPct)
        : parseFloat(plan.step1ProfitTargetPct);

    const profitTarget = startingBalance * (profitTargetPct / 100);

    // Check conditions
    const profitTargetMet = currentProfit >= profitTarget;
    const minTradingDaysMet = account.tradingDays >= plan.minTradingDays;
    const noBreaches = account.status === 'active';

    // Check minimum hold time for trades
    const minHoldTimeMet = await this.checkMinHoldTime(account.id, plan.minTradeDurationSeconds);

    const result: PassCheckResult = {
      passed: profitTargetMet && minTradingDaysMet && noBreaches && minHoldTimeMet,
      details: {
        profitTargetMet,
        minTradingDaysMet,
        noBreaches,
        minHoldTimeMet,
        currentProfit,
        profitTarget,
        tradingDays: account.tradingDays,
        minTradingDays: plan.minTradingDays,
      },
    };

    // If passed, trigger pass flow
    if (result.passed) {
      await this.triggerPass(account, plan, result.details);
    }

    return result;
  }

  /**
   * Check if all trades meet minimum hold time
   */
  private async checkMinHoldTime(accountId: string, minSeconds: number): Promise<boolean> {
    // Check if any trade was closed too quickly
    const [violatingTrade] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(trades)
      .where(
        and(
          eq(trades.accountId, accountId),
          sql`${trades.durationSeconds} < ${minSeconds}`
        )
      );

    return (violatingTrade?.count || 0) === 0;
  }

  /**
   * Trigger evaluation pass
   */
  private async triggerPass(
    account: typeof tradingAccounts.$inferSelect,
    plan: typeof evaluationPlans.$inferSelect,
    details: PassCheckResult['details']
  ): Promise<void> {
    console.log(`[EvaluationChecker] PASS: Account ${account.accountNumber}`);

    const isTwoStep = plan.evaluationType === '2-STEP';
    const isStep1 = account.currentStep === 1;

    if (isTwoStep && isStep1) {
      // Pass step 1, create step 2
      await this.passStep1(account, plan, details);
    } else {
      // Pass evaluation, create funded account
      await this.passEvaluation(account, plan, details);
    }
  }

  /**
   * Pass step 1 of 2-step evaluation
   */
  private async passStep1(
    account: typeof tradingAccounts.$inferSelect,
    plan: typeof evaluationPlans.$inferSelect,
    details: PassCheckResult['details']
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Update current account to step1_passed
      await tx
        .update(tradingAccounts)
        .set({
          status: 'step1_passed',
          step1PassedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tradingAccounts.id, account.id));

      // Create step 2 account
      const accountNumber = account.accountNumber.replace('EVAL', 'EVAL2');
      const step2ProfitTargetPct = plan.step2ProfitTargetPct
        ? parseFloat(plan.step2ProfitTargetPct)
        : 5; // Default 5% for step 2

      const [step2Account] = await tx
        .insert(tradingAccounts)
        .values({
          userId: account.userId,
          planId: account.planId,
          accountType: 'evaluation',
          accountNumber,
          currentStep: 2,
          parentAccountId: account.id,
          startingBalance: account.startingBalance,
          currentBalance: account.startingBalance,
          peakBalance: account.startingBalance,
          availableMargin: account.startingBalance,
          dailyStartingBalance: account.startingBalance,
          dailyResetAt: this.getNextMidnight(),
          dailyLossLimit: account.dailyLossLimit,
          maxDrawdownLimit: account.maxDrawdownLimit,
          profitTarget: (
            parseFloat(account.startingBalance) * (step2ProfitTargetPct / 100)
          ).toString(),
          status: 'active',
        })
        .returning();

      // Log event
      await tx.insert(tradeEvents).values({
        accountId: account.id,
        eventType: 'STEP1_PASSED',
        details: {
          ...details,
          step2AccountId: step2Account.id,
          step2AccountNumber: accountNumber,
        },
      });

      // Notify user
      this.wsServer.sendToUser(account.userId, {
        type: 'EVALUATION_STEP_PASSED',
        accountId: account.id,
        step: 1,
        nextStep: 2,
        nextAccountId: step2Account.id,
        nextAccountNumber: accountNumber,
        message: 'Congratulations! You passed Step 1. Step 2 account has been created.',
      });
    });
  }

  /**
   * Pass evaluation and create funded account
   */
  private async passEvaluation(
    account: typeof tradingAccounts.$inferSelect,
    plan: typeof evaluationPlans.$inferSelect,
    details: PassCheckResult['details']
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Update evaluation account to passed
      await tx
        .update(tradingAccounts)
        .set({
          status: 'passed',
          passedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tradingAccounts.id, account.id));

      // Create funded account
      const accountNumber = account.accountNumber
        .replace('EVAL2', 'FUND')
        .replace('EVAL', 'FUND');

      const [fundedAccount] = await tx
        .insert(tradingAccounts)
        .values({
          userId: account.userId,
          planId: account.planId,
          accountType: 'funded',
          accountNumber,
          currentStep: 1,
          parentAccountId: account.id,
          startingBalance: account.startingBalance,
          currentBalance: account.startingBalance,
          peakBalance: account.startingBalance,
          availableMargin: account.startingBalance,
          dailyStartingBalance: account.startingBalance,
          dailyResetAt: this.getNextMidnight(),
          dailyLossLimit: account.dailyLossLimit,
          maxDrawdownLimit: account.maxDrawdownLimit,
          profitTarget: '0', // No profit target for funded
          status: 'active',
        })
        .returning();

      // Log event
      await tx.insert(tradeEvents).values({
        accountId: account.id,
        eventType: 'EVALUATION_PASSED',
        details: {
          ...details,
          fundedAccountId: fundedAccount.id,
          fundedAccountNumber: accountNumber,
          profitSplitPct: plan.profitSplitPct,
        },
      });

      // Notify user
      this.wsServer.sendToUser(account.userId, {
        type: 'EVALUATION_PASSED',
        accountId: account.id,
        fundedAccountId: fundedAccount.id,
        fundedAccountNumber: accountNumber,
        profitSplitPct: plan.profitSplitPct,
        message: `Congratulations! You passed the evaluation. Your funded account (${plan.profitSplitPct}% profit split) is ready.`,
      });
    });
  }

  /**
   * Get next UTC midnight
   */
  private getNextMidnight(): Date {
    const now = new Date();
    return new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0
    ));
  }

  /**
   * Manually check a specific account
   */
  async checkSpecificAccount(accountId: string): Promise<PassCheckResult | null> {
    const account = await db.query.tradingAccounts.findFirst({
      where: eq(tradingAccounts.id, accountId),
      with: {
        plan: true,
      },
    });

    if (!account || !account.plan) {
      return null;
    }

    return this.checkAccount(account, account.plan);
  }
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

let evaluationChecker: EvaluationChecker | null = null;

export function startEvaluationChecker(wsServer: WebSocketServer): EvaluationChecker {
  if (!evaluationChecker) {
    evaluationChecker = new EvaluationChecker(wsServer);
    evaluationChecker.start();
  }
  return evaluationChecker;
}

export function getEvaluationChecker(): EvaluationChecker | null {
  return evaluationChecker;
}

