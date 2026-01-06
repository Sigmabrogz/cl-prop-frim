// ===========================================
// MARGIN CALCULATOR
// ===========================================

import {
  MAINTENANCE_MARGIN_PCT,
  ENTRY_FEE_PCT,
} from '../config/trading-config';

// ===========================================
// TYPES
// ===========================================

export interface MarginCalculation {
  notionalValue: number;
  marginRequired: number;
  maxLeverage: number;
  entryFee: number;
  liquidationPrice: number;
}

export interface LeverageConfig {
  btcEthMaxLeverage: number;
  altcoinMaxLeverage: number;
}

// ===========================================
// FUNCTIONS
// ===========================================

/**
 * Calculate margin requirements for a position
 * @param userLeverage - User's selected leverage (optional, defaults to max allowed)
 */
export function calculateMargin(
  symbol: string,
  quantity: number,
  entryPrice: number,
  leverageConfig: LeverageConfig,
  userLeverage?: number
): MarginCalculation {
  // Determine max leverage based on symbol
  const isMajor = symbol.includes('BTC') || symbol.includes('ETH');
  const maxLeverage = isMajor
    ? leverageConfig.btcEthMaxLeverage
    : leverageConfig.altcoinMaxLeverage;

  // Use user's leverage if provided and valid, otherwise use max
  const effectiveLeverage = userLeverage && userLeverage >= 1 && userLeverage <= maxLeverage
    ? userLeverage
    : maxLeverage;

  // Calculate notional value
  const notionalValue = quantity * entryPrice;

  // Calculate margin required (notional / leverage)
  const marginRequired = notionalValue / effectiveLeverage;

  // Calculate entry fee
  const entryFee = notionalValue * ENTRY_FEE_PCT;

  // Calculate liquidation price (simplified)
  // For LONG: liquidation when equity = maintenance margin
  // liquidationPrice = entryPrice * (1 - (1/leverage) + maintenanceMargin)
  // For SHORT: liquidationPrice = entryPrice * (1 + (1/leverage) - maintenanceMargin)
  // We'll calculate for LONG here, caller should adjust for SHORT
  const liquidationPrice = calculateLiquidationPrice('LONG', entryPrice, effectiveLeverage);

  return {
    notionalValue,
    marginRequired,
    maxLeverage: effectiveLeverage, // Return the effective leverage used
    entryFee,
    liquidationPrice,
  };
}

/**
 * Calculate liquidation price
 */
export function calculateLiquidationPrice(
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  leverage: number
): number {
  // Liquidation occurs when:
  // Unrealized P&L = -(Initial Margin - Maintenance Margin)
  // 
  // For LONG:
  // (liquidationPrice - entryPrice) * quantity = -(marginRequired - maintenanceMargin)
  // liquidationPrice = entryPrice - (marginRequired - maintenanceMargin) / quantity
  // 
  // Simplified formula:
  // LONG: liquidationPrice = entryPrice * (1 - (1/leverage) + maintenanceMarginPct)
  // SHORT: liquidationPrice = entryPrice * (1 + (1/leverage) - maintenanceMarginPct)

  const leverageImpact = 1 / leverage;

  if (side === 'LONG') {
    return entryPrice * (1 - leverageImpact + MAINTENANCE_MARGIN_PCT);
  } else {
    return entryPrice * (1 + leverageImpact - MAINTENANCE_MARGIN_PCT);
  }
}

/**
 * Calculate unrealized P&L for a position
 */
export function calculateUnrealizedPnL(
  side: 'LONG' | 'SHORT',
  quantity: number,
  entryPrice: number,
  currentPrice: number
): number {
  if (side === 'LONG') {
    return (currentPrice - entryPrice) * quantity;
  } else {
    return (entryPrice - currentPrice) * quantity;
  }
}

/**
 * Calculate P&L percentage
 */
export function calculatePnLPercent(
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  currentPrice: number
): number {
  if (side === 'LONG') {
    return ((currentPrice - entryPrice) / entryPrice) * 100;
  } else {
    return ((entryPrice - currentPrice) / entryPrice) * 100;
  }
}

/**
 * Calculate ROE (Return on Equity) with leverage
 */
export function calculateROE(
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  currentPrice: number,
  leverage: number
): number {
  const pnlPercent = calculatePnLPercent(side, entryPrice, currentPrice);
  return pnlPercent * leverage;
}

/**
 * Check if position should be liquidated
 */
export function shouldLiquidate(
  side: 'LONG' | 'SHORT',
  currentPrice: number,
  liquidationPrice: number
): boolean {
  if (side === 'LONG') {
    return currentPrice <= liquidationPrice;
  } else {
    return currentPrice >= liquidationPrice;
  }
}

/**
 * Calculate position value at current price
 */
export function calculatePositionValue(quantity: number, currentPrice: number): number {
  return quantity * currentPrice;
}

/**
 * Calculate equity (margin + unrealized P&L)
 */
export function calculateEquity(marginUsed: number, unrealizedPnL: number): number {
  return marginUsed + unrealizedPnL;
}

