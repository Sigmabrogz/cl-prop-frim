// ===========================================
// CLOSE WORKER - Processes position closes
// ===========================================

import { db } from '@propfirm/database';
import { positions, trades, tradingAccounts, tradeEvents, orders } from '@propfirm/database/schema';
import { eq, sql } from 'drizzle-orm';
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
import { getTPSLEngine } from '../triggers/tpsl-engine.js';
import { calculateUnrealizedPnL } from '../engine/margin-calculator.js';
import { createHash } from 'crypto';

// ===========================================
// TYPES
// ===========================================

interface CloseRequest {
  positionId: string;
  accountId: string;
  symbol: string;
  reason: 'MANUAL' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'LIQUIDATION' | 'BREACH';
  exitPrice?: string;
  binancePrice?: string;
  triggerPrice?: string;
  triggeredAt: string;
  userId?: string;
  connectionId?: string;
  breachType?: string;
}

// ===========================================
// CLOSE WORKER CLASS
// ===========================================

export class CloseWorker {
  private priceEngine: PriceEngine;
  private wsServer: WebSocketServer;
  private isRunning = false;
  private consumerName: string;

  constructor(priceEngine: PriceEngine, wsServer: WebSocketServer) {
    this.priceEngine = priceEngine;
    this.wsServer = wsServer;
    this.consumerName = `close-worker-${process.pid}`;
  }

