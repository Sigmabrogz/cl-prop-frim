"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import { useTradingStore } from "@/hooks/use-websocket";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown, Activity, Layers, ChevronDown } from "lucide-react";

interface OrderBookProps {
  symbol: string;
  levels?: number;
  compact?: boolean;
  onPriceClick?: (price: number) => void;
  onSizeClick?: (size: number) => void;
}

// Aggregation options
const AGGREGATION_OPTIONS = [0.01, 0.1, 1, 10, 50, 100];

// Seeded random number generator for stable values
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

// Generate stable order book levels based on price
function generateOrderBookLevels(midPrice: number, spread: number, levels: number = 10, aggregation: number = 1) {
  const bids: { price: number; size: number; total: number }[] = [];
  const asks: { price: number; size: number; total: number }[] = [];

  const bidStart = Math.floor((midPrice - spread / 2) / aggregation) * aggregation;
  const askStart = Math.ceil((midPrice + spread / 2) / aggregation) * aggregation;

  let bidTotal = 0;
  let askTotal = 0;

  for (let i = 0; i < levels; i++) {
    // Bids decrease in price
    const bidPrice = bidStart - i * aggregation;
    // Use seeded random based on price level for stable sizes
    const bidSize = seededRandom(Math.floor(bidPrice * 100)) * 2 + 0.1;
    bidTotal += bidSize;
    bids.push({ price: bidPrice, size: bidSize, total: bidTotal });

    // Asks increase in price
    const askPrice = askStart + i * aggregation;
    const askSize = seededRandom(Math.floor(askPrice * 100) + 1000) * 2 + 0.1;
    askTotal += askSize;
    asks.push({ price: askPrice, size: askSize, total: askTotal });
  }

  return { bids, asks };
}

export function OrderBook({ symbol, levels = 12, compact = false, onPriceClick, onSizeClick }: OrderBookProps) {
  const price = useTradingStore((state) => state.prices[symbol]);
  const [aggregation, setAggregation] = useState(1);
  const [showAggDropdown, setShowAggDropdown] = useState(false);
  const stableDataRef = useRef<{
    midPrice: number;
    spread: number;
    bids: { price: number; size: number; total: number }[];
    asks: { price: number; size: number; total: number }[];
  } | null>(null);

  // Memoize order book data - only regenerate when price changes by $10+
  const orderBookData = useMemo(() => {
    if (!price || !price.bid || !price.ask) return null;

    const midPrice = (price.bid + price.ask) / 2;
    const spread = price.spread || (price.ask - price.bid);

    if (isNaN(midPrice) || midPrice <= 0) return null;

    return {
      midPrice,
      spread,
      ...generateOrderBookLevels(midPrice, spread, levels, aggregation),
    };
  }, [
    price?.bid ? Math.floor(price.bid / 10) : 0,
    price?.ask ? Math.floor(price.ask / 10) : 0,
    levels,
    aggregation,
  ]);

  // Keep a stable reference to the last valid data
  if (orderBookData) {
    stableDataRef.current = orderBookData;
  }
  const data = stableDataRef.current;

  const handlePriceClick = useCallback((price: number) => {
    onPriceClick?.(price);
  }, [onPriceClick]);

  const handleSizeClick = useCallback((size: number) => {
    onSizeClick?.(size);
  }, [onSizeClick]);

  if (!data) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4">
        <Layers className="h-6 w-6 mb-2 opacity-50 animate-pulse" />
        <p className="text-xs">Waiting for data...</p>
      </div>
    );
  }

  const { bids, asks, midPrice, spread } = data;
  const maxTotal = Math.max(
    bids[bids.length - 1]?.total || 0,
    asks[asks.length - 1]?.total || 0
  );

  // Determine price decimals based on price magnitude
  const priceDecimals = midPrice > 1000 ? 2 : midPrice > 100 ? 2 : midPrice > 1 ? 4 : 6;

  return (
    <div className="h-full flex flex-col text-xs font-mono">
      {/* Header with aggregation selector */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border bg-background-tertiary/50">
        <span className="text-muted-foreground font-sans font-medium text-[10px] uppercase tracking-wider">Order Book</span>
        
        {/* Aggregation Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowAggDropdown(!showAggDropdown)}
            className={cn(
              "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px]",
              "bg-background hover:bg-background-hover border border-border/50",
              "transition-colors"
            )}
          >
            <span className="text-muted-foreground">Agg:</span>
            <span className="font-medium">{aggregation}</span>
            <ChevronDown className={cn(
              "h-2.5 w-2.5 text-muted-foreground transition-transform",
              showAggDropdown && "rotate-180"
            )} />
          </button>

          {showAggDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowAggDropdown(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden animate-scale-in">
                {AGGREGATION_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setAggregation(opt);
                      setShowAggDropdown(false);
                    }}
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-[10px] font-mono hover:bg-background-tertiary transition-colors",
                      aggregation === opt && "bg-primary/10 text-primary"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 gap-1 px-2 py-1 border-b border-border/50 bg-background-secondary/30">
        <span className="text-muted-foreground font-sans text-[9px] uppercase tracking-wider">Price</span>
        <span className="text-right text-muted-foreground font-sans text-[9px] uppercase tracking-wider">Size</span>
        <span className="text-right text-muted-foreground font-sans text-[9px] uppercase tracking-wider">Total</span>
      </div>

      {/* Asks (reversed so lowest ask is at bottom) */}
      <div className="flex-1 overflow-hidden flex flex-col-reverse min-h-0">
        {asks.slice().reverse().map((level, i) => (
          <OrderBookRow
            key={`ask-${i}`}
            price={level.price}
            size={level.size}
            total={level.total}
            maxTotal={maxTotal}
            type="ask"
            priceDecimals={priceDecimals}
            onPriceClick={handlePriceClick}
            onSizeClick={handleSizeClick}
          />
        ))}
      </div>

      {/* Spread indicator - Professional compact design */}
      <div className="px-2 py-1.5 border-y border-border/50 bg-background-secondary/50">
        {/* Spread row */}
        <div className="flex items-center justify-between text-[10px] mb-1.5">
          <span className="text-muted-foreground font-sans">Spread</span>
          <span className="font-mono text-foreground/70">
            {formatNumber(spread, 2)} <span className="text-muted-foreground">({((spread / midPrice) * 100).toFixed(3)}%)</span>
          </span>
        </div>

        {/* Bid/Ask prices - clean horizontal layout */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => handlePriceClick(price?.bid || 0)}
            className="flex items-center justify-between px-2 py-1.5 rounded border border-profit/20 bg-profit/5 hover:bg-profit/10 transition-colors"
          >
            <span className="text-[9px] text-muted-foreground font-sans uppercase">Bid</span>
            <span className="text-profit font-mono font-semibold text-[11px]">
              {formatCurrency(price?.bid || 0, { decimals: priceDecimals })}
            </span>
          </button>
          <button
            onClick={() => handlePriceClick(price?.ask || 0)}
            className="flex items-center justify-between px-2 py-1.5 rounded border border-loss/20 bg-loss/5 hover:bg-loss/10 transition-colors"
          >
            <span className="text-[9px] text-muted-foreground font-sans uppercase">Ask</span>
            <span className="text-loss font-mono font-semibold text-[11px]">
              {formatCurrency(price?.ask || 0, { decimals: priceDecimals })}
            </span>
          </button>
        </div>
      </div>

      {/* Bids */}
      <div className="flex-1 overflow-hidden min-h-0">
        {bids.map((level, i) => (
          <OrderBookRow
            key={`bid-${i}`}
            price={level.price}
            size={level.size}
            total={level.total}
            maxTotal={maxTotal}
            type="bid"
            priceDecimals={priceDecimals}
            onPriceClick={handlePriceClick}
            onSizeClick={handleSizeClick}
          />
        ))}
      </div>

      {/* Footer stats */}
      {!compact && (
        <div className="px-2 py-1 border-t border-border bg-background-tertiary/30 flex items-center justify-between text-[9px] text-muted-foreground">
          <span>Depth: {levels}</span>
          <span className="flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-profit animate-pulse" />
            Live
          </span>
        </div>
      )}
    </div>
  );
}

