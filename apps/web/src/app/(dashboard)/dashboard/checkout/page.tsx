"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { plansApi, accountsApi, type EvaluationPlan } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Loader2,
  CreditCard,
  Bitcoin,
  CheckCircle2,
  Shield,
  Clock,
  Zap,
  AlertCircle,
  Lock,
} from "lucide-react";

type PaymentMethod = "card" | "crypto" | null;

export default function CheckoutPage() {
  const [plan, setPlan] = useState<EvaluationPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan");

  useEffect(() => {
    async function loadPlan() {
      if (!planId) {
        setError("No plan selected");
        setIsLoading(false);
        return;
      }

      try {
        const response = await plansApi.list();
        if (response.success && response.data?.plans) {
          const selectedPlan = response.data.plans.find(
            (p) => p.id === parseInt(planId)
          );
          if (selectedPlan) {
            setPlan(selectedPlan);
          } else {
            setError("Plan not found");
          }
        }
      } catch (err) {
        console.error("Failed to load plan:", err);
        setError("Failed to load plan details");
      } finally {
        setIsLoading(false);
      }
    }
    loadPlan();
  }, [planId]);

  const handleCompletePurchase = async () => {
    if (!plan) return;

    setIsPurchasing(true);
    try {
      const response = await accountsApi.create(plan.id);
      if (response.success && response.data?.account) {
        // Redirect to account page with success message
        router.push(`/dashboard/accounts/${response.data.account.id}?new=true`);
      } else {
        setError(response.error || "Failed to create account");
      }
    } catch (err) {
      console.error("Failed to create account:", err);
      setError("Failed to complete purchase");
    } finally {
      setIsPurchasing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Error</h3>
          <p className="text-muted-foreground mb-4">{error || "Plan not found"}</p>
          <Button onClick={() => router.push("/dashboard/accounts/new")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Plans
          </Button>
        </Card>
      </div>
    );
  }

  const getPlanTypeLabel = () => {
    if (plan.evaluationType === "2-STEP") return "2-Step Challenge";
    if (plan.accountTier === "TURBO") return "Turbo Challenge";
    return "Classic Challenge";
  };

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="text-2xl font-bold">Complete Your Purchase</h1>
        <p className="text-muted-foreground">
          Review your order and select a payment method
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order Summary - Left Side */}
        <div className="lg:col-span-2 space-y-6">
          {/* Plan Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Plan Name & Type */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-xl">{plan.name}</h3>
                  <Badge
                    variant={plan.accountTier === "TURBO" ? "warning" : "secondary"}
                    className="mt-1"
                  >
                    {getPlanTypeLabel()}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">${plan.accountSize.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Account Size</p>
                </div>
              </div>

              <div className="border-t border-border my-4" />

              {/* Plan Rules */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Profit Target</span>
                  <span className="font-medium text-profit">
                    {plan.evaluationType === "2-STEP"
                      ? `${plan.profitTargetStep1}% / ${plan.profitTargetStep2}%`
                      : `${plan.profitTargetStep1}%`}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Daily Loss Limit</span>
                  <span className="font-medium text-loss">{plan.dailyLossLimit}%</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Max Drawdown</span>
                  <span className="font-medium text-loss">{plan.maxDrawdown}%</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Max Leverage</span>
                  <span className="font-medium">{plan.maxLeverage}x</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Min Trading Days</span>
                  <span className="font-medium">{plan.minTradingDays} days</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Profit Split</span>
                  <span className="font-medium text-profit">{plan.profitSplit}%</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Trailing Drawdown</span>
                  <Badge variant={plan.trailingDrawdown ? "success" : "secondary"} className="text-xs">
                    {plan.trailingDrawdown ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Method</CardTitle>
              <CardDescription>Select how you want to pay</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Credit Card Option */}
              <button
                onClick={() => setPaymentMethod("card")}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
                  paymentMethod === "card"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className={cn(
                  "p-3 rounded-lg",
                  paymentMethod === "card" ? "bg-primary/10" : "bg-muted"
                )}>
                  <CreditCard className={cn(
                    "h-6 w-6",
                    paymentMethod === "card" ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">Credit / Debit Card</p>
                  <p className="text-sm text-muted-foreground">
                    Visa, Mastercard, American Express
                  </p>
                </div>
                {paymentMethod === "card" && (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                )}
              </button>

              {/* Crypto Option */}
              <button
                onClick={() => setPaymentMethod("crypto")}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
                  paymentMethod === "crypto"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className={cn(
                  "p-3 rounded-lg",
                  paymentMethod === "crypto" ? "bg-primary/10" : "bg-muted"
                )}>
                  <Bitcoin className={cn(
                    "h-6 w-6",
                    paymentMethod === "crypto" ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">Cryptocurrency</p>
                  <p className="text-sm text-muted-foreground">
                    Bitcoin, Ethereum, USDT
                  </p>
                </div>
                {paymentMethod === "crypto" && (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                )}
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Price Summary - Right Side */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg">Price Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Evaluation Fee</span>
                  <span>${plan.price}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Processing Fee</span>
                  <span className="text-profit">$0.00</span>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total</span>
                  <span className="text-2xl font-bold">${plan.price}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  One-time payment
                </p>
              </div>

              <Button
                variant="glow"
                size="lg"
                fullWidth
                onClick={handleCompletePurchase}
                disabled={isPurchasing}
              >
                {isPurchasing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Complete Purchase
                  </>
                )}
              </Button>

              {/* Mock payment notice */}
              <p className="text-xs text-center text-muted-foreground">
                Demo mode - Account activates instantly
              </p>

              {/* Trust Indicators */}
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-4 w-4 text-profit" />
                  <span>Secure 256-bit SSL encryption</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-4 w-4 text-profit" />
                  <span>Instant account activation</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Zap className="h-4 w-4 text-profit" />
                  <span>Start trading immediately</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
