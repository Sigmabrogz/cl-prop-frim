"use client";

import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ComparisonItem {
  label: string;
  propfirm: string;
  industry: string;
  propfirmPercent: number;
  industryPercent: number;
}

const comparisons: ComparisonItem[] = [
  {
    label: "Profit Split",
    propfirm: "90%",
    industry: "70%",
    propfirmPercent: 90,
    industryPercent: 70,
  },
  {
    label: "Execution Speed",
    propfirm: "<200ms",
    industry: "500ms+",
    propfirmPercent: 95,
    industryPercent: 40,
  },
  {
    label: "Payout Speed",
    propfirm: "24 hours",
    industry: "3-7 days",
    propfirmPercent: 95,
    industryPercent: 30,
  },
  {
    label: "Hidden Fees",
    propfirm: "None",
    industry: "Common",
    propfirmPercent: 100,
    industryPercent: 20,
  },
];

const trustBadges = [
  "Bank-Grade Security",
  "2FA Enabled",
  "No Hidden Fees",
  "Instant Activation",
];

function ComparisonBar({
  item,
  isVisible,
  index,
}: {
  item: ComparisonItem;
  isVisible: boolean;
  index: number;
}) {
  return (
    <div
      className={cn(
        "opacity-0 transition-opacity duration-500",
        isVisible && "opacity-100"
      )}
      style={{ transitionDelay: `${index * 150}ms` }}
    >
      <div className="text-sm uppercase tracking-wider text-muted-foreground mb-4">
        {item.label}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* PropFirm Side */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              PropFirm
            </span>
            <span className="display-mono font-bold text-lg">
              {item.propfirm}
            </span>
          </div>
          <div className="comparison-bar">
            <div
              className="comparison-bar-fill"
              style={{
                width: isVisible ? `${item.propfirmPercent}%` : "0%",
                transitionDelay: `${index * 150 + 200}ms`,
              }}
            />
          </div>
        </div>

        {/* Industry Side */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Industry
            </span>
            <span className="display-mono text-muted-foreground text-lg">
              {item.industry}
            </span>
          </div>
          <div className="comparison-bar">
            <div
              className="comparison-bar-fill bg-muted-foreground/30"
              style={{
                width: isVisible ? `${item.industryPercent}%` : "0%",
                transitionDelay: `${index * 150 + 200}ms`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Comparison() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="compare"
      ref={sectionRef}
      className="py-24 md:py-32 relative bg-grain"
    >
      {/* Grid Background */}
      <div className="absolute inset-0 bg-grid-noir opacity-40 pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-tight mb-4">
            Why PropFirm Wins
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            See how we stack up against the industry average
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {/* PropFirm Column with Scanlines */}
            <div className="relative p-8 bg-background-secondary border border-foreground scanlines">
              <div className="relative z-10">
                <h3 className="text-2xl font-bold uppercase tracking-tight mb-8">
                  PropFirm
                </h3>

                <div className="space-y-6">
                  {comparisons.map((item, i) => (
                    <div
                      key={item.label}
                      className={cn(
                        "opacity-0 transition-all duration-500",
                        isVisible && "opacity-100"
                      )}
                      style={{ transitionDelay: `${i * 100}ms` }}
                    >
                      <div className="flex justify-between items-center py-3 border-b border-border">
                        <span className="text-sm text-muted-foreground">
                          {item.label}
                        </span>
                        <span className="display-mono font-bold text-lg">
                          {item.propfirm}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Industry Column (Muted) */}
            <div className="relative p-8 bg-background-secondary/50 border border-border opacity-60">
              <h3 className="text-2xl font-bold uppercase tracking-tight mb-8 text-muted-foreground">
                Industry Avg
              </h3>

              <div className="space-y-6">
                {comparisons.map((item, i) => (
                  <div
                    key={item.label}
                    className={cn(
                      "opacity-0 transition-all duration-500",
                      isVisible && "opacity-100"
                    )}
                    style={{ transitionDelay: `${i * 100 + 50}ms` }}
                  >
                    <div className="flex justify-between items-center py-3 border-b border-border/50">
                      <span className="text-sm text-muted-foreground/60">
                        {item.label}
                      </span>
                      <span className="display-mono text-muted-foreground text-lg line-through decoration-loss/50">
                        {item.industry}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-4">
            {trustBadges.map((badge, i) => (
              <div
                key={badge}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 border border-border bg-background-secondary",
                  "opacity-0 transition-opacity duration-500",
                  isVisible && "opacity-100"
                )}
                style={{ transitionDelay: `${600 + i * 100}ms` }}
              >
                <span className="w-1.5 h-1.5 bg-profit" />
                <span className="text-xs uppercase tracking-wider">
                  {badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
