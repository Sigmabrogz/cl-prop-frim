// ===========================================
// ORDER WORKER - Processes orders from queue
// ===========================================

import { db } from '@propfirm/database';
import {
  positions,
  tradingAccounts,
  evaluationPlans,
  orders,
  tradeEvents,
} from '@propfirm/database/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
  readFromStream,
  acknowledgeMessage,
  createConsumerGroup,
  STREAMS,
  CONSUMER_GROUPS,
  withAccountLock,
} from '@propfirm/redis';
import type { PriceEngine } from '../price/price-engine.js';
import type { WebSocketServer } from '../websocket/server.js';
import { getPositionManager } from '../engine/position-manager.js';
import { calculateMargin, calculateLiquidationPrice } from '../engine/margin-calculator.js';
import { createHash } from 'crypto';

// ===========================================
// TYPES
// ===========================================

interface PendingOrder {
  orderId: string;
  clientOrderId: string;
  userId: string;
  accountId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  type: 'MARKET' | 'LIMIT';
  quantity: string;
  limitPrice: string;
  takeProfit: string;
  stopLoss: string;
  lockedPrice: string;
  binancePrice: string;
  lockedAt: string;
  connectionId: string;
}

// ===========================================
// ORDER WORKER CLASS
// ===========================================

export class OrderWorker {
  private priceEngine: PriceEngine;
  private wsServer: WebSocketServer;
  private isRunning = false;
  private consumerName: string;

  constructor(priceEngine: PriceEngine, wsServer: WebSocketServer) {
    this.priceEngine = priceEngine;
    this.wsServer = wsServer;
    this.consumerName = `order-worker-${process.pid}`;
  }

