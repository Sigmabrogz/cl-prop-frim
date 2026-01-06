// ===========================================
// TP/SL ENGINE - Real-Time Trigger Monitoring
// ===========================================
// Now uses synchronous close executor instead of Redis Streams

import type { PriceEngine, PriceData } from '../price/price-engine.js';
import { getPositionManager, type Position } from '../engine/position-manager.js';
import { closePositionSync, type CloseReason } from '../engine/close-executor.js';

// ===========================================
// TRIGGER INDEX
// ===========================================

interface TriggerEntry {
  positionId: string;
  accountId: string;
  price: number;
  side: 'LONG' | 'SHORT';
  type: 'TP' | 'SL';
}

/**
 * Sorted index for efficient trigger lookups
 * Entries are sorted by price for binary search
 */
class TriggerIndex {
  // Long TP: triggers when price >= target (sorted ascending)
  private longTP: TriggerEntry[] = [];

  // Long SL: triggers when price <= target (sorted descending)
  private longSL: TriggerEntry[] = [];

  // Short TP: triggers when price <= target (sorted descending)
  private shortTP: TriggerEntry[] = [];

  // Short SL: triggers when price >= target (sorted ascending)
  private shortSL: TriggerEntry[] = [];

  /**
   * Add a trigger to the index
   */
  add(entry: TriggerEntry): void {
    if (entry.side === 'LONG') {
      if (entry.type === 'TP') {
        this.insertSorted(this.longTP, entry, 'asc');
      } else {
        this.insertSorted(this.longSL, entry, 'desc');
      }
    } else {
      if (entry.type === 'TP') {
        this.insertSorted(this.shortTP, entry, 'desc');
      } else {
        this.insertSorted(this.shortSL, entry, 'asc');
      }
    }
  }

  /**
   * Remove a trigger from the index
   */
  remove(positionId: string): void {
    this.longTP = this.longTP.filter((e) => e.positionId !== positionId);
    this.longSL = this.longSL.filter((e) => e.positionId !== positionId);
    this.shortTP = this.shortTP.filter((e) => e.positionId !== positionId);
    this.shortSL = this.shortSL.filter((e) => e.positionId !== positionId);
  }

  /**
   * Update a trigger price
   */
  update(positionId: string, type: 'TP' | 'SL', newPrice: number | null): void {
    // Remove old entry
    if (type === 'TP') {
      this.longTP = this.longTP.filter((e) => e.positionId !== positionId);
      this.shortTP = this.shortTP.filter((e) => e.positionId !== positionId);
    } else {
      this.longSL = this.longSL.filter((e) => e.positionId !== positionId);
      this.shortSL = this.shortSL.filter((e) => e.positionId !== positionId);
    }

    // Add new entry if price is set
    if (newPrice !== null) {
      const position = getPositionManager().getPosition(positionId);
      if (position) {
        this.add({
          positionId,
          accountId: position.accountId,
          price: newPrice,
          side: position.side,
          type,
        });
      }
    }
  }

  /**
   * Check for triggered entries at current price
   */
  checkTriggers(currentPrice: number): TriggerEntry[] {
    const triggered: TriggerEntry[] = [];

    // Long TP: triggers when price >= target
    for (const entry of this.longTP) {
      if (currentPrice >= entry.price) {
        triggered.push(entry);
      } else {
        break; // Sorted ascending, no more will trigger
      }
    }

    // Long SL: triggers when price <= target
    for (const entry of this.longSL) {
      if (currentPrice <= entry.price) {
        triggered.push(entry);
      } else {
        break; // Sorted descending, no more will trigger
      }
    }

    // Short TP: triggers when price <= target
    for (const entry of this.shortTP) {
      if (currentPrice <= entry.price) {
        triggered.push(entry);
      } else {
        break; // Sorted descending, no more will trigger
      }
    }

    // Short SL: triggers when price >= target
    for (const entry of this.shortSL) {
      if (currentPrice >= entry.price) {
        triggered.push(entry);
      } else {
        break; // Sorted ascending, no more will trigger
      }
    }

    return triggered;
  }

  /**
   * Insert entry in sorted position
   */
  private insertSorted(
    array: TriggerEntry[],
    entry: TriggerEntry,
    order: 'asc' | 'desc'
  ): void {
    let low = 0;
    let high = array.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const compare =
        order === 'asc' ? array[mid].price < entry.price : array[mid].price > entry.price;

      if (compare) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    array.splice(low, 0, entry);
  }

  /**
   * Get stats
   */
  getStats(): { longTP: number; longSL: number; shortTP: number; shortSL: number } {
    return {
      longTP: this.longTP.length,
      longSL: this.longSL.length,
      shortTP: this.shortTP.length,
      shortSL: this.shortSL.length,
    };
  }
}

// ===========================================
// TP/SL ENGINE CLASS
// ===========================================

