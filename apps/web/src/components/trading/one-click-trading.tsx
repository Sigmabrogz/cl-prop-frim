"use client";

import { useState, useCallback } from "react";
import { useTradingStore, useWebSocket } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown, Zap, Loader2 } from "lucide-react";

interface OneClickTradingProps {
  symbol: string;
  accountId: string;
  availableBalance?: number;
}

const QUICK_QUANTITIES = [0.001, 0.01, 0.1, 0.5, 1.0];

export function OneClickTrading({
  symbol,
  accountId,
  availableBalance = 10000,
}: OneClickTradingProps) {
  const [selectedQty, setSelectedQty] = useState(0.01);
  const [isSubmitting, setIsSubmitting] = useState<"LONG" | "SHORT" | null>(null);
  const [lastExecution, setLastExecution] = useState<{ time: number; side: string } | null>(null);

  const { placeOrder } = useWebSocket();
  const price = useTradingStore((state) => state.prices[symbol]);
  const lastOrderResponse = useTradingStore((state) => state.lastOrderResponse);

  const handleQuickTrade = useCallback(
    (side: "LONG" | "SHORT") => {
      if (!accountId || isSubmitting) return;

      setIsSubmitting(side);
      const startTime = Date.now();

      placeOrder({
        accountId,
        symbol,
        side,
        type: "MARKET",
        quantity: selectedQty,
      });

      // Show execution feedback
      setTimeout(() => {
        setIsSubmitting(null);
        if (lastOrderResponse?.success) {
          setLastExecution({ time: Date.now() - startTime, side });
          setTimeout(() => setLastExecution(null), 2000);
        }
      }, 500);
    },
    [accountId, symbol, selectedQty, placeOrder, isSubmitting, lastOrderResponse]
  );

  if (!price) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Waiting for price...
      </div>
    );
  }

  const symbolBase = symbol.replace("USDT", "");

  return (
    <div className="space-y-3">
      {/* Quick quantity selector */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Quick Quantity ({symbolBase})
        </label>
        <div className="flex gap-1">
          {QUICK_QUANTITIES.map((qty) => (
            <button
              key={qty}
              onClick={() => setSelectedQty(qty)}
              className={cn(
                "flex-1 py-1.5 text-xs font-mono rounded transition-colors",
                selectedQty === qty
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-foreground"
              )}
            >
              {qty}
            </button>
          ))}
        </div>
      </div>

      {/* One-click buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="success"
          size="lg"
          className="h-16 flex-col gap-1 shadow-lg shadow-profit/20"
          onClick={() => handleQuickTrade("LONG")}
          disabled={isSubmitting !== null}
        >
          {isSubmitting === "LONG" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                <span className="font-bold">BUY</span>
              </div>
              <span className="text-xs opacity-80 font-mono">
                {formatCurrency(price.ask, { decimals: 2 })}
              </span>
            </>
          )}
        </Button>

        <Button
          variant="danger"
          size="lg"
          className="h-16 flex-col gap-1 shadow-lg shadow-loss/20"
          onClick={() => handleQuickTrade("SHORT")}
          disabled={isSubmitting !== null}
        >
          {isSubmitting === "SHORT" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <div className="flex items-center gap-1">
                <TrendingDown className="h-4 w-4" />
                <span className="font-bold">SELL</span>
              </div>
              <span className="text-xs opacity-80 font-mono">
                {formatCurrency(price.bid, { decimals: 2 })}
              </span>
            </>
          )}
        </Button>
      </div>

      {/* Order summary */}
      <div className="p-2 rounded bg-muted/50 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Market Price</span>
          <span className="font-mono">
            {formatCurrency(price.binanceMid, { decimals: 2 })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Position Value</span>
          <span className="font-mono">
            {formatCurrency(selectedQty * price.binanceMid)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Spread</span>
          <span className="font-mono">{formatCurrency(price.spread, { decimals: 2 })}</span>
        </div>
      </div>

      {/* Execution feedback */}
      {lastExecution && (
        <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-profit/10 text-profit text-sm animate-pulse">
          <Zap className="h-4 w-4" />
          <span>
            {lastExecution.side === "LONG" ? "Buy" : "Sell"} executed in{" "}
            {lastExecution.time}ms
          </span>
        </div>
      )}

      {/* Error message */}
      {lastOrderResponse?.error && (
        <div className="p-2 rounded-lg bg-loss/10 border border-loss/20 text-loss text-xs">
          {lastOrderResponse.error}
        </div>
      )}
    </div>
  );
}

