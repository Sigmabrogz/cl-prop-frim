"use client";

import { ReactNode, useState, useEffect } from "react";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";
import { GripVertical, GripHorizontal, ChevronLeft, ChevronRight, BarChart3, ClipboardList, Briefcase, Eye } from "lucide-react";
import { useSidebar } from "@/contexts/sidebar-context";

interface TradingLayoutProps {
  watchlist: ReactNode;
  chart: ReactNode;
  orderBook: ReactNode;
  orderForm: ReactNode;
  positions: ReactNode;
  topBar: ReactNode;
}

// Persist layout to localStorage
const LAYOUT_STORAGE_KEY = "trading-layout-v1";

interface LayoutState {
  watchlistCollapsed: boolean;
  orderBookCollapsed: boolean;
  watchlistSize: number;
  rightPanelSize: number;
  bottomPanelSize: number;
}

const defaultLayout: LayoutState = {
  watchlistCollapsed: false,
  orderBookCollapsed: false,
  watchlistSize: 15,
  rightPanelSize: 25,
  bottomPanelSize: 25,
};

function loadLayout(): LayoutState {
  if (typeof window === "undefined") return defaultLayout;
  try {
    const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (saved) return { ...defaultLayout, ...JSON.parse(saved) };
  } catch {}
  return defaultLayout;
}

function saveLayout(layout: Partial<LayoutState>) {
  if (typeof window === "undefined") return;
  try {
    const current = loadLayout();
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({ ...current, ...layout }));
  } catch {}
}

export function TradingLayout({
  watchlist,
  chart,
  orderBook,
  orderForm,
  positions,
  topBar,
}: TradingLayoutProps) {
  const [layout, setLayout] = useState<LayoutState>(defaultLayout);
  const [isClient, setIsClient] = useState(false);
  const { isCollapsed: sidebarCollapsed } = useSidebar();

  // Load layout on mount
  useEffect(() => {
    setIsClient(true);
    setLayout(loadLayout());
  }, []);

  const updateLayout = (updates: Partial<LayoutState>) => {
    setLayout((prev) => {
      const next = { ...prev, ...updates };
      saveLayout(next);
      return next;
    });
  };

  // Don't render panels until client-side to avoid hydration mismatch
  if (!isClient) {
    return (
      <div className={cn(
        "fixed inset-0 top-14 flex flex-col bg-background z-30 transition-all duration-300",
        sidebarCollapsed ? "lg:left-[72px]" : "lg:left-64"
      )}>
        <div className="h-14 shrink-0 bg-background-secondary border-b border-border" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading layout...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "fixed inset-0 top-14 flex flex-col bg-background overflow-hidden z-30 transition-all duration-300",
      sidebarCollapsed ? "lg:left-[72px]" : "lg:left-64"
    )}>
      {/* Top Bar - Sticky */}
      <div className="shrink-0 z-40">
        {topBar}
      </div>

      {/* Main Trading Area - Using flex instead of PanelGroup */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Top Section: Chart + OrderBook/Form */}
        <div className="flex-1 flex min-h-0">
          {/* Left: Watchlist Toggle + Chart */}
          <div className="flex-1 flex min-w-0">
            {/* Watchlist Panel - Responsive width */}
            {!layout.watchlistCollapsed && (
              <div className="w-44 lg:w-52 xl:w-56 shrink-0 bg-card border-r border-border overflow-hidden flex flex-col">
                {watchlist}
              </div>
            )}
            
            {/* Collapse Toggle */}
            <button
              onClick={() => updateLayout({ watchlistCollapsed: !layout.watchlistCollapsed })}
              className={cn(
                "h-full w-4 shrink-0 flex items-center justify-center",
                "bg-background-secondary/50 hover:bg-background-tertiary",
                "border-r border-border/50 transition-colors group"
              )}
              title={layout.watchlistCollapsed ? "Show Watchlist (W)" : "Hide Watchlist (W)"}
            >
              {layout.watchlistCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              )}
            </button>
            
            {/* Chart */}
            <div className="flex-1 min-w-0 bg-card overflow-hidden">
              {chart}
            </div>
          </div>

          {/* Right Panel: Order Book + Order Form - Responsive width */}
          <div className="w-72 lg:w-80 xl:w-96 shrink-0 bg-card border-l border-border flex flex-col">
            {/* Order Book */}
            <div className="flex-1 min-h-0 border-b border-border overflow-auto">
              {orderBook}
            </div>
            {/* Order Form */}
            <div className="h-[380px] lg:h-[420px] shrink-0 overflow-auto scrollbar-thin">
              {orderForm}
            </div>
          </div>
        </div>

        {/* Bottom Panel: Positions - Resizable */}
        <div className="shrink-0 bg-card border-t border-border overflow-hidden">
          {positions}
        </div>
      </div>
    </div>
  );
}

function ResizeHandle({ direction }: { direction: "horizontal" | "vertical" }) {
  return (
    <PanelResizeHandle
      className={cn(
        "group relative flex items-center justify-center transition-colors",
        direction === "vertical"
          ? "w-1 cursor-col-resize hover:w-1.5"
          : "h-1 cursor-row-resize hover:h-1.5",
        "bg-border/30 hover:bg-primary/50 active:bg-primary"
      )}
    >
      {/* Grip indicator on hover */}
      <div
        className={cn(
          "absolute opacity-0 group-hover:opacity-100 transition-opacity z-10",
          "bg-background-secondary rounded border border-border shadow-lg p-0.5",
          direction === "vertical"
            ? "left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2"
            : "top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2"
        )}
      >
        {direction === "vertical" ? (
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        ) : (
          <GripHorizontal className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
    </PanelResizeHandle>
  );
}

// Mobile Layout Component
export function MobileTradingLayout({
  watchlist,
  chart,
  orderBook,
  orderForm,
  positions,
  topBar,
}: TradingLayoutProps) {
  const [activeTab, setActiveTab] = useState<"chart" | "order" | "positions" | "watchlist">("chart");

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Compact Top Bar */}
      <div className="shrink-0">
        {topBar}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "chart" && (
          <div className="h-full flex flex-col">
            <div className="flex-1">{chart}</div>
            {/* Quick trade buttons */}
            <div className="p-3 border-t border-border bg-card">
              {orderForm}
            </div>
          </div>
        )}
        {activeTab === "order" && (
          <div className="h-full overflow-auto p-4">
            {orderBook}
            <div className="mt-4">{orderForm}</div>
          </div>
        )}
        {activeTab === "positions" && (
          <div className="h-full overflow-auto">
            {positions}
          </div>
        )}
        {activeTab === "watchlist" && (
          <div className="h-full overflow-auto">
            {watchlist}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="shrink-0 flex border-t border-border bg-card safe-area-bottom">
        {[
          { id: "chart", label: "Chart", Icon: BarChart3 },
          { id: "order", label: "Order", Icon: ClipboardList },
          { id: "positions", label: "Positions", Icon: Briefcase },
          { id: "watchlist", label: "Watch", Icon: Eye },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <tab.Icon className="w-5 h-5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Hook to detect mobile
export function useIsMobile(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);

  return isMobile;
}

