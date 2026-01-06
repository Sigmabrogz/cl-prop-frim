// ===========================================
// PLACE ORDER HANDLER - Synchronous Execution
// ===========================================
// This handler executes orders SYNCHRONOUSLY in <10ms
// Limit orders that can't fill immediately are queued

import type { ServerWebSocket } from 'bun';
import type { PriceEngine } from '../../price/price-engine.js';
import { rateLimiter, validateOrderTimestamp, auditLogger } from '../../security/rate-limiter.js';
import { executeOrderSync } from '../../engine/order-executor.js';
import { getOrderManager } from '../../engine/order-manager.js';
import { accountManager } from '../../engine/account-manager.js';
import { calculateMargin } from '../../engine/margin-calculator.js';

// ===========================================
// TYPES
// ===========================================

export interface OrderRequest {
  clientOrderId?: string;
  accountId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  leverage?: number; // User's selected leverage (1-maxLeverage)
  limitPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  timestamp?: number; // Client-side timestamp for validation
}

// ===========================================
// HANDLER
// ===========================================

export async function handlePlaceOrder(
  ws: ServerWebSocket<any>,
  data: OrderRequest,
  priceEngine: PriceEngine
): Promise<void> {
  const startTime = Date.now();
  const userId = ws.data.userId;
  const connectionId = ws.data.connectionId;
  const clientOrderId = data.clientOrderId || crypto.randomUUID();

  // Log the order attempt for audit
  auditLogger.log({
    userId,
    connectionId,
    action: 'PLACE_ORDER_ATTEMPT',
    details: {
      clientOrderId,
      accountId: data.accountId,
      symbol: data.symbol,
      side: data.side,
      type: data.type,
      quantity: data.quantity,
    },
    success: true,
  });

  try {
    // 0. Rate limiting check (synchronous - uses local fallback with async Redis update)
    const isRateLimited = rateLimiter.isRateLimited(userId, 'PLACE_ORDER');
    if (isRateLimited) {
      const remaining = rateLimiter.getRemainingRequests(userId, 'PLACE_ORDER');
      ws.send(
        JSON.stringify({
          type: 'ORDER_REJECTED',
          clientOrderId,
          reason: `Rate limit exceeded. ${remaining} requests remaining.`,
          code: 'RATE_LIMITED',
        })
      );
      console.log(`[PlaceOrder] Rate limited: ${userId}`);
      return;
    }

    // 0.5. Timestamp validation (prevent replay attacks)
    const timestampError = validateOrderTimestamp(data.timestamp);
    if (timestampError) {
      ws.send(
        JSON.stringify({
          type: 'ORDER_REJECTED',
          clientOrderId,
          reason: timestampError,
          code: 'TIMESTAMP_INVALID',
        })
      );
      console.log(`[PlaceOrder] Timestamp invalid: ${timestampError}`);
      return;
    }

    // 1. Validate order data
    const validationError = validateOrder(data);
    if (validationError) {
      ws.send(
        JSON.stringify({
          type: 'ORDER_REJECTED',
          clientOrderId,
          reason: validationError,
        })
      );
      return;
    }

    // 2. Get current price and lock it
    const price = priceEngine.getPrice(data.symbol);
    if (!price) {
      ws.send(
        JSON.stringify({
          type: 'ORDER_REJECTED',
          clientOrderId,
          reason: `No price available for ${data.symbol}`,
        })
      );
      return;
    }

    // 3. Check if price is stale (>5 seconds old)
    if (priceEngine.isPriceStale(data.symbol, 5000)) {
      ws.send(
        JSON.stringify({
          type: 'ORDER_REJECTED',
          clientOrderId,
          reason: 'Price data is stale. Please try again.',
        })
      );
      return;
    }

    // 4. Lock execution price (prevent slippage exploitation)
    const lockedPrice = data.side === 'LONG' ? price.ourAsk : price.ourBid;

    // 5. Validate TP/SL against entry price
    if (data.takeProfit) {
      const tpError = validateTakeProfit(data.side, lockedPrice, data.takeProfit);
      if (tpError) {
        ws.send(
          JSON.stringify({
            type: 'ORDER_REJECTED',
            clientOrderId,
            reason: tpError,
          })
        );
        return;
      }
    }

    if (data.stopLoss) {
      const slError = validateStopLoss(data.side, lockedPrice, data.stopLoss);
      if (slError) {
        ws.send(
          JSON.stringify({
            type: 'ORDER_REJECTED',
            clientOrderId,
            reason: slError,
          })
        );
        return;
      }
    }

    // 5.5 Check if limit order can fill immediately
    if (data.type === 'LIMIT' && data.limitPrice) {
      const canFillNow =
        (data.side === 'LONG' && lockedPrice <= data.limitPrice) ||
        (data.side === 'SHORT' && lockedPrice >= data.limitPrice);

      if (!canFillNow) {
        // Queue the limit order instead of rejecting
        await queueLimitOrder(ws, {
          clientOrderId,
          userId,
          accountId: data.accountId,
          symbol: data.symbol,
          side: data.side,
          quantity: data.quantity,
          leverage: data.leverage,
          limitPrice: data.limitPrice,
          takeProfit: data.takeProfit,
          stopLoss: data.stopLoss,
        }, price);
        return;
      }
    }

    // 6. EXECUTE ORDER SYNCHRONOUSLY (<10ms target)
    const result = await executeOrderSync(
      {
        clientOrderId,
        userId,
        accountId: data.accountId,
        symbol: data.symbol,
        side: data.side,
        type: data.type,
        quantity: data.quantity,
        leverage: data.leverage, // Pass user's selected leverage
        limitPrice: data.limitPrice,
        takeProfit: data.takeProfit,
        stopLoss: data.stopLoss,
        timestamp: data.timestamp || Date.now(),
        lockedPrice,
        binancePrice: price.midPrice,
      },
      priceEngine
    );

    const totalTime = Date.now() - startTime;

    // 7. Send response based on result
    if (!result.success) {
      ws.send(
        JSON.stringify({
          type: 'ORDER_REJECTED',
          clientOrderId,
          reason: result.error,
        })
      );
      console.log(
        `[PlaceOrder] Order rejected in ${totalTime}ms: ${result.error}`
      );
      return;
    }

    // 8. Send ORDER_FILLED immediately (not ORDER_RECEIVED!)
    ws.send(
      JSON.stringify({
        type: 'ORDER_FILLED',
        clientOrderId,
        orderId: result.orderId,
        position: result.position,
        account: {
          id: result.account?.id,
          currentBalance: result.account?.currentBalance,
          availableMargin: result.account?.availableMargin,
          totalMarginUsed: result.account?.totalMarginUsed,
          dailyPnl: result.account?.dailyPnl,
        },
        executionPrice: result.executionPrice,
        executionTime: totalTime,
        marginUsed: result.marginCalc?.marginRequired,
        entryFee: result.marginCalc?.entryFee,
      })
    );

    console.log(
      `[PlaceOrder] Order FILLED in ${totalTime}ms: ` +
      `${data.symbol} ${data.side} ${data.quantity} @ ${result.executionPrice?.toFixed(2)}`
    );

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[PlaceOrder] Error after ${totalTime}ms:`, error);
    ws.send(
      JSON.stringify({
        type: 'ORDER_REJECTED',
        clientOrderId,
        reason: 'Internal error processing order',
      })
    );
  }
}

// ===========================================
// VALIDATION FUNCTIONS
// ===========================================

// Supported trading symbols
const TRADEABLE_SYMBOLS = new Set([
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT'
]);

// Quantity limits per symbol category
const QUANTITY_LIMITS = {
  BTC: { min: 0.0001, max: 100 },      // BTC: 0.0001 - 100
  ETH: { min: 0.001, max: 1000 },       // ETH: 0.001 - 1000
  DEFAULT: { min: 0.01, max: 100000 }   // Others: 0.01 - 100000
};

// Max leverage limits
const MAX_LEVERAGE_LIMITS = {
  BTC_ETH: 100,
  ALTCOIN: 50
};

function validateOrder(data: OrderRequest): string | null {
  if (!data.accountId) {
    return 'Account ID is required';
  }

  if (!data.symbol || typeof data.symbol !== 'string') {
    return 'Symbol is required';
  }

  // Check if symbol is tradeable
  if (!TRADEABLE_SYMBOLS.has(data.symbol)) {
    return `Symbol ${data.symbol} is not available for trading`;
  }

  if (!['LONG', 'SHORT'].includes(data.side)) {
    return 'Side must be LONG or SHORT';
  }

  if (!['MARKET', 'LIMIT'].includes(data.type)) {
    return 'Type must be MARKET or LIMIT';
  }

  if (typeof data.quantity !== 'number' || data.quantity <= 0) {
    return 'Quantity must be a positive number';
  }

  // Check for NaN/Infinity
  if (!isFinite(data.quantity)) {
    return 'Quantity must be a finite number';
  }

  // Get quantity limits based on symbol
  const limits = data.symbol.includes('BTC')
    ? QUANTITY_LIMITS.BTC
    : data.symbol.includes('ETH')
      ? QUANTITY_LIMITS.ETH
      : QUANTITY_LIMITS.DEFAULT;

  if (data.quantity < limits.min) {
    return `Minimum quantity for ${data.symbol} is ${limits.min}`;
  }

  if (data.quantity > limits.max) {
    return `Maximum quantity for ${data.symbol} is ${limits.max}`;
  }

  // Validate leverage if provided
  if (data.leverage !== undefined) {
    if (typeof data.leverage !== 'number' || !isFinite(data.leverage)) {
      return 'Leverage must be a finite number';
    }

    if (data.leverage < 1) {
      return 'Leverage must be at least 1x';
    }

    // Check max leverage based on symbol
    const maxLeverage = (data.symbol.includes('BTC') || data.symbol.includes('ETH'))
      ? MAX_LEVERAGE_LIMITS.BTC_ETH
      : MAX_LEVERAGE_LIMITS.ALTCOIN;

    if (data.leverage > maxLeverage) {
      return `Maximum leverage for ${data.symbol} is ${maxLeverage}x`;
    }
  }

  if (data.type === 'LIMIT' && (!data.limitPrice || data.limitPrice <= 0)) {
    return 'Limit price is required for limit orders';
  }

  // Validate limit price is finite
  if (data.limitPrice !== undefined && !isFinite(data.limitPrice)) {
    return 'Limit price must be a finite number';
  }

  if (data.takeProfit !== undefined && (typeof data.takeProfit !== 'number' || data.takeProfit <= 0)) {
    return 'Take profit must be a positive number';
  }

  // Check for NaN/Infinity in TP
  if (data.takeProfit !== undefined && !isFinite(data.takeProfit)) {
    return 'Take profit must be a finite number';
  }

  if (data.stopLoss !== undefined && (typeof data.stopLoss !== 'number' || data.stopLoss <= 0)) {
    return 'Stop loss must be a positive number';
  }

  // Check for NaN/Infinity in SL
  if (data.stopLoss !== undefined && !isFinite(data.stopLoss)) {
    return 'Stop loss must be a finite number';
  }

  return null;
}

function validateTakeProfit(side: 'LONG' | 'SHORT', entryPrice: number, tp: number): string | null {
  if (side === 'LONG') {
    // For LONG, TP must be above entry price
    if (tp <= entryPrice) {
      return 'Take profit must be above entry price for LONG positions';
    }
  } else {
    // For SHORT, TP must be below entry price
    if (tp >= entryPrice) {
      return 'Take profit must be below entry price for SHORT positions';
    }
  }
  return null;
}

function validateStopLoss(side: 'LONG' | 'SHORT', entryPrice: number, sl: number): string | null {
  if (side === 'LONG') {
    // For LONG, SL must be below entry price
    if (sl >= entryPrice) {
      return 'Stop loss must be below entry price for LONG positions';
    }
  } else {
    // For SHORT, SL must be above entry price
    if (sl <= entryPrice) {
      return 'Stop loss must be above entry price for SHORT positions';
    }
  }
  return null;
}

// ===========================================
// LIMIT ORDER QUEUE FUNCTIONS
// ===========================================

interface QueueOrderParams {
  clientOrderId: string;
  userId: string;
  accountId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  leverage?: number;
  limitPrice: number;
  takeProfit?: number;
  stopLoss?: number;
}

async function queueLimitOrder(
  ws: ServerWebSocket<any>,
  params: QueueOrderParams,
  price: { ourAsk: number; ourBid: number }
): Promise<void> {
  const orderManager = getOrderManager();

  try {
    // Get account to check margin and reserve it
    const account = await accountManager.getAccount(params.accountId);
    if (!account) {
      ws.send(JSON.stringify({
        type: 'ORDER_REJECTED',
        clientOrderId: params.clientOrderId,
        reason: 'Account not found',
      }));
      return;
    }

    // Calculate margin required
    const leverage = params.leverage || (
      params.symbol.includes('BTC') || params.symbol.includes('ETH')
        ? account.btcEthMaxLeverage
        : account.altcoinMaxLeverage
    );

    const marginCalc = calculateMargin(
      params.symbol,
      params.quantity,
      params.limitPrice,
      {
        btcEthMaxLeverage: account.btcEthMaxLeverage,
        altcoinMaxLeverage: account.altcoinMaxLeverage,
      },
      leverage
    );

    const marginRequired = marginCalc.marginRequired + marginCalc.entryFee;

    // Check if enough margin available
    if (marginRequired > account.availableMargin) {
      ws.send(JSON.stringify({
        type: 'ORDER_REJECTED',
        clientOrderId: params.clientOrderId,
        reason: `Insufficient margin: need ${marginRequired.toFixed(2)}, have ${account.availableMargin.toFixed(2)}`,
      }));
      return;
    }

    // Reserve margin for this order
    await accountManager.withLock(params.accountId, async () => {
      accountManager.updateAccount(params.accountId, {
        availableMargin: account.availableMargin - marginRequired,
      });
      return true;
    }, 50);

    // Add order to queue
    const pendingOrder = orderManager.addOrder({
      clientOrderId: params.clientOrderId,
      userId: params.userId,
      accountId: params.accountId,
      symbol: params.symbol,
      side: params.side,
      type: 'LIMIT',
      quantity: params.quantity,
      leverage,
      limitPrice: params.limitPrice,
      takeProfit: params.takeProfit,
      stopLoss: params.stopLoss,
      marginReserved: marginRequired,
    });

    // Send ORDER_PENDING response
    ws.send(JSON.stringify({
      type: 'ORDER_PENDING',
      clientOrderId: params.clientOrderId,
      orderId: pendingOrder.id,
      symbol: params.symbol,
      side: params.side,
      quantity: params.quantity,
      limitPrice: params.limitPrice,
      marginReserved: marginRequired,
      currentPrice: params.side === 'LONG' ? price.ourAsk : price.ourBid,
    }));

    console.log(
      `[PlaceOrder] Limit order QUEUED: ${params.symbol} ${params.side} ` +
      `${params.quantity} @ ${params.limitPrice} (current: ${params.side === 'LONG' ? price.ourAsk : price.ourBid})`
    );

  } catch (error) {
    console.error('[PlaceOrder] Queue error:', error);
    ws.send(JSON.stringify({
      type: 'ORDER_REJECTED',
      clientOrderId: params.clientOrderId,
      reason: 'Failed to queue order',
    }));
  }
}

/**
 * Handle cancel order request
 */
export async function handleCancelOrder(
  ws: ServerWebSocket<any>,
  orderId: string
): Promise<void> {
  const userId = ws.data.userId;
  const orderManager = getOrderManager();

  const order = orderManager.getOrder(orderId);
  if (!order) {
    ws.send(JSON.stringify({
      type: 'CANCEL_REJECTED',
      orderId,
      reason: 'Order not found',
    }));
    return;
  }

  // Verify ownership
  if (order.userId !== userId) {
    ws.send(JSON.stringify({
      type: 'CANCEL_REJECTED',
      orderId,
      reason: 'Order does not belong to user',
    }));
    return;
  }

  // Cancel the order
  const cancelled = orderManager.cancelOrder(orderId);
  if (!cancelled) {
    ws.send(JSON.stringify({
      type: 'CANCEL_REJECTED',
      orderId,
      reason: 'Order cannot be cancelled (may already be filled)',
    }));
    return;
  }

  // Release reserved margin
  await accountManager.withLock(cancelled.accountId, async () => {
    const account = await accountManager.getAccount(cancelled.accountId);
    if (account) {
      accountManager.updateAccount(cancelled.accountId, {
        availableMargin: account.availableMargin + cancelled.marginReserved,
      });
    }
    return true;
  }, 50);

  ws.send(JSON.stringify({
    type: 'ORDER_CANCELLED',
    orderId,
    marginReleased: cancelled.marginReserved,
  }));

  console.log(`[PlaceOrder] Order cancelled: ${orderId}`);
}

/**
 * Handle get pending orders request
 */
export function handleGetPendingOrders(
  ws: ServerWebSocket<any>,
  accountId: string
): void {
  const userId = ws.data.userId;
  const orderManager = getOrderManager();

  const orders = orderManager.getAccountOrders(accountId);

  // Filter to only user's orders
  const userOrders = orders.filter(o => o.userId === userId);

  ws.send(JSON.stringify({
    type: 'PENDING_ORDERS',
    accountId,
    orders: userOrders.map(o => ({
      id: o.id,
      clientOrderId: o.clientOrderId,
      symbol: o.symbol,
      side: o.side,
      quantity: o.quantity,
      limitPrice: o.limitPrice,
      leverage: o.leverage,
      takeProfit: o.takeProfit,
      stopLoss: o.stopLoss,
      marginReserved: o.marginReserved,
      createdAt: o.createdAt.toISOString(),
    })),
  }));
}
