"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Menu,
  X,
  ChevronDown,
  Zap,
  Users,
  Award,
  HelpCircle,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  {
    label: "Features",
    href: "#features",
  },
  {
    label: "Pricing",
    href: "#pricing",
  },
  {
    label: "How It Works",
    href: "#how-it-works",
  },
  {
    label: "Resources",
    href: "#",
    children: [
      { label: "Trading Rules", href: "/rules", icon: BookOpen },
      { label: "FAQ", href: "#faq", icon: HelpCircle },
      { label: "Blog", href: "/blog", icon: MessageSquare },
      { label: "Leaderboard", href: "/leaderboard", icon: Award },
    ],
  },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-fixed transition-all duration-300",
        isScrolled
          ? "bg-background/95 backdrop-blur-xl border-b border-border shadow-lg"
          : "bg-transparent"
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25 transition-transform group-hover:scale-105">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="absolute -inset-1 rounded-xl bg-primary/20 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight">PropFirm</span>
              <span className="text-[10px] text-muted-foreground -mt-0.5 tracking-wider uppercase">
                Crypto Trading
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) =>
              link.children ? (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(link.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button
                    className={cn(
                      "flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                      "text-muted-foreground hover:text-foreground hover:bg-background-tertiary"
                    )}
                  >
                    {link.label}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        openDropdown === link.label && "rotate-180"
                      )}
                    />
                  </button>

                  {/* Dropdown */}
                  {openDropdown === link.label && (
                    <div className="absolute top-full left-0 pt-2 w-56">
                      <div className="rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-xl p-2 animate-fade-in">
                        {link.children.map((child) => (
                          <Link
                            key={child.label}
                            href={child.href}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-background-tertiary transition-colors"
                          >
                            <child.icon className="h-4 w-4" />
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-background-tertiary transition-colors"
                >
                  {link.label}
                </Link>
              )
            )}
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Live traders indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-profit/10 border border-profit/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-profit opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-profit" />
              </span>
              <span className="text-xs font-medium text-profit">
                12,543 Active Traders
              </span>
            </div>

            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log In
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="glow" size="sm" className="shadow-lg">
                Get Funded
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden relative p-2 rounded-lg hover:bg-background-tertiary transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            <div className="relative w-6 h-5 flex flex-col justify-center gap-1.5">
              <span
                className={cn(
                  "block h-0.5 w-6 bg-foreground rounded-full transition-all duration-300",
                  isOpen && "absolute rotate-45 top-1/2 -translate-y-1/2"
                )}
              />
              <span
                className={cn(
                  "block h-0.5 w-6 bg-foreground rounded-full transition-all duration-300",
                  isOpen && "opacity-0"
                )}
              />
              <span
                className={cn(
                  "block h-0.5 w-6 bg-foreground rounded-full transition-all duration-300",
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
            isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="py-4 border-t border-border">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) =>
                link.children ? (
                  <div key={link.label} className="space-y-1">
                    <span className="block px-4 py-2 text-sm font-medium text-foreground">
                      {link.label}
                    </span>
                    <div className="pl-4 space-y-1">
                      {link.children.map((child) => (
                        <Link
                          key={child.label}
                          href={child.href}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setIsOpen(false)}
                        >
                          <child.icon className="h-4 w-4" />
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Link>
                )
              )}
            </div>

            {/* Mobile live indicator */}
            <div className="flex justify-center my-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-profit/10 border border-profit/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-profit opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-profit" />
                </span>
                <span className="text-xs font-medium text-profit">
                  12,543 Active Traders
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-border">
              <Link href="/login" className="flex-1">
                <Button variant="outline" fullWidth>
                  Log In
                </Button>
              </Link>
              <Link href="/signup" className="flex-1">
                <Button variant="glow" fullWidth>
                  Get Funded
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
