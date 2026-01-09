"use client";

import { useEffect, useState, useRef } from "react";

interface FeedItem {
  id: string;
  initials: string;
  action: string;
  amount?: string;
  time: string;
}

// Static seed-based items to avoid hydration mismatch
const staticFeedItems: FeedItem[] = [
  { id: "feed-0", initials: "JM", action: "Funded", amount: "$50K", time: "Just now" },
  { id: "feed-1", initials: "AR", action: "Payout", amount: "$2,800", time: "1 min ago" },
  { id: "feed-2", initials: "KS", action: "Passed Phase 1", time: "2 min ago" },
  { id: "feed-3", initials: "DL", action: "Funded", amount: "$100K", time: "5 min ago" },
  { id: "feed-4", initials: "MP", action: "Payout", amount: "$8,200", time: "8 min ago" },
  { id: "feed-5", initials: "TC", action: "Passed Phase 2", time: "12 min ago" },
  { id: "feed-6", initials: "RB", action: "Funded", amount: "$25K", time: "15 min ago" },
  { id: "feed-7", initials: "NW", action: "Payout", amount: "$4,500", time: "Just now" },
  { id: "feed-8", initials: "AS", action: "Passed Phase 1", time: "1 min ago" },
  { id: "feed-9", initials: "CK", action: "Funded", amount: "$10K", time: "2 min ago" },
  { id: "feed-10", initials: "BH", action: "Payout", amount: "$12,000", time: "5 min ago" },
  { id: "feed-11", initials: "EF", action: "Passed Phase 2", time: "8 min ago" },
  { id: "feed-12", initials: "GR", action: "Funded", amount: "$50K", time: "12 min ago" },
  { id: "feed-13", initials: "HT", action: "Payout", amount: "$1,200", time: "15 min ago" },
  { id: "feed-14", initials: "IY", action: "Passed Phase 1", time: "Just now" },
];

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
  const [items] = useState<FeedItem[]>(staticFeedItems);
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
