"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Target,
  Award,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    number: "01",
    icon: CreditCard,
    title: "Choose Your Plan",
    description:
      "Select an account size and evaluation type that fits your trading style. Pay a one-time fee to begin your journey.",
    color: "from-info to-accent-blue",
    details: ["$10K - $100K accounts", "1-Step or 2-Step evaluation", "Instant activation"],
  },
  {
    number: "02",
    icon: Target,
    title: "Pass the Evaluation",
    description:
      "Trade on our platform and hit the profit target while respecting risk limits. No time pressure, trade at your pace.",
    color: "from-accent-purple to-info",
    details: ["10% profit target", "5% daily loss limit", "No time restrictions"],
  },
  {
    number: "03",
    icon: Award,
    title: "Get Funded",
    description:
      "Once you pass, receive your funded account. Trade with our capital and keep up to 90% of all profits you generate.",
    color: "from-profit to-profit-hover",
    details: ["Instant funding", "Up to 90% profit split", "Scale to $200K"],
  },
  {
    number: "04",
    icon: Wallet,
    title: "Withdraw Profits",
    description:
      "Request payouts weekly with no minimum threshold. Your profits are transferred directly to your preferred method.",
    color: "from-primary to-warning",
    details: ["Weekly withdrawals", "Crypto & bank transfer", "24h processing"],
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-grid opacity-15" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <Badge variant="outline" className="mb-4 px-4 py-1.5">
            <Layers className="w-4 h-4 mr-2 text-primary" />
            Simple Process
          </Badge>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            How It <span className="gradient-text">Works</span>
          </h2>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get funded in four simple steps. Our process is designed to be straightforward and trader-friendly.
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-5xl mx-auto relative">
          {/* Connecting line (desktop) */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary via-profit to-warning hidden lg:block" />

          <div className="space-y-12 lg:space-y-0">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className={cn(
                  "relative flex flex-col lg:flex-row items-center gap-8 lg:gap-16",
                  index % 2 === 1 && "lg:flex-row-reverse"
                )}
              >
                {/* Step number circle (on line) */}
                <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 z-10">
                  <div
                    className={cn(
                      "w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center",
                      "text-2xl font-bold text-white shadow-xl",
                      step.color
                    )}
                  >
                    {step.number}
                  </div>
                </div>

                {/* Content card */}
                <div
                  className={cn(
                    "flex-1 lg:w-[calc(50%-4rem)]",
                    index % 2 === 0 ? "lg:text-right lg:pr-16" : "lg:text-left lg:pl-16"
                  )}
                >
                  <div
                    className={cn(
                      "p-6 md:p-8 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm",
                      "hover:bg-card/80 transition-all duration-300 group"
                    )}
                  >
                    {/* Mobile step number */}
                    <div className="lg:hidden mb-4 flex items-center gap-4">
                      <div
                        className={cn(
                          "w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center",
                          "text-xl font-bold text-white",
                          step.color
                        )}
                      >
                        {step.number}
                      </div>
                      <step.icon className="h-6 w-6 text-muted-foreground" />
                    </div>

                    {/* Icon (desktop) */}
                    <div
                      className={cn(
                        "hidden lg:flex mb-4",
                        index % 2 === 0 ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className="p-3 rounded-xl bg-background-tertiary group-hover:bg-primary/10 transition-colors">
                        <step.icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>

                    <h3 className="text-2xl font-semibold mb-3">{step.title}</h3>
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      {step.description}
                    </p>

                    {/* Details */}
                    <div
                      className={cn(
                        "flex flex-wrap gap-2",
                        index % 2 === 0 ? "lg:justify-end" : "lg:justify-start"
                      )}
                    >
                      {step.details.map((detail) => (
                        <div
                          key={detail}
                          className="flex items-center gap-1.5 text-sm text-muted-foreground"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-profit" />
                          {detail}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Empty space for opposite side */}
                <div className="hidden lg:block flex-1 lg:w-[calc(50%-4rem)]" />
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-20">
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 rounded-2xl bg-card/50 border border-border/50">
            <div className="text-center sm:text-left">
              <h3 className="text-xl font-semibold mb-1">Ready to start trading?</h3>
              <p className="text-muted-foreground">Join thousands of funded traders today.</p>
            </div>
            <Link href="/signup">
              <Button variant="glow" size="lg" className="group whitespace-nowrap">
                Start Your Challenge
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
