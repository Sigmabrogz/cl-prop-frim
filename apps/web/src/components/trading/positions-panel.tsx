"use client";

import { useTradingStore, useWebSocket, type Position } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatNumber, getPnLColor } from "@/lib/utils";
import {
  X,
  Edit2,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  Clock,
  MoreHorizontal,
  AlertTriangle,
  Layers,
  Skull,
  DollarSign,
  Percent,
  Timer,
} from "lucide-react";
import { useEffect, useState } from "react";

interface PositionsPanelProps {
  accountId: string;
}

// Helper to format duration
function formatDuration(openedAt: string): string {
  const opened = new Date(openedAt);
  const now = new Date();
  const diffMs = now.getTime() - opened.getTime();
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function PositionRow({ position, onClose, onModify }: {
  position: Position;
  onClose: (id: string) => void;
  onModify: (id: string) => void;
}) {
  const price = useTradingStore((state) => state.prices[position.symbol]);
  const [duration, setDuration] = useState(formatDuration(position.openedAt));

  // Update duration every second
  useEffect(() => {
    const interval = setInterval(() => {
      setDuration(formatDuration(position.openedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [position.openedAt]);

  // Calculate unrealized P&L
  const currentPrice = price
    ? position.side === "LONG"
      ? price.bid
      : price.ask
    : position.entryPrice;

  const priceDiff = position.side === "LONG"
    ? currentPrice - position.entryPrice
    : position.entryPrice - currentPrice;

  const unrealizedPnl = priceDiff * position.quantity * position.leverage;
  const pnlPercent = (priceDiff / position.entryPrice) * 100 * position.leverage;
  
  // ROE (Return on Equity) - PnL relative to margin used
  const roe = position.marginUsed > 0 
    ? (unrealizedPnl / position.marginUsed) * 100 
    : 0;

  // Calculate distance to TP/SL/Liquidation
  const tpDistance = position.takeProfit
    ? ((position.takeProfit - currentPrice) / currentPrice * 100).toFixed(2)
    : null;
  const slDistance = position.stopLoss
    ? ((position.stopLoss - currentPrice) / currentPrice * 100).toFixed(2)
    : null;
  
  // Liquidation distance
  const liqDistance = position.liquidationPrice
    ? ((position.liquidationPrice - currentPrice) / currentPrice * 100).toFixed(2)
    : null;
  
  // Check if close to liquidation (within 5%)
  const isNearLiquidation = liqDistance && Math.abs(parseFloat(liqDistance)) < 5;

  return (
    <div className={cn(
      "p-3 rounded-xl bg-gradient-to-br from-background-secondary to-background-tertiary border transition-all group",
      isNearLiquidation 
        ? "border-loss/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]" 
        : "border-border/50 hover:border-border"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105",
              position.side === "LONG"
                ? "bg-gradient-to-br from-profit/20 to-profit/5"
                : "bg-gradient-to-br from-loss/20 to-loss/5"
            )}
          >
            {position.side === "LONG" ? (
              <TrendingUp className="h-5 w-5 text-profit" />
            ) : (
              <TrendingDown className="h-5 w-5 text-loss" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">{position.symbol.replace("USDT", "/USD")}</p>
              <Badge
                variant={position.side === "LONG" ? "success" : "danger"}
                size="xs"
              >
                {position.side}
              </Badge>
              <Badge variant="outline" size="xs" className="font-mono">
                {position.leverage}x
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" />
              <span>{duration}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onModify(position.id)}
            className="p-1.5 hover:bg-background-hover rounded-lg transition-colors"
            title="Modify TP/SL"
          >
            <Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
          <button
            onClick={() => onClose(position.id)}
            className="p-2 bg-loss/10 hover:bg-loss/20 rounded-lg transition-colors border border-loss/20"
            title="Close position"
          >
            <X className="h-4 w-4 text-loss" />
          </button>
        </div>
      </div>

      {/* Stats grid - Row 1: Size, Entry, Current, P&L */}
      <div className="grid grid-cols-4 gap-2 text-sm mb-2">
        <div className="space-y-0.5">
          <p className="text-xxs text-muted-foreground uppercase tracking-wide">Size</p>
          <p className="font-mono font-medium text-xs">{formatNumber(position.quantity, 6)}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xxs text-muted-foreground uppercase tracking-wide">Entry</p>
          <p className="font-mono font-medium text-xs">{formatCurrency(position.entryPrice)}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xxs text-muted-foreground uppercase tracking-wide">Current</p>
          <p className={cn(
            "font-mono font-medium text-xs",
            currentPrice > position.entryPrice ? "text-profit" : currentPrice < position.entryPrice ? "text-loss" : ""
          )}>
            {formatCurrency(currentPrice)}
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xxs text-muted-foreground uppercase tracking-wide">P&L</p>
          <p className={cn("font-mono font-bold text-xs", getPnLColor(unrealizedPnl))}>
            {formatCurrency(unrealizedPnl, { showSign: true })}
          </p>
        </div>
      </div>

      {/* Stats grid - Row 2: Margin, Value, ROE, Liq Price */}
      <div className="grid grid-cols-4 gap-2 text-sm p-2 rounded-lg bg-background/50 border border-border/30">
        <div className="space-y-0.5">
          <p className="text-xxs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <DollarSign className="h-2.5 w-2.5" />
            Margin
          </p>
          <p className="font-mono font-medium text-xs">{formatCurrency(position.marginUsed)}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xxs text-muted-foreground uppercase tracking-wide">Value</p>
          <p className="font-mono font-medium text-xs">{formatCurrency(position.entryValue)}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xxs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Percent className="h-2.5 w-2.5" />
            ROE
          </p>
          <p className={cn("font-mono font-bold text-xs", getPnLColor(roe))}>
            {roe >= 0 ? "+" : ""}{roe.toFixed(2)}%
          </p>
        </div>
        <div className="space-y-0.5">
          <p className={cn(
            "text-xxs uppercase tracking-wide flex items-center gap-1",
            isNearLiquidation ? "text-loss font-medium" : "text-muted-foreground"
          )}>
            <Skull className="h-2.5 w-2.5" />
            Liq.
          </p>
          <p className={cn(
            "font-mono font-medium text-xs",
            isNearLiquidation && "text-loss animate-pulse"
          )}>
            {formatCurrency(position.liquidationPrice)}
          </p>
        </div>
      </div>

      {/* TP/SL indicators */}
      {(position.takeProfit || position.stopLoss) && (
        <div className="flex gap-2 mt-2">
          {position.takeProfit && (
            <div className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-profit/5 border border-profit/20">
              <Target className="h-3 w-3 text-profit shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xxs text-profit font-medium">TP</p>
                <p className="font-mono text-xs truncate">{formatCurrency(position.takeProfit)}</p>
              </div>
              {tpDistance && (
                <span className="text-xxs text-profit font-mono">{tpDistance}%</span>
              )}
            </div>
          )}
          {position.stopLoss && (
            <div className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-loss/5 border border-loss/20">
              <ShieldAlert className="h-3 w-3 text-loss shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xxs text-loss font-medium">SL</p>
                <p className="font-mono text-xs truncate">{formatCurrency(position.stopLoss)}</p>
              </div>
              {slDistance && (
                <span className="text-xxs text-loss font-mono">{slDistance}%</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Liquidation warning */}
      {isNearLiquidation && (
        <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-loss/10 border border-loss/30">
          <AlertTriangle className="h-3.5 w-3.5 text-loss animate-pulse" />
          <p className="text-xs text-loss font-medium">
            Warning: {Math.abs(parseFloat(liqDistance!))}% from liquidation
          </p>
        </div>
      )}
    </div>
  );
}

export function PositionsPanel({ accountId }: PositionsPanelProps) {
  const positions = useTradingStore((state) =>
    state.positions.filter((p) => p.accountId === accountId)
  );
  const { closePosition, modifyPosition } = useWebSocket();

  const handleClose = (positionId: string) => {
    if (confirm("Are you sure you want to close this position?")) {
      closePosition(positionId, accountId);
    }
  };

  const handleModify = (positionId: string) => {
    const position = positions.find((p) => p.id === positionId);
    if (!position) return;

    const newTP = prompt("New Take Profit (leave empty to remove):", position.takeProfit?.toString() || "");
    const newSL = prompt("New Stop Loss (leave empty to remove):", position.stopLoss?.toString() || "");

    modifyPosition(positionId, accountId, {
      takeProfit: newTP ? parseFloat(newTP) : undefined,
      stopLoss: newSL ? parseFloat(newSL) : undefined,
    });
  };

  // Calculate totals
  const totalPnl = positions.reduce((sum, pos) => {
    const price = useTradingStore.getState().prices[pos.symbol];
    if (!price) return sum;

    const currentPrice = pos.side === "LONG" ? price.bid : price.ask;
    const priceDiff = pos.side === "LONG"
      ? currentPrice - pos.entryPrice
      : pos.entryPrice - currentPrice;

    return sum + priceDiff * pos.quantity * pos.leverage;
  }, 0);

  const totalMargin = positions.reduce((sum, pos) => {
    return sum + (pos.marginUsed || (pos.quantity * pos.entryPrice) / pos.leverage);
  }, 0);

  const totalValue = positions.reduce((sum, pos) => {
    return sum + (pos.entryValue || pos.quantity * pos.entryPrice);
  }, 0);

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-background-secondary to-background-tertiary flex items-center justify-center mb-4">
          <Layers className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-semibold mb-1">No Open Positions</p>
        <p className="text-sm text-muted-foreground max-w-[200px]">
          Place an order to open your first position
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Summary header */}
      <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-gradient-to-r from-background-secondary to-background-tertiary border border-border/50 mb-3">
        <div>
          <p className="text-xxs text-muted-foreground uppercase tracking-wide">Positions</p>
          <p className="text-lg font-bold">{positions.length}</p>
        </div>
        <div>
          <p className="text-xxs text-muted-foreground uppercase tracking-wide">Margin</p>
          <p className="font-mono font-semibold">{formatCurrency(totalMargin)}</p>
        </div>
        <div>
          <p className="text-xxs text-muted-foreground uppercase tracking-wide">Value</p>
          <p className="font-mono font-semibold">{formatCurrency(totalValue)}</p>
        </div>
        <div className="text-right">
          <p className="text-xxs text-muted-foreground uppercase tracking-wide">Total P&L</p>
          <p className={cn("text-lg font-bold font-mono", getPnLColor(totalPnl))}>
            {formatCurrency(totalPnl, { showSign: true })}
          </p>
        </div>
      </div>

      {/* Position list */}
      <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin pr-1">
        {positions.map((position) => (
          <PositionRow
            key={position.id}
            position={position}
            onClose={handleClose}
            onModify={handleModify}
          />
        ))}
      </div>

      {/* Close all button */}
      {positions.length > 1 && (
        <div className="pt-3 mt-3 border-t border-border">
          <Button
            variant="outline"
            className="w-full hover:bg-loss/10 hover:border-loss/50 hover:text-loss transition-colors"
            onClick={() => {
              if (confirm(`Close all ${positions.length} positions?`)) {
                positions.forEach((pos) => closePosition(pos.id, accountId));
              }
            }}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Close All Positions
          </Button>
        </div>
      )}
    </div>
  );
}
