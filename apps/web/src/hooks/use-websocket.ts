"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";

// Enable Immer's MapSet plugin for Set/Map support in store
enableMapSet();

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3002";

// ===========================================
// CONFIGURATION
// ===========================================

const CLIENT_PING_INTERVAL_MS = 25000;     // Send ping every 25 seconds (before server timeout)
const MAX_RECONNECT_ATTEMPTS = 10;          // Max reconnection attempts before giving up
const MAX_RECONNECT_DELAY_MS = 30000;       // Max delay between reconnects
const CONNECTION_HEALTH_CHECK_MS = 5000;    // Check connection health every 5 seconds

// Debug logging - only in development
const isDev = process.env.NODE_ENV === "development";
const debugLog = (...args: unknown[]) => {
  if (isDev) {
    console.log("[WS]", ...args);
  }
};
const debugWarn = (...args: unknown[]) => {
  if (isDev) {
    console.warn("[WS]", ...args);
  }
};
const debugError = (...args: unknown[]) => {
  // Always log errors, but sanitize sensitive data in production
  if (isDev) {
    console.error("[WS]", ...args);
  } else {
    console.error("[WS] Error occurred");
  }
};

// Type guards for runtime validation
function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value) && isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isPosition(value: unknown): value is Position {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    isString(p.id) &&
    isString(p.accountId) &&
    isString(p.symbol) &&
    (p.side === "LONG" || p.side === "SHORT") &&
    isNumber(p.entryPrice) &&
    isNumber(p.quantity)
  );
}

function isPositionArray(value: unknown): value is Position[] {
  return Array.isArray(value) && value.every(isPosition);
}

function isPendingOrder(value: unknown): value is PendingOrder {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    isString(o.id) &&
    isString(o.accountId) &&
    isString(o.symbol) &&
    (o.side === "LONG" || o.side === "SHORT") &&
    isNumber(o.quantity) &&
    isNumber(o.limitPrice)
  );
}

function isPendingOrderArray(value: unknown): value is PendingOrder[] {
  return Array.isArray(value) && value.every(isPendingOrder);
}

// Types
export interface PriceData {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  timestamp: number;
  // 24h stats from Binance
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  // Funding rate from Binance Futures
  fundingRate: number;
  nextFundingTime: number;
}

export interface Position {
  id: string;
  accountId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  quantity: number;
  leverage: number;
  takeProfit?: number;
  stopLoss?: number;
  unrealizedPnl: number;
  openedAt: string;
  // Additional fields from backend
  entryValue: number;
  marginUsed: number;
  entryFee: number;
  accumulatedFunding: number;
  liquidationPrice: number;
  currentPrice?: number;
}

export interface OrderResponse {
  success: boolean;
  orderId?: string;
  positionId?: string;
  error?: string;
  executionTime?: number;
}

export interface PendingOrder {
  id: string;
  accountId: string;
  clientOrderId?: string;
  symbol: string;
  side: "LONG" | "SHORT";
  quantity: number;
  limitPrice: number;
  leverage: number;
  takeProfit?: number;
  stopLoss?: number;
  marginReserved: number;
  createdAt: string;
}

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

interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

// Connection state enum for better tracking
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'authenticated' | 'reconnecting';

// Store for trading state
interface TradingStore {
  // Connection
  isConnected: boolean;
  isAuthenticated: boolean;
  connectionState: ConnectionState;
  reconnectAttempts: number;
  lastPingTime: number;
  lastPongTime: number;
  setConnected: (connected: boolean) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setConnectionState: (state: ConnectionState) => void;
  setReconnectAttempts: (attempts: number) => void;
  updatePingPong: (type: 'ping' | 'pong') => void;

  // Subscriptions (for restoration after reconnect)
  subscribedSymbols: Set<string>;
  addSubscription: (symbol: string) => void;
  removeSubscription: (symbol: string) => void;
  clearSubscriptions: () => void;

  // Prices
  prices: Record<string, PriceData>;
  updatePrice: (symbol: string, price: PriceData) => void;

  // Positions
  positions: Position[];
  setPositions: (positions: Position[]) => void;
  addPosition: (position: Position) => void;
  updatePosition: (id: string, updates: Partial<Position>) => void;
  removePosition: (id: string) => void;

