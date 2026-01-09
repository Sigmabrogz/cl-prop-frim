"use client";

import { HelpCircle, Mail, MessageSquare, Book, ExternalLink, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const faqs = [
  {
    question: "How do I start trading?",
    answer: "Purchase an evaluation plan, pass the challenge phases, and get funded. Once funded, you can start trading with our capital."
  },
  {
    question: "What are the profit targets?",
    answer: "Profit targets vary by plan. 2-Step challenges typically require 8% in Phase 1 and 5% in Phase 2. Turbo challenges require 10% in a single phase."
  },
  {
    question: "How do payouts work?",
    answer: "Funded traders can request payouts after meeting minimum trading day requirements. Payouts are processed within 24-48 hours and you keep up to 90% of profits."
  },
  {
    question: "What happens if I breach the rules?",
    answer: "If you exceed daily loss limits or maximum drawdown, your account will be breached. You can purchase a new evaluation to try again."
  },
  {
    question: "Can I hold positions overnight?",
    answer: "Yes, overnight and weekend holding is allowed on all our plans. There are no restrictions on holding periods."
  },
  {
    question: "What trading pairs are available?",
    answer: "We offer major crypto pairs including BTC/USDT, ETH/USDT, and other popular altcoins. Check the trading platform for the full list."
  },
];

const resources = [
  {
    title: "Trading Rules",
    description: "Complete guide to our trading rules and requirements",
    icon: Book,
    href: "/rules"
  },
  {
    title: "Knowledge Base",
    description: "Articles and tutorials to improve your trading",
    icon: Book,
    href: "#"
  },
  {
    title: "Discord Community",
    description: "Join our community of traders",
    icon: MessageSquare,
    href: "https://discord.com"
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Help & Support</h1>
        <p className="text-muted-foreground">
          Get help with your account and trading
        </p>
      </div>

      {/* Contact Options */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Email Support</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Get help via email within 24 hours
                </p>
                <Button variant="outline" size="sm">
                  support@propfirm.com
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <MessageSquare className="h-6 w-6 text-blue-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Live Chat</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Chat with our support team in real-time
                </p>
                <Button variant="outline" size="sm">
                  Start Chat
                  <ChevronRight className="ml-2 h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Resources</CardTitle>
          <CardDescription>Helpful guides and community links</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {resources.map((resource) => (
              <a
                key={resource.title}
                href={resource.href}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
              >
                <resource.icon className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{resource.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {resource.description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FAQs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="p-4 rounded-lg border border-border hover:border-primary/30 transition-colors"
              >
                <h4 className="font-medium mb-2">{faq.question}</h4>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Still Need Help */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center">
            <HelpCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <h3 className="font-semibold mb-1">Still need help?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Our support team is available 24/7 to assist you
            </p>
            <Button>
              <Mail className="mr-2 h-4 w-4" />
              Contact Support
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

