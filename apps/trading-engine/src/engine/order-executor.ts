// ===========================================
// ORDER EXECUTOR - Synchronous Order Execution
// ===========================================
// This module executes orders SYNCHRONOUSLY in <10ms
// Database persistence is done asynchronously (fire-and-forget)

import { db } from '@propfirm/database';
import { positions, orders, tradingAccounts } from '@propfirm/database/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { accountManager, type AccountState } from './account-manager.js';
import { getPositionManager, type Position } from './position-manager.js';
import { 
  calculateMargin, 
  calculateLiquidationPrice,
  type MarginCalculation 
} from './margin-calculator.js';
import type { PriceEngine, PriceData } from '../price/price-engine.js';
import { auditLogger } from '../security/rate-limiter.js';

// ===========================================
// TYPES
// ===========================================

export interface OrderRequest {
  clientOrderId?: string;
  userId: string;
  accountId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  leverage?: number; // User's selected leverage (1-maxLeverage)
  limitPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  timestamp: number;
  // Pre-fetched price (optional, for validation)
  lockedPrice?: number;
  binancePrice?: number;
}

export interface ExecutionResult {
  success: boolean;
  error?: string;
  orderId?: string;
  position?: Position;
  account?: AccountState;
  marginCalc?: MarginCalculation;
  executionPrice?: number;
  executionTime?: number;
}

// ===========================================
// RETRY QUEUE FOR FAILED DB PERSISTS
// ===========================================

interface PersistTask {
  type: 'ORDER' | 'POSITION';
  data: unknown;
  retries: number;
  createdAt: number;
}

const persistRetryQueue: PersistTask[] = [];
const MAX_RETRIES = 3;
const MAX_QUEUE_SIZE = 100; // Prevent unbounded memory growth
let consecutiveFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 10; // Trip after 10 consecutive failures

// Store interval reference for cleanup
let retryQueueInterval: NodeJS.Timeout | null = null;

// Process retry queue every 10 seconds
retryQueueInterval = setInterval(() => processRetryQueue(), 10000);

async function processRetryQueue(): Promise<void> {
  if (persistRetryQueue.length === 0) {
    // Reset circuit breaker on empty queue
    consecutiveFailures = 0;
    return;
  }

  // Circuit breaker: if too many failures, wait longer
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    console.warn(`[OrderExecutor] Circuit breaker active: ${consecutiveFailures} consecutive failures, queue size: ${persistRetryQueue.length}`);
    // Only process 1 item to test if DB is back
    const testTask = persistRetryQueue[0];
    try {
      if (testTask.type === 'ORDER') {
        await persistOrderToDb(testTask.data as PersistOrderData);
      } else if (testTask.type === 'POSITION') {
        await persistPositionToDb(testTask.data as PersistPositionData);
      }
      // Success - reset circuit breaker
      persistRetryQueue.shift();
      consecutiveFailures = 0;
      console.log('[OrderExecutor] Circuit breaker reset - DB connection restored');
    } catch {
      // Still failing - keep circuit breaker active
    }
    return;
  }

  const tasks = persistRetryQueue.splice(0, 10); // Process up to 10 at a time
  let failedThisBatch = 0;

  for (const task of tasks) {
    try {
      if (task.type === 'ORDER') {
        await persistOrderToDb(task.data as PersistOrderData);
      } else if (task.type === 'POSITION') {
        await persistPositionToDb(task.data as PersistPositionData);
      }
      consecutiveFailures = 0; // Reset on success
    } catch (error) {
      failedThisBatch++;
      consecutiveFailures++;

      if (task.retries < MAX_RETRIES) {
        task.retries++;
        // Only re-queue if under max size
        if (persistRetryQueue.length < MAX_QUEUE_SIZE) {
          persistRetryQueue.push(task);
        } else {
          console.error(`[OrderExecutor] CRITICAL: Dropping persist task - queue at max size (${MAX_QUEUE_SIZE})`);
        }
      } else {
        console.error(`[OrderExecutor] Giving up on persist task after ${MAX_RETRIES} retries:`, error);
      }
    }
  }

  // Alert if queue is getting large
  if (persistRetryQueue.length > MAX_QUEUE_SIZE * 0.8) {
    console.warn(`[OrderExecutor] WARNING: Retry queue at ${persistRetryQueue.length}/${MAX_QUEUE_SIZE} capacity`);
  }
}

// ===========================================
// MAIN EXECUTION FUNCTION
// ===========================================

/**
 * Execute an order synchronously
 * Target: <10ms execution time
 */
