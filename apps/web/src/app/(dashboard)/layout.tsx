"use client";

import { useState, useEffect, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  LayoutDashboard,
  Wallet,
  LineChart,
  History,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bell,
  User,
  DollarSign,
  Activity,
  Trophy,
  CreditCard,
  Shield,
  Sparkles,
  ExternalLink,
} from "lucide-react";

// Sidebar context for global state
interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used within SidebarProvider");
  return context;
}

// Navigation items
const navigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Accounts", href: "/dashboard/accounts", icon: Wallet, badge: "3" },
  { name: "Trading", href: "/dashboard/trading", icon: LineChart },
  { name: "Payouts", href: "/dashboard/payouts", icon: DollarSign },
  { name: "History", href: "/dashboard/history", icon: History },
  { name: "Leaderboard", href: "/dashboard/leaderboard", icon: Trophy },
];

const secondaryNavigation = [
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
  { name: "Help & Support", href: "/dashboard/help", icon: HelpCircle },
];

// Account balance component
function AccountBalance({ isCollapsed }: { isCollapsed: boolean }) {
  const [accountData, setAccountData] = useState<{
    balance: number;
    startingBalance: number;
  } | null>(null);

  useEffect(() => {
    // Fetch user's accounts to get real balance
    const fetchAccounts = async () => {
      try {
        const response = await fetch('/api/accounts', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.accounts && data.accounts.length > 0) {
            // Sum up all account balances or use the first active one
            const activeAccount = data.accounts.find((a: { status: string }) => 
              a.status === 'funded' || a.status === 'evaluation'
            ) || data.accounts[0];
            setAccountData({
              balance: parseFloat(activeAccount.currentBalance) || 0,
              startingBalance: parseFloat(activeAccount.startingBalance) || 0,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      }
    };
    fetchAccounts();
  }, []);

  const balance = accountData?.balance ?? 0;
  const startingBalance = accountData?.startingBalance ?? 0;
  const pnl = balance - startingBalance;
  const pnlPercent = startingBalance > 0 ? ((pnl / startingBalance) * 100).toFixed(2) : "0.00";
  const isPositive = pnl >= 0;

  if (isCollapsed) {
    return (
      <div className="p-2">
        <div className={cn(
          "p-2 rounded-xl flex items-center justify-center",
          isPositive ? "bg-profit/10" : "bg-loss/10"
        )}>
          <span className={cn(
            "font-mono text-sm font-bold",
            isPositive ? "text-profit" : "text-loss"
          )}>
            {isPositive ? "+" : ""}{pnlPercent}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="p-4 rounded-xl bg-gradient-to-br from-background-tertiary to-background-secondary border border-border/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Balance
          </span>
          <Badge variant="live" size="xs">
            Live
          </Badge>
        </div>
        <p className="text-2xl font-bold font-mono mb-1">
          ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-semibold",
            isPositive ? "text-profit" : "text-loss"
          )}>
            {isPositive ? "+" : ""}${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded",
            isPositive ? "text-profit bg-profit/10" : "text-loss bg-loss/10"
          )}>
            {isPositive ? "+" : ""}{pnlPercent}%
          </span>
        </div>
      </div>
    </div>
  );
}

// Navigation item component
function NavItem({
  item,
  isActive,
  isCollapsed,
  onClick,
}: {
  item: (typeof navigation)[0];
  isActive: boolean;
  isCollapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200",
        isCollapsed ? "justify-center p-3" : "px-3 py-2.5",
        isActive
          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
          : "text-muted-foreground hover:text-foreground hover:bg-background-tertiary"
      )}
    >
      <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary-foreground")} />

      {!isCollapsed && (
        <>
          <span className="flex-1">{item.name}</span>
          {"badge" in item && item.badge && (
            <Badge variant={isActive ? "secondary" : "default"} size="xs">
              {item.badge}
            </Badge>
          )}
        </>
      )}

      {/* Tooltip for collapsed state */}
      {isCollapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-popover text-popover-foreground text-xs font-medium opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg border border-border">
          {item.name}
          {"badge" in item && item.badge && (
            <Badge variant="primary" size="xs" className="ml-2">
              {item.badge}
            </Badge>
          )}
        </div>
      )}
    </Link>
  );
}

