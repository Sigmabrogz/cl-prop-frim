// ===========================================
// CLOSE EXECUTOR - Synchronous Position Close
// ===========================================
// This module closes positions SYNCHRONOUSLY in <10ms
// Database persistence is done asynchronously (fire-and-forget)

import { db } from '@propfirm/database';
import { positions, trades, orders } from '@propfirm/database/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { accountManager, type AccountState } from './account-manager.js';
import { getPositionManager, type Position } from './position-manager.js';
import { calculateUnrealizedPnL } from './margin-calculator.js';
import type { PriceEngine, PriceData } from '../price/price-engine.js';
import { auditLogger } from '../security/rate-limiter.js';

// ===========================================
// TYPES
// ===========================================

export type CloseReason = 'MANUAL' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'LIQUIDATION' | 'BREACH';

export interface CloseResult {
  success: boolean;
  error?: string;
  tradeId?: string;
  grossPnl?: number;
  netPnl?: number;
  exitPrice?: number;
  executionTime?: number;
  account?: AccountState;
  updatedPosition?: Position; // For partial close - the remaining position
  isPartialClose?: boolean;
}

// ===========================================
// RETRY QUEUE FOR FAILED DB PERSISTS
// ===========================================

interface ClosePersistTask {
  trade: TradeData;
  retries: number;
  createdAt: number;
}

const closeRetryQueue: ClosePersistTask[] = [];
const MAX_RETRIES = 3;
const MAX_QUEUE_SIZE = 100; // Prevent unbounded memory growth
let consecutiveFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 10; // Trip after 10 consecutive failures

// Store interval reference for cleanup
let closeRetryQueueInterval: NodeJS.Timeout | null = null;

// Process retry queue every 10 seconds
closeRetryQueueInterval = setInterval(() => processCloseRetryQueue(), 10000);

async function processCloseRetryQueue(): Promise<void> {
  if (closeRetryQueue.length === 0) {
    // Reset circuit breaker on empty queue
    consecutiveFailures = 0;
    return;
  }

  // Circuit breaker: if too many failures, wait longer
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    console.warn(`[CloseExecutor] Circuit breaker active: ${consecutiveFailures} consecutive failures, queue size: ${closeRetryQueue.length}`);
    // Only process 1 item to test if DB is back
    const testTask = closeRetryQueue[0];
    try {
      await persistTradeToDb(testTask.trade);
      // Success - reset circuit breaker
      closeRetryQueue.shift();
      consecutiveFailures = 0;
      console.log('[CloseExecutor] Circuit breaker reset - DB connection restored');
    } catch {
      // Still failing - keep circuit breaker active
    }
    return;
  }

  const tasks = closeRetryQueue.splice(0, 10);

  for (const task of tasks) {
    try {
      await persistTradeToDb(task.trade);
      consecutiveFailures = 0; // Reset on success
    } catch (error) {
      consecutiveFailures++;

      if (task.retries < MAX_RETRIES) {
        task.retries++;
        // Only re-queue if under max size
        if (closeRetryQueue.length < MAX_QUEUE_SIZE) {
          closeRetryQueue.push(task);
        } else {
          console.error(`[CloseExecutor] CRITICAL: Dropping persist task - queue at max size (${MAX_QUEUE_SIZE})`);
        }
      } else {
        console.error(`[CloseExecutor] Giving up on persist after ${MAX_RETRIES} retries:`, error);
      }
    }
  }

  // Alert if queue is getting large
  if (closeRetryQueue.length > MAX_QUEUE_SIZE * 0.8) {
    console.warn(`[CloseExecutor] WARNING: Retry queue at ${closeRetryQueue.length}/${MAX_QUEUE_SIZE} capacity`);
  }
}

// ===========================================
// MAIN CLOSE FUNCTION
// ===========================================

/**
 * Close a position synchronously
 * Target: <10ms execution time
 * @param closeQuantity - Optional: for partial close. If not provided or >= position quantity, full close.
 */
export async function closePositionSync(
  positionId: string,
  closePrice: number,
  closeReason: CloseReason,
  binancePrice?: number,
  closeQuantity?: number
): Promise<CloseResult> {
  const startTime = Date.now();

  try {
    // 1. Get position from PositionManager (in-memory)
    const positionManager = getPositionManager();
    const position = positionManager.getPosition(positionId);

    if (!position) {
      return { success: false, error: 'Position not found' };
    }

    // Determine if partial close
    const isPartialClose = closeQuantity !== undefined && closeQuantity > 0 && closeQuantity < position.quantity;
    const quantityToClose = isPartialClose ? closeQuantity : position.quantity;

    // 2. Execute with account lock
    const result = await accountManager.withLock(position.accountId, async () => {
      return executeClose(position, closePrice, closeReason, binancePrice, startTime, quantityToClose, isPartialClose);
    }, 50);

    if (result === null) {
      return { success: false, error: 'Account busy, please retry' };
    }

    return result;

  } catch (error) {
    console.error('[CloseExecutor] Close error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Internal error'
    };
  }
}

