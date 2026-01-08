"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Compare", href: "#compare" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (scrollTop / docHeight) * 100;

      setIsScrolled(scrollTop > 50);
      setScrollProgress(progress);

      // Determine active section
      const sections = navLinks.map(link => link.href.replace('#', '')).filter(Boolean);
      for (const section of sections.reverse()) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 150) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Scroll Progress Bar */}
      <div
        className="scroll-progress"
        style={{ width: `${scrollProgress}%` }}
      />

      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-fixed transition-all duration-300",
          isScrolled
            ? "bg-background/98 backdrop-blur-sm border-b border-border"
            : "bg-transparent"
        )}
      >
        <div className="container mx-auto px-4">
          <div
            className={cn(
              "flex items-center justify-between transition-all duration-300",
              isScrolled ? "h-14" : "h-20"
            )}
          >
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div
                className={cn(
                  "flex items-center justify-center bg-foreground text-background font-bold transition-all duration-300",
                  isScrolled ? "h-8 w-8 text-sm" : "h-10 w-10 text-base"
                )}
              >
                PF
              </div>
              <div className={cn(
                "flex flex-col transition-all duration-300",
                isScrolled ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
              )}>
                <span className="text-lg font-bold tracking-tight">PROPFIRM</span>
                <span className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase -mt-0.5">
                  CRYPTO TRADING
                </span>
              </div>
            </Link>

            {/* Desktop Navigation - Anchor Link Rail */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={cn(
                    "px-4 py-2 text-sm font-medium tracking-wide uppercase transition-colors ink-spread",
                    activeSection === link.href.replace('#', '')
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ink-spread uppercase tracking-wide"
              >
                Login
              </Link>
              <Link href="/signup">
                <button className="btn-sharp btn-sharp-white px-6 py-2.5 text-sm hover-jiggle">
                  Start Challenge
                </button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden relative p-2"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              <div className="relative w-6 h-5 flex flex-col justify-center gap-1.5">
                <span
                  className={cn(
                    "block h-0.5 w-6 bg-foreground transition-all duration-300",
                    isOpen && "absolute rotate-45 top-1/2 -translate-y-1/2"
                  )}
                />
                <span
                  className={cn(
                    "block h-0.5 w-6 bg-foreground transition-all duration-300",
                    isOpen && "opacity-0"
                  )}
                />
                <span
                  className={cn(
                    "block h-0.5 w-6 bg-foreground transition-all duration-300",
                    isOpen && "absolute -rotate-45 top-1/2 -translate-y-1/2"
                  )}
                />
              </div>
            </button>
          </div>

          {/* Mobile Navigation */}
          <div
            className={cn(
              "lg:hidden overflow-hidden transition-all duration-300 ease-out",
              isOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="py-6 border-t border-border">
              <div className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="px-4 py-3 text-sm font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground hover:bg-background-secondary transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="flex flex-col gap-3 pt-6 mt-6 border-t border-border">
                <Link href="/login" className="w-full">
                  <button className="btn-sharp btn-sharp-outline w-full px-6 py-3 text-sm">
                    Login
                  </button>
                </Link>
                <Link href="/signup" className="w-full">
                  <button className="btn-sharp btn-sharp-white w-full px-6 py-3 text-sm">
                    Start Challenge
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
