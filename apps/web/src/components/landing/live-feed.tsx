"use client";

import { useEffect, useState, useRef } from "react";

interface FeedItem {
  id: string;
  initials: string;
  action: string;
  amount?: string;
  time: string;
}

const generateFeedItems = (): FeedItem[] => {
  const actions = [
    { action: "Funded", amounts: ["$10K", "$25K", "$50K", "$100K"] },
    { action: "Payout", amounts: ["$1,200", "$2,800", "$4,500", "$8,200", "$12,000"] },
    { action: "Passed Phase 1", amounts: [] },
    { action: "Passed Phase 2", amounts: [] },
  ];

  const initials = ["JM", "AR", "KS", "DL", "MP", "TC", "RB", "NW", "AS", "CK", "BH", "EF", "GR", "HT", "IY"];
  const times = ["Just now", "1 min ago", "2 min ago", "5 min ago", "8 min ago", "12 min ago", "15 min ago"];

  return Array.from({ length: 15 }, (_, i) => {
    const actionType = actions[Math.floor(Math.random() * actions.length)];
    return {
      id: `feed-${i}`,
      initials: initials[i % initials.length],
      action: actionType.action,
      amount: actionType.amounts.length > 0
        ? actionType.amounts[Math.floor(Math.random() * actionType.amounts.length)]
        : undefined,
      time: times[i % times.length],
    };
  });
};

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <div className="feed-card hover-lift">
      <div className="avatar-circle">
        {item.initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {item.action}
          {item.amount && (
            <span className="text-profit ml-1">{item.amount}</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {item.time}
        </div>
      </div>
    </div>
  );
}

function Facepile() {
  const avatars = ["JM", "AR", "KS", "DL", "MP", "TC", "RB", "NW"];

  return (
    <div className="flex items-center gap-4">
      <div className="facepile">
        {avatars.slice(0, 6).map((initials, i) => (
          <div
            key={i}
            className="avatar-circle text-xs"
            style={{ width: 32, height: 32 }}
          >
            {initials}
          </div>
        ))}
        <div
          className="avatar-circle text-xs bg-muted-foreground"
          style={{ width: 32, height: 32 }}
        >
          +12K
        </div>
      </div>
      <span className="text-sm text-muted-foreground">
        Join 12,543+ traders worldwide
      </span>
    </div>
  );
}

export function LiveFeed() {
  const [items] = useState<FeedItem[]>(generateFeedItems);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Duplicate items for seamless loop
  const duplicatedItems = [...items, ...items];

  return (
    <section className="py-12 border-b border-border bg-background-secondary/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full bg-profit opacity-75" />
                <span className="relative inline-flex h-2 w-2 bg-profit" />
              </span>
              <span className="text-sm font-medium uppercase tracking-wider">
                Live Activity
              </span>
            </div>
          </div>
          <Facepile />
        </div>

        {/* Auto-scrolling Feed */}
        <div
          className="overflow-hidden card-peek"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div
            ref={scrollRef}
            className={`flex gap-4 ${isPaused ? '' : 'auto-scroll'}`}
            style={{ width: 'max-content' }}
          >
            {duplicatedItems.map((item, i) => (
              <FeedCard key={`${item.id}-${i}`} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