/**
 * Close position while holding account lock
 */
async function executeClose(
  position: Position,
  closePrice: number,
  closeReason: CloseReason,
  binancePrice: number | undefined,
  startTime: number,
  quantityToClose: number,
  isPartialClose: boolean
): Promise<CloseResult> {
  const now = new Date();
  const tradeId = uuidv4();
  const positionManager = getPositionManager();

  // 1. Get account state
  const account = await accountManager.getAccount(position.accountId);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  // 2. Calculate P&L for the closed quantity
  const grossPnl = calculateUnrealizedPnL(
    position.side,
    quantityToClose,
    position.entryPrice,
    closePrice
  );

  // 3. Calculate exit fee based on closed quantity
  const exitValue = quantityToClose * closePrice;
  const exitFee = exitValue * 0.0005; // 0.05% = 5 bps

  // 4. Calculate net P&L including funding
  // Funding fees (proportional for partial close)
  const fundingFeeForClosed = isPartialClose
    ? position.accumulatedFunding * (quantityToClose / position.quantity)
    : position.accumulatedFunding;

  // Total fees = exit fee only (entry fee was already deducted when opening)
  // This makes the math consistent: netPnl = grossPnl - totalFees - fundingFee
  const totalFees = exitFee;

  // Net P&L = Gross P&L - Exit Fee - Funding Fee
  const netPnl = grossPnl - exitFee - fundingFeeForClosed;

  // 5. Calculate duration
  const durationSeconds = Math.floor((now.getTime() - position.openedAt.getTime()) / 1000);

  // 6. Calculate margin released (proportional to quantity closed)
  const marginReleased = isPartialClose
    ? position.marginUsed * (quantityToClose / position.quantity)
    : position.marginUsed;

  // 7. Update account state IN MEMORY
  // Note: currentBalance only changes by netPnl (margin is tracked separately in availableMargin/totalMarginUsed)
  const newCurrentBalance = account.currentBalance + netPnl;
  const newAvailableMargin = account.availableMargin + marginReleased + netPnl;
  const newTotalMarginUsed = account.totalMarginUsed - marginReleased;
  const newDailyPnl = account.dailyPnl + netPnl;
  const newCurrentProfit = account.currentProfit + netPnl;
  const newPeakBalance = Math.max(account.peakBalance, newCurrentBalance);

  // Track win/loss
  const isWin = netPnl > 0;

  accountManager.updateAccount(position.accountId, {
    currentBalance: newCurrentBalance,
    availableMargin: newAvailableMargin,
    totalMarginUsed: Math.max(0, newTotalMarginUsed),
    dailyPnl: newDailyPnl,
    currentProfit: newCurrentProfit,
    peakBalance: newPeakBalance,
    winningTrades: isWin ? account.winningTrades + 1 : account.winningTrades,
    losingTrades: !isWin ? account.losingTrades + 1 : account.losingTrades,
  });

  // 8. Handle position update
  let updatedPosition: Position | undefined;

  if (isPartialClose) {
    // Partial close: Update position with reduced quantity
    const remainingQuantity = position.quantity - quantityToClose;
    const remainingMargin = position.marginUsed - marginReleased;
    const remainingEntryFee = position.entryFee - entryFeeForClosed;
    const remainingEntryValue = remainingQuantity * position.entryPrice;
    const remainingFunding = position.accumulatedFunding - fundingFeeForClosed;

    updatedPosition = {
      ...position,
      quantity: remainingQuantity,
      marginUsed: remainingMargin,
      entryFee: remainingEntryFee,
      entryValue: remainingEntryValue,
      accumulatedFunding: remainingFunding,
    };

    positionManager.updatePosition(position.id, updatedPosition);
  } else {
    // Full close: Remove position
    positionManager.removePosition(position.id);
  }

  // 9. Calculate execution time
  const executionTime = Date.now() - startTime;

  // 10. Log the close
  console.log(
    `[CloseExecutor] Position ${isPartialClose ? 'partially ' : ''}closed in ${executionTime}ms: ` +
    `${position.symbol} ${position.side} ${quantityToClose}${isPartialClose ? '/' + position.quantity : ''} @ ${closePrice.toFixed(2)} | ` +
    `P&L: ${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)} | Reason: ${closeReason}`
  );

  // 11. Persist to database ASYNCHRONOUSLY
  const tradeData: TradeData = {
    tradeId,
    position: { ...position, quantity: quantityToClose }, // Store the closed quantity
    closePrice,
    closeReason,
    exitValue,
    exitFee,
    fundingFee: fundingFeeForClosed,
    grossPnl,
    totalFees,
    netPnl,
    durationSeconds,
    binancePrice: binancePrice || closePrice,
    closedAt: now,
  };

  // For partial close, don't delete position from DB, just create trade record
  if (isPartialClose) {
    persistPartialCloseAsync(tradeData, position.id, updatedPosition!);
  } else {
    persistCloseAsync(tradeData, position.id);
  }

  // 12. Audit log
  auditLogger.log({
    userId: account.userId,
    accountId: position.accountId,
    action: isPartialClose ? 'POSITION_PARTIALLY_CLOSED' : 'POSITION_CLOSED',
    details: {
      tradeId,
      positionId: position.id,
      symbol: position.symbol,
      side: position.side,
      quantityClosed: quantityToClose,
      originalQuantity: position.quantity,
      remainingQuantity: isPartialClose ? position.quantity - quantityToClose : 0,
      entryPrice: position.entryPrice,
      exitPrice: closePrice,
      grossPnl,
      netPnl,
      closeReason,
      executionTimeMs: executionTime,
    },
    success: true,
  });

  // 13. Get updated account
  const updatedAccount = await accountManager.getAccount(position.accountId);

  return {
    success: true,
    tradeId,
    grossPnl,
    netPnl,
    exitPrice: closePrice,
    executionTime,
    account: updatedAccount!,
    updatedPosition,
    isPartialClose,
  };
}

