// ===========================================
// ORDER TYPES
// ===========================================

import type { PositionSide } from './position.js';

export type OrderType = 'MARKET' | 'LIMIT';
export type OrderStatus =
  | 'pending'
  | 'validating'
  | 'executing'
  | 'filled'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export interface Order {
  id: string;
  accountId: string;
  symbol: string;
  side: PositionSide;
  orderType: OrderType;
  quantity: string;
  limitPrice: string | null;
  takeProfit: string | null;
  stopLoss: string | null;
  status: OrderStatus;
  filledAt: Date | null;
  filledPrice: string | null;
  positionId: string | null;
  rejectionReason: string | null;
  rejectedAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
  clientOrderId: string | null;
}

export interface PlaceOrderRequest {
  symbol: string;
  side: PositionSide;
  orderType: OrderType;
  quantity: string;
  limitPrice?: string;
  takeProfit?: string;
  stopLoss?: string;
  clientOrderId?: string;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  positionId?: string;
  filledPrice?: string;
  error?: string;
}



