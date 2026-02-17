import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Gem, Clock, Users, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface BountyClaim {
  id: string;
  status: string;
  completedAt: string | null;
  approvedAt: string | null;
}

interface Bounty {
  id: string;
  title: string;
  description: string | null;
  reward: string;
  rewardAmount: number;
  startDate: string;
  deadline: string;
  deadlineDate: string;
  slots: string;
  claimedCount: number;
  maxSlots: number;
  priority: string;
  penaltyAmount: number;
  userClaim: BountyClaim | null;
  canClaim: boolean;
}

interface BountyHistoryItem {
  id: number;
  bountyId: number;
  bountyTitle: string;
  bountyReward: string;
  bountyStartDate: string;
  bountyDeadline: string | null;
  status: string;
  isPaid: boolean;
  completedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  penaltyAmount: number;
}

function formatDeadlineCountdown(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

export default function CreatorBounties() {
  const { token } = useAuth();
  const [claimingBountyId, setClaimingBountyId] = useState<string | null>(null);
  const [claimConfirmBounty, setClaimConfirmBounty] = useState<Bounty | null>(null);
  const [view, setView] = useState<"active" | "history">("active");

  const { data: bountiesData, refetch: refetchBounties } = useQuery<Bounty[]>({
    queryKey: ["/api/creator/bounties"],
    queryFn: async () => {
      const res = await fetch("/api/creator/bounties", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch bounties");
      return res.json();
    },
    enabled: !!token,
  });

  const { data: bountyHistory } = useQuery<BountyHistoryItem[]>({
    queryKey: ["/api/creator/bounty-history"],
    enabled: !!token && view === "history",
  });

  const allBounties = bountiesData || [];
  const activeBounties = allBounties.filter(
    (b) => !b.deadlineDate || new Date(b.deadlineDate).getTime() > Date.now()
  );
  const expiredBounties = allBounties.filter(
    (b) => b.deadlineDate && new Date(b.deadlineDate).getTime() <= Date.now()
  );

  const handleClaimBounty = async (bountyId: string) => {
    setClaimingBountyId(bountyId);
    try {
      const res = await fetch(`/api/creator/bounties/${bountyId}/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || "Failed to claim bounty");
        return;
      }
      refetchBounties();
    } catch {
      alert("Failed to claim bounty");
    } finally {
      setClaimingBountyId(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500";
      case "medium":
        return "bg-yellow-500";
      default:
        return "bg-green-500";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
            <Gem className="w-5 h-5 text-sky-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Bounty Board</h1>
            <p className="text-sm text-muted-foreground">
              Complete challenges to earn bonus rewards
            </p>
          </div>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setView("active")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === "active"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setView("history")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === "history"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My History
          </button>
        </div>
      </div>

      {view === "active" ? (
        <div className="space-y-6">
          {activeBounties.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Gem className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No active bounties right now. Check back soon!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeBounties.map((bounty) => (
                <div
                  key={bounty.id}
                  className="group flex items-center gap-4 p-5 bg-card rounded-xl border hover:border-sky-300 dark:hover:border-sky-500 hover:shadow-lg hover:shadow-sky-100/50 dark:hover:shadow-sky-900/20 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div
                    className={`w-1.5 h-14 rounded-full ${getPriorityColor(bounty.priority)}`}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base">{bounty.title}</h3>
                    {bounty.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {bounty.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-sky-500" />
                        {formatDeadlineCountdown(bounty.deadlineDate)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        {bounty.slots}
                      </span>
                      {bounty.penaltyAmount > 0 && (
                        <span className="text-red-400 text-xs">
                          ${bounty.penaltyAmount.toFixed(2)} deducted if not completed
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-green-500 font-bold text-xl">
                      {bounty.reward}
                    </span>
                    <div className="mt-2">
                      {bounty.userClaim ? (
                        bounty.userClaim.status === "approved" ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Approved
                          </Badge>
                        ) : bounty.userClaim.status === "completed" ? (
                          <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                            Pending Review
                          </Badge>
                        ) : bounty.userClaim.status === "rejected" ? (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="w-3 h-3" />
                            Rejected
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            Claimed
                          </Badge>
                        )
                      ) : bounty.canClaim ? (
                        <Button
                          size="sm"
                          onClick={() => setClaimConfirmBounty(bounty)}
                          disabled={claimingBountyId === bounty.id}
                          className="bg-sky-500 hover:bg-sky-600 text-white"
                        >
                          {claimingBountyId === bounty.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            "Claim"
                          )}
                        </Button>
                      ) : (
                        <Badge variant="secondary">Full</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {expiredBounties.length > 0 && (
            <div>
              <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <span>📋</span> Previous Bounties
                <Badge variant="secondary" className="ml-1">
                  {expiredBounties.length}
                </Badge>
              </h2>
              <div className="space-y-3">
                {expiredBounties.map((bounty) => (
                  <div
                    key={bounty.id}
                    className="flex items-center gap-4 p-4 bg-card rounded-xl border opacity-70"
                  >
                    <div className="w-1.5 h-12 rounded-full bg-muted-foreground/30" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium">{bounty.title}</h3>
                      {bounty.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                          {bounty.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>
                          {bounty.startDate
                            ? new Date(bounty.startDate).toLocaleDateString()
                            : "N/A"}{" "}
                          -{" "}
                          {bounty.deadlineDate
                            ? new Date(
                                bounty.deadlineDate
                              ).toLocaleDateString()
                            : "No deadline"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {bounty.slots}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-muted-foreground font-bold text-lg">
                        {bounty.reward}
                      </span>
                      <div className="mt-1">
                        {bounty.userClaim ? (
                          <Badge
                            variant="secondary"
                            className={
                              bounty.userClaim.status === "approved"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : bounty.userClaim.status === "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : ""
                            }
                          >
                            {bounty.userClaim.status === "approved"
                              ? "Approved"
                              : bounty.userClaim.status === "rejected"
                                ? "Rejected"
                                : bounty.userClaim.status === "completed"
                                  ? "Pending Review"
                                  : "Claimed"}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Expired</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {!bountyHistory || bountyHistory.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Gem className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No bounty history yet. Claim a bounty to get started!
                </p>
              </CardContent>
            </Card>
          ) : (
            bountyHistory.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 bg-card rounded-xl border"
              >
                <div
                  className={`w-1.5 h-12 rounded-full ${
                    item.status === "approved" && item.isPaid
                      ? "bg-green-500"
                      : item.status === "approved"
                        ? "bg-orange-500"
                        : item.status === "completed"
                          ? "bg-yellow-500"
                          : item.status === "rejected"
                            ? "bg-red-500"
                            : "bg-blue-500"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">💎 {item.bountyTitle}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>
                      Claimed{" "}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    {item.bountyDeadline && (
                      <span>
                        Deadline{" "}
                        {new Date(item.bountyDeadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={item.status === "rejected" && item.penaltyAmount > 0 ? "text-red-500 font-bold" : "text-green-500 font-bold"}>
                    {item.status === "rejected" && item.penaltyAmount > 0
                      ? `-$${item.penaltyAmount.toFixed(2)}`
                      : item.bountyReward}
                  </span>
                  <div className="mt-1">
                    {item.status === "approved" ? (
                      <Badge
                        className={
                          item.isPaid
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1"
                            : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 gap-1"
                        }
                      >
                        <CheckCircle className="w-3 h-3" />
                        {item.isPaid ? "Paid" : "Pending Payment"}
                      </Badge>
                    ) : item.status === "completed" ? (
                      <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        Pending Review
                      </Badge>
                    ) : item.status === "rejected" ? (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="w-3 h-3" />
                        {item.penaltyAmount > 0 ? `Rejected (-$${item.penaltyAmount.toFixed(2)})` : "Rejected"}
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        In Progress
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Dialog open={!!claimConfirmBounty} onOpenChange={(open) => !open && setClaimConfirmBounty(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim Bounty</DialogTitle>
            <DialogDescription>
              Are you sure you want to claim "{claimConfirmBounty?.title}"?
            </DialogDescription>
          </DialogHeader>
          {claimConfirmBounty && claimConfirmBounty.penaltyAmount > 0 && (
            <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">
                If your submission is rejected, a penalty of <span className="font-bold">${claimConfirmBounty.penaltyAmount.toFixed(2)}</span> will be deducted from your payout.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setClaimConfirmBounty(null)}>Cancel</Button>
            <Button
              onClick={() => { handleClaimBounty(claimConfirmBounty!.id); setClaimConfirmBounty(null); }}
              disabled={claimingBountyId === claimConfirmBounty?.id}
              className="bg-sky-500 hover:bg-sky-600 text-white"
            >
              {claimingBountyId === claimConfirmBounty?.id ? "Claiming..." : "Confirm Claim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
