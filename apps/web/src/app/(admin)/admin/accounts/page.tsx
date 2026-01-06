"use client";

import { useEffect, useState, useCallback } from "react";
import { adminApi, type AdminAccount } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import {
  MoreHorizontal,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

export default function AdminAccountsPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false,
  });

  // Breach dialog state
  const [breachDialog, setBreachDialog] = useState<{
    open: boolean;
    accountId: string;
    accountNumber: string;
  }>({ open: false, accountId: "", accountNumber: "" });
  const [breachType, setBreachType] = useState<string>("rule_violation");
  const [breachReason, setBreachReason] = useState("");

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.listAccounts({
        status: statusFilter !== "all" ? statusFilter : undefined,
        accountType: typeFilter !== "all" ? (typeFilter as 'evaluation' | 'funded') : undefined,
        limit: pagination.limit,
        offset: pagination.offset,
      });
      
      if (response.success && response.data) {
        setAccounts(response.data.accounts);
        setStatusCounts(response.data.statusCounts);
        setPagination(prev => ({
          ...prev,
          ...response.data!.pagination,
        }));
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load accounts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, typeFilter, pagination.limit, pagination.offset, toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleActivateAccount = async (accountId: string) => {
    try {
      const response = await adminApi.activateAccount(accountId);
      if (response.success) {
        toast({ title: "Success", description: "Account activated successfully" });
        fetchAccounts();
      } else {
        toast({ title: "Error", description: response.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to activate account", variant: "destructive" });
    }
  };

  const handleSuspendAccount = async (accountId: string) => {
    try {
      const response = await adminApi.suspendAccount(accountId);
      if (response.success) {
        toast({ title: "Success", description: "Account suspended successfully" });
        fetchAccounts();
      } else {
        toast({ title: "Error", description: response.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to suspend account", variant: "destructive" });
    }
  };

  const handleUnsuspendAccount = async (accountId: string) => {
    try {
      const response = await adminApi.unsuspendAccount(accountId);
      if (response.success) {
        toast({ title: "Success", description: "Account unsuspended successfully" });
        fetchAccounts();
      } else {
        toast({ title: "Error", description: response.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to unsuspend account", variant: "destructive" });
    }
  };

  const handleBreachAccount = async () => {
    if (!breachReason.trim()) {
      toast({ title: "Error", description: "Please provide a breach reason", variant: "destructive" });
      return;
    }

    try {
      const response = await adminApi.breachAccount(breachDialog.accountId, {
        breachType,
        reason: breachReason,
      });
      if (response.success) {
        toast({ title: "Success", description: "Account breached successfully" });
        setBreachDialog({ open: false, accountId: "", accountNumber: "" });
        setBreachReason("");
        fetchAccounts();
      } else {
        toast({ title: "Error", description: response.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to breach account", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { className: string; icon: React.ReactNode }> = {
      pending_payment: { className: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: <Clock className="h-3 w-3 mr-1" /> },
      active: { className: "bg-profit/20 text-profit border-profit/30", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      step1_passed: { className: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: <TrendingUp className="h-3 w-3 mr-1" /> },
      passed: { className: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      funded: { className: "bg-primary/20 text-primary border-primary/30", icon: <DollarSign className="h-3 w-3 mr-1" /> },
      breached: { className: "bg-loss/20 text-loss border-loss/30", icon: <XCircle className="h-3 w-3 mr-1" /> },
      expired: { className: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: <Clock className="h-3 w-3 mr-1" /> },
      suspended: { className: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: <Pause className="h-3 w-3 mr-1" /> },
    };
    const config = statusConfig[status] || { className: "", icon: null };
    
    return (
      <Badge className={`flex items-center ${config.className}`}>
        {config.icon}
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Accounts</h1>
          <p className="text-muted-foreground">Manage trading accounts</p>
        </div>
        <Button variant="outline" onClick={fetchAccounts} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {Object.entries(statusCounts).map(([status, count]) => (
          <Card
            key={status}
            className={`cursor-pointer transition-all ${statusFilter === status ? "ring-2 ring-primary" : ""}`}
            onClick={() => {
              setStatusFilter(statusFilter === status ? "all" : status);
              setPagination(prev => ({ ...prev, offset: 0 }));
            }}
          >
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs text-muted-foreground capitalize">{status.replace("_", " ")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select
              value={statusFilter}
              onValueChange={(value: string) => {
                setStatusFilter(value);
                setPagination(prev => ({ ...prev, offset: 0 }));
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending_payment">Pending Payment</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="step1_passed">Step 1 Passed</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="funded">Funded</SelectItem>
                <SelectItem value="breached">Breached</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={typeFilter}
              onValueChange={(value: string) => {
                setTypeFilter(value);
                setPagination(prev => ({ ...prev, offset: 0 }));
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="evaluation">Evaluation</SelectItem>
                <SelectItem value="funded">Funded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Accounts</CardTitle>
          <CardDescription>
            {pagination.total} total accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Daily P&L</TableHead>
                  <TableHead>Trades</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={9}>
                        <div className="h-12 bg-muted/50 rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No accounts found
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((account) => {
                    const dailyPnl = parseFloat(account.dailyPnl);
                    const currentBalance = parseFloat(account.currentBalance);
                    const startingBalance = parseFloat(account.startingBalance);
                    const profit = currentBalance - startingBalance;

                    return (
                      <TableRow key={account.id}>
                        <TableCell>
                          <div>
                            <p className="font-mono font-medium">{account.accountNumber}</p>
                            {account.currentStep > 1 && (
                              <p className="text-xs text-muted-foreground">Step {account.currentStep}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{account.user?.username}</p>
                            <p className="text-xs text-muted-foreground">{account.user?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {account.accountType}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(account.status)}</TableCell>
                        <TableCell className="text-right">
                          <div>
                            <p className="font-medium">{formatCurrency(currentBalance)}</p>
                            <p className={`text-xs ${profit >= 0 ? "text-profit" : "text-loss"}`}>
                              {profit >= 0 ? "+" : ""}{formatCurrency(profit)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={dailyPnl >= 0 ? "text-profit" : "text-loss"}>
                            {dailyPnl >= 0 ? "+" : ""}{formatCurrency(dailyPnl)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <p className="font-medium">{account.totalTrades}</p>
                            <p className="text-xs text-muted-foreground">{account.tradingDays} days</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(account.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {account.status === "pending_payment" && (
                                <DropdownMenuItem
                                  onClick={() => handleActivateAccount(account.id)}
                                  className="text-profit"
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Activate Account
                                </DropdownMenuItem>
                              )}
                              {account.status === "suspended" && (
                                <DropdownMenuItem
                                  onClick={() => handleUnsuspendAccount(account.id)}
                                  className="text-profit"
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Unsuspend Account
                                </DropdownMenuItem>
                              )}
                              {["active", "step1_passed", "passed", "funded"].includes(account.status) && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleSuspendAccount(account.id)}
                                    className="text-amber-400"
                                  >
                                    <Pause className="h-4 w-4 mr-2" />
                                    Suspend Account
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setBreachDialog({
                                      open: true,
                                      accountId: account.id,
                                      accountNumber: account.accountNumber,
                                    })}
                                    className="text-loss"
                                  >
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    Breach Account
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.offset === 0}
                  onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset - prev.limit }))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasMore}
                  onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breach Dialog */}
      <Dialog open={breachDialog.open} onOpenChange={(open: boolean) => setBreachDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-loss">
              <AlertTriangle className="h-5 w-5" />
              Breach Account
            </DialogTitle>
            <DialogDescription>
              You are about to breach account <span className="font-mono font-medium">{breachDialog.accountNumber}</span>. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Breach Type</Label>
              <Select value={breachType} onValueChange={setBreachType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily_loss">Daily Loss Limit</SelectItem>
                  <SelectItem value="max_drawdown">Max Drawdown</SelectItem>
                  <SelectItem value="rule_violation">Rule Violation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                placeholder="Enter the reason for breaching this account..."
                value={breachReason}
                onChange={(e) => setBreachReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBreachDialog({ open: false, accountId: "", accountNumber: "" })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBreachAccount}>
              Breach Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