  // Pending Orders (limit orders waiting to fill)
  pendingOrders: PendingOrder[];
  setPendingOrders: (orders: PendingOrder[]) => void;
  addPendingOrder: (order: PendingOrder) => void;
  removePendingOrder: (orderId: string) => void;

  // Selected account
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;

  // Account balance (real-time updates)
  accountBalance: {
    currentBalance: number;
    startingBalance: number;
    availableMargin: number;
    dailyPnl: number;
    totalMarginUsed: number;
    // Risk metrics
    dailyLossLimit: number;
    maxDrawdownLimit: number;
    peakBalance: number;
  } | null;
  setAccountBalance: (balance: {
    currentBalance: number;
    startingBalance: number;
    availableMargin: number;
    dailyPnl: number;
    totalMarginUsed: number;
    dailyLossLimit: number;
    maxDrawdownLimit: number;
    peakBalance: number;
  } | null) => void;
  updateAccountBalance: (updates: Partial<{
    currentBalance: number;
    availableMargin: number;
    dailyPnl: number;
    totalMarginUsed: number;
    peakBalance: number;
  }>) => void;

  // Order state
  lastOrderResponse: OrderResponse | null;
  setLastOrderResponse: (response: OrderResponse | null) => void;

  // Order book
  orderBooks: Record<string, OrderBookData>;
  updateOrderBook: (symbol: string, orderBook: OrderBookData) => void;

  // Reset on disconnect
  resetOnDisconnect: () => void;
}

// Use immer middleware for safe state mutations during rapid updates
export const useTradingStore = create<TradingStore>()(
  immer((set) => ({
    // Connection state
    isConnected: false,
    isAuthenticated: false,
    connectionState: 'disconnected' as ConnectionState,
    reconnectAttempts: 0,
    lastPingTime: 0,
    lastPongTime: 0,
    setConnected: (connected) => set({ isConnected: connected }),
    setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
    setConnectionState: (state) => set({ connectionState: state }),
    setReconnectAttempts: (attempts) => set({ reconnectAttempts: attempts }),
    updatePingPong: (type) => set((state) => {
      if (type === 'ping') {
        state.lastPingTime = Date.now();
      } else {
        state.lastPongTime = Date.now();
      }
    }),

    // Subscriptions tracking
    subscribedSymbols: new Set<string>(),
    addSubscription: (symbol) => set((state) => {
      state.subscribedSymbols.add(symbol);
    }),
    removeSubscription: (symbol) => set((state) => {
      state.subscribedSymbols.delete(symbol);
    }),
    clearSubscriptions: () => set((state) => {
      state.subscribedSymbols.clear();
    }),

    prices: {},
    // Immer allows direct mutation - prevents race conditions with rapid price updates
    updatePrice: (symbol, price) =>
      set((state) => {
        state.prices[symbol] = price;
      }),

    positions: [],
    setPositions: (positions) => set({ positions }),
    addPosition: (position) =>
      set((state) => {
        // Avoid duplicates
        if (!state.positions.some((p: Position) => p.id === position.id)) {
          state.positions.push(position);
        }
      }),
    updatePosition: (id, updates) =>
      set((state) => {
        const index = state.positions.findIndex((p: Position) => p.id === id);
        if (index !== -1) {
          Object.assign(state.positions[index], updates);
        }
      }),
    removePosition: (id) =>
      set((state) => {
        const index = state.positions.findIndex((p: Position) => p.id === id);
        if (index !== -1) {
          state.positions.splice(index, 1);
        }
      }),

    pendingOrders: [],
    setPendingOrders: (orders) => set({ pendingOrders: orders }),
    addPendingOrder: (order) =>
      set((state) => {
        // Avoid duplicates
        if (!state.pendingOrders.some((o: PendingOrder) => o.id === order.id)) {
          state.pendingOrders.push(order);
        }
      }),
    removePendingOrder: (orderId) =>
      set((state) => {
        const index = state.pendingOrders.findIndex((o: PendingOrder) => o.id === orderId);
        if (index !== -1) {
          state.pendingOrders.splice(index, 1);
        }
      }),

    selectedAccountId: null,
    setSelectedAccountId: (id) => set({ selectedAccountId: id }),

    // Account balance
    accountBalance: null,
    setAccountBalance: (balance) => set({ accountBalance: balance }),
    updateAccountBalance: (updates) => set((state) => {
      if (state.accountBalance) {
        Object.assign(state.accountBalance, updates);
      }
    }),

    lastOrderResponse: null,
    setLastOrderResponse: (response) => set({ lastOrderResponse: response }),

    // Order book
    orderBooks: {},
    updateOrderBook: (symbol, orderBook) =>
      set((state) => {
        console.log(`[Store] updateOrderBook ${symbol}:`, orderBook.bids.length, 'bids,', orderBook.asks.length, 'asks');
        state.orderBooks[symbol] = orderBook;
      }),

    // Reset certain state on disconnect (preserve subscriptions for restore)
    resetOnDisconnect: () => set((state) => {
      state.isConnected = false;
      state.isAuthenticated = false;
      state.connectionState = 'disconnected';
      // Don't clear positions/orders - they'll be refreshed on reconnect
      // Don't clear subscribedSymbols - we need them for restoration
    }),
  }))
);

