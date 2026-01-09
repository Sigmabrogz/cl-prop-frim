"use client";

import { useTradingStore } from "@/hooks/use-websocket";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown, Activity, Star, StarOff } from "lucide-react";
import Image from "next/image";

interface PriceTickerProps {
  symbol: string;
  onClick?: () => void;
  isSelected?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  compact?: boolean;
}

// Symbol logo URLs using CoinGecko CDN (reliable and free)
const symbolLogos: Record<string, string> = {
  BTC: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  ETH: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  SOL: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  DOGE: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png",
  XRP: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png",
  ADA: "https://assets.coingecko.com/coins/images/975/small/cardano.png",
  DOT: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png",
  LINK: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
  BNB: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
  AVAX: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
};

// Fallback gradient colors if image fails to load
const symbolGradients: Record<string, string> = {
  BTC: "from-orange-500 to-yellow-500",
  ETH: "from-purple-500 to-blue-500",
  SOL: "from-purple-400 to-pink-500",
  DOGE: "from-yellow-400 to-orange-400",
  XRP: "from-gray-400 to-gray-600",
  ADA: "from-blue-400 to-blue-600",
  DOT: "from-pink-500 to-purple-500",
  LINK: "from-blue-500 to-indigo-500",
  BNB: "from-yellow-500 to-yellow-600",
  AVAX: "from-red-500 to-red-600",
};

