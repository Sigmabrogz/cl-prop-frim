"use client";

import { useTradingStore, useWebSocket, type Position } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency, formatNumber, getPnLColor, formatDurationFromDate } from "@/lib/utils";
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
  Check,
  Loader2,
} from "lucide-react";
import { useEffect, useState, useCallback, useMemo, memo } from "react";

interface PositionsPanelProps {
  accountId: string;
}

// Alias for backwards compatibility - function now in utils
const formatDuration = formatDurationFromDate;

// Close Position Modal
interface CloseModalProps {
  position: Position | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (positionId: string, quantity?: number) => void;
}

function ClosePositionModal({ position, isOpen, onClose, onConfirm }: CloseModalProps) {
  const [closePercent, setClosePercent] = useState(100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const price = useTradingStore((state) => position ? state.prices[position.symbol] : null);

  const currentPrice = price
    ? position?.side === "LONG" ? price.bid : price.ask
    : position?.entryPrice || 0;

  // Reset when position changes
  useEffect(() => {
    if (position) {
      setClosePercent(100);
    }
  }, [position]);

  const closeQuantity = position ? (position.quantity * closePercent) / 100 : 0;
  const isPartialClose = closePercent < 100;

  // Calculate estimated P&L for close
  const estimatedPnl = position
    ? (position.side === "LONG"
      ? (currentPrice - position.entryPrice) * closeQuantity
      : (position.entryPrice - currentPrice) * closeQuantity)
    : 0;

  const handleConfirm = useCallback(() => {
    if (!position) return;
    setIsSubmitting(true);

    onConfirm(
      position.id,
      isPartialClose ? closeQuantity : undefined // undefined = full close
    );

    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
    }, 300);
  }, [position, closeQuantity, isPartialClose, onConfirm, onClose]);

  if (!isOpen || !position) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-position-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm mx-4 p-5 rounded-2xl bg-background border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              position.side === "LONG" ? "bg-profit/10" : "bg-loss/10"
            )} aria-hidden="true">
              {position.side === "LONG" ? (
                <TrendingUp className="h-5 w-5 text-profit" />
              ) : (
                <TrendingDown className="h-5 w-5 text-loss" />
              )}
            </div>
            <div>
              <h3 id="close-position-title" className="font-semibold">Close Position</h3>
              <p className="text-sm text-muted-foreground">
                {position.symbol.replace("USDT", "/USD")} • {position.leverage}x
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-background-hover rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Position Info */}
        <div className="p-3 rounded-xl bg-background-secondary border border-border/50 mb-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Size</p>
              <p className="font-mono font-medium">{formatNumber(position.quantity, 6)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entry</p>
              <p className="font-mono font-medium">{formatCurrency(position.entryPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current</p>
              <p className={cn(
                "font-mono font-medium",
                currentPrice > position.entryPrice ? "text-profit" : "text-loss"
              )}>
                {formatCurrency(currentPrice)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Unrealized P&L</p>
              <p className={cn("font-mono font-medium", getPnLColor(position.unrealizedPnl))}>
                {formatCurrency(position.unrealizedPnl, { showSign: true })}
              </p>
            </div>
          </div>
        </div>

        {/* Close Percentage Slider */}
        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <Label htmlFor="close-percent-slider" className="text-sm font-medium">Close Amount</Label>
            <span id="close-percent-value" className={cn(
              "text-sm font-bold px-2 py-1 rounded-lg font-mono",
              isPartialClose ? "bg-warning/10 text-warning" : "bg-loss/10 text-loss"
            )}>
              {closePercent}%
            </span>
          </div>
          <div className="relative py-2">
            <input
              id="close-percent-slider"
              type="range"
              min={10}
              max={100}
              step={10}
              value={closePercent}
              onChange={(e) => setClosePercent(parseInt(e.target.value))}
              aria-label={`Close ${closePercent}% of position`}
              aria-valuemin={10}
              aria-valuemax={100}
              aria-valuenow={closePercent}
              aria-valuetext={`${closePercent}%`}
              className={cn(
                "w-full h-2 rounded-full appearance-none cursor-pointer",
                "bg-gradient-to-r from-warning to-loss",
                "[&::-webkit-slider-thumb]:appearance-none",
                "[&::-webkit-slider-thumb]:w-5",
                "[&::-webkit-slider-thumb]:h-5",
                "[&::-webkit-slider-thumb]:rounded-full",
                "[&::-webkit-slider-thumb]:bg-white",
                "[&::-webkit-slider-thumb]:border-2",
                "[&::-webkit-slider-thumb]:border-loss",
                "[&::-webkit-slider-thumb]:shadow-lg",
                "[&::-webkit-slider-thumb]:cursor-pointer"
              )}
            />
          </div>
          <div className="flex justify-between gap-1" role="group" aria-label="Quick close percentage">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => setClosePercent(pct)}
                aria-label={`Close ${pct}% of position`}
                aria-pressed={closePercent === pct}
                className={cn(
                  "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  closePercent === pct
                    ? "bg-loss text-white"
                    : "bg-background-tertiary text-muted-foreground hover:text-foreground hover:bg-background-hover"
                )}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Close Summary */}
        <div className="p-3 rounded-xl bg-background-secondary border border-border/50 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Closing</span>
            <span className="font-mono">{formatNumber(closeQuantity, 6)}</span>
          </div>
          {isPartialClose && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-mono">{formatNumber(position.quantity - closeQuantity, 6)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-medium pt-1 border-t border-border/50">
            <span className="text-muted-foreground">Est. P&L</span>
            <span className={cn("font-mono", getPnLColor(estimatedPnl))}>
              {formatCurrency(estimatedPnl, { showSign: true })}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            className="flex-1 py-2.5 px-4 rounded-lg border border-border text-sm font-medium hover:bg-background-hover transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="flex-1 py-2.5 px-4 rounded-lg bg-loss text-white text-sm font-semibold hover:bg-loss/90 transition-colors flex items-center justify-center gap-2"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Closing...
              </>
            ) : (
              <>
                <X className="h-4 w-4" />
                {isPartialClose ? `Close ${closePercent}%` : "Close All"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// TP/SL Modification Modal
interface ModifyModalProps {
  position: Position | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (positionId: string, tp?: number, sl?: number) => void;
}

function ModifyTPSLModal({ position, isOpen, onClose, onSave }: ModifyModalProps) {
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const price = useTradingStore((state) => position ? state.prices[position.symbol] : null);

  const currentPrice = price
    ? position?.side === "LONG" ? price.bid : price.ask
    : position?.entryPrice || 0;

  // Reset form when position changes
  useEffect(() => {
    if (position) {
      setTakeProfit(position.takeProfit?.toString() || "");
      setStopLoss(position.stopLoss?.toString() || "");
    }
  }, [position]);

  const handleSave = useCallback(() => {
    if (!position) return;
    setIsSubmitting(true);

    const tp = takeProfit ? parseFloat(takeProfit) : undefined;
    const sl = stopLoss ? parseFloat(stopLoss) : undefined;

    onSave(position.id, tp, sl);

    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
    }, 300);
  }, [position, takeProfit, stopLoss, onSave, onClose]);

  // Validate TP/SL
  const tpValue = parseFloat(takeProfit) || 0;
  const slValue = parseFloat(stopLoss) || 0;

  const tpError = position && tpValue > 0 && (
    (position.side === "LONG" && tpValue <= currentPrice) ||
    (position.side === "SHORT" && tpValue >= currentPrice)
  );

  const slError = position && slValue > 0 && (
    (position.side === "LONG" && slValue >= currentPrice) ||
    (position.side === "SHORT" && slValue <= currentPrice)
  );

  // Calculate estimated P&L
  const tpPnl = position && tpValue > 0
    ? (position.side === "LONG" ? tpValue - position.entryPrice : position.entryPrice - tpValue) * position.quantity
    : 0;
  const slPnl = position && slValue > 0
    ? (position.side === "LONG" ? slValue - position.entryPrice : position.entryPrice - slValue) * position.quantity
    : 0;

  if (!isOpen || !position) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modify-tpsl-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 p-5 rounded-2xl bg-background border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              position.side === "LONG" ? "bg-profit/10" : "bg-loss/10"
            )} aria-hidden="true">
              {position.side === "LONG" ? (
                <TrendingUp className="h-5 w-5 text-profit" />
              ) : (
                <TrendingDown className="h-5 w-5 text-loss" />
              )}
            </div>
            <div>
              <h3 id="modify-tpsl-title" className="font-semibold">Modify TP/SL</h3>
              <p className="text-sm text-muted-foreground">
                {position.symbol.replace("USDT", "/USD")} • {position.leverage}x
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-background-hover rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Position Info */}
        <div className="p-3 rounded-xl bg-background-secondary border border-border/50 mb-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Entry</p>
              <p className="font-mono font-medium">{formatCurrency(position.entryPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current</p>
              <p className={cn(
                "font-mono font-medium",
                currentPrice > position.entryPrice ? "text-profit" : "text-loss"
              )}>
                {formatCurrency(currentPrice)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Size</p>
              <p className="font-mono font-medium">{formatNumber(position.quantity, 4)}</p>
            </div>
          </div>
        </div>

        {/* TP/SL Inputs */}
        <div className="space-y-4">
          {/* Take Profit */}
          <div className="space-y-2">
            <Label htmlFor="modify-tp-input" className="flex items-center gap-2 text-sm font-medium text-profit">
              <Target className="h-4 w-4" aria-hidden="true" />
              Take Profit
            </Label>
            <Input
              id="modify-tp-input"
              type="number"
              placeholder={`Enter price ${position.side === "LONG" ? "above" : "below"} ${formatCurrency(currentPrice)}`}
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              aria-invalid={!!tpError}
              aria-describedby="tp-hint"
              className={cn(
                "font-mono",
                tpError && "border-loss focus-visible:ring-loss"
              )}
            />
            <div id="tp-hint" className="flex justify-between text-xs">
              {tpError ? (
                <span className="text-loss" role="alert">
                  Must be {position.side === "LONG" ? "above" : "below"} current price
                </span>
              ) : tpPnl !== 0 ? (
                <span className="text-profit">
                  Est. profit: {formatCurrency(tpPnl, { showSign: true })}
                </span>
              ) : (
                <span className="text-muted-foreground">Leave empty to remove</span>
              )}
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setTakeProfit("")}
                aria-label="Clear take profit"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Stop Loss */}
          <div className="space-y-2">
            <Label htmlFor="modify-sl-input" className="flex items-center gap-2 text-sm font-medium text-loss">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              Stop Loss
            </Label>
            <Input
              id="modify-sl-input"
              type="number"
              placeholder={`Enter price ${position.side === "LONG" ? "below" : "above"} ${formatCurrency(currentPrice)}`}
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              aria-invalid={!!slError}
              aria-describedby="sl-hint"
              className={cn(
                "font-mono",
                slError && "border-loss focus-visible:ring-loss"
              )}
            />
            <div id="sl-hint" className="flex justify-between text-xs">
              {slError ? (
                <span className="text-loss" role="alert">
                  Must be {position.side === "LONG" ? "below" : "above"} current price
                </span>
              ) : slPnl !== 0 ? (
                <span className="text-loss">
                  Est. loss: {formatCurrency(slPnl, { showSign: true })}
                </span>
              ) : (
                <span className="text-muted-foreground">Leave empty to remove</span>
              )}
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setStopLoss("")}
                aria-label="Clear stop loss"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={isSubmitting || !!tpError || !!slError}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Memoized position row to prevent unnecessary re-renders
