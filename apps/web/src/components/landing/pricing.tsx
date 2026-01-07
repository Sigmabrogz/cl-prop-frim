"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Sparkles,
  Zap,
  TrendingUp,
  ArrowRight,
  Info,
  Flame,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PlanType = "classic" | "turbo" | "2-step";

interface Plan {
  name: string;
  accountSize: number;
  price: number;
  popular?: boolean;
  features: {
    profitTarget: string;
    dailyLoss: string;
    maxDrawdown: string;
    minDays: number;
    leverage: string;
    profitSplit: string;
    trailingDrawdown: boolean;
  };
}

const plans: Record<PlanType, Plan[]> = {
  classic: [
    {
      name: "Starter",
      accountSize: 2500,
      price: 35,
      features: {
        profitTarget: "10%",
        dailyLoss: "4%",
        maxDrawdown: "6%",
        minDays: 5,
        leverage: "5x",
        profitSplit: "80%",
        trailingDrawdown: true,
      },
    },
    {
      name: "Basic",
      accountSize: 5000,
      price: 59,
      features: {
        profitTarget: "10%",
        dailyLoss: "4%",
        maxDrawdown: "6%",
        minDays: 5,
        leverage: "5x",
        profitSplit: "80%",
        trailingDrawdown: true,
      },
    },
    {
      name: "Standard",
      accountSize: 10000,
      price: 99,
      popular: true,
      features: {
        profitTarget: "10%",
        dailyLoss: "4%",
        maxDrawdown: "6%",
        minDays: 5,
        leverage: "5x",
        profitSplit: "80%",
        trailingDrawdown: true,
      },
    },
    {
      name: "Professional",
      accountSize: 25000,
      price: 199,
      features: {
        profitTarget: "10%",
        dailyLoss: "4%",
        maxDrawdown: "6%",
        minDays: 5,
        leverage: "5x",
        profitSplit: "80%",
        trailingDrawdown: true,
      },
    },
    {
      name: "Elite",
      accountSize: 50000,
      price: 349,
      features: {
        profitTarget: "10%",
        dailyLoss: "4%",
        maxDrawdown: "6%",
        minDays: 5,
        leverage: "5x",
        profitSplit: "80%",
        trailingDrawdown: true,
      },
    },
  ],
  turbo: [
    {
      name: "Starter",
      accountSize: 2500,
      price: 45,
      features: {
        profitTarget: "8%",
        dailyLoss: "4%",
        maxDrawdown: "4%",
        minDays: 5,
        leverage: "5x",
        profitSplit: "70%",
        trailingDrawdown: true,
      },
    },
    {
      name: "Basic",
      accountSize: 5000,
      price: 79,
      features: {
        profitTarget: "8%",
        dailyLoss: "4%",
        maxDrawdown: "4%",
        minDays: 5,
        leverage: "5x",
        profitSplit: "70%",
        trailingDrawdown: true,
      },
    },
    {
      name: "Standard",
      accountSize: 10000,
      price: 129,
      popular: true,
      features: {
        profitTarget: "8%",
        dailyLoss: "4%",
        maxDrawdown: "4%",
        minDays: 5,
        leverage: "5x",
        profitSplit: "70%",
        trailingDrawdown: true,
      },
    },
    {
      name: "Professional",
      accountSize: 25000,
      price: 259,
      features: {
        profitTarget: "8%",
        dailyLoss: "4%",
        maxDrawdown: "4%",
        minDays: 5,
        leverage: "5x",
        profitSplit: "70%",
        trailingDrawdown: true,
      },
    },
    {
      name: "Elite",
      accountSize: 50000,
      price: 449,
      features: {
        profitTarget: "8%",
        dailyLoss: "4%",
        maxDrawdown: "4%",
        minDays: 5,
        leverage: "5x",
        profitSplit: "70%",
        trailingDrawdown: true,
      },
    },
    {
      name: "Master",
      accountSize: 100000,
      price: 749,
      features: {
        profitTarget: "8%",
        dailyLoss: "4%",
        maxDrawdown: "4%",
        minDays: 5,
        leverage: "5x",
        profitSplit: "70%",
        trailingDrawdown: true,
      },
    },
  ],
  "2-step": [
    {
      name: "Starter",
      accountSize: 2500,
      price: 25,
      features: {
        profitTarget: "4% / 9%",
        dailyLoss: "6%",
        maxDrawdown: "9%",
        minDays: 5,
        leverage: "5x",
        profitSplit: "80%",
        trailingDrawdown: true,
      },
    },
    {
      name: "Basic",
      accountSize: 5000,
      price: 45,
      features: {
        profitTarget: "4% / 9%",
        dailyLoss: "6%",
        maxDrawdown: "9%",
        minDays: 5,
        leverage: "5x",
        profitSplit: "80%",
        trailingDrawdown: true,
      },
    },
    {
      name: "Standard",
      accountSize: 10000,
      price: 79,
      popular: true,
      features: {
        profitTarget: "4% / 9%",
        dailyLoss: "6%",
        maxDrawdown: "9%",
        minDays: 5,
        leverage: "5x",
        profitSplit: "80%",
        trailingDrawdown: true,
      },
    },
    {
      name: "Professional",
      accountSize: 25000,
      price: 159,
      features: {
        profitTarget: "4% / 9%",
        dailyLoss: "6%",
        maxDrawdown: "9%",
        minDays: 5,
        leverage: "5x",
        profitSplit: "80%",
        trailingDrawdown: true,
      },
    },
    {
      name: "Elite",
      accountSize: 50000,
      price: 279,
      features: {
        profitTarget: "4% / 9%",
        dailyLoss: "6%",
        maxDrawdown: "9%",
        minDays: 5,
        leverage: "5x",
        profitSplit: "80%",
        trailingDrawdown: true,
      },
    },
  ],
};

