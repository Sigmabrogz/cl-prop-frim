"use client";

import { useTradingStore, useWebSocket, type PendingOrder } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import {
  X,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  Loader2,
  ListOrdered,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";

interface PendingOrdersPanelProps {
  accountId: string;
}

// Helper to format time ago
function formatTimeAgo(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

// Cancel Order Confirmation Modal
interface CancelModalProps {
  order: PendingOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (orderId: string) => void;
}

function CancelOrderModal({ order, isOpen, onClose, onConfirm }: CancelModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const price = useTradingStore((state) => order ? state.prices[order.symbol] : null);

  const currentPrice = price
    ? order?.side === "LONG" ? price.ask : price.bid
    : order?.limitPrice || 0;

  // Calculate price difference
  const priceDiff = order
    ? ((order.limitPrice - currentPrice) / currentPrice) * 100
    : 0;

  const handleConfirm = useCallback(() => {
    if (!order) return;
    setIsSubmitting(true);

    onConfirm(order.id);

    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
    }, 300);
  }, [order, onConfirm, onClose]);

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm mx-4 p-5 rounded-2xl bg-background border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold">Cancel Order</h3>
              <p className="text-sm text-muted-foreground">
                {order.symbol.replace("USDT", "/USD")} • {order.leverage}x
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-background-hover rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Order Info */}
        <div className="p-3 rounded-xl bg-background-secondary border border-border/50 mb-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Side</p>
              <p className={cn(
                "font-medium",
                order.side === "LONG" ? "text-profit" : "text-loss"
              )}>
                {order.side}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Size</p>
              <p className="font-mono font-medium">{formatNumber(order.quantity, 6)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Limit Price</p>
              <p className="font-mono font-medium">{formatCurrency(order.limitPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current Price</p>
              <p className="font-mono font-medium">{formatCurrency(currentPrice)}</p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Distance to trigger</span>
              <span className={cn(
                "font-medium",
                Math.abs(priceDiff) < 1 ? "text-warning" : "text-muted-foreground"
              )}>
                {priceDiff >= 0 ? "+" : ""}{priceDiff.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-muted-foreground">Margin reserved</span>
              <span className="font-mono font-medium text-warning">
                {formatCurrency(order.marginReserved)}
              </span>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 mb-4">
          <p className="text-sm text-warning">
            Canceling this order will release {formatCurrency(order.marginReserved)} of reserved margin.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Keep Order
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Cancel Order"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PendingOrdersPanel({ accountId }: PendingOrdersPanelProps) {
  const pendingOrders = useTradingStore((state) => state.pendingOrders);
  const prices = useTradingStore((state) => state.prices);
  const { cancelOrder, getPendingOrders } = useWebSocket();

  const [cancelModalOrder, setCancelModalOrder] = useState<PendingOrder | null>(null);
  const [, setTick] = useState(0); // For time updates

  // Fetch pending orders on mount
  useEffect(() => {
    if (accountId) {
      getPendingOrders(accountId);
    }
  }, [accountId, getPendingOrders]);

  // Update time display every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCancelOrder = useCallback((orderId: string) => {
    cancelOrder(orderId);
    setCancelModalOrder(null);
  }, [cancelOrder]);

  if (pendingOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <ListOrdered className="h-10 w-10 mb-3 opacity-50" />
        <p className="text-sm">No pending orders</p>
        <p className="text-xs mt-1">Limit orders will appear here</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {pendingOrders.map((order) => {
          const price = prices[order.symbol];
          const currentPrice = price
            ? order.side === "LONG" ? price.ask : price.bid
            : order.limitPrice;

          // Calculate how close the price is to trigger
          const priceDiff = ((order.limitPrice - currentPrice) / currentPrice) * 100;
          const isClose = Math.abs(priceDiff) < 1;

          return (
            <div
              key={order.id}
              className={cn(
                "p-3 rounded-xl border transition-all duration-200",
                isClose
                  ? "bg-warning/5 border-warning/30"
                  : "bg-background-secondary border-border/50 hover:border-border"
              )}
            >
              {/* Header Row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {order.side === "LONG" ? (
                    <TrendingUp className="h-4 w-4 text-profit" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-loss" />
                  )}
                  <span className="font-medium">
                    {order.symbol.replace("USDT", "/USD")}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5",
                      order.side === "LONG"
                        ? "text-profit border-profit/30"
                        : "text-loss border-loss/30"
                    )}
                  >
                    LIMIT {order.side}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5">
                    {order.leverage}x
                  </Badge>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground hover:text-loss hover:bg-loss/10"
                  onClick={() => setCancelModalOrder(order)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Price Info */}
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Size</p>
                  <p className="font-mono">{formatNumber(order.quantity, 4)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Limit</p>
                  <p className="font-mono text-warning">{formatCurrency(order.limitPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current</p>
                  <p className="font-mono">{formatCurrency(currentPrice)}</p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatTimeAgo(order.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {order.takeProfit && (
                    <span className="flex items-center gap-0.5 text-profit">
                      <Target className="h-3 w-3" />
                      {formatCurrency(order.takeProfit)}
                    </span>
                  )}
                  {order.stopLoss && (
                    <span className="flex items-center gap-0.5 text-loss">
                      <AlertTriangle className="h-3 w-3" />
                      {formatCurrency(order.stopLoss)}
                    </span>
                  )}
                </div>
                <div className={cn(
                  "font-medium",
                  isClose ? "text-warning" : "text-muted-foreground"
                )}>
                  {priceDiff >= 0 ? "+" : ""}{priceDiff.toFixed(2)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cancel Order Modal */}
      <CancelOrderModal
        order={cancelModalOrder}
        isOpen={cancelModalOrder !== null}
        onClose={() => setCancelModalOrder(null)}
        onConfirm={handleCancelOrder}
      />
    </>
  );
}
