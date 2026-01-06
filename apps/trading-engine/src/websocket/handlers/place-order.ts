// ===========================================
// PLACE ORDER HANDLER - Synchronous Execution
// ===========================================
// This handler executes orders SYNCHRONOUSLY in <10ms
// No Redis Streams, no worker polling - direct in-memory execution

import type { ServerWebSocket } from 'bun';
import type { PriceEngine } from '../../price/price-engine.js';
import { rateLimiter, validateOrderTimestamp, auditLogger } from '../../security/rate-limiter.js';
import { executeOrderSync } from '../../engine/order-executor.js';

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
    // 0. Rate limiting check
    const isRateLimited = await rateLimiter.isRateLimited(userId, 'PLACE_ORDER', 10, 1000);
    if (isRateLimited) {
      const remaining = await rateLimiter.getRemainingRequests(userId, 'PLACE_ORDER', 10);
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

function validateOrder(data: OrderRequest): string | null {
  if (!data.accountId) {
    return 'Account ID is required';
  }

  if (!data.symbol || typeof data.symbol !== 'string') {
    return 'Symbol is required';
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

  if (data.type === 'LIMIT' && (!data.limitPrice || data.limitPrice <= 0)) {
    return 'Limit price is required for limit orders';
  }

  if (data.takeProfit !== undefined && (typeof data.takeProfit !== 'number' || data.takeProfit <= 0)) {
    return 'Take profit must be a positive number';
  }

  if (data.stopLoss !== undefined && (typeof data.stopLoss !== 'number' || data.stopLoss <= 0)) {
    return 'Stop loss must be a positive number';
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
