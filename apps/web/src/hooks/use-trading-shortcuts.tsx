"use client";

import { useEffect, useCallback, useState } from "react";

interface ShortcutHandlers {
  onBuy?: () => void;
  onSell?: () => void;
  onToggleOrderType?: () => void;
  onSubmitOrder?: () => void;
  onCancelOrder?: () => void;
  onClosePosition?: () => void;
  onCloseAllPositions?: () => void;
  onToggleWatchlist?: () => void;
  onToggleOrderBook?: () => void;
  onFullscreenChart?: () => void;
  onOpenCommandPalette?: () => void;
  onEscape?: () => void;
}

export function useTradingShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger if typing in input, textarea, or contenteditable
    const target = e.target as HTMLElement;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.isContentEditable
    ) {
      // Only allow Escape in inputs
      if (e.key === "Escape") {
        handlers.onEscape?.();
        (target as HTMLInputElement).blur?.();
      }
      return;
    }

    // Cmd/Ctrl + K = Command Palette
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      handlers.onOpenCommandPalette?.();
      return;
    }

    // Cmd/Ctrl + Shift + A = Close all positions
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a") {
      e.preventDefault();
      handlers.onCloseAllPositions?.();
      return;
    }

    // Handle single key shortcuts
    switch (e.key.toLowerCase()) {
      case "b":
        e.preventDefault();
        handlers.onBuy?.();
        break;
      case "s":
        e.preventDefault();
        handlers.onSell?.();
        break;
      case "m":
        e.preventDefault();
        handlers.onToggleOrderType?.();
        break;
      case "enter":
        e.preventDefault();
        handlers.onSubmitOrder?.();
        break;
      case "escape":
        e.preventDefault();
        handlers.onEscape?.();
        handlers.onCancelOrder?.();
        break;
      case "c":
        e.preventDefault();
        handlers.onClosePosition?.();
        break;
      case "w":
        e.preventDefault();
        handlers.onToggleWatchlist?.();
        break;
      case "o":
        e.preventDefault();
        handlers.onToggleOrderBook?.();
        break;
      case "f":
        e.preventDefault();
        handlers.onFullscreenChart?.();
        break;
    }
  }, [handlers]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

// Keyboard shortcuts overlay component
interface ShortcutsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsOverlay({ isOpen, onClose }: ShortcutsOverlayProps) {
  // Close on escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border bg-background-secondary">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-lg">⌨️</span>
            </div>
            <div>
              <h2 className="text-lg font-bold">Keyboard Shortcuts</h2>
              <p className="text-sm text-muted-foreground">Speed up your trading</p>
            </div>
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="p-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
          <ShortcutSection title="Trading">
            <ShortcutItem shortcut="B" description="Buy / Long" />
            <ShortcutItem shortcut="S" description="Sell / Short" />
            <ShortcutItem shortcut="M" description="Toggle Market/Limit" />
            <ShortcutItem shortcut="Enter" description="Submit Order" />
            <ShortcutItem shortcut="Esc" description="Cancel / Clear" />
          </ShortcutSection>

          <ShortcutSection title="Positions">
            <ShortcutItem shortcut="C" description="Close Selected Position" />
            <ShortcutItem shortcut="⌘ ⇧ A" description="Close All Positions" />
          </ShortcutSection>

          <ShortcutSection title="Layout">
            <ShortcutItem shortcut="W" description="Toggle Watchlist" />
            <ShortcutItem shortcut="O" description="Toggle Order Book" />
            <ShortcutItem shortcut="F" description="Fullscreen Chart" />
          </ShortcutSection>

          <ShortcutSection title="Navigation">
            <ShortcutItem shortcut="⌘ K" description="Open Command Palette" />
          </ShortcutSection>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-background-secondary">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-xs">Esc</kbd> to close</span>
            <span className="text-xs">Shortcuts work when not typing</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h3>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

function ShortcutItem({ shortcut, description }: { shortcut: string; description: string }) {
  const keys = shortcut.split(" ");

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-background-tertiary transition-colors">
      <span className="text-sm">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <kbd
            key={i}
            className="min-w-[24px] h-6 px-2 flex items-center justify-center rounded bg-background border border-border font-mono text-xs font-medium"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}

// Command palette component (simplified version using cmdk)
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, open, close, toggle };
}

