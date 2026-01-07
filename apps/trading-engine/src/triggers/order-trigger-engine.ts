// ===========================================
// ORDER TRIGGER ENGINE
// ===========================================
// Monitors prices and triggers limit order fills

import type { PriceEngine, PriceData } from '../price/price-engine.js';
import { getOrderManager, type PendingOrder } from '../engine/order-manager.js';
import { executeOrderSync, type OrderRequest } from '../engine/order-executor.js';
import { accountManager } from '../engine/account-manager.js';

// ===========================================
// TYPES
// ===========================================

export interface OrderFillEvent {
  order: PendingOrder;
  positionId: string;
  executionPrice: number;
  executionTime: number;
}

export type OrderFillCallback = (event: OrderFillEvent) => void;

// ===========================================
// ORDER TRIGGER ENGINE CLASS
// ===========================================

class OrderTriggerEngine {
  private priceEngine: PriceEngine | null = null;
  private fillCallbacks: OrderFillCallback[] = [];
  private isRunning = false;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize with price engine
   */
  initialize(priceEngine: PriceEngine): void {
    this.priceEngine = priceEngine;
    console.log('[OrderTriggerEngine] Initialized');
  }

  /**
   * Start monitoring prices
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Check orders every 100ms
    this.checkInterval = setInterval(() => {
      this.checkAllOrders();
    }, 100);

    console.log('[OrderTriggerEngine] Started monitoring');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('[OrderTriggerEngine] Stopped');
  }

  /**
   * Register callback for order fills
   */
  onOrderFill(callback: OrderFillCallback): void {
    this.fillCallbacks.push(callback);
  }

  /**
   * Check all pending orders against current prices
   */
  private async checkAllOrders(): Promise<void> {
    if (!this.priceEngine) return;

    const orderManager = getOrderManager();
    const allPrices = this.priceEngine.getAllPrices();

    for (const [symbol, price] of allPrices) {
      // Skip if price is stale
      if (Date.now() - price.timestamp > 5000) continue;

      // Check which orders should fill
      const ordersToFill = orderManager.checkOrdersForFill(symbol, price);

      for (const order of ordersToFill) {
        await this.fillOrder(order, price);
      }
    }
  }

  /**
   * Fill a pending order
   */
  private async fillOrder(order: PendingOrder, price: PriceData): Promise<void> {
    const startTime = Date.now();
    const orderManager = getOrderManager();

    try {
      // Get execution price (use limit price or better)
      const marketPrice = order.side === 'LONG' ? price.ourAsk : price.ourBid;
      const executionPrice = order.side === 'LONG'
        ? Math.min(order.limitPrice, marketPrice)
        : Math.max(order.limitPrice, marketPrice);

      // Create order request
      const orderRequest: OrderRequest = {
        clientOrderId: order.clientOrderId,
        userId: order.userId,
        accountId: order.accountId,
        symbol: order.symbol,
        side: order.side,
        type: 'LIMIT',
        quantity: order.quantity,
        leverage: order.leverage,
        limitPrice: order.limitPrice,
        takeProfit: order.takeProfit,
        stopLoss: order.stopLoss,
        timestamp: Date.now(),
        lockedPrice: executionPrice,
        binancePrice: price.midPrice,
      };

      // Release reserved margin first (it will be re-reserved during execution)
      await accountManager.withLock(order.accountId, async () => {
        const account = await accountManager.getAccount(order.accountId);
        if (account) {
          accountManager.updateAccount(order.accountId, {
            availableMargin: account.availableMargin + order.marginReserved,
          });
        }
        return true;
      }, 50);

      // Execute the order
      const result = await executeOrderSync(orderRequest, this.priceEngine!);

      if (result.success) {
        // Mark order as filled
        orderManager.markFilled(order.id);

        const executionTime = Date.now() - startTime;

        console.log(
          `[OrderTriggerEngine] Limit order FILLED: ${order.symbol} ${order.side} ` +
          `${order.quantity} @ ${executionPrice.toFixed(2)} (limit: ${order.limitPrice})`
        );

        // Notify callbacks
        const event: OrderFillEvent = {
          order,
          positionId: result.position?.id || '',
          executionPrice: result.executionPrice || executionPrice,
          executionTime,
        };

        for (const callback of this.fillCallbacks) {
          try {
            callback(event);
          } catch (error) {
            console.error('[OrderTriggerEngine] Callback error:', error);
          }
        }
      } else {
        // Execution failed - keep order pending or cancel based on error
        console.error(`[OrderTriggerEngine] Order fill failed: ${result.error}`);

        // If margin issue, cancel the order
        if (result.error?.includes('margin') || result.error?.includes('Insufficient')) {
          orderManager.cancelOrder(order.id);
        }
      }
    } catch (error) {
      console.error('[OrderTriggerEngine] Fill error:', error);
    }
  }

  /**
   * Get stats
   */
  getStats(): { isRunning: boolean; pendingOrders: number } {
    const orderManager = getOrderManager();
    return {
      isRunning: this.isRunning,
      pendingOrders: orderManager.getAllPendingOrders().length,
    };
  }
}

// Singleton instance
let orderTriggerEngineInstance: OrderTriggerEngine | null = null;

export function getOrderTriggerEngine(): OrderTriggerEngine {
  if (!orderTriggerEngineInstance) {
    orderTriggerEngineInstance = new OrderTriggerEngine();
  }
  return orderTriggerEngineInstance;
}

export function resetOrderTriggerEngine(): void {
  if (orderTriggerEngineInstance) {
    orderTriggerEngineInstance.stop();
  }
  orderTriggerEngineInstance = null;
}
