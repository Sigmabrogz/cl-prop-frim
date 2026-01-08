"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function FinalCTA() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-32 md:py-48 relative bg-grain overflow-hidden"
    >
      {/* Grid Background */}
      <div className="absolute inset-0 bg-grid-noir opacity-30 pointer-events-none" />

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Headline */}
          <h2
            className={cn(
              "text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold uppercase tracking-tighter mb-8",
              "word-reveal",
              isVisible && "opacity-100"
            )}
          >
            Ready to Trade?
          </h2>

          {/* Stat */}
          <p
            className={cn(
              "text-xl md:text-2xl text-muted-foreground mb-12",
              "word-reveal",
              isVisible && "opacity-100"
            )}
            style={{ animationDelay: "200ms" }}
          >
            Join <span className="display-mono font-bold text-foreground">12,543</span> funded traders
          </p>

          {/* CTA Button with Micro-Jiggle */}
          <div
            className={cn(
              "mb-12 word-reveal",
              isVisible && "opacity-100"
            )}
            style={{ animationDelay: "400ms" }}
          >
            <Link href="/signup">
              <button className="btn-sharp btn-sharp-white px-12 py-5 text-lg hover-jiggle">
                Start Your Challenge
              </button>
            </Link>
          </div>

          {/* Trust Line */}
          <div
            className={cn(
              "flex flex-wrap justify-center gap-6 text-sm text-muted-foreground",
              "word-reveal",
              isVisible && "opacity-100"
            )}
            style={{ animationDelay: "600ms" }}
          >
            {["No Hidden Fees", "Instant Activation", "24/7 Support"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="w-1 h-1 bg-foreground" />
                <span className="uppercase tracking-wider text-xs">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
