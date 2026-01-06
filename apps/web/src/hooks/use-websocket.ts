"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { create } from "zustand";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3002";

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

  // Selected account
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;

  // Order state
  lastOrderResponse: OrderResponse | null;
  setLastOrderResponse: (response: OrderResponse | null) => void;
}

export const useTradingStore = create<TradingStore>((set) => ({
  isConnected: false,
  isAuthenticated: false,
  setConnected: (connected) => set({ isConnected: connected }),
  setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),

  prices: {},
  updatePrice: (symbol, price) =>
    set((state) => ({
      prices: { ...state.prices, [symbol]: price },
    })),

  positions: [],
  setPositions: (positions) => set({ positions }),
  addPosition: (position) =>
    set((state) => ({
      positions: [...state.positions, position],
    })),
  updatePosition: (id, updates) =>
    set((state) => ({
      positions: state.positions.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),
  removePosition: (id) =>
    set((state) => ({
      positions: state.positions.filter((p) => p.id !== id),
    })),

  selectedAccountId: null,
  setSelectedAccountId: (id) => set({ selectedAccountId: id }),

  lastOrderResponse: null,
  setLastOrderResponse: (response) => set({ lastOrderResponse: response }),
}));

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
    setLastOrderResponse,
  } = useTradingStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // SECURITY: Get token from sessionStorage (more secure than localStorage)
    const token = sessionStorage.getItem("ws_token");
    if (!token) {
      console.log("[WS] No auth token, skipping connection");
      return;
    }

    console.log("[WS] Connecting to", WS_URL);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected");
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
        console.error("[WS] Failed to parse message:", error);
      }
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected");
      setConnected(false);
      setAuthenticated(false);
      wsRef.current = null;

      // Reconnect with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 30000);
      console.log(`[WS] Reconnecting in ${delay}ms`);
      reconnectTimeoutRef.current = setTimeout(() => {
        setConnectionAttempts((prev) => prev + 1);
        connect();
      }, delay);
    };

    ws.onerror = (error) => {
      console.error("[WS] Error:", error);
    };
  }, [connectionAttempts, setConnected, setAuthenticated]);

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "AUTH_SUCCESS":
        case "AUTHENTICATED":
          console.log("[WS] Authenticated");
          setAuthenticated(true);
          break;

        case "CONNECTED":
          console.log("[WS] Server acknowledged connection");
          break;

        case "AUTH_ERROR":
          console.error("[WS] Auth failed:", message.error);
          setAuthenticated(false);
          break;

        case "PRICE_UPDATE":
          {
            const bid = message.bid as number;
            const ask = message.ask as number;
            // Calculate spread if not provided
            const spread = (message.spread as number) || (ask - bid);
            updatePrice(message.symbol as string, {
              symbol: message.symbol as string,
              bid,
              ask,
              spread,
              timestamp: message.timestamp as number,
            });
          }
          break;

        case "POSITIONS":
          setPositions(message.positions as Position[]);
          break;

        case "POSITION_OPENED":
          addPosition(message.position as Position);
          setLastOrderResponse({
            success: true,
            orderId: message.orderId as string,
            positionId: (message.position as Position).id,
            executionTime: message.executionTime as number,
          });
          break;

        case "POSITION_UPDATED":
          updatePosition(
            message.positionId as string,
            message.updates as Partial<Position>
          );
          break;

        case "POSITION_CLOSED":
          removePosition(message.positionId as string);
          break;

        case "POSITION_CLOSED_TRIGGER":
          removePosition(message.positionId as string);
          // Could show a toast notification here
          console.log(
            `[WS] Position ${message.positionId} closed by ${message.reason}`
          );
          break;

        case "ORDER_RECEIVED":
          // Order acknowledged by server, waiting for fill
          console.log("[WS] Order received:", message.clientOrderId);
          setLastOrderResponse({
            success: true,
            orderId: message.orderId as string,
            executionTime: Date.now() - (parseInt((message.clientOrderId as string)?.split('-')[0] || '0') || Date.now()),
          });
          break;

        case "ORDER_FILLED":
          // Order has been filled and position opened
          if (message.position) {
            addPosition(message.position as Position);
          }
          setLastOrderResponse({
            success: true,
            orderId: message.orderId as string,
            positionId: (message.position as Position)?.id,
            executionTime: message.executionTime as number,
          });
          break;

        case "ORDER_REJECTED":
          setLastOrderResponse({
            success: false,
            error: message.reason as string || message.error as string,
          });
          break;

        case "ACCOUNT_BREACHED":
          console.error("[WS] Account breached:", message);
          // Could show a modal notification here
          break;

        case "RISK_WARNING":
          console.warn("[WS] Risk warning:", message);
          // Could show a toast notification here
          break;

        case "ERROR":
          console.error("[WS] Error:", message.error);
          break;

        default:
          console.log("[WS] Unknown message type:", message.type);
      }
    },
    [
      setAuthenticated,
      updatePrice,
      setPositions,
      addPosition,
      updatePosition,
      removePosition,
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
      console.error("[WS] Cannot send - not connected");
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

  // Close position
  const closePosition = useCallback(
    (positionId: string, accountId: string) => {
      send({
        type: "CLOSE_POSITION",
        positionId,
        accountId,
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
  };
}

