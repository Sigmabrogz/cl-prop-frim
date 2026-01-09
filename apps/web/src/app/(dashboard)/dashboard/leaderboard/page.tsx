"use client";

import { Trophy, Medal, TrendingUp, Users, Crown, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Mock leaderboard data
const leaderboardData = [
  { rank: 1, username: "CryptoKing", profit: 28450, winRate: 78, trades: 156, badge: "gold" },
  { rank: 2, username: "TraderPro", profit: 24200, winRate: 72, trades: 203, badge: "silver" },
  { rank: 3, username: "BitMaster", profit: 21800, winRate: 69, trades: 178, badge: "bronze" },
  { rank: 4, username: "SwingTrader", profit: 18900, winRate: 65, trades: 142, badge: null },
  { rank: 5, username: "DayTrader99", profit: 16500, winRate: 71, trades: 234, badge: null },
  { rank: 6, username: "CryptoNinja", profit: 15200, winRate: 68, trades: 189, badge: null },
  { rank: 7, username: "TradingAce", profit: 14100, winRate: 64, trades: 167, badge: null },
  { rank: 8, username: "ProfitHunter", profit: 12800, winRate: 62, trades: 145, badge: null },
  { rank: 9, username: "MarketMaker", profit: 11500, winRate: 66, trades: 198, badge: null },
  { rank: 10, username: "ChartWizard", profit: 10200, winRate: 61, trades: 176, badge: null },
];

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Crown className="h-5 w-5 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />;
    case 3:
      return <Medal className="h-5 w-5 text-amber-600" />;
    default:
      return <span className="text-muted-foreground font-mono w-5 text-center">{rank}</span>;
  }
}

function getBadgeColor(badge: string | null) {
  switch (badge) {
    case "gold":
      return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
    case "silver":
      return "bg-gray-400/20 text-gray-400 border-gray-400/30";
    case "bronze":
      return "bg-amber-600/20 text-amber-600 border-amber-600/30";
    default:
      return "";
  }
}

export default function LeaderboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-muted-foreground">
          Top performing traders this month
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Trophy className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Top Profit</p>
                <p className="text-xl font-bold text-profit">$28,450</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Traders</p>
                <p className="text-xl font-bold">1,247</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-profit/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-profit" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Win Rate</p>
                <p className="text-xl font-bold">67%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Star className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Payouts</p>
                <p className="text-xl font-bold">$2.8M</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Monthly Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm text-muted-foreground border-b border-border">
              <div className="col-span-1">Rank</div>
              <div className="col-span-4">Trader</div>
              <div className="col-span-2 text-right">Profit</div>
              <div className="col-span-2 text-right">Win Rate</div>
              <div className="col-span-2 text-right">Trades</div>
              <div className="col-span-1"></div>
            </div>

            {/* Rows */}
            {leaderboardData.map((trader) => (
              <div
                key={trader.rank}
                className={`grid grid-cols-12 gap-4 px-4 py-3 rounded-lg transition-colors hover:bg-muted/50 ${
                  trader.rank <= 3 ? "bg-muted/30" : ""
                }`}
              >
                <div className="col-span-1 flex items-center">
                  {getRankIcon(trader.rank)}
                </div>
                <div className="col-span-4 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                    {trader.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-medium">{trader.username}</span>
                </div>
                <div className="col-span-2 text-right font-mono text-profit">
                  ${trader.profit.toLocaleString()}
                </div>
                <div className="col-span-2 text-right font-mono">
                  {trader.winRate}%
                </div>
                <div className="col-span-2 text-right font-mono text-muted-foreground">
                  {trader.trades}
                </div>
                <div className="col-span-1 flex justify-end">
                  {trader.badge && (
                    <Badge variant="outline" className={getBadgeColor(trader.badge)}>
                      {trader.badge}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-500/50" />
            <p className="text-sm">
              Rankings are updated daily based on profit performance.
              <br />
              Top 3 traders receive special badges and bonus rewards.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