// ===========================================
// SINGLETON WEBSOCKET CONNECTION
// ===========================================
// Only ONE WebSocket connection across all components

let globalWs: WebSocket | null = null;
let globalReconnectTimeout: NodeJS.Timeout | null = null;
let globalPingInterval: NodeJS.Timeout | null = null;
let globalIsReconnecting = false;
let globalMessageHandler: ((message: WebSocketMessage) => void) | null = null;

// WebSocket hook
export function useWebSocket() {
  // Use module-level singleton instead of per-hook refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isReconnectingRef = useRef(false);
  const handleMessageRef = useRef<((message: WebSocketMessage) => void) | null>(null);

  // Sync with global singleton
  wsRef.current = globalWs;

  const {
    setConnected,
    setAuthenticated,
    setConnectionState,
    setReconnectAttempts,
    updatePingPong,
    subscribedSymbols,
    addSubscription,
    removeSubscription,
    updatePrice,
    setPositions,
    addPosition,
    updatePosition,
    removePosition,
    setPendingOrders,
    addPendingOrder,
    removePendingOrder,
    setLastOrderResponse,
    updateOrderBook,
    updateAccountBalance,
    selectedAccountId,
    resetOnDisconnect,
    reconnectAttempts,
  } = useTradingStore();

  // Stop ping interval
  const stopPingInterval = useCallback(() => {
    if (globalPingInterval) {
      clearInterval(globalPingInterval);
      globalPingInterval = null;
    }
    pingIntervalRef.current = null;
  }, []);

  // Start ping interval to keep connection alive
  const startPingInterval = useCallback(() => {
    stopPingInterval();
    globalPingInterval = setInterval(() => {
      if (globalWs?.readyState === WebSocket.OPEN) {
        globalWs.send(JSON.stringify({ type: "PONG", timestamp: Date.now() }));
        updatePingPong('ping');
      }
    }, CLIENT_PING_INTERVAL_MS);
    pingIntervalRef.current = globalPingInterval;
  }, [stopPingInterval, updatePingPong]);

  // Restore subscriptions after reconnect
  const restoreSubscriptions = useCallback(() => {
    if (globalWs?.readyState !== WebSocket.OPEN) return;

    const symbols = Array.from(subscribedSymbols);
    if (symbols.length > 0) {
      debugLog(`Restoring ${symbols.length} subscriptions:`, symbols);
      globalWs.send(JSON.stringify({ type: "SUBSCRIBE", symbols }));
    }
  }, [subscribedSymbols]);

  // Refresh positions and orders after reconnect
  const refreshDataAfterReconnect = useCallback(() => {
    if (globalWs?.readyState !== WebSocket.OPEN) return;

    const accountId = useTradingStore.getState().selectedAccountId;
    if (accountId) {
      debugLog("Refreshing positions and orders for account:", accountId);
      globalWs.send(JSON.stringify({ type: "GET_POSITIONS", accountId }));
      globalWs.send(JSON.stringify({ type: "GET_PENDING_ORDERS", accountId }));
    }
  }, []);

  const connect = useCallback(() => {
    // Use global singleton - check if already connected
    if (globalWs?.readyState === WebSocket.OPEN) {
      debugLog("Already connected (singleton)");
      wsRef.current = globalWs;
      return;
    }
    if (globalWs?.readyState === WebSocket.CONNECTING) {
      debugLog("Already connecting (singleton)");
      wsRef.current = globalWs;
      return;
    }

    // SECURITY: Get token from sessionStorage (more secure than localStorage)
    const token = sessionStorage.getItem("ws_token");
    if (!token) {
      debugLog("No auth token, skipping connection");
      setConnectionState('disconnected');
      return;
    }

    const isReconnecting = globalIsReconnecting;
    setConnectionState(isReconnecting ? 'reconnecting' : 'connecting');
    debugLog(isReconnecting ? "Reconnecting..." : "Connecting (singleton)...");

    const ws = new WebSocket(WS_URL);
    globalWs = ws;
    wsRef.current = ws;

    ws.onopen = () => {
      debugLog("Connected");
      setConnected(true);
      setConnectionState('connected');
      setReconnectAttempts(0);
      isReconnectingRef.current = false;

      // Start ping interval
      startPingInterval();

      // Authenticate
      ws.send(JSON.stringify({ type: "AUTH", token }));
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        // Use global message handler if available, otherwise use local handleMessage
        // This handles the race condition during initial connection
        const handler = globalMessageHandler || handleMessage;
        handler(message);
      } catch (error) {
        debugError("Failed to parse message");
      }
    };

    ws.onclose = (event) => {
      debugLog(`Disconnected (code: ${event.code}, reason: ${event.reason || 'none'})`);

      // Stop ping interval
      stopPingInterval();

      // Reset state and global singleton
      resetOnDisconnect();
      globalWs = null;
      wsRef.current = null;

      // Don't reconnect if closed cleanly (code 1000) and not a timeout
      if (event.code === 1000 && event.reason === 'Client disconnect') {
        debugLog("Clean disconnect, not reconnecting");
        return;
      }

      // Check if we've exceeded max reconnection attempts
      const currentAttempts = useTradingStore.getState().reconnectAttempts;
      if (currentAttempts >= MAX_RECONNECT_ATTEMPTS) {
        debugError(`Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
        setConnectionState('disconnected');
        return;
      }

      // Reconnect with exponential backoff
      globalIsReconnecting = true;
      const delay = Math.min(1000 * Math.pow(2, currentAttempts), MAX_RECONNECT_DELAY_MS);
      debugLog(`Reconnecting in ${delay}ms (attempt ${currentAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);

      setConnectionState('reconnecting');
      setReconnectAttempts(currentAttempts + 1);

      globalReconnectTimeout = setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = (error) => {
      debugError("Connection error");
    };
  }, [setConnected, setAuthenticated, setConnectionState, setReconnectAttempts, startPingInterval, stopPingInterval, resetOnDisconnect]);

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      // Log ALL incoming messages for debugging
      if (message.type !== 'PRICE_UPDATE' && message.type !== 'PING') {
        debugLog("Received message:", message.type);
      }

      switch (message.type) {
        // Handle server PING - respond with PONG
        case "PING":
          if (globalWs?.readyState === WebSocket.OPEN) {
            globalWs.send(JSON.stringify({ type: "PONG", timestamp: Date.now() }));
            updatePingPong('pong');
          }
          break;

        case "AUTH_SUCCESS":
        case "AUTHENTICATED":
          debugLog("Authenticated");
          setAuthenticated(true);
          setConnectionState('authenticated');

          // After authentication, restore subscriptions and refresh data
          // Use setTimeout to ensure state is updated
          setTimeout(() => {
            restoreSubscriptions();
            refreshDataAfterReconnect();
          }, 100);
          break;

        case "CONNECTED":
          debugLog("Server acknowledged connection");
          // Server sends heartbeatInterval - we can use it if needed
          if (isNumber(message.heartbeatInterval)) {
            debugLog(`Server heartbeat interval: ${message.heartbeatInterval}ms`);
          }
          break;

        case "AUTH_ERROR":
        case "AUTH_FAILED":
          debugError("Auth failed");
          setAuthenticated(false);
          setConnectionState('connected'); // Still connected, just not authenticated
          break;

        case "PRICE_UPDATE":
          {
            // Type-safe price update
            const bid = isNumber(message.bid) ? message.bid : 0;
            const ask = isNumber(message.ask) ? message.ask : 0;
            const symbol = isString(message.symbol) ? message.symbol : "";
            const timestamp = isNumber(message.timestamp) ? message.timestamp : Date.now();

            if (!symbol || bid <= 0 || ask <= 0) break;

            const spread = isNumber(message.spread) ? message.spread : (ask - bid);

            // 24h stats
            const priceChange24h = isNumber(message.priceChange24h) ? message.priceChange24h : 0;
            const priceChangePercent24h = isNumber(message.priceChangePercent24h) ? message.priceChangePercent24h : 0;
            const high24h = isNumber(message.high24h) ? message.high24h : 0;
            const low24h = isNumber(message.low24h) ? message.low24h : 0;
            const volume24h = isNumber(message.volume24h) ? message.volume24h : 0;
            const quoteVolume24h = isNumber(message.quoteVolume24h) ? message.quoteVolume24h : 0;

            // Funding rate
            const fundingRate = isNumber(message.fundingRate) ? message.fundingRate : 0;
            const nextFundingTime = isNumber(message.nextFundingTime) ? message.nextFundingTime : 0;

            updatePrice(symbol, {
              symbol,
              bid,
              ask,
              spread,
              timestamp,
              priceChange24h,
              priceChangePercent24h,
              high24h,
              low24h,
              volume24h,
              quoteVolume24h,
              fundingRate,
              nextFundingTime,
            });
          }
          break;

        case "POSITIONS":
          if (isPositionArray(message.positions)) {
            setPositions(message.positions);
          }
          break;

        case "POSITION_OPENED":
          if (isPosition(message.position)) {
            addPosition(message.position);
            setLastOrderResponse({
              success: true,
              orderId: isString(message.orderId) ? message.orderId : undefined,
              positionId: message.position.id,
              executionTime: isNumber(message.executionTime) ? message.executionTime : undefined,
            });
          }
          break;

        case "POSITION_UPDATED":
          if (isString(message.positionId) && message.updates) {
            updatePosition(message.positionId, message.updates as Partial<Position>);
          }
          break;

        case "POSITION_CLOSED":
          if (isString(message.positionId)) {
            removePosition(message.positionId);
          }
          // Update account balance from position close
          if (message.account && typeof message.account === 'object') {
            const acc = message.account as Record<string, unknown>;
            updateAccountBalance({
              currentBalance: isNumber(acc.currentBalance) ? acc.currentBalance : undefined,
              availableMargin: isNumber(acc.availableMargin) ? acc.availableMargin : undefined,
              dailyPnl: isNumber(acc.dailyPnl) ? acc.dailyPnl : undefined,
            });
          }
          break;

        case "POSITION_PARTIALLY_CLOSED":
          if (isString(message.positionId) && message.updatedPosition) {
            updatePosition(message.positionId, message.updatedPosition as Partial<Position>);
          }
          break;

        case "POSITION_CLOSED_TRIGGER":
          if (isString(message.positionId)) {
            removePosition(message.positionId);
            debugLog(`Position closed by trigger: ${message.reason}`);
          }
          break;

        case "ORDER_RECEIVED":
          setLastOrderResponse({
            success: true,
            orderId: isString(message.orderId) ? message.orderId : undefined,
          });
          break;

        case "ORDER_FILLED":
          if (isPosition(message.position)) {
            addPosition(message.position);
          }
          if (message.filledFromQueue && isString(message.orderId)) {
            removePendingOrder(message.orderId);
          }
          // Update account balance from order fill
          if (message.account && typeof message.account === 'object') {
            const acc = message.account as Record<string, unknown>;
            updateAccountBalance({
              currentBalance: isNumber(acc.currentBalance) ? acc.currentBalance : undefined,
              availableMargin: isNumber(acc.availableMargin) ? acc.availableMargin : undefined,
              totalMarginUsed: isNumber(acc.totalMarginUsed) ? acc.totalMarginUsed : undefined,
            });
          }
          setLastOrderResponse({
            success: true,
            orderId: isString(message.orderId) ? message.orderId : undefined,
            positionId: isPosition(message.position) ? message.position.id : undefined,
            executionTime: isNumber(message.executionTime) ? message.executionTime : undefined,
          });
          break;

        case "ORDER_REJECTED":
          setLastOrderResponse({
            success: false,
            error: isString(message.reason) ? message.reason : isString(message.error) ? message.error : "Order rejected",
          });
          break;

        case "ORDER_PENDING":
          {
            // Validate required fields before adding
            const orderId = isString(message.orderId) ? message.orderId : "";
            const accountId = isString(message.accountId) ? message.accountId : "";
            const symbol = isString(message.symbol) ? message.symbol : "";
            const side = message.side === "LONG" || message.side === "SHORT" ? message.side : "LONG";
            const quantity = isNumber(message.quantity) ? message.quantity : 0;
            const limitPrice = isNumber(message.limitPrice) ? message.limitPrice : 0;

            if (orderId && accountId && symbol && quantity > 0 && limitPrice > 0) {
              addPendingOrder({
                id: orderId,
                accountId,
                clientOrderId: isString(message.clientOrderId) ? message.clientOrderId : undefined,
                symbol,
                side,
                quantity,
                limitPrice,
                leverage: isNumber(message.leverage) ? message.leverage : 1,
                marginReserved: isNumber(message.marginReserved) ? message.marginReserved : 0,
                createdAt: new Date().toISOString(),
              });
              setLastOrderResponse({ success: true, orderId });
              debugLog("Limit order queued");
            }
          }
          break;

        case "ORDER_CANCELLED":
          if (isString(message.orderId)) {
            removePendingOrder(message.orderId);
            debugLog("Order cancelled");
          }
          break;

        case "PENDING_ORDERS":
          if (isPendingOrderArray(message.orders)) {
            setPendingOrders(message.orders);
          }
          break;

        case "ACCOUNT_BREACHED":
          debugError("Account breached");
          // Could show a modal notification here
          break;

        case "RISK_WARNING":
          debugWarn("Risk warning received");
          // Could show a toast notification here
          break;

        case "ORDER_BOOK_SNAPSHOT":
        case "ORDER_BOOK_UPDATE":
          {
            debugLog(`ORDER_BOOK received:`, message.type, message.symbol);
            const symbol = isString(message.symbol) ? message.symbol : "";
            if (!symbol) break;

            const bids = Array.isArray(message.bids) ? message.bids : [];
            const asks = Array.isArray(message.asks) ? message.asks : [];
            debugLog(`ORDER_BOOK ${symbol}: ${bids.length} bids, ${asks.length} asks`);
            const lastUpdateId = isNumber(message.lastUpdateId) ? message.lastUpdateId : 0;
            const timestamp = isNumber(message.timestamp) ? message.timestamp : Date.now();

            updateOrderBook(symbol, {
              symbol,
              bids: bids.map((b: { price: number; quantity: number }) => ({
                price: b.price,
                quantity: b.quantity,
              })),
              asks: asks.map((a: { price: number; quantity: number }) => ({
                price: a.price,
                quantity: a.quantity,
              })),
              lastUpdateId,
              timestamp,
            });
          }
          break;

        case "ERROR":
          debugError("Server error");
          break;

        default:
          // Silently ignore unknown message types in production
          debugLog("Unknown message type:", message.type);
      }
    },
    [
      setAuthenticated,
      setConnectionState,
      updatePingPong,
      restoreSubscriptions,
      refreshDataAfterReconnect,
      updatePrice,
      setPositions,
      addPosition,
      updatePosition,
      removePosition,
      setPendingOrders,
      addPendingOrder,
      removePendingOrder,
      setLastOrderResponse,
      updateOrderBook,
      updateAccountBalance,
    ]
  );

  // Keep global message handler updated to avoid stale closures
  useEffect(() => {
    globalMessageHandler = handleMessage;
    handleMessageRef.current = handleMessage;
  }, [handleMessage]);

  const disconnect = useCallback(() => {
    // Clear all intervals and timeouts (global)
    if (globalReconnectTimeout) {
      clearTimeout(globalReconnectTimeout);
      globalReconnectTimeout = null;
    }
    stopPingInterval();
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }

    // Close global WebSocket with clean disconnect reason
    if (globalWs) {
      globalWs.close(1000, 'Client disconnect');
      globalWs = null;
    }
    wsRef.current = null;

    // Reset reconnection state
    globalIsReconnecting = false;
    setReconnectAttempts(0);
    resetOnDisconnect();
  }, [stopPingInterval, setReconnectAttempts, resetOnDisconnect]);

  const send = useCallback((message: WebSocketMessage) => {
    // Use global singleton for sending
    debugLog("send() called:", message.type, "readyState:", globalWs?.readyState);
    if (globalWs?.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify(message));
      debugLog("Message sent:", message.type);
    } else {
      debugWarn("Cannot send - not connected, readyState:", globalWs?.readyState);
    }
  }, []);

  // Subscribe to price updates (with tracking for reconnection)
  const subscribe = useCallback(
    (symbols: string[]) => {
      // Track subscriptions for restoration after reconnect
      symbols.forEach(symbol => addSubscription(symbol));
      send({ type: "SUBSCRIBE", symbols });
    },
    [send, addSubscription]
  );

  // Unsubscribe from price updates
  const unsubscribe = useCallback(
    (symbols: string[]) => {
      // Remove from tracked subscriptions
      symbols.forEach(symbol => removeSubscription(symbol));
      send({ type: "UNSUBSCRIBE", symbols });
    },
    [send, removeSubscription]
  );

  // Subscribe to order book updates
  const subscribeOrderBook = useCallback(
    (symbols: string[]) => {
      debugLog("subscribeOrderBook called:", symbols);
      send({ type: "SUBSCRIBE_ORDER_BOOK", symbols });
    },
    [send]
  );

  // Unsubscribe from order book updates
  const unsubscribeOrderBook = useCallback(
    (symbols: string[]) => {
      send({ type: "UNSUBSCRIBE_ORDER_BOOK", symbols });
    },
    [send]
  );

  // Place order
  const placeOrder = useCallback(
    (order: {
      accountId: string;
      symbol: string;
      side: "LONG" | "SHORT";
      type: "MARKET" | "LIMIT";
      quantity: number;
      leverage?: number;
      price?: number;
      takeProfit?: number;
      stopLoss?: number;
    }) => {
      const orderTime = Date.now();
      const clientOrderId = `${orderTime}-${Math.random().toString(36).slice(2)}`;

      // Send order with data nested as expected by backend
      send({
        type: "PLACE_ORDER",
        data: {
          clientOrderId,
          accountId: order.accountId,
          symbol: order.symbol,
          side: order.side,
          type: order.type, // Backend expects "type", not "orderType"
          quantity: order.quantity,
          leverage: order.leverage, // User's selected leverage
          limitPrice: order.price,
          takeProfit: order.takeProfit,
          stopLoss: order.stopLoss,
          timestamp: orderTime, // SECURITY: Required for replay attack prevention
        },
      });
      return orderTime;
    },
    [send]
  );

  // Close position (full or partial)
  const closePosition = useCallback(
    (positionId: string, accountId: string, quantity?: number) => {
      send({
        type: "CLOSE_POSITION",
        positionId,
        accountId,
        quantity, // Optional: for partial close
      });
    },
    [send]
  );

  // Modify position (TP/SL)
  const modifyPosition = useCallback(
    (
      positionId: string,
      accountId: string,
      updates: { takeProfit?: number; stopLoss?: number }
    ) => {
      send({
        type: "MODIFY_POSITION",
        positionId,
        accountId,
        ...updates,
      });
    },
    [send]
  );

  // Get positions for account
  const getPositions = useCallback(
    (accountId: string) => {
      send({ type: "GET_POSITIONS", accountId });
    },
    [send]
  );

  // Cancel pending order
  const cancelOrder = useCallback(
    (orderId: string) => {
      send({ type: "CANCEL_ORDER", orderId });
    },
    [send]
  );

  // Get pending orders for account
  const getPendingOrders = useCallback(
    (accountId: string) => {
      send({ type: "GET_PENDING_ORDERS", accountId });
    },
    [send]
  );

  // Force reconnect (for manual recovery)
  const forceReconnect = useCallback(() => {
    debugLog("Force reconnect requested");
    // Reset attempts
    setReconnectAttempts(0);
    globalIsReconnecting = true;
    // Close existing global connection
    if (globalWs) {
      globalWs.close(1000, 'Force reconnect');
      globalWs = null;
    }
    wsRef.current = null;
    // Wait a bit then connect
    setTimeout(() => {
      connect();
    }, 500);
  }, [connect, setReconnectAttempts]);

  // Connect on mount - DON'T disconnect on unmount for singleton
  // The global connection persists across component re-renders
  useEffect(() => {
    connect();
    // Don't disconnect on unmount - the singleton should persist
    // Only disconnect if the entire app unmounts (handled by React cleanup elsewhere)
  }, []); // Empty deps - only run once on mount

  return {
    connect,
    disconnect,
    forceReconnect,
    subscribe,
    unsubscribe,
    subscribeOrderBook,
    unsubscribeOrderBook,
    placeOrder,
    closePosition,
    modifyPosition,
    getPositions,
    cancelOrder,
    getPendingOrders,
  };
}

