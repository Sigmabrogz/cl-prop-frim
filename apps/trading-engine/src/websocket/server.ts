// ===========================================
// WEBSOCKET SERVER - Bun Native
// ===========================================
// With heartbeat, connection health monitoring, and auto-cleanup

import type { ServerWebSocket } from 'bun';
import { verifyToken, type TokenPayload } from './auth.js';
import { ConnectionManager, type ClientConnection } from './connection-manager.js';
import { handleSubscribe, handleUnsubscribe } from './handlers/subscribe.js';
import { handlePlaceOrder, handleCancelOrder, handleGetPendingOrders } from './handlers/place-order.js';
import { handleClosePosition } from './handlers/close-position.js';
import { handleModifyPosition } from './handlers/modify-position.js';
import { handleGetPositions } from './handlers/get-positions.js';
import type { PriceEngine } from '../price/price-engine.js';
import type { MarketDataService } from '../price/market-data-service.js';
import type { OrderBookFeed, OrderBookData } from '../price/orderbook-feed.js';
import { getOrderTriggerEngine, type OrderFillEvent } from '../triggers/order-trigger-engine.js';

// ===========================================
// CONFIGURATION
// ===========================================

const HEARTBEAT_INTERVAL_MS = 30000; // Send ping every 30 seconds
const CONNECTION_TIMEOUT_MS = 60000; // Consider dead if no pong in 60 seconds
const CLEANUP_INTERVAL_MS = 15000;   // Check for dead connections every 15 seconds

// ===========================================
// MESSAGE TYPES
// ===========================================

export interface InboundMessage {
  type: string;
  [key: string]: unknown;
}

export interface OutboundMessage {
  type: string;
  [key: string]: unknown;
}

// ===========================================
// WEBSOCKET DATA
// ===========================================

interface WebSocketData {
  connectionId: string;
  userId?: string;
  accountId?: string;
  authenticated: boolean;
  subscriptions: Set<string>;
  lastPong: number;        // Timestamp of last pong received
  lastActivity: number;    // Timestamp of last activity
}

// ===========================================
// SERVER INSTANCE
// ===========================================

let connectionManager: ConnectionManager;
let priceEngineRef: PriceEngine;
let marketDataServiceRef: MarketDataService | null = null;
let orderBookFeedRef: OrderBookFeed | null = null;
let heartbeatIntervalId: Timer | null = null;
let cleanupIntervalId: Timer | null = null;

// Track all active WebSocket connections for heartbeat
const activeConnections = new Map<string, ServerWebSocket<WebSocketData>>();

// Track order book subscriptions (separate from price subscriptions)
const orderBookSubscriptions = new Map<string, Set<string>>(); // symbol -> connectionIds

