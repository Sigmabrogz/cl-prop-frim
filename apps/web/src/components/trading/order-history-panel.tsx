"use client";

import { useEffect, useState, useCallback } from "react";
import { tradeEventsApi, type TradeEvent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import {
  Loader2,
  RefreshCw,
  History,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
} from "lucide-react";

interface OrderHistoryPanelProps {
  accountId: string;
}

// Event type to display label mapping
const EVENT_TYPE_LABELS: Record<string, string> = {
  ORDER_PLACED: "Order Placed",
  ORDER_VALIDATED: "Order Validated",
  ORDER_REJECTED: "Order Rejected",
  ORDER_FILLED: "Order Filled",
  ORDER_PENDING: "Order Pending",
  POSITION_OPENED: "Position Opened",
  POSITION_MODIFIED: "Position Modified",
  POSITION_CLOSED: "Position Closed",
  POSITION_CLOSING_PENDING: "Position Closing Pending",
  TP_SET: "Take Profit Attached",
  TP_MODIFIED: "Take Profit Modified",
  TP_TRIGGERED: "Position Closed By Take Profit",
  TP_REMOVED: "Take Profit Removed",
  TP_PENDING: "Take Profit Pending",
  SL_SET: "Stop Loss Attached",
  SL_MODIFIED: "Stop Loss Modified",
  SL_TRIGGERED: "Position Closed By Stop Loss",
  SL_REMOVED: "Stop Loss Removed",
  LIQUIDATION_WARNING: "Liquidation Warning",
  LIQUIDATION_TRIGGERED: "Position Liquidated",
};

// Format date for table display (MM/DD/YYYY HH:MM:SS)
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// Generate short Order Group ID from position ID (first 9 digits hash)
function getOrderGroupId(positionId: string | undefined): string {
  if (!positionId) return "-";
  // Create a numeric hash from UUID
  let hash = 0;
  for (let i = 0; i < positionId.length; i++) {
    const char = positionId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Make it positive and 9 digits
  const positiveHash = Math.abs(hash) % 1000000000;
  return positiveHash.toString().padStart(9, '3');
}

export function OrderHistoryPanel({ accountId }: OrderHistoryPanelProps) {
  const [events, setEvents] = useState<TradeEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [searchId, setSearchId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const limit = 50;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await tradeEventsApi.list({
        accountId,
        positionId: searchId || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        limit,
      });

      if (response.success && response.data) {
        setEvents(response.data.events);
        setHasMore(response.data.pagination.hasMore);
        setTotal(response.data.pagination.total);
      } else {
        setError(response.error || "Failed to load order history");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [accountId, searchId, fromDate, toDate, page]);

  useEffect(() => {
    if (accountId) {
      loadData();
    }
  }, [accountId, loadData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchId, fromDate, toDate]);

  // Get details from event
  const getEventDetails = (event: TradeEvent) => {
    const details = event.details as Record<string, unknown>;
    return {
      // Price fields
      fillPrice: (details.exitPrice || details.fillPrice || details.entryPrice) as number | string | undefined,
      triggerPrice: details.triggerPrice as number | string | undefined,
      
      // TP/SL
      takeProfit: details.takeProfit as number | string | undefined,
      stopLoss: details.stopLoss as number | string | undefined,
      
      // Order info
      orderType: (details.orderType || "Market") as string,
      
      // Fees
      commission: details.totalFees as number | string | undefined,
      entryFee: details.entryFee as number | string | undefined,
      exitFee: details.exitFee as number | string | undefined,
      fundingFee: details.fundingFee as number | string | undefined,
      
      // P&L
      grossPnl: details.grossPnl as number | string | undefined,
      netPnl: details.netPnl as number | string | undefined,
      pnl: details.pnl as number | string | undefined,
      
      // Other
      leverage: details.leverage as number | undefined,
      closeReason: details.closeReason as string | undefined,
    };
  };

  if (isLoading && page === 1 && events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-3" />
        <p className="text-sm">Loading order history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <History className="h-8 w-8 mb-3 text-loss" />
        <p className="text-sm mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Filters */}
      <div className="flex items-center gap-3 p-2 border-b border-[#30363d] bg-[#161b22]">
        {/* Search by Order Group ID */}
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-[#8b949e]" />
          <input
            type="text"
            placeholder="Order Group ID"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            className="h-7 w-32 px-2 text-xs bg-[#0d1117] border border-[#30363d] rounded text-[#c9d1d9] placeholder-[#8b949e] focus:outline-none focus:border-[#58a6ff]"
          />
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#8b949e]" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-7 w-32 px-2 text-xs bg-[#0d1117] border border-[#30363d] rounded text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
          />
          <span className="text-[#8b949e] text-xs">—</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-7 w-32 px-2 text-xs bg-[#0d1117] border border-[#30363d] rounded text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
          />
        </div>

        <div className="flex-1" />

        {/* Refresh */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={loadData} 
          disabled={isLoading} 
          className="h-7 px-2 text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d]"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[#8b949e]">
            <History className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">No order history</p>
            <p className="text-xs mt-1">Your trading events will appear here</p>
          </div>
        ) : (
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 bg-[#161b22] z-10">
              <tr className="text-[#8b949e] border-b border-[#30363d]">
                <th className="text-left py-2 px-2 font-medium whitespace-nowrap">Order Group ID</th>
                <th className="text-left py-2 px-2 font-medium whitespace-nowrap">Event Type</th>
                <th className="text-left py-2 px-2 font-medium whitespace-nowrap">Date and Time</th>
                <th className="text-left py-2 px-2 font-medium whitespace-nowrap">Symbol</th>
                <th className="text-left py-2 px-2 font-medium whitespace-nowrap">Status</th>
                <th className="text-center py-2 px-2 font-medium whitespace-nowrap">Side</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Size</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Volume</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Filled Volume</th>
                <th className="text-center py-2 px-2 font-medium whitespace-nowrap">Order Type</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Price</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Fill Price</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Trigger Price</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Expiration</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Commission</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Take profit</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Stop loss</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Closed P&L</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Net Closed P&L</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const details = getEventDetails(event);
                const isBuy = event.side === "LONG";
                const isSell = event.side === "SHORT";
                
                // Parse numeric values
                const grossPnl = details.grossPnl ? parseFloat(String(details.grossPnl)) : null;
                const netPnl = details.netPnl ? parseFloat(String(details.netPnl)) : null;
                const fillPrice = details.fillPrice ? parseFloat(String(details.fillPrice)) : null;
                const commission = details.commission ? parseFloat(String(details.commission)) : null;
                const fundingFee = details.fundingFee ? parseFloat(String(details.fundingFee)) : null;
                const takeProfit = details.takeProfit ? parseFloat(String(details.takeProfit)) : null;
                const stopLoss = details.stopLoss ? parseFloat(String(details.stopLoss)) : null;
                const triggerPrice = details.triggerPrice ? parseFloat(String(details.triggerPrice)) : null;
                const quantity = event.quantity ? parseFloat(event.quantity) : null;
                const price = event.price ? parseFloat(event.price) : null;

                return (
                  <tr
                    key={event.id}
                    className="border-b border-[#21262d] hover:bg-[#161b22] transition-colors"
                  >
                    {/* Order Group ID */}
                    <td className="py-1.5 px-2 font-mono text-[#c9d1d9]">
                      {getOrderGroupId(event.positionId)}
                    </td>
                    
                    {/* Event Type */}
                    <td className="py-1.5 px-2 text-[#c9d1d9]">
                      Trades
                    </td>
                    
                    {/* Date and Time */}
                    <td className="py-1.5 px-2 font-mono text-[#8b949e]">
                      {formatDateTime(event.createdAt)}
                    </td>
                    
                    {/* Symbol */}
                    <td className="py-1.5 px-2 font-medium text-[#c9d1d9]">
                      {event.symbol ? event.symbol.replace("USDT", "USD") : "-"}
                    </td>
                    
                    {/* Status */}
                    <td className="py-1.5 px-2 text-[#c9d1d9]">
                      {EVENT_TYPE_LABELS[event.eventType] || event.eventType}
                    </td>
                    
                    {/* Side */}
                    <td className="py-1.5 px-2 text-center">
                      {event.side ? (
                        <span className={cn(
                          "font-medium",
                          isBuy ? "text-[#3fb950]" : "text-[#f85149]"
                        )}>
                          {isBuy ? "Buy" : "Sell"}
                        </span>
                      ) : (
                        <span className="text-[#8b949e]">-</span>
                      )}
                    </td>
                    
                    {/* Size */}
                    <td className="py-1.5 px-2 text-right font-mono text-[#c9d1d9]">
                      {quantity !== null ? formatNumber(quantity, 3) : "-"}
                    </td>
                    
                    {/* Volume */}
                    <td className="py-1.5 px-2 text-right font-mono text-[#c9d1d9]">
                      {quantity !== null ? formatNumber(quantity, 3) : "-"}
                    </td>
                    
                    {/* Filled Volume */}
                    <td className="py-1.5 px-2 text-right font-mono text-[#c9d1d9]">
                      {quantity !== null ? formatNumber(quantity, 3) : "-"}
                    </td>
                    
                    {/* Order Type */}
                    <td className="py-1.5 px-2 text-center text-[#c9d1d9]">
                      {details.orderType}
                    </td>
                    
                    {/* Price */}
                    <td className="py-1.5 px-2 text-right font-mono text-[#8b949e]">
                      {price !== null ? formatNumber(price, 1) : "-"}
                    </td>
                    
                    {/* Fill Price */}
                    <td className="py-1.5 px-2 text-right font-mono text-[#c9d1d9]">
                      {fillPrice !== null ? formatNumber(fillPrice, 1) : "-"}
                    </td>
                    
                    {/* Trigger Price */}
                    <td className="py-1.5 px-2 text-right font-mono text-[#8b949e]">
                      {triggerPrice !== null ? formatNumber(triggerPrice, 1) : "-"}
                    </td>
                    
                    {/* Expiration (Funding Fee) */}
                    <td className="py-1.5 px-2 text-right font-mono text-[#8b949e]">
                      {fundingFee !== null ? fundingFee.toFixed(2) : "-"}
                    </td>
                    
                    {/* Commission */}
                    <td className="py-1.5 px-2 text-right font-mono text-[#8b949e]">
                      {commission !== null ? formatNumber(commission, 2) : "-"}
                    </td>
                    
                    {/* Take Profit */}
                    <td className="py-1.5 px-2 text-right font-mono text-[#c9d1d9]">
                      {takeProfit !== null ? formatNumber(takeProfit, 1) : "-"}
                    </td>
                    
                    {/* Stop Loss */}
                    <td className="py-1.5 px-2 text-right font-mono text-[#c9d1d9]">
                      {stopLoss !== null ? formatNumber(stopLoss, 1) : "-"}
                    </td>
                    
                    {/* Closed P&L (Gross) */}
                    <td className={cn(
                      "py-1.5 px-2 text-right font-mono font-medium",
                      grossPnl !== null
                        ? grossPnl >= 0 ? "text-[#3fb950]" : "text-[#f85149]"
                        : "text-[#8b949e]"
                    )}>
                      {grossPnl !== null ? (
                        grossPnl.toFixed(2)
                      ) : "-"}
                    </td>
                    
                    {/* Net Closed P&L */}
                    <td className={cn(
                      "py-1.5 px-2 text-right font-mono font-medium",
                      netPnl !== null
                        ? netPnl >= 0 ? "text-[#3fb950]" : "text-[#f85149]"
                        : "text-[#8b949e]"
                    )}>
                      {netPnl !== null ? (
                        netPnl.toFixed(1)
                      ) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {(hasMore || page > 1) && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-[#30363d] bg-[#161b22]">
          <p className="text-xs text-[#8b949e]">
            Showing {events.length} of {total} events
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              className="h-7 px-2 bg-[#21262d] border-[#30363d] text-[#c9d1d9] hover:bg-[#30363d]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-[#8b949e] px-2">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore || isLoading}
              className="h-7 px-2 bg-[#21262d] border-[#30363d] text-[#c9d1d9] hover:bg-[#30363d]"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
