"use client";

import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Step {
  number: string;
  title: string;
  description: string;
  details: string[];
  icon: React.ReactNode;
}

const steps: Step[] = [
  {
    number: "01",
    title: "Select Your Account",
    description: "Choose from $2,500 to $100,000 account sizes. Pay a one-time fee and get instant activation.",
    details: ["$2.5K - $100K accounts", "One-time fee only", "Instant activation"],
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="square" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Prove Your Edge",
    description: "Hit the profit target while respecting risk limits. No time pressure, trade at your own pace.",
    details: ["10% profit target", "4% daily loss limit", "No time restrictions"],
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="square" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Get Funded",
    description: "Pass evaluation and receive your funded account. Same day activation with real trading capital.",
    details: ["Same day funding", "Real capital access", "Scale to $200K"],
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="square" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    number: "04",
    title: "Withdraw Profits",
    description: "Request payouts weekly with no minimum threshold. Keep up to 90% of everything you earn.",
    details: ["Weekly withdrawals", "90% profit split", "24h processing"],
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="square" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

function StepCard({ step, index, isVisible }: { step: Step; index: number; isVisible: boolean }) {
  return (
    <div
      className={cn(
        "relative group",
        "opacity-0 translate-y-8",
        "transition-all duration-700 ease-out",
        isVisible && "opacity-100 translate-y-0"
      )}
      style={{ transitionDelay: `${index * 150}ms` }}
    >
      {/* Card */}
      <div className="relative bg-background-secondary border border-border p-6 md:p-8 hover-lift">
        {/* Top accent line that animates in */}
        <div
          className={cn(
            "absolute top-0 left-0 h-[2px] bg-foreground",
            "transition-all duration-700 ease-out",
            isVisible ? "w-full" : "w-0"
          )}
          style={{ transitionDelay: `${index * 150 + 300}ms` }}
        />

        {/* Step number - large watermark */}
        <div
          className={cn(
            "absolute -top-2 -right-2 display-mono text-[80px] md:text-[100px] font-bold leading-none",
            "text-foreground/[0.03] select-none pointer-events-none",
            "transition-all duration-500",
            isVisible ? "opacity-100 scale-100" : "opacity-0 scale-90"
          )}
          style={{ transitionDelay: `${index * 150 + 200}ms` }}
        >
          {step.number}
        </div>

        {/* Header with icon and number */}
        <div className="flex items-start gap-4 mb-6 relative z-10">
          {/* Icon container with animation */}
          <div
            className={cn(
              "flex-shrink-0 w-14 h-14 md:w-16 md:h-16 bg-foreground text-background",
              "flex items-center justify-center",
              "transition-all duration-500",
              isVisible ? "scale-100 rotate-0" : "scale-0 rotate-180"
            )}
            style={{ transitionDelay: `${index * 150 + 100}ms` }}
          >
            {step.icon}
          </div>

          {/* Number badge */}
          <div
            className={cn(
              "display-mono text-sm font-bold text-muted-foreground",
              "px-3 py-1 border border-border bg-background",
              "transition-all duration-300",
              isVisible ? "opacity-100" : "opacity-0"
            )}
            style={{ transitionDelay: `${index * 150 + 250}ms` }}
          >
            STEP {step.number}
          </div>
        </div>

        {/* Title */}
        <h3
          className={cn(
            "text-xl md:text-2xl font-bold uppercase tracking-tight mb-3 relative z-10",
            "transition-all duration-500",
            isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
          )}
          style={{ transitionDelay: `${index * 150 + 200}ms` }}
        >
          {step.title}
        </h3>

        {/* Description */}
        <p
          className={cn(
            "text-muted-foreground mb-6 relative z-10 leading-relaxed",
            "transition-all duration-500",
            isVisible ? "opacity-100" : "opacity-0"
          )}
          style={{ transitionDelay: `${index * 150 + 300}ms` }}
        >
          {step.description}
        </p>

        {/* Detail tags with staggered animation */}
        <div className="flex flex-wrap gap-2 relative z-10">
          {step.details.map((detail, i) => (
            <span
              key={i}
              className={cn(
                "text-xs uppercase tracking-wider px-3 py-1.5",
                "border border-border bg-background",
                "transition-all duration-300",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
              style={{ transitionDelay: `${index * 150 + 400 + i * 80}ms` }}
            >
              {detail}
            </span>
          ))}
        </div>

        {/* Hover reveal arrow */}
        <div className={cn(
          "absolute bottom-6 right-6 md:bottom-8 md:right-8",
          "opacity-0 translate-x-2 transition-all duration-300",
          "group-hover:opacity-100 group-hover:translate-x-0"
        )}>
          <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="square" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>

      {/* Connecting line to next step (visible on larger screens) */}
      {index < steps.length - 1 && (
        <div className="hidden lg:block absolute -bottom-12 left-1/2 transform -translate-x-1/2">
          <div
            className={cn(
              "w-px h-12 bg-border origin-top",
              "transition-all duration-500",
              isVisible ? "scale-y-100" : "scale-y-0"
            )}
            style={{ transitionDelay: `${index * 150 + 500}ms` }}
          />
          <div
            className={cn(
              "w-2 h-2 bg-foreground -ml-[3px]",
              "transition-all duration-300",
              isVisible ? "scale-100" : "scale-0"
            )}
            style={{ transitionDelay: `${index * 150 + 700}ms` }}
          />
        </div>
      )}
    </div>
  );
}

export function HowItWorks() {
  const [isVisible, setIsVisible] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
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

  // Animate progress bar when visible
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setProgressWidth(100);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="py-24 md:py-32 relative overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-grid-noir opacity-30 pointer-events-none" />

      {/* Animated background shapes */}
      <div
        className={cn(
          "absolute top-20 -left-20 w-40 h-40 border border-border/50",
          "transition-all duration-1000",
          isVisible ? "opacity-100 rotate-45" : "opacity-0 rotate-0"
        )}
      />
      <div
        className={cn(
          "absolute bottom-20 -right-20 w-60 h-60 border border-border/30",
          "transition-all duration-1000 delay-300",
          isVisible ? "opacity-100 -rotate-12" : "opacity-0 rotate-0"
        )}
      />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16 md:mb-20">
          <div
            className={cn(
              "inline-block mb-4 transition-all duration-500",
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground border border-border px-4 py-2">
              The Process
            </span>
          </div>

          <h2
            className={cn(
              "text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-tight mb-4",
              "transition-all duration-700 delay-100",
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
          >
            How It Works
          </h2>

          <p
            className={cn(
              "text-muted-foreground max-w-xl mx-auto mb-8",
              "transition-all duration-700 delay-200",
              isVisible ? "opacity-100" : "opacity-0"
            )}
          >
            Get funded in four simple steps. Our process is designed to be straightforward and trader-friendly.
          </p>

          {/* Progress indicator */}
          <div className="max-w-xs mx-auto">
            <div className="h-[2px] bg-border overflow-hidden">
              <div
                className="h-full bg-foreground transition-all duration-1500 ease-out"
                style={{ width: `${progressWidth}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 transition-all duration-300",
                    isVisible && progressWidth > (i * 25) ? "bg-foreground" : "bg-border"
                  )}
                  style={{ transitionDelay: `${800 + i * 200}ms` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {steps.map((step, i) => (
            <StepCard
              key={step.number}
              step={step}
              index={i}
              isVisible={isVisible}
            />
          ))}
        </div>

        {/* Bottom CTA hint */}
        <div
          className={cn(
            "text-center mt-16 transition-all duration-700",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
          style={{ transitionDelay: "1200ms" }}
        >
          <p className="text-sm text-muted-foreground mb-4">
            Ready to start your journey?
          </p>
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-1 h-1 bg-foreground/50 animate-pulse"
                )}
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