export async function executeOrderSync(
  order: OrderRequest,
  priceEngine: PriceEngine
): Promise<ExecutionResult> {
  const startTime = Date.now();
  
  try {
    // 1. Get price (should already be in memory)
    const price = priceEngine.getPrice(order.symbol);
    if (!price) {
      return { success: false, error: `No price data for ${order.symbol}` };
    }
    
    // 2. Check price staleness (5 second max)
    if (Date.now() - price.timestamp > 5000) {
      return { success: false, error: 'Price data is stale' };
    }
    
    // 3. Get execution price
    const executionPrice = order.side === 'LONG' ? price.ourAsk : price.ourBid;
    
    // 4. Validate limit price if provided
    if (order.type === 'LIMIT' && order.limitPrice) {
      if (order.side === 'LONG' && executionPrice > order.limitPrice) {
        return { success: false, error: 'Limit price not met' };
      }
      if (order.side === 'SHORT' && executionPrice < order.limitPrice) {
        return { success: false, error: 'Limit price not met' };
      }
    }
    
    // 5. Execute with account lock (in-memory, fast)
    const result = await accountManager.withLock(order.accountId, async () => {
      return executeWithLock(order, price, executionPrice, startTime);
    }, 50); // 50ms max wait for lock
    
    if (result === null) {
      return { success: false, error: 'Account busy, please retry' };
    }
    
    return result;
    
  } catch (error) {
    console.error('[OrderExecutor] Execution error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal error' 
    };
  }
}

/**
 * Execute order while holding account lock
 */
async function executeWithLock(
  order: OrderRequest,
  price: PriceData,
  executionPrice: number,
  startTime: number
): Promise<ExecutionResult> {
  // 1. Get account state (from cache or load)
  const account = await accountManager.getAccount(order.accountId);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }
  
  // 2. Validate account status
  if (account.status !== 'active' && account.status !== 'step1_passed') {
    return { success: false, error: `Account not active: ${account.status}` };
  }
  
  // 3. Validate user ownership
  if (account.userId !== order.userId) {
    return { success: false, error: 'Account does not belong to user' };
  }
  
  // 4. Calculate margin requirements
  const marginCalc = calculateMargin(
    order.symbol,
    order.quantity,
    executionPrice,
    {
      btcEthMaxLeverage: account.btcEthMaxLeverage,
      altcoinMaxLeverage: account.altcoinMaxLeverage,
    },
    order.leverage // Pass user's selected leverage
  );
  
  // 5. Check available margin
  const totalRequired = marginCalc.marginRequired + marginCalc.entryFee;
  if (totalRequired > account.availableMargin) {
    return { 
      success: false, 
      error: `Insufficient margin: need ${totalRequired.toFixed(2)}, have ${account.availableMargin.toFixed(2)}` 
    };
  }
  
  // 6. Calculate liquidation price for this position
  const liquidationPrice = calculateLiquidationPrice(
    order.side,
    executionPrice,
    marginCalc.maxLeverage
  );
  
  // 7. Create position object
  const positionId = uuidv4();
  const orderId = uuidv4();
  const now = new Date();
  
  const position: Position = {
    id: positionId,
    accountId: order.accountId,
    symbol: order.symbol,
    side: order.side,
    quantity: order.quantity,
    leverage: marginCalc.maxLeverage,
    entryPrice: executionPrice,
    entryValue: marginCalc.notionalValue,
    marginUsed: marginCalc.marginRequired,
    entryFee: marginCalc.entryFee,
    accumulatedFunding: 0,
    lastFundingAt: null,
    takeProfit: order.takeProfit || null,
    stopLoss: order.stopLoss || null,
    liquidationPrice,
    currentPrice: executionPrice,
    unrealizedPnl: 0,
    openedAt: now,
  };
  
  // 8. Update account state IN MEMORY
  const newAvailableMargin = account.availableMargin - totalRequired;
  const newTotalMarginUsed = account.totalMarginUsed + marginCalc.marginRequired;
  const newCurrentBalance = account.currentBalance - marginCalc.entryFee;
  
  accountManager.updateAccount(order.accountId, {
    availableMargin: newAvailableMargin,
    totalMarginUsed: newTotalMarginUsed,
    currentBalance: newCurrentBalance,
    totalTrades: account.totalTrades + 1,
    lastTradeAt: now,
    totalVolume: account.totalVolume + marginCalc.notionalValue,
  });
  
  // 9. Add position to PositionManager (in-memory)
  const positionManager = getPositionManager();
  positionManager.addPosition(position);
  
  // 10. Calculate execution time
  const executionTime = Date.now() - startTime;
  
  // 11. Log the execution
  console.log(
    `[OrderExecutor] Order executed in ${executionTime}ms: ` +
    `${order.symbol} ${order.side} ${order.quantity} @ ${executionPrice.toFixed(2)}`
  );
  
  // 12. Persist to database ASYNCHRONOUSLY (fire-and-forget)
  persistOrderAsync(orderId, order, position, account, marginCalc, executionPrice, now);
  
  // 13. Audit log
  auditLogger.log({
    userId: order.userId,
    accountId: order.accountId,
    action: 'ORDER_EXECUTED',
    details: {
      orderId,
      positionId,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      executionPrice,
      marginUsed: marginCalc.marginRequired,
      executionTimeMs: executionTime,
    },
    success: true,
  });
  
  // 14. Return updated account state
  const updatedAccount = await accountManager.getAccount(order.accountId);
  
  return {
    success: true,
    orderId,
    position,
    account: updatedAccount!,
    marginCalc,
    executionPrice,
    executionTime,
  };
}

