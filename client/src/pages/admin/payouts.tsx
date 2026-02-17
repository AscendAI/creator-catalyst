import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, DollarSign, CheckCircle, Clock, Loader2, Plus, CreditCard, XCircle, Trash2, RefreshCw } from "lucide-react";
import { formatUTCDate } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { usePayoutSync } from "@/lib/payout-sync";
import type { Cycle, Payout } from "@shared/schema";
import { useState } from "react";

interface CycleWithPayouts extends Cycle {
  payouts: (Payout & { creatorId: string; creatorEmail: string; creatorName: string | null })[];
  totalPayout: number;
}

export default function AdminPayouts() {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [newCycleDialogOpen, setNewCycleDialogOpen] = useState(false);
  const [newCycleStartDate, setNewCycleStartDate] = useState("");
  const [newCycleEndDate, setNewCycleEndDate] = useState("");
  const [newCycleRecurring, setNewCycleRecurring] = useState(true);
  const [deleteCycleDialogOpen, setDeleteCycleDialogOpen] = useState(false);
  const [deleteCycleId, setDeleteCycleId] = useState<string | null>(null);
  const [refreshCycleDialogOpen, setRefreshCycleDialogOpen] = useState(false);
  const [refreshCycleId, setRefreshCycleId] = useState<string | null>(null);

  const { data: cycles, isLoading } = useQuery<CycleWithPayouts[]>({
    queryKey: ["/api/admin/cycles"],
    enabled: !!token,
  });


  const createCycleMutation = useMutation({
    mutationFn: async ({ startDate, endDate, isRecurring }: { startDate: string; endDate: string; isRecurring?: boolean }) => {
      const response = await apiRequest("POST", "/api/admin/cycles", { startDate, endDate, isRecurring });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cycles"] });
      setNewCycleDialogOpen(false);
      setNewCycleStartDate("");
      setNewCycleEndDate("");
      setNewCycleRecurring(true);
      toast({
        title: "Cycle created",
        description: "A new pay cycle has been created.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create cycle",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const markCyclePaidMutation = useMutation({
    mutationFn: async ({ cycleId, paymentMethod, paymentReference, notes }: { cycleId: string; paymentMethod: string; paymentReference: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/admin/cycles/${cycleId}/mark-paid`, {
        paymentMethod,
        paymentReference,
        notes,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cycles"] });
      setMarkPaidDialogOpen(false);
      setSelectedCycleId(null);
      setPaymentMethod("");
      setPaymentReference("");
      setPaymentNotes("");
      toast({
        title: "Cycle marked as paid",
        description: "All creator payouts in this cycle have been marked as paid.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to mark as paid",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const unmarkCyclePaidMutation = useMutation({
    mutationFn: async (cycleId: string) => {
      const response = await apiRequest("POST", `/api/admin/cycles/${cycleId}/unmark-paid`, {});
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cycles"] });
      toast({
        title: "Cycle unmarked",
        description: "All payouts in this cycle have been marked as unpaid.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to unmark cycle",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteCycleMutation = useMutation({
    mutationFn: async (cycleId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/cycles/${cycleId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cycles"] });
      toast({
        title: "Cycle deleted",
        description: "The pay cycle has been deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Cannot delete cycle",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const { isSyncing, startSyncAndRecalculate } = usePayoutSync();

  const openMarkPaidDialog = (cycleId: string) => {
    setSelectedCycleId(cycleId);
    setMarkPaidDialogOpen(true);
  };

  const handleMarkPaid = () => {
    if (!selectedCycleId) return;
    markCyclePaidMutation.mutate({
      cycleId: selectedCycleId,
      paymentMethod,
      paymentReference,
      notes: paymentNotes,
    });
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Payouts & Cycles</h1>
          <p className="text-muted-foreground">
            Manage 2-week pay cycles and calculate creator payouts.
          </p>
        </div>
        <Button
          onClick={() => setNewCycleDialogOpen(true)}
          data-testid="button-create-cycle"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Cycle
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Pay Cycles
          </CardTitle>
          <CardDescription>
            {cycles?.length || 0} cycles created
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!cycles || cycles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No cycles yet</h3>
              <p className="text-muted-foreground max-w-sm mb-4">
                Create your first 2-week pay cycle to start tracking creator payouts.
              </p>
              <Button
                onClick={() => setNewCycleDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Cycle
              </Button>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-4">
              {cycles.map((cycle) => (
                <AccordionItem
                  key={cycle.id}
                  value={String(cycle.id)}
                  className="border rounded-lg px-4"
                  data-testid={`cycle-${cycle.id}`}
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full mr-4">
                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <div className="font-semibold">
                            {formatUTCDate(String(cycle.startDate), "MMM d")} -{" "}
                            {formatUTCDate(String(cycle.endDate), "MMM d, yyyy")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {cycle.payouts.length} creator payouts
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono font-semibold">
                            {formatCurrency(cycle.totalPayout)}
                          </div>
                          <div className="text-xs text-muted-foreground">Total payout</div>
                        </div>
                        {(() => {
                          if (cycle.paidAt) {
                            return (
                              <Badge variant="secondary" className="gap-1 bg-chart-2/20 text-chart-2">
                                <CheckCircle className="w-3 h-3" />
                                Paid
                              </Badge>
                            );
                          }
                          const now = new Date();
                          const cycleStart = new Date(cycle.startDate);
                          const cycleEnd = new Date(cycle.endDate);
                          if (cycleStart > now) {
                            return (
                              <Badge variant="secondary" className="gap-1 bg-gray-500/20 text-gray-500">
                                <Clock className="w-3 h-3" />
                                Upcoming
                              </Badge>
                            );
                          } else if (now >= cycleStart && now <= cycleEnd) {
                            return (
                              <Badge variant="secondary" className="gap-1 bg-blue-500/20 text-blue-500">
                                <Clock className="w-3 h-3" />
                                Ongoing
                              </Badge>
                            );
                          } else {
                            return (
                              <Badge variant="secondary" className="gap-1 bg-chart-4/20 text-chart-4">
                                <CheckCircle className="w-3 h-3" />
                                Past
                              </Badge>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        {!cycle.paidAt && cycle.payouts.length > 0 && (() => {
                          const isPast = new Date(cycle.endDate) < new Date();
                          return (
                            <Button
                              variant={isPast ? "default" : "outline"}
                              onClick={() => isPast && openMarkPaidDialog(String(cycle.id))}
                              disabled={!isPast}
                              className={!isPast ? "opacity-40 cursor-not-allowed" : ""}
                              data-testid={`button-mark-paid-${cycle.id}`}
                            >
                              <CreditCard className="w-4 h-4 mr-2" />
                              Mark as Paid
                            </Button>
                          );
                        })()}
                        {cycle.paidAt && (
                          <Button
                            variant="outline"
                            onClick={() => unmarkCyclePaidMutation.mutate(String(cycle.id))}
                            disabled={unmarkCyclePaidMutation.isPending}
                            data-testid={`button-unmark-paid-${cycle.id}`}
                          >
                            {unmarkCyclePaidMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4 mr-2" />
                            )}
                            Unmark as Paid
                          </Button>
                        )}
                        {!cycle.paidAt && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setRefreshCycleId(String(cycle.id));
                              setRefreshCycleDialogOpen(true);
                            }}
                            disabled={isSyncing}
                          >
                            {isSyncing ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4 mr-2" />
                            )}
                            Sync & Recalculate
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          onClick={() => {
                            setDeleteCycleId(String(cycle.id));
                            setDeleteCycleDialogOpen(true);
                          }}
                          disabled={deleteCycleMutation.isPending}
                        >
                          {deleteCycleMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                          )}
                          Delete Cycle
                        </Button>
                      </div>

                      {cycle.payouts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-3">
                          <p>No payouts for this cycle yet.</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cycle.payouts.map((payout) => (
                              <TableRow 
                                key={payout.id} 
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => navigate(`/admin/creators/${payout.creatorId}?from=payouts`)}
                                data-testid={`payout-row-${payout.id}`}
                              >
                                <TableCell className="font-medium">{payout.creatorName || ''}</TableCell>
                                <TableCell className="text-muted-foreground">{payout.creatorEmail}</TableCell>
                                <TableCell className="text-right font-mono tabular-nums font-medium">
                                  {formatCurrency(payout.amount)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {payout.paidAt ? (
                                    <Badge variant="secondary" className="bg-chart-2/20 text-chart-2">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Paid
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="bg-chart-4/20 text-chart-4">
                                      <Clock className="w-3 h-3 mr-1" />
                                      Pending
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Dialog open={newCycleDialogOpen} onOpenChange={setNewCycleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Pay Cycle</DialogTitle>
            <DialogDescription>
              Choose the start and end dates for this pay cycle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cycle-start">Start Date</Label>
              <Input
                id="cycle-start"
                type="date"
                value={newCycleStartDate}
                onChange={(e) => setNewCycleStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycle-end">End Date</Label>
              <Input
                id="cycle-end"
                type="date"
                value={newCycleEndDate}
                onChange={(e) => setNewCycleEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="cycle-recurring"
                checked={newCycleRecurring}
                onChange={(e) => setNewCycleRecurring(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-sky-500 cursor-pointer"
              />
              <Label htmlFor="cycle-recurring" className="text-sm cursor-pointer select-none">
                Make this a recurring cycle
              </Label>
            </div>
            {newCycleRecurring && newCycleStartDate && newCycleEndDate && (
              <p className="text-xs text-muted-foreground pl-6">
                A new cycle of the same duration will be automatically created when this one ends.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCycleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newCycleStartDate || !newCycleEndDate) {
                  toast({ title: "Missing dates", description: "Please select both a start and end date.", variant: "destructive" });
                  return;
                }
                const start = new Date(newCycleStartDate + "T00:00:00Z");
                const end = new Date(newCycleEndDate + "T23:59:59Z");
                const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                if (durationDays < 2) {
                  toast({ title: "Cycle too short", description: "A pay cycle must be at least 2 days long.", variant: "destructive" });
                  return;
                }
                if (durationDays > 31) {
                  toast({ title: "Cycle too long", description: "A pay cycle cannot be longer than 31 days.", variant: "destructive" });
                  return;
                }
                createCycleMutation.mutate({ startDate: newCycleStartDate, endDate: newCycleEndDate, isRecurring: newCycleRecurring });
              }}
              disabled={createCycleMutation.isPending}
            >
              {createCycleMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Create Cycle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={markPaidDialogOpen} onOpenChange={setMarkPaidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Cycle as Paid</DialogTitle>
            <DialogDescription>
              Record payment details for this pay cycle. All creator payouts in this cycle will be marked as paid.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Input
                id="paymentMethod"
                placeholder="e.g., Bank Transfer, PayPal, Wise"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                data-testid="input-payment-method"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentReference">Payment Reference (Optional)</Label>
              <Input
                id="paymentReference"
                placeholder="e.g., Transaction ID, Batch number"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                data-testid="input-payment-reference"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentNotes">Notes (Optional)</Label>
              <Textarea
                id="paymentNotes"
                placeholder="Any additional notes about this payment..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                data-testid="input-payment-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMarkPaid}
              disabled={markCyclePaidMutation.isPending}
              data-testid="button-confirm-mark-paid"
            >
              {markCyclePaidMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refreshCycleDialogOpen} onOpenChange={setRefreshCycleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Sync & Recalculate Payouts
            </DialogTitle>
            <DialogDescription className="pt-2 space-y-3">
              <span className="block font-semibold text-foreground">Are you sure you want to sync & recalculate payouts?</span>
              <span className="block">This will unfreeze the payout cycle, fetch the latest video data and views for all creators from Instagram and TikTok, and recalculate all payouts.</span>
              <span className="block text-sm text-muted-foreground">Once the process is complete, the payout cycle will be frozen again automatically.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRefreshCycleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (refreshCycleId) {
                  setRefreshCycleDialogOpen(false);
                  startSyncAndRecalculate(refreshCycleId);
                }
              }}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Yes, Sync & Recalculate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteCycleDialogOpen} onOpenChange={setDeleteCycleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Pay Cycle
            </DialogTitle>
            <DialogDescription className="pt-2 space-y-3">
              <span className="block font-semibold text-foreground">Are you sure you want to delete this pay cycle?</span>
              <span className="block">This will permanently delete:</span>
              <span className="block pl-2">- All payout records for every creator in this cycle</span>
              <span className="block pl-2">- All video performance snapshots tied to this cycle</span>
              <span className="block pl-2">- The pay cycle itself</span>
              <span className="block font-semibold text-destructive mt-2">This action cannot be undone.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteCycleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteCycleId) {
                  deleteCycleMutation.mutate(deleteCycleId);
                  setDeleteCycleDialogOpen(false);
                  setDeleteCycleId(null);
                }
              }}
              disabled={deleteCycleMutation.isPending}
            >
              {deleteCycleMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Yes, Delete Cycle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
