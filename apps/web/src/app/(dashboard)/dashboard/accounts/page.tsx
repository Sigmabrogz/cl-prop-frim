"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { accountsApi, type TradingAccount } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatPercent, getPnLColor } from "@/lib/utils";
import {
  Plus,
  Filter,
  Search,
  TrendingUp,
  TrendingDown,
  MoreVertical,
} from "lucide-react";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

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
    loadAccounts();
  }, []);

  const filteredAccounts = accounts.filter((account) => {
    if (filter !== "all" && account.status !== filter) return false;
    if (search && !account.accountNumber.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const statusColors: Record<string, string> = {
    active: "bg-profit/20 text-profit",
    passed: "bg-blue-500/20 text-blue-500",
    failed: "bg-loss/20 text-loss",
    breached: "bg-loss/20 text-loss",
    funded: "bg-primary/20 text-primary",
    pending_payment: "bg-yellow-500/20 text-yellow-500",
  };

  const filters = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "funded", label: "Funded" },
    { value: "passed", label: "Passed" },
    { value: "breached", label: "Breached" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-10 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-muted rounded w-32" />
                  <div className="h-8 bg-muted rounded w-24" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-10 bg-muted rounded w-full" />
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
          <h1 className="text-2xl font-bold">Trading Accounts</h1>
          <p className="text-muted-foreground">
            Manage your evaluation and funded accounts
          </p>
        </div>
        <Link href="/dashboard/accounts/new">
          <Button variant="glow">
            <Plus className="mr-2 h-4 w-4" />
            New Challenge
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accounts grid */}
      {filteredAccounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              {search || filter !== "all"
                ? "No accounts match your filters"
                : "You don't have any accounts yet"}
            </p>
            <Link href="/dashboard/accounts/new">
              <Button variant="glow">
                <Plus className="mr-2 h-4 w-4" />
                Start Your First Challenge
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAccounts.map((account) => {
            const balance = parseFloat(account.currentBalance);
            const startingBalance = parseFloat(account.startingBalance);
            const pnl = balance - startingBalance;
            const pnlPercent = (pnl / startingBalance) * 100;
            const dailyPnl = parseFloat(account.dailyPnl);
            const profitTarget = parseFloat(account.profitTarget);
            const progress = Math.min((pnl / profitTarget) * 100, 100);

            return (
              <Card key={account.id} className="hover:border-primary/30 transition-colors">
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
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[account.status] || "bg-muted"}>
                        {account.status.replace("_", " ")}
                      </Badge>
                      <button className="p-1 hover:bg-muted rounded">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  {/* P&L */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total P&L</p>
                      <div className="flex items-center gap-1">
                        {pnl >= 0 ? (
                          <TrendingUp className="h-3 w-3 text-profit" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-loss" />
                        )}
                        <p className={cn("text-sm font-medium tabular-nums", getPnLColor(pnl))}>
                          {formatCurrency(pnl, { showSign: true })}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Daily P&L</p>
                      <p className={cn("text-sm font-medium tabular-nums", getPnLColor(dailyPnl))}>
                        {formatCurrency(dailyPnl, { showSign: true })}
                      </p>
                    </div>
                  </div>

                  {/* Progress */}
                  {account.status === "active" && (
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
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

                  {/* Meta */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                    <span>{account.tradingDays} trading days</span>
                    <span>Step {account.currentStep}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-border">
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
          })}
        </div>
      )}
    </div>
  );
}

