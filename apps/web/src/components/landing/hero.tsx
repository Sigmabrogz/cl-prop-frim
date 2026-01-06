"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Shield,
  Zap,
  Clock,
  DollarSign,
  Activity,
  Users,
  Trophy,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Animated counter component
function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  duration = 2000,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value, duration]);

  return (
    <span className="font-mono tabular-nums">
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
}

// Live price ticker with multiple assets
function LivePriceTicker() {
  const [prices, setPrices] = useState([
    { symbol: "BTC", name: "Bitcoin", price: 91350.42, change: 2.34, icon: "₿" },
    { symbol: "ETH", name: "Ethereum", price: 3245.18, change: 1.87, icon: "Ξ" },
    { symbol: "SOL", name: "Solana", price: 142.56, change: -0.42, icon: "◎" },
  ]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const priceInterval = setInterval(() => {
      setPrices((prev) =>
        prev.map((p) => ({
          ...p,
          price: Math.max(0, p.price + (Math.random() - 0.5) * p.price * 0.001),
          change: p.change + (Math.random() - 0.5) * 0.05,
        }))
      );
    }, 2000);

    const rotateInterval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % prices.length);
    }, 4000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(rotateInterval);
    };
  }, [prices.length]);

  const activePrice = prices[activeIndex];

  return (
    <div className="inline-flex items-center gap-4 px-5 py-2.5 rounded-2xl bg-card/60 border border-border/50 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
          <span className="text-sm font-bold text-primary">
            {activePrice.icon}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">
            {activePrice.symbol}/USD
          </span>
          <span className="font-mono text-sm font-semibold">
            $
            {activePrice.price.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold",
          activePrice.change >= 0
            ? "bg-profit/10 text-profit"
            : "bg-loss/10 text-loss"
        )}
      >
        {activePrice.change >= 0 ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        {activePrice.change >= 0 ? "+" : ""}
        {activePrice.change.toFixed(2)}%
      </div>
      <div className="flex gap-1">
        {prices.map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-all",
              i === activeIndex ? "bg-primary w-3" : "bg-border"
            )}
          />
        ))}
      </div>
    </div>
  );
}

// Floating stats cards
function FloatingStats() {
  return (
    <>
      {/* Top left floating card */}
      <div className="absolute top-32 left-8 hidden xl:block animate-slide-up" style={{ animationDelay: "0.6s" }}>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card/80 border border-border/50 backdrop-blur-sm shadow-lg">
          <div className="p-2 rounded-lg bg-profit/10">
            <Trophy className="h-5 w-5 text-profit" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">This Month</p>
            <p className="font-mono text-lg font-bold text-profit">+$2.8M</p>
            <p className="text-xs text-muted-foreground">Paid to Traders</p>
          </div>
        </div>
      </div>

      {/* Top right floating card */}
      <div className="absolute top-48 right-8 hidden xl:block animate-slide-up" style={{ animationDelay: "0.8s" }}>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card/80 border border-border/50 backdrop-blur-sm shadow-lg">
          <div className="p-2 rounded-lg bg-info/10">
            <Activity className="h-5 w-5 text-info" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Execution Speed</p>
            <p className="font-mono text-lg font-bold">&lt;200ms</p>
            <p className="text-xs text-muted-foreground">Ultra-Fast</p>
          </div>
        </div>
      </div>

      {/* Bottom floating card */}
      <div className="absolute bottom-32 left-16 hidden xl:block animate-slide-up" style={{ animationDelay: "1s" }}>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card/80 border border-border/50 backdrop-blur-sm shadow-lg">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active Traders</p>
            <p className="font-mono text-lg font-bold">12,543</p>
            <p className="text-xs text-profit flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-profit opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-profit" />
              </span>
              Trading Now
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid opacity-30" />

      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px] animate-pulse-glow" />
      <div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-info/10 rounded-full blur-[100px] animate-pulse-glow"
        style={{ animationDelay: "1s" }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-profit/5 rounded-full blur-[150px]"
      />

      {/* Noise texture overlay */}
      <div className="absolute inset-0 bg-noise opacity-50" />

      {/* Floating stats */}
      <FloatingStats />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Live Price Ticker */}
          <div className="flex justify-center mb-8 animate-fade-in">
            <LivePriceTicker />
          </div>

          {/* Badge */}
          <div className="flex justify-center mb-6 animate-slide-up">
            <Badge
              variant="outline"
              className="px-4 py-2 text-sm border-primary/30 bg-primary/5 backdrop-blur-sm"
            >
              <Zap className="w-4 h-4 mr-2 text-primary" />
              Instant Funding Available
              <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold">
                NEW
              </span>
            </Badge>
          </div>

          {/* Main Headline */}
          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 animate-slide-up"
            style={{ animationDelay: "0.1s" }}
          >
            Trade Crypto with
            <span className="block gradient-text mt-2">Up to $200K Capital</span>
          </h1>

          {/* Subheadline */}
          <p
            className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto animate-slide-up leading-relaxed"
            style={{ animationDelay: "0.2s" }}
          >
            Pass our evaluation in as little as{" "}
            <span className="text-foreground font-semibold">5 trading days</span>.
            Keep up to{" "}
            <span className="text-profit font-semibold">90% of profits</span>.
            Zero risk to your personal capital.
          </p>

          {/* CTA Buttons */}
          <div
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-slide-up"
            style={{ animationDelay: "0.3s" }}
          >
            <Link href="/signup">
              <Button variant="glow" size="2xl" className="group min-w-[220px]">
                Start Your Challenge
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="outline" size="2xl" className="min-w-[180px]">
                How It Works
              </Button>
            </Link>
          </div>

          {/* Trust indicators */}
          <div
            className="flex flex-wrap justify-center gap-6 mb-16 animate-slide-up"
            style={{ animationDelay: "0.35s" }}
          >
            {[
              { icon: CheckCircle2, label: "No Hidden Fees" },
              { icon: Shield, label: "Secure Platform" },
              { icon: Clock, label: "24/7 Trading" },
              { icon: Zap, label: "Instant Payouts" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <item.icon className="h-4 w-4 text-profit" />
                {item.label}
              </div>
            ))}
          </div>

          {/* Stats Grid */}
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 max-w-4xl mx-auto animate-slide-up"
            style={{ animationDelay: "0.4s" }}
          >
            {[
              {
                value: 2847,
                prefix: "$",
                suffix: "K+",
                label: "Payouts This Month",
                highlight: true,
              },
              {
                value: 12543,
                prefix: "",
                suffix: "+",
                label: "Active Traders",
                highlight: false,
              },
              {
                value: 90,
                prefix: "",
                suffix: "%",
                label: "Profit Split",
                highlight: true,
                isProfit: true,
              },
              {
                value: 200,
                prefix: "<",
                suffix: "ms",
                label: "Execution Speed",
                highlight: false,
                isStatic: true,
              },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className="relative group p-4 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm hover:bg-card/60 transition-all duration-300"
              >
                <div
                  className={cn(
                    "text-3xl md:text-4xl font-bold mb-1",
                    stat.highlight && "gradient-text",
                    stat.isProfit && "text-profit"
                  )}
                >
                  {stat.isStatic ? (
                    <span className="font-mono">
                      {stat.prefix}
                      {stat.value}
                      {stat.suffix}
                    </span>
                  ) : (
                    <AnimatedNumber
                      value={stat.value}
                      prefix={stat.prefix}
                      suffix={stat.suffix}
                    />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>

                {/* Hover glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent" />
    </section>
  );
}
