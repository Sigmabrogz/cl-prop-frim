// ===========================================
// CLOSE EXECUTOR - Synchronous Position Close
// ===========================================
// This module closes positions SYNCHRONOUSLY in <10ms
// Database persistence is done asynchronously (fire-and-forget)

import { db } from '@propfirm/database';
import { positions, trades, tradingAccounts } from '@propfirm/database/schema';
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

// Process retry queue every 10 seconds
setInterval(() => processCloseRetryQueue(), 10000);

async function processCloseRetryQueue(): Promise<void> {
  if (closeRetryQueue.length === 0) return;
  
  const tasks = closeRetryQueue.splice(0, 10);
  
  for (const task of tasks) {
    try {
      await persistTradeToDb(task.trade);
    } catch (error) {
      if (task.retries < MAX_RETRIES) {
        task.retries++;
        closeRetryQueue.push(task);
      } else {
        console.error(`[CloseExecutor] Giving up on persist after ${MAX_RETRIES} retries:`, error);
      }
    }
  }
}

// ===========================================
// MAIN CLOSE FUNCTION
// ===========================================

/**
 * Close a position synchronously
 * Target: <10ms execution time
 */
export async function closePositionSync(
  positionId: string,
  closePrice: number,
  closeReason: CloseReason,
  binancePrice?: number
): Promise<CloseResult> {
  const startTime = Date.now();
  
  try {
    // 1. Get position from PositionManager (in-memory)
    const positionManager = getPositionManager();
    const position = positionManager.getPosition(positionId);
    
    if (!position) {
      return { success: false, error: 'Position not found' };
    }
    
    // 2. Execute with account lock
    const result = await accountManager.withLock(position.accountId, async () => {
      return executeClose(position, closePrice, closeReason, binancePrice, startTime);
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
  startTime: number
): Promise<CloseResult> {
  const now = new Date();
  const tradeId = uuidv4();
  
  // 1. Get account state
  const account = await accountManager.getAccount(position.accountId);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }
  
  // 2. Calculate P&L
  const grossPnl = calculateUnrealizedPnL(
    position.side,
    position.quantity,
    position.entryPrice,
    closePrice
  );
  
  // 3. Calculate exit fee (same as entry fee rate)
  const exitValue = position.quantity * closePrice;
  const exitFee = exitValue * 0.0005; // 0.05% = 5 bps
  
  // 4. Calculate net P&L
  const totalFees = position.entryFee + exitFee;
  const netPnl = grossPnl - exitFee;
  
  // 5. Calculate duration
  const durationSeconds = Math.floor((now.getTime() - position.openedAt.getTime()) / 1000);
  
  // 6. Update account state IN MEMORY
  const newCurrentBalance = account.currentBalance + position.marginUsed + netPnl;
  const newAvailableMargin = account.availableMargin + position.marginUsed + netPnl;
  const newTotalMarginUsed = account.totalMarginUsed - position.marginUsed;
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
  
  // 7. Remove position from PositionManager (in-memory)
  const positionManager = getPositionManager();
  positionManager.removePosition(position.id);
  
  // 8. Calculate execution time
  const executionTime = Date.now() - startTime;
  
  // 9. Log the close
  console.log(
    `[CloseExecutor] Position closed in ${executionTime}ms: ` +
    `${position.symbol} ${position.side} @ ${closePrice.toFixed(2)} | ` +
    `P&L: ${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)} | Reason: ${closeReason}`
  );
  
  // 10. Persist to database ASYNCHRONOUSLY
  const tradeData: TradeData = {
    tradeId,
    position,
    closePrice,
    closeReason,
    exitValue,
    exitFee,
    grossPnl,
    totalFees,
    netPnl,
    durationSeconds,
    binancePrice: binancePrice || closePrice,
    closedAt: now,
  };
  
  persistCloseAsync(tradeData, position.id);
  
  // 11. Audit log
  auditLogger.log({
    userId: account.userId,
    accountId: position.accountId,
    action: 'POSITION_CLOSED',
    details: {
      tradeId,
      positionId: position.id,
      symbol: position.symbol,
      side: position.side,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      exitPrice: closePrice,
      grossPnl,
      netPnl,
      closeReason,
      executionTimeMs: executionTime,
    },
    success: true,
  });
  
  // 12. Get updated account
  const updatedAccount = await accountManager.getAccount(position.accountId);
  
  return {
    success: true,
    tradeId,
    grossPnl,
    netPnl,
    exitPrice: closePrice,
    executionTime,
    account: updatedAccount!,
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
    closeRetryQueue.push({
      trade: tradeData,
      retries: 0,
      createdAt: Date.now(),
    });
  });
}

async function persistTradeToDb(data: TradeData): Promise<void> {
  const { tradeId, position, closePrice, closeReason, exitValue, exitFee, grossPnl, totalFees, netPnl, durationSeconds, binancePrice, closedAt } = data;
  
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
    netPnl: netPnl.toString(),
    durationSeconds,
    binancePriceAtEntry: position.entryPrice.toString(), // TODO: Store actual binance price
    binancePriceAtExit: binancePrice.toString(),
    takeProfitWas: position.takeProfit?.toString(),
    stopLossWas: position.stopLoss?.toString(),
  });
}

async function deletePositionFromDb(positionId: string): Promise<void> {
  await db.delete(positions).where(eq(positions.id, positionId));
}

// ===========================================
// BATCH CLOSE (for breach handling)
// ===========================================

/**
 * Close all positions for an account (for breach/liquidation)
 */
export async function closeAllPositionsSync(
  accountId: string,
  closeReason: CloseReason,
  priceEngine: PriceEngine
): Promise<{ closed: number; totalPnl: number }> {
  const positionManager = getPositionManager();
  const accountPositions = positionManager.getByAccount(accountId);
  
  let closed = 0;
  let totalPnl = 0;
  
  for (const position of accountPositions) {
    const price = priceEngine.getPrice(position.symbol);
    if (!price) continue;
    
    const closePrice = position.side === 'LONG' ? price.ourBid : price.ourAsk;
    const result = await closePositionSync(position.id, closePrice, closeReason, price.midPrice);
    
    if (result.success) {
      closed++;
      totalPnl += result.netPnl || 0;
    }
  }
  
  return { closed, totalPnl };
}

/**
 * Get close retry queue stats
 */
export function getCloseRetryQueueStats(): { pending: number } {
  return { pending: closeRetryQueue.length };
}

