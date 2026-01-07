"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { plansApi, accountsApi, type EvaluationPlan } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Check,
  Sparkles,
  ArrowLeft,
  Loader2,
  CreditCard,
  Zap,
  Flame,
  Layers,
  AlertTriangle,
} from "lucide-react";

type PlanType = "classic" | "turbo" | "2-step";

export default function NewAccountPage() {
  const [plans, setPlans] = useState<EvaluationPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [planType, setPlanType] = useState<PlanType>("classic");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadPlans() {
      try {
        const response = await plansApi.list();
        if (response.success && response.data?.plans) {
          setPlans(response.data.plans);
        }
      } catch (error) {
        console.error("Failed to load plans:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadPlans();
  }, []);

  // Filter plans based on selected type
  const filteredPlans = plans.filter((plan) => {
    if (!plan.isActive) return false;
    
    if (planType === "classic") {
      return plan.evaluationType === "1-STEP" && plan.accountTier === "CLASSIC";
    } else if (planType === "turbo") {
      return plan.evaluationType === "1-STEP" && plan.accountTier === "TURBO";
    } else {
      return plan.evaluationType === "2-STEP";
    }
  }).sort((a, b) => a.accountSize - b.accountSize);

  const handlePurchase = async () => {
    if (!selectedPlan) return;

    setIsPurchasing(true);
    try {
      const response = await accountsApi.create(String(selectedPlan));
      if (response.success && response.data?.account) {
        router.push(`/dashboard/accounts/${response.data.account.id}`);
      }
    } catch (error) {
      console.error("Failed to create account:", error);
    } finally {
      setIsPurchasing(false);
    }
  };

  // Reset selection when changing plan type
  useEffect(() => {
    setSelectedPlan(null);
  }, [planType]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-muted rounded w-24" />
                  <div className="h-8 bg-muted rounded w-32" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-10 bg-muted rounded w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const planDescriptions: Record<PlanType, { title: string; description: string }> = {
    classic: {
      title: "Classic Challenge",
      description: "Balanced rules with 10% profit target. 4% daily loss, 6% max drawdown.",
    },
    turbo: {
      title: "Turbo Challenge",
      description: "Lower 8% target with tighter 4% drawdown. Get funded faster.",
    },
    "2-step": {
      title: "2-Step Challenge",
      description: "Two phases (4% + 9% targets) with easier rules. Lowest entry fee.",
    },
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="text-2xl font-bold">Start a New Challenge</h1>
        <p className="text-muted-foreground">
          Choose your challenge type and account size
        </p>
      </div>

      {/* 3-Way Plan Type Toggle */}
      <div className="flex flex-col items-center gap-4">
        <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-card border border-border">
          <button
            onClick={() => setPlanType("classic")}
            className={cn(
              "relative px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2",
              planType === "classic"
                ? "bg-primary text-primary-foreground shadow-lg"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Zap className="w-4 h-4" />
            Classic
          </button>
          <button
            onClick={() => setPlanType("turbo")}
            className={cn(
              "relative px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2",
              planType === "turbo"
                ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Flame className="w-4 h-4" />
            Turbo
          </button>
          <button
            onClick={() => setPlanType("2-step")}
            className={cn(
              "relative px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2",
              planType === "2-step"
                ? "bg-primary text-primary-foreground shadow-lg"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="w-4 h-4" />
            2-Step
          </button>
        </div>

        <p className="text-sm text-muted-foreground text-center max-w-md">
          {planDescriptions[planType].description}
        </p>
      </div>

      {/* Plans grid */}
      {filteredPlans.length === 0 ? (
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-warning" />
          <h3 className="text-lg font-semibold mb-2">No Plans Available</h3>
          <p className="text-muted-foreground">
            There are no {planDescriptions[planType].title} plans available at this time.
          </p>
        </Card>
      ) : (
        <div className={cn(
          "grid gap-4",
          filteredPlans.length <= 3 ? "md:grid-cols-3" :
          filteredPlans.length <= 4 ? "md:grid-cols-2 lg:grid-cols-4" :
          filteredPlans.length === 5 ? "md:grid-cols-2 lg:grid-cols-5" :
          "md:grid-cols-2 lg:grid-cols-3"
        )}>
          {filteredPlans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isPopular = plan.accountSize === 10000;

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative cursor-pointer transition-all",
                  isSelected && "border-primary shadow-lg shadow-primary/20",
                  isPopular && !isSelected && "border-primary/30"
                )}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Popular
                    </div>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <CardDescription className="text-sm font-medium uppercase tracking-wider">
                    {plan.name}
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold">
                    ${plan.accountSize.toLocaleString()}
                  </CardTitle>
                  <p className="text-muted-foreground text-sm">Account Size</p>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="text-center py-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-gradient">
                      ${plan.price}
                    </div>
                    <p className="text-sm text-muted-foreground">One-time fee</p>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Profit Target</span>
                      <span className="font-medium text-profit">
                        {planType === "2-step"
                          ? `${plan.profitTargetStep1}% / ${plan.profitTargetStep2}%`
                          : `${plan.profitTargetStep1}%`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Daily Loss Limit</span>
                      <span className="font-medium text-loss">{plan.dailyLossLimit}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Max Drawdown</span>
                      <span className="font-medium text-loss">{plan.maxDrawdown}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Min Trading Days</span>
                      <span className="font-medium">{plan.minTradingDays} days</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Max Leverage</span>
                      <span className="font-medium">{plan.maxLeverage}x</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Profit Split</span>
                      <span className="font-medium text-profit">{plan.profitSplit}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Trailing Drawdown</span>
                      <Badge variant={plan.trailingDrawdown ? "success" : "secondary"} className="text-xs">
                        {plan.trailingDrawdown ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-border">
                    {["Real-time execution", "No time limits", "Weekly payouts"].map(
                      (feature) => (
                        <div key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-profit" />
                          <span>{feature}</span>
                        </div>
                      )
                    )}
                  </div>
                </CardContent>

                <CardFooter>
                  <div
                    className={cn(
                      "w-full h-10 rounded-lg border-2 flex items-center justify-center transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted"
                    )}
                  >
                    {isSelected ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <span className="text-sm text-muted-foreground">Select</span>
                    )}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Purchase button */}
      {selectedPlan && (
        <div className="sticky bottom-4 p-4 bg-card/80 backdrop-blur-xl border border-border rounded-xl shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Selected plan</p>
              <p className="font-semibold">
                ${filteredPlans.find((p) => p.id === selectedPlan)?.accountSize.toLocaleString()}{" "}
                {planDescriptions[planType].title}
              </p>
            </div>
            <Button
              variant="glow"
              size="lg"
              onClick={handlePurchase}
              disabled={isPurchasing}
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Purchase for ${filteredPlans.find((p) => p.id === selectedPlan)?.price}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