export function startWebSocketServer(port: number, priceEngine: PriceEngine, marketDataService?: MarketDataService, orderBookFeed?: OrderBookFeed) {
  connectionManager = new ConnectionManager();
  priceEngineRef = priceEngine;
  marketDataServiceRef = marketDataService || null;
  orderBookFeedRef = orderBookFeed || null;

  // Initialize and start OrderTriggerEngine for limit orders
  const orderTriggerEngine = getOrderTriggerEngine();
  orderTriggerEngine.initialize(priceEngine);
  orderTriggerEngine.start();

  // Start heartbeat - ping all clients periodically
  heartbeatIntervalId = setInterval(() => {
    const now = Date.now();
    for (const [connectionId, ws] of activeConnections) {
      try {
        // Send application-level ping
        ws.send(JSON.stringify({ type: 'PING', timestamp: now }));
      } catch (error) {
        console.log(`[WS] Failed to ping ${connectionId}, removing`);
        activeConnections.delete(connectionId);
        connectionManager.removeConnection(connectionId);
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Start cleanup - remove dead connections
  cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    for (const [connectionId, ws] of activeConnections) {
      const timeSinceLastPong = now - ws.data.lastPong;
      const timeSinceLastActivity = now - ws.data.lastActivity;

      // Connection is dead if no pong received within timeout
      if (timeSinceLastPong > CONNECTION_TIMEOUT_MS) {
        console.log(`[WS] Connection ${connectionId} timed out (no pong for ${Math.round(timeSinceLastPong/1000)}s)`);
        try {
          ws.close(1000, 'Connection timeout');
        } catch {}
        activeConnections.delete(connectionId);
        connectionManager.removeConnection(connectionId);
      }
    }

    // Log connection stats periodically
    if (activeConnections.size > 0) {
      console.log(`[WS] Active connections: ${activeConnections.size}, Authenticated: ${connectionManager.getConnectionCount()}`);
    }
  }, CLEANUP_INTERVAL_MS);

  // Flush pending throttled price broadcasts every 100ms
  setInterval(() => {
    connectionManager.flushPendingBroadcasts();
  }, 100);

  // Register callback to notify clients when limit orders fill
  orderTriggerEngine.onOrderFill((event: OrderFillEvent) => {
    // Send ORDER_FILLED to the user who placed the order
    connectionManager.sendToUser(event.order.userId, {
      type: 'ORDER_FILLED',
      clientOrderId: event.order.clientOrderId,
      orderId: event.order.id,
      position: { id: event.positionId },
      executionPrice: event.executionPrice,
      executionTime: event.executionTime,
      filledFromQueue: true,
    });
  });

  // Subscribe to order book updates and broadcast to subscribed clients
  // Order book updates come every 100ms from Binance - add backpressure check
  if (orderBookFeed) {
    orderBookFeed.onOrderBookUpdate((symbol, orderBook) => {
      const subscribers = orderBookSubscriptions.get(symbol);
      if (!subscribers || subscribers.size === 0) return;

      const message = JSON.stringify({
        type: 'ORDER_BOOK_UPDATE',
        symbol,
        bids: orderBook.bids,
        asks: orderBook.asks,
        lastUpdateId: orderBook.lastUpdateId,
        timestamp: orderBook.timestamp,
      });

      for (const connectionId of subscribers) {
        const ws = activeConnections.get(connectionId);
        if (ws && ws.readyState === 1) {
          try {
            // Check backpressure - skip if buffer too full
            const buffered = (ws as any).bufferedAmount ?? 0;
            if (buffered > 65536) {
              continue; // Skip this order book update
            }
            ws.send(message);
          } catch (error) {
            // Connection may have closed, remove from subscribers
            subscribers.delete(connectionId);
          }
        }
      }
    });
  }

  // Subscribe to price updates and broadcast to clients
  priceEngine.onPriceUpdate((symbol, price) => {
    // Get market data if available
    const ticker24h = marketDataServiceRef?.getTicker24h(symbol);
    const fundingRate = marketDataServiceRef?.getFundingRate(symbol);

    // Calculate dollar spread for display
    const dollarSpread = price.ourAsk - price.ourBid;

    connectionManager.broadcastToSubscribers(symbol, {
      type: 'PRICE_UPDATE',
      symbol,
      // Binance prices (for display - what traders see as "market price")
      binanceMid: price.midPrice,
      binanceBid: price.binanceBid,
      binanceAsk: price.binanceAsk,
      // Our execution prices (with spread markup)
      bid: price.ourBid,      // Price user gets when SELLING (SHORT entry, LONG exit)
      ask: price.ourAsk,      // Price user pays when BUYING (LONG entry, SHORT exit)
      spread: dollarSpread,   // Dollar spread for display
      spreadBps: price.spread, // Spread in basis points
      timestamp: price.timestamp,
      // 24h stats
      priceChange24h: ticker24h?.priceChange || 0,
      priceChangePercent24h: ticker24h?.priceChangePercent || 0,
      high24h: ticker24h?.highPrice || 0,
      low24h: ticker24h?.lowPrice || 0,
      volume24h: ticker24h?.volume || 0,
      quoteVolume24h: ticker24h?.quoteVolume || 0,
      // Funding rate
      fundingRate: fundingRate?.fundingRate || 0,
      nextFundingTime: fundingRate?.nextFundingTime || 0,
    });
  });

  const server = Bun.serve<WebSocketData>({
    port,
    fetch(req, server) {
      // Upgrade HTTP to WebSocket
      const url = new URL(req.url);

      if (url.pathname === '/ws' || url.pathname === '/') {
        const connectionId = crypto.randomUUID();

        const now = Date.now();
        const upgraded = server.upgrade(req, {
          data: {
            connectionId,
            authenticated: false,
            subscriptions: new Set<string>(),
            lastPong: now,
            lastActivity: now,
          },
        });

        if (!upgraded) {
          return new Response('WebSocket upgrade failed', { status: 400 });
        }

        return undefined;
      }

      // Health check endpoint
      if (url.pathname === '/health') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            connections: connectionManager.getConnectionCount(),
            timestamp: new Date().toISOString(),
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response('Not Found', { status: 404 });
    },

    websocket: {
      // Connection opened
      open(ws: ServerWebSocket<WebSocketData>) {
        console.log(`[WS] Connection opened: ${ws.data.connectionId}`);

        // Track connection for heartbeat
        activeConnections.set(ws.data.connectionId, ws);

        // Send welcome message with server time for sync
        ws.send(
          JSON.stringify({
            type: 'CONNECTED',
            connectionId: ws.data.connectionId,
            serverTime: Date.now(),
            heartbeatInterval: HEARTBEAT_INTERVAL_MS,
            message: 'Connected to PropFirm Trading Engine. Please authenticate.',
          })
        );
      },

      // Message received
      async message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
        try {
          const data = JSON.parse(message.toString()) as InboundMessage;

          // Update last activity timestamp on every message
          ws.data.lastActivity = Date.now();

          // Handle PONG response (client responding to our PING)
          if (data.type === 'PONG') {
            ws.data.lastPong = Date.now();
            return;
          }

          // Handle authentication
          if (data.type === 'AUTH') {
            await handleAuth(ws, data.token as string);
            return;
          }

          // All other messages require authentication
          if (!ws.data.authenticated) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                error: 'Not authenticated',
                message: 'Please send AUTH message with valid token first',
              })
            );
            return;
          }

          // Route message to appropriate handler
          switch (data.type) {
            case 'SUBSCRIBE':
              console.log(`[WS] SUBSCRIBE request for:`, data.symbols);
              handleSubscribe(ws, data.symbols as string[], connectionManager);
              break;

            case 'UNSUBSCRIBE':
              handleUnsubscribe(ws, data.symbols as string[], connectionManager);
              break;

            case 'SUBSCRIBE_ORDER_BOOK':
              {
                const symbols = data.symbols as string[];
                console.log(`[WS] SUBSCRIBE_ORDER_BOOK request for: ${symbols}`);
                if (Array.isArray(symbols)) {
                  for (const symbol of symbols) {
                    const normalizedSymbol = symbol.toUpperCase();
                    if (!orderBookSubscriptions.has(normalizedSymbol)) {
                      orderBookSubscriptions.set(normalizedSymbol, new Set());
                    }
                    orderBookSubscriptions.get(normalizedSymbol)!.add(ws.data.connectionId);
                    console.log(`[WS] Added ${ws.data.connectionId} to orderbook subscribers for ${normalizedSymbol}`);
                  }
                  // Send current order book snapshot
                  if (orderBookFeedRef) {
                    for (const symbol of symbols) {
                      const orderBook = orderBookFeedRef.getOrderBook(symbol.toUpperCase());
                      console.log(`[WS] Order book for ${symbol}:`, orderBook ? 'found' : 'not found');
                      if (orderBook) {
                        ws.send(JSON.stringify({
                          type: 'ORDER_BOOK_SNAPSHOT',
                          symbol: orderBook.symbol,
                          bids: orderBook.bids,
                          asks: orderBook.asks,
                          lastUpdateId: orderBook.lastUpdateId,
                          timestamp: orderBook.timestamp,
                        }));
                      }
                    }
                  } else {
                    console.log('[WS] orderBookFeedRef is null');
                  }
                  ws.send(JSON.stringify({
                    type: 'ORDER_BOOK_SUBSCRIBED',
                    symbols: symbols.map(s => s.toUpperCase()),
                  }));
                }
              }
              break;

            case 'UNSUBSCRIBE_ORDER_BOOK':
              {
                const symbols = data.symbols as string[];
                if (Array.isArray(symbols)) {
                  for (const symbol of symbols) {
                    const normalizedSymbol = symbol.toUpperCase();
                    const subscribers = orderBookSubscriptions.get(normalizedSymbol);
                    if (subscribers) {
                      subscribers.delete(ws.data.connectionId);
                    }
                  }
                  ws.send(JSON.stringify({
                    type: 'ORDER_BOOK_UNSUBSCRIBED',
                    symbols: symbols.map(s => s.toUpperCase()),
                  }));
                }
              }
              break;

            case 'PLACE_ORDER':
              await handlePlaceOrder(ws, data.data as any, priceEngineRef);
              break;

            case 'CLOSE_POSITION':
              await handleClosePosition(ws, data.positionId as string, priceEngineRef, data.quantity as number | undefined);
              break;

            case 'CANCEL_ORDER':
              await handleCancelOrder(ws, data.orderId as string);
              break;

            case 'GET_PENDING_ORDERS':
              handleGetPendingOrders(ws, data.accountId as string);
              break;

            case 'MODIFY_POSITION':
              await handleModifyPosition(
                ws,
                data.positionId as string,
                data.takeProfit as string | undefined,
                data.stopLoss as string | undefined
              );
              break;

            case 'GET_POSITIONS':
              await handleGetPositions(ws, data.accountId as string);
              break;

            case 'PING':
              ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
              break;

            default:
              ws.send(
                JSON.stringify({
                  type: 'ERROR',
                  error: 'Unknown message type',
                  messageType: data.type,
                })
              );
          }
        } catch (error) {
          console.error('[WS] Message handling error:', error);
          ws.send(
            JSON.stringify({
              type: 'ERROR',
              error: 'Invalid message format',
              message: error instanceof Error ? error.message : 'Unknown error',
            })
          );
        }
      },

      // Connection closed
      close(ws: ServerWebSocket<WebSocketData>, code: number, reason: string) {
        console.log(`[WS] Connection closed: ${ws.data.connectionId} (${code}: ${reason || 'no reason'})`);

        // Remove from active connections tracking
        activeConnections.delete(ws.data.connectionId);

        // Remove from order book subscriptions
        for (const subscribers of orderBookSubscriptions.values()) {
          subscribers.delete(ws.data.connectionId);
        }

        // Remove from connection manager
        if (ws.data.userId) {
          connectionManager.removeConnection(ws.data.connectionId);
        }
      },

      // Handle drain (backpressure)
      drain(ws: ServerWebSocket<WebSocketData>) {
        console.log(`[WS] Drain: ${ws.data.connectionId}`);
      },
    },
  });

  return {
    server,
    connectionManager,
    orderTriggerEngine,
    close: () => {
      // Stop heartbeat and cleanup intervals
      if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = null;
      }
      if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
      }
      // Clear active connections
      activeConnections.clear();
      // Stop order trigger engine and server
      orderTriggerEngine.stop();
      server.stop();
      console.log('[WS] WebSocket server stopped');
    },
    broadcast: (message: OutboundMessage) => connectionManager.broadcastAll(message),
    sendToUser: (userId: string, message: OutboundMessage) =>
      connectionManager.sendToUser(userId, message),
    sendToAccount: (accountId: string, message: OutboundMessage) =>
      connectionManager.sendToAccount(accountId, message),
  };
}

// ===========================================
// AUTH HANDLER
// ===========================================

async function handleAuth(ws: ServerWebSocket<WebSocketData>, token: string) {
  try {
    const payload = await verifyToken(token);

    // Update WebSocket data
    ws.data.authenticated = true;
    ws.data.userId = payload.userId;

    // Add to connection manager
    connectionManager.addConnection({
      id: ws.data.connectionId,
      ws: ws as any,
      userId: payload.userId,
      accountId: undefined,
      subscriptions: ws.data.subscriptions,
      connectedAt: new Date(),
    });

    ws.send(
      JSON.stringify({
        type: 'AUTHENTICATED',
        userId: payload.userId,
        message: 'Authentication successful',
      })
    );

    console.log(`[WS] User authenticated: ${payload.userId}`);
  } catch (error) {
    ws.send(
      JSON.stringify({
        type: 'AUTH_FAILED',
        error: 'Invalid or expired token',
      })
    );
  }
}

// Export types
export type WebSocketServer = ReturnType<typeof startWebSocketServer>;

