"use client";

import { useState, useMemo } from "react";
import { useTradingStore } from "@/hooks/use-websocket";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { cn } from "@/lib/utils";
import {
  Layers,
  Clock,
  History,
  FileText,
  ChevronUp,
  ChevronDown,
  GripHorizontal,
} from "lucide-react";
import { PositionsPanel } from "./positions-panel";
import { PendingOrdersPanel } from "./pending-orders-panel";
import { HistoryPanel } from "./history-panel";
import { OrderHistoryPanel } from "./order-history-panel";

interface TradingBottomPanelProps {
  accountId: string;
}

type TabType = "positions" | "pending" | "trades" | "events";

interface Tab {
  id: TabType;
  label: string;
  icon: typeof Layers;
  badge?: number;
}

export function TradingBottomPanel({ accountId }: TradingBottomPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("positions");

  // Get counts for badges
  const positions = useTradingStore((state) =>
    state.positions.filter((p) => p.accountId === accountId)
  );
  const pendingOrders = useTradingStore((state) =>
    state.pendingOrders.filter((o) => o.accountId === accountId)
  );

  // Resizable panel
  const {
    height,
    isDragging,
    isCollapsed,
    handleMouseDown,
    toggleCollapse,
  } = useResizablePanel({
    minHeight: 150,
    maxHeight: 500,
    defaultHeight: 250,
    storageKey: "trading-bottom-panel-height",
  });

  const tabs: Tab[] = useMemo(
    () => [
      {
        id: "positions",
        label: "Positions",
        icon: Layers,
        badge: positions.length > 0 ? positions.length : undefined,
      },
      {
        id: "pending",
        label: "Pending Orders",
        icon: Clock,
        badge: pendingOrders.length > 0 ? pendingOrders.length : undefined,
      },
      {
        id: "trades",
        label: "Trade History",
        icon: History,
      },
      {
        id: "events",
        label: "Order History",
        icon: FileText,
      },
    ],
    [positions.length, pendingOrders.length]
  );

  return (
    <div
      className={cn(
        "flex flex-col bg-background transition-all",
        isDragging && "select-none"
      )}
      style={{ height }}
    >
      {/* Drag handle - More prominent */}
      <div
        className={cn(
          "h-2 cursor-ns-resize flex items-center justify-center group relative",
          "bg-border/30 hover:bg-primary/20 transition-colors",
          isDragging && "bg-primary/30"
        )}
        onMouseDown={handleMouseDown}
        title="Drag to resize"
      >
        {/* Visual grip indicator */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-[2px] transition-colors",
            "bg-border group-hover:bg-primary/50",
            isDragging && "bg-primary"
          )}
        />
        <div
          className={cn(
            "w-16 h-1 rounded-full transition-colors",
            "bg-muted-foreground/30 group-hover:bg-primary/60",
            isDragging && "bg-primary"
          )}
        />
        {/* Grip dots */}
        <div className="absolute flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripHorizontal className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-border/50 bg-background-secondary/30">
        <div className="flex items-center">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors relative",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={cn(
                      "ml-1 px-1.5 py-0.5 text-xs rounded-full font-mono",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          className="p-2 mr-2 text-muted-foreground hover:text-foreground transition-colors"
          title={isCollapsed ? "Expand panel" : "Collapse panel"}
        >
          {isCollapsed ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-hidden">
          {activeTab === "positions" && (
            <div className="h-full overflow-auto p-3">
              <PositionsPanel accountId={accountId} />
            </div>
          )}
          {activeTab === "pending" && (
            <div className="h-full overflow-auto p-3">
              <PendingOrdersPanel accountId={accountId} />
            </div>
          )}
          {activeTab === "trades" && (
            <div className="h-full overflow-auto p-3">
              <HistoryPanel accountId={accountId} type="trades" />
            </div>
          )}
          {activeTab === "events" && (
            <div className="h-full">
              <OrderHistoryPanel accountId={accountId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
