"use client";

import { useEffect, useState, useCallback } from "react";
import { adminApi, type AdminPayout } from "@/lib/api";
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
import { formatCurrency, cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  MoreHorizontal,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Copy,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Send,
} from "lucide-react";

export default function AdminPayoutsPage() {
  const { toast } = useToast();
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false,
  });

  // Action dialog state
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: "reject" | "complete" | null;
    payoutId: string;
    payoutAmount: string;
  }>({ open: false, type: null, payoutId: "", payoutAmount: "" });
  const [rejectReason, setRejectReason] = useState("");
  const [txHash, setTxHash] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchPayouts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.listPayouts({
        status: statusFilter !== "all" ? (statusFilter as 'pending' | 'approved' | 'processing' | 'completed' | 'rejected') : undefined,
        limit: pagination.limit,
        offset: pagination.offset,
      });
      
      if (response.success && response.data) {
        setPayouts(response.data.payouts);
        setPendingCount(response.data.pendingCount);
        setPagination(prev => ({
          ...prev,
          ...response.data!.pagination,
        }));
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load payouts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, pagination.limit, pagination.offset, toast]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const handleApprovePayout = async (payoutId: string) => {
    setIsProcessing(true);
    try {
      const response = await adminApi.approvePayout(payoutId);
      if (response.success) {
        toast({ title: "Success", description: "Payout approved successfully" });
        fetchPayouts();
      } else {
        toast({ title: "Error", description: response.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to approve payout", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessPayout = async (payoutId: string) => {
    setIsProcessing(true);
    try {
      const response = await adminApi.processPayout(payoutId);
      if (response.success) {
        toast({ title: "Success", description: "Payout marked as processing" });
        fetchPayouts();
      } else {
        toast({ title: "Error", description: response.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to process payout", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectPayout = async () => {
    if (!rejectReason.trim()) {
      toast({ title: "Error", description: "Please provide a rejection reason", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await adminApi.rejectPayout(actionDialog.payoutId, rejectReason);
      if (response.success) {
        toast({ title: "Success", description: "Payout rejected successfully" });
        setActionDialog({ open: false, type: null, payoutId: "", payoutAmount: "" });
        setRejectReason("");
        fetchPayouts();
      } else {
        toast({ title: "Error", description: response.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to reject payout", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompletePayout = async () => {
    setIsProcessing(true);
    try {
      const response = await adminApi.completePayout(actionDialog.payoutId, txHash || undefined);
      if (response.success) {
        toast({ title: "Success", description: "Payout completed successfully" });
        setActionDialog({ open: false, type: null, payoutId: "", payoutAmount: "" });
        setTxHash("");
        fetchPayouts();
      } else {
        toast({ title: "Error", description: response.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to complete payout", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Address copied to clipboard" });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { className: string; icon: React.ReactNode }> = {
      pending: { className: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: <Clock className="h-3 w-3 mr-1" /> },
      approved: { className: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      processing: { className: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" /> },
      completed: { className: "bg-profit/20 text-profit border-profit/30", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      rejected: { className: "bg-loss/20 text-loss border-loss/30", icon: <XCircle className="h-3 w-3 mr-1" /> },
    };
    const config = statusConfig[status] || { className: "", icon: null };
    
    return (
      <Badge className={`flex items-center capitalize ${config.className}`}>
        {config.icon}
        {status}
      </Badge>
    );
  };

  const getMethodBadge = (method: string) => {
    const methodLabels: Record<string, string> = {
      crypto_usdt: "USDT",
      crypto_btc: "BTC",
      crypto_eth: "ETH",
      bank_wire: "Bank Wire",
    };
    return (
      <Badge variant="outline" className="font-mono">
        {methodLabels[method] || method}
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
          <h1 className="text-3xl font-bold">Payouts</h1>
          <p className="text-muted-foreground">Manage withdrawal requests</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 px-3 py-1">
              <AlertTriangle className="h-4 w-4 mr-2" />
              {pendingCount} Pending
            </Badge>
          )}
          <Button variant="outline" onClick={fetchPayouts} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {["all", "pending", "approved", "processing", "completed", "rejected"].map((status) => (
          <Card
            key={status}
            className={cn(
              "cursor-pointer transition-all",
              statusFilter === status ? "ring-2 ring-primary" : ""
            )}
            onClick={() => {
              setStatusFilter(status);
              setPagination(prev => ({ ...prev, offset: 0 }));
            }}
          >
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-sm font-medium text-muted-foreground capitalize">{status === "all" ? "All" : status}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payouts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Requests</CardTitle>
          <CardDescription>
            {pagination.total} total requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <div className="h-12 bg-muted/50 rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : payouts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No payouts found
                    </TableCell>
                  </TableRow>
                ) : (
                  payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{payout.user?.username}</p>
                          <p className="text-xs text-muted-foreground">{payout.user?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{payout.account?.accountNumber}</span>
                      </TableCell>
                      <TableCell>{getMethodBadge(payout.payoutMethod)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs truncate max-w-[120px]">
                            {payout.destinationAddress}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(payout.destinationAddress)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <p className="font-medium text-profit">
                            {formatCurrency(parseFloat(payout.netAmount))}
                          </p>
                          {parseFloat(payout.platformFee) > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Fee: {formatCurrency(parseFloat(payout.platformFee))}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(payout.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(payout.createdAt), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={isProcessing}>
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
                            <DropdownMenuItem onClick={() => copyToClipboard(payout.destinationAddress)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Address
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            
                            {payout.status === "pending" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleApprovePayout(payout.id)}
                                  className="text-profit"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setActionDialog({
                                    open: true,
                                    type: "reject",
                                    payoutId: payout.id,
                                    payoutAmount: payout.netAmount,
                                  })}
                                  className="text-loss"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            
                            {payout.status === "approved" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleProcessPayout(payout.id)}
                                  className="text-purple-400"
                                >
                                  <Send className="h-4 w-4 mr-2" />
                                  Mark Processing
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setActionDialog({
                                    open: true,
                                    type: "complete",
                                    payoutId: payout.id,
                                    payoutAmount: payout.netAmount,
                                  })}
                                  className="text-profit"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Mark Complete
                                </DropdownMenuItem>
                              </>
                            )}
                            
                            {payout.status === "processing" && (
                              <DropdownMenuItem
                                onClick={() => setActionDialog({
                                  open: true,
                                  type: "complete",
                                  payoutId: payout.id,
                                  payoutAmount: payout.netAmount,
                                })}
                                className="text-profit"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark Complete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
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

      {/* Reject Dialog */}
      <Dialog 
        open={actionDialog.open && actionDialog.type === "reject"} 
        onOpenChange={(open: boolean) => !open && setActionDialog({ open: false, type: null, payoutId: "", payoutAmount: "" })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-loss">
              <XCircle className="h-5 w-5" />
              Reject Payout
            </DialogTitle>
            <DialogDescription>
              You are about to reject a payout request of <span className="font-medium text-foreground">{formatCurrency(parseFloat(actionDialog.payoutAmount))}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea
                placeholder="Enter the reason for rejecting this payout..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, type: null, payoutId: "", payoutAmount: "" })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRejectPayout} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog 
        open={actionDialog.open && actionDialog.type === "complete"} 
        onOpenChange={(open: boolean) => !open && setActionDialog({ open: false, type: null, payoutId: "", payoutAmount: "" })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-profit">
              <CheckCircle className="h-5 w-5" />
              Complete Payout
            </DialogTitle>
            <DialogDescription>
              Mark this payout of <span className="font-medium text-foreground">{formatCurrency(parseFloat(actionDialog.payoutAmount))}</span> as completed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Transaction Hash (optional)</Label>
              <Input
                placeholder="Enter the transaction hash..."
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                For crypto payouts, enter the blockchain transaction hash for verification.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, type: null, payoutId: "", payoutAmount: "" })}>
              Cancel
            </Button>
            <Button onClick={handleCompletePayout} disabled={isProcessing} className="bg-profit hover:bg-profit/90">
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Complete Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