const PositionRow = memo(function PositionRow({ position, onClose, onModify, currentTime }: {
  position: Position;
  onClose: (id: string) => void;
  onModify: (id: string) => void;
  currentTime: number; // Global time signal from parent
}) {
  const price = useTradingStore((state) => state.prices[position.symbol]);

  // Format duration using global time - no per-position interval needed
  const duration = useMemo(() => formatDuration(position.openedAt), [position.openedAt, currentTime]);

  // Memoize expensive calculations
  const { currentPrice, unrealizedPnl, roe, isNearLiquidation } = useMemo(() => {
    const currPrice = price
      ? position.side === "LONG"
        ? price.bid
        : price.ask
      : position.entryPrice;

    const priceDiff = position.side === "LONG"
      ? currPrice - position.entryPrice
      : position.entryPrice - currPrice;

    const pnl = priceDiff * position.quantity * position.leverage;

    // ROE (Return on Equity) - PnL relative to margin used
    const returnOnEquity = position.marginUsed > 0
      ? (pnl / position.marginUsed) * 100
      : 0;

    // Liquidation distance
    const liqDist = position.liquidationPrice
      ? ((position.liquidationPrice - currPrice) / currPrice * 100)
      : null;

    // Check if close to liquidation (within 5%)
    const nearLiq = liqDist && Math.abs(liqDist) < 5;

    return {
      currentPrice: currPrice,
      unrealizedPnl: pnl,
      roe: returnOnEquity,
      isNearLiquidation: nearLiq,
    };
  }, [price, position]);

  return (
    <tr className={cn(
      "border-b border-border/30 hover:bg-background-secondary/50 transition-colors",
      isNearLiquidation && "bg-loss/5"
    )}>
      {/* Symbol & Side */}
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center",
            position.side === "LONG" ? "bg-profit/10" : "bg-loss/10"
          )}>
            {position.side === "LONG" ? (
              <TrendingUp className="h-3.5 w-3.5 text-profit" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-loss" />
            )}
          </div>
          <div>
            <p className="font-medium text-sm">{position.symbol.replace("USDT", "/USD")}</p>
            <p className="text-xs text-muted-foreground">{position.leverage}x</p>
          </div>
        </div>
      </td>

      {/* Size */}
      <td className="py-2.5 px-3">
        <p className="font-mono text-sm">{formatNumber(position.quantity, 4)}</p>
        <p className="font-mono text-xs text-muted-foreground">{formatCurrency(position.marginUsed)}</p>
      </td>

      {/* Entry Price */}
      <td className="py-2.5 px-3">
        <p className="font-mono text-sm">{formatCurrency(position.entryPrice)}</p>
      </td>

      {/* Mark Price */}
      <td className="py-2.5 px-3">
        <p className={cn(
          "font-mono text-sm",
          currentPrice > position.entryPrice ? "text-profit" : currentPrice < position.entryPrice ? "text-loss" : ""
        )}>
          {formatCurrency(currentPrice)}
        </p>
      </td>

      {/* Liq. Price */}
      <td className="py-2.5 px-3">
        <p className={cn(
          "font-mono text-sm",
          isNearLiquidation && "text-loss"
        )}>
          {position.liquidationPrice ? formatCurrency(position.liquidationPrice) : "-"}
        </p>
      </td>

      {/* TP/SL */}
      <td className="py-2.5 px-3">
        <div className="flex flex-col gap-0.5">
          {position.takeProfit ? (
            <span className="text-xs font-mono text-profit">{formatCurrency(position.takeProfit)}</span>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
          {position.stopLoss ? (
            <span className="text-xs font-mono text-loss">{formatCurrency(position.stopLoss)}</span>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </div>
      </td>

      {/* PnL */}
      <td className="py-2.5 px-3">
        <p className={cn("font-mono text-sm font-semibold", getPnLColor(unrealizedPnl))}>
          {formatCurrency(unrealizedPnl, { showSign: true })}
        </p>
        <p className={cn("font-mono text-xs", getPnLColor(roe))}>
          {roe >= 0 ? "+" : ""}{roe.toFixed(2)}%
        </p>
      </td>

      {/* Duration */}
      <td className="py-2.5 px-3">
        <p className="text-xs text-muted-foreground">{duration}</p>
      </td>

      {/* Actions */}
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onModify(position.id)}
            className="p-1.5 hover:bg-background-hover rounded-md transition-colors"
            title="Modify TP/SL"
          >
            <Edit2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
          <button
            onClick={() => onClose(position.id)}
            className="p-1.5 bg-loss/10 hover:bg-loss/20 rounded-md transition-colors"
            title="Close position"
          >
            <X className="h-3.5 w-3.5 text-loss" />
          </button>
        </div>
      </td>
    </tr>
  );
});

export function PositionsPanel({ accountId }: PositionsPanelProps) {
  const positions = useTradingStore((state) =>
    state.positions.filter((p) => p.accountId === accountId)
  );
  const { closePosition, modifyPosition } = useWebSocket();

  // Single global time state - updates every second for all positions
  // This replaces per-position intervals (10 positions = 1 interval, not 10)
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Modal state
  const [modifyModalOpen, setModifyModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeAllModalOpen, setCloseAllModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  const handleClose = useCallback((positionId: string) => {
    const position = positions.find((p) => p.id === positionId);
    if (!position) return;
    setSelectedPosition(position);
    setCloseModalOpen(true);
  }, [positions]);

  const handleCloseConfirm = useCallback((positionId: string, quantity?: number) => {
    closePosition(positionId, accountId, quantity);
  }, [closePosition, accountId]);

  const handleModify = useCallback((positionId: string) => {
    const position = positions.find((p) => p.id === positionId);
    if (!position) return;
    setSelectedPosition(position);
    setModifyModalOpen(true);
  }, [positions]);

  const handleSaveTPSL = useCallback((positionId: string, tp?: number, sl?: number) => {
    modifyPosition(positionId, accountId, {
      takeProfit: tp,
      stopLoss: sl,
    });
  }, [modifyPosition, accountId]);

  const handleCloseAll = useCallback(() => {
    positions.forEach((pos) => closePosition(pos.id, accountId));
    setCloseAllModalOpen(false);
  }, [positions, closePosition, accountId]);

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
      {/* Positions table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-background z-10">
            <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
              <th className="py-2 px-3 font-medium">Symbol</th>
              <th className="py-2 px-3 font-medium">Size</th>
              <th className="py-2 px-3 font-medium">Entry</th>
              <th className="py-2 px-3 font-medium">Mark</th>
              <th className="py-2 px-3 font-medium">Liq.</th>
              <th className="py-2 px-3 font-medium">TP/SL</th>
              <th className="py-2 px-3 font-medium">PnL (ROE)</th>
              <th className="py-2 px-3 font-medium">Time</th>
              <th className="py-2 px-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <PositionRow
                key={position.id}
                position={position}
                onClose={handleClose}
                onModify={handleModify}
                currentTime={currentTime}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with summary and close all */}
      <div className="pt-2 mt-2 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            {positions.length} position{positions.length !== 1 ? "s" : ""}
          </span>
          <span className="text-muted-foreground">
            Margin: <span className="font-mono text-foreground">{formatCurrency(totalMargin)}</span>
          </span>
          <span className="text-muted-foreground">
            Total PnL: <span className={cn("font-mono font-semibold", getPnLColor(totalPnl))}>{formatCurrency(totalPnl, { showSign: true })}</span>
          </span>
        </div>
        {positions.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            className="hover:bg-loss/10 hover:border-loss/50 hover:text-loss transition-colors"
            onClick={() => setCloseAllModalOpen(true)}
          >
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Close All
          </Button>
        )}
      </div>

      {/* TP/SL Modification Modal */}
      <ModifyTPSLModal
        position={selectedPosition}
        isOpen={modifyModalOpen}
        onClose={() => {
          setModifyModalOpen(false);
          setSelectedPosition(null);
        }}
        onSave={handleSaveTPSL}
      />

      {/* Close Position Modal */}
      <ClosePositionModal
        position={selectedPosition}
        isOpen={closeModalOpen}
        onClose={() => {
          setCloseModalOpen(false);
          setSelectedPosition(null);
        }}
        onConfirm={handleCloseConfirm}
      />

      {/* Close All Positions Modal */}
      {closeAllModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-all-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setCloseAllModalOpen(false)}
            aria-hidden="true"
          />

          {/* Modal */}
          <div className="relative w-full max-w-sm mx-4 p-5 rounded-2xl bg-background border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-loss/10" aria-hidden="true">
                  <AlertTriangle className="h-5 w-5 text-loss" />
                </div>
                <div>
                  <h3 id="close-all-title" className="font-semibold">Close All Positions</h3>
                  <p className="text-sm text-muted-foreground">
                    {positions.length} position{positions.length > 1 ? 's' : ''} will be closed
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCloseAllModalOpen(false)}
                className="p-2 hover:bg-background-hover rounded-lg transition-colors"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Summary */}
            <div className="p-3 rounded-xl bg-background-secondary border border-border/50 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Positions</span>
                <span className="font-mono font-medium">{positions.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Margin</span>
                <span className="font-mono font-medium">
                  {formatCurrency(positions.reduce((sum, p) => sum + p.marginUsed, 0))}
                </span>
              </div>
              <div className="flex justify-between text-sm font-medium pt-1 border-t border-border/50">
                <span className="text-muted-foreground">Est. Total P&L</span>
                <span className={cn("font-mono", getPnLColor(totalPnl))}>
                  {formatCurrency(totalPnl, { showSign: true })}
                </span>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-loss/10 border border-loss/20 text-loss text-xs mb-4" role="alert">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                This action cannot be undone. All {positions.length} positions will be closed at market price.
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                className="flex-1 py-2.5 px-4 rounded-lg border border-border text-sm font-medium hover:bg-background-hover transition-colors"
                onClick={() => setCloseAllModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 py-2.5 px-4 rounded-lg bg-loss text-white text-sm font-semibold hover:bg-loss/90 transition-colors flex items-center justify-center gap-2"
                onClick={handleCloseAll}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Close All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