  /**
   * Start processing close requests
   */
  async start(): Promise<void> {
    this.isRunning = true;

    // Ensure consumer group exists
    await createConsumerGroup(STREAMS.POSITIONS_CLOSE, CONSUMER_GROUPS.ORDER_PROCESSOR);

    console.log(`[CloseWorker] Started (consumer: ${this.consumerName})`);

    // Process loop
    while (this.isRunning) {
      try {
        const messages = await readFromStream(
          STREAMS.POSITIONS_CLOSE,
          CONSUMER_GROUPS.ORDER_PROCESSOR,
          this.consumerName,
          10,
          5000
        );

        for (const message of messages) {
          await this.processClose(message.id, message.data as unknown as CloseRequest);
        }
      } catch (error) {
        console.error('[CloseWorker] Error in process loop:', error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Stop processing
   */
  stop(): void {
    this.isRunning = false;
    console.log('[CloseWorker] Stopping...');
  }

  /**
   * Process a single close request
   */
  private async processClose(messageId: string, request: CloseRequest): Promise<void> {
    const startTime = performance.now();

    try {
      await withAccountLock(request.accountId, async () => {
        await this.executeClose(request);
      });

      await acknowledgeMessage(
        STREAMS.POSITIONS_CLOSE,
        CONSUMER_GROUPS.ORDER_PROCESSOR,
        messageId
      );

      const duration = (performance.now() - startTime).toFixed(2);
      console.log(
        `[CloseWorker] Position closed in ${duration}ms: ${request.positionId} (${request.reason})`
      );
    } catch (error) {
      console.error(`[CloseWorker] Failed to close position ${request.positionId}:`, error);

      // Notify user if available
      if (request.userId) {
        this.wsServer.sendToUser(request.userId, {
          type: 'CLOSE_FAILED',
          positionId: request.positionId,
          reason: error instanceof Error ? error.message : 'Close execution failed',
        });
      }

      // Acknowledge to prevent infinite reprocessing
      await acknowledgeMessage(
        STREAMS.POSITIONS_CLOSE,
        CONSUMER_GROUPS.ORDER_PROCESSOR,
        messageId
      );
    }
  }

  /**
   * Execute position close within transaction
   */
  private async executeClose(request: CloseRequest): Promise<void> {
    const positionManager = getPositionManager();
    const position = positionManager.getPosition(request.positionId);

    if (!position) {
      console.warn(`[CloseWorker] Position ${request.positionId} not found, may already be closed`);
      return;
    }

    // Get exit price
    let exitPrice: number;
    let binancePrice: number;

    if (request.exitPrice) {
      exitPrice = parseFloat(request.exitPrice);
      binancePrice = parseFloat(request.binancePrice || request.exitPrice);
    } else {
      // Get current price
      const price = this.priceEngine.getPrice(position.symbol);
      if (!price) {
        throw new Error(`No price available for ${position.symbol}`);
      }
      exitPrice = position.side === 'LONG' ? price.ourBid : price.ourAsk;
      binancePrice = price.midPrice;
    }

    // Calculate P&L
    const grossPnl = calculateUnrealizedPnL(
      position.side,
      position.quantity,
      position.entryPrice,
      exitPrice
    );

    // Exit fee (same as entry)
    const exitFee = position.quantity * exitPrice * 0.0005; // 5 bps
    const totalFees = position.entryFee + exitFee;
    const netPnl = grossPnl - exitFee;

    // Calculate duration
    const durationSeconds = Math.floor((Date.now() - position.openedAt.getTime()) / 1000);

    // Execute in transaction
    await db.transaction(async (tx) => {
      // 1. Get account with lock
      const [account] = await tx
        .select()
        .from(tradingAccounts)
        .where(eq(tradingAccounts.id, position.accountId))
        .for('update');

      if (!account) {
        throw new Error('Account not found');
      }

      // 2. Create trade record (immutable history)
      const [trade] = await tx
        .insert(trades)
        .values({
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
          exitPrice: exitPrice.toString(),
          exitValue: (position.quantity * exitPrice).toString(),
          exitFee: exitFee.toString(),
          closedAt: new Date(),
          closeReason: request.reason,
          grossPnl: grossPnl.toString(),
          totalFees: totalFees.toString(),
          netPnl: netPnl.toString(),
          durationSeconds,
          binancePriceAtEntry: position.entryPrice.toString(), // Should be from position
          binancePriceAtExit: binancePrice.toString(),
          takeProfitWas: position.takeProfit?.toString() || null,
          stopLossWas: position.stopLoss?.toString() || null,
        })
        .returning();

      // 3. Clear position reference from orders before deleting position
      await tx
        .update(orders)
        .set({ positionId: null })
        .where(eq(orders.positionId, position.id));

      // 4. Delete position
      await tx.delete(positions).where(eq(positions.id, position.id));

      // 5. Update account balances
      const currentBalance = parseFloat(account.currentBalance);
      const newBalance = currentBalance + netPnl + position.marginUsed; // Return margin + P&L
      const newAvailableMargin = parseFloat(account.availableMargin) + position.marginUsed;
      const newTotalMarginUsed = parseFloat(account.totalMarginUsed) - position.marginUsed;

      // Update peak balance if new high
      const peakBalance = Math.max(parseFloat(account.peakBalance), newBalance);

      // Update daily P&L
      const newDailyPnl = parseFloat(account.dailyPnl) + netPnl;

      // Update win/loss counts
      const isWin = netPnl > 0;

      await tx
        .update(tradingAccounts)
        .set({
          currentBalance: newBalance.toString(),
          peakBalance: peakBalance.toString(),
          availableMargin: newAvailableMargin.toString(),
          totalMarginUsed: newTotalMarginUsed.toString(),
          dailyPnl: newDailyPnl.toString(),
          currentProfit: (newBalance - parseFloat(account.startingBalance)).toString(),
          winningTrades: isWin ? sql`${tradingAccounts.winningTrades} + 1` : account.winningTrades,
          losingTrades: !isWin ? sql`${tradingAccounts.losingTrades} + 1` : account.losingTrades,
          totalVolume: sql`${tradingAccounts.totalVolume}::numeric + ${position.entryValue}`,
          updatedAt: new Date(),
        })
        .where(eq(tradingAccounts.id, position.accountId));

      // 6. Log trade event with audit hash
      const eventDetails = {
        closeReason: request.reason,
        entryPrice: position.entryPrice,
        exitPrice,
        grossPnl,
        netPnl,
        totalFees,
        durationSeconds,
        leverage: position.leverage,
      };

      // Generate event hash for immutable audit trail
      const eventData = JSON.stringify({
        accountId: position.accountId,
        positionId: position.id,
        tradeId: trade.id,
        eventType: 'POSITION_CLOSED',
        symbol: position.symbol,
        side: position.side,
        quantity: position.quantity.toString(),
        price: exitPrice.toString(),
        binancePrice: binancePrice.toString(),
        details: eventDetails,
      });
      const eventHash = createHash('sha256').update(eventData).digest('hex');

      await tx.insert(tradeEvents).values({
        accountId: position.accountId,
        positionId: position.id,
        tradeId: trade.id,
        eventType: 'POSITION_CLOSED',
        symbol: position.symbol,
        side: position.side,
        quantity: position.quantity.toString(),
        price: exitPrice.toString(),
        binancePrice: binancePrice.toString(),
        priceTimestamp: new Date(),
        details: eventDetails,
        eventHash,
      });

      // 7. Remove from position manager
      positionManager.removePosition(position.id);

      // 8. Remove from TP/SL engine
      const tpslEngine = getTPSLEngine();
      if (tpslEngine) {
        tpslEngine.removePosition(position.id, position.symbol);
      }

      // 9. Notify user
      if (request.userId) {
        this.wsServer.sendToUser(request.userId, {
          type: 'POSITION_CLOSED',
          trade: {
            id: trade.id,
            positionId: position.id,
            symbol: position.symbol,
            side: position.side,
            quantity: position.quantity,
            entryPrice: position.entryPrice,
            exitPrice,
            grossPnl,
            netPnl,
            closeReason: request.reason,
            durationSeconds,
          },
          account: {
            currentBalance: newBalance,
            availableMargin: newAvailableMargin,
            dailyPnl: newDailyPnl,
          },
        });
      }

      // Also notify by account (for multi-device)
      this.wsServer.sendToAccount(position.accountId, {
        type: 'POSITION_CLOSED',
        trade: {
          id: trade.id,
          positionId: position.id,
          symbol: position.symbol,
          side: position.side,
          closeReason: request.reason,
          netPnl,
        },
      });
    });
  }
}

// ===========================================
// FACTORY FUNCTION
// ===========================================

let closeWorker: CloseWorker | null = null;

export function startCloseWorker(
  priceEngine: PriceEngine,
  wsServer: WebSocketServer
): CloseWorker {
  if (!closeWorker) {
    closeWorker = new CloseWorker(priceEngine, wsServer);
    closeWorker.start();
  }
  return closeWorker;
}