export class TPSLEngine {
  // Symbol -> TriggerIndex
  private indexes: Map<string, TriggerIndex> = new Map();

  private priceEngine: PriceEngine;
  private isRunning = false;

  constructor(priceEngine: PriceEngine) {
    this.priceEngine = priceEngine;
  }

  /**
   * Initialize from position manager
   */
  initialize(): void {
    const positionManager = getPositionManager();
    const positions = positionManager.getAllPositions();

    for (const position of positions) {
      this.addPosition(position);
    }

    console.log(`[TPSLEngine] Initialized with ${positions.length} positions`);
  }

  /**
   * Start listening to price updates
   */
  start(): void {
    this.isRunning = true;

    // Subscribe to price updates
    this.priceEngine.onPriceUpdate((symbol, price) => {
      if (this.isRunning) {
        this.checkTriggers(symbol, price);
      }
    });

    console.log('[TPSLEngine] Started');
  }

  /**
   * Stop the engine
   */
  stop(): void {
    this.isRunning = false;
    console.log('[TPSLEngine] Stopped');
  }

  /**
   * Add a position to monitoring
   */
  addPosition(position: Position): void {
    if (!this.indexes.has(position.symbol)) {
      this.indexes.set(position.symbol, new TriggerIndex());
    }

    const index = this.indexes.get(position.symbol)!;

    if (position.takeProfit !== null) {
      index.add({
        positionId: position.id,
        accountId: position.accountId,
        price: position.takeProfit,
        side: position.side,
        type: 'TP',
      });
    }

    if (position.stopLoss !== null) {
      index.add({
        positionId: position.id,
        accountId: position.accountId,
        price: position.stopLoss,
        side: position.side,
        type: 'SL',
      });
    }
  }

  /**
   * Remove a position from monitoring
   */
  removePosition(positionId: string, symbol: string): void {
    const index = this.indexes.get(symbol);
    if (index) {
      index.remove(positionId);
    }
  }

  /**
   * Update TP/SL for a position
   */
  updateTPSL(
    positionId: string,
    symbol: string,
    takeProfit?: number | null,
    stopLoss?: number | null
  ): void {
    const index = this.indexes.get(symbol);
    if (!index) return;

    if (takeProfit !== undefined) {
      index.update(positionId, 'TP', takeProfit);
    }
    if (stopLoss !== undefined) {
      index.update(positionId, 'SL', stopLoss);
    }
  }

  /**
   * Check for triggered positions at current price
   * Now executes closes SYNCHRONOUSLY instead of queueing to Redis
   */
  private async checkTriggers(symbol: string, price: PriceData): Promise<void> {
    const index = this.indexes.get(symbol);
    if (!index) return;

    // Use mid price for trigger checks
    const triggered = index.checkTriggers(price.midPrice);

    if (triggered.length === 0) return;

    // Process triggered positions SYNCHRONOUSLY
    for (const trigger of triggered) {
      const closeReason: CloseReason = trigger.type === 'TP' ? 'TAKE_PROFIT' : 'STOP_LOSS';
      
      // Get the actual close price based on position side
      // LONG positions close at bid, SHORT positions close at ask
      const closePrice = trigger.side === 'LONG' ? price.ourBid : price.ourAsk;
      
      console.log(
        `[TPSLEngine] Triggered: ${trigger.type} for position ${trigger.positionId} @ ${closePrice.toFixed(2)}`
      );

      // Execute close SYNCHRONOUSLY
      const result = await closePositionSync(
        trigger.positionId,
        closePrice,
        closeReason,
        price.midPrice // binance price for audit
      );

      if (result.success) {
        console.log(
          `[TPSLEngine] Position closed in ${result.executionTime}ms: ` +
          `${closeReason} | P&L: ${result.netPnl?.toFixed(2)}`
        );
        // Remove from index
        index.remove(trigger.positionId);
      } else {
        console.error(
          `[TPSLEngine] Failed to close position ${trigger.positionId}: ${result.error}`
        );
        // Keep in index for retry on next price tick
      }
    }
  }

  /**
   * Get engine stats
   */
  getStats(): { symbols: number; triggers: Record<string, ReturnType<TriggerIndex['getStats']>> } {
    const triggers: Record<string, ReturnType<TriggerIndex['getStats']>> = {};

    for (const [symbol, index] of this.indexes) {
      triggers[symbol] = index.getStats();
    }

    return {
      symbols: this.indexes.size,
      triggers,
    };
  }
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

let tpslEngine: TPSLEngine | null = null;

export function startTPSLEngine(priceEngine: PriceEngine): TPSLEngine {
  if (!tpslEngine) {
    tpslEngine = new TPSLEngine(priceEngine);
    tpslEngine.initialize();
    tpslEngine.start();
  }
  return tpslEngine;
}

export function getTPSLEngine(): TPSLEngine | null {
  return tpslEngine;
}

