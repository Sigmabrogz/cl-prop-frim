"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const footerLinks = {
  product: [
    { label: "Pricing", href: "#pricing" },
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Trading Rules", href: "/rules" },
  ],
  company: [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Careers", href: "/careers" },
    { label: "Contact", href: "/contact" },
  ],
  legal: [
    { label: "Terms", href: "/terms" },
    { label: "Privacy", href: "/privacy" },
    { label: "Risk Disclosure", href: "/risk" },
    { label: "Refund Policy", href: "/refund" },
  ],
  connect: [
    { label: "Twitter", href: "https://twitter.com" },
    { label: "Discord", href: "https://discord.com" },
    { label: "Telegram", href: "https://telegram.org" },
  ],
};

export function Footer() {
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="border-t border-border bg-background-secondary/30">
      <div className="container mx-auto px-4">
        {/* Main Footer Grid */}
        <div className="py-16 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1 mb-8 lg:mb-0">
            <Link href="/" className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 flex items-center justify-center bg-foreground text-background font-bold">
                PF
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight">PROPFIRM</span>
                <span className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase -mt-0.5">
                  CRYPTO TRADING
                </span>
              </div>
            </Link>

            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              Professional crypto prop trading. Trade with funded capital.
              Keep up to 90% of profits. Zero risk to your funds.
            </p>

            {/* Status Indicator */}
            <div className="flex items-center gap-3 p-3 bg-background border border-border">
              <span className="relative flex h-2 w-2">
                <span className="status-online absolute inline-flex h-full w-full bg-profit" />
                <span className="relative inline-flex h-2 w-2 bg-profit" />
              </span>
              <div>
                <div className="text-xs font-medium uppercase tracking-wider">
                  Platform Online
                </div>
                <div className="text-xs text-muted-foreground display-mono">
                  99.9% uptime
                </div>
              </div>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Product
            </h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors ink-spread"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Company
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors ink-spread"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Legal
            </h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors ink-spread"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Connect
            </h4>
            <ul className="space-y-3">
              {footerLinks.connect.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors ink-spread"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground display-mono">
            {year ?? "2025"} PROPFIRM. ALL RIGHTS RESERVED.
          </p>

          <p className="text-xs text-muted-foreground max-w-lg text-center md:text-right">
            Trading involves substantial risk. Past performance does not guarantee future results.
          </p>
        </div>
      </div>
    </footer>
  );
}
