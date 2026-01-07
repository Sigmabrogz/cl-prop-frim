"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { tradesApi, accountsApi, type Trade, type TradingAccount } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatNumber, getPnLColor } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Download,
  Filter,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  BarChart3,
} from "lucide-react";

interface FilterState {
  accountId?: string;
  symbol?: string;
  side?: "LONG" | "SHORT";
  startDate?: string;
  endDate?: string;
}

function TradeHistoryContent() {
  const searchParams = useSearchParams();
  const accountIdParam = searchParams.get("account");

  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    accountId: accountIdParam || undefined,
  });

  // Stats
  const [stats, setStats] = useState({
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalPnl: 0,
    avgWin: 0,
    avgLoss: 0,
  });

  const loadTrades = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await tradesApi.list({
        ...filters,
        page,
        limit: 20,
      });

      if (response.success && response.data) {
        setTrades(response.data.trades || []);
        setTotalPages(Math.ceil((response.data.total || 0) / 20));

        // Calculate stats from trades
        const allTrades = response.data.trades || [];
        const wins = allTrades.filter((t) => parseFloat(t.netPnl) > 0);
        const losses = allTrades.filter((t) => parseFloat(t.netPnl) < 0);

        setStats({
          totalTrades: response.data.total || 0,
          winningTrades: wins.length,
          losingTrades: losses.length,
          totalPnl: allTrades.reduce((sum, t) => sum + parseFloat(t.netPnl), 0),
          avgWin: wins.length > 0 
            ? wins.reduce((sum, t) => sum + parseFloat(t.netPnl), 0) / wins.length 
            : 0,
          avgLoss: losses.length > 0 
            ? losses.reduce((sum, t) => sum + parseFloat(t.netPnl), 0) / losses.length 
            : 0,
        });
      }
    } catch (error) {
      console.error("Failed to load trades:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, page]);

  const loadAccounts = useCallback(async () => {
    try {
      const response = await accountsApi.list();
      if (response.success && response.data?.accounts) {
        setAccounts(response.data.accounts);
      }
    } catch (error) {
      console.error("Failed to load accounts:", error);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  const exportToCSV = () => {
    if (trades.length === 0) return;

    const headers = [
      "Date",
      "Symbol",
      "Side",
      "Quantity",
      "Entry Price",
      "Exit Price",
      "Gross P&L",
      "Fees",
      "Net P&L",
      "Close Reason",
    ];

    const rows = trades.map((trade) => [
      new Date(trade.closedAt).toISOString(),
      trade.symbol,
      trade.side,
      trade.quantity,
      trade.entryPrice,
      trade.exitPrice,
      trade.grossPnl,
      trade.fees,
      trade.netPnl,
      trade.closeReason,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trades-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trade History</h1>
          <p className="text-muted-foreground">
            View and analyze your closed trades
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(hasActiveFilters && "border-primary")}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                {Object.values(filters).filter(Boolean).length}
              </Badge>
            )}
          </Button>
          <Button variant="outline" onClick={exportToCSV} disabled={trades.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Trades</p>
            <p className="text-xl font-bold font-mono">{stats.totalTrades}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Winning</p>
            <p className="text-xl font-bold font-mono text-profit">{stats.winningTrades}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Losing</p>
            <p className="text-xl font-bold font-mono text-loss">{stats.losingTrades}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total P&L</p>
            <p className={cn("text-xl font-bold font-mono", getPnLColor(stats.totalPnl))}>
              {formatCurrency(stats.totalPnl, { showSign: true })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Avg Win</p>
            <p className="text-xl font-bold font-mono text-profit">
              {formatCurrency(stats.avgWin)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Avg Loss</p>
            <p className="text-xl font-bold font-mono text-loss">
              {formatCurrency(stats.avgLoss)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Account</label>
                <select
                  value={filters.accountId || ""}
                  onChange={(e) => setFilters({ ...filters, accountId: e.target.value || undefined })}
                  className="w-full h-10 px-3 rounded-lg bg-muted border border-border"
                >
                  <option value="">All Accounts</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Symbol</label>
                <Input
                  placeholder="e.g. BTCUSDT"
                  value={filters.symbol || ""}
                  onChange={(e) => setFilters({ ...filters, symbol: e.target.value || undefined })}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Side</label>
                <select
                  value={filters.side || ""}
                  onChange={(e) => setFilters({ ...filters, side: (e.target.value as "LONG" | "SHORT") || undefined })}
                  className="w-full h-10 px-3 rounded-lg bg-muted border border-border"
                >
                  <option value="">All Sides</option>
                  <option value="LONG">Long</option>
                  <option value="SHORT">Short</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Start Date</label>
                <Input
                  type="date"
                  value={filters.startDate || ""}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">End Date</label>
                <Input
                  type="date"
                  value={filters.endDate || ""}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
                />
              </div>
            </div>
            {hasActiveFilters && (
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Trades Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Closed Trades
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : trades.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No trades found</p>
              <p className="text-sm">
                {hasActiveFilters
                  ? "Try adjusting your filters"
                  : "Start trading to see your history here"}
              </p>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-8 gap-4 px-4 py-2 text-sm text-muted-foreground border-b border-border">
                <div>Date</div>
                <div>Symbol</div>
                <div>Side</div>
                <div className="text-right">Quantity</div>
                <div className="text-right">Entry</div>
                <div className="text-right">Exit</div>
                <div className="text-right">P&L</div>
                <div>Reason</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-border">
                {trades.map((trade) => {
                  const pnl = parseFloat(trade.netPnl);
                  const isWin = pnl > 0;

                  return (
                    <div
                      key={trade.id}
                      className="grid grid-cols-2 md:grid-cols-8 gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      {/* Mobile: Date & Symbol */}
                      <div className="md:contents">
                        <div className="flex items-center gap-2 md:block">
                          <Calendar className="h-4 w-4 text-muted-foreground md:hidden" />
                          <span className="text-sm">
                            {new Date(trade.closedAt).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-muted-foreground md:hidden">
                            {new Date(trade.closedAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      <div className="hidden md:flex items-center gap-2">
                        <div className={cn(
                          "w-6 h-6 rounded flex items-center justify-center",
                          trade.side === "LONG" ? "bg-profit/20" : "bg-loss/20"
                        )}>
                          {trade.side === "LONG" ? (
                            <TrendingUp className="h-3 w-3 text-profit" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-loss" />
                          )}
                        </div>
                        <span className="font-medium">{trade.symbol}</span>
                      </div>

                      <div className="hidden md:block">
                        <Badge variant={trade.side === "LONG" ? "success" : "danger"}>
                          {trade.side}
                        </Badge>
                      </div>

                      <div className="hidden md:block text-right font-mono">
                        {formatNumber(parseFloat(trade.quantity), 6)}
                      </div>

                      <div className="hidden md:block text-right font-mono">
                        {formatCurrency(parseFloat(trade.entryPrice))}
                      </div>

                      <div className="hidden md:block text-right font-mono">
                        {formatCurrency(parseFloat(trade.exitPrice))}
                      </div>

                      {/* Mobile: P&L */}
                      <div className="text-right md:text-right">
                        <div className="md:hidden flex items-center justify-end gap-2 mb-1">
                          <span className="font-medium">{trade.symbol}</span>
                          <Badge variant={trade.side === "LONG" ? "success" : "danger"} className="text-xs">
                            {trade.side}
                          </Badge>
                        </div>
                        <p className={cn("font-mono font-medium", getPnLColor(pnl))}>
                          {formatCurrency(pnl, { showSign: true })}
                        </p>
                        <p className="text-xs text-muted-foreground md:hidden">
                          {formatNumber(parseFloat(trade.quantity), 4)} @ {formatCurrency(parseFloat(trade.entryPrice))}
                        </p>
                      </div>

                      <div className="hidden md:block">
                        <Badge variant="secondary" className="text-xs">
                          {trade.closeReason.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TradeHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      }
    >
      <TradeHistoryContent />
    </Suspense>
  );
}

