"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { accountsApi, type TradingAccount } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatPercent, getPnLColor } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  AlertTriangle,
  ArrowRight,
  Plus,
  BarChart3,
  Clock,
  DollarSign,
} from "lucide-react";

// Stat card component
function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  change?: string;
  changeLabel?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            {change && (
              <div className="flex items-center gap-1 text-sm">
                {trend === "up" && <TrendingUp className="h-4 w-4 text-profit" />}
                {trend === "down" && <TrendingDown className="h-4 w-4 text-loss" />}
                <span className={cn(
                  trend === "up" && "text-profit",
                  trend === "down" && "text-loss",
                  trend === "neutral" && "text-muted-foreground"
                )}>
                  {change}
                </span>
                {changeLabel && (
                  <span className="text-muted-foreground">{changeLabel}</span>
                )}
              </div>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Account card component
function AccountCard({ account }: { account: TradingAccount }) {
  const balance = parseFloat(account.currentBalance);
  const startingBalance = parseFloat(account.startingBalance);
  const pnl = balance - startingBalance;
  const pnlPercent = (pnl / startingBalance) * 100;
  const dailyPnl = parseFloat(account.dailyPnl);
  const profitTarget = parseFloat(account.profitTarget);
  const progress = Math.min((pnl / profitTarget) * 100, 100);

  const statusColors: Record<string, string> = {
    active: "bg-profit/20 text-profit",
    passed: "bg-blue-500/20 text-blue-500",
    failed: "bg-loss/20 text-loss",
    breached: "bg-loss/20 text-loss",
    funded: "bg-primary/20 text-primary",
    pending_payment: "bg-yellow-500/20 text-yellow-500",
  };

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground font-mono">
              {account.accountNumber}
            </p>
            <p className="text-lg font-semibold mt-1">
              {formatCurrency(balance)}
            </p>
          </div>
          <Badge className={statusColors[account.status] || "bg-muted"}>
            {account.status.replace("_", " ")}
          </Badge>
        </div>

        {/* P&L */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Total P&L</p>
            <p className={cn("text-sm font-medium tabular-nums", getPnLColor(pnl))}>
              {formatCurrency(pnl, { showSign: true })} ({formatPercent(pnlPercent, true)})
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Daily P&L</p>
            <p className={cn("text-sm font-medium tabular-nums", getPnLColor(dailyPnl))}>
              {formatCurrency(dailyPnl, { showSign: true })}
            </p>
          </div>
        </div>

        {/* Progress to target */}
        {account.status === "active" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress to target</span>
              <span className="font-medium">{progress.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  progress >= 100 ? "bg-profit" : "bg-primary"
                )}
                style={{ width: `${Math.max(0, progress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-border">
          <Link href={`/dashboard/trading?account=${account.id}`} className="flex-1">
            <Button variant="default" size="sm" className="w-full">
              Trade
            </Button>
          </Link>
          <Link href={`/dashboard/accounts/${account.id}`}>
            <Button variant="outline" size="sm">
              Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAccounts() {
      try {
        const response = await accountsApi.list();
        if (response.success && response.data?.accounts) {
          setAccounts(response.data.accounts);
        }
      } catch (error) {
        console.error("Failed to load accounts:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (!authLoading && user) {
      loadAccounts();
    }
  }, [authLoading, user]);

  // Calculate aggregate stats
  const totalBalance = accounts.reduce(
    (sum, acc) => sum + parseFloat(acc.currentBalance),
    0
  );
  const totalPnl = accounts.reduce(
    (sum, acc) =>
      sum + (parseFloat(acc.currentBalance) - parseFloat(acc.startingBalance)),
    0
  );
  const activeAccounts = accounts.filter((acc) => acc.status === "active").length;
  const fundedAccounts = accounts.filter((acc) => acc.status === "funded").length;

  if (authLoading || isLoading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-24" />
                  <div className="h-8 bg-muted rounded w-32" />
                  <div className="h-4 bg-muted rounded w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {user?.username || "Trader"}
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s an overview of your trading performance
          </p>
        </div>
        <Link href="/dashboard/accounts/new">
          <Button variant="glow">
            <Plus className="mr-2 h-4 w-4" />
            New Challenge
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Balance"
          value={formatCurrency(totalBalance)}
          icon={Wallet}
        />
        <StatCard
          title="Total P&L"
          value={formatCurrency(totalPnl, { showSign: true })}
          change={formatPercent((totalPnl / (totalBalance - totalPnl)) * 100, true)}
          icon={BarChart3}
          trend={totalPnl >= 0 ? "up" : "down"}
        />
        <StatCard
          title="Active Accounts"
          value={activeAccounts.toString()}
          change={`${fundedAccounts} funded`}
          icon={Target}
          trend="neutral"
        />
        <StatCard
          title="Trading Days"
          value={accounts.reduce((sum, acc) => sum + acc.tradingDays, 0).toString()}
          changeLabel="total"
          icon={Clock}
          trend="neutral"
        />
      </div>

      {/* Accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your Accounts</h2>
          <Link href="/dashboard/accounts">
            <Button variant="ghost" size="sm">
              View all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {accounts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Wallet className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No accounts yet</h3>
              <p className="text-muted-foreground mb-4">
                Start your trading journey by purchasing a challenge
              </p>
              <Link href="/dashboard/accounts/new">
                <Button variant="glow">
                  <Plus className="mr-2 h-4 w-4" />
                  Get Started
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.slice(0, 6).map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/dashboard/trading" className="block">
              <Button variant="outline" className="w-full justify-start">
                <BarChart3 className="mr-2 h-4 w-4" />
                Open Trading Terminal
              </Button>
            </Link>
            <Link href="/dashboard/accounts/new" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="mr-2 h-4 w-4" />
                Start New Challenge
              </Button>
            </Link>
            <Link href="/dashboard/history" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Clock className="mr-2 h-4 w-4" />
                View Trade History
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Need Help?</CardTitle>
            <CardDescription>
              Our support team is available 24/7
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Report an Issue
            </Button>
            <Link href="/dashboard/help" className="block">
              <Button variant="outline" className="w-full justify-start">
                <DollarSign className="mr-2 h-4 w-4" />
                Request Payout
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

