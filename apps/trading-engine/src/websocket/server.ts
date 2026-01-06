// ===========================================
// WEBSOCKET SERVER - Bun Native
// ===========================================

import type { ServerWebSocket } from 'bun';
import { verifyToken, type TokenPayload } from './auth.js';
import { ConnectionManager, type ClientConnection } from './connection-manager.js';
import { handleSubscribe, handleUnsubscribe } from './handlers/subscribe.js';
import { handlePlaceOrder, handleCancelOrder, handleGetPendingOrders } from './handlers/place-order.js';
import { handleClosePosition } from './handlers/close-position.js';
import { handleModifyPosition } from './handlers/modify-position.js';
import { handleGetPositions } from './handlers/get-positions.js';
import type { PriceEngine } from '../price/price-engine.js';
import { getOrderTriggerEngine, type OrderFillEvent } from '../triggers/order-trigger-engine.js';

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
}

// ===========================================
// SERVER INSTANCE
// ===========================================

let connectionManager: ConnectionManager;
let priceEngineRef: PriceEngine;

export function startWebSocketServer(port: number, priceEngine: PriceEngine) {
  connectionManager = new ConnectionManager();
  priceEngineRef = priceEngine;

  // Initialize and start OrderTriggerEngine for limit orders
  const orderTriggerEngine = getOrderTriggerEngine();
  orderTriggerEngine.initialize(priceEngine);
  orderTriggerEngine.start();

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

  // Subscribe to price updates and broadcast to clients
  priceEngine.onPriceUpdate((symbol, price) => {
    connectionManager.broadcastToSubscribers(symbol, {
      type: 'PRICE_UPDATE',
      symbol,
      bid: price.ourBid,
      ask: price.ourAsk,
      spread: price.ourAsk - price.ourBid,
      midPrice: price.midPrice,
      timestamp: price.timestamp,
    });
  });

  const server = Bun.serve<WebSocketData>({
    port,
    fetch(req, server) {
      // Upgrade HTTP to WebSocket
      const url = new URL(req.url);

      if (url.pathname === '/ws' || url.pathname === '/') {
        const connectionId = crypto.randomUUID();

        const upgraded = server.upgrade(req, {
          data: {
            connectionId,
            authenticated: false,
            subscriptions: new Set<string>(),
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

        // Send welcome message
        ws.send(
          JSON.stringify({
            type: 'CONNECTED',
            connectionId: ws.data.connectionId,
            message: 'Connected to PropFirm Trading Engine. Please authenticate.',
          })
        );
      },

      // Message received
      async message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
        try {
          const data = JSON.parse(message.toString()) as InboundMessage;

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
              handleSubscribe(ws, data.symbols as string[], connectionManager);
              break;

            case 'UNSUBSCRIBE':
              handleUnsubscribe(ws, data.symbols as string[], connectionManager);
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
        console.log(`[WS] Connection closed: ${ws.data.connectionId} (${code}: ${reason})`);

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
      orderTriggerEngine.stop();
      server.stop();
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

