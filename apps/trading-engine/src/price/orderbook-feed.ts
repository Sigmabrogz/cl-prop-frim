// ===========================================
// ORDER BOOK FEED - Real-time from Binance
// ===========================================

import WebSocket from 'ws';

// ===========================================
// CONFIGURATION
// ===========================================

const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws';
const MAX_DEPTH_LEVELS = 20; // Number of price levels to track

// Symbols to track order book for
const SYMBOLS = [
  'btcusdt', 'ethusdt', 'bnbusdt', 'solusdt', 'xrpusdt',
  'adausdt', 'dogeusdt', 'avaxusdt',
];

// ===========================================
// TYPES
// ===========================================

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBookData {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastUpdateId: number;
  timestamp: number;
}

type OrderBookCallback = (symbol: string, orderBook: OrderBookData) => void;

// ===========================================
// ORDER BOOK FEED CLASS
// ===========================================

export class OrderBookFeed {
  private ws: WebSocket | null = null;
  private orderBooks: Map<string, OrderBookData> = new Map();
  private callbacks: OrderBookCallback[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isConnected = false;
  private shouldReconnect = true;
  private pingInterval: Timer | null = null;
  private lastPongTime = 0;

  /**
   * Connect to Binance WebSocket for order book data
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Build stream URL for depth streams (order book)
        // Using depth5 for top 5 levels, updated every 100ms
        const streams = SYMBOLS.map((s) => `${s}@depth10@100ms`).join('/');
        const url = `${BINANCE_WS_URL.replace('/ws', '')}/stream?streams=${streams}`;

        console.log(`[OrderBookFeed] Connecting to Binance order book stream...`);

        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          console.log('[OrderBookFeed] Connected to Binance order book stream');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.lastPongTime = Date.now();
          this.startPingInterval();
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          console.error('[OrderBookFeed] WebSocket error:', error.message);
          if (!this.isConnected) {
            reject(error);
          }
        });

        this.ws.on('close', (code, reason) => {
          console.log(`[OrderBookFeed] Connection closed: ${code} - ${reason}`);
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

      // Combined stream format: { stream: "btcusdt@depth10@100ms", data: {...} }
      if (message.stream && message.data) {
        const depthData = message.data as {
          lastUpdateId: number;
          bids: [string, string][]; // [price, quantity]
          asks: [string, string][];
        };

        // Extract symbol from stream name
        const symbol = message.stream.split('@')[0].toUpperCase();

        // Parse bids and asks
        const bids: OrderBookLevel[] = depthData.bids
          .slice(0, MAX_DEPTH_LEVELS)
          .map(([price, quantity]) => ({
            price: parseFloat(price),
            quantity: parseFloat(quantity),
          }));

        const asks: OrderBookLevel[] = depthData.asks
          .slice(0, MAX_DEPTH_LEVELS)
          .map(([price, quantity]) => ({
            price: parseFloat(price),
            quantity: parseFloat(quantity),
          }));

        const orderBook: OrderBookData = {
          symbol,
          bids,
          asks,
          lastUpdateId: depthData.lastUpdateId,
          timestamp: Date.now(),
        };

        // Update cache
        this.orderBooks.set(symbol, orderBook);

        // Notify callbacks
        for (const callback of this.callbacks) {
          try {
            callback(symbol, orderBook);
          } catch (error) {
            console.error('[OrderBookFeed] Callback error:', error);
          }
        }
      }
    } catch (error) {
      console.error('[OrderBookFeed] Failed to parse message:', error);
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        if (Date.now() - this.lastPongTime > 30000) {
          console.warn('[OrderBookFeed] No pong received, reconnecting...');
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
      console.error('[OrderBookFeed] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `[OrderBookFeed] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[OrderBookFeed] Reconnection failed:', error.message);
      });
    }, delay);
  }

  /**
   * Get order book for a symbol
   */
  getOrderBook(symbol: string): OrderBookData | null {
    return this.orderBooks.get(symbol) || null;
  }

  /**
   * Register callback for order book updates
   */
  onOrderBookUpdate(callback: OrderBookCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove callback
   */
  offOrderBookUpdate(callback: OrderBookCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
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
    console.log('[OrderBookFeed] Disconnected');
  }

  /**
   * Check if connected
   */
  isActive(): boolean {
    return this.isConnected;
  }
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

let orderBookFeed: OrderBookFeed | null = null;

export async function startOrderBookFeed(): Promise<OrderBookFeed> {
  if (!orderBookFeed) {
    orderBookFeed = new OrderBookFeed();
    await orderBookFeed.connect();
  }
  return orderBookFeed;
}

export function getOrderBookFeed(): OrderBookFeed | null {
  return orderBookFeed;
}
