"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface UseResizablePanelOptions {
  minHeight: number;
  maxHeight: number;
  defaultHeight: number;
  storageKey?: string;
}

interface UseResizablePanelReturn {
  height: number;
  isDragging: boolean;
  isCollapsed: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  toggleCollapse: () => void;
  setHeight: (height: number) => void;
}

export function useResizablePanel({
  minHeight,
  maxHeight,
  defaultHeight,
  storageKey,
}: UseResizablePanelOptions): UseResizablePanelReturn {
  const [height, setHeightState] = useState(defaultHeight);
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const preCollapseHeightRef = useRef(defaultHeight);

  // Load saved height from localStorage
  useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const { height: savedHeight, collapsed } = JSON.parse(saved);
          if (typeof savedHeight === "number" && savedHeight >= minHeight && savedHeight <= maxHeight) {
            setHeightState(savedHeight);
            preCollapseHeightRef.current = savedHeight;
          }
          if (typeof collapsed === "boolean") {
            setIsCollapsed(collapsed);
          }
        } catch {
          // Invalid saved data, use default
        }
      }
    }
  }, [storageKey, minHeight, maxHeight]);

  // Save height to localStorage
  useEffect(() => {
    if (storageKey && typeof window !== "undefined" && !isDragging) {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          height: isCollapsed ? preCollapseHeightRef.current : height,
          collapsed: isCollapsed,
        })
      );
    }
  }, [height, isCollapsed, isDragging, storageKey]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isCollapsed) return;

      e.preventDefault();
      setIsDragging(true);
      startYRef.current = e.clientY;
      startHeightRef.current = height;

      // Add cursor style to body during drag
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
    },
    [height, isCollapsed]
  );

  // Handle mouse move during drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Dragging up increases height (negative delta)
      const delta = startYRef.current - e.clientY;
      const newHeight = Math.min(maxHeight, Math.max(minHeight, startHeightRef.current + delta));
      setHeightState(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, minHeight, maxHeight]);

  const toggleCollapse = useCallback(() => {
    if (isCollapsed) {
      // Expand to previous height
      setHeightState(preCollapseHeightRef.current);
      setIsCollapsed(false);
    } else {
      // Save current height and collapse
      preCollapseHeightRef.current = height;
      setIsCollapsed(true);
    }
  }, [isCollapsed, height]);

  const setHeight = useCallback(
    (newHeight: number) => {
      const clampedHeight = Math.min(maxHeight, Math.max(minHeight, newHeight));
      setHeightState(clampedHeight);
      if (!isCollapsed) {
        preCollapseHeightRef.current = clampedHeight;
      }
    },
    [minHeight, maxHeight, isCollapsed]
  );

  return {
    height: isCollapsed ? 40 : height, // 40px when collapsed (just header)
    isDragging,
    isCollapsed,
    handleMouseDown,
    toggleCollapse,
    setHeight,
  };
}
