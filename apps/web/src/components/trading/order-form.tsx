"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTradingStore, useWebSocket } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Zap,
  AlertTriangle,
  Target,
  ShieldAlert,
  Percent,
  Calculator,
  Check,
  X,
} from "lucide-react";

interface OrderFormProps {
  symbol: string;
  accountId: string;
  maxLeverage?: number;
  availableBalance?: number;
  prefillPrice?: number;
  prefillQuantity?: number;
  onSideChange?: (side: "LONG" | "SHORT") => void;
}

type OrderStatus = "idle" | "submitting" | "success" | "error";

export function OrderForm({
  symbol,
  accountId,
  maxLeverage = 10,
  availableBalance = 10000,
  prefillPrice,
  prefillQuantity,
  onSideChange,
}: OrderFormProps) {
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [quantity, setQuantity] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [leverage, setLeverage] = useState(5);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("idle");
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  const { placeOrder } = useWebSocket();
  const price = useTradingStore((state) => state.prices[symbol]);
  const lastOrderResponse = useTradingStore((state) => state.lastOrderResponse);

  const currentPrice = price ? (side === "LONG" ? price.ask : price.bid) : 0;
  const spread = price ? price.spread : 0;

  // Calculate margin required
  const qty = parseFloat(quantity) || 0;
  const marginRequired = (qty * currentPrice) / leverage;
  const canAfford = marginRequired <= availableBalance;
  const positionValue = qty * currentPrice;

  // Calculate estimated P&L for TP/SL
  const tpPrice = parseFloat(takeProfit) || 0;
  const slPrice = parseFloat(stopLoss) || 0;
  const tpPnl = tpPrice ? (side === "LONG" ? tpPrice - currentPrice : currentPrice - tpPrice) * qty : 0;
  const slPnl = slPrice ? (side === "LONG" ? slPrice - currentPrice : currentPrice - slPrice) * qty : 0;

  // Handle prefill from order book clicks
  useEffect(() => {
    if (prefillPrice && orderType === "LIMIT") {
      setLimitPrice(prefillPrice.toString());
    }
  }, [prefillPrice, orderType]);

  useEffect(() => {
    if (prefillQuantity) {
      setQuantity(prefillQuantity.toFixed(6));
    }
  }, [prefillQuantity]);

  // Handle side change
  const handleSideChange = useCallback((newSide: "LONG" | "SHORT") => {
    setSide(newSide);
    onSideChange?.(newSide);
  }, [onSideChange]);

  // Handle order response
  useEffect(() => {
    if (lastOrderResponse) {
      if (lastOrderResponse.success) {
        setOrderStatus("success");
        setQuantity("");
        setTakeProfit("");
        setStopLoss("");
        if (lastOrderResponse.executionTime) {
          setExecutionTime(lastOrderResponse.executionTime);
        }
        // Reset status after animation
        setTimeout(() => {
          setOrderStatus("idle");
          setExecutionTime(null);
        }, 2000);
      } else if (lastOrderResponse.error) {
        setOrderStatus("error");
        setErrorMessage(lastOrderResponse.error);
        // Reset status after animation
        setTimeout(() => {
          setOrderStatus("idle");
          setErrorMessage(null);
        }, 3000);
      }
    }
  }, [lastOrderResponse]);

  const handleSubmit = useCallback(() => {
    if (!quantity || !accountId || orderStatus === "submitting") return;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return;

    setOrderStatus("submitting");
    setErrorMessage(null);

    placeOrder({
      accountId,
      symbol,
      side,
      type: orderType,
      quantity: qty,
      price: orderType === "LIMIT" ? parseFloat(limitPrice) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
    });

    // Timeout fallback
    setTimeout(() => {
      if (orderStatus === "submitting") {
        setOrderStatus("idle");
      }
    }, 10000);
  }, [
    accountId,
    symbol,
    side,
    orderType,
    quantity,
    limitPrice,
    takeProfit,
    stopLoss,
    placeOrder,
    orderStatus,
  ]);

  // Quick quantity buttons
  const setQuickQuantity = (percentage: number) => {
    const maxQty = (availableBalance * leverage) / currentPrice;
    const qty = (maxQty * percentage) / 100;
    setQuantity(qty.toFixed(6));
  };

  // Leverage presets
  const leveragePresets = [1, 2, 5, 10, maxLeverage].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div
      ref={formRef}
      className={cn(
        "space-y-4 p-3 transition-all duration-300",
        orderStatus === "success" && "animate-order-success",
        orderStatus === "error" && "animate-order-error"
      )}
    >
      {/* Side selector - Professional text buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleSideChange("LONG")}
          className={cn(
            "relative h-12 rounded-lg font-semibold text-sm transition-all duration-200",
            "flex items-center justify-center gap-2 border",
            side === "LONG"
              ? "bg-profit/10 text-profit border-profit/40 ring-1 ring-profit/20"
              : "bg-background-secondary text-muted-foreground hover:text-profit hover:bg-profit/5 border-border hover:border-profit/30"
          )}
        >
          <TrendingUp className="h-4 w-4" />
          <span>LONG</span>
        </button>
        <button
          onClick={() => handleSideChange("SHORT")}
          className={cn(
            "relative h-12 rounded-lg font-semibold text-sm transition-all duration-200",
            "flex items-center justify-center gap-2 border",
            side === "SHORT"
              ? "bg-loss/10 text-loss border-loss/40 ring-1 ring-loss/20"
              : "bg-background-secondary text-muted-foreground hover:text-loss hover:bg-loss/5 border-border hover:border-loss/30"
          )}
        >
          <TrendingDown className="h-4 w-4" />
          <span>SHORT</span>
        </button>
      </div>

      {/* Order type tabs */}
      <div className="flex p-1 bg-background-tertiary rounded-xl">
        {(["MARKET", "LIMIT"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setOrderType(type)}
            className={cn(
              "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200",
              orderType === type
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {type.charAt(0) + type.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Price display */}
      <div className="p-3 rounded-xl bg-gradient-to-br from-background-secondary to-background-tertiary border border-border/50">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Entry Price</span>
          <div className="text-right">
            <span className={cn(
              "text-xl font-mono font-bold tabular-nums",
              side === "LONG" ? "text-profit" : "text-loss"
            )}>
              {formatCurrency(currentPrice, { decimals: 2 })}
            </span>
          </div>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
          <span>Spread: {formatNumber(spread, 2)}</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* Limit price */}
      {orderType === "LIMIT" && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Limit Price
          </Label>
          <div className="relative">
            <Input
              type="number"
              placeholder="0.00"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className="font-mono pr-12 h-11"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              USD
            </span>
          </div>
        </div>
      )}

      {/* Quantity */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Quantity
          </Label>
          <span className="text-xs text-muted-foreground">
            Max: <span className="font-mono text-foreground">{formatNumber((availableBalance * leverage) / currentPrice, 4)}</span>
          </span>
        </div>
        <div className="relative">
          <Input
            type="number"
            placeholder="0.00"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="font-mono pr-16 h-11"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
            {symbol.replace("USDT", "")}
          </span>
        </div>
        {/* Quick quantity buttons */}
        <div className="grid grid-cols-4 gap-1.5">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => setQuickQuantity(pct)}
              className={cn(
                "py-2 text-xs font-semibold rounded-lg transition-all duration-150",
                "bg-background-tertiary hover:bg-background-hover border border-border/50",
                "hover:border-primary/30 hover:shadow-sm active:scale-95"
              )}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Leverage */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Percent className="h-3.5 w-3.5" />
            Leverage
          </Label>
          <span className={cn(
            "text-sm font-bold px-2.5 py-1 rounded-lg font-mono",
            leverage >= maxLeverage * 0.8 ? "bg-loss/10 text-loss" : "bg-primary/10 text-primary"
          )}>
            {leverage}x
          </span>
        </div>
        <div className="relative py-2">
          <input
            type="range"
            min={1}
            max={maxLeverage}
            value={leverage}
            onChange={(e) => setLeverage(parseInt(e.target.value))}
            className={cn(
              "w-full h-2 rounded-full appearance-none cursor-pointer",
              "bg-gradient-to-r from-profit via-warning to-loss",
              "[&::-webkit-slider-thumb]:appearance-none",
              "[&::-webkit-slider-thumb]:w-5",
              "[&::-webkit-slider-thumb]:h-5",
              "[&::-webkit-slider-thumb]:rounded-full",
              "[&::-webkit-slider-thumb]:bg-white",
              "[&::-webkit-slider-thumb]:border-2",
              "[&::-webkit-slider-thumb]:border-primary",
              "[&::-webkit-slider-thumb]:shadow-lg",
              "[&::-webkit-slider-thumb]:cursor-pointer",
              "[&::-webkit-slider-thumb]:transition-transform",
              "[&::-webkit-slider-thumb]:hover:scale-110"
            )}
          />
        </div>
        <div className="flex justify-between gap-1">
          {leveragePresets.map((preset) => (
            <button
              key={preset}
              onClick={() => setLeverage(preset)}
              className={cn(
                "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150",
                leverage === preset
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-background-tertiary text-muted-foreground hover:text-foreground hover:bg-background-hover"
              )}
            >
              {preset}x
            </button>
          ))}
        </div>
      </div>

      {/* TP/SL Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className={cn(
          "w-full py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
          "flex items-center justify-center gap-2",
          showAdvanced
            ? "bg-primary/10 text-primary border border-primary/20"
            : "text-muted-foreground hover:text-foreground hover:bg-background-tertiary"
        )}
      >
        <Target className="h-4 w-4" />
        {showAdvanced ? "Hide" : "Add"} Take Profit / Stop Loss
      </button>

      {/* TP/SL Inputs */}
      {showAdvanced && (
        <div className="space-y-3 p-3 rounded-xl bg-background-tertiary/50 border border-border/50 animate-slide-down">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-profit flex items-center gap-1">
                <Target className="h-3 w-3" />
                Take Profit
              </Label>
              <Input
                type="number"
                placeholder="Price"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="font-mono text-sm h-10"
              />
              {tpPrice > 0 && qty > 0 && (
                <p className="text-xs text-profit font-medium">
                  +{formatCurrency(tpPnl)} ({((tpPnl / marginRequired) * 100).toFixed(1)}%)
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-loss flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                Stop Loss
              </Label>
              <Input
                type="number"
                placeholder="Price"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="font-mono text-sm h-10"
              />
              {slPrice > 0 && qty > 0 && (
                <p className="text-xs text-loss font-medium">
                  {formatCurrency(slPnl)} ({((slPnl / marginRequired) * 100).toFixed(1)}%)
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order summary */}
      <div className="p-3 rounded-xl bg-background-secondary border border-border/50 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Calculator className="h-3.5 w-3.5" />
            Margin Required
          </span>
          <span className={cn("font-mono font-semibold", !canAfford && qty > 0 && "text-loss")}>
            {formatCurrency(marginRequired)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Position Value</span>
          <span className="font-mono">{formatCurrency(positionValue)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Available</span>
          <span className="font-mono text-foreground">{formatCurrency(availableBalance)}</span>
        </div>

        {!canAfford && qty > 0 && (
          <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-loss/10 text-loss text-xs font-medium animate-shake">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Insufficient margin for this trade
          </div>
        )}
      </div>

      {/* Execution time indicator */}
      {executionTime !== null && orderStatus === "success" && (
        <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-profit/10 text-profit text-sm font-semibold animate-fade-in">
          <Check className="h-5 w-5" />
          <span>Order filled in {executionTime}ms</span>
        </div>
      )}

      {/* Error message */}
      {errorMessage && orderStatus === "error" && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-loss/10 border border-loss/20 text-loss text-sm animate-shake">
          <X className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Submit button */}
      <button
        className={cn(
          "w-full h-12 rounded-lg font-semibold text-sm transition-all duration-200 border",
          "flex items-center justify-center gap-2",
          orderStatus === "submitting" && "opacity-70 cursor-wait",
          orderStatus === "success" && "bg-profit/15 text-profit border-profit/40",
          orderStatus === "error" && "bg-loss/15 text-loss border-loss/40 animate-shake",
          orderStatus === "idle" && side === "LONG" && "bg-profit/10 text-profit border-profit/30 hover:bg-profit/20 hover:border-profit/50",
          orderStatus === "idle" && side === "SHORT" && "bg-loss/10 text-loss border-loss/30 hover:bg-loss/20 hover:border-loss/50",
          (!quantity || !canAfford || !price) && "opacity-50 cursor-not-allowed"
        )}
        onClick={handleSubmit}
        disabled={orderStatus === "submitting" || !quantity || !canAfford || !price}
      >
        {orderStatus === "submitting" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Executing...</span>
          </>
        ) : orderStatus === "success" ? (
          <>
            <Check className="h-4 w-4" />
            <span>Order Filled</span>
          </>
        ) : orderStatus === "error" ? (
          <>
            <X className="h-4 w-4" />
            <span>Failed</span>
          </>
        ) : (
          <>
            {side === "LONG" ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>{side === "LONG" ? "Buy Long" : "Sell Short"}</span>
            <span className="font-mono text-xs opacity-70">
              @ {formatCurrency(currentPrice, { decimals: 2 })}
            </span>
          </>
        )}
      </button>

      {/* Keyboard hint */}
      <p className="text-center text-[10px] text-muted-foreground">
        Press <kbd className="px-1 py-0.5 rounded bg-background border border-border font-mono">B</kbd> for Long,{" "}
        <kbd className="px-1 py-0.5 rounded bg-background border border-border font-mono">S</kbd> for Short,{" "}
        <kbd className="px-1 py-0.5 rounded bg-background border border-border font-mono">Enter</kbd> to submit
      </p>
    </div>
  );
}

// Compact quick trade component
export function QuickTradeButtons({
  symbol,
  accountId,
  availableBalance,
}: {
  symbol: string;
  accountId: string;
  availableBalance: number;
}) {
  const { placeOrder } = useWebSocket();
  const price = useTradingStore((state) => state.prices[symbol]);
  const [isSubmitting, setIsSubmitting] = useState<"LONG" | "SHORT" | null>(null);

  const handleQuickTrade = useCallback((side: "LONG" | "SHORT") => {
    if (!price || isSubmitting) return;

    setIsSubmitting(side);
    
    // Quick trade with 1% of balance
    const entryPrice = side === "LONG" ? price.ask : price.bid;
    const qty = (availableBalance * 0.01) / entryPrice;

    placeOrder({
      accountId,
      symbol,
      side,
      type: "MARKET",
      quantity: qty,
    });

    setTimeout(() => setIsSubmitting(null), 2000);
  }, [price, accountId, symbol, availableBalance, placeOrder, isSubmitting]);

  if (!price) return null;

  // Format price based on magnitude
  const formatPrice = (p: number) => {
    if (p >= 10000) return formatCurrency(p, { decimals: 0 });
    if (p >= 100) return formatCurrency(p, { decimals: 2 });
    return formatCurrency(p, { decimals: 4 });
  };

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <button
        onClick={() => handleQuickTrade("LONG")}
        disabled={isSubmitting !== null}
        className={cn(
          "flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg transition-all",
          "bg-profit/10 hover:bg-profit/20 border border-profit/20",
          "active:scale-95",
          isSubmitting === "LONG" && "animate-pulse"
        )}
      >
        <span className="text-[10px] text-profit font-semibold uppercase tracking-wide">Buy</span>
        <span className="text-sm font-mono font-bold text-profit truncate w-full text-center">
          {formatPrice(price.ask)}
        </span>
      </button>
      <button
        onClick={() => handleQuickTrade("SHORT")}
        disabled={isSubmitting !== null}
        className={cn(
          "flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg transition-all",
          "bg-loss/10 hover:bg-loss/20 border border-loss/20",
          "active:scale-95",
          isSubmitting === "SHORT" && "animate-pulse"
        )}
      >
        <span className="text-[10px] text-loss font-semibold uppercase tracking-wide">Sell</span>
        <span className="text-sm font-mono font-bold text-loss truncate w-full text-center">
          {formatPrice(price.bid)}
        </span>
      </button>
    </div>
  );
}
