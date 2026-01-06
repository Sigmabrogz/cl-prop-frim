"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useTradingStore, useWebSocket } from "@/hooks/use-websocket";
import { useTradingShortcuts, KeyboardShortcutsOverlay } from "@/hooks/use-trading-shortcuts";
import { accountsApi, type TradingAccount } from "@/lib/api";
import { TradingLayout, useIsMobile, MobileTradingLayout } from "@/components/trading/trading-layout";
import { TradingTopBar, TradingTopBarCompact } from "@/components/trading/trading-top-bar";
import { TradingChart } from "@/components/trading/trading-chart";
import { OrderForm, QuickTradeButtons } from "@/components/trading/order-form";
import { TradingBottomPanel } from "@/components/trading/trading-bottom-panel";
import { PriceTicker, PriceDisplay } from "@/components/trading/price-ticker";
import { OrderBook } from "@/components/trading/order-book";
import { OneClickTrading } from "@/components/trading/one-click-trading";
import { PanelCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Wallet,
  Activity,
  Maximize2,
  Settings,
  Zap,
  Search,
} from "lucide-react";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT"];

function TradingContent() {
  const searchParams = useSearchParams();
  const accountIdParam = searchParams.get("account");

  const { user } = useAuth();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [isLoading, setIsLoading] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [orderSide, setOrderSide] = useState<"LONG" | "SHORT">("LONG");
  const [prefillPrice, setPrefillPrice] = useState<number | undefined>();
  const [prefillQuantity, setPrefillQuantity] = useState<number | undefined>();
  const [searchQuery, setSearchQuery] = useState("");

  const isMobile = useIsMobile();

  const { isConnected, isAuthenticated, setSelectedAccountId } = useTradingStore();
  const { subscribe, unsubscribe, getPositions } = useWebSocket();

  // Keyboard shortcuts
  useTradingShortcuts({
    onBuy: () => setOrderSide("LONG"),
    onSell: () => setOrderSide("SHORT"),
    onToggleOrderType: () => {}, // Could toggle market/limit
    onOpenCommandPalette: () => setShowShortcuts(true),
    onEscape: () => setShowShortcuts(false),
  });

  // Load accounts
  useEffect(() => {
    async function loadAccounts() {
      try {
        const response = await accountsApi.list();
        if (response.success && response.data?.accounts) {
          const activeAccounts = response.data.accounts.filter(
            (acc) => acc.status === "active" || acc.status === "funded"
          );
          setAccounts(activeAccounts);

          const targetAccount = accountIdParam
            ? activeAccounts.find((a) => a.id === accountIdParam)
            : activeAccounts[0];

          if (targetAccount) {
            setSelectedAccount(targetAccount);
            setSelectedAccountId(targetAccount.id);
          }
        }
      } catch (error) {
        console.error("Failed to load accounts:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAccounts();
  }, [accountIdParam, setSelectedAccountId]);

  // Subscribe to price feeds
  useEffect(() => {
    if (isAuthenticated) {
      subscribe(SYMBOLS);
      return () => unsubscribe(SYMBOLS);
    }
  }, [isAuthenticated, subscribe, unsubscribe]);

  // Load positions for selected account
  useEffect(() => {
    if (isAuthenticated && selectedAccount) {
      getPositions(selectedAccount.id);
    }
  }, [isAuthenticated, selectedAccount, getPositions]);

  // Handle order book price click
  const handlePriceClick = useCallback((price: number) => {
    setPrefillPrice(price);
  }, []);

  // Handle order book size click
  const handleSizeClick = useCallback((size: number) => {
    setPrefillQuantity(size);
  }, []);

  // Handle account selection
  const handleSelectAccount = useCallback((account: TradingAccount) => {
    setSelectedAccount(account);
    setSelectedAccountId(account.id);
  }, [setSelectedAccountId]);

  // Filter symbols by search
  const filteredSymbols = SYMBOLS.filter((s) =>
    s.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Activity className="absolute inset-0 m-auto h-6 w-6 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading trading terminal...</p>
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Wallet className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-3">No Active Accounts</h2>
          <p className="text-muted-foreground mb-6">
            You need an active trading account to access the trading terminal. Start a challenge to get funded.
          </p>
          <a href="/dashboard/accounts/new">
            <Button variant="glow" size="lg">
              Start a Challenge
            </Button>
          </a>
        </div>
      </div>
    );
  }

  const balance = selectedAccount ? parseFloat(selectedAccount.currentBalance) : 0;

  // ===== PANEL COMPONENTS =====

  // Top Bar
  const topBar = (
    <TradingTopBar
      accounts={accounts}
      selectedAccount={selectedAccount}
      onSelectAccount={handleSelectAccount}
      onOpenShortcuts={() => setShowShortcuts(true)}
    />
  );

  // Watchlist Panel
  const watchlist = (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full h-8 pl-8 pr-3 rounded-lg text-sm",
              "bg-background border border-border/50",
              "placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-1 focus:ring-primary/50"
            )}
          />
        </div>
      </div>

      {/* Symbol List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-1.5 space-y-0.5">
        {filteredSymbols.map((symbol) => (
          <PriceTicker
            key={symbol}
            symbol={symbol}
            isSelected={selectedSymbol === symbol}
            onClick={() => setSelectedSymbol(symbol)}
          />
        ))}
      </div>

      {/* Quick Trade Section */}
      <div className="p-2 border-t border-border bg-background-secondary/50">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Trade</span>
        </div>
        {selectedAccount && (
          <QuickTradeButtons
            symbol={selectedSymbol}
            accountId={selectedAccount.id}
            availableBalance={balance}
          />
        )}
      </div>
    </div>
  );

  // Chart Panel
  const chart = (
    <div className="h-full flex flex-col">
      {/* Chart Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background-secondary/30">
        <PriceDisplay symbol={selectedSymbol} />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs">
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs">
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {/* Chart */}
      <div className="flex-1 min-h-0">
        <TradingChart symbol={selectedSymbol} className="h-full" />
      </div>
    </div>
  );

  // Order Book Panel
  const orderBook = (
    <OrderBook
      symbol={selectedSymbol}
      levels={10}
      onPriceClick={handlePriceClick}
      onSizeClick={handleSizeClick}
    />
  );

  // Order Form Panel
  const orderForm = selectedAccount ? (
    <OrderForm
      symbol={selectedSymbol}
      accountId={selectedAccount.id}
      maxLeverage={selectedAccount.maxLeverage}
      availableBalance={balance}
      prefillPrice={prefillPrice}
      prefillQuantity={prefillQuantity}
      onSideChange={setOrderSide}
    />
  ) : (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <Wallet className="h-8 w-8 mb-2 opacity-50" />
      <p className="text-sm">Select an account to trade</p>
    </div>
  );

  // Positions Panel - Using resizable TradingBottomPanel
  const positions = selectedAccount ? (
    <TradingBottomPanel accountId={selectedAccount.id} />
  ) : (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
      <Wallet className="h-8 w-8 mb-2 opacity-50" />
      <p className="text-sm">Select an account to trade</p>
    </div>
  );

  // ===== RENDER =====

  return (
    <>
      {isMobile ? (
        <MobileTradingLayout
          topBar={<TradingTopBarCompact selectedAccount={selectedAccount} onOpenAccountSelector={() => {}} />}
          watchlist={watchlist}
          chart={chart}
          orderBook={orderBook}
          orderForm={orderForm}
          positions={positions}
        />
      ) : (
        <TradingLayout
          topBar={topBar}
          watchlist={watchlist}
          chart={chart}
          orderBook={orderBook}
          orderForm={orderForm}
          positions={positions}
        />
      )}

      {/* Keyboard Shortcuts Overlay */}
      <KeyboardShortcutsOverlay
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </>
  );
}

export default function TradingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <Activity className="absolute inset-0 m-auto h-6 w-6 text-primary" />
            </div>
            <p className="text-muted-foreground">Loading trading terminal...</p>
          </div>
        </div>
      }
    >
      <TradingContent />
    </Suspense>
  );
}
