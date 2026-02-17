import { useMutation, useQuery } from "@tanstack/react-query";
import { flushSync } from "react-dom";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  Instagram, 
  Loader2, 
  Users, 
  Video,
  Zap
} from "lucide-react";
import { SiTiktok } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { formatUTCDate } from "@/lib/date-utils";

interface CycleEngagement {
  id: string;
  startDate: string;
  endDate: string;
  isPaid: boolean;
  views: number;
  videoCount: number;
  totalPaid: number;
}

interface SyncStats {
  lastInstagramSync: string | null;
  lastTiktokSync: string | null;
  lastRulesCheck: string | null;
  lastPayoutCalculation: string | null;
  schedulerRunning: boolean;
  scheduledJobs: string[];
  totalCreators: number;
  creatorsWithInstagram: number;
  creatorsWithTiktok: number;
  totalVideos: number;
  totalViews: number;
  currentCycle: CycleEngagement | null;
  pastCyclesEngagement: CycleEngagement[];
  platformConfig: {
    instagram: boolean;
    tiktok: boolean;
  };
}

interface ApifySyncResult {
  message: string;
  total: number;
  success: number;
  failed: number;
}

export default function AdminSync() {
  const { token } = useAuth();
  const { toast } = useToast();
  
  // State and ref for instant loading spinner
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0); // Force re-render for time updates
  
  // Update relative time display every minute
  useEffect(() => {
    if (!lastRefreshedAt) return;
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, [lastRefreshedAt]);

  const { data: stats, isLoading } = useQuery<SyncStats>({
    queryKey: ["/api/admin/sync/stats"],
    enabled: !!token,
  });

  const syncApifyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sync/apify");
      return response as ApifySyncResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/stats"] });
      toast({
        title: "Engagement refresh complete",
        description: `Synced ${data.success} of ${data.total} creators successfully.`,
      });
      // Reset loading state and record refresh time
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      setLastRefreshedAt(new Date());
    },
    onError: (error) => {
      toast({
        title: "Engagement refresh failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      // Reset loading state
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    },
  });
  
  // Handler for refresh button with instant loading
  const handleRefreshAllEngagement = () => {
    if (isRefreshingRef.current) return;
    
    isRefreshingRef.current = true;
    
    // Force immediate UI update - spinner shows INSTANTLY
    flushSync(() => {
      setIsRefreshing(true);
    });
    
    syncApifyMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Sync & System</h1>
        <p className="text-muted-foreground">
          Manually trigger video syncs and manage system operations.
        </p>
      </div>

      <p className="text-sm text-muted-foreground mb-4 bg-muted/50 p-3 rounded-lg">
        These metrics reflect the current pay cycle only. Videos and views are counted based on when they were posted within the active cycle period.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Creators
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono" data-testid="text-total-creators">
              {stats?.totalCreators || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Instagram Connected
            </CardTitle>
            <Instagram className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono" data-testid="text-ig-connected">
              {stats?.creatorsWithInstagram || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              TikTok Connected
            </CardTitle>
            <SiTiktok className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono" data-testid="text-tt-connected">
              {stats?.creatorsWithTiktok || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Videos
            </CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono" data-testid="text-total-videos">
              {stats?.totalVideos || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Cycle Views
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono" data-testid="text-current-cycle-views">
              {(stats?.currentCycle?.views || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.currentCycle ? (
                `${formatUTCDate(stats.currentCycle.startDate, "MMM d")} - ${formatUTCDate(stats.currentCycle.endDate, "MMM d")}`
              ) : (
                "No active cycle"
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-sky-500/10 to-pink-500/10 border-sky-500/20">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              All-Time Views
            </CardTitle>
            <Eye className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-sky-600" data-testid="text-all-time-views">
              {(stats?.totalViews || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all creators
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Refresh Engagement</CardTitle>
              <CardDescription>
                Fetch the latest engagement metrics for all creators
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Fetch the latest video engagement data from all creators' social media profiles.
          </p>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleRefreshAllEngagement}
              disabled={isRefreshing}
              className="flex-1"
              data-testid="button-sync-apify"
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Refresh All Engagement
            </Button>
            {lastRefreshedAt && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                <Clock className="w-3 h-3 inline mr-1" />
                {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {stats?.pastCyclesEngagement && stats.pastCyclesEngagement.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Past Videos Engagement</CardTitle>
                <CardDescription>
                  View engagement metrics from previous pay cycles
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cycle Period</TableHead>
                  <TableHead className="text-right">Videos</TableHead>
                  <TableHead className="text-right">Total Views</TableHead>
                  <TableHead className="text-right">Total Paid</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.pastCyclesEngagement.map((cycle) => (
                  <TableRow key={cycle.id} data-testid={`past-cycle-row-${cycle.id}`}>
                    <TableCell className="font-medium">
                      {formatUTCDate(cycle.startDate, "MMM d")} -{" "}
                      {formatUTCDate(cycle.endDate, "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {cycle.videoCount}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {cycle.views.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-green-600">
                      ${cycle.totalPaid.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {cycle.isPaid ? (
                        <Badge variant="secondary" className="gap-1 bg-chart-2/20 text-chart-2">
                          <CheckCircle className="w-3 h-3" />
                          Paid
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 bg-chart-4/20 text-chart-4">
                          <Clock className="w-3 h-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
