// ===========================================
// BINANCE WEBSOCKET FEED
// ===========================================

import WebSocket from 'ws';
import type { PriceEngine } from './price-engine.js';

// ===========================================
// CONFIGURATION
// ===========================================

const BINANCE_WS_URL = process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws';

// Symbols to subscribe to
const SYMBOLS = [
  'btcusdt',
  'ethusdt',
  'bnbusdt',
  'solusdt',
  'xrpusdt',
  'adausdt',
  'dogeusdt',
  'dotusdt',
  'linkusdt',
  'maticusdt',
  'avaxusdt',
  'ltcusdt',
  'uniusdt',
  'atomusdt',
  'xlmusdt',
];

// ===========================================
// TYPES
// ===========================================

interface BookTickerMessage {
  u: number; // Order book updateId
  s: string; // Symbol
  b: string; // Best bid price
  B: string; // Best bid qty
  a: string; // Best ask price
  A: string; // Best ask qty
}

// ===========================================
// BINANCE FEED CLASS
// ===========================================

export class BinanceFeed {
  private ws: WebSocket | null = null;
  private priceEngine: PriceEngine;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isConnected = false;
  private shouldReconnect = true;
  private pingInterval: Timer | null = null;
  private lastPongTime = 0;

  constructor(priceEngine: PriceEngine) {
    this.priceEngine = priceEngine;
  }

  /**
   * Connect to Binance WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Build stream URL for multiple symbols
        const streams = SYMBOLS.map((s) => `${s}@bookTicker`).join('/');
        const url = `${BINANCE_WS_URL.replace('/ws', '')}/stream?streams=${streams}`;

        console.log(`[BinanceFeed] Connecting to ${url.substring(0, 50)}...`);

        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          console.log('[BinanceFeed] Connected to Binance');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.lastPongTime = Date.now();

          // Start ping interval
          this.startPingInterval();

          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          console.error('[BinanceFeed] WebSocket error:', error.message);
          if (!this.isConnected) {
            reject(error);
          }
        });

        this.ws.on('close', (code, reason) => {
          console.log(`[BinanceFeed] Connection closed: ${code} - ${reason}`);
          this.isConnected = false;
          this.stopPingInterval();

          if (this.shouldReconnect) {
            this.scheduleReconnect();
          }
        });

        this.ws.on('pong', () => {
          this.lastPongTime = Date.now();
        });

        // Timeout for initial connection
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      // Combined stream format: { stream: "btcusdt@bookTicker", data: {...} }
      if (message.stream && message.data) {
        const ticker = message.data as BookTickerMessage;
        const symbol = ticker.s.toUpperCase();
        const bid = parseFloat(ticker.b);
        const ask = parseFloat(ticker.a);

        // Update price engine
        this.priceEngine.updatePrice(symbol, bid, ask);
      }
    } catch (error) {
      console.error('[BinanceFeed] Failed to parse message:', error);
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        // Check if we received a pong recently
        if (Date.now() - this.lastPongTime > 30000) {
          console.warn('[BinanceFeed] No pong received, reconnecting...');
          this.ws.terminate();
          return;
        }

        this.ws.ping();
      }
    }, 15000);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[BinanceFeed] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `[BinanceFeed] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[BinanceFeed] Reconnection failed:', error.message);
      });
    }, delay);
  }

  /**
   * Disconnect from Binance
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPingInterval();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    console.log('[BinanceFeed] Disconnected');
  }

  /**
   * Check if connected
   */
  isActive(): boolean {
    return this.isConnected;
  }
}

// ===========================================
// FACTORY FUNCTION
// ===========================================

let binanceFeed: BinanceFeed | null = null;

export async function startBinanceFeed(priceEngine: PriceEngine): Promise<BinanceFeed> {
  if (!binanceFeed) {
    binanceFeed = new BinanceFeed(priceEngine);
    try {
      await binanceFeed.connect();
    } catch (error) {
      // Don't crash if Binance connection fails - it will retry automatically
      console.warn('[BinanceFeed] Initial connection failed, will retry in background:', (error as Error).message);
      // Schedule a reconnect attempt
      setTimeout(() => {
        binanceFeed?.connect().catch((e) => {
          console.warn('[BinanceFeed] Retry connection failed:', (e as Error).message);
        });
      }, 5000);
    }
  }
  return binanceFeed;
}

export function getBinanceFeed(): BinanceFeed | null {
  return binanceFeed;
}

