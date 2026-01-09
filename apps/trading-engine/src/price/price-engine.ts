// ===========================================
// PRICE ENGINE - In-Memory Price State
// ===========================================

import { setHash, CACHE_KEYS } from '@propfirm/redis';
import {
  SYMBOL_SPREADS,
  DEFAULT_SPREAD_BPS,
  CIRCUIT_BREAKER_THRESHOLD_PCT,
  CIRCUIT_BREAKER_RESET_MS,
} from '../config/trading-config';

// ===========================================
// TYPES
// ===========================================

export interface PriceData {
  symbol: string;
  binanceBid: number;
  binanceAsk: number;
  ourBid: number;
  ourAsk: number;
  midPrice: number;
  spread: number;
  timestamp: number;
}

export interface SpreadConfig {
  symbol: string;
  spreadBps: number; // Basis points (5 = 0.05%)
}

type PriceUpdateCallback = (symbol: string, price: PriceData) => void;

// ===========================================
// PRICE ENGINE CLASS
// ===========================================

export class PriceEngine {
  // In-memory price cache
  private prices: Map<string, PriceData> = new Map();

  // Spread configuration
  private spreads: Map<string, number> = new Map();

  // Previous prices for circuit breaker
  private previousPrices: Map<string, { price: number; timestamp: number }> = new Map();

  // Callbacks for price updates
  private callbacks: PriceUpdateCallback[] = [];

  // Circuit breaker state
  private circuitBreakerTripped: Set<string> = new Set();

  constructor() {
    // Initialize spreads from config
    for (const [symbol, spread] of Object.entries(SYMBOL_SPREADS)) {
      this.spreads.set(symbol, spread);
    }
    // Log spread configuration at startup
    console.log('[PriceEngine] Spread configuration loaded:');
    for (const [symbol, spread] of this.spreads.entries()) {
      console.log(`  ${symbol}: ${spread} bps (${(spread / 100).toFixed(2)}%)`);
    }
    console.log(`  DEFAULT: ${DEFAULT_SPREAD_BPS} bps`);
  }

  /**
   * Update price from Binance feed
   */
  updatePrice(symbol: string, binanceBid: number, binanceAsk: number): void {
    // Check circuit breaker
    if (this.isCircuitBreakerTripped(symbol, binanceBid)) {
      console.warn(`[PriceEngine] Circuit breaker tripped for ${symbol}`);
      return;
    }

    // Use Binance prices directly - NO spread markup
    // Revenue comes from trading fees (0.05% entry + 0.05% exit)
    const midPrice = (binanceBid + binanceAsk) / 2;

    // Pass through Binance prices directly
    const ourBid = binanceBid;  // Price user gets when SELLING
    const ourAsk = binanceAsk;  // Price user pays when BUYING

    const priceData: PriceData = {
      symbol,
      binanceBid,
      binanceAsk,
      ourBid,
      ourAsk,
      midPrice,
      spread: 0, // No spread markup
      timestamp: Date.now(),
    };

    // Update in-memory cache
    this.prices.set(symbol, priceData);

    // Update previous price for circuit breaker
    this.previousPrices.set(symbol, { price: midPrice, timestamp: Date.now() });

    // Update Redis cache (fire and forget)
    this.updateRedisCache(symbol, priceData).catch((err) =>
      console.error(`[PriceEngine] Redis update failed for ${symbol}:`, err)
    );

    // Notify callbacks
    for (const callback of this.callbacks) {
      try {
        callback(symbol, priceData);
      } catch (error) {
        console.error('[PriceEngine] Callback error:', error);
      }
    }
  }

  /**
   * Get current price for a symbol
   */
  getPrice(symbol: string): PriceData | null {
    return this.prices.get(symbol) || null;
  }

  /**
   * Get execution price for an order
   * LONG orders execute at ask (higher price)
   * SHORT orders execute at bid (lower price)
   */
  getExecutionPrice(symbol: string, side: 'LONG' | 'SHORT'): number | null {
    const price = this.prices.get(symbol);
    if (!price) return null;

    return side === 'LONG' ? price.ourAsk : price.ourBid;
  }

  /**
   * Get all current prices
   */
  getAllPrices(): Map<string, PriceData> {
    return new Map(this.prices);
  }

  /**
   * Register callback for price updates
   */
  onPriceUpdate(callback: PriceUpdateCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove callback
   */
  offPriceUpdate(callback: PriceUpdateCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Set spread for a symbol
   */
  setSpread(symbol: string, spreadBps: number): void {
    this.spreads.set(symbol, spreadBps);
  }

  /**
   * Check if price data is stale
   */
  isPriceStale(symbol: string, maxAgeMs: number = 5000): boolean {
    const price = this.prices.get(symbol);
    if (!price) return true;
    return Date.now() - price.timestamp > maxAgeMs;
  }

  /**
   * Circuit breaker check - reject large moves in short time
   */
  private isCircuitBreakerTripped(symbol: string, newPrice: number): boolean {
    const previous = this.previousPrices.get(symbol);
    if (!previous) return false;

    const timeDiff = Date.now() - previous.timestamp;
    if (timeDiff > CIRCUIT_BREAKER_RESET_MS) {
      // Reset circuit breaker after configured time
      this.circuitBreakerTripped.delete(symbol);
      return false;
    }

    const priceDiff = Math.abs(newPrice - previous.price) / previous.price;
    if (priceDiff > CIRCUIT_BREAKER_THRESHOLD_PCT) {
      // Large move detected
      this.circuitBreakerTripped.add(symbol);
      return true;
    }

    return this.circuitBreakerTripped.has(symbol);
  }

  /**
   * Update Redis cache
   */
  private async updateRedisCache(symbol: string, price: PriceData): Promise<void> {
    await setHash(`${CACHE_KEYS.PRICE}:${symbol}`, {
      binanceBid: price.binanceBid.toString(),
      binanceAsk: price.binanceAsk.toString(),
      ourBid: price.ourBid.toString(),
      ourAsk: price.ourAsk.toString(),
      midPrice: price.midPrice.toString(),
      spread: price.spread.toString(),
      timestamp: price.timestamp.toString(),
    });
  }
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

let priceEngine: PriceEngine | null = null;

export function startPriceEngine(): PriceEngine {
  if (!priceEngine) {
    priceEngine = new PriceEngine();
  }
  return priceEngine;
}

export function getPriceEngine(): PriceEngine | null {
  return priceEngine;
}

