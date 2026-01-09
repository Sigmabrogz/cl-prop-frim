// ===========================================
// CONNECTION MANAGER
// ===========================================

import type { ServerWebSocket } from 'bun';
import type { OutboundMessage } from './server.js';

export interface ClientConnection {
  id: string;
  ws: ServerWebSocket<any>;
  userId: string;
  accountId?: string;
  subscriptions: Set<string>;
  connectedAt: Date;
}

// Throttle config: max 20 price updates per second per symbol
const PRICE_UPDATE_THROTTLE_MS = 50; // 50ms = 20 updates/sec max
const MAX_BUFFERED_AMOUNT = 65536; // 64KB - skip if buffer exceeds this

export class ConnectionManager {
  // Connection ID -> Connection
  private connections: Map<string, ClientConnection> = new Map();

  // User ID -> Connection IDs
  private userConnections: Map<string, Set<string>> = new Map();

  // Account ID -> Connection IDs
  private accountConnections: Map<string, Set<string>> = new Map();

  // Symbol -> Connection IDs (for price subscriptions)
  private symbolSubscriptions: Map<string, Set<string>> = new Map();

  // Throttling: Symbol -> last broadcast timestamp
  private lastBroadcastTime: Map<string, number> = new Map();

  // Pending broadcasts for throttled symbols
  private pendingBroadcasts: Map<string, OutboundMessage> = new Map();

  /**
   * Add a new connection
   */
  addConnection(connection: ClientConnection): void {
    this.connections.set(connection.id, connection);

    // Index by user
    if (!this.userConnections.has(connection.userId)) {
      this.userConnections.set(connection.userId, new Set());
    }
    this.userConnections.get(connection.userId)!.add(connection.id);

    // Index by account if set
    if (connection.accountId) {
      if (!this.accountConnections.has(connection.accountId)) {
        this.accountConnections.set(connection.accountId, new Set());
      }
      this.accountConnections.get(connection.accountId)!.add(connection.id);
    }
  }

  /**
   * Remove a connection
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from user index
    const userConns = this.userConnections.get(connection.userId);
    if (userConns) {
      userConns.delete(connectionId);
      if (userConns.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    // Remove from account index
    if (connection.accountId) {
      const accountConns = this.accountConnections.get(connection.accountId);
      if (accountConns) {
        accountConns.delete(connectionId);
        if (accountConns.size === 0) {
          this.accountConnections.delete(connection.accountId);
        }
      }
    }

    // Remove from symbol subscriptions
    for (const symbol of connection.subscriptions) {
      const symbolConns = this.symbolSubscriptions.get(symbol);
      if (symbolConns) {
        symbolConns.delete(connectionId);
        if (symbolConns.size === 0) {
          this.symbolSubscriptions.delete(symbol);
        }
      }
    }

    // Remove connection
    this.connections.delete(connectionId);
  }

  /**
   * Get a connection by ID
   */
  getConnection(connectionId: string): ClientConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Set account ID for a connection
   */
  setAccountId(connectionId: string, accountId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from old account index if exists
    if (connection.accountId) {
      const oldAccountConns = this.accountConnections.get(connection.accountId);
      if (oldAccountConns) {
        oldAccountConns.delete(connectionId);
        if (oldAccountConns.size === 0) {
          this.accountConnections.delete(connection.accountId);
        }
      }
    }

    // Set new account ID
    connection.accountId = accountId;

    // Add to new account index
    if (!this.accountConnections.has(accountId)) {
      this.accountConnections.set(accountId, new Set());
    }
    this.accountConnections.get(accountId)!.add(connectionId);
  }

  /**
   * Subscribe connection to a symbol
   */
  subscribe(connectionId: string, symbol: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.subscriptions.add(symbol);

    if (!this.symbolSubscriptions.has(symbol)) {
      this.symbolSubscriptions.set(symbol, new Set());
    }
    this.symbolSubscriptions.get(symbol)!.add(connectionId);
  }

