// ===========================================
// LIQUIDATION ENGINE
// ===========================================
// Now uses synchronous close executor instead of Redis Streams

import type { PriceEngine, PriceData } from '../price/price-engine.js';
import { getPositionManager, type Position } from '../engine/position-manager.js';
import { shouldLiquidate } from '../engine/margin-calculator.js';
import { closePositionSync } from '../engine/close-executor.js';

// ===========================================
// LIQUIDATION ENGINE CLASS
// ===========================================

export class LiquidationEngine {
  private priceEngine: PriceEngine;
  private isRunning = false;

  // Track positions that have received warnings
  private warningsSent: Set<string> = new Set();

  // Warning threshold (50% of margin remaining)
  private warningThreshold = 0.5;

  // Max price staleness for liquidation (5 seconds)
  private readonly MAX_PRICE_AGE_MS = 5000;

  constructor(priceEngine: PriceEngine) {
    this.priceEngine = priceEngine;
  }

  /**
   * Start liquidation monitoring
   */
  start(): void {
    this.isRunning = true;

    // Subscribe to price updates
    this.priceEngine.onPriceUpdate((symbol, price) => {
      if (this.isRunning) {
        this.checkLiquidations(symbol, price);
      }
    });

    console.log('[LiquidationEngine] Started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false;
    console.log('[LiquidationEngine] Stopped');
  }

  /**
   * Check all positions for a symbol for liquidation
   */
  private async checkLiquidations(symbol: string, price: PriceData): Promise<void> {
    const positionManager = getPositionManager();
    const positions = positionManager.getBySymbol(symbol);

    for (const position of positions) {
      await this.checkPosition(position, price);
    }
  }

  /**
   * Check a single position for liquidation
   */
  private async checkPosition(position: Position, price: PriceData): Promise<void> {
    // CRITICAL: Check price staleness before liquidation
    // Never liquidate on stale data - this could cause false liquidations
    const priceAge = Date.now() - price.timestamp;
    if (priceAge > this.MAX_PRICE_AGE_MS) {
      console.warn(
        `[LiquidationEngine] Skipping liquidation check for ${position.id}: ` +
        `price is stale (${(priceAge / 1000).toFixed(1)}s old)`
      );
      return;
    }

    // Use appropriate price for the position side
    const currentPrice = position.side === 'LONG' ? price.ourBid : price.ourAsk;

    // Check if should liquidate
    if (shouldLiquidate(position.side, currentPrice, position.liquidationPrice)) {
      await this.triggerLiquidation(position, currentPrice, price.midPrice);
      return;
    }

    // Check for warning (approaching liquidation)
    const distanceToLiquidation = this.calculateDistanceToLiquidation(
      position.side,
      currentPrice,
      position.entryPrice,
      position.liquidationPrice
    );

    if (distanceToLiquidation < this.warningThreshold && !this.warningsSent.has(position.id)) {
      this.sendLiquidationWarning(position, currentPrice, distanceToLiquidation);
    }
  }

  /**
   * Calculate distance to liquidation (0 = at liquidation, 1 = at entry)
   */
  private calculateDistanceToLiquidation(
    side: 'LONG' | 'SHORT',
    currentPrice: number,
    entryPrice: number,
    liquidationPrice: number
  ): number {
    const totalDistance = Math.abs(entryPrice - liquidationPrice);
    const currentDistance = side === 'LONG'
      ? currentPrice - liquidationPrice
      : liquidationPrice - currentPrice;

    return Math.max(0, currentDistance / totalDistance);
  }

  /**
   * Trigger liquidation for a position
   * Now executes close SYNCHRONOUSLY instead of queueing to Redis
   */
  private async triggerLiquidation(
    position: Position,
    currentPrice: number,
    binancePrice: number
  ): Promise<void> {
    console.log(
      `[LiquidationEngine] LIQUIDATION: ${position.symbol} ${position.side} @ ${currentPrice.toFixed(2)}`
    );

    // Execute close SYNCHRONOUSLY
    const result = await closePositionSync(
      position.id,
      currentPrice,
      'LIQUIDATION',
      binancePrice
    );

    if (result.success) {
      console.log(
        `[LiquidationEngine] Position liquidated in ${result.executionTime}ms: ` +
        `P&L: ${result.netPnl?.toFixed(2)}`
      );
    } else {
      console.error(
        `[LiquidationEngine] Failed to liquidate position ${position.id}: ${result.error}`
      );
    }

    // Remove from warning set
    this.warningsSent.delete(position.id);
  }

  /**
   * Send liquidation warning
   */
  private sendLiquidationWarning(
    position: Position,
    currentPrice: number,
    distanceToLiquidation: number
  ): void {
    console.log(
      `[LiquidationEngine] WARNING: ${position.id} at ${(distanceToLiquidation * 100).toFixed(1)}% from liquidation`
    );

    // Mark warning as sent
    this.warningsSent.add(position.id);

    // The actual notification would be sent through the risk engine
    // which has access to the WebSocket server
    // This is just for logging purposes here
  }

  /**
   * Remove position from tracking (called when position is closed)
   */
  removePosition(positionId: string): void {
    this.warningsSent.delete(positionId);
  }

  /**
   * Get stats
   */
  getStats(): { warningsSent: number } {
    return {
      warningsSent: this.warningsSent.size,
    };
  }
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

let liquidationEngine: LiquidationEngine | null = null;

export function startLiquidationEngine(priceEngine: PriceEngine): LiquidationEngine {
  if (!liquidationEngine) {
    liquidationEngine = new LiquidationEngine(priceEngine);
    liquidationEngine.start();
  }
  return liquidationEngine;
}

export function getLiquidationEngine(): LiquidationEngine | null {
  return liquidationEngine;
}

