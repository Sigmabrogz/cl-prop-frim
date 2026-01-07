"use client";

import { useEffect, useState, useCallback } from "react";
import { ordersApi, tradesApi, type Order, type Trade } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatNumber, getPnLColor, formatDurationSeconds } from "@/lib/utils";
import {
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Ban,
  Timer,
  Loader2,
  RefreshCw,
  History,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface HistoryPanelProps {
  accountId: string;
  type: "orders" | "trades";
}

// Helper to format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Alias for backwards compatibility - function now in utils
const formatDuration = formatDurationSeconds;

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
    filled: { icon: CheckCircle, color: "text-profit border-profit/30 bg-profit/10", label: "Filled" },
    cancelled: { icon: Ban, color: "text-muted-foreground border-border bg-background-secondary", label: "Cancelled" },
    rejected: { icon: XCircle, color: "text-loss border-loss/30 bg-loss/10", label: "Rejected" },
    expired: { icon: Timer, color: "text-warning border-warning/30 bg-warning/10", label: "Expired" },
    pending: { icon: Clock, color: "text-blue-500 border-blue-500/30 bg-blue-500/10", label: "Pending" },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 gap-1", config.color)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

// Order History Row
function OrderRow({ order }: { order: Order }) {
  return (
    <div className="p-3 rounded-xl bg-background-secondary border border-border/50 hover:border-border transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {order.side === "LONG" ? (
            <TrendingUp className="h-4 w-4 text-profit" />
          ) : (
            <TrendingDown className="h-4 w-4 text-loss" />
          )}
          <span className="font-medium">{order.symbol.replace("USDT", "/USD")}</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5",
              order.side === "LONG" ? "text-profit border-profit/30" : "text-loss border-loss/30"
            )}
          >
            {order.orderType} {order.side}
          </Badge>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Details */}
      <div className="grid grid-cols-4 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Size</p>
          <p className="font-mono">{formatNumber(parseFloat(order.quantity), 4)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {order.orderType === "LIMIT" ? "Limit" : "Market"}
          </p>
          <p className="font-mono">
            {order.limitPrice ? formatCurrency(parseFloat(order.limitPrice)) : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Filled</p>
          <p className="font-mono">
            {order.filledPrice ? formatCurrency(parseFloat(order.filledPrice)) : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Created</p>
          <p className="text-xs text-muted-foreground font-mono">{formatDate(order.createdAt)}</p>
        </div>
      </div>

      {/* Rejection reason */}
      {order.rejectionReason && (
        <div className="mt-2 p-2 rounded-lg bg-loss/10 border border-loss/20">
          <p className="text-xs text-loss">{order.rejectionReason}</p>
        </div>
      )}
    </div>
  );
}

// Trade History Row
function TradeRow({ trade }: { trade: Trade }) {
  const grossPnl = parseFloat(trade.grossPnl);
  const netPnl = parseFloat(trade.netPnl);
  const tradingFees = parseFloat(trade.fees || '0');
  const fundingFee = parseFloat(trade.fundingFee || '0');
  const totalFees = tradingFees + fundingFee;
  const isWin = netPnl > 0;

  return (
    <div className={cn(
      "p-3 rounded-xl border transition-colors",
      isWin
        ? "bg-profit/5 border-profit/20 hover:border-profit/40"
        : "bg-loss/5 border-loss/20 hover:border-loss/40"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {trade.side === "LONG" ? (
            <TrendingUp className="h-4 w-4 text-profit" />
          ) : (
            <TrendingDown className="h-4 w-4 text-loss" />
          )}
          <span className="font-medium">{trade.symbol.replace("USDT", "/USD")}</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5",
              trade.side === "LONG" ? "text-profit border-profit/30" : "text-loss border-loss/30"
            )}
          >
            {trade.side}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5">
            {trade.leverage}x
          </Badge>
        </div>
        <div className={cn("font-mono font-semibold", getPnLColor(netPnl))}>
          {netPnl >= 0 ? "+" : ""}{formatCurrency(netPnl)}
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-5 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Size</p>
          <p className="font-mono">{formatNumber(parseFloat(trade.quantity), 4)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Entry</p>
          <p className="font-mono">{formatCurrency(parseFloat(trade.entryPrice))}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Exit</p>
          <p className="font-mono">{formatCurrency(parseFloat(trade.exitPrice))}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Duration</p>
          <p className="font-mono text-xs">{formatDuration(trade.holdDurationSeconds)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Closed</p>
          <p className="text-xs text-muted-foreground font-mono">{formatDate(trade.closedAt)}</p>
        </div>
      </div>

      {/* P&L Breakdown */}
      <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-4 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Gross P&L</p>
          <p className={cn("font-mono font-medium", getPnLColor(grossPnl))}>
            {grossPnl >= 0 ? "+" : ""}{formatCurrency(grossPnl)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Trading Fees</p>
          <p className="font-mono text-loss">-{formatCurrency(tradingFees)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Funding</p>
          <p className={cn("font-mono", fundingFee >= 0 ? "text-loss" : "text-profit")}>
            {fundingFee >= 0 ? "-" : "+"}{formatCurrency(Math.abs(fundingFee))}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Net P&L</p>
          <p className={cn("font-mono font-semibold", getPnLColor(netPnl))}>
            {netPnl >= 0 ? "+" : ""}{formatCurrency(netPnl)}
          </p>
        </div>
      </div>

      {/* Close reason */}
      <div className="mt-2 text-xs text-muted-foreground">
        Closed by: <span className="font-medium text-foreground">{trade.closeReason}</span>
      </div>
    </div>
  );
}

export function HistoryPanel({ accountId, type }: HistoryPanelProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (type === "orders") {
        const response = await ordersApi.history({ accountId, page, limit });
        if (response.success && response.data) {
          setOrders(response.data.orders);
          setHasMore(response.data.pagination.hasMore);
          setTotal(response.data.pagination.total);
        } else {
          setError(response.error || "Failed to load order history");
        }
      } else {
        const response = await tradesApi.list({ accountId, page, limit });
        if (response.success && response.data) {
          setTrades(response.data.trades);
          setTotal(response.data.total);
          setHasMore(response.data.trades.length === limit);
        } else {
          setError(response.error || "Failed to load trade history");
        }
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [accountId, type, page]);

  useEffect(() => {
    if (accountId) {
      loadData();
    }
  }, [accountId, loadData]);

  // Reset page when switching types
  useEffect(() => {
    setPage(1);
  }, [type]);

  if (isLoading && page === 1) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-3" />
        <p className="text-sm">Loading {type === "orders" ? "order" : "trade"} history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <XCircle className="h-8 w-8 mb-3 text-loss" />
        <p className="text-sm mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const items = type === "orders" ? orders : trades;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <History className="h-10 w-10 mb-3 opacity-50" />
        <p className="text-sm">No {type === "orders" ? "order" : "trade"} history</p>
        <p className="text-xs mt-1">
          {type === "orders"
            ? "Your completed orders will appear here"
            : "Your closed trades will appear here"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with stats */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          Showing {items.length} of {total} {type}
        </p>
        <Button variant="ghost" size="sm" onClick={loadData} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {type === "orders"
          ? orders.map((order) => <OrderRow key={order.id} order={order} />)
          : trades.map((trade) => <TradeRow key={trade.id} trade={trade} />)}
      </div>

      {/* Pagination */}
      {(hasMore || page > 1) && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            Page {page}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore || isLoading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Export separate components for convenience
export function OrderHistoryPanel({ accountId }: { accountId: string }) {
  return <HistoryPanel accountId={accountId} type="orders" />;
}

export function TradeHistoryPanel({ accountId }: { accountId: string }) {
  return <HistoryPanel accountId={accountId} type="trades" />;
}
