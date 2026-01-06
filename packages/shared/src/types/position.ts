// ===========================================
// POSITION TYPES
// ===========================================

export type PositionSide = 'LONG' | 'SHORT';

export interface Position {
  id: string;
  accountId: string;
  symbol: string;
  side: PositionSide;
  quantity: string;
  leverage: number;
  entryPrice: string;
  entryValue: string;
  marginUsed: string;
  entryFee: string;
  takeProfit: string | null;
  stopLoss: string | null;
  liquidationPrice: string;
  currentPrice: string | null;
  unrealizedPnl: string;
  lastPriceUpdate: Date | null;
  openedAt: Date;
  binancePriceAtEntry: string;
  priceSource: string;
}

export interface PositionWithPnl extends Position {
  currentPrice: string;
  unrealizedPnl: string;
  unrealizedPnlPercent: number;
  roe: number; // Return on equity (based on margin)
}

// ===========================================
// TRADE TYPES (Closed Positions)
// ===========================================

export type CloseReason = 'MANUAL' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'LIQUIDATION' | 'BREACH';

export interface Trade {
  id: string;
  accountId: string;
  positionId: string | null;
  symbol: string;
  side: PositionSide;
  quantity: string;
  leverage: number;
  entryPrice: string;
  entryValue: string;
  marginUsed: string;
  entryFee: string;
  openedAt: Date;
  exitPrice: string;
  exitValue: string;
  exitFee: string;
  closedAt: Date;
  closeReason: CloseReason;
  grossPnl: string;
  totalFees: string;
  netPnl: string;
  durationSeconds: number;
  binancePriceAtEntry: string;
  binancePriceAtExit: string;
  takeProfitWas: string | null;
  stopLossWas: string | null;
  createdAt: Date;
}

export interface TradeWithDuration extends Trade {
  durationFormatted: string;
  netPnlPercent: number;
}



