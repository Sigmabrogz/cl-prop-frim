"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type PlanType = "classic" | "turbo" | "2-step";

interface Plan {
  name: string;
  accountSize: number;
  price: number;
  popular?: boolean;
}

interface PlanConfig {
  profitTarget: string;
  dailyLoss: string;
  maxDrawdown: string;
  minDays: number;
  profitSplit: string;
}

const planConfigs: Record<PlanType, PlanConfig> = {
  classic: {
    profitTarget: "10%",
    dailyLoss: "4%",
    maxDrawdown: "6%",
    minDays: 5,
    profitSplit: "80%",
  },
  turbo: {
    profitTarget: "8%",
    dailyLoss: "4%",
    maxDrawdown: "4%",
    minDays: 5,
    profitSplit: "70%",
  },
  "2-step": {
    profitTarget: "4% / 9%",
    dailyLoss: "6%",
    maxDrawdown: "9%",
    minDays: 5,
    profitSplit: "80%",
  },
};

const plans: Record<PlanType, Plan[]> = {
  classic: [
    { name: "Starter", accountSize: 2500, price: 35 },
    { name: "Basic", accountSize: 5000, price: 59 },
    { name: "Standard", accountSize: 10000, price: 99, popular: true },
    { name: "Pro", accountSize: 25000, price: 199 },
    { name: "Elite", accountSize: 50000, price: 349 },
  ],
  turbo: [
    { name: "Starter", accountSize: 2500, price: 45 },
    { name: "Basic", accountSize: 5000, price: 79 },
    { name: "Standard", accountSize: 10000, price: 129, popular: true },
    { name: "Pro", accountSize: 25000, price: 259 },
    { name: "Elite", accountSize: 50000, price: 449 },
  ],
  "2-step": [
    { name: "Starter", accountSize: 2500, price: 25 },
    { name: "Basic", accountSize: 5000, price: 45 },
    { name: "Standard", accountSize: 10000, price: 79, popular: true },
    { name: "Pro", accountSize: 25000, price: 159 },
    { name: "Elite", accountSize: 50000, price: 279 },
  ],
};

const planDescriptions: Record<PlanType, string> = {
  classic: "Balanced rules with 10% profit target. Perfect for consistent traders.",
  turbo: "Lower 8% target with tighter 4% drawdown. Get funded faster.",
  "2-step": "Two phases with easier targets. Lowest entry fee.",
};

export function Pricing() {
  const [planType, setPlanType] = useState<PlanType>("classic");
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });
  const tabsRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (tabsRef.current) {
      const activeTab = tabsRef.current.querySelector(`[data-tab="${planType}"]`) as HTMLElement;
      if (activeTab) {
        setUnderlineStyle({
          left: activeTab.offsetLeft,
          width: activeTab.offsetWidth,
        });
      }
    }
  }, [planType]);

  const currentPlans = plans[planType];
  const currentConfig = planConfigs[planType];

  return (
    <section
      id="pricing"
      ref={sectionRef}
      className="py-24 md:py-32 bg-background-secondary/30 relative"
    >
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-tight mb-4">
            Choose Your Challenge
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Select a challenge type that matches your trading style. No hidden fees.
          </p>

          {/* Plan Type Tabs with Sliding Underline */}
          <div className="inline-block relative" ref={tabsRef}>
            <div className="flex gap-1 p-1 bg-background-secondary border border-border">
              {(["classic", "turbo", "2-step"] as PlanType[]).map((type) => (
                <button
                  key={type}
                  data-tab={type}
                  onClick={() => setPlanType(type)}
                  className={cn(
                    "px-6 py-3 text-sm font-medium uppercase tracking-wider transition-colors relative z-10",
                    planType === type
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {type === "2-step" ? "2-Step" : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
            {/* Sliding Underline */}
            <div
              className="absolute bottom-1 h-0.5 bg-foreground transition-all duration-300 ease-out"
              style={{
                left: underlineStyle.left,
                width: underlineStyle.width,
              }}
            />
          </div>

          <p className="text-sm text-muted-foreground mt-4">
            {planDescriptions[planType]}
          </p>
        </div>

        {/* Pricing Table */}
        <div className="max-w-6xl mx-auto overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="text-left">Account</th>
                {currentPlans.map((plan) => (
                  <th
                    key={plan.accountSize}
                    className={cn(
                      "text-center relative",
                      plan.popular && "bg-foreground text-background"
                    )}
                  >
                    {plan.popular && (
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-foreground bg-background px-2 py-0.5 border border-foreground">
                        Popular
                      </span>
                    )}
                    <span className="display-mono">${plan.accountSize.toLocaleString()}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-muted-foreground text-sm">Fee</td>
                {currentPlans.map((plan) => (
                  <td
                    key={plan.accountSize}
                    className={cn(
                      "text-center display-mono text-lg font-bold",
                      plan.popular && "bg-foreground/5"
                    )}
                  >
                    ${plan.price}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm">Profit Target</td>
                {currentPlans.map((plan) => (
                  <td
                    key={plan.accountSize}
                    className={cn(
                      "text-center display-mono text-profit",
                      plan.popular && "bg-foreground/5"
                    )}
                  >
                    {currentConfig.profitTarget}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm">Daily Loss</td>
                {currentPlans.map((plan) => (
                  <td
                    key={plan.accountSize}
                    className={cn(
                      "text-center display-mono text-loss",
                      plan.popular && "bg-foreground/5"
                    )}
                  >
                    {currentConfig.dailyLoss}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm">Max Drawdown</td>
                {currentPlans.map((plan) => (
                  <td
                    key={plan.accountSize}
                    className={cn(
                      "text-center display-mono text-loss",
                      plan.popular && "bg-foreground/5"
                    )}
                  >
                    {currentConfig.maxDrawdown}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm">Min Days</td>
                {currentPlans.map((plan) => (
                  <td
                    key={plan.accountSize}
                    className={cn(
                      "text-center display-mono",
                      plan.popular && "bg-foreground/5"
                    )}
                  >
                    {currentConfig.minDays}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm">Profit Split</td>
                {currentPlans.map((plan) => (
                  <td
                    key={plan.accountSize}
                    className={cn(
                      "text-center display-mono text-profit font-bold",
                      plan.popular && "bg-foreground/5"
                    )}
                  >
                    {currentConfig.profitSplit}
                  </td>
                ))}
              </tr>
              <tr>
                <td></td>
                {currentPlans.map((plan) => (
                  <td
                    key={plan.accountSize}
                    className={cn(
                      "text-center py-4",
                      plan.popular && "bg-foreground/5"
                    )}
                  >
                    <Link href="/signup">
                      <button
                        className={cn(
                          "btn-sharp px-4 py-2 text-xs w-full",
                          plan.popular
                            ? "btn-sharp-white"
                            : "btn-sharp-outline"
                        )}
                      >
                        Select
                      </button>
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom Stats */}
        <div className="flex flex-wrap justify-center gap-8 md:gap-16 mt-16 pt-12 border-t border-border">
          {[
            { label: "Instant Activation", value: "< 5 min" },
            { label: "Payment Methods", value: "Crypto & Card" },
            { label: "Success Rate", value: "32%" },
            { label: "Avg Payout Time", value: "24 hours" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={cn(
                "text-center word-reveal",
                isVisible && "opacity-100"
              )}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="display-mono text-2xl font-bold mb-1">
                {stat.value}
              </div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