const planDescriptions: Record<PlanType, { title: string; description: string; icon: React.ReactNode }> = {
  classic: {
    title: "Classic Challenge",
    description: "Balanced rules with 10% profit target. Perfect for consistent traders.",
    icon: <Zap className="w-4 h-4" />,
  },
  turbo: {
    title: "Turbo Challenge",
    description: "Lower 8% target with tighter 4% drawdown. Get funded faster.",
    icon: <Flame className="w-4 h-4" />,
  },
  "2-step": {
    title: "2-Step Challenge",
    description: "Two phases with easier targets. Lowest entry fee.",
    icon: <Layers className="w-4 h-4" />,
  },
};

const includedFeatures = [
  "Real-time execution",
  "No time limits",
  "Weekly payouts",
  "24/7 support",
  "Trailing drawdown",
  "Up to 90% profit split",
];

function PricingCard({
  plan,
  type,
}: {
  plan: Plan;
  type: PlanType;
}) {
  return (
    <Card
      variant={plan.popular ? "glow" : "default"}
      className={cn(
        "relative overflow-hidden transition-all duration-500",
        plan.popular && "scale-[1.02] shadow-2xl shadow-primary/20 border-primary/50"
      )}
    >
      {/* Popular badge */}
      {plan.popular && (
        <div className="absolute -top-px left-0 right-0 h-1 bg-gradient-to-r from-primary via-warning to-primary" />
      )}

      {plan.popular && (
        <div className="absolute top-4 right-4">
          <Badge variant="primary" className="gap-1">
            <Sparkles className="w-3 h-3" />
            Most Popular
          </Badge>
        </div>
      )}

      <CardHeader className="text-center pt-8 pb-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {plan.name}
        </p>
        <div className="mb-1">
          <span className="text-5xl font-bold font-mono">
            ${plan.accountSize.toLocaleString()}
          </span>
        </div>
        <p className="text-muted-foreground">Account Size</p>
      </CardHeader>

      <CardContent className="space-y-6 px-6">
        {/* Price */}
        <div className="text-center p-4 rounded-xl bg-background-secondary border border-border/50">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-sm text-muted-foreground">$</span>
            <span className="text-4xl font-bold gradient-text">{plan.price}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">One-time fee</p>
        </div>

        {/* Rules */}
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Profit Target</span>
            <span className="text-sm font-semibold text-profit">{plan.features.profitTarget}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Daily Loss Limit</span>
            <span className="text-sm font-semibold text-loss">{plan.features.dailyLoss}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Max Drawdown</span>
            <span className="text-sm font-semibold text-loss">{plan.features.maxDrawdown}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Min Trading Days</span>
            <span className="text-sm font-semibold">{plan.features.minDays} days</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Max Leverage</span>
            <span className="text-sm font-semibold">{plan.features.leverage}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Profit Split</span>
            <span className="text-sm font-bold text-profit">{plan.features.profitSplit}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Trailing Drawdown</span>
            <Badge variant={plan.features.trailingDrawdown ? "success" : "secondary"} className="text-xs">
              {plan.features.trailingDrawdown ? "Yes" : "No"}
            </Badge>
          </div>
        </div>
      </CardContent>

      <CardFooter className="px-6 pb-8 pt-4">
        <Link href="/signup" className="w-full">
          <Button
            variant={plan.popular ? "glow" : "outline"}
            size="lg"
            fullWidth
            className="group"
          >
            Get Started
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

export function Pricing() {
  const [planType, setPlanType] = useState<PlanType>("classic");

  return (
    <section id="pricing" className="py-24 md:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[200px]" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 px-4 py-1.5">
            <TrendingUp className="w-4 h-4 mr-2 text-primary" />
            Transparent Pricing
          </Badge>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Choose Your <span className="gradient-text">Challenge</span>
          </h2>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Select a challenge type that matches your trading style. No hidden fees, no surprises.
          </p>

          {/* 3-Way Plan Type Toggle */}
          <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-card border border-border">
            <button
              onClick={() => setPlanType("classic")}
              className={cn(
                "relative px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2",
                planType === "classic"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Zap className="w-4 h-4" />
              Classic
            </button>
            <button
              onClick={() => setPlanType("turbo")}
              className={cn(
                "relative px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2",
                planType === "turbo"
                  ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Flame className="w-4 h-4" />
              Turbo
            </button>
            <button
              onClick={() => setPlanType("2-step")}
              className={cn(
                "relative px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2",
                planType === "2-step"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="w-4 h-4" />
              2-Step
            </button>
          </div>

          <p className="text-sm text-muted-foreground mt-4 flex items-center justify-center gap-2">
            <Info className="h-4 w-4" />
            {planDescriptions[planType].description}
          </p>
        </div>

        {/* Pricing Grid */}
        <div className={cn(
          "grid gap-6 max-w-7xl mx-auto mb-16",
          plans[planType].length <= 4 ? "md:grid-cols-2 lg:grid-cols-4" : 
          plans[planType].length === 5 ? "md:grid-cols-2 lg:grid-cols-5" : 
          "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        )}>
          {plans[planType].map((plan) => (
            <PricingCard key={plan.accountSize} plan={plan} type={planType} />
          ))}
        </div>

        {/* Included Features */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h3 className="text-xl font-semibold mb-2">All Plans Include</h3>
            <p className="text-muted-foreground">Everything you need to trade professionally</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {includedFeatures.map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-3 p-4 rounded-xl bg-card/50 border border-border/50"
              >
                <div className="p-1 rounded-full bg-profit/10">
                  <Check className="w-4 h-4 text-profit" />
                </div>
                <span className="text-sm font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-12 mt-16 pt-16 border-t border-border/50">
          {[
            { label: "Instant Activation", value: "< 5 min" },
            { label: "Payment Methods", value: "Crypto & Card" },
            { label: "Success Rate", value: "32%" },
            { label: "Avg. Payout Time", value: "24 hours" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-bold font-mono">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