interface OrderBookRowProps {
  price: number;
  size: number;
  total: number;
  maxTotal: number;
  type: "bid" | "ask";
  priceDecimals: number;
  onPriceClick?: (price: number) => void;
  onSizeClick?: (size: number) => void;
}

function OrderBookRow({
  price,
  size,
  total,
  maxTotal,
  type,
  priceDecimals,
  onPriceClick,
  onSizeClick,
}: OrderBookRowProps) {
  const depthPercent = (total / maxTotal) * 100;

  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-1 px-2 py-0.5 relative transition-colors group text-[11px]",
        type === "ask" ? "hover:bg-loss/5" : "hover:bg-profit/5"
      )}
    >
      {/* Depth bar background */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 transition-all duration-300 pointer-events-none",
          type === "ask"
            ? "bg-gradient-to-l from-loss/15 to-transparent"
            : "bg-gradient-to-l from-profit/15 to-transparent"
        )}
        style={{ width: `${depthPercent}%` }}
      />

      {/* Price - clickable */}
      <button
        onClick={() => onPriceClick?.(price)}
        className={cn(
          "relative text-left font-medium transition-colors truncate",
          type === "ask"
            ? "text-loss hover:text-loss/80"
            : "text-profit hover:text-profit/80",
          "hover:underline underline-offset-2"
        )}
      >
        {formatCurrency(price, { decimals: priceDecimals })}
      </button>

      {/* Size - clickable */}
      <button
        onClick={() => onSizeClick?.(size)}
        className="relative text-right text-foreground/80 hover:text-foreground transition-colors hover:underline underline-offset-2 truncate"
      >
        {formatNumber(size, 4)}
      </button>

      {/* Total */}
      <span className="relative text-right text-muted-foreground truncate">
        {formatNumber(total, 2)}
      </span>
    </div>
  );
}

// Compact horizontal order book for mobile
export function OrderBookCompact({ symbol, onPriceClick }: { symbol: string; onPriceClick?: (price: number) => void }) {
  const price = useTradingStore((state) => state.prices[symbol]);

  if (!price) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-background-secondary rounded-lg">
      <button
        onClick={() => onPriceClick?.(price.bid)}
        className="flex flex-col items-start"
      >
        <span className="text-[10px] text-muted-foreground">Bid</span>
        <span className="text-sm font-mono font-bold text-profit">
          {formatCurrency(price.bid, { decimals: 2 })}
        </span>
      </button>
      
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-muted-foreground">Spread</span>
        <span className="text-xs font-mono text-muted-foreground">
          {formatNumber(price.spread, 2)}
        </span>
      </div>
      
      <button
        onClick={() => onPriceClick?.(price.ask)}
        className="flex flex-col items-end"
      >
        <span className="text-[10px] text-muted-foreground">Ask</span>
        <span className="text-sm font-mono font-bold text-loss">
          {formatCurrency(price.ask, { decimals: 2 })}
        </span>
      </button>
    </div>
  );
}