  /**
   * Unsubscribe connection from a symbol
   */
  unsubscribe(connectionId: string, symbol: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.subscriptions.delete(symbol);

    const symbolConns = this.symbolSubscriptions.get(symbol);
    if (symbolConns) {
      symbolConns.delete(connectionId);
      if (symbolConns.size === 0) {
        this.symbolSubscriptions.delete(symbol);
      }
    }
  }

  /**
   * Send message to a specific connection
   */
  send(connectionId: string, message: OutboundMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      connection.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[ConnectionManager] Failed to send to ${connectionId}:`, error);
      this.removeConnection(connectionId);
    }
  }

  /**
   * Send message to all connections for a user
   */
  sendToUser(userId: string, message: OutboundMessage): void {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) return;

    const messageStr = JSON.stringify(message);
    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        try {
          connection.ws.send(messageStr);
        } catch (error) {
          console.error(`[ConnectionManager] Failed to send to ${connectionId}:`, error);
          this.removeConnection(connectionId);
        }
      }
    }
  }

  /**
   * Send message to all connections for an account
   */
  sendToAccount(accountId: string, message: OutboundMessage): void {
    const connectionIds = this.accountConnections.get(accountId);
    if (!connectionIds) return;

    const messageStr = JSON.stringify(message);
    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        try {
          connection.ws.send(messageStr);
        } catch (error) {
          console.error(`[ConnectionManager] Failed to send to ${connectionId}:`, error);
          this.removeConnection(connectionId);
        }
      }
    }
  }

  /**
   * Broadcast to all subscribers of a symbol (with throttling for price updates)
   */
  broadcastToSubscribers(symbol: string, message: OutboundMessage): void {
    const connectionIds = this.symbolSubscriptions.get(symbol);
    if (!connectionIds || connectionIds.size === 0) return;

    const now = Date.now();
    const lastTime = this.lastBroadcastTime.get(symbol) || 0;

    // Throttle price updates - only send max 10/sec per symbol
    if (message.type === 'PRICE_UPDATE') {
      if (now - lastTime < PRICE_UPDATE_THROTTLE_MS) {
        // Store for later - latest price will be sent on next tick
        this.pendingBroadcasts.set(symbol, message);
        return;
      }
      this.lastBroadcastTime.set(symbol, now);
      this.pendingBroadcasts.delete(symbol);
    }

    const messageStr = JSON.stringify(message);
    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        try {
          // Check backpressure for non-critical messages
          if (message.type === 'PRICE_UPDATE' || message.type === 'ORDER_BOOK_UPDATE') {
            const buffered = (connection.ws as any).bufferedAmount ?? 0;
            if (buffered > MAX_BUFFERED_AMOUNT) {
              continue; // Skip this update, buffer too full
            }
          }
          connection.ws.send(messageStr);
        } catch (error) {
          // Silent fail for price broadcasts - high volume
          this.removeConnection(connectionId);
        }
      }
    }
  }

  /**
   * Flush any pending throttled broadcasts (call this periodically)
   */
  flushPendingBroadcasts(): void {
    const now = Date.now();
    for (const [symbol, message] of this.pendingBroadcasts) {
      const lastTime = this.lastBroadcastTime.get(symbol) || 0;
      if (now - lastTime >= PRICE_UPDATE_THROTTLE_MS) {
        this.broadcastToSubscribers(symbol, message);
      }
    }
  }

  /**
   * Broadcast to all connections
   */
  broadcastAll(message: OutboundMessage): void {
    const messageStr = JSON.stringify(message);
    for (const connection of this.connections.values()) {
      try {
        connection.ws.send(messageStr);
      } catch (error) {
        this.removeConnection(connection.id);
      }
    }
  }

  /**
   * Get total connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get subscribed symbols
   */
  getSubscribedSymbols(): string[] {
    return Array.from(this.symbolSubscriptions.keys());
  }

  /**
   * Get subscriber count for a symbol
   */
  getSubscriberCount(symbol: string): number {
    return this.symbolSubscriptions.get(symbol)?.size || 0;
  }
}