  /**
   * Start processing orders
   */
  async start(): Promise<void> {
    this.isRunning = true;

    // Ensure consumer group exists
    await createConsumerGroup(STREAMS.ORDERS_PENDING, CONSUMER_GROUPS.ORDER_PROCESSOR);

    console.log(`[OrderWorker] Started (consumer: ${this.consumerName})`);

    // Process loop
    while (this.isRunning) {
      try {
        const messages = await readFromStream(
          STREAMS.ORDERS_PENDING,
          CONSUMER_GROUPS.ORDER_PROCESSOR,
          this.consumerName,
          10, // Process 10 at a time
          5000 // Block for 5 seconds
        );

        for (const message of messages) {
          await this.processOrder(message.id, message.data as unknown as PendingOrder);
        }
      } catch (error) {
        console.error('[OrderWorker] Error in process loop:', error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Stop processing
   */
  stop(): void {
    this.isRunning = false;
    console.log('[OrderWorker] Stopping...');
  }

  /**
   * Process a single order
   */
  private async processOrder(messageId: string, order: PendingOrder): Promise<void> {
    const startTime = performance.now();

    try {
      // Execute with distributed lock on account
      await withAccountLock(order.accountId, async () => {
        await this.executeOrder(order);
      });

      // Acknowledge message
      await acknowledgeMessage(
        STREAMS.ORDERS_PENDING,
        CONSUMER_GROUPS.ORDER_PROCESSOR,
        messageId
      );

      const duration = (performance.now() - startTime).toFixed(2);
      console.log(
        `[OrderWorker] Order processed in ${duration}ms: ${order.symbol} ${order.side}`
      );
    } catch (error) {
      console.error(`[OrderWorker] Failed to process order ${order.orderId}:`, error);

      // Send rejection to user
      this.wsServer.sendToUser(order.userId, {
        type: 'ORDER_REJECTED',
        clientOrderId: order.clientOrderId,
        reason: error instanceof Error ? error.message : 'Order execution failed',
      });

      // Acknowledge to prevent reprocessing
      await acknowledgeMessage(
        STREAMS.ORDERS_PENDING,
        CONSUMER_GROUPS.ORDER_PROCESSOR,
        messageId
      );
    }
  }

  /**
   * Execute order within transaction
   */
  private async executeOrder(order: PendingOrder): Promise<void> {
    const quantity = parseFloat(order.quantity);
    const lockedPrice = parseFloat(order.lockedPrice);
    const takeProfit = order.takeProfit ? parseFloat(order.takeProfit) : null;
    const stopLoss = order.stopLoss ? parseFloat(order.stopLoss) : null;
    const binancePrice = parseFloat(order.binancePrice);

    // Execute in database transaction
    await db.transaction(async (tx) => {
      // 1. Get account with row lock
      const [account] = await tx
        .select()
        .from(tradingAccounts)
        .where(eq(tradingAccounts.id, order.accountId))
        .for('update');

      if (!account) {
        throw new Error('Account not found');
      }

      // 2. Validate account status
      if (account.status !== 'active') {
        throw new Error(`Account is ${account.status}`);
      }

      // 3. Get plan for leverage limits (SERVER-SIDE - never trust client)
      const [plan] = await tx
        .select()
        .from(evaluationPlans)
        .where(eq(evaluationPlans.id, account.planId!));

      if (!plan) {
        throw new Error('Account plan not found');
      }

      // 4. Calculate margin requirements
      const marginCalc = calculateMargin(order.symbol, quantity, lockedPrice, {
        btcEthMaxLeverage: plan.btcEthMaxLeverage,
        altcoinMaxLeverage: plan.altcoinMaxLeverage,
      });

      // 5. Check available margin
      const availableMargin = parseFloat(account.availableMargin);
      const totalRequired = marginCalc.marginRequired + marginCalc.entryFee;

      if (totalRequired > availableMargin) {
        throw new Error(
          `Insufficient margin: need ${totalRequired.toFixed(2)}, have ${availableMargin.toFixed(2)}`
        );
      }

      // 6. Calculate correct liquidation price based on side
      const liquidationPrice = calculateLiquidationPrice(
        order.side,
        lockedPrice,
        marginCalc.maxLeverage
      );

      // 7. Create position
      const [position] = await tx
        .insert(positions)
        .values({
          accountId: order.accountId,
          symbol: order.symbol,
          side: order.side,
          quantity: quantity.toString(),
          leverage: marginCalc.maxLeverage,
          entryPrice: lockedPrice.toString(),
          entryValue: marginCalc.notionalValue.toString(),
          marginUsed: marginCalc.marginRequired.toString(),
          entryFee: marginCalc.entryFee.toString(),
          takeProfit: takeProfit?.toString() || null,
          stopLoss: stopLoss?.toString() || null,
          liquidationPrice: liquidationPrice.toString(),
          currentPrice: lockedPrice.toString(),
          unrealizedPnl: '0',
          binancePriceAtEntry: binancePrice.toString(),
        })
        .returning();

      // 8. Update account balances
      const newBalance = parseFloat(account.currentBalance) - marginCalc.entryFee;
      const newAvailableMargin = availableMargin - totalRequired;
      const newTotalMarginUsed =
        parseFloat(account.totalMarginUsed) + marginCalc.marginRequired;

      await tx
        .update(tradingAccounts)
        .set({
          currentBalance: newBalance.toString(),
          availableMargin: newAvailableMargin.toString(),
          totalMarginUsed: newTotalMarginUsed.toString(),
          totalTrades: sql`${tradingAccounts.totalTrades} + 1`,
          lastTradeAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tradingAccounts.id, order.accountId));

      // 9. Create order record
      await tx.insert(orders).values({
        accountId: order.accountId,
        symbol: order.symbol,
        side: order.side,
        orderType: order.type,
        quantity: quantity.toString(),
        limitPrice: order.limitPrice || null,
        takeProfit: takeProfit?.toString() || null,
        stopLoss: stopLoss?.toString() || null,
        status: 'filled',
        filledAt: new Date(),
        filledPrice: lockedPrice.toString(),
        positionId: position.id,
        clientOrderId: order.clientOrderId,
      });

      // 10. Log trade event with audit hash
      const eventDetails = {
        leverage: marginCalc.maxLeverage,
        marginUsed: marginCalc.marginRequired,
        entryFee: marginCalc.entryFee,
        liquidationPrice,
        takeProfit,
        stopLoss,
      };

      // Generate event hash for immutable audit trail
      const eventData = JSON.stringify({
        accountId: order.accountId,
        positionId: position.id,
        eventType: 'POSITION_OPENED',
        symbol: order.symbol,
        side: order.side,
        quantity: quantity.toString(),
        price: lockedPrice.toString(),
        binancePrice: binancePrice.toString(),
        priceTimestamp: order.lockedAt,
        details: eventDetails,
      });
      const eventHash = createHash('sha256').update(eventData).digest('hex');

      await tx.insert(tradeEvents).values({
        accountId: order.accountId,
        positionId: position.id,
        eventType: 'POSITION_OPENED',
        symbol: order.symbol,
        side: order.side,
        quantity: quantity.toString(),
        price: lockedPrice.toString(),
        binancePrice: binancePrice.toString(),
        priceTimestamp: new Date(parseInt(order.lockedAt)),
        details: eventDetails,
        eventHash,
      });

      // 11. Add to position manager
      const positionManager = getPositionManager();
      positionManager.addPosition({
        id: position.id,
        accountId: order.accountId,
        symbol: order.symbol,
        side: order.side,
        quantity,
        leverage: marginCalc.maxLeverage,
        entryPrice: lockedPrice,
        entryValue: marginCalc.notionalValue,
        marginUsed: marginCalc.marginRequired,
        entryFee: marginCalc.entryFee,
        takeProfit,
        stopLoss,
        liquidationPrice,
        currentPrice: lockedPrice,
        unrealizedPnl: 0,
        openedAt: position.openedAt,
      });

      // 12. Notify user
      this.wsServer.sendToUser(order.userId, {
        type: 'ORDER_FILLED',
        clientOrderId: order.clientOrderId,
        position: {
          id: position.id,
          symbol: order.symbol,
          side: order.side,
          quantity,
          leverage: marginCalc.maxLeverage,
          entryPrice: lockedPrice,
          marginUsed: marginCalc.marginRequired,
          entryFee: marginCalc.entryFee,
          takeProfit,
          stopLoss,
          liquidationPrice,
        },
        account: {
          currentBalance: newBalance,
          availableMargin: newAvailableMargin,
          totalMarginUsed: newTotalMarginUsed,
        },
      });
    });
  }
}

// ===========================================
// FACTORY FUNCTION
// ===========================================

let orderWorker: OrderWorker | null = null;

export function startOrderWorker(
  priceEngine: PriceEngine,
  wsServer: WebSocketServer
): OrderWorker {
  if (!orderWorker) {
    orderWorker = new OrderWorker(priceEngine, wsServer);
    orderWorker.start();
  }
  return orderWorker;
}

