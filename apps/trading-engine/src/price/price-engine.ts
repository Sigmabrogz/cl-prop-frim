// ===========================================
// PRICE ENGINE - In-Memory Price State
// ===========================================

import { setHash, CACHE_KEYS } from '@propfirm/redis';

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
// DEFAULT SPREADS (in basis points)
// ===========================================

const DEFAULT_SPREADS: Record<string, number> = {
  BTCUSDT: 5, // 0.05%
  ETHUSDT: 5,
  BNBUSDT: 8,
  SOLUSDT: 10,
  XRPUSDT: 10,
  ADAUSDT: 12,
  DOGEUSDT: 15,
  DOTUSDT: 10,
  LINKUSDT: 10,
  MATICUSDT: 12,
  AVAXUSDT: 10,
  LTCUSDT: 8,
  UNIUSDT: 12,
  ATOMUSDT: 10,
  XLMUSDT: 12,
};

const DEFAULT_SPREAD_BPS = 10; // 0.1% for unknown symbols

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
    // Initialize default spreads
    for (const [symbol, spread] of Object.entries(DEFAULT_SPREADS)) {
      this.spreads.set(symbol, spread);
    }
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

    // Calculate our prices with spread
    const spreadBps = this.spreads.get(symbol) || DEFAULT_SPREAD_BPS;
    const spreadMultiplier = spreadBps / 10000; // Convert bps to decimal

    const midPrice = (binanceBid + binanceAsk) / 2;
    const halfSpread = midPrice * spreadMultiplier;

    const ourBid = midPrice - halfSpread; // Price we buy at (user sells)
    const ourAsk = midPrice + halfSpread; // Price we sell at (user buys)

    const priceData: PriceData = {
      symbol,
      binanceBid,
      binanceAsk,
      ourBid,
      ourAsk,
      midPrice,
      spread: spreadBps,
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
   * Circuit breaker check - reject >5% moves in 1 second
   */
  private isCircuitBreakerTripped(symbol: string, newPrice: number): boolean {
    const previous = this.previousPrices.get(symbol);
    if (!previous) return false;

    const timeDiff = Date.now() - previous.timestamp;
    if (timeDiff > 1000) {
      // Reset circuit breaker after 1 second
      this.circuitBreakerTripped.delete(symbol);
      return false;
    }

    const priceDiff = Math.abs(newPrice - previous.price) / previous.price;
    if (priceDiff > 0.05) {
      // 5% move in 1 second
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