// Sidebar component
function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen } = useSidebar();

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full bg-card border-r border-border transition-all duration-300 flex flex-col",
          isCollapsed ? "w-[72px]" : "w-64",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25 shrink-0">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            {!isCollapsed && (
              <span className="text-lg font-bold tracking-tight">PropFirm</span>
            )}
          </Link>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-2 hover:bg-background-tertiary rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Account Balance */}
        <AccountBalance isCollapsed={isCollapsed} />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto scrollbar-thin">
          {navigation.map((item) => (
            <NavItem
              key={item.name}
              item={item}
              isActive={pathname === item.href}
              isCollapsed={isCollapsed}
              onClick={() => setIsMobileOpen(false)}
            />
          ))}

          <div className="pt-4 mt-4 border-t border-border space-y-1">
            {secondaryNavigation.map((item) => (
              <NavItem
                key={item.name}
                item={item}
                isActive={pathname === item.href}
                isCollapsed={isCollapsed}
                onClick={() => setIsMobileOpen(false)}
              />
            ))}
          </div>
        </nav>

        {/* Upgrade CTA (when not collapsed) */}
        {!isCollapsed && (
          <div className="p-3 border-t border-border">
            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Upgrade Account</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Scale to $200K and unlock 90% profit split
              </p>
              <Button variant="primary" size="sm" fullWidth>
                View Plans
              </Button>
            </div>
          </div>
        )}

        {/* User section */}
        <div className={cn("border-t border-border", isCollapsed ? "p-2" : "p-3")}>
          {isCollapsed ? (
            <button
              onClick={logout}
              className="w-full p-3 rounded-xl hover:bg-background-tertiary transition-colors flex items-center justify-center group relative"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-info flex items-center justify-center">
                <User className="h-5 w-5 text-white" />
              </div>
              <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-popover text-popover-foreground text-xs font-medium opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg border border-border">
                Sign out
              </div>
            </button>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3 p-2 rounded-lg hover:bg-background-tertiary transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-info flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {user?.username || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email || ""}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                className="justify-start text-muted-foreground hover:text-loss"
                onClick={logout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </>
          )}
        </div>

        {/* Collapse button (desktop only) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border items-center justify-center hover:bg-background-tertiary transition-colors shadow-sm"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </aside>
    </>
  );
}

// Header component
function Header() {
  const { user } = useAuth();
  const { setIsMobileOpen, isCollapsed } = useSidebar();
  const [hasNotifications] = useState(true);

  return (
    <header className="sticky top-0 z-30 h-14 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left section */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileOpen(true)}
            className="lg:hidden p-2 hover:bg-background-tertiary rounded-lg"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Search */}
          <div className="hidden md:block w-64">
            <SearchInput placeholder="Search accounts, trades..." inputSize="sm" />
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Market status */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-profit/10 border border-profit/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-profit opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-profit" />
            </span>
            <span className="text-xs font-medium text-profit">Markets Open</span>
          </div>

          {/* Quick actions */}
          <Button variant="ghost" size="icon-sm" className="hidden sm:flex">
            <Activity className="h-4 w-4" />
          </Button>

          {/* Notifications */}
          <button className="relative p-2 hover:bg-background-tertiary rounded-lg transition-colors">
            <Bell className="h-5 w-5 text-muted-foreground" />
            {hasNotifications && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-loss rounded-full ring-2 ring-background" />
            )}
          </button>

          {/* User menu */}
          <button className="flex items-center gap-2 p-1.5 hover:bg-background-tertiary rounded-lg transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-info flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium leading-none">
                {user?.username || "User"}
              </p>
              <p className="text-xs text-muted-foreground">Funded</p>
            </div>
            <ChevronDown className="hidden md:block h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
}

// Main layout content
function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Save collapsed state to localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) setIsCollapsed(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  return (
    <SidebarContext.Provider
      value={{ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }}
    >
      <div className="min-h-screen bg-background">
        <Sidebar />

        <div
          className={cn(
            "transition-all duration-300",
            isCollapsed ? "lg:pl-[72px]" : "lg:pl-64"
          )}
        >
          <Header />
          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </AuthProvider>
  );
}
