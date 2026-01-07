"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";
import { useTradingStore } from "@/hooks/use-websocket";
import { type TradingAccount } from "@/lib/api";
import {
  Wallet,
  ChevronDown,
  WifiOff,
  TrendingUp,
  TrendingDown,
  Shield,
  Keyboard,
  Settings,
  User,
  Bell,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Badge } from "@/components/ui/badge";

// Re-export the TradingAccount type for components that import from here
export type { TradingAccount } from "@/lib/api";

interface TradingTopBarProps {
  accounts: TradingAccount[];
  selectedAccount: TradingAccount | null;
  onSelectAccount: (account: TradingAccount) => void;
  onOpenShortcuts?: () => void;
}

export function TradingTopBar({
  accounts,
  selectedAccount,
  onSelectAccount,
  onOpenShortcuts,
}: TradingTopBarProps) {
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const { isConnected, isAuthenticated, accountBalance } = useTradingStore();
  const { logout } = useAuth();
  const router = useRouter();

  // Use real-time account balance from websocket store if available, fallback to selectedAccount
  const balance = accountBalance?.currentBalance ?? (selectedAccount ? parseFloat(selectedAccount.currentBalance) : 0);
  const startingBalance = accountBalance?.startingBalance ?? (selectedAccount ? parseFloat(selectedAccount.startingBalance) : 0);
  const pnl = balance - startingBalance;
  const pnlPercent = startingBalance > 0 ? (pnl / startingBalance) * 100 : 0;
  const dailyPnl = accountBalance?.dailyPnl ?? (selectedAccount ? parseFloat(selectedAccount.dailyPnl) || 0 : 0);
  const dailyLossLimit = accountBalance?.dailyLossLimit ?? (selectedAccount ? parseFloat(selectedAccount.dailyLossLimit) || 500 : 500);
  const dailyLossUsedPercent = dailyLossLimit > 0 ? Math.abs(Math.min(dailyPnl, 0)) / dailyLossLimit * 100 : 0;
  const maxDrawdown = accountBalance?.maxDrawdownLimit ?? (selectedAccount ? parseFloat(selectedAccount.maxDrawdownLimit) || 2500 : 2500);
  const drawdownUsedPercent = maxDrawdown > 0 ? Math.abs(Math.min(pnl, 0)) / maxDrawdown * 100 : 0;

  return (
    <div className="h-14 flex items-center justify-between px-4 bg-background-secondary border-b border-border">
      {/* Left: Account Selector + Connection */}
      <div className="flex items-center gap-3">
        {/* Account Selector */}
        <div className="relative">
          <button
            onClick={() => setShowAccountSelector(!showAccountSelector)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200",
              "bg-background hover:bg-background-tertiary border border-border/50",
              "hover:border-primary/30 hover:shadow-sm"
            )}
          >
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center",
              "bg-gradient-to-br from-primary to-primary/60"
            )}>
              <Wallet className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold tracking-tight">
                {selectedAccount?.accountNumber || "Select Account"}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {selectedAccount?.status === "funded" ? "Funded Account" : "Challenge"}
              </p>
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              showAccountSelector && "rotate-180"
            )} />
          </button>

          {/* Dropdown */}
          {showAccountSelector && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowAccountSelector(false)}
              />
              <div className={cn(
                "absolute top-full left-0 mt-2 w-80 z-50",
                "bg-card border border-border rounded-xl shadow-2xl overflow-hidden",
                "animate-in fade-in slide-in-from-top-2 duration-200"
              )}>
                <div className="p-3 border-b border-border bg-background-secondary">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Trading Accounts
                  </p>
                </div>
                <div className="max-h-72 overflow-y-auto scrollbar-thin">
                  {accounts.map((account) => {
                    const accBalance = parseFloat(account.currentBalance);
                    const accPnl = accBalance - parseFloat(account.startingBalance);
                    return (
                      <button
                        key={account.id}
                        onClick={() => {
                          onSelectAccount(account);
                          setShowAccountSelector(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 transition-colors",
                          "hover:bg-background-tertiary",
                          selectedAccount?.id === account.id && "bg-primary/5 border-l-2 border-primary"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          account.status === "funded"
                            ? "bg-profit/10"
                            : "bg-info/10"
                        )}>
                          <Wallet className={cn(
                            "h-5 w-5",
                            account.status === "funded" ? "text-profit" : "text-info"
                          )} />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate">{account.accountNumber}</p>
                            <Badge
                              variant={account.status === "funded" ? "default" : "secondary"}
                              className="text-[10px] px-1.5 py-0 shrink-0"
                            >
                              {account.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm font-mono text-foreground">
                              {formatCurrency(accBalance)}
                            </span>
                            <span className={cn(
                              "text-xs font-mono",
                              accPnl >= 0 ? "text-profit" : "text-loss"
                            )}>
                              {accPnl >= 0 ? "+" : ""}{formatCurrency(accPnl)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Connection Status */}
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold",
          isConnected && isAuthenticated
            ? "bg-profit/10 text-profit border border-profit/20"
            : "bg-loss/10 text-loss border border-loss/20"
        )}>
          {isConnected && isAuthenticated ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-profit opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-profit" />
              </span>
              Live
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              Offline
            </>
          )}
        </div>
      </div>

      {/* Right: Stats + Actions */}
      {selectedAccount && (
        <div className="flex items-center gap-5">
          {/* Balance */}
          <StatBlock
            label="Balance"
            value={formatCurrency(balance)}
          />

          {/* Total P&L */}
          <StatBlock
            label="Total P&L"
            value={formatCurrency(Math.abs(pnl))}
            prefix={pnl >= 0 ? "+" : "-"}
            suffix={`(${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(2)}%)`}
            color={pnl >= 0 ? "profit" : "loss"}
            icon={pnl >= 0 ? TrendingUp : TrendingDown}
          />

          {/* Daily P&L */}
          <StatBlock
            label="Today"
            value={formatCurrency(Math.abs(dailyPnl))}
            prefix={dailyPnl >= 0 ? "+" : "-"}
            color={dailyPnl >= 0 ? "profit" : "loss"}
          />

          {/* Divider */}
          <div className="w-px h-8 bg-border" />

          {/* Risk Meters */}
          <div className="flex items-center gap-4">
            <RiskMeter
              label="Daily Risk"
              value={dailyLossUsedPercent}
              max={100}
            />
            <RiskMeter
              label="Drawdown"
              value={drawdownUsedPercent}
              max={100}
            />
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-border" />

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenShortcuts}
              className={cn(
                "p-2 rounded-lg transition-colors",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-background-tertiary"
              )}
              title="Keyboard Shortcuts (⌘K)"
            >
              <Keyboard className="h-4 w-4" />
            </button>

            {/* Settings Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  "text-muted-foreground hover:text-foreground",
                  "hover:bg-background-tertiary",
                  showSettingsMenu && "bg-background-tertiary text-foreground"
                )}
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </button>

              {showSettingsMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSettingsMenu(false)}
                  />
                  <div className={cn(
                    "absolute top-full right-0 mt-2 w-56 z-50",
                    "bg-card border border-border rounded-xl shadow-2xl overflow-hidden",
                    "animate-in fade-in slide-in-from-top-2 duration-200"
                  )}>
                    <div className="p-2">
                      <button
                        onClick={() => {
                          router.push("/dashboard/settings");
                          setShowSettingsMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-background-tertiary transition-colors"
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Profile Settings</span>
                      </button>
                      <button
                        onClick={() => {
                          router.push("/dashboard/settings#notifications");
                          setShowSettingsMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-background-tertiary transition-colors"
                      >
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Notifications</span>
                      </button>
                      <button
                        onClick={() => {
                          window.open("https://help.propfirm.com", "_blank");
                          setShowSettingsMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-background-tertiary transition-colors"
                      >
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Help Center</span>
                      </button>
                    </div>
                    <div className="border-t border-border p-2">
                      <button
                        onClick={() => {
                          logout();
                          setShowSettingsMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-loss/10 transition-colors text-loss"
                      >
                        <LogOut className="h-4 w-4" />
                        <span className="text-sm font-medium">Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatBlockProps {
  label: string;
  value: string;
  prefix?: string;
  suffix?: string;
  color?: "profit" | "loss" | "default";
  icon?: React.ComponentType<{ className?: string }>;
}

function StatBlock({ label, value, prefix, suffix, color = "default", icon: Icon }: StatBlockProps) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
        {label}
      </p>
      <p className={cn(
        "text-base font-bold font-mono flex items-center justify-end gap-1",
        color === "profit" && "text-profit",
        color === "loss" && "text-loss"
      )}>
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {prefix && <span>{prefix}</span>}
        {value}
        {suffix && <span className="text-xs opacity-70 ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

interface RiskMeterProps {
  label: string;
  value: number;
  max: number;
}

function RiskMeter({ label, value, max }: RiskMeterProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const color = percentage > 80 ? "loss" : percentage > 50 ? "warning" : "profit";

  return (
    <div className="w-28">
      <div className="flex justify-between text-[10px] mb-1">
        <span className="uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <span className={cn(
          "font-bold font-mono",
          color === "loss" && "text-loss",
          color === "warning" && "text-warning",
          color === "profit" && "text-profit"
        )}>
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 bg-background-tertiary rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out rounded-full",
            color === "loss" && "bg-loss",
            color === "warning" && "bg-warning",
            color === "profit" && "bg-profit"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {/* Threshold markers */}
      <div className="relative h-1 mt-0.5">
        <div className="absolute left-1/2 w-px h-1 bg-border" />
        <div className="absolute left-[80%] w-px h-1 bg-border" />
      </div>
    </div>
  );
}

// Compact version for mobile
export function TradingTopBarCompact({
  selectedAccount,
  onOpenAccountSelector,
}: {
  selectedAccount: TradingAccount | null;
  onOpenAccountSelector: () => void;
}) {
  const { isConnected, isAuthenticated } = useTradingStore();
  const balance = selectedAccount ? parseFloat(selectedAccount.currentBalance) : 0;
  const dailyPnl = selectedAccount ? parseFloat(selectedAccount.dailyPnl) : 0;

  return (
    <div className="h-12 flex items-center justify-between px-3 bg-background-secondary border-b border-border">
      <button
        onClick={onOpenAccountSelector}
        className="flex items-center gap-2"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <Wallet className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-xs font-semibold">{selectedAccount?.accountNumber || "Select"}</p>
        </div>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs font-mono font-bold">{formatCurrency(balance)}</p>
          <p className={cn(
            "text-[10px] font-mono",
            dailyPnl >= 0 ? "text-profit" : "text-loss"
          )}>
            {dailyPnl >= 0 ? "+" : ""}{formatCurrency(dailyPnl)}
          </p>
        </div>

        <div className={cn(
          "w-2 h-2 rounded-full",
          isConnected && isAuthenticated ? "bg-profit" : "bg-loss"
        )} />
      </div>
    </div>
  );
}

