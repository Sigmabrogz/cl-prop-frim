"use client";

import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Feature {
  title: string;
  value?: string;
  description: string;
  details?: string[];
  size: "large" | "wide" | "normal";
  isProfit?: boolean;
}

const features: Feature[] = [
  {
    title: "Execution Speed",
    value: "<200ms",
    description: "Direct market access with real-time Binance feeds",
    details: ["No requotes", "No slippage", "Instant fills"],
    size: "large",
  },
  {
    title: "Risk Management",
    value: "Built-in",
    description: "Automatic protection for your account",
    details: ["4% daily loss limit", "6% max drawdown", "Trailing protection"],
    size: "normal",
  },
  {
    title: "Profit Split",
    value: "90%",
    description: "Industry-leading profit share",
    details: ["Weekly payouts", "No minimum", "Scale to 90%"],
    size: "normal",
    isProfit: true,
  },
  {
    title: "TradingView",
    description: "Professional charting with all indicators",
    size: "normal",
  },
  {
    title: "Platform Statistics",
    description: "Real-time performance tracking",
    details: ["99.9% uptime", "145 countries", "50K+ trades/day"],
    size: "wide",
  },
  {
    title: "24/7 Trading",
    description: "Trade anytime, no restrictions",
    size: "normal",
  },
];

const tags = [
  "Real-time feeds",
  "Binance liquidity",
  "Bank-grade security",
  "2FA enabled",
  "Instant payouts",
  "No time limits",
];

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "group relative bg-background-secondary border border-border p-6 md:p-8 hover-lift bevel-card transition-all duration-300",
        feature.size === "large" && "bento-large",
        feature.size === "wide" && "bento-wide",
        "wipe-reveal",
        !isVisible && "opacity-0"
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Hover Top Border */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-foreground transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">
        {feature.value && (
          <div
            className={cn(
              "display-mono text-4xl md:text-5xl lg:text-6xl font-bold mb-4",
              feature.isProfit && "text-profit"
            )}
          >
            {feature.value}
          </div>
        )}

        <h3 className="text-lg md:text-xl font-semibold uppercase tracking-wide mb-2">
          {feature.title}
        </h3>

        <p className="text-muted-foreground text-sm mb-4">
          {feature.description}
        </p>

        {/* Hover to Reveal Details */}
        {feature.details && (
          <div className="mt-auto">
            <div className="reveal-content opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="pt-4 border-t border-border space-y-2">
                {feature.details.map((detail, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-1 h-1 bg-foreground" />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Features() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="features"
      ref={sectionRef}
      className="py-24 md:py-32 bg-grain relative"
    >
      {/* Grid Background */}
      <div className="absolute inset-0 bg-grid-noir opacity-50 pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-tight mb-4">
            Why Traders
            <br />
            Choose Us
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Industry-leading technology and trader-friendly rules designed to help you succeed
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>

        {/* Tag Cloud */}
        <div className="flex flex-wrap justify-center gap-3">
          {tags.map((tag, i) => (
            <span
              key={tag}
              className={cn(
                "px-4 py-2 text-xs uppercase tracking-wider border border-border bg-background-secondary/50 hover:border-foreground transition-colors cursor-default word-reveal",
                isVisible && "opacity-100"
              )}
              style={{ animationDelay: `${600 + i * 50}ms` }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
