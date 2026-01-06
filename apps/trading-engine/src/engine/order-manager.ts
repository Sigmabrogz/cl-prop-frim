// ===========================================
// ORDER MANAGER - Pending Order Queue
// ===========================================
// Manages pending limit orders that haven't been filled yet
// Monitors price and triggers fills when conditions are met

import { v4 as uuidv4 } from 'uuid';
import type { PriceData } from '../price/price-engine.js';

// ===========================================
// TYPES
// ===========================================

export type OrderStatus = 'PENDING' | 'FILLED' | 'CANCELLED' | 'EXPIRED';

export interface PendingOrder {
  id: string;
  clientOrderId?: string;
  userId: string;
  accountId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  type: 'LIMIT';
  quantity: number;
  leverage: number;
  limitPrice: number;
  takeProfit?: number;
  stopLoss?: number;
  status: OrderStatus;
  createdAt: Date;
  expiresAt?: Date; // Optional expiration
  marginReserved: number; // Margin locked for this order
}

export interface OrderFillResult {
  order: PendingOrder;
  fillPrice: number;
  binancePrice: number;
}

// ===========================================
// ORDER MANAGER CLASS
// ===========================================

class OrderManager {
  private orders: Map<string, PendingOrder> = new Map();
  private accountOrders: Map<string, Set<string>> = new Map();
  private symbolOrders: Map<string, Set<string>> = new Map();

  /**
   * Add a new pending order
   */
  addOrder(order: Omit<PendingOrder, 'id' | 'status' | 'createdAt'>): PendingOrder {
    const id = uuidv4();
    const pendingOrder: PendingOrder = {
      ...order,
      id,
      status: 'PENDING',
      createdAt: new Date(),
    };

    this.orders.set(id, pendingOrder);

    // Index by account
    if (!this.accountOrders.has(order.accountId)) {
      this.accountOrders.set(order.accountId, new Set());
    }
    this.accountOrders.get(order.accountId)!.add(id);

    // Index by symbol
    if (!this.symbolOrders.has(order.symbol)) {
      this.symbolOrders.set(order.symbol, new Set());
    }
    this.symbolOrders.get(order.symbol)!.add(id);

    console.log(
      `[OrderManager] Added pending order: ${order.symbol} ${order.side} ` +
      `${order.quantity} @ ${order.limitPrice} (${id})`
    );

    return pendingOrder;
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): PendingOrder | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Get all pending orders for an account
   */
  getAccountOrders(accountId: string): PendingOrder[] {
    const orderIds = this.accountOrders.get(accountId);
    if (!orderIds) return [];

    return Array.from(orderIds)
      .map(id => this.orders.get(id))
      .filter((o): o is PendingOrder => o !== undefined && o.status === 'PENDING');
  }

  /**
   * Get all pending orders for a symbol
   */
  getSymbolOrders(symbol: string): PendingOrder[] {
    const orderIds = this.symbolOrders.get(symbol);
    if (!orderIds) return [];

    return Array.from(orderIds)
      .map(id => this.orders.get(id))
      .filter((o): o is PendingOrder => o !== undefined && o.status === 'PENDING');
  }

  /**
   * Check which orders should be filled at the given price
   */
  checkOrdersForFill(symbol: string, price: PriceData): PendingOrder[] {
    const ordersToFill: PendingOrder[] = [];
    const symbolOrders = this.getSymbolOrders(symbol);

    for (const order of symbolOrders) {
      if (order.status !== 'PENDING') continue;

      // For LONG limit orders: fill when ask <= limit price
      if (order.side === 'LONG' && price.ourAsk <= order.limitPrice) {
        ordersToFill.push(order);
      }
      // For SHORT limit orders: fill when bid >= limit price
      else if (order.side === 'SHORT' && price.ourBid >= order.limitPrice) {
        ordersToFill.push(order);
      }
    }

    return ordersToFill;
  }

  /**
   * Mark order as filled
   */
  markFilled(orderId: string): void {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = 'FILLED';
      this.removeFromIndexes(order);
      console.log(`[OrderManager] Order filled: ${orderId}`);
    }
  }

  /**
   * Cancel an order
   */
  cancelOrder(orderId: string): PendingOrder | null {
    const order = this.orders.get(orderId);
    if (!order || order.status !== 'PENDING') {
      return null;
    }

    order.status = 'CANCELLED';
    this.removeFromIndexes(order);
    console.log(`[OrderManager] Order cancelled: ${orderId}`);
    return order;
  }

  /**
   * Cancel all orders for an account
   */
  cancelAllAccountOrders(accountId: string): PendingOrder[] {
    const orders = this.getAccountOrders(accountId);
    const cancelled: PendingOrder[] = [];

    for (const order of orders) {
      const result = this.cancelOrder(order.id);
      if (result) cancelled.push(result);
    }

    return cancelled;
  }

  /**
   * Remove order from indexes (called after fill/cancel)
   */
  private removeFromIndexes(order: PendingOrder): void {
    const accountOrders = this.accountOrders.get(order.accountId);
    if (accountOrders) {
      accountOrders.delete(order.id);
    }

    const symbolOrders = this.symbolOrders.get(order.symbol);
    if (symbolOrders) {
      symbolOrders.delete(order.id);
    }
  }

  /**
   * Get all pending orders
   */
  getAllPendingOrders(): PendingOrder[] {
    return Array.from(this.orders.values()).filter(o => o.status === 'PENDING');
  }

  /**
   * Get stats
   */
  getStats(): { pending: number; bySymbol: Record<string, number> } {
    const pending = this.getAllPendingOrders();
    const bySymbol: Record<string, number> = {};

    for (const order of pending) {
      bySymbol[order.symbol] = (bySymbol[order.symbol] || 0) + 1;
    }

    return { pending: pending.length, bySymbol };
  }

  /**
   * Clean up expired orders (call periodically)
   */
  cleanupExpired(): PendingOrder[] {
    const now = new Date();
    const expired: PendingOrder[] = [];

    for (const order of this.orders.values()) {
      if (order.status === 'PENDING' && order.expiresAt && order.expiresAt < now) {
        order.status = 'EXPIRED';
        this.removeFromIndexes(order);
        expired.push(order);
      }
    }

    if (expired.length > 0) {
      console.log(`[OrderManager] Expired ${expired.length} orders`);
    }

    return expired;
  }
}

// Singleton instance
let orderManagerInstance: OrderManager | null = null;

export function getOrderManager(): OrderManager {
  if (!orderManagerInstance) {
    orderManagerInstance = new OrderManager();
  }
  return orderManagerInstance;
}

export function resetOrderManager(): void {
  orderManagerInstance = null;
}
