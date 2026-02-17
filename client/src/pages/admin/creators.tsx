import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useAdminRefresh } from "@/lib/admin-refresh";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label as FormLabel } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Search, CheckCircle, XCircle, Eye, Video, DollarSign, AlertTriangle, Clock, ArrowUpDown, Sparkles, Award, Zap, Loader2, Pause, Trash2, Filter } from "lucide-react";
import { AnimatedNumber, AnimatedCurrency } from "@/components/ui/animated-number";
import { SiTiktok, SiInstagram } from "react-icons/si";
import { useState, useMemo, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, Label } from "recharts";

interface UserWithStats {
  id: number;
  userId: number | null;
  name: string;
  email: string;
  instagramUsername: string | null;
  tiktokUsername: string | null;
  instagramConnected: boolean | null;
  tiktokConnected: boolean | null;
  instagramFollowers: number | null;
  tiktokFollowers: number | null;
  status: string;
  basePay: string | null;
  totalEarnings: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  videosThisCycle: number;
  eligibleVideos: number;
  totalVideosAllTime: number;
  viewsThisCycle: number;
  eligibleViews: number;
  igViewsThisCycle: number;
  igViewsAllTime: number;
  tiktokViewsThisCycle: number;
  tiktokViewsAllTime: number;
  totalViewsAllTime: number;
  earningsThisCycle: number;
  totalPaid: number;
  isPaused: boolean;
  isDeleted: boolean;
  firstName?: string;
  lastName?: string;
  isNewForAdmin?: boolean;
  accountFlagged?: boolean;
  trialCompleted?: boolean;
  trialEndsAt?: string | null;
}

interface DashboardStats {
  totalCreators: number;
  newCreators: number;
  followers: number;
  igFollowers: number;
  ttFollowers: number;
  lastBulkRefreshAt: string | null;
  videosThisCycle: number;
  igVideosThisCycle: number;
  ttVideosThisCycle: number;
  eligibleVideos: number;
  igEligibleVideos: number;
  ttEligibleVideos: number;
  viewsThisCycle: number;
  igViewsThisCycle: number;
  ttViewsThisCycle: number;
  eligibleViews: number;
  igEligibleViews: number;
  ttEligibleViews: number;
  totalPay: number;
  basePay: number;
  bonusPay: number;
  moneyPaidTillNow: number;
  deltas: {
    newCreators: number;
    totalCreators: number;
    videosThisCycle: number;
    igVideosThisCycle: number;
    ttVideosThisCycle: number;
    eligibleVideos: number;
    igEligibleVideos: number;
    ttEligibleVideos: number;
    viewsThisCycle: number;
    igViewsThisCycle: number;
    ttViewsThisCycle: number;
    eligibleViews: number;
    igEligibleViews: number;
    ttEligibleViews: number;
    followers: number;
    igFollowers: number;
    ttFollowers: number;
    totalPay: number;
    moneyPaidTillNow: number;
  } | null;
}

type SortOption = "newest" | "highest_paid" | "highest_views";
type StatusFilter = "active" | "paused" | "deleted" | "all";

interface ApifySyncResult {
  message: string;
  total: number;
  success: number;
  failed: number;
}

