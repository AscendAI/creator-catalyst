import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Wallet, AlertTriangle, CheckCircle, Loader2, DollarSign, Calendar, Clock, Eye, Heart, MessageCircle, Video, Instagram, Snowflake, ChevronRight, Ban, Award } from "lucide-react";
import { SiTiktok } from "react-icons/si";
import { formatUTCDate } from "@/lib/date-utils";
import { AnimatedNumber, AnimatedCurrency } from "@/components/ui/animated-number";
import type { PayoutSettings } from "@shared/schema";

interface BonusTier {
  id: string;
  viewThreshold: number;
  bonusAmount: number;
}

const formatViewCount = (views: number): string => {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(views % 1000000 === 0 ? 0 : 1)}M`;
  } else if (views >= 1000) {
    return `${(views / 1000).toFixed(views % 1000 === 0 ? 0 : 1)}K`;
  }
  return views.toString();
};

interface Payout {
  id: string;
  cycleId: string;
  baseAmount: string;
  bonusAmount: string;
  totalAmount: string;
  paidAt: string | null;
  cycle?: {
    startDate: string;
    endDate: string;
  };
}

interface CycleVideo {
  id: string;
  videoId: string;
  platform: string;
  platformVideoId: string;
  caption: string | null;
  thumbnailUrl: string | null;
  views: number;
  likes: number;
  comments: number;
  postedAt: string | null;
  isIrrelevant: boolean | null;
  isEligible: boolean | null;
  isFrozen: boolean;
}

interface CycleVideosData {
  cycle: {
    id: string;
    startDate: string;
    endDate: string;
  };
  videos: CycleVideo[];
  isFrozen: boolean;
}

interface CreatorStats {
  videosThisCycle: number;
  videosThisWeek: number;
  totalViewsThisCycle: number;
  baseEarnings: number;
  bonusEarnings: number;
  totalPayout: number;
  currentCycle: {
    startDate: string;
    endDate: string;
  } | null;
  settings: PayoutSettings;
}

interface TrialStatus {
  trialEndsAt: string | null;
  trialCompleted: boolean;
  accountFlagged: boolean;
  totalViews: number;
  viewGoal: number;
  viewsRemaining: number;
  progressPercent: number;
  daysRemaining: number;
  isInTrial: boolean;
  trialDays: number;
}

interface AllTimeStats {
  totalVideos: number;
  totalViews: number;
  totalEarnings: number;
  totalBaseEarnings: number;
  totalBonusEarnings: number;
}

export default function CreatorPayouts() {
  const { user, refreshUser, token } = useAuth();
  const { toast } = useToast();
  const [paypalEmail, setPaypalEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [showAllTime, setShowAllTime] = useState(() => {
    return sessionStorage.getItem('dashboard-showAllTime') === 'true';
  });
  
  useEffect(() => {
    sessionStorage.setItem('dashboard-showAllTime', showAllTime.toString());
  }, [showAllTime]);

  const { data: stats, isLoading: statsLoading } = useQuery<CreatorStats>({
    queryKey: ["/api/creator/stats"],
    enabled: !!token,
  });

  const { data: trialStatus, isLoading: trialLoading } = useQuery<TrialStatus>({
    queryKey: ["/api/creator/trial-status"],
    enabled: !!token,
  });

  const { data: allTimeStats, isLoading: allTimeLoading } = useQuery<AllTimeStats>({
    queryKey: ["/api/creator/stats/all-time"],
    enabled: !!token && showAllTime,
  });

  const { data: payouts, isLoading: payoutsLoading } = useQuery<Payout[]>({
    queryKey: ["/api/creator/payouts"],
  });

  const { data: cycleVideosData, isLoading: cycleVideosLoading } = useQuery<CycleVideosData>({
    queryKey: ["/api/creator/cycle", selectedPayout?.cycleId, "videos"],
    queryFn: async () => {
      const res = await fetch(`/api/creator/cycle/${selectedPayout!.cycleId}/videos`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch cycle videos");
      return res.json();
    },
    enabled: !!selectedPayout,
  });

  const { data: bonusTiers } = useQuery<BonusTier[]>({
    queryKey: ["/api/bonus-tiers"],
  });

  const setPaypalMutation = useMutation({
    mutationFn: async (data: { paypalEmail: string; firstName: string; lastName: string }) => {
      return apiRequest("PUT", "/api/creator/paypal", data);
    },
    onSuccess: () => {
      toast({
        title: "PayPal email saved",
        description: "Your PayPal email has been saved successfully.",
      });
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save PayPal email",
        variant: "destructive",
      });
    },
  });

  const handleSubmitPaypal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your first name",
        variant: "destructive",
      });
      return;
    }
    if (!lastName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your last name",
        variant: "destructive",
      });
      return;
    }
    if (!paypalEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid PayPal email",
        variant: "destructive",
      });
      return;
    }
    setPaypalMutation.mutate({
      paypalEmail: paypalEmail.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim()
    });
  };


  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const nextPayoutDate = stats?.currentCycle?.endDate
    ? formatUTCDate(stats.currentCycle.endDate, "MMMM d, yyyy")
    : "No active cycle";

  if (statsLoading || trialLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-24 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Payouts Info</h1>
          <p className="text-muted-foreground">
            {showAllTime 
              ? "Your all-time performance and earnings."
              : "Track your performance and manage your payout settings."}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
          <Label htmlFor="all-time-toggle" className="text-sm cursor-pointer">
            Current Cycle
          </Label>
          <Switch 
            id="all-time-toggle"
            checked={showAllTime}
            onCheckedChange={setShowAllTime}
            data-testid="toggle-all-time"
          />
          <Label htmlFor="all-time-toggle" className="text-sm cursor-pointer">
            All Time
          </Label>
        </div>
      </div>

      {trialStatus?.accountFlagged && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="p-3 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-destructive">Account Flagged</h3>
              <p className="text-sm text-muted-foreground">
                Your trial period has ended and you did not reach the 5,000 view goal. 
                Please contact support to discuss your account status.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {trialStatus?.trialCompleted && !trialStatus?.accountFlagged && (() => {
        const trialEndedInCurrentCycle = trialStatus?.trialEndsAt && stats?.currentCycle?.startDate
          ? new Date(trialStatus.trialEndsAt) >= new Date(stats.currentCycle.startDate)
          : true;
        return trialEndedInCurrentCycle;
      })() && (
        <Card className="border-chart-2 bg-chart-2/5">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="p-3 rounded-full bg-chart-2/10">
              <CheckCircle className="h-6 w-6 text-chart-2" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-chart-2">Trial Completed</h3>
              <p className="text-sm text-muted-foreground">
                Congratulations! You've successfully completed your trial by reaching 5,000 views.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {trialStatus?.isInTrial && !trialStatus?.trialCompleted && !trialStatus?.accountFlagged && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-xl flex items-center gap-2 mb-1">
                  <Clock className="h-5 w-5 text-primary" />
                  Welcome to Your Trial Period
                </CardTitle>
                <CardDescription className="text-sm">
                  You have <span className="font-semibold text-foreground">{trialStatus.trialDays} days</span> to reach <span className="font-semibold text-foreground">{formatNumber(trialStatus.viewGoal)} views</span> to activate your creator account
                </CardDescription>
              </div>
              <Badge variant="outline" className="gap-1 border-primary/50 text-primary">
                <Clock className="w-3 h-3" />
                {trialStatus.daysRemaining} days remaining
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-background/50">
              <div className="text-center">
                <div className="text-2xl font-bold font-mono">{formatNumber(trialStatus.totalViews)}</div>
                <div className="text-xs text-muted-foreground">Views Achieved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold font-mono">{formatNumber(trialStatus.viewGoal)}</div>
                <div className="text-xs text-muted-foreground">View Goal</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold font-mono">{formatNumber(trialStatus.viewsRemaining)}</div>
                <div className="text-xs text-muted-foreground">Views Needed</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Trial Progress</span>
                <span className="font-mono font-medium text-primary">
                  {trialStatus.progressPercent}% complete
                </span>
              </div>
              <Progress value={trialStatus.progressPercent} className="h-3" />
            </div>
            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <strong>How it works:</strong> Connect your Instagram or TikTok account, post videos, and accumulate views. 
              Once you reach {formatNumber(trialStatus.viewGoal)} total views within your trial period, your account will be fully activated 
              and you'll start earning payouts based on your video performance.
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className={`group bg-white dark:bg-[#141414] rounded-xl border p-4 sm:p-5 transition-all duration-300 hover:shadow-[0_6px_30px_rgba(0,0,0,0.14)] hover:-translate-y-1 animate-stat-entrance ${showAllTime ? 'border-sky-300 bg-sky-50/50 dark:bg-sky-900/10' : 'border-gray-200 dark:border-[#252525] hover:border-blue-200'}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Eligible Videos
            </span>
            <Video className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold" data-testid="text-videos-cycle">
            {allTimeLoading && showAllTime ? "..." : (
              <AnimatedNumber 
                value={showAllTime ? (allTimeStats?.totalVideos || 0) : (stats?.videosThisCycle || 0)} 
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {showAllTime ? "All time" : `${stats?.videosThisWeek || 0} this week`}
          </p>
        </div>

        <div className={`group bg-white dark:bg-[#141414] rounded-xl border p-4 sm:p-5 transition-all duration-300 hover:shadow-[0_6px_30px_rgba(0,0,0,0.14)] hover:-translate-y-1 animate-stat-entrance-delay-1 ${showAllTime ? 'border-sky-300 bg-sky-50/50 dark:bg-sky-900/10' : 'border-gray-200 dark:border-[#252525] hover:border-green-200'}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Eligible Views
            </span>
            <Eye className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-3xl font-bold" data-testid="text-total-views">
            {allTimeLoading && showAllTime ? "..." : (
              <AnimatedNumber 
                value={showAllTime ? (allTimeStats?.totalViews || 0) : (stats?.totalViewsThisCycle || 0)}
                formatFn={formatNumber}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {showAllTime ? "All time" : "This pay cycle"}
          </p>
        </div>

        <div className={`group bg-white dark:bg-[#141414] rounded-xl border p-4 sm:p-5 transition-all duration-300 hover:shadow-[0_6px_30px_rgba(0,0,0,0.14)] hover:-translate-y-1 animate-stat-entrance-delay-2 col-span-2 ${showAllTime ? 'border-sky-300 bg-sky-50/50 dark:bg-sky-900/10' : 'border-gray-200 dark:border-[#252525] hover:border-amber-200'}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {showAllTime ? "Total Paid" : "Earnings This Cycle"}
            </span>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-3xl font-bold" data-testid="text-total-earnings">
            {allTimeLoading && showAllTime ? "..." : (
              <AnimatedCurrency 
                value={showAllTime 
                  ? ((allTimeStats?.totalBaseEarnings || 0) + (allTimeStats?.totalBonusEarnings || 0))
                  : ((stats?.baseEarnings || 0) + (stats?.bonusEarnings || 0))} 
              />
            )}
          </div>
          <div className="flex flex-col space-y-1 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span>Base</span>
              <span className="tabular-nums">
                {showAllTime 
                  ? formatCurrency(allTimeStats?.totalBaseEarnings || 0)
                  : formatCurrency(stats?.baseEarnings || 0)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span>Bonus</span>
              <span className="tabular-nums">
                {showAllTime 
                  ? formatCurrency(allTimeStats?.totalBonusEarnings || 0)
                  : formatCurrency(stats?.bonusEarnings || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            PayPal Payment Details
          </CardTitle>
          <CardDescription>
            Enter your PayPal email to receive payments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.paypalEmail ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Payment details saved</p>
                  <p className="text-sm text-green-700 dark:text-green-300" data-testid="text-paypal-name">
                    {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "Name not set"}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300" data-testid="text-paypal-email">{user.paypalEmail}</p>
                </div>
              </div>
              <Alert variant="default">
                <AlertTitle>Important Notice</AlertTitle>
                <AlertDescription>
                  Your payment details cannot be changed once saved. If you need to update them, please raise a support ticket through the "Contact Us" page.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <form onSubmit={handleSubmitPaypal} className="space-y-4">
              <Alert variant="default">
                <AlertTitle>Attention</AlertTitle>
                <AlertDescription>
                  Your payment details cannot be changed once saved. Please make sure you enter the correct information. If you need to change it later, you will need to raise a support ticket.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input
                    id="first-name"
                    type="text"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    data-testid="input-first-name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input
                    id="last-name"
                    type="text"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    data-testid="input-last-name"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="paypal-email">PayPal Email Address</Label>
                <Input
                  id="paypal-email"
                  type="email"
                  placeholder="your-paypal@email.com"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  data-testid="input-paypal-email"
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                disabled={setPaypalMutation.isPending}
                data-testid="button-save-paypal"
              >
                {setPaypalMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Payment Details"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Payout Cycle Info Box */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-sky-500/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-sky-600 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Payout Cycle</CardTitle>
              <CardDescription>
                Track your current payout period
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {stats?.currentCycle ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-background border">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">Current Cycle</span>
                </div>
                <p className="text-lg font-semibold">
                  {formatUTCDate(stats.currentCycle.startDate, "MMM d")} - {formatUTCDate(stats.currentCycle.endDate, "MMM d, yyyy")}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-background border">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium text-muted-foreground">Cycle Ends</span>
                </div>
                <p className="text-lg font-semibold">
                  {formatUTCDate(stats.currentCycle.endDate, "MMMM d, yyyy")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.max(0, Math.ceil((new Date(stats.currentCycle.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days remaining
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No current cycle</p>
              <p className="text-sm mt-1">There is no active payout cycle at the moment.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {bonusTiers && bonusTiers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Award className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Bonus Tiers</CardTitle>
                <CardDescription>
                  Earn bonus payments when your videos hit these view milestones. Each video earns the bonus for its highest tier reached.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bonusTiers.slice().sort((a, b) => a.viewThreshold - b.viewThreshold).map((tier) => (
                <div
                  key={tier.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Eye className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-medium">{formatViewCount(tier.viewThreshold)} views</span>
                  </div>
                  <Badge className="bg-gradient-to-r from-sky-500 to-green-400 text-white shadow-lg shadow-sky-500/30 gap-1">
                    <DollarSign className="w-3 h-3" />
                    ${tier.bonusAmount}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Payout History
          </CardTitle>
          <CardDescription>
            View your earnings from each pay cycle
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payoutsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payouts && payouts.length > 0 ? (
            <div className="space-y-3">
              {payouts.map((payout) => (
                <button 
                  key={payout.id} 
                  className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-left"
                  data-testid={`payout-row-${payout.id}`}
                  onClick={() => setSelectedPayout(payout)}
                >
                  <div>
                    <p className="font-medium">
                      {payout.cycle ? (
                        `${formatUTCDate(payout.cycle.startDate, "MMM d")} - ${formatUTCDate(payout.cycle.endDate, "MMM d, yyyy")}`
                      ) : (
                        "Pay Cycle"
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Base: ${parseFloat(payout.baseAmount).toFixed(2)} | Bonus: ${parseFloat(payout.bonusAmount).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg">${parseFloat(payout.totalAmount).toFixed(2)}</span>
                    {payout.paidAt ? (
                      <Badge variant="default" className="bg-green-600">Paid</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No payouts yet</p>
              <p className="text-sm">Your earnings will appear here once calculated</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedPayout} onOpenChange={(open) => !open && setSelectedPayout(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Videos for {selectedPayout?.cycle ? (
                `${formatUTCDate(selectedPayout.cycle.startDate, "MMM d")} - ${formatUTCDate(selectedPayout.cycle.endDate, "MMM d, yyyy")}`
              ) : "Pay Cycle"}
            </DialogTitle>
            <DialogDescription>
              View your videos and earnings for this pay cycle
            </DialogDescription>
          </DialogHeader>
          
          {cycleVideosLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : cycleVideosData?.videos && cycleVideosData.videos.length > 0 ? (
            <div className="space-y-4">
              {cycleVideosData.isFrozen && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                  <Snowflake className="w-4 h-4" />
                  <span>Frozen data - Views are locked at cycle end.</span>
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold font-mono">
                    {cycleVideosData.videos.filter(v => !v.isIrrelevant).length}
                  </div>
                  <div className="text-xs text-muted-foreground">Eligible Videos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold font-mono">
                    {cycleVideosData.videos.filter(v => !v.isIrrelevant).reduce((sum, v) => sum + v.views, 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Views</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold font-mono text-primary">
                    ${parseFloat(selectedPayout?.totalAmount || "0").toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Payout</div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Video</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Likes</TableHead>
                      <TableHead className="text-right">Comments</TableHead>
                      <TableHead>Posted</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cycleVideosData.videos.map((video) => (
                      <TableRow key={video.id} className={video.isIrrelevant ? "opacity-50" : ""}>
                        <TableCell>
                          {video.platform === "instagram" ? (
                            <div className="flex items-center gap-1">
                              <Instagram className="w-4 h-4 text-pink-600" />
                              <span className="text-xs">IG</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <SiTiktok className="w-4 h-4" />
                              <span className="text-xs">TT</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px]">
                            <p className="text-sm truncate">
                              {video.caption || "No caption"}
                            </p>
                            {video.postedAt && (
                              <p className="text-xs text-muted-foreground">
                                {formatUTCDate(video.postedAt, "MMM d, yyyy")}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <div className="flex items-center justify-end gap-1">
                            <Eye className="w-3 h-3 text-muted-foreground" />
                            {video.views.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <div className="flex items-center justify-end gap-1">
                            <Heart className="w-3 h-3 text-muted-foreground" />
                            {video.likes.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <div className="flex items-center justify-end gap-1">
                            <MessageCircle className="w-3 h-3 text-muted-foreground" />
                            {video.comments.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {video.postedAt ? formatUTCDate(video.postedAt, "MMM d") : "-"}
                        </TableCell>
                        <TableCell>
                          {video.isIrrelevant ? (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Ban className="w-3 h-3" />
                              Irrelevant
                            </Badge>
                          ) : (
                            <Badge variant="default" className="text-xs bg-green-600">
                              Eligible
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No videos for this cycle</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
