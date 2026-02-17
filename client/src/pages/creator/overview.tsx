import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Video, Eye, DollarSign, Calendar, TrendingUp, Award, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { AnimatedNumber, AnimatedCurrency } from "@/components/ui/animated-number";
import { formatUTCDate } from "@/lib/date-utils";
import { useState, useEffect } from "react";
import type { PayoutSettings } from "@shared/schema";

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

export default function CreatorOverview() {
  const { token } = useAuth();
  const [showAllTime, setShowAllTime] = useState(() => {
    return sessionStorage.getItem('dashboard-showAllTime') === 'true';
  });
  
  useEffect(() => {
    sessionStorage.setItem('dashboard-showAllTime', showAllTime.toString());
  }, [showAllTime]);

  const { data: stats, isLoading } = useQuery<CreatorStats>({
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
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

  if (isLoading || trialLoading) {
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

  const showTrialCard = trialStatus && (trialStatus.isInTrial || trialStatus.accountFlagged || !trialStatus.trialCompleted);

  const nextPayoutDate = stats?.currentCycle?.endDate
    ? formatUTCDate(stats.currentCycle.endDate, "MMMM d, yyyy")
    : "No active cycle";

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Overview</h1>
            <p className="text-muted-foreground">
              {showAllTime 
                ? "Your all-time performance and earnings."
                : "Track your performance and earnings for the current pay cycle."}
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
      </div>

      {trialStatus?.accountFlagged && (
        <Card className="mb-6 border-destructive bg-destructive/5">
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
        <Card className="mb-6 border-chart-2 bg-chart-2/5">
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
        <Card className="mb-6 border-primary/30 bg-primary/5">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className={`stat-hover-zoom ${showAllTime ? "border-primary/30 bg-primary/5" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {showAllTime ? "Eligible Videos" : "Eligible Videos"}
            </CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono" data-testid="text-videos-cycle">
              {allTimeLoading && showAllTime ? "..." : (
                <AnimatedNumber 
                  value={showAllTime ? (allTimeStats?.totalVideos || 0) : (stats?.videosThisCycle || 0)} 
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {showAllTime ? "All time" : `${stats?.videosThisWeek || 0} this week`}
            </p>
          </CardContent>
        </Card>

        <Card className={`stat-hover-zoom ${showAllTime ? "border-primary/30 bg-primary/5" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Eligible Views
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono" data-testid="text-total-views">
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
          </CardContent>
        </Card>

        <Card className={`stat-hover-zoom ${showAllTime ? "border-primary/30 bg-primary/5" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {showAllTime ? "Base Earnings Received" : "Base Earnings"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono" data-testid="text-base-earnings">
              {allTimeLoading && showAllTime ? "..." : (
                <AnimatedCurrency 
                  value={showAllTime ? (allTimeStats?.totalBaseEarnings || 0) : (stats?.baseEarnings || 0)} 
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {showAllTime ? "Paid out" : `$${stats?.settings?.basePayPerVideo || 20} per video`}
            </p>
          </CardContent>
        </Card>

        <Card className={`stat-hover-zoom ${showAllTime ? "border-primary/30 bg-primary/5" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {showAllTime ? "Bonus Earnings Received" : "Bonus Earnings"}
            </CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono" data-testid="text-bonus-earnings">
              {allTimeLoading && showAllTime ? "..." : (
                <AnimatedCurrency 
                  value={showAllTime ? (allTimeStats?.totalBonusEarnings || 0) : (stats?.bonusEarnings || 0)} 
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {showAllTime 
                ? "Paid out" 
                : "Bonus pay based on view milestones"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className={`lg:col-span-2 stat-hover-zoom ${showAllTime ? "border-primary/30 bg-primary/5" : ""}`}>
          <CardHeader>
            <CardTitle className="text-xl">
              {showAllTime ? "Total Received" : "Payout Summary"}
            </CardTitle>
            <CardDescription>
              {showAllTime 
                ? "Your total paid earnings from all completed cycles"
                : "Your earnings breakdown for the current pay cycle"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">
                  {showAllTime 
                    ? `Base Pay (${allTimeStats?.totalVideos || 0} videos total)`
                    : `Base Pay (${stats?.videosThisCycle || 0} videos x $${stats?.settings?.basePayPerVideo || 20})`}
                </span>
                <span className="font-mono">
                  {showAllTime 
                    ? formatCurrency(allTimeStats?.totalBaseEarnings || 0)
                    : formatCurrency(stats?.baseEarnings || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Performance Bonus</span>
                <span className="font-mono">
                  {showAllTime 
                    ? formatCurrency(allTimeStats?.totalBonusEarnings || 0)
                    : formatCurrency(stats?.bonusEarnings || 0)}
                </span>
              </div>
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">
                    {showAllTime ? "Total Received" : "Total Payout"}
                  </span>
                  <span className="text-2xl font-bold font-mono text-primary" data-testid="text-total-payout">
                    {showAllTime 
                      ? formatCurrency(allTimeStats?.totalEarnings || 0)
                      : formatCurrency(stats?.totalPayout || 0)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-hover-zoom">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Pay Cycle
            </CardTitle>
            <CardDescription>
              Payment cycle
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground mb-1">Next Payout</div>
              <div className="text-2xl font-bold mb-2" data-testid="text-next-payout-date">
                {nextPayoutDate}
              </div>
              {stats?.currentCycle && (
                <Badge variant="secondary" className="text-xs">
                  Cycle ends in {Math.ceil((new Date(stats.currentCycle.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                </Badge>
              )}
            </div>
            <div className="border-t pt-4 mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Cycle Length</span>
                <span className="font-medium">{stats?.currentCycle ? Math.ceil((new Date(stats.currentCycle.endDate).getTime() - new Date(stats.currentCycle.startDate).getTime()) / (1000 * 60 * 60 * 24)) : 14} days</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Keep posting to maximize your earnings!</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
