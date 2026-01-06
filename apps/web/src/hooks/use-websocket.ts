"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3002";

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

interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

// Store for trading state
interface TradingStore {
  // Connection
  isConnected: boolean;
  isAuthenticated: boolean;
  setConnected: (connected: boolean) => void;
  setAuthenticated: (authenticated: boolean) => void;

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

  // Order state
  lastOrderResponse: OrderResponse | null;
  setLastOrderResponse: (response: OrderResponse | null) => void;
}

// Use immer middleware for safe state mutations during rapid updates
export const useTradingStore = create<TradingStore>()(
  immer((set) => ({
    isConnected: false,
    isAuthenticated: false,
    setConnected: (connected) => set({ isConnected: connected }),
    setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),

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

    lastOrderResponse: null,
    setLastOrderResponse: (response) => set({ lastOrderResponse: response }),
  }))
);

// WebSocket hook
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  const {
    setConnected,
    setAuthenticated,
    updatePrice,
    setPositions,
    addPosition,
    updatePosition,
    removePosition,
    setPendingOrders,
    addPendingOrder,
    removePendingOrder,
    setLastOrderResponse,
  } = useTradingStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // SECURITY: Get token from sessionStorage (more secure than localStorage)
    const token = sessionStorage.getItem("ws_token");
    if (!token) {
      debugLog("No auth token, skipping connection");
      return;
    }

    debugLog("Connecting...");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      debugLog("Connected");
      setConnected(true);
      setConnectionAttempts(0);

      // Authenticate
      ws.send(JSON.stringify({ type: "AUTH", token }));
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        debugError("Failed to parse message");
      }
    };

    ws.onclose = () => {
      debugLog("Disconnected");
      setConnected(false);
      setAuthenticated(false);
      wsRef.current = null;

      // Reconnect with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 30000);
      debugLog(`Reconnecting in ${delay}ms`);
      reconnectTimeoutRef.current = setTimeout(() => {
        setConnectionAttempts((prev) => prev + 1);
        connect();
      }, delay);
    };

    ws.onerror = () => {
      debugError("Connection error");
    };
  }, [connectionAttempts, setConnected, setAuthenticated]);

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "AUTH_SUCCESS":
        case "AUTHENTICATED":
          debugLog("Authenticated");
          setAuthenticated(true);
          break;

        case "CONNECTED":
          debugLog("Server acknowledged connection");
          break;

        case "AUTH_ERROR":
          debugError("Auth failed");
          setAuthenticated(false);
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
            updatePrice(symbol, { symbol, bid, ask, spread, timestamp });
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
            const symbol = isString(message.symbol) ? message.symbol : "";
            const side = message.side === "LONG" || message.side === "SHORT" ? message.side : "LONG";
            const quantity = isNumber(message.quantity) ? message.quantity : 0;
            const limitPrice = isNumber(message.limitPrice) ? message.limitPrice : 0;

            if (orderId && symbol && quantity > 0 && limitPrice > 0) {
              addPendingOrder({
                id: orderId,
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
      updatePrice,
      setPositions,
      addPosition,
      updatePosition,
      removePosition,
      setPendingOrders,
      addPendingOrder,
      removePendingOrder,
      setLastOrderResponse,
    ]
  );

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      debugWarn("Cannot send - not connected");
    }
  }, []);

  // Subscribe to price updates
  const subscribe = useCallback(
    (symbols: string[]) => {
      send({ type: "SUBSCRIBE", symbols });
    },
    [send]
  );

  // Unsubscribe from price updates
  const unsubscribe = useCallback(
    (symbols: string[]) => {
      send({ type: "UNSUBSCRIBE", symbols });
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

  // Connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    placeOrder,
    closePosition,
    modifyPosition,
    getPositions,
    cancelOrder,
    getPendingOrders,
  };
}