function CryptoIcon({ symbol, size = 32, className }: { symbol: string; size?: number; className?: string }) {
  const logoUrl = symbolLogos[symbol];
  const gradient = symbolGradients[symbol] || "from-gray-500 to-gray-600";

  if (!logoUrl) {
    // Fallback to letter icon
    return (
      <div className={cn(
        "rounded-lg bg-gradient-to-br flex items-center justify-center",
        gradient,
        className
      )} style={{ width: size, height: size }}>
        <span className="font-bold text-white" style={{ fontSize: size * 0.4 }}>{symbol[0]}</span>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-lg overflow-hidden bg-background-tertiary", className)} style={{ width: size, height: size }}>
      <Image
        src={logoUrl}
        alt={`${symbol} logo`}
        width={size}
        height={size}
        className="object-contain"
        unoptimized // Use unoptimized for external URLs
      />
    </div>
  );
}

export function PriceTicker({
  symbol,
  onClick,
  isSelected,
  isFavorite,
  onToggleFavorite,
  compact = false,
}: PriceTickerProps) {
  const price = useTradingStore((state) => state.prices[symbol]);
  const baseSymbol = symbol.replace("USDT", "");

  if (!price) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-2 p-2 rounded-lg transition-all w-full",
          isSelected
            ? "bg-primary/10 border border-primary/30"
            : "bg-background-secondary hover:bg-background-tertiary border border-transparent hover:border-border"
        )}
      >
        <div className="animate-pulse flex items-center gap-2 w-full">
          <div className="w-8 h-8 rounded-lg bg-muted shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="h-3 w-12 bg-muted rounded" />
            <div className="h-3 w-16 bg-muted rounded" />
          </div>
        </div>
      </button>
    );
  }

  // Use Binance mid price for display (real market price)
  const marketPrice = price.binanceMid;
  // Real 24h change from Binance
  const change24h = price.priceChangePercent24h || 0;
  const isPositive = change24h >= 0;

  // Format price based on value
  const formatPrice = (p: number) => {
    if (p >= 10000) return formatCurrency(p, { decimals: 0 });
    if (p >= 100) return formatCurrency(p, { decimals: 2 });
    return formatCurrency(p, { decimals: 4 });
  };

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "flex items-center justify-between p-2 rounded-lg transition-all w-full",
          isSelected
            ? "bg-primary/10 border border-primary/30"
            : "hover:bg-background-tertiary border border-transparent"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <CryptoIcon symbol={baseSymbol} size={24} className="shrink-0" />
          <span className="font-medium text-sm truncate">{baseSymbol}</span>
        </div>
        <div className="text-right shrink-0 ml-2">
          <p className="font-mono font-semibold text-sm">
            {formatPrice(marketPrice)}
          </p>
          <p className={cn(
            "text-xs font-medium",
            isPositive ? "text-profit" : "text-loss"
          )}>
            {isPositive ? "+" : ""}{change24h.toFixed(2)}%
          </p>
        </div>
      </button>
    );
  }

  return (
    <button
      className={cn(
        "relative flex items-center gap-2 p-2 rounded-lg transition-all w-full group text-left",
        isSelected
          ? "bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/30 shadow-sm"
          : "bg-background-secondary/50 hover:bg-background-tertiary border border-transparent hover:border-border/50"
      )}
      onClick={onClick}
    >
      {/* Favorite button */}
      {onToggleFavorite && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="absolute top-1 right-1 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background-hover rounded cursor-pointer"
        >
          {isFavorite ? (
            <Star className="h-3 w-3 text-primary fill-primary" />
          ) : (
            <StarOff className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      )}

      {/* Symbol icon */}
      <CryptoIcon 
        symbol={baseSymbol} 
        size={32} 
        className="shadow-sm transition-transform group-hover:scale-105 shrink-0" 
      />

      {/* Symbol and price - responsive layout */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-1">
          <span className="font-semibold text-sm truncate">{baseSymbol}/USD</span>
          {isSelected && (
            <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse shrink-0" />
          )}
        </div>
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono font-bold text-sm truncate">
            {formatPrice(marketPrice)}
          </span>
          <span className={cn(
            "text-xs font-semibold shrink-0 px-1 py-0.5 rounded",
            isPositive ? "text-profit bg-profit/10" : "text-loss bg-loss/10"
          )}>
            {isPositive ? "+" : ""}{change24h.toFixed(1)}%
          </span>
        </div>
      </div>
    </button>
  );
}

export function PriceDisplay({ symbol, showDetails = true }: { symbol: string; showDetails?: boolean }) {
  const price = useTradingStore((state) => state.prices[symbol]);
  const baseSymbol = symbol.replace("USDT", "");

  if (!price) {
    return (
      <div className="flex items-center gap-4 animate-pulse">
        <div className="h-8 w-8 rounded-lg bg-muted shrink-0" />
        <div className="space-y-1">
          <div className="h-5 w-24 bg-muted rounded" />
          <div className="h-3 w-14 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // Use Binance mid price for display (real market price - matches TradingView)
  const marketPrice = price.binanceMid;
  const change24h = price.priceChangePercent24h || 0;
  const isPositive = change24h >= 0;

  // Real funding rate from Binance Futures
  const fundingRate = price.fundingRate || 0;
  const isFundingPositive = fundingRate >= 0;

  return (
    <div className="flex items-center gap-6">
      {/* Left: Symbol + Price */}
      <div className="flex items-center gap-3">
        {/* Symbol icon */}
        <CryptoIcon symbol={baseSymbol} size={32} className="shrink-0" />

        {/* Price and symbol - show market price (Binance mid) */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-mono font-bold tracking-tight">
              {formatCurrency(marketPrice, { decimals: 2 })}
            </span>
            <span className={cn(
              "text-xs font-semibold px-1.5 py-0.5 rounded",
              isPositive ? "text-profit bg-profit/10" : "text-loss bg-loss/10"
            )}>
              {isPositive ? "+" : ""}{change24h.toFixed(2)}%
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{baseSymbol}/USD</span>
        </div>
      </div>

      {showDetails && (
        <>
          {/* Divider */}
          <div className="hidden md:block h-8 w-px bg-border" />

          {/* Bid/Ask/24h stats - Clean grid */}
          <div className="hidden md:flex items-center gap-4 text-xs">
            <div className="flex flex-col">
              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Bid</span>
              <span className="font-mono font-semibold text-profit">{formatCurrency(price.bid, { decimals: 2 })}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Ask</span>
              <span className="font-mono font-semibold text-loss">{formatCurrency(price.ask, { decimals: 2 })}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">24h High</span>
              <span className="font-mono font-semibold text-foreground">{formatCurrency(price.high24h, { decimals: 2 })}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">24h Low</span>
              <span className="font-mono font-semibold text-foreground">{formatCurrency(price.low24h, { decimals: 2 })}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block h-8 w-px bg-border" />

          {/* Funding Rate */}
          <div className="hidden lg:flex flex-col text-xs">
            <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Funding</span>
            <span className={cn(
              "font-mono font-semibold",
              isFundingPositive ? "text-profit" : "text-loss"
            )}>
              {isFundingPositive ? "+" : ""}{(fundingRate * 100).toFixed(4)}%
            </span>
          </div>

          {/* Live indicator */}
          <div className="hidden xl:flex items-center gap-1.5 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
            <span className="text-muted-foreground font-medium">Live</span>
          </div>
        </>
      )}
    </div>
  );
}

// Mini price ticker for headers/toolbars
export function MiniPriceTicker({ symbol }: { symbol: string }) {
  const price = useTradingStore((state) => state.prices[symbol]);
  const baseSymbol = symbol.replace("USDT", "");

  if (!price) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background-tertiary animate-pulse">
        <div className="w-4 h-4 rounded bg-muted" />
        <div className="w-16 h-4 rounded bg-muted" />
      </div>
    );
  }

  // Use Binance mid price for display (real market price)
  const marketPrice = price.binanceMid;
  const change24h = price.priceChangePercent24h || 0;
  const isPositive = change24h >= 0;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background-tertiary/50">
      <span className="text-xs text-muted-foreground">{baseSymbol}</span>
      <span className="font-mono font-semibold text-sm">{formatCurrency(marketPrice, { decimals: 0 })}</span>
      <span className={cn(
        "text-xs font-medium",
        isPositive ? "text-profit" : "text-loss"
      )}>
        {isPositive ? "+" : ""}{change24h.toFixed(1)}%
      </span>
    </div>
  );
}
