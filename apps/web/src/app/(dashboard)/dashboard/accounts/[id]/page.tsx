"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { accountsApi, tradesApi, type TradingAccount, type Trade } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatNumber, formatPercent, getPnLColor } from "@/lib/utils";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  Shield,
  Calendar,
  Activity,
  BarChart3,
  Clock,
  Zap,
} from "lucide-react";

export default function AccountDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [account, setAccount] = useState<TradingAccount | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [accountRes, tradesRes] = await Promise.all([
          accountsApi.get(id),
          tradesApi.list({ accountId: id, limit: 10 }),
        ]);

        if (accountRes.success && accountRes.data) {
          setAccount(accountRes.data.account);
        }
        if (tradesRes.success && tradesRes.data) {
          setTrades(tradesRes.data.trades || []);
        }
      } catch (error) {
        console.error("Failed to load account:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <h2 className="text-xl font-semibold mb-2">Account Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The account you're looking for doesn't exist or you don't have access.
        </p>
        <Button onClick={() => router.push("/dashboard/accounts")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Accounts
        </Button>
      </div>
    );
  }

  const balance = parseFloat(account.currentBalance);
  const startingBalance = parseFloat(account.startingBalance);
  const profitTarget = parseFloat(account.profitTarget);
  const currentProfit = parseFloat(account.currentProfit);
  const dailyPnl = parseFloat(account.dailyPnl);
  const dailyLossLimit = parseFloat(account.dailyLossLimit);
  const maxDrawdownLimit = parseFloat(account.maxDrawdownLimit);
  const peakBalance = parseFloat(account.peakBalance);

  // Calculate metrics
  const totalPnl = balance - startingBalance;
  const totalPnlPercent = (totalPnl / startingBalance) * 100;
  const profitProgress = Math.min((currentProfit / profitTarget) * 100, 100);
  const dailyLossUsed = Math.abs(Math.min(dailyPnl, 0));
  const dailyLossPercent = (dailyLossUsed / dailyLossLimit) * 100;
  const currentDrawdown = peakBalance - balance;
  const drawdownPercent = (currentDrawdown / peakBalance) * 100;
  const winRate = account.totalTrades > 0 
    ? (account.winningTrades / account.totalTrades) * 100 
    : 0;

  const statusColors: Record<string, string> = {
    active: "bg-profit/20 text-profit",
    funded: "bg-primary/20 text-primary",
    breached: "bg-loss/20 text-loss",
    passed: "bg-profit/20 text-profit",
    pending_payment: "bg-yellow-500/20 text-yellow-500",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{account.accountNumber}</h1>
              <Badge className={statusColors[account.status] || "bg-muted"}>
                {account.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {account.accountType === "evaluation" ? "Evaluation Account" : "Funded Account"} • 
              Step {account.currentStep}
            </p>
          </div>
        </div>
        <Link href={`/dashboard/trading?account=${account.id}`}>
          <Button>
            <Zap className="mr-2 h-4 w-4" />
            Trade Now
          </Button>
        </Link>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="text-2xl font-bold font-mono">{formatCurrency(balance)}</p>
                <p className={cn("text-sm font-mono", getPnLColor(totalPnl))}>
                  {formatCurrency(totalPnl, { showSign: true })} ({totalPnlPercent >= 0 ? "+" : ""}{totalPnlPercent.toFixed(2)}%)
                </p>
              </div>
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                totalPnl >= 0 ? "bg-profit/20" : "bg-loss/20"
              )}>
                {totalPnl >= 0 ? (
                  <TrendingUp className="h-6 w-6 text-profit" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-loss" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Profit Target</p>
                <p className="text-2xl font-bold font-mono">{formatCurrency(profitTarget)}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(currentProfit)} earned ({profitProgress.toFixed(1)}%)
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Target className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="mt-3">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${profitProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Daily P&L</p>
                <p className={cn("text-2xl font-bold font-mono", getPnLColor(dailyPnl))}>
                  {formatCurrency(dailyPnl, { showSign: true })}
                </p>
                <p className="text-sm text-muted-foreground">
                  Limit: {formatCurrency(dailyLossLimit)}
                </p>
              </div>
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                dailyLossPercent > 80 ? "bg-loss/20" : dailyLossPercent > 50 ? "bg-yellow-500/20" : "bg-profit/20"
              )}>
                <AlertTriangle className={cn(
                  "h-6 w-6",
                  dailyLossPercent > 80 ? "text-loss" : dailyLossPercent > 50 ? "text-yellow-500" : "text-profit"
                )} />
              </div>
            </div>
            <div className="mt-3">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-500",
                    dailyLossPercent > 80 ? "bg-loss" : dailyLossPercent > 50 ? "bg-yellow-500" : "bg-profit"
                  )}
                  style={{ width: `${Math.min(dailyLossPercent, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {dailyLossPercent.toFixed(1)}% of daily limit used
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Max Drawdown</p>
                <p className={cn("text-2xl font-bold font-mono", drawdownPercent > 5 ? "text-loss" : "")}>
                  {formatCurrency(currentDrawdown)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Limit: {formatCurrency(maxDrawdownLimit)}
                </p>
              </div>
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                drawdownPercent > 8 ? "bg-loss/20" : drawdownPercent > 5 ? "bg-yellow-500/20" : "bg-profit/20"
              )}>
                <Shield className={cn(
                  "h-6 w-6",
                  drawdownPercent > 8 ? "text-loss" : drawdownPercent > 5 ? "text-yellow-500" : "text-profit"
                )} />
              </div>
            </div>
            <div className="mt-3">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-500",
                    drawdownPercent > 8 ? "bg-loss" : drawdownPercent > 5 ? "bg-yellow-500" : "bg-profit"
                  )}
                  style={{ width: `${Math.min((currentDrawdown / maxDrawdownLimit) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {((currentDrawdown / maxDrawdownLimit) * 100).toFixed(1)}% of max drawdown
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trading Stats & Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trading Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Trading Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Trades</span>
              <span className="font-mono font-medium">{account.totalTrades}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Winning Trades</span>
              <span className="font-mono font-medium text-profit">{account.winningTrades}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Losing Trades</span>
              <span className="font-mono font-medium text-loss">{account.losingTrades}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Win Rate</span>
              <span className={cn("font-mono font-medium", winRate >= 50 ? "text-profit" : "text-loss")}>
                {winRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Trading Days</span>
              <span className="font-mono font-medium">{account.tradingDays}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Volume</span>
              <span className="font-mono font-medium">{formatCurrency(parseFloat(account.totalVolume))}</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Trades */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Trades
            </CardTitle>
            <Link href={`/dashboard/history?account=${account.id}`}>
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {trades.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No trades yet</p>
                <p className="text-sm">Start trading to see your history</p>
              </div>
            ) : (
              <div className="space-y-2">
                {trades.map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        trade.side === "LONG" ? "bg-profit/20" : "bg-loss/20"
                      )}>
                        {trade.side === "LONG" ? (
                          <TrendingUp className="h-4 w-4 text-profit" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-loss" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{trade.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          {trade.side} • {formatNumber(parseFloat(trade.quantity), 6)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("font-mono font-medium", getPnLColor(parseFloat(trade.netPnl)))}>
                        {formatCurrency(parseFloat(trade.netPnl), { showSign: true })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(trade.closedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{new Date(account.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Trade</p>
              <p className="font-medium">
                {account.lastTradeAt 
                  ? new Date(account.lastTradeAt).toLocaleDateString()
                  : "Never"
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">BTC/ETH Leverage</p>
              <p className="font-medium">{account.maxLeverage}x</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Min Trading Days</p>
              <p className="font-medium">{account.tradingDays} / 5</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

