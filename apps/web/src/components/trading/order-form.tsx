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
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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

  // Fee calculations (matching backend: 0.05% = 5 bps)
  const FEE_RATE = 0.0005;
  const entryFee = positionValue * FEE_RATE;
  const exitFeeEstimate = positionValue * FEE_RATE; // Estimate at same price
  const totalFees = entryFee + exitFeeEstimate;
  const totalCost = marginRequired + entryFee;

  // Liquidation price calculation
  const MAINTENANCE_MARGIN_PCT = 0.005; // 0.5%
  const liquidationPrice = side === "LONG"
    ? currentPrice * (1 - (1 / leverage) + MAINTENANCE_MARGIN_PCT)
    : currentPrice * (1 + (1 / leverage) - MAINTENANCE_MARGIN_PCT);
  const liquidationDistance = side === "LONG"
    ? ((currentPrice - liquidationPrice) / currentPrice) * 100
    : ((liquidationPrice - currentPrice) / currentPrice) * 100;

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
        // Reset success status after animation
        setTimeout(() => {
          setOrderStatus("idle");
          setExecutionTime(null);
        }, 2000);
      } else if (lastOrderResponse.error) {
        setOrderStatus("error");
        setErrorMessage(lastOrderResponse.error);
        // Error stays visible until user dismisses it
      }
    }
  }, [lastOrderResponse]);

  // Dismiss error message
  const dismissError = useCallback(() => {
    setOrderStatus("idle");
    setErrorMessage(null);
  }, []);

  // Open confirmation modal
  const handleSubmit = useCallback(() => {
    if (!quantity || !accountId || orderStatus === "submitting") return;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return;

    setShowConfirmModal(true);
  }, [quantity, accountId, orderStatus]);

  // Actually execute the order
  const executeOrder = useCallback(() => {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return;

    setShowConfirmModal(false);
    setOrderStatus("submitting");
    setErrorMessage(null);

    placeOrder({
      accountId,
      symbol,
      side,
      type: orderType,
      quantity: qty,
      leverage,
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
    leverage,
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
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Trade direction">
        <button
          onClick={() => handleSideChange("LONG")}
          aria-pressed={side === "LONG"}
          aria-label="Long position - buy"
          className={cn(
            "relative h-12 rounded-lg font-semibold text-sm transition-all duration-200",
            "flex items-center justify-center gap-2 border",
            side === "LONG"
              ? "bg-profit/10 text-profit border-profit/40 ring-1 ring-profit/20"
              : "bg-background-secondary text-muted-foreground hover:text-profit hover:bg-profit/5 border-border hover:border-profit/30"
          )}
        >
          <TrendingUp className="h-4 w-4" aria-hidden="true" />
          <span>LONG</span>
        </button>
        <button
          onClick={() => handleSideChange("SHORT")}
          aria-pressed={side === "SHORT"}
          aria-label="Short position - sell"
          className={cn(
            "relative h-12 rounded-lg font-semibold text-sm transition-all duration-200",
            "flex items-center justify-center gap-2 border",
            side === "SHORT"
              ? "bg-loss/10 text-loss border-loss/40 ring-1 ring-loss/20"
              : "bg-background-secondary text-muted-foreground hover:text-loss hover:bg-loss/5 border-border hover:border-loss/30"
          )}
        >
          <TrendingDown className="h-4 w-4" aria-hidden="true" />
          <span>SHORT</span>
        </button>
      </div>

      {/* Order type tabs */}
      <div className="flex p-1 bg-background-tertiary rounded-xl" role="tablist" aria-label="Order type">
        {(["MARKET", "LIMIT"] as const).map((type) => (
          <button
            key={type}
            role="tab"
            aria-selected={orderType === type}
            aria-controls={`${type.toLowerCase()}-order-panel`}
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
        <div className="space-y-2" id="limit-order-panel" role="tabpanel" aria-labelledby="limit-tab">
          <Label htmlFor="limit-price-input" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Limit Price
          </Label>
          <div className="relative">
            <Input
              id="limit-price-input"
              type="number"
              placeholder="0.00"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className="font-mono pr-12 h-11"
              aria-describedby="limit-price-unit"
            />
            <span id="limit-price-unit" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              USD
            </span>
          </div>
        </div>
      )}

      {/* Quantity */}
      <div className="space-y-2" id="market-order-panel" role="tabpanel" aria-labelledby="market-tab">
        <div className="flex justify-between items-center">
          <Label htmlFor="quantity-input" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Quantity
          </Label>
          <span id="quantity-max" className="text-xs text-muted-foreground">
            Max: <span className="font-mono text-foreground">{formatNumber((availableBalance * leverage) / currentPrice, 4)}</span>
          </span>
        </div>
        <div className="relative">
          <Input
            id="quantity-input"
            type="number"
            placeholder="0.00"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="font-mono pr-16 h-11"
            aria-describedby="quantity-max quantity-unit"
          />
          <span id="quantity-unit" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
            {symbol.replace("USDT", "")}
          </span>
        </div>
        {/* Quick quantity buttons */}
        <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Quick quantity selection">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => setQuickQuantity(pct)}
              aria-label={`Set quantity to ${pct}% of maximum`}
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
          <Label htmlFor="leverage-slider" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Percent className="h-3.5 w-3.5" aria-hidden="true" />
            Leverage
          </Label>
          <span id="leverage-value" className={cn(
            "text-sm font-bold px-2.5 py-1 rounded-lg font-mono",
            leverage >= maxLeverage * 0.8 ? "bg-loss/10 text-loss" : "bg-primary/10 text-primary"
          )}>
            {leverage}x
          </span>
        </div>
        <div className="relative py-2">
          <input
            id="leverage-slider"
            type="range"
            min={1}
            max={maxLeverage}
            value={leverage}
            onChange={(e) => setLeverage(parseInt(e.target.value))}
            aria-label={`Leverage: ${leverage}x`}
            aria-valuemin={1}
            aria-valuemax={maxLeverage}
            aria-valuenow={leverage}
            aria-valuetext={`${leverage}x leverage`}
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
        <div className="flex justify-between gap-1" role="group" aria-label="Leverage presets">
          {leveragePresets.map((preset) => (
            <button
              key={preset}
              onClick={() => setLeverage(preset)}
              aria-label={`Set leverage to ${preset}x`}
              aria-pressed={leverage === preset}
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
        aria-expanded={showAdvanced}
        aria-controls="tpsl-inputs"
        className={cn(
          "w-full py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
          "flex items-center justify-center gap-2",
          showAdvanced
            ? "bg-primary/10 text-primary border border-primary/20"
            : "text-muted-foreground hover:text-foreground hover:bg-background-tertiary"
        )}
      >
        <Target className="h-4 w-4" aria-hidden="true" />
        {showAdvanced ? "Hide" : "Add"} Take Profit / Stop Loss
      </button>

      {/* TP/SL Inputs */}
      {showAdvanced && (
        <div id="tpsl-inputs" className="space-y-3 p-3 rounded-xl bg-background-tertiary/50 border border-border/50 animate-slide-down">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="take-profit-input" className="text-xs font-semibold text-profit flex items-center gap-1">
                <Target className="h-3 w-3" aria-hidden="true" />
                Take Profit
              </Label>
              <Input
                id="take-profit-input"
                type="number"
                placeholder="Price"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="font-mono text-sm h-10"
                aria-describedby={tpPrice > 0 && qty > 0 ? "tp-pnl" : undefined}
              />
              {tpPrice > 0 && qty > 0 && (
                <p id="tp-pnl" className="text-xs text-profit font-medium">
                  +{formatCurrency(tpPnl)} ({((tpPnl / marginRequired) * 100).toFixed(1)}%)
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stop-loss-input" className="text-xs font-semibold text-loss flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                Stop Loss
              </Label>
              <Input
                id="stop-loss-input"
                type="number"
                placeholder="Price"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="font-mono text-sm h-10"
                aria-describedby={slPrice > 0 && qty > 0 ? "sl-pnl" : undefined}
              />
              {slPrice > 0 && qty > 0 && (
                <p id="sl-pnl" className="text-xs text-loss font-medium">
                  {formatCurrency(slPnl)} ({((slPnl / marginRequired) * 100).toFixed(1)}%)
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order summary */}
      <div className="p-3 rounded-xl bg-background-secondary border border-border/50 space-y-2">
        {/* Position details */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Position Value</span>
          <span className="font-mono">{formatCurrency(positionValue)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Calculator className="h-3.5 w-3.5" />
            Margin Required
          </span>
          <span className="font-mono">{formatCurrency(marginRequired)}</span>
        </div>

        {/* Fee breakdown */}
        {qty > 0 && (
          <>
            <div className="border-t border-border/30 my-2" />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Entry Fee (0.05%)</span>
              <span className="font-mono text-warning">{formatCurrency(entryFee)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Exit Fee (est.)</span>
              <span className="font-mono text-muted-foreground">{formatCurrency(exitFeeEstimate)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span className="text-muted-foreground">Total Cost</span>
              <span className={cn("font-mono", totalCost > availableBalance && "text-loss")}>
                {formatCurrency(totalCost)}
              </span>
            </div>
          </>
        )}

        {/* Liquidation price */}
        {qty > 0 && (
          <>
            <div className="border-t border-border/30 my-2" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-loss" />
                Liq. Price
              </span>
              <div className="text-right">
                <span className="font-mono text-loss">{formatCurrency(liquidationPrice, { decimals: 2 })}</span>
                <span className="text-xs text-muted-foreground ml-1.5">
                  ({liquidationDistance.toFixed(1)}% away)
                </span>
              </div>
            </div>
          </>
        )}

        {/* Balance info */}
        <div className="border-t border-border/30 my-2" />
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
        <div className="flex items-start gap-2 p-3 rounded-xl bg-loss/10 border border-loss/20 text-loss text-sm" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="flex-1">{errorMessage}</span>
          <button
            onClick={dismissError}
            className="p-0.5 hover:bg-loss/20 rounded transition-colors shrink-0"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
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

      {/* Order Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-order-title"
          aria-describedby="confirm-order-warning"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfirmModal(false)}
            aria-hidden="true"
          />

          {/* Modal */}
          <div className="relative w-full max-w-sm mx-4 p-5 rounded-2xl bg-background border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  side === "LONG" ? "bg-profit/10" : "bg-loss/10"
                )} aria-hidden="true">
                  {side === "LONG" ? (
                    <TrendingUp className="h-5 w-5 text-profit" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-loss" />
                  )}
                </div>
                <div>
                  <h3 id="confirm-order-title" className="font-semibold">Confirm Order</h3>
                  <p className="text-sm text-muted-foreground">
                    {symbol.replace("USDT", "/USD")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-2 hover:bg-background-hover rounded-lg transition-colors"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Order Details */}
            <div className="space-y-3 p-3 rounded-xl bg-background-secondary border border-border/50 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Side</span>
                <span className={cn("font-semibold", side === "LONG" ? "text-profit" : "text-loss")}>
                  {side}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{orderType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quantity</span>
                <span className="font-mono">{formatNumber(qty, 6)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entry Price</span>
                <span className="font-mono">{formatCurrency(currentPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Leverage</span>
                <span className="font-mono">{leverage}x</span>
              </div>
              <div className="border-t border-border/50 pt-2 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Position Value</span>
                  <span className="font-mono">{formatCurrency(positionValue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Margin Required</span>
                  <span className="font-mono">{formatCurrency(marginRequired)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Entry Fee</span>
                  <span className="font-mono text-warning">{formatCurrency(entryFee)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium pt-1">
                  <span className="text-muted-foreground">Total Cost</span>
                  <span className="font-mono">{formatCurrency(totalCost)}</span>
                </div>
              </div>
              {(takeProfit || stopLoss) && (
                <div className="border-t border-border/50 pt-2 mt-2">
                  {takeProfit && (
                    <div className="flex justify-between text-sm">
                      <span className="text-profit flex items-center gap-1">
                        <Target className="h-3 w-3" /> Take Profit
                      </span>
                      <span className="font-mono">{formatCurrency(parseFloat(takeProfit))}</span>
                    </div>
                  )}
                  {stopLoss && (
                    <div className="flex justify-between text-sm">
                      <span className="text-loss flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3" /> Stop Loss
                      </span>
                      <span className="font-mono">{formatCurrency(parseFloat(stopLoss))}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="border-t border-border/50 pt-2 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-loss" /> Liq. Price
                  </span>
                  <span className="font-mono text-loss">{formatCurrency(liquidationPrice, { decimals: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div id="confirm-order-warning" role="alert" className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-warning text-xs mb-4">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Trading involves risk. You may lose your margin. Please confirm this order is correct.
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                className="flex-1 py-2.5 px-4 rounded-lg border border-border text-sm font-medium hover:bg-background-hover transition-colors"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                className={cn(
                  "flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2",
                  side === "LONG"
                    ? "bg-profit text-white hover:bg-profit/90"
                    : "bg-loss text-white hover:bg-loss/90"
                )}
                onClick={executeOrder}
              >
                {side === "LONG" ? (
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-4 w-4" aria-hidden="true" />
                )}
                Confirm {side}
              </button>
            </div>
          </div>
        </div>
      )}
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
