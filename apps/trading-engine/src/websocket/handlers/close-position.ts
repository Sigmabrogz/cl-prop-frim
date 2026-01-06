// ===========================================
// CLOSE POSITION HANDLER - Synchronous Execution
// ===========================================
// This handler closes positions SYNCHRONOUSLY in <10ms
// No Redis Streams - direct in-memory execution

import type { ServerWebSocket } from 'bun';
import type { PriceEngine } from '../../price/price-engine.js';
import { getPositionManager } from '../../engine/position-manager.js';
import { rateLimiter, auditLogger } from '../../security/rate-limiter.js';
import { closePositionSync } from '../../engine/close-executor.js';

/**
 * Handle manual position close request
 * @param quantity - Optional: partial close quantity (if not provided, closes entire position)
 */
export async function handleClosePosition(
  ws: ServerWebSocket<any>,
  positionId: string,
  priceEngine: PriceEngine,
  quantity?: number
): Promise<void> {
  const startTime = Date.now();
  const userId = ws.data.userId;
  const connectionId = ws.data.connectionId;

  // Log the close attempt for audit
  auditLogger.log({
    userId,
    connectionId,
    action: 'CLOSE_POSITION_ATTEMPT',
    details: { positionId },
    success: true,
  });

  try {
    // 0. Rate limiting check (synchronous - uses local fallback with async Redis update)
    const isRateLimited = rateLimiter.isRateLimited(userId, 'CLOSE_POSITION');
    if (isRateLimited) {
      const remaining = rateLimiter.getRemainingRequests(userId, 'CLOSE_POSITION');
      ws.send(
        JSON.stringify({
          type: 'CLOSE_REJECTED',
          positionId,
          reason: `Rate limit exceeded. ${remaining} requests remaining.`,
          code: 'RATE_LIMITED',
        })
      );
      console.log(`[ClosePosition] Rate limited: ${userId}`);
      return;
    }

    // 1. Validate position exists
    const positionManager = getPositionManager();
    const position = positionManager.getPosition(positionId);

    if (!position) {
      ws.send(
        JSON.stringify({
          type: 'CLOSE_REJECTED',
          positionId,
          reason: 'Position not found',
        })
      );
      return;
    }

    // 1.5 Validate partial close quantity
    const closeQuantity = quantity && quantity > 0 && quantity < position.quantity
      ? quantity
      : position.quantity; // Full close if not specified or invalid

    if (quantity && quantity > position.quantity) {
      ws.send(
        JSON.stringify({
          type: 'CLOSE_REJECTED',
          positionId,
          reason: `Close quantity (${quantity}) exceeds position size (${position.quantity})`,
        })
      );
      return;
    }

    // 2. Get current price
    const price = priceEngine.getPrice(position.symbol);
    if (!price) {
      ws.send(
        JSON.stringify({
          type: 'CLOSE_REJECTED',
          positionId,
          reason: `No price available for ${position.symbol}`,
        })
      );
      return;
    }

    // 3. Check if price is stale
    if (priceEngine.isPriceStale(position.symbol, 5000)) {
      ws.send(
        JSON.stringify({
          type: 'CLOSE_REJECTED',
          positionId,
          reason: 'Price data is stale. Please try again.',
        })
      );
      return;
    }

    // 4. Lock exit price
    const exitPrice = position.side === 'LONG' ? price.ourBid : price.ourAsk;

    // 5. EXECUTE CLOSE SYNCHRONOUSLY (<10ms target)
    const isPartialClose = closeQuantity < position.quantity;
    const result = await closePositionSync(
      positionId,
      exitPrice,
      'MANUAL',
      price.midPrice,
      closeQuantity // Pass the quantity for partial close
    );

    const totalTime = Date.now() - startTime;

    // 6. Send response based on result
    if (!result.success) {
      ws.send(
        JSON.stringify({
          type: 'CLOSE_REJECTED',
          positionId,
          reason: result.error,
        })
      );
      console.log(
        `[ClosePosition] Close rejected in ${totalTime}ms: ${result.error}`
      );
      return;
    }

    // 7. Send response based on partial/full close
    const responseType = isPartialClose ? 'POSITION_PARTIALLY_CLOSED' : 'POSITION_CLOSED';
    ws.send(
      JSON.stringify({
        type: responseType,
        positionId,
        tradeId: result.tradeId,
        exitPrice: result.exitPrice,
        closedQuantity: closeQuantity,
        remainingQuantity: isPartialClose ? position.quantity - closeQuantity : 0,
        grossPnl: result.grossPnl,
        netPnl: result.netPnl,
        executionTime: totalTime,
        updatedPosition: result.updatedPosition, // For partial close
        account: {
          id: result.account?.id,
          currentBalance: result.account?.currentBalance,
          availableMargin: result.account?.availableMargin,
          totalMarginUsed: result.account?.totalMarginUsed,
          dailyPnl: result.account?.dailyPnl,
        },
      })
    );

    console.log(
      `[ClosePosition] Position ${isPartialClose ? 'PARTIALLY ' : ''}CLOSED in ${totalTime}ms: ` +
      `${position.symbol} ${position.side} ${closeQuantity}/${position.quantity} @ ${exitPrice.toFixed(2)} | ` +
      `P&L: ${result.netPnl?.toFixed(2)}`
    );

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[ClosePosition] Error after ${totalTime}ms:`, error);
    ws.send(
      JSON.stringify({
        type: 'CLOSE_REJECTED',
        positionId,
        reason: 'Internal error processing close request',
      })
    );
  }
}