// ===========================================
// ASYNC DATABASE PERSISTENCE
// ===========================================

interface TradeData {
  tradeId: string;
  position: Position;
  closePrice: number;
  closeReason: CloseReason;
  exitValue: number;
  exitFee: number;
  fundingFee: number;
  grossPnl: number;
  totalFees: number;
  netPnl: number;
  durationSeconds: number;
  binancePrice: number;
  closedAt: Date;
}

function persistCloseAsync(tradeData: TradeData, positionId: string): void {
  Promise.all([
    persistTradeToDb(tradeData),
    deletePositionFromDb(positionId),
  ]).catch(error => {
    console.error('[CloseExecutor] Async persist failed:', error);
    // Only add to queue if under max size
    if (closeRetryQueue.length < MAX_QUEUE_SIZE) {
      closeRetryQueue.push({
        trade: tradeData,
        retries: 0,
        createdAt: Date.now(),
      });
    } else {
      console.error(`[CloseExecutor] CRITICAL: Cannot queue persist - queue full (${closeRetryQueue.length}/${MAX_QUEUE_SIZE})`);
    }
  });
}

function persistPartialCloseAsync(tradeData: TradeData, positionId: string, updatedPosition: Position): void {
  Promise.all([
    persistTradeToDb(tradeData),
    updatePositionInDb(positionId, updatedPosition),
  ]).catch(error => {
    console.error('[CloseExecutor] Async partial close persist failed:', error);
    // Only add to queue if under max size
    if (closeRetryQueue.length < MAX_QUEUE_SIZE) {
      closeRetryQueue.push({
        trade: tradeData,
        retries: 0,
        createdAt: Date.now(),
      });
    } else {
      console.error(`[CloseExecutor] CRITICAL: Cannot queue partial persist - queue full (${closeRetryQueue.length}/${MAX_QUEUE_SIZE})`);
    }
  });
}

async function updatePositionInDb(positionId: string, position: Position): Promise<void> {
  await db.update(positions)
    .set({
      quantity: position.quantity.toString(),
      marginUsed: position.marginUsed.toString(),
      entryFee: position.entryFee.toString(),
      entryValue: position.entryValue.toString(),
      accumulatedFunding: position.accumulatedFunding.toString(),
    })
    .where(eq(positions.id, positionId));
}

