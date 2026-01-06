"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Shield,
  DollarSign,
  BarChart3,
  Clock,
  Lock,
  Wallet,
  LineChart,
  Globe,
  Headphones,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Zap,
    title: "Lightning Fast Execution",
    description:
      "Sub-200ms trade execution with direct market access. Real-time price feeds from Binance. No requotes, no slippage.",
    color: "from-primary to-warning",
    highlight: true,
  },
  {
    icon: Shield,
    title: "Advanced Risk Management",
    description:
      "Built-in daily loss limits and trailing max drawdown protection. Real-time P&L tracking to keep you safe.",
    color: "from-info to-accent-purple",
  },
  {
    icon: DollarSign,
    title: "Up to 90% Profit Split",
    description:
      "Industry-leading profit sharing. Keep up to 90% of everything you earn. Weekly payouts with no minimum threshold.",
    color: "from-profit to-profit-hover",
    badge: "Best Rate",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description:
      "Professional trading dashboard with detailed analytics, trade journal, performance metrics, and risk reports.",
    color: "from-accent-purple to-info",
  },
  {
    icon: Clock,
    title: "Flexible Evaluation",
    description:
      "Pass in as little as 5 trading days. No maximum time limit. Trade at your own pace without pressure.",
    color: "from-loss to-warning",
  },
  {
    icon: Lock,
    title: "Bank-Grade Security",
    description:
      "Enterprise security with encrypted data, 2FA authentication, and comprehensive audit trails. Your funds are safe.",
    color: "from-foreground-muted to-border",
  },
];

const additionalFeatures = [
  { icon: Wallet, label: "Crypto & Card Payments" },
  { icon: LineChart, label: "TradingView Charts" },
  { icon: Globe, label: "Trade 24/7" },
  { icon: Headphones, label: "Priority Support" },
];

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[0];
  index: number;
}) {
  return (
    <Card
      variant={feature.highlight ? "glow" : "interactive"}
      className={cn(
        "group relative overflow-hidden h-full",
        feature.highlight && "md:col-span-2 lg:col-span-1"
      )}
    >
      <CardContent className="p-6">
        {/* Icon */}
        <div className="relative mb-5">
          <div
            className={cn(
              "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center",
              "group-hover:scale-110 transition-transform duration-300",
              feature.color
            )}
          >
            <feature.icon className="w-7 h-7 text-white" />
          </div>

          {/* Badge if exists */}
          {feature.badge && (
            <Badge
              variant="success"
              size="xs"
              className="absolute -top-1 -right-1"
            >
              {feature.badge}
            </Badge>
          )}
        </div>

        {/* Content */}
        <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
          {feature.title}
        </h3>
        <p className="text-muted-foreground leading-relaxed">
          {feature.description}
        </p>

        {/* Hover arrow */}
        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
          Learn more
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </CardContent>

      {/* Background gradient on hover */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500",
          feature.color
        )}
      />
    </Card>
  );
}

export function Features() {
  return (
    <section id="features" className="py-24 md:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-info/5 rounded-full blur-[100px]" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 px-4 py-1.5">
            <TrendingUp className="w-4 h-4 mr-2 text-primary" />
            Platform Features
          </Badge>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Why Traders <span className="gradient-text">Choose Us</span>
          </h2>

          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Industry-leading technology and trader-friendly rules designed to
            help you succeed. Everything you need to trade professionally.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>

        {/* Additional Features Bar */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-8">
          {additionalFeatures.map((feature) => (
            <div
              key={feature.label}
              className="flex items-center gap-3 px-5 py-3 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm hover:border-primary/30 transition-colors"
            >
              <div className="p-2 rounded-lg bg-primary/10">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <span className="font-medium">{feature.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