// ===========================================
// ASYNC DATABASE PERSISTENCE
// ===========================================

interface PersistOrderData {
  orderId: string;
  order: OrderRequest;
  position: Position;
  executionPrice: number;
  now: Date;
}

interface PersistPositionData {
  position: Position;
  binancePrice: number;
}

/**
 * Persist order and position to database (non-blocking)
 */
function persistOrderAsync(
  orderId: string,
  order: OrderRequest,
  position: Position,
  account: AccountState,
  marginCalc: MarginCalculation,
  executionPrice: number,
  now: Date
): void {
  // Fire and forget - don't await
  Promise.all([
    // Persist order
    persistOrderToDb({
      orderId,
      order,
      position,
      executionPrice,
      now,
    }),
    // Persist position
    persistPositionToDb({
      position,
      binancePrice: order.binancePrice || executionPrice,
    }),
  ]).catch(error => {
    console.error('[OrderExecutor] Async persist failed:', error);
    // Add to retry queue only if under max size
    if (persistRetryQueue.length < MAX_QUEUE_SIZE - 1) {
      persistRetryQueue.push({
        type: 'ORDER',
        data: { orderId, order, position, executionPrice, now },
        retries: 0,
        createdAt: Date.now(),
      });
      persistRetryQueue.push({
        type: 'POSITION',
        data: { position, binancePrice: order.binancePrice || executionPrice },
        retries: 0,
        createdAt: Date.now(),
      });
    } else {
      console.error(`[OrderExecutor] CRITICAL: Cannot queue persist - queue full (${persistRetryQueue.length}/${MAX_QUEUE_SIZE})`);
    }
  });
}

async function persistOrderToDb(data: PersistOrderData): Promise<void> {
  const { orderId, order, position, executionPrice, now } = data;
  
  await db.insert(orders).values({
    id: orderId,
    accountId: order.accountId,
    symbol: order.symbol,
    side: order.side,
    orderType: order.type,
    quantity: order.quantity.toString(),
    limitPrice: order.limitPrice?.toString(),
    takeProfit: order.takeProfit?.toString(),
    stopLoss: order.stopLoss?.toString(),
    status: 'filled',
    filledAt: now,
    filledPrice: executionPrice.toString(),
    positionId: position.id,
    clientOrderId: order.clientOrderId,
    createdAt: now,
  });
}

async function persistPositionToDb(data: PersistPositionData): Promise<void> {
  const { position, binancePrice } = data;
  
  await db.insert(positions).values({
    id: position.id,
    accountId: position.accountId,
    symbol: position.symbol,
    side: position.side,
    quantity: position.quantity.toString(),
    leverage: position.leverage,
    entryPrice: position.entryPrice.toString(),
    entryValue: position.entryValue.toString(),
    marginUsed: position.marginUsed.toString(),
    entryFee: position.entryFee.toString(),
    takeProfit: position.takeProfit?.toString(),
    stopLoss: position.stopLoss?.toString(),
    liquidationPrice: position.liquidationPrice.toString(),
    currentPrice: position.currentPrice.toString(),
    unrealizedPnl: '0',
    openedAt: position.openedAt,
    binancePriceAtEntry: binancePrice.toString(),
    priceSource: 'binance',
  });
}

// ===========================================
// CACHE MANAGEMENT
// ===========================================

/**
 * Invalidate account cache (call after position close, etc.)
 */
export function invalidateAccountCache(accountId: string): void {
  accountManager.invalidate(accountId);
}

/**
 * Update account cache directly (for P&L updates, etc.)
 */
export function updateAccountCache(
  accountId: string, 
  updates: Partial<AccountState>
): void {
  accountManager.updateAccount(accountId, updates);
}

/**
 * Get retry queue stats
 */
export function getRetryQueueStats(): {
  pending: number;
  maxSize: number;
  circuitBreakerActive: boolean;
  consecutiveFailures: number;
} {
  return {
    pending: persistRetryQueue.length,
    maxSize: MAX_QUEUE_SIZE,
    circuitBreakerActive: consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD,
    consecutiveFailures,
  };
}

/**
 * Shutdown the order executor (clear intervals, flush queue)
 */
export async function shutdownOrderExecutor(): Promise<void> {
  // Clear the retry queue interval
  if (retryQueueInterval) {
    clearInterval(retryQueueInterval);
    retryQueueInterval = null;
  }

  // Try to process remaining items in queue
  if (persistRetryQueue.length > 0) {
    console.log(`[OrderExecutor] Shutting down with ${persistRetryQueue.length} items in retry queue...`);
    // Try one final flush
    try {
      await processRetryQueue();
    } catch (error) {
      console.error('[OrderExecutor] Final flush failed:', error);
    }
  }

  console.log('[OrderExecutor] Shutdown complete');
}

