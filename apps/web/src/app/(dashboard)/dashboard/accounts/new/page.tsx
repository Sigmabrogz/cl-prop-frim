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
} from "lucide-react";

export default function NewAccountPage() {
  const [plans, setPlans] = useState<EvaluationPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [evaluationType, setEvaluationType] = useState<"1-step" | "2-step">("1-step");
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

  const filteredPlans = plans.filter(
    (plan) => plan.evaluationType === evaluationType && plan.isActive
  );

  const handlePurchase = async () => {
    if (!selectedPlan) return;

    setIsPurchasing(true);
    try {
      const response = await accountsApi.create(selectedPlan);
      if (response.success && response.data?.account) {
        router.push(`/dashboard/accounts/${response.data.account.id}`);
      }
    } catch (error) {
      console.error("Failed to create account:", error);
    } finally {
      setIsPurchasing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
          Choose your account size and evaluation type
        </p>
      </div>

      {/* Evaluation type toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 p-1 rounded-lg bg-muted">
          <button
            onClick={() => setEvaluationType("1-step")}
            className={cn(
              "px-6 py-2 rounded-md text-sm font-medium transition-all",
              evaluationType === "1-step"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            1-Step Challenge
          </button>
          <button
            onClick={() => setEvaluationType("2-step")}
            className={cn(
              "px-6 py-2 rounded-md text-sm font-medium transition-all",
              evaluationType === "2-step"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            2-Step Challenge
          </button>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {evaluationType === "1-step"
          ? "Pass one phase and get funded immediately"
          : "Lower entry fee with two evaluation phases"}
      </p>

      {/* Plans grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredPlans.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          const isPopular = plan.accountSize === 25000;

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
                    <span className="font-medium">
                      {evaluationType === "1-step"
                        ? `${plan.profitTargetStep1}%`
                        : `${plan.profitTargetStep1}% / ${plan.profitTargetStep2}%`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Daily Loss Limit</span>
                    <span className="font-medium">{plan.dailyLossLimit}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Max Drawdown</span>
                    <span className="font-medium">{plan.maxDrawdown}%</span>
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
                </div>

                <div className="space-y-2 pt-4 border-t border-border">
                  {["Real-time execution", "No time limits", "Weekly payouts", "24/7 support"].map(
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

      {/* Purchase button */}
      {selectedPlan && (
        <div className="sticky bottom-4 p-4 bg-card/80 backdrop-blur-xl border border-border rounded-xl shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Selected plan</p>
              <p className="font-semibold">
                ${filteredPlans.find((p) => p.id === selectedPlan)?.accountSize.toLocaleString()} {evaluationType}
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