export default function AdminCreators() {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const creatorsUrlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [searchTerm, setSearchTerm] = useState(creatorsUrlParams.get("search") || "");
  const [sortBy, setSortBy] = useState<SortOption>((creatorsUrlParams.get("sort") as SortOption) || "newest");
  const [showAllTime, setShowAllTime] = useState(() => {
    return sessionStorage.getItem('dashboard-showAllTime') === 'true';
  });
  
  useEffect(() => {
    sessionStorage.setItem('dashboard-showAllTime', showAllTime.toString());
  }, [showAllTime]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>((creatorsUrlParams.get("status") as StatusFilter) || "active");
  const { isRefreshing: isSyncing, progress: syncProgressPercent, syncProgress, startRefresh: syncAllCreatorsWithProgress } = useAdminRefresh();

  // Dashboard refresh changes persistence
  interface DashboardRefreshChanges {
    videos: number;
    igVideos: number;
    ttVideos: number;
    views: number;
    igViews: number;
    ttViews: number;
    earnings: number;
    followers: number;
    igFollowers: number;
    ttFollowers: number;
  }
  
  const getStoredDashboardChanges = (): DashboardRefreshChanges | null => {
    try {
      const stored = localStorage.getItem('dashboardRefreshChanges');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };
  
  const [dashboardChanges, setDashboardChanges] = useState<DashboardRefreshChanges | null>(null);
  const wasSyncing = useRef(false);
  
  // Load stored changes on mount
  useEffect(() => {
    setDashboardChanges(getStoredDashboardChanges());
  }, []);
  
  // Persist changes to localStorage
  useEffect(() => {
    if (dashboardChanges) {
      localStorage.setItem('dashboardRefreshChanges', JSON.stringify(dashboardChanges));
    }
  }, [dashboardChanges]);

  const { data: creators, isLoading } = useQuery<UserWithStats[]>({
    queryKey: ["/api/admin/creators", { status: statusFilter }],
    queryFn: async () => {
      const response = await fetch(`/api/admin/creators?status=${statusFilter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch creators");
      return response.json();
    },
    enabled: !!token,
  });

  const { data: dashboardStats } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard-stats"],
    enabled: !!token,
  });
  
  // Track sync state changes - when sync ends, reload changes from localStorage
  useEffect(() => {
    // When sync starts, clear display temporarily
    if (isSyncing && !wasSyncing.current) {
      setDashboardChanges(null);
    }
    
    // When sync ends, reload changes from localStorage (set by admin-refresh.tsx)
    if (!isSyncing && wasSyncing.current) {
      const stored = getStoredDashboardChanges();
      setDashboardChanges(stored);
    }
    
    wasSyncing.current = isSyncing;
  }, [isSyncing]);

  const formatNumber = (num: number | undefined | null) => {
    if (num == null) return "0";
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
  
  const formatChange = (num: number, isCurrency = false) => {
    const prefix = num > 0 ? "+" : "";
    if (isCurrency) {
      return prefix + formatCurrency(num);
    }
    return prefix + formatNumber(num);
  };

  const formatTimeAgo = (date: Date | string | null | undefined): string => {
    if (!date) return "Never";
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays}d ago`;
  };

  const sortCreators = (creatorsList: UserWithStats[]) => {
    const sorted = [...creatorsList];
    // Use the same data source as the display (respects showAllTime toggle)
    const getViews = (c: UserWithStats): number => showAllTime ? Number(c.totalViewsAllTime || 0) : Number(c.viewsThisCycle || 0);
    const getPayout = (c: UserWithStats): number => showAllTime ? Number(c.totalPaid || 0) : Number(c.earningsThisCycle || 0);
    
    switch (sortBy) {
      case "highest_paid":
        return sorted.sort((a, b) => {
          const aPay = getPayout(a);
          const bPay = getPayout(b);
          if (aPay === 0 && bPay > 0) return 1;
          if (bPay === 0 && aPay > 0) return -1;
          const payDiff = bPay - aPay;
          if (payDiff !== 0) return payDiff;
          const viewDiff = getViews(b) - getViews(a);
          if (viewDiff !== 0) return viewDiff;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
      case "highest_views":
        return sorted.sort((a, b) => {
          const aViews = getViews(a);
          const bViews = getViews(b);
          if (aViews === 0 && bViews > 0) return 1;
          if (bViews === 0 && aViews > 0) return -1;
          const viewDiff = bViews - aViews;
          if (viewDiff !== 0) return viewDiff;
          const payDiff = getPayout(b) - getPayout(a);
          if (payDiff !== 0) return payDiff;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
      case "newest":
      default:
        return sorted.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }
  };

  const getCreatorDisplayName = (creator: UserWithStats) => {
    if (creator.firstName || creator.lastName) {
      return `${creator.firstName || ''} ${creator.lastName || ''}`.trim();
    }
    return creator.email;
  };

  const filteredCreators = creators?.filter((creator) => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${creator.firstName || ''} ${creator.lastName || ''}`.toLowerCase();
    return creator.email.toLowerCase().includes(searchLower) || fullName.includes(searchLower);
  });

  const sortedCreators = filteredCreators ? sortCreators(filteredCreators) : [];

  const CHART_COLORS = [
    "#38BDF8", "#0EA5E9", "#06B6D4", "#22D3EE", "#67E8F9", 
    "#A5F3FC", "#EC4899", "#0284C7", "#6ee7b7", "#047857"
  ];

  const videoChartData = useMemo(() => {
    if (!creators) return [];
    const activeCreators = creators.filter(c => !c.isPaused && !c.isDeleted);
    return activeCreators
      .filter(c => showAllTime ? c.totalVideosAllTime > 0 : c.videosThisCycle > 0)
      .map(c => ({
        name: c.instagramUsername || c.tiktokUsername || c.email.split('@')[0],
        value: showAllTime ? c.totalVideosAllTime : c.videosThisCycle,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [creators, showAllTime]);

  const igViewsChartData = useMemo(() => {
    if (!creators) return [];
    const activeCreators = creators.filter(c => !c.isPaused && !c.isDeleted);
    return activeCreators
      .filter(c => showAllTime ? (c.igViewsAllTime || 0) > 0 : (c.igViewsThisCycle || 0) > 0)
      .map(c => ({
        name: c.instagramUsername || c.tiktokUsername || c.email.split('@')[0],
        value: showAllTime ? (c.igViewsAllTime || 0) : (c.igViewsThisCycle || 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [creators, showAllTime]);

  const tiktokViewsChartData = useMemo(() => {
    if (!creators) return [];
    const activeCreators = creators.filter(c => !c.isPaused && !c.isDeleted);
    return activeCreators
      .filter(c => showAllTime ? (c.tiktokViewsAllTime || 0) > 0 : (c.tiktokViewsThisCycle || 0) > 0)
      .map(c => ({
        name: c.instagramUsername || c.tiktokUsername || c.email.split('@')[0],
        value: showAllTime ? (c.tiktokViewsAllTime || 0) : (c.tiktokViewsThisCycle || 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [creators, showAllTime]);

  const earningsChartData = useMemo(() => {
    if (!creators) return [];
    const activeCreators = creators.filter(c => !c.isPaused && !c.isDeleted);
    return activeCreators
      .filter(c => showAllTime ? Number(c.totalPaid || 0) > 0 : (c.earningsThisCycle || 0) > 0)
      .map(c => ({
        name: c.instagramUsername || c.tiktokUsername || c.email.split('@')[0],
        value: showAllTime ? Number(c.totalPaid || 0) : (c.earningsThisCycle || 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [creators, showAllTime]);

  const igCurrentPerformanceData = useMemo(() => {
    if (!creators) return [];
    const activeCreators = creators.filter(c => !c.isPaused && !c.isDeleted);
    return activeCreators
      .filter(c => showAllTime ? (c.igViewsAllTime || 0) > 0 : (c.igViewsThisCycle || 0) > 0)
      .map(c => ({
        name: c.instagramUsername || c.tiktokUsername || c.email.split('@')[0],
        value: showAllTime ? (c.igViewsAllTime || 0) : (c.igViewsThisCycle || 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [creators, showAllTime]);

  const tiktokCurrentPerformanceData = useMemo(() => {
    if (!creators) return [];
    const activeCreators = creators.filter(c => !c.isPaused && !c.isDeleted);
    return activeCreators
      .filter(c => showAllTime ? (c.tiktokViewsAllTime || 0) > 0 : (c.tiktokViewsThisCycle || 0) > 0)
      .map(c => ({
        name: c.instagramUsername || c.tiktokUsername || c.email.split('@')[0],
        value: showAllTime ? (c.tiktokViewsAllTime || 0) : (c.tiktokViewsThisCycle || 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [creators, showAllTime]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStats = {
    videos: dashboardStats?.videosThisCycle || 0,
    views: dashboardStats?.viewsThisCycle || 0,
    basePay: dashboardStats?.basePay || 0,
    bonusPay: dashboardStats?.bonusPay || 0,
    igVideos: dashboardStats?.igVideosThisCycle || 0,
    tiktokVideos: dashboardStats?.ttVideosThisCycle || 0,
    igViews: dashboardStats?.igViewsThisCycle || 0,
    tiktokViews: dashboardStats?.ttViewsThisCycle || 0,
  };
  const allTimeStats = {
    videos: dashboardStats?.eligibleVideos || 0,
    views: dashboardStats?.eligibleViews || 0,
    basePay: dashboardStats?.moneyPaidTillNow || 0,
    bonusPay: 0,
    igVideos: dashboardStats?.igEligibleVideos || 0,
    tiktokVideos: dashboardStats?.ttEligibleVideos || 0,
    igViews: dashboardStats?.igEligibleViews || 0,
    tiktokViews: dashboardStats?.ttEligibleViews || 0,
  };
  const displayStats = showAllTime ? allTimeStats : currentStats;
  const followers = { instagram: dashboardStats?.igFollowers || 0, tiktok: dashboardStats?.ttFollowers || 0 };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Creators</h1>
            <p className="text-muted-foreground">
              {showAllTime 
                ? "All-time performance across all creators."
                : "Manage all creators, view their performance, and track payouts."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={syncAllCreatorsWithProgress}
              disabled={isSyncing}
              data-testid="button-refresh-engagement"
              className="group relative px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl text-sm font-semibold text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(56,189,248,0.4)] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                background: 'linear-gradient(135deg, #0284C7, #38BDF8, #0EA5E9, #06B6D4, #22D3EE)',
                backgroundSize: '300% 300%',
                animation: 'gradient-shift 4s ease infinite',
              }}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
              <span className="relative z-10 flex items-center gap-2">
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {syncProgress.total > 0 
                      ? `${syncProgressPercent}%`
                      : "Starting..."}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 group-hover:animate-pulse fill-current" />
                    <span className="hidden sm:inline">Refresh All Engagement</span>
                    <span className="sm:hidden">Refresh</span>
                  </>
                )}
              </span>
            </button>
            {dashboardStats?.lastBulkRefreshAt && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
                <span className="text-muted-foreground/70">Refreshed:</span>
                <span className="flex items-center gap-1">
                  {formatTimeAgo(dashboardStats.lastBulkRefreshAt)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
              <FormLabel htmlFor="admin-all-time-toggle" className="text-sm cursor-pointer">
                Current Cycle
              </FormLabel>
              <Switch 
                id="admin-all-time-toggle"
                checked={showAllTime}
                onCheckedChange={setShowAllTime}
                data-testid="toggle-admin-all-time"
              />
              <FormLabel htmlFor="admin-all-time-toggle" className="text-sm cursor-pointer">
                All Time
              </FormLabel>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <div className={`group bg-white dark:bg-[#141414] rounded-xl border p-4 sm:p-5 transition-all duration-300 hover:shadow-[0_6px_30px_rgba(0,0,0,0.14)] hover:-translate-y-1 animate-stat-entrance ${showAllTime ? 'border-sky-300 bg-sky-50/50 dark:bg-sky-900/10' : 'border-gray-200 dark:border-[#252525] hover:border-sky-200'}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {showAllTime ? "Total Creators" : "New Creators"}
            </span>
            <Users className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-bold font-mono">
            <AnimatedNumber value={showAllTime ? (dashboardStats?.totalCreators || 0) : (dashboardStats?.newCreators || 0)} />
          </div>
        </div>

        <div className={`group bg-white dark:bg-[#141414] rounded-xl border p-4 sm:p-5 transition-all duration-300 hover:shadow-[0_6px_30px_rgba(0,0,0,0.14)] hover:-translate-y-1 animate-stat-entrance-delay-1 ${showAllTime ? 'border-sky-300 bg-sky-50/50 dark:bg-sky-900/10' : 'border-gray-200 dark:border-[#252525] hover:border-blue-200'}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {showAllTime ? "Eligible Videos" : "Videos This Cycle"}
            </span>
            <Video className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold font-mono">
                <AnimatedNumber value={displayStats.videos} />
              </span>
              {!showAllTime && dashboardChanges && dashboardChanges.videos !== 0 && (
                <span className={`text-sm font-medium ${dashboardChanges.videos > 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatChange(dashboardChanges.videos)}
                </span>
              )}
            </div>
            <div className="flex flex-col text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <SiInstagram className="w-3 h-3 text-pink-500" />
                <span className="font-mono">
                  <AnimatedNumber value={displayStats.igVideos} />
                </span>
                {!showAllTime && dashboardChanges && dashboardChanges.igVideos !== 0 && (
                  <span className={`text-xs font-medium ${dashboardChanges.igVideos > 0 ? "text-green-500" : "text-red-500"}`}>
                    {formatChange(dashboardChanges.igVideos)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <SiTiktok className="w-3 h-3" />
                <span className="font-mono">
                  <AnimatedNumber value={displayStats.tiktokVideos} />
                </span>
                {!showAllTime && dashboardChanges && dashboardChanges.ttVideos !== 0 && (
                  <span className={`text-xs font-medium ${dashboardChanges.ttVideos > 0 ? "text-green-500" : "text-red-500"}`}>
                    {formatChange(dashboardChanges.ttVideos)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={`group bg-white dark:bg-[#141414] rounded-xl border p-4 sm:p-5 transition-all duration-300 hover:shadow-[0_6px_30px_rgba(0,0,0,0.14)] hover:-translate-y-1 animate-stat-entrance-delay-2 ${showAllTime ? 'border-sky-300 bg-sky-50/50 dark:bg-sky-900/10' : 'border-gray-200 dark:border-[#252525] hover:border-cyan-200'}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {showAllTime ? "Eligible Views" : "Views This Cycle"}
            </span>
            <Eye className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold font-mono">
                <AnimatedNumber value={displayStats.views} formatFn={formatNumber} />
              </span>
              {!showAllTime && dashboardChanges && dashboardChanges.views !== 0 && (
                <span className={`text-sm font-medium ${dashboardChanges.views > 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatChange(dashboardChanges.views)}
                </span>
              )}
            </div>
            <div className="flex flex-col text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <SiInstagram className="w-3 h-3 text-pink-500" />
                <span className="font-mono">
                  <AnimatedNumber value={displayStats.igViews} formatFn={formatNumber} />
                </span>
                {!showAllTime && dashboardChanges && dashboardChanges.igViews !== 0 && (
                  <span className={`text-xs font-medium ${dashboardChanges.igViews > 0 ? "text-green-500" : "text-red-500"}`}>
                    {formatChange(dashboardChanges.igViews)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <SiTiktok className="w-3 h-3" />
                <span className="font-mono">
                  <AnimatedNumber value={displayStats.tiktokViews} formatFn={formatNumber} />
                </span>
                {!showAllTime && dashboardChanges && dashboardChanges.ttViews !== 0 && (
                  <span className={`text-xs font-medium ${dashboardChanges.ttViews > 0 ? "text-green-500" : "text-red-500"}`}>
                    {formatChange(dashboardChanges.ttViews)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={`group bg-white dark:bg-[#141414] rounded-xl border p-4 sm:p-5 transition-all duration-300 hover:shadow-[0_6px_30px_rgba(0,0,0,0.14)] hover:-translate-y-1 animate-stat-entrance-delay-3 ${showAllTime ? 'border-sky-300 bg-sky-50/50 dark:bg-sky-900/10' : 'border-gray-200 dark:border-[#252525] hover:border-orange-200'}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Followers
            </span>
            <Users className="h-4 w-4 text-orange-500" />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold font-mono">
                <AnimatedNumber value={followers.instagram + followers.tiktok} formatFn={formatNumber} />
              </span>
              {!showAllTime && dashboardChanges && dashboardChanges.followers !== 0 && (
                <span className={`text-sm font-medium ${dashboardChanges.followers > 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatChange(dashboardChanges.followers)}
                </span>
              )}
            </div>
            <div className="flex flex-col text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <SiInstagram className="w-3 h-3 text-pink-500" />
                <span className="font-mono">
                  <AnimatedNumber value={followers.instagram} formatFn={formatNumber} />
                </span>
                {!showAllTime && dashboardChanges && dashboardChanges.igFollowers !== 0 && (
                  <span className={`text-xs font-medium ${dashboardChanges.igFollowers > 0 ? "text-green-500" : "text-red-500"}`}>
                    {formatChange(dashboardChanges.igFollowers)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <SiTiktok className="w-3 h-3" />
                <span className="font-mono">
                  <AnimatedNumber value={followers.tiktok} formatFn={formatNumber} />
                </span>
                {!showAllTime && dashboardChanges && dashboardChanges.ttFollowers !== 0 && (
                  <span className={`text-xs font-medium ${dashboardChanges.ttFollowers > 0 ? "text-green-500" : "text-red-500"}`}>
                    {formatChange(dashboardChanges.ttFollowers)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={`group bg-white dark:bg-[#141414] rounded-xl border p-4 sm:p-5 transition-all duration-300 hover:shadow-[0_6px_30px_rgba(0,0,0,0.14)] hover:-translate-y-1 animate-stat-entrance-delay-4 ${showAllTime ? 'border-sky-300 bg-sky-50/50 dark:bg-sky-900/10' : 'border-gray-200 dark:border-[#252525] hover:border-green-200'}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {showAllTime ? "Money Paid Till Now" : "Total Pay"}
            </span>
            <DollarSign className="h-4 w-4 text-green-500" />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold font-mono text-green-600">
                <AnimatedCurrency value={displayStats.basePay + displayStats.bonusPay} />
              </span>
              {!showAllTime && dashboardChanges && dashboardChanges.earnings !== 0 && (
                <span className={`text-sm font-medium ${dashboardChanges.earnings > 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatChange(dashboardChanges.earnings, true)}
                </span>
              )}
            </div>
            <div className="flex flex-col text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="text-xs">{showAllTime ? "Base Paid:" : "Base:"}</span>
                <span className="font-mono text-green-600">
                  <AnimatedCurrency value={displayStats.basePay} />
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs">{showAllTime ? "Bonus Paid:" : "Bonus:"}</span>
                <span className="font-mono text-amber-600">
                  <AnimatedCurrency value={displayStats.bonusPay} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pie Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Video className="h-4 w-4" />
              {showAllTime ? "All Time Videos" : "Videos This Cycle"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {videoChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={videoChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {videoChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                    <Label
                      content={(props: any) => {
                        const viewBox = props?.viewBox;
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          const totalVideos = videoChartData.reduce((sum, item) => sum + item.value, 0);
                          if (totalVideos === 0) return null;
                          const videosChange = !showAllTime && dashboardChanges?.videos;
                          const hasChange = videosChange && videosChange !== 0;
                          return (
                            <g>
                              {hasChange && (
                                <text 
                                  x={viewBox.cx} 
                                  y={(viewBox.cy || 0) - 12} 
                                  textAnchor="middle" 
                                  dominantBaseline="middle"
                                  style={{ fill: videosChange > 0 ? '#22c55e' : '#ef4444', fontSize: '12px', fontWeight: 500 }}
                                >
                                  {videosChange > 0 ? '+' : ''}{videosChange}
                                </text>
                              )}
                              <text 
                                x={viewBox.cx} 
                                y={hasChange ? (viewBox.cy || 0) + 8 : viewBox.cy} 
                                textAnchor="middle" 
                                dominantBaseline="middle"
                                className="fill-foreground"
                                style={{ fontSize: '20px', fontWeight: 700 }}
                              >
                                {totalVideos}
                              </text>
                            </g>
                          )
                        }
                        return null;
                      }}
                    />
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, _name: string, props: any) => [`${value} videos`, props.payload?.name || 'Creator']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                No video data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <SiInstagram className="h-4 w-4" />
              {showAllTime ? "All Time IG Views" : "IG Views This Cycle"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {igViewsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={igViewsChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {igViewsChartData.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                    <Label
                      content={(props: any) => {
                        const viewBox = props?.viewBox;
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          const totalViews = igViewsChartData.reduce((sum: number, item: any) => sum + item.value, 0);
                          if (totalViews === 0) return null;
                          const igViewsChange = !showAllTime && dashboardChanges?.igViews;
                          const hasChange = igViewsChange && igViewsChange !== 0;
                          return (
                            <g>
                              {hasChange && (
                                <text 
                                  x={viewBox.cx} 
                                  y={(viewBox.cy || 0) - 12} 
                                  textAnchor="middle" 
                                  dominantBaseline="middle"
                                  style={{ fill: igViewsChange > 0 ? '#22c55e' : '#ef4444', fontSize: '12px', fontWeight: 500 }}
                                >
                                  {igViewsChange > 0 ? '+' : ''}{formatNumber(igViewsChange)}
                                </text>
                              )}
                              <text 
                                x={viewBox.cx} 
                                y={hasChange ? (viewBox.cy || 0) + 8 : viewBox.cy} 
                                textAnchor="middle" 
                                dominantBaseline="middle"
                                className="fill-foreground"
                                style={{ fontSize: '18px', fontWeight: 700 }}
                              >
                                {formatNumber(totalViews)}
                              </text>
                            </g>
                          )
                        }
                        return null;
                      }}
                    />
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, _name: string, props: any) => [formatNumber(value), props.payload?.name || 'Creator']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                No IG views data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <SiTiktok className="h-4 w-4" />
              {showAllTime ? "All Time TikTok Views" : "TikTok Views This Cycle"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tiktokViewsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={tiktokViewsChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {tiktokViewsChartData.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                    <Label
                      content={(props: any) => {
                        const viewBox = props?.viewBox;
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          const totalViews = tiktokViewsChartData.reduce((sum: number, item: any) => sum + item.value, 0);
                          if (totalViews === 0) return null;
                          const tiktokViewsChange = !showAllTime && dashboardChanges?.ttViews;
                          const hasChange = tiktokViewsChange && tiktokViewsChange !== 0;
                          return (
                            <g>
                              {hasChange && (
                                <text 
                                  x={viewBox.cx} 
                                  y={(viewBox.cy || 0) - 12} 
                                  textAnchor="middle" 
                                  dominantBaseline="middle"
                                  style={{ fill: tiktokViewsChange > 0 ? '#22c55e' : '#ef4444', fontSize: '12px', fontWeight: 500 }}
                                >
                                  {tiktokViewsChange > 0 ? '+' : ''}{formatNumber(tiktokViewsChange)}
                                </text>
                              )}
                              <text 
                                x={viewBox.cx} 
                                y={hasChange ? (viewBox.cy || 0) + 8 : viewBox.cy} 
                                textAnchor="middle" 
                                dominantBaseline="middle"
                                className="fill-foreground"
                                style={{ fontSize: '18px', fontWeight: 700 }}
                              >
                                {formatNumber(totalViews)}
                              </text>
                            </g>
                          )
                        }
                        return null;
                      }}
                    />
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, _name: string, props: any) => [formatNumber(value), props.payload?.name || 'Creator']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                No TikTok views data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              {showAllTime ? "All Time Paid" : "Earnings This Cycle"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {earningsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={earningsChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {earningsChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                    <Label
                      content={(props: any) => {
                        const viewBox = props?.viewBox;
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          const totalEarnings = earningsChartData.reduce((sum, item) => sum + item.value, 0);
                          if (totalEarnings === 0) return null;
                          const earningsChange = !showAllTime && dashboardChanges?.earnings;
                          const hasChange = earningsChange && earningsChange !== 0;
                          return (
                            <g>
                              {hasChange && (
                                <text 
                                  x={viewBox.cx} 
                                  y={(viewBox.cy || 0) - 12} 
                                  textAnchor="middle" 
                                  dominantBaseline="middle"
                                  style={{ fill: earningsChange > 0 ? '#22c55e' : '#ef4444', fontSize: '12px', fontWeight: 500 }}
                                >
                                  {earningsChange > 0 ? '+$' : '-$'}{Math.abs(earningsChange).toFixed(0)}
                                </text>
                              )}
                              <text 
                                x={viewBox.cx} 
                                y={hasChange ? (viewBox.cy || 0) + 8 : viewBox.cy} 
                                textAnchor="middle" 
                                dominantBaseline="middle"
                                className="fill-foreground"
                                style={{ fontSize: '16px', fontWeight: 700 }}
                              >
                                ${totalEarnings.toFixed(0)}
                              </text>
                            </g>
                          )
                        }
                        return null;
                      }}
                    />
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, _name: string, props: any) => [`$${value.toFixed(2)}`, props.payload?.name || 'Creator']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                No earnings data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <SiInstagram className="h-4 w-4" />
              Instagram Current Videos Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {igCurrentPerformanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={igCurrentPerformanceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {igCurrentPerformanceData.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                    <Label
                      content={(props: any) => {
                        const viewBox = props?.viewBox;
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          const totalViews = igCurrentPerformanceData.reduce((sum: number, item: any) => sum + item.value, 0);
                          if (totalViews === 0) return null;
                          return (
                            <text 
                              x={viewBox.cx} 
                              y={viewBox.cy} 
                              textAnchor="middle" 
                              dominantBaseline="middle"
                              className="fill-foreground"
                              style={{ fontSize: '18px', fontWeight: 700 }}
                            >
                              {formatNumber(totalViews)}
                            </text>
                          )
                        }
                        return null;
                      }}
                    />
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, _name: string, props: any) => [formatNumber(value), props.payload?.name || 'Creator']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                No Instagram performance data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <SiTiktok className="h-4 w-4" />
              TikTok Current Videos Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tiktokCurrentPerformanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={tiktokCurrentPerformanceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {tiktokCurrentPerformanceData.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                    <Label
                      content={(props: any) => {
                        const viewBox = props?.viewBox;
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          const totalViews = tiktokCurrentPerformanceData.reduce((sum: number, item: any) => sum + item.value, 0);
                          if (totalViews === 0) return null;
                          return (
                            <text 
                              x={viewBox.cx} 
                              y={viewBox.cy} 
                              textAnchor="middle" 
                              dominantBaseline="middle"
                              className="fill-foreground"
                              style={{ fontSize: '18px', fontWeight: 700 }}
                            >
                              {formatNumber(totalViews)}
                            </text>
                          )
                        }
                        return null;
                      }}
                    />
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, _name: string, props: any) => [formatNumber(value), props.payload?.name || 'Creator']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                No TikTok performance data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Users className="h-5 w-5" />
                All Creators
              </CardTitle>
              <CardDescription>
                {creators?.length || 0} creators registered
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
                <SelectTrigger className="w-full sm:w-36" data-testid="select-status-filter">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger className="w-full sm:w-44" data-testid="select-sort-creators">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="highest_paid">Highest Paid</SelectItem>
                  <SelectItem value="highest_views">Highest Views</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-creators"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!filteredCreators || filteredCreators.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm ? "No creators found" : statusFilter === "deleted" ? "No deleted creators" : statusFilter === "paused" ? "No paused creators" : "No creators yet"}
              </h3>
              <p className="text-muted-foreground max-w-sm">
                {searchTerm
                  ? "Try a different search term."
                  : statusFilter === "deleted"
                  ? "Deleted creators will appear here."
                  : statusFilter === "paused"
                  ? "Paused creators will appear here."
                  : "Creators will appear here when they sign up."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-24 text-center">Status</TableHead>
                    <TableHead className="w-24 text-center">Instagram</TableHead>
                    <TableHead className="w-24 text-center">TikTok</TableHead>
                    <TableHead className="w-28 text-right">{showAllTime ? 'Eligible Videos' : 'Videos This Cycle'}</TableHead>
                    <TableHead className="w-28 text-right">{showAllTime ? 'Eligible Views' : 'Views This Cycle'}</TableHead>
                    <TableHead className="w-28 text-right">{showAllTime ? 'Total Paid' : 'Earnings This Cycle'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCreators.map((creator) => (
                    <TableRow 
                      key={creator.id} 
                      className="cursor-pointer hover-elevate"
                      onClick={() => {
                        const fp = new URLSearchParams();
                        fp.set("from", "creators");
                        if (statusFilter !== "active") fp.set("status", statusFilter);
                        if (sortBy !== "newest") fp.set("sort", sortBy);
                        if (searchTerm) fp.set("search", searchTerm);
                        navigate(`/admin/creators/${creator.id}?${fp.toString()}`);
                      }}
                      data-testid={`row-creator-${creator.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {creator.firstName || creator.lastName 
                              ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() 
                              : ''}
                          </span>
                          {creator.isNewForAdmin && (
                            <Badge className="bg-sky-500 text-white gap-1">
                              <Sparkles className="w-3 h-3" />
                              New
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">{creator.email}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {creator.status === 'deleted' || creator.isDeleted ? (
                          <Badge variant="secondary" className="gap-1 bg-red-500/20 text-red-600 dark:text-red-400">
                            <Trash2 className="w-3 h-3" />
                            Deleted
                          </Badge>
                        ) : creator.status === 'paused' || creator.isPaused ? (
                          <Badge variant="secondary" className="gap-1 bg-orange-500/20 text-orange-600 dark:text-orange-400">
                            <Pause className="w-3 h-3" />
                            Paused
                          </Badge>
                        ) : creator.accountFlagged ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Flagged
                          </Badge>
                        ) : creator.status === 'trial' ? (
                          <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-600 dark:text-amber-400">
                            <Clock className="w-3 h-3" />
                            Trial
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 bg-blue-500/20 text-blue-600 dark:text-blue-400">
                            <CheckCircle className="w-3 h-3" />
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {creator.instagramUsername ? (
                          <div className="flex items-center justify-center">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 via-pink-500 to-orange-400 flex items-center justify-center">
                              <SiInstagram className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                              <SiInstagram className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {creator.tiktokUsername ? (
                          <div className="flex items-center justify-center">
                            <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center">
                              <SiTiktok className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                              <SiTiktok className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        <div className="flex items-center justify-end gap-1">
                          <Video className="w-3 h-3 text-muted-foreground" />
                          {showAllTime ? creator.eligibleVideos : creator.videosThisCycle}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        <div className="flex items-center justify-end gap-1">
                          <Eye className="w-3 h-3 text-muted-foreground" />
                          {formatNumber(showAllTime ? creator.eligibleViews : creator.viewsThisCycle)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        <div className="flex items-center justify-end gap-1">
                          <DollarSign className="w-3 h-3 text-muted-foreground" />
                          {formatCurrency(showAllTime ? Number(creator.totalPaid || 0) : (creator.earningsThisCycle || 0))}
                        </div>
                      </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