async function persistTradeToDb(data: TradeData): Promise<void> {
  const { tradeId, position, closePrice, closeReason, exitValue, exitFee, fundingFee, grossPnl, totalFees, netPnl, durationSeconds, binancePrice, closedAt } = data;

  await db.insert(trades).values({
    id: tradeId,
    accountId: position.accountId,
    positionId: position.id,
    symbol: position.symbol,
    side: position.side,
    quantity: position.quantity.toString(),
    leverage: position.leverage,
    entryPrice: position.entryPrice.toString(),
    entryValue: position.entryValue.toString(),
    marginUsed: position.marginUsed.toString(),
    entryFee: position.entryFee.toString(),
    openedAt: position.openedAt,
    exitPrice: closePrice.toString(),
    exitValue: exitValue.toString(),
    exitFee: exitFee.toString(),
    closedAt,
    closeReason,
    grossPnl: grossPnl.toString(),
    totalFees: totalFees.toString(),
    fundingFee: fundingFee.toString(),
    netPnl: netPnl.toString(),
    durationSeconds,
    binancePriceAtEntry: position.entryPrice.toString(), // TODO: Store actual binance price
    binancePriceAtExit: binancePrice.toString(),
    takeProfitWas: position.takeProfit?.toString(),
    stopLossWas: position.stopLoss?.toString(),
  });
}

async function deletePositionFromDb(positionId: string): Promise<void> {
  // First, clear the positionId reference from any orders that reference this position
  // This prevents foreign key constraint violations
  await db.update(orders)
    .set({ positionId: null })
    .where(eq(orders.positionId, positionId));
  
  // Now we can safely delete the position
  await db.delete(positions).where(eq(positions.id, positionId));
}

// ===========================================
// BATCH CLOSE (for breach handling)
// ===========================================

// Max price staleness for close operations (5 seconds)
const MAX_PRICE_AGE_MS = 5000;

/**
 * Close all positions for an account (for breach/liquidation)
 */
export async function closeAllPositionsSync(
  accountId: string,
  closeReason: CloseReason,
  priceEngine: PriceEngine
): Promise<{ closed: number; totalPnl: number; skippedDueToStalePrice: number }> {
  const positionManager = getPositionManager();
  const accountPositions = positionManager.getByAccount(accountId);

  let closed = 0;
  let totalPnl = 0;
  let skippedDueToStalePrice = 0;

  for (const position of accountPositions) {
    const price = priceEngine.getPrice(position.symbol);
    if (!price) {
      console.warn(`[CloseExecutor] No price for ${position.symbol}, skipping position ${position.id}`);
      continue;
    }

    // CRITICAL: Check price staleness before batch close
    // Never close on stale data during breach - could cause unfair losses
    const priceAge = Date.now() - price.timestamp;
    if (priceAge > MAX_PRICE_AGE_MS) {
      console.warn(
        `[CloseExecutor] Skipping position ${position.id}: ` +
        `price is stale (${(priceAge / 1000).toFixed(1)}s old)`
      );
      skippedDueToStalePrice++;
      continue;
    }

    const closePrice = position.side === 'LONG' ? price.ourBid : price.ourAsk;
    const result = await closePositionSync(position.id, closePrice, closeReason, price.midPrice);

    if (result.success) {
      closed++;
      totalPnl += result.netPnl || 0;
    }
  }

  if (skippedDueToStalePrice > 0) {
    console.warn(
      `[CloseExecutor] Batch close completed with ${skippedDueToStalePrice} positions skipped due to stale prices`
    );
  }

  return { closed, totalPnl, skippedDueToStalePrice };
}

/**
 * Get close retry queue stats
 */
export function getCloseRetryQueueStats(): {
  pending: number;
  maxSize: number;
  circuitBreakerActive: boolean;
  consecutiveFailures: number;
} {
  return {
    pending: closeRetryQueue.length,
    maxSize: MAX_QUEUE_SIZE,
    circuitBreakerActive: consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD,
    consecutiveFailures,
  };
}

/**
 * Shutdown the close executor (clear intervals, flush queue)
 */
export async function shutdownCloseExecutor(): Promise<void> {
  // Clear the retry queue interval
  if (closeRetryQueueInterval) {
    clearInterval(closeRetryQueueInterval);
    closeRetryQueueInterval = null;
  }

  // Try to process remaining items in queue
  if (closeRetryQueue.length > 0) {
    console.log(`[CloseExecutor] Shutting down with ${closeRetryQueue.length} items in retry queue...`);
    // Try one final flush
    try {
      await processCloseRetryQueue();
    } catch (error) {
      console.error('[CloseExecutor] Final flush failed:', error);
    }
  }

  console.log('[CloseExecutor] Shutdown complete');
}

