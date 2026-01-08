"use client";

import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Testimonial {
  id: string;
  quote: string;
  name: string;
  initials: string;
  funded: string;
  profit?: string;
}

const testimonials: Testimonial[] = [
  {
    id: "1",
    quote: "Passed in 8 days. Payout hit my wallet in under 24 hours. This is how prop firms should work.",
    name: "Marcus T.",
    initials: "MT",
    funded: "$50K",
    profit: "$12,400",
  },
  {
    id: "2",
    quote: "Finally a prop firm with real execution. No slippage, no requotes. The platform is incredibly fast.",
    name: "Sarah L.",
    initials: "SL",
    funded: "$25K",
    profit: "$8,200",
  },
  {
    id: "3",
    quote: "The trailing drawdown is tough but fair. Made $12K in month one. Best decision I ever made.",
    name: "David R.",
    initials: "DR",
    funded: "$100K",
    profit: "$24,500",
  },
  {
    id: "4",
    quote: "Clean platform, transparent rules, fast payouts. What more could you ask for?",
    name: "Anna K.",
    initials: "AK",
    funded: "$25K",
    profit: "$6,800",
  },
  {
    id: "5",
    quote: "The 90% profit split is real. No hidden fees, no tricks. They actually want you to succeed.",
    name: "James W.",
    initials: "JW",
    funded: "$50K",
    profit: "$18,200",
  },
];

function TestimonialCard({ testimonial, index }: { testimonial: Testimonial; index: number }) {
  return (
    <div
      className={cn(
        "flex-shrink-0 w-[340px] md:w-[400px] p-6 md:p-8 bg-background-secondary border border-border hover-lift transition-all duration-300",
        "word-reveal"
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Quote Mark */}
      <div className="text-6xl font-serif text-muted-foreground/20 leading-none mb-4">
        "
      </div>

      {/* Quote */}
      <p className="text-base md:text-lg mb-6 leading-relaxed">
        {testimonial.quote}
      </p>

      {/* Author */}
      <div className="flex items-center gap-4 pt-4 border-t border-border">
        <div className="avatar-circle">
          {testimonial.initials}
        </div>
        <div className="flex-1">
          <div className="font-medium">{testimonial.name}</div>
          <div className="text-sm text-muted-foreground">
            Funded {testimonial.funded}
          </div>
        </div>
        {testimonial.profit && (
          <div className="text-right">
            <div className="display-mono text-profit font-bold">
              +{testimonial.profit}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Earned
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Testimonials() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      ref={sectionRef}
      className="py-24 md:py-32 relative overflow-hidden"
    >
      {/* Subtle Background Drift */}
      <div className="absolute inset-0 bg-grid-noir opacity-20 pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-tight mb-4">
            What Traders Say
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Real stories from real funded traders
          </p>
        </div>
      </div>

      {/* Scrollable Cards with Peek Effect */}
      <div className="relative">
        {/* Fade Mask for Peeking Effect */}
        <div className="absolute right-0 top-0 bottom-0 w-32 md:w-48 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />

        {/* Scrollable Container */}
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto scrollbar-none px-4 md:px-8 py-4"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {/* Left Spacer */}
          <div className="flex-shrink-0 w-4 md:w-[calc((100vw-1280px)/2)]" />

          {testimonials.map((testimonial, i) => (
            <div
              key={testimonial.id}
              style={{ scrollSnapAlign: "start" }}
            >
              <TestimonialCard
                testimonial={testimonial}
                index={i}
              />
            </div>
          ))}

          {/* Right Spacer for Peeking */}
          <div className="flex-shrink-0 w-32 md:w-48" />
        </div>
      </div>

      {/* Scroll Hint */}
      <div className="container mx-auto px-4 mt-8">
        <div className="flex justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="uppercase tracking-wider text-xs">Scroll to see more</span>
            <svg
              className="w-4 h-4 animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="square"
                strokeLinejoin="miter"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
