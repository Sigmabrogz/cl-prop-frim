"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Odometer Number Component
function OdometerNumber({
  value,
  prefix = "",
  suffix = "",
  delay = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  delay?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const timeout = setTimeout(() => {
      const duration = 1500;
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
    }, delay);

    return () => clearTimeout(timeout);
  }, [isVisible, value, delay]);

  const formattedValue = displayValue.toLocaleString();

  return (
    <div ref={ref} className="display-mono">
      <span className="text-muted-foreground">{prefix}</span>
      {formattedValue.split("").map((char, i) => (
        <span
          key={i}
          className={cn(
            "odometer-digit",
            isVisible && "opacity-100"
          )}
          style={{ animationDelay: `${delay + i * 50}ms` }}
        >
          {char}
        </span>
      ))}
      <span className="text-muted-foreground">{suffix}</span>
    </div>
  );
}

// Word Reveal Component
function WordReveal({ text, delay = 0 }: { text: string; delay?: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  const words = text.split(" ");

  return (
    <div ref={ref} className="flex flex-wrap justify-center gap-x-4 gap-y-2">
      {words.map((word, i) => (
        <span
          key={i}
          className={cn(
            "word-reveal",
            isVisible && "opacity-100"
          )}
          style={{ animationDelay: `${delay + i * 100}ms` }}
        >
          {word}
        </span>
      ))}
    </div>
  );
}

// KPI Tile Component
function KPITile({
  value,
  prefix,
  suffix,
  label,
  sublabel,
  delay,
  isProfit,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  sublabel?: string;
  delay: number;
  isProfit?: boolean;
}) {
  return (
    <div className="kpi-tile hover-lift">
      <div className={cn(
        "text-3xl md:text-4xl lg:text-5xl font-bold mb-2",
        isProfit && "text-profit"
      )}>
        <OdometerNumber value={value} prefix={prefix} suffix={suffix} delay={delay} />
      </div>
      <div className="text-sm uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {sublabel && (
        <div className="text-xs text-muted-foreground/60 mt-1">
          {sublabel}
        </div>
      )}
    </div>
  );
}

export function Hero() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / 50;
    const y = (e.clientY - rect.top - rect.height / 2) / 50;
    setMousePosition({ x, y });
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (hero) {
      hero.addEventListener("mousemove", handleMouseMove);
      return () => hero.removeEventListener("mousemove", handleMouseMove);
    }
  }, [handleMouseMove]);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-grain"
    >
      {/* Grid Overlay with Parallax */}
      <div
        className="absolute inset-0 bg-grid-noir parallax-layer pointer-events-none"
        style={{
          transform: `translate(${mousePosition.x}px, ${mousePosition.y}px)`,
        }}
      />

      {/* Content */}
      <div className="container mx-auto px-4 pt-32 pb-16 relative z-10">
        {/* Main Headline */}
        <div className="text-center mb-12">
          <div className="mb-8">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold tracking-tighter uppercase">
              <WordReveal text="TRADE CRYPTO WITH" delay={0} />
            </h1>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold tracking-tighter uppercase mt-2">
              <span className="word-reveal stagger-3" style={{ animationDelay: '400ms' }}>
                $200,000
              </span>
            </h1>
          </div>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 word-reveal stagger-5" style={{ animationDelay: '600ms' }}>
            Zero risk to your capital. Pass evaluation in 5 days.
            <br className="hidden sm:block" />
            Keep up to 90% of profits.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 word-reveal stagger-6" style={{ animationDelay: '700ms' }}>
            <Link href="/signup">
              <button className="btn-sharp btn-sharp-white px-10 py-4 text-base hover-jiggle">
                Start Your Challenge
              </button>
            </Link>
            <Link href="#how-it-works">
              <button className="btn-sharp btn-sharp-outline px-10 py-4 text-base">
                How It Works
              </button>
            </Link>
          </div>
        </div>

        {/* KPI Wall */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto">
          <KPITile
            value={2800000}
            prefix="$"
            suffix=""
            label="Paid Out"
            sublabel="This Month"
            delay={800}
          />
          <KPITile
            value={12543}
            label="Active Traders"
            sublabel="Trading Now"
            delay={900}
          />
          <KPITile
            value={90}
            suffix="%"
            label="Profit Split"
            sublabel="Industry Best"
            delay={1000}
            isProfit
          />
          <KPITile
            value={200}
            prefix="<"
            suffix="ms"
            label="Execution"
            sublabel="Ultra-Fast"
            delay={1100}
          />
        </div>

        {/* Trust Indicators */}
        <div className="flex flex-wrap justify-center gap-8 mt-16 text-sm text-muted-foreground">
          {[
            "No Hidden Fees",
            "Instant Activation",
            "24/7 Trading",
            "Weekly Payouts",
          ].map((item, i) => (
            <div
              key={item}
              className="flex items-center gap-2 word-reveal"
              style={{ animationDelay: `${1200 + i * 100}ms` }}
            >
              <span className="w-1.5 h-1.5 bg-foreground" />
              <span className="uppercase tracking-wider text-xs">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
    </section>
  );
}
