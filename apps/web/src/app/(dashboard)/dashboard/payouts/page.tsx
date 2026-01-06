"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { payoutsApi, type Payout, type PayoutStats, type WithdrawableAccount } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Wallet,
  DollarSign,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Bitcoin,
  Building2,
  History,
  Calendar,
  Loader2,
  Info,
  RefreshCw,
} from "lucide-react";

type PayoutMethod = "crypto_usdt" | "crypto_btc" | "bank_wire";

export default function PayoutsPage() {
  const { user } = useAuth();
  
  // Data state
  const [accounts, setAccounts] = useState<WithdrawableAccount[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<Payout[]>([]);
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form state
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("crypto_usdt");
  const [cryptoAddress, setCryptoAddress] = useState("");
  const [bankDetails, setBankDetails] = useState({
    accountName: "",
    accountNumber: "",
    routingNumber: "",
    bankName: "",
  });
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState("");

  const selectedAccountData = accounts.find((a) => a.accountId === selectedAccount);
  const totalWithdrawable = accounts.reduce((sum, acc) => sum + acc.withdrawable, 0);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [accountsRes, payoutsRes, statsRes] = await Promise.all([
        payoutsApi.getAccounts(),
        payoutsApi.list(),
        payoutsApi.getStats(),
      ]);

      if (accountsRes.success && accountsRes.data) {
        setAccounts(accountsRes.data.accounts);
      }
      if (payoutsRes.success && payoutsRes.data) {
        setPayoutHistory(payoutsRes.data.payouts);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data.stats);
      }
    } catch (err) {
      console.error("Failed to load payout data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleSubmitPayout = async () => {
    if (!selectedAccount || !withdrawAmount) return;

    setIsSubmitting(true);
    setError("");

    // Build destination address based on method
    let destinationAddress = "";
    if (payoutMethod === "bank_wire") {
      destinationAddress = JSON.stringify({
        accountName: bankDetails.accountName,
        accountNumber: bankDetails.accountNumber,
        routingNumber: bankDetails.routingNumber,
        bankName: bankDetails.bankName,
      });
    } else {
      destinationAddress = cryptoAddress;
    }

    const response = await payoutsApi.create({
      accountId: selectedAccount,
      amount: parseFloat(withdrawAmount),
      payoutMethod,
      destinationAddress,
      destinationNetwork: payoutMethod === "crypto_usdt" ? "TRC20" : undefined,
    });

    if (response.success) {
      setShowSuccess(true);
      setWithdrawAmount("");
      setCryptoAddress("");
      setBankDetails({ accountName: "", accountNumber: "", routingNumber: "", bankName: "" });
      await loadData(); // Refresh data
      setTimeout(() => setShowSuccess(false), 5000);
    } else {
      setError(response.error || "Failed to submit payout request");
    }

    setIsSubmitting(false);
  };

  const handleCancelPayout = async (payoutId: string) => {
    const response = await payoutsApi.cancel(payoutId);
    if (response.success) {
      await loadData();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "pending":
        return <Badge variant="warning"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="info"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "processing":
        return <Badge variant="info"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getMethodIcon = (method: string) => {
    if (method.startsWith("crypto")) {
      return (
        <div className="p-2 rounded-lg bg-orange-500/10">
          <Bitcoin className="h-4 w-4 text-orange-500" />
        </div>
      );
    }
    return (
      <div className="p-2 rounded-lg bg-blue-500/10">
        <Building2 className="h-4 w-4 text-blue-500" />
      </div>
    );
  };

  const formatMethod = (method: string) => {
    switch (method) {
      case "crypto_usdt": return "USDT (TRC20)";
      case "crypto_btc": return "Bitcoin";
      case "crypto_eth": return "Ethereum";
      case "bank_wire": return "Bank Transfer";
      default: return method;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payouts</h1>
          <p className="text-muted-foreground">Withdraw your profits from funded accounts</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available to Withdraw</p>
                <p className="text-2xl font-bold text-profit">{formatCurrency(totalWithdrawable)}</p>
              </div>
              <div className="p-3 rounded-full bg-profit/10">
                <Wallet className="h-6 w-6 text-profit" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Paid Out</p>
                <p className="text-2xl font-bold">{formatCurrency(stats?.totalPaidOut || 0)}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Payouts</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {formatCurrency(stats?.pendingAmount || 0)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-yellow-500/10">
                <Clock className="h-6 w-6 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Payout */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5" />
              Request Payout
            </CardTitle>
            <CardDescription>Withdraw profits from your funded accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {showSuccess && (
              <div className="p-4 rounded-lg bg-profit/10 border border-profit/20 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-profit" />
                <div>
                  <p className="font-medium text-profit">Payout Request Submitted!</p>
                  <p className="text-sm text-muted-foreground">
                    Your request is being processed. Expected completion: 24-48 hours.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-lg bg-loss/10 border border-loss/20 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-loss" />
                <div>
                  <p className="font-medium text-loss">Error</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </div>
            )}

            {/* Select Account */}
            <div className="space-y-3">
              <Label>Select Funded Account</Label>
              {accounts.length === 0 ? (
                <div className="p-4 rounded-lg border border-border text-center">
                  <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No funded accounts available for withdrawal
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <button
                      key={account.accountId}
                      onClick={() => setSelectedAccount(account.accountId)}
                      className={cn(
                        "w-full p-4 rounded-lg border text-left transition-colors",
                        selectedAccount === account.accountId
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-border/80 hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{account.accountNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            Balance: {formatCurrency(account.balance)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-profit">
                            {formatCurrency(account.withdrawable)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {account.profitSplit}% profit split
                          </p>
                        </div>
                      </div>
                      {account.pendingAmount && account.pendingAmount > 0 && (
                        <p className="text-xs text-yellow-500 mt-1">
                          Pending: {formatCurrency(account.pendingAmount)}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedAccount && (
              <>
                {/* Payout Method */}
                <div className="space-y-3">
                  <Label>Payout Method</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPayoutMethod("crypto_usdt")}
                      className={cn(
                        "p-4 rounded-lg border flex items-center gap-3 transition-colors",
                        payoutMethod === "crypto_usdt"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-border/80"
                      )}
                    >
                      <Bitcoin className="h-5 w-5 text-orange-500" />
                      <div className="text-left">
                        <p className="font-medium">USDT (TRC20)</p>
                        <p className="text-xs text-muted-foreground">Instant - 24hrs</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setPayoutMethod("bank_wire")}
                      className={cn(
                        "p-4 rounded-lg border flex items-center gap-3 transition-colors",
                        payoutMethod === "bank_wire"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-border/80"
                      )}
                    >
                      <Building2 className="h-5 w-5 text-blue-500" />
                      <div className="text-left">
                        <p className="font-medium">Bank Transfer</p>
                        <p className="text-xs text-muted-foreground">3-5 business days</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Withdrawal Amount</Label>
                    <button
                      onClick={() => setWithdrawAmount(selectedAccountData?.withdrawable.toString() || "")}
                      className="text-xs text-primary hover:underline"
                    >
                      Max: {formatCurrency(selectedAccountData?.withdrawable || 0)}
                    </button>
                  </div>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Payment Details */}
                {payoutMethod.startsWith("crypto") ? (
                  <div className="space-y-3">
                    <Label>USDT Wallet Address (TRC20)</Label>
                    <Input
                      value={cryptoAddress}
                      onChange={(e) => setCryptoAddress(e.target.value)}
                      placeholder="T..."
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Only send to TRC20 network addresses
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Account Holder Name</Label>
                        <Input
                          value={bankDetails.accountName}
                          onChange={(e) => setBankDetails({ ...bankDetails, accountName: e.target.value })}
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Bank Name</Label>
                        <Input
                          value={bankDetails.bankName}
                          onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                          placeholder="Chase Bank"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Account Number</Label>
                        <Input
                          value={bankDetails.accountNumber}
                          onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                          placeholder="****1234"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Routing Number</Label>
                        <Input
                          value={bankDetails.routingNumber}
                          onChange={(e) => setBankDetails({ ...bankDetails, routingNumber: e.target.value })}
                          placeholder="021000021"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSubmitPayout}
                  disabled={
                    isSubmitting ||
                    !withdrawAmount ||
                    Number(withdrawAmount) < 100 ||
                    Number(withdrawAmount) > (selectedAccountData?.withdrawable || 0) ||
                    (payoutMethod.startsWith("crypto") && !cryptoAddress) ||
                    (payoutMethod === "bank_wire" && (!bankDetails.accountName || !bankDetails.accountNumber))
                  }
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="h-4 w-4 mr-2" />
                      Request Payout
                    </>
                  )}
                </Button>

                {/* Info */}
                <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Minimum withdrawal: $100 | Processing fee: 0%
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Payout History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Payout History
            </CardTitle>
            <CardDescription>Your recent withdrawal requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payoutHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No payout history yet</p>
                </div>
              ) : (
                payoutHistory.map((payout) => (
                  <div
                    key={payout.id}
                    className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {getMethodIcon(payout.payoutMethod)}
                        <div>
                          <p className="font-medium">{formatCurrency(payout.requestedAmount)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatMethod(payout.payoutMethod)} · {payout.accountNumber || payout.accountId.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(payout.status)}
                        {payout.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelPayout(payout.id)}
                            className="text-loss hover:text-loss hover:bg-loss/10"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Requested: {formatDate(payout.createdAt)}</span>
                      {payout.processedAt && (
                        <span>Completed: {formatDate(payout.processedAt)}</span>
                      )}
                    </div>
                    {payout.status === "rejected" && payout.rejectionReason && (
                      <div className="mt-2 p-2 rounded bg-loss/10 text-loss text-xs flex items-center gap-2">
                        <AlertCircle className="h-3 w-3" />
                        {payout.rejectionReason}
                      </div>
                    )}
                    {payout.txHash && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        TX: <span className="font-mono">{payout.txHash}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payout Schedule Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Payout Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-profit" />
                Bi-Weekly Payouts
              </div>
              <p className="text-sm text-muted-foreground">
                Request payouts every 14 days after your first profitable trade.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-primary" />
                Profit Split
              </div>
              <p className="text-sm text-muted-foreground">
                Keep 80-90% of your profits. Higher splits available for consistent traders.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                Processing Time
              </div>
              <p className="text-sm text-muted-foreground">
                Crypto: 24 hours | Bank: 3-5 business days
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
