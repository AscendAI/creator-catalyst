import { useQuery, useMutation } from "@tanstack/react-query";
import { flushSync } from "react-dom";
import { useAuth } from "@/lib/auth";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft, 
  Video, 
  Eye, 
  Heart, 
  MessageCircle, 
  Award, 
  CheckCircle,
  XCircle,
  DollarSign,
  AlertTriangle,
  Zap,
  Loader2,
  Wallet,
  Pencil,
  RefreshCw,
  ChevronDown,
  History,
  Calendar,
  Ban,
  ExternalLink,
  Clock,
  TrendingUp,
  Pause,
  Play,
  Trash2,
  UserX,
  RotateCcw,
  Snowflake,
  ChevronRight,
  Link2,
  ImageIcon,
  Type,
  Users,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect, useRef } from "react";
import { SiTiktok, SiInstagram } from "react-icons/si";
import { VideoEmbed } from "@/components/video-embed";
import { format, formatDistanceToNow } from "date-fns";
import { formatUTCDate } from "@/lib/date-utils";
import type { Video as VideoType, Violation, Payout, User, Cycle } from "@shared/schema";

type VideoWithCycleInfo = VideoType & {
  basePayPerVideo: number;
  bonusAmount: number;
  isEligible?: boolean;
};

// Helper function to get video bonus (now computed server-side using tiered system)
const getVideoBonus = (video: VideoWithCycleInfo | null): number => {
  if (!video) return 0;
  return video.bonusAmount || 0;
};

interface AllTimeStats {
  totalVideos: number;
  totalViews: number;
  igViews: number;
  tiktokViews: number;
  igVideos: number;
  tiktokVideos: number;
}

interface CreatorDetailData {
  creator: User;
  videos: VideoWithCycleInfo[];
  violations: Violation[];
  payouts: (Payout & { cycle: { startDate: string; endDate: string } })[];
  activeCycle: Cycle | null;
  allTimeStats?: AllTimeStats;
}

export default function AdminCreatorDetail() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [, adminParams] = useRoute("/admin/creators/:id");
  const [, creatorParams] = useRoute("/creator/creators/:id");
  const params = adminParams || creatorParams;
  const creatorId = params?.id;
  const isAdmin = user?.role === "admin";
  const detailParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const fromParam = detailParams.get("from");
  const backPath = (() => {
    if (fromParam === "payouts") return "/admin/payouts";
    const filterParams = new URLSearchParams();
    if (detailParams.get("status")) filterParams.set("status", detailParams.get("status")!);
    if (detailParams.get("sort")) filterParams.set("sort", detailParams.get("sort")!);
    if (detailParams.get("search")) filterParams.set("search", detailParams.get("search")!);
    let base: string;
    if (fromParam === "creators") {
      base = "/admin/creators";
    } else {
      base = isAdmin ? "/admin/creator-hub" : "/creator/creator-hub";
    }
    const qs = filterParams.toString();
    return qs ? `${base}?${qs}` : base;
  })();
  const backLabel = fromParam === "payouts" ? "Back to Payouts" : fromParam === "creators" ? "Back to Creators" : "Back to Creator Hub";
  const apiBase = isAdmin ? "/api/admin/creators" : "/api/creator/creators";
  const [isEditingPaypal, setIsEditingPaypal] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [isEditingBasePay, setIsEditingBasePay] = useState(false);
  const [customInstagramBasePay, setCustomInstagramBasePay] = useState("");
  const [customTiktokBasePay, setCustomTiktokBasePay] = useState("");
  const [pastOpen, setPastOpen] = useState(false);
  type FilterPreset = "latest" | "views" | "payment";
  const [currentCycleFilter, setCurrentCycleFilter] = useState<FilterPreset>("latest");
  const [pastCycleFilter, setPastCycleFilter] = useState<FilterPreset>("latest");
  const [payoutFilter, setPayoutFilter] = useState<FilterPreset>("latest");
  const [refreshingCycleId, setRefreshingCycleId] = useState<string | null>(null);
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false);
  const [refreshConfirmPayout, setRefreshConfirmPayout] = useState<any | null>(null);
  const [overviewMode, setOverviewMode] = useState<"cycle" | "allTime">("cycle");
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [cycleVideosDialogOpen, setCycleVideosDialogOpen] = useState(false);
  const [cycleVideosSortBy, setCycleVideosSortBy] = useState<"views" | "latest">("latest");
  const [cycleDetailTab, setCycleDetailTab] = useState<"videos" | "bounties" | "survivor" | "total">("videos");
  const [captionDialogOpen, setCaptionDialogOpen] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState<string>("");
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [playingHoverVideo, setPlayingHoverVideo] = useState<any | null>(null);
  const [viewsDayRange, setViewsDayRange] = useState<7 | 14 | 30 | 'all'>(14);
  const [hoveredViewDate, setHoveredViewDate] = useState<string | null>(null);
  const [hoveredDateVideos, setHoveredDateVideos] = useState<any[]>([]);
  const [hoverSortMode, setHoverSortMode] = useState<'views' | 'likes'>('views');
  const [isLoadingDetailVideos, setIsLoadingDetailVideos] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoCacheRef = useRef<Record<string, any[]>>({});
  const viewsChartRef = useRef<HTMLDivElement | null>(null);
  const engagementChartRef = useRef<HTMLDivElement | null>(null);
  const [engHoveredDate, setEngHoveredDate] = useState<string | null>(null);
  const [engHoveredDateVideos, setEngHoveredDateVideos] = useState<any[]>([]);
  const [engHoverSortMode, setEngHoverSortMode] = useState<'views' | 'likes'>('views');
  const [engIsLoadingVideos, setEngIsLoadingVideos] = useState(false);
  const engHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const engVideoCacheRef = useRef<Record<string, any[]>>({});

  const [bountyTab, setBountyTab] = useState<"all" | "creator">("creator");
  const [showCreateBounty, setShowCreateBounty] = useState(false);
  const [newBountyTitle, setNewBountyTitle] = useState("");
  const [newBountyDescription, setNewBountyDescription] = useState("");
  const [newBountyReward, setNewBountyReward] = useState("");
  const [newBountyDeadline, setNewBountyDeadline] = useState("");
  const [newBountySlots, setNewBountySlots] = useState("1");
  const [newBountyPriority, setNewBountyPriority] = useState("medium");
  const [isCreatingBounty, setIsCreatingBounty] = useState(false);

  interface Bounty {
    id: number;
    title: string;
    description: string | null;
    reward: string;
    deadline: string | null;
    deadlineDate: string | null;
    maxSlots: number;
    currentClaims: number;
    priority: string;
    status: string;
    createdAt: string;
    claims: Array<{
      id: number;
      creatorId: number;
      creatorName: string;
      status: string;
      completedAt: string | null;
      paidAt: string | null;
      createdAt: string;
    }>;
  }

  const { data: allBounties, refetch: refetchBounties } = useQuery<Bounty[]>({
    queryKey: ["/api/admin/bounties"],
    enabled: !!token && isAdmin,
  });

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
  }

  const bountyHistoryEndpoint = isAdmin
    ? `/api/admin/creators/${creatorId}/bounty-history`
    : `/api/creator/bounty-history`;

  const { data: bountyHistory } = useQuery<BountyHistoryItem[]>({
    queryKey: [bountyHistoryEndpoint],
    enabled: !!token && !!creatorId,
  });

  const { data: creatorSurvivorGames } = useQuery<any[]>({
    queryKey: ["/api/admin/creators", creatorId, "streak-survivor"],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/creators/${creatorId}/streak-survivor`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch streak survivor data");
      return res.json();
    },
    enabled: !!creatorId && isAdmin,
  });
  
  // State for tracking changes after refresh
  interface RefreshChanges {
    videos: number;
    igVideos: number;
    ttVideos: number;
    views: number;
    igViews: number;
    ttViews: number;
    earnings: number;
    basePay: number;
    bonus: number;
    following: number;
    igFollowers: number;
    ttFollowers: number;
  }
  
  // Load persisted refresh changes from localStorage
  const getStoredRefreshChanges = (): RefreshChanges | null => {
    if (!creatorId) return null;
    try {
      const stored = localStorage.getItem(`refreshChanges_${creatorId}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };
  
  const [refreshChanges, setRefreshChanges] = useState<RefreshChanges | null>(null);
  
  // Ref to track refresh in progress synchronously (prevents double-clicks)
  const isRefreshingRef = useRef(false);
  
  // State to show loading spinner instantly on click
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // State for "refreshed X ago" timestamp
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0); // Force re-render for time updates
  
  // Update relative time display every minute
  useEffect(() => {
    if (!lastRefreshedAt) return;
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, [lastRefreshedAt]);
  
  // Load persisted refresh changes when creatorId changes (handles navigation between creators)
  useEffect(() => {
    if (!creatorId) return;
    const stored = getStoredRefreshChanges();
    setRefreshChanges(stored);
  }, [creatorId]);
  
  // Persist refresh changes to localStorage whenever they change
  useEffect(() => {
    if (!creatorId) return;
    if (refreshChanges) {
      localStorage.setItem(`refreshChanges_${creatorId}`, JSON.stringify(refreshChanges));
    }
  }, [refreshChanges, creatorId]);
  const [preRefreshSnapshot, setPreRefreshSnapshot] = useState<{
    videos: number;
    igVideos: number;
    ttVideos: number;
    views: number;
    igViews: number;
    ttViews: number;
    earnings: number;
    basePay: number;
    bonus: number;
    following: number;
    igFollowers: number;
    ttFollowers: number;
  } | null>(null);

  const { data, isLoading } = useQuery<CreatorDetailData>({
    queryKey: [apiBase, creatorId],
    enabled: !!token && !!creatorId,
  });

  interface DailyViewsDataPoint {
    date: string;
    views: number;
    likes: number;
    comments: number;
    engagementRate: number;
    videoIds: string[];
  }
  interface DailyViewsResponse {
    days: number;
    dataPoints: DailyViewsDataPoint[];
    totalViews: number;
  }

  const dailyViewsEndpoint = isAdmin ? "/api/admin/daily-views" : "/api/creator/daily-views";
  const { data: dailyViewsData } = useQuery<DailyViewsResponse>({
    queryKey: [dailyViewsEndpoint, viewsDayRange, creatorId],
    queryFn: async () => {
      const daysParam = viewsDayRange === 'all' ? 'all' : String(viewsDayRange);
      const params = new URLSearchParams({ days: daysParam });
      if (creatorId) params.set('creatorId', creatorId);
      const res = await fetch(`${dailyViewsEndpoint}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch daily views');
      return res.json();
    },
    enabled: !!user && !!creatorId,
  });

  useEffect(() => {
    if (data) {
      queryClient.invalidateQueries({ queryKey: [apiBase] });
    }
  }, [data]);

  const updatePaypalMutation = useMutation({
    mutationFn: async (data: { paypalEmail: string; firstName: string; lastName: string }) => {
      return await apiRequest("PUT", `/api/admin/creators/${creatorId}/paypal`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators", creatorId] });
      setIsEditingPaypal(false);
      setPaypalEmail("");
      setEditFirstName("");
      setEditLastName("");
      toast({
        title: "Payment info updated",
        description: "The creator's payment information has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update payment info",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateBasePayMutation = useMutation({
    mutationFn: async (data: { customInstagramBasePay?: string | null; customTiktokBasePay?: string | null }) => {
      return await apiRequest("PUT", `/api/admin/creators/${creatorId}/base-pay`, { 
        customInstagramBasePay: data.customInstagramBasePay === "" ? null : data.customInstagramBasePay,
        customTiktokBasePay: data.customTiktokBasePay === "" ? null : data.customTiktokBasePay,
      });
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/admin/creators", creatorId] });
      setIsEditingBasePay(false);
      setCustomInstagramBasePay("");
      setCustomTiktokBasePay("");
      toast({
        title: "Base pay updated",
        description: "The creator's custom base pay has been updated and applied to current cycle.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update base pay",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const syncApifyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/admin/sync/creator/${creatorId}`) as { instagram: number; tiktok: number };
    },
    onSuccess: async (syncData) => {
      // Fetch fresh data directly and compute changes from it
      const freshData = await queryClient.fetchQuery<CreatorDetailData>({
        queryKey: ["/api/admin/creators", creatorId],
        staleTime: 0,
      });
      
      // Calculate changes from fresh data if we have a snapshot
      if (preRefreshSnapshot && freshData) {
        const { creator: freshCreator, videos: freshVideos } = freshData;
        const activeCycle = freshData.activeCycle;
        
        // Calculate fresh stats using same filtering logic as getCurrentStatsSnapshot
        const freshCurrentCycleVideos = freshVideos.filter(v => 
          activeCycle && v.cycleId === activeCycle.id && !v.isIrrelevant
        );
        const freshIgVideos = freshCurrentCycleVideos.filter(v => v.platform === "instagram");
        const freshTtVideos = freshCurrentCycleVideos.filter(v => v.platform === "tiktok");
        
        const freshStats = {
          videos: freshCurrentCycleVideos.length,
          igVideos: freshIgVideos.length,
          ttVideos: freshTtVideos.length,
          views: freshCurrentCycleVideos.reduce((sum, v) => sum + v.views, 0),
          igViews: freshIgVideos.reduce((sum, v) => sum + v.views, 0),
          ttViews: freshTtVideos.reduce((sum, v) => sum + v.views, 0),
          earnings: 0, // Complex pairing calculation - not shown in delta
          basePay: 0,
          bonus: 0,
          following: (freshCreator.instagramFollowers || 0) + (freshCreator.tiktokFollowers || 0),
          igFollowers: freshCreator.instagramFollowers || 0,
          ttFollowers: freshCreator.tiktokFollowers || 0,
        };
        
        const changes: RefreshChanges = {
          videos: freshStats.videos - preRefreshSnapshot.videos,
          igVideos: freshStats.igVideos - preRefreshSnapshot.igVideos,
          ttVideos: freshStats.ttVideos - preRefreshSnapshot.ttVideos,
          views: freshStats.views - preRefreshSnapshot.views,
          igViews: freshStats.igViews - preRefreshSnapshot.igViews,
          ttViews: freshStats.ttViews - preRefreshSnapshot.ttViews,
          earnings: 0, // Complex pairing calculation - not shown in delta
          basePay: 0,
          bonus: 0,
          following: freshStats.following - preRefreshSnapshot.following,
          igFollowers: freshStats.igFollowers - preRefreshSnapshot.igFollowers,
          ttFollowers: freshStats.ttFollowers - preRefreshSnapshot.ttFollowers,
        };
        
        setRefreshChanges(changes);
        setPreRefreshSnapshot(null);
        
        // Also update dashboard-level changes in localStorage
        // Fetch fresh dashboard stats and compute deltas
        try {
          const dashboardResponse = await fetch('/api/admin/dashboard-stats', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (dashboardResponse.ok) {
            const dashboardStats = await dashboardResponse.json();
            const currentCycle = dashboardStats?.currentCycle;
            const followers = dashboardStats?.followers;
            
            if (currentCycle && followers) {
              // Get previous dashboard snapshot from localStorage
              const storedSnapshot = localStorage.getItem('dashboardPreRefreshSnapshot');
              if (storedSnapshot) {
                const prevSnapshot = JSON.parse(storedSnapshot);
                const dashboardChanges = {
                  videos: currentCycle.videos - prevSnapshot.videos,
                  igVideos: currentCycle.igVideos - prevSnapshot.igVideos,
                  ttVideos: currentCycle.tiktokVideos - prevSnapshot.ttVideos,
                  views: currentCycle.views - prevSnapshot.views,
                  igViews: currentCycle.igViews - prevSnapshot.igViews,
                  ttViews: currentCycle.tiktokViews - prevSnapshot.ttViews,
                  earnings: (currentCycle.basePay + currentCycle.bonusPay) - prevSnapshot.earnings,
                  followers: (followers.instagram + followers.tiktok) - prevSnapshot.followers,
                  igFollowers: followers.instagram - prevSnapshot.igFollowers,
                  ttFollowers: followers.tiktok - prevSnapshot.ttFollowers,
                };
                localStorage.setItem('dashboardRefreshChanges', JSON.stringify(dashboardChanges));
                localStorage.removeItem('dashboardPreRefreshSnapshot');
              }
            }
          }
        } catch (e) {
          console.error('Failed to update dashboard changes:', e);
        }
      }
      
      // Invalidate to trigger re-render with fresh data
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/creators", creatorId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-stats"] });
      
      toast({
        title: "Engagement refreshed",
        description: `Synced ${syncData.instagram} Instagram and ${syncData.tiktok} TikTok videos.`,
      });
      
      // Reset the refresh lock and loading state, and record refresh time
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      setLastRefreshedAt(new Date());
    },
    onError: (error) => {
      setPreRefreshSnapshot(null);
      // Clear dashboard snapshot on failure to prevent stale deltas
      localStorage.removeItem('dashboardPreRefreshSnapshot');
      toast({
        title: "Refresh failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      
      // Reset the refresh lock and loading state
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    },
  });

  const toggleIrrelevantMutation = useMutation({
    mutationFn: async ({ videoId, isIrrelevant }: { videoId: string; isIrrelevant: boolean }) => {
      return await apiRequest("PUT", `/api/admin/videos/${videoId}/irrelevant`, { isIrrelevant });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators", creatorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-stats"] });
      toast({
        title: "Video status updated",
        description: "The video's payment eligibility has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update video",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const skipTrialMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/admin/creators/${creatorId}/skip-trial`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators", creatorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators"] });
      toast({
        title: "Trial skipped",
        description: "The creator now has active status.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to skip trial",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const pauseCreatorMutation = useMutation({
    mutationFn: async (isPaused: boolean) => {
      return await apiRequest("PUT", `/api/admin/creators/${creatorId}/pause`, { isPaused });
    },
    onSuccess: (_, isPaused) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators", creatorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-stats"] });
      toast({
        title: isPaused ? "Creator paused" : "Creator unpaused",
        description: isPaused 
          ? "The creator's unpaid views will no longer be counted." 
          : "The creator is now active again.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update creator status",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteCreatorMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/admin/creators/${creatorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators", creatorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-stats"] });
      toast({
        title: "Creator deleted",
        description: "The creator has been removed from the system.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete creator",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const reviveCreatorMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/admin/creators/${creatorId}/revive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators", creatorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-stats"] });
      toast({
        title: "Creator revived",
        description: "The creator has been restored and is now active.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to revive creator",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const markPayoutPaidMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      return await apiRequest("POST", `/api/admin/payouts/${payoutId}/mark-paid`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators", creatorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-stats"] });
      toast({
        title: "Payout marked as paid",
        description: "The creator's payout for this cycle has been marked as paid.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to mark payout as paid",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const unmarkPayoutPaidMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      return await apiRequest("POST", `/api/admin/payouts/${payoutId}/unmark-paid`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators", creatorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-stats"] });
      toast({
        title: "Payout unmarked",
        description: "The payout has been marked as unpaid.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to unmark payout",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRefreshCyclePayout = async (cycleId: string) => {
    setRefreshingCycleId(cycleId);
    try {
      const res = await fetch(`/api/admin/cycles/${cycleId}/refresh-creator/${creatorId}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Refresh failed",
          description: data.message || "Could not refresh cycle",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Cycle refreshed",
          description: `Synced ${data.instagram} IG + ${data.tiktok} TT videos. Updated payout: $${data.amount}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/creators", creatorId] });
      }
    } catch (err) {
      toast({
        title: "Refresh failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshingCycleId(null);
    }
  };

  interface CycleVideoData {
    id: string;
    videoId?: string;
    platform: string;
    platformVideoId?: string | null;
    videoFileUrl?: string | null;
    url: string | null;
    thumbnailUrl?: string | null;
    caption: string | null;
    timestamp: string | Date;
    views: number;
    likes: number;
    comments: number;
    isIrrelevant: boolean;
    isEligible: boolean;
    basePayPerVideo: number;
    bonusAmount: number;
    creatorEmail: string;
    creatorName: string | null;
    isFrozen: boolean;
    thumbnailHash?: string | null;
    duration?: number | null;
  }

  interface CycleVideosResponse {
    cycle: Cycle;
    videos: CycleVideoData[];
    isFrozen: boolean;
  }

  interface PairedVideoRow {
    id: string;
    date: Date;
    caption: string;
    ig: CycleVideoData | null;
    tiktok: CycleVideoData | null;
    matchType?: "duration" | "thumbnail" | "none";
    winnerPlatform?: "instagram" | "tiktok" | null;
  }

  const getDateKey = (timestamp: string | Date): string => {
    const date = new Date(timestamp);
    // Use UTC to avoid timezone issues when pairing videos from same day
    return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
  };

  const isWithin36Hours = (date1: Date | string, date2: Date | string): boolean => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const timeDiff = Math.abs(d1.getTime() - d2.getTime());
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    return hoursDiff <= 24;
  };

  const calculateHammingDistance = (hash1: string, hash2: string): number => {
    if (!hash1 || !hash2 || hash1.length !== hash2.length || hash1.length !== 16) return Infinity;
    try {
      const xor = BigInt('0x' + hash1) ^ BigInt('0x' + hash2);
      let distance = 0;
      let val = xor;
      const zero = BigInt(0);
      const one = BigInt(1);
      while (val > zero) {
        distance += Number(val & one);
        val >>= one;
      }
      return distance;
    } catch {
      return Infinity;
    }
  };

  const areThumbnailsSimilar = (hash1: string | null | undefined, hash2: string | null | undefined, threshold: number = 12): boolean => {
    if (!hash1 || !hash2) return false;
    const distance = calculateHammingDistance(hash1, hash2);
    return distance <= threshold;
  };

  const buildPairedCycleRows = (videos: CycleVideoData[]): PairedVideoRow[] => {
    const igVideos = videos.filter(v => v.platform === "instagram");
    const tiktokVideos = videos.filter(v => v.platform === "tiktok");
    const usedTiktokIds = new Set<string>();
    const rows: PairedVideoRow[] = [];

    for (const ig of igVideos) {
      let bestMatch: CycleVideoData | null = null;
      let bestDurationDiff = Infinity;
      let bestTimeDiff = Infinity;
      let matchType: "duration" | "thumbnail" | "none" = "none";

      // Priority 1: Duration matching (within 1 second tolerance, 24-hour window)
      const igDuration = ig.duration;
      const igTimestamp = new Date((ig as any).timestamp || ig.postedAt || 0).getTime();
      if (igDuration != null) {
        for (const tt of tiktokVideos) {
          if (usedTiktokIds.has(tt.id)) continue;
          if (!isWithin36Hours((ig as any).timestamp || ig.postedAt || 0, (tt as any).timestamp || tt.postedAt || 0)) continue;
          const ttDuration = tt.duration;
          if (ttDuration == null) continue;
          
          const durationDiff = Math.abs(igDuration - ttDuration);
          const timeDiff = Math.abs(igTimestamp - new Date((tt as any).timestamp || tt.postedAt || 0).getTime());
          if (durationDiff <= 1 && (durationDiff < bestDurationDiff || (durationDiff === bestDurationDiff && timeDiff < bestTimeDiff))) {
            bestDurationDiff = durationDiff;
            bestTimeDiff = timeDiff;
            bestMatch = tt;
            matchType = "duration";
          }
        }
      }

      // Priority 2: Thumbnail hash matching (24-hour window)
      if (!bestMatch) {
        for (const tt of tiktokVideos) {
          if (usedTiktokIds.has(tt.id)) continue;
          if (!isWithin36Hours((ig as any).timestamp || ig.postedAt || 0, (tt as any).timestamp || tt.postedAt || 0)) continue;
          
          if (areThumbnailsSimilar(ig.thumbnailHash, tt.thumbnailHash)) {
            bestMatch = tt;
            matchType = "thumbnail";
            break;
          }
        }
      }

      if (bestMatch) {
        usedTiktokIds.add(bestMatch.id);
      }

      let winnerPlatform: "instagram" | "tiktok" | null = null;
      if (bestMatch) {
        const igIrrelevant = ig.isIrrelevant === true;
        const ttIrrelevant = bestMatch.isIrrelevant === true;
        
        if (igIrrelevant && ttIrrelevant) {
          winnerPlatform = null;
        } else if (igIrrelevant) {
          winnerPlatform = "tiktok";
        } else if (ttIrrelevant) {
          winnerPlatform = "instagram";
        } else {
          winnerPlatform = ig.views >= bestMatch.views ? "instagram" : "tiktok";
        }
      } else {
        winnerPlatform = ig.isIrrelevant !== true ? "instagram" : null;
      }

      rows.push({
        id: `pair-${ig.id}`,
        date: new Date((ig as any).timestamp || ig.postedAt || 0),
        caption: ig.caption || "No caption",
        ig,
        tiktok: bestMatch,
        matchType: bestMatch ? matchType : "none",
        winnerPlatform,
      });
    }

    for (const tt of tiktokVideos) {
      if (usedTiktokIds.has(tt.id)) continue;
      const ttWins = tt.isIrrelevant !== true;
      rows.push({
        id: `pair-${tt.id}`,
        date: new Date((tt as any).timestamp || tt.postedAt || 0),
        caption: tt.caption || "No caption",
        ig: null,
        tiktok: tt,
        matchType: "none",
        winnerPlatform: ttWins ? "tiktok" : null,
      });
    }

    return rows;
  };

  interface PairedMainVideoRow {
    id: string;
    date: Date;
    caption: string;
    ig: VideoWithCycleInfo | null;
    tiktok: VideoWithCycleInfo | null;
    matchType?: "duration" | "thumbnail" | "none";
    winnerPlatform?: "instagram" | "tiktok" | null;
  }

  const buildPairedMainRows = (videos: VideoWithCycleInfo[]): PairedMainVideoRow[] => {
    const igVideos = videos.filter(v => v.platform === "instagram");
    const tiktokVideos = videos.filter(v => v.platform === "tiktok");
    const usedTiktokIds = new Set<string>();
    const rows: PairedMainVideoRow[] = [];

    for (const ig of igVideos) {
      let bestMatch: VideoWithCycleInfo | null = null;
      let bestDurationDiff = Infinity;
      let bestTimeDiff = Infinity;
      let matchType: "duration" | "thumbnail" | "none" = "none";

      // Priority 1: Duration matching (within 1 second tolerance, 24-hour window)
      const igDuration = ig.duration;
      const igTimestamp = new Date((ig as any).timestamp || ig.postedAt || 0).getTime();
      if (igDuration != null) {
        for (const tt of tiktokVideos) {
          if (usedTiktokIds.has(tt.id)) continue;
          if (!isWithin36Hours((ig as any).timestamp || ig.postedAt || 0, (tt as any).timestamp || tt.postedAt || 0)) continue;
          const ttDuration = tt.duration;
          if (ttDuration == null) continue;
          
          const durationDiff = Math.abs(igDuration - ttDuration);
          const timeDiff = Math.abs(igTimestamp - new Date((tt as any).timestamp || tt.postedAt || 0).getTime());
          if (durationDiff <= 1 && (durationDiff < bestDurationDiff || (durationDiff === bestDurationDiff && timeDiff < bestTimeDiff))) {
            bestDurationDiff = durationDiff;
            bestTimeDiff = timeDiff;
            bestMatch = tt;
            matchType = "duration";
          }
        }
      }

      // Priority 2: Thumbnail hash matching (24-hour window)
      if (!bestMatch) {
        for (const tt of tiktokVideos) {
          if (usedTiktokIds.has(tt.id)) continue;
          if (!isWithin36Hours((ig as any).timestamp || ig.postedAt || 0, (tt as any).timestamp || tt.postedAt || 0)) continue;
          
          if (areThumbnailsSimilar(ig.thumbnailHash, tt.thumbnailHash)) {
            bestMatch = tt;
            matchType = "thumbnail";
            break;
          }
        }
      }

      if (bestMatch) {
        usedTiktokIds.add(bestMatch.id);
      }

      let winnerPlatform: "instagram" | "tiktok" | null = null;
      if (bestMatch) {
        const igIrrelevant = ig.isIrrelevant === true;
        const ttIrrelevant = bestMatch.isIrrelevant === true;
        
        if (igIrrelevant && ttIrrelevant) {
          winnerPlatform = null;
        } else if (igIrrelevant) {
          winnerPlatform = "tiktok";
        } else if (ttIrrelevant) {
          winnerPlatform = "instagram";
        } else {
          winnerPlatform = ig.views >= bestMatch.views ? "instagram" : "tiktok";
        }
      } else {
        winnerPlatform = ig.isIrrelevant !== true ? "instagram" : null;
      }

      rows.push({
        id: `pair-${ig.id}`,
        date: new Date((ig as any).timestamp || ig.postedAt || 0),
        caption: ig.caption || "No caption",
        ig,
        tiktok: bestMatch,
        matchType: bestMatch ? matchType : "none",
        winnerPlatform,
      });
    }

    for (const tt of tiktokVideos) {
      if (usedTiktokIds.has(tt.id)) continue;
      const ttWins = tt.isIrrelevant !== true;
      rows.push({
        id: `pair-${tt.id}`,
        date: new Date((tt as any).timestamp || tt.postedAt || 0),
        caption: tt.caption || "No caption",
        ig: null,
        tiktok: tt,
        matchType: "none",
        winnerPlatform: ttWins ? "tiktok" : null,
      });
    }

    return rows;
  };

  const { data: cycleVideosData, isLoading: isCycleVideosLoading } = useQuery<CycleVideosResponse>({
    queryKey: ["/api/admin/cycles", selectedCycleId, "videos", creatorId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/cycles/${selectedCycleId}/videos?creatorId=${creatorId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch cycle videos");
      return res.json();
    },
    enabled: !!selectedCycleId && cycleVideosDialogOpen && !!token,
  });

  const { data: cycleBountySurvivorData } = useQuery<any>({
    queryKey: ["/api/admin/cycles", selectedCycleId, "bounties-and-survivor", creatorId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/cycles/${selectedCycleId}/bounties-and-survivor?creatorId=${creatorId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch bounties and survivor data");
      return res.json();
    },
    enabled: !!selectedCycleId && cycleVideosDialogOpen && !!token && isAdmin,
  });

  const toggleCycleVideoRelevanceMutation = useMutation({
    mutationFn: async ({ snapshotId, isIrrelevant }: { snapshotId: string; isIrrelevant: boolean }) => {
      return await apiRequest("PUT", `/api/admin/cycle-videos/${snapshotId}/relevance`, { isIrrelevant });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cycles", selectedCycleId, "videos", creatorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cycles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators", creatorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-stats"] });
      toast({
        title: "Video updated",
        description: "Video relevance has been updated and payouts recalculated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update video",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for live (non-frozen) video relevance
  const toggleVideoRelevanceMutation = useMutation({
    mutationFn: async ({ videoId, isIrrelevant }: { videoId: string; isIrrelevant: boolean }) => {
      return await apiRequest("PUT", `/api/admin/videos/${videoId}/relevance`, { isIrrelevant });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cycles", selectedCycleId, "videos", creatorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cycles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators", creatorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-stats"] });
      toast({
        title: "Video updated",
        description: "Video relevance has been updated and payouts recalculated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update video",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
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

  const filterVideos = (videoList: VideoWithCycleInfo[], filter: FilterPreset) => {
    return [...videoList].sort((a, b) => {
      switch (filter) {
        case "latest":
          return new Date((b as any).timestamp || b.postedAt || 0).getTime() - new Date((a as any).timestamp || a.postedAt || 0).getTime();
        case "views":
          return (b.views || 0) - (a.views || 0);
        case "payment":
          const aPayment = a.basePayPerVideo + getVideoBonus(a);
          const bPayment = b.basePayPerVideo + getVideoBonus(b);
          return bPayment - aPayment;
        default:
          return new Date((b as any).timestamp || b.postedAt || 0).getTime() - new Date((a as any).timestamp || a.postedAt || 0).getTime();
      }
    });
  };

  const FilterButtons = ({ 
    activeFilter, 
    onFilterChange 
  }: { 
    activeFilter: FilterPreset; 
    onFilterChange: (filter: FilterPreset) => void;
  }) => (
    <div className="flex gap-2 mb-4">
      <Button
        variant={activeFilter === "latest" ? "default" : "outline"}
        size="sm"
        onClick={() => onFilterChange("latest")}
        className="gap-1"
      >
        <Clock className="w-3 h-3" />
        Latest
      </Button>
      <Button
        variant={activeFilter === "views" ? "default" : "outline"}
        size="sm"
        onClick={() => onFilterChange("views")}
        className="gap-1"
      >
        <TrendingUp className="w-3 h-3" />
        Most Views
      </Button>
      {isAdmin && (
        <Button
          variant={activeFilter === "payment" ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange("payment")}
          className="gap-1"
        >
          <DollarSign className="w-3 h-3" />
          Highest Pay
        </Button>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <Skeleton className="h-8 w-32 mb-8" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto">
        <Link href={backPath}>
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {backLabel}
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Creator not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { creator, videos, violations, payouts, activeCycle, allTimeStats } = data;

  const relevantVideos = videos.filter(v => !v.isIrrelevant);
  
  const eligibleVideos = videos.filter(v => v.isEligible && !v.isIrrelevant);
  
  const currentCycleVideos = activeCycle 
    ? videos.filter(v => v.cycleId === activeCycle.id)
    : [];

  // Past cycle videos = videos from different (older) cycles or videos with no cycle assigned
  // If no active cycle, all videos are considered past/unassigned
  const pastCycleVideos = activeCycle 
    ? videos.filter(v => v.cycleId !== activeCycle.id)
    : videos;
  
  // Relevant videos for metrics (exclude irrelevant AND ineligible)
  const relevantCurrentCycleVideos = currentCycleVideos.filter(v => !v.isIrrelevant);
  
  // Calculate earnings dynamically using winner-takes-pay pairing logic
  const calculateEarnings = (vids: VideoWithCycleInfo[]) => {
    const pairedRows = buildPairedMainRows(vids);
    let baseEarnings = 0;
    let bonusEarnings = 0;
    
    for (const row of pairedRows) {
      const isPaired = !!row.ig && !!row.tiktok;
      
      const igEligible = row.ig && !row.ig.isIrrelevant;
      const ttEligible = row.tiktok && !row.tiktok.isIrrelevant;
      
      const igIsWinner = row.winnerPlatform === "instagram";
      const ttIsWinner = row.winnerPlatform === "tiktok";
      
      if (igEligible && row.ig) {
        baseEarnings += row.ig.basePayPerVideo;
      }
      if (ttEligible && row.tiktok) {
        baseEarnings += row.tiktok.basePayPerVideo;
      }
      
      if (isPaired) {
        if (igEligible && igIsWinner && row.ig) {
          bonusEarnings += getVideoBonus(row.ig);
        }
        if (ttEligible && ttIsWinner && row.tiktok) {
          bonusEarnings += getVideoBonus(row.tiktok);
        }
      } else {
        if (igEligible && row.ig) {
          bonusEarnings += getVideoBonus(row.ig);
        }
        if (ttEligible && row.tiktok) {
          bonusEarnings += getVideoBonus(row.tiktok);
        }
      }
    }
    
    return baseEarnings + bonusEarnings;
  };
  
  const currentCycleEarnings = calculateEarnings(relevantCurrentCycleVideos);
  
  // Calculate total paid from payouts marked as paid
  const totalPaidEarnings = payouts
    .filter(p => p.paidAt !== null)
    .reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);

  // Platform-specific breakdowns for the Creator Overview card
  const relevantIgVideos = relevantCurrentCycleVideos.filter(v => v.platform === "instagram");
  const relevantTtVideos = relevantCurrentCycleVideos.filter(v => v.platform === "tiktok");
  const eligibleIgVideos = eligibleVideos.filter(v => v.platform === "instagram");
  const eligibleTtVideos = eligibleVideos.filter(v => v.platform === "tiktok");

  // Calculate earnings breakdown (base vs bonus)
  const calculateEarningsBreakdown = (vids: VideoWithCycleInfo[]) => {
    const pairedRows = buildPairedMainRows(vids);
    let basePay = 0;
    let bonus = 0;
    
    for (const row of pairedRows) {
      const isPaired = !!row.ig && !!row.tiktok;
      
      const igEligible = row.ig && !row.ig.isIrrelevant;
      const ttEligible = row.tiktok && !row.tiktok.isIrrelevant;
      
      const igIsWinner = row.winnerPlatform === "instagram";
      const ttIsWinner = row.winnerPlatform === "tiktok";
      
      if (igEligible && row.ig) {
        basePay += row.ig.basePayPerVideo;
      }
      if (ttEligible && row.tiktok) {
        basePay += row.tiktok.basePayPerVideo;
      }
      
      if (isPaired) {
        if (igEligible && igIsWinner && row.ig) {
          bonus += getVideoBonus(row.ig);
        }
        if (ttEligible && ttIsWinner && row.tiktok) {
          bonus += getVideoBonus(row.tiktok);
        }
      } else {
        if (igEligible && row.ig) {
          bonus += getVideoBonus(row.ig);
        }
        if (ttEligible && row.tiktok) {
          bonus += getVideoBonus(row.tiktok);
        }
      }
    }
    
    return { basePay, bonus };
  };

  const currentCycleEarningsBreakdown = calculateEarningsBreakdown(relevantCurrentCycleVideos);
  
  // Calculate total paid breakdown from payouts
  const totalPaidBaseAmount = totalPaidEarnings;
  const totalPaidBonusAmount = 0;

  // Helper to get current stats snapshot
  const getCurrentStatsSnapshot = () => ({
    videos: relevantCurrentCycleVideos.length,
    igVideos: relevantIgVideos.length,
    ttVideos: relevantTtVideos.length,
    views: relevantCurrentCycleVideos.reduce((sum, v) => sum + v.views, 0),
    igViews: relevantIgVideos.reduce((sum, v) => sum + v.views, 0),
    ttViews: relevantTtVideos.reduce((sum, v) => sum + v.views, 0),
    earnings: currentCycleEarnings,
    basePay: currentCycleEarningsBreakdown.basePay,
    bonus: currentCycleEarningsBreakdown.bonus,
    following: (creator.instagramFollowers || 0) + (creator.tiktokFollowers || 0),
    igFollowers: creator.instagramFollowers || 0,
    ttFollowers: creator.tiktokFollowers || 0,
  });

  // Handler for refresh button that captures snapshot before refresh
  const handleRefreshEngagement = () => {
    // Prevent double-clicks using synchronous ref check (React state updates are async)
    if (isRefreshingRef.current) return;
    
    // Lock immediately (synchronous) before any async operations
    isRefreshingRef.current = true;
    
    // Force immediate UI update - spinner shows INSTANTLY before any other code runs
    flushSync(() => {
      setIsRefreshing(true);
    });
    
    const snapshot = getCurrentStatsSnapshot();
    setPreRefreshSnapshot(snapshot);
    setRefreshChanges(null);
    
    // Fire the sync mutation immediately (don't wait for dashboard fetch)
    syncApifyMutation.mutate();
    
    // Capture dashboard-level snapshot in the background (non-blocking)
    fetch('/api/admin/dashboard-stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(response => response.ok ? response.json() : null)
      .then(dashboardStats => {
        const currentCycle = dashboardStats?.currentCycle;
        const followers = dashboardStats?.followers;
        
        if (currentCycle && followers) {
          const dashboardSnapshot = {
            videos: currentCycle.videos,
            igVideos: currentCycle.igVideos,
            ttVideos: currentCycle.tiktokVideos,
            views: currentCycle.views,
            igViews: currentCycle.igViews,
            ttViews: currentCycle.tiktokViews,
            earnings: currentCycle.basePay + currentCycle.bonusPay,
            followers: followers.instagram + followers.tiktok,
            igFollowers: followers.instagram,
            ttFollowers: followers.tiktok,
          };
          localStorage.setItem('dashboardPreRefreshSnapshot', JSON.stringify(dashboardSnapshot));
        }
      })
      .catch(e => console.error('Failed to capture dashboard snapshot:', e));
  };

  const handleDetailDotHover = async (date: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (date === hoveredViewDate) return;
    setHoveredViewDate(date);
    if (videoCacheRef.current[date]) {
      setHoveredDateVideos(videoCacheRef.current[date]);
      return;
    }
    setIsLoadingDetailVideos(true);
    try {
      const endpoint = isAdmin ? "/api/admin/videos-by-date" : "/api/creator/videos-by-date";
      const params = new URLSearchParams({ date });
      if (creatorId) params.set('creatorId', creatorId);
      const res = await fetch(`${endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch videos');
      const data = await res.json();
      const videos = data.videos || [];
      setHoveredDateVideos(videos);
      videoCacheRef.current[date] = videos;
    } catch (error) {
      console.error('Error fetching videos by date:', error);
      setHoveredDateVideos([]);
    } finally {
      setIsLoadingDetailVideos(false);
    }
  };

  const handleDetailDotLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredViewDate(null);
      setHoveredDateVideos([]);
    }, 250);
  };

  const handleDetailPanelEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const sortedHoveredVideos = [...hoveredDateVideos].sort((a, b) => {
    if (hoverSortMode === 'views') return (b.views || 0) - (a.views || 0);
    return (b.likes || 0) - (a.likes || 0);
  });

  const handleEngDotHover = async (date: string) => {
    if (engHoverTimeoutRef.current) {
      clearTimeout(engHoverTimeoutRef.current);
      engHoverTimeoutRef.current = null;
    }
    if (date === engHoveredDate) return;
    setEngHoveredDate(date);
    if (engVideoCacheRef.current[date]) {
      setEngHoveredDateVideos(engVideoCacheRef.current[date]);
      return;
    }
    setEngIsLoadingVideos(true);
    try {
      const endpoint = isAdmin ? "/api/admin/videos-by-date" : "/api/creator/videos-by-date";
      const params = new URLSearchParams({ date });
      if (creatorId) params.set('creatorId', creatorId);
      const res = await fetch(`${endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        engVideoCacheRef.current[date] = data.videos || [];
        setEngHoveredDateVideos(data.videos || []);
      }
    } catch (e) {
      console.error("Failed to fetch videos for date:", e);
    } finally {
      setEngIsLoadingVideos(false);
    }
  };

  const handleEngDotLeave = () => {
    if (engHoverTimeoutRef.current) {
      clearTimeout(engHoverTimeoutRef.current);
    }
    engHoverTimeoutRef.current = setTimeout(() => {
      setEngHoveredDate(null);
    }, 150);
  };

  const handleEngPanelEnter = () => {
    if (engHoverTimeoutRef.current) {
      clearTimeout(engHoverTimeoutRef.current);
      engHoverTimeoutRef.current = null;
    }
  };

  const sortedEngHoveredVideos = [...engHoveredDateVideos].sort((a, b) => {
    if (engHoverSortMode === 'views') return (b.views || 0) - (a.views || 0);
    return (b.likes || 0) - (a.likes || 0);
  });

  const DetailInstagramIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  );

  const DetailTikTokIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.73a8.19 8.19 0 004.77 1.52V6.79a4.85 4.85 0 01-1.01-.1z"/>
    </svg>
  );

  // Helper to format change indicator
  const formatChange = (value: number, isCurrency = false) => {
    if (value === 0) return null;
    const prefix = value > 0 ? "+" : "";
    if (isCurrency) {
      return `${prefix}$${Math.abs(value).toFixed(2)}`;
    }
    if (Math.abs(value) >= 1000) {
      return `${prefix}${(value / 1000).toFixed(1)}K`;
    }
    return `${prefix}${value}`;
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Link href={backPath}>
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {backLabel}
        </Button>
      </Link>
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{creator.email}</h1>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {creator.instagramUsername ? (
                <Badge variant="secondary" className="gap-1 bg-gradient-to-br from-sky-500 via-pink-500 to-orange-400 text-white">
                  <SiInstagram className="w-3 h-3" />
                  Instagram Connected
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <SiInstagram className="w-3 h-3" />
                  Instagram Not Connected
                </Badge>
              )}
              {creator.tiktokUsername ? (
                <Badge variant="secondary" className="gap-1 bg-chart-2/20 text-chart-2">
                  <SiTiktok className="w-3 h-3" />
                  TikTok Connected
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <SiTiktok className="w-3 h-3" />
                  TikTok Not Connected
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1" data-testid="text-creator-joined">
              <Calendar className="w-4 h-4" />
              Joined {creator.createdAt ? formatUTCDate(creator.createdAt, "MMMM d, yyyy") : "Unknown"}
            </p>
          </div>
        </div>
      </div>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-sky-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Social Accounts</CardTitle>
              <CardDescription>
                Social media accounts set by the creator
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <SiInstagram className="w-4 h-4 text-pink-500" />
                  <span className="text-sm font-medium">Instagram</span>
                </div>
                {creator.instagramUsername && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => window.open(`https://instagram.com/${creator.instagramUsername}`, '_blank')}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    View
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-instagram-username">
                {creator.instagramUsername || "Not set by creator"}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <SiTiktok className="w-4 h-4" />
                  <span className="text-sm font-medium">TikTok</span>
                </div>
                {creator.tiktokUsername && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => window.open(`https://tiktok.com/@${creator.tiktokUsername}`, '_blank')}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    View
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-tiktok-username">
                {creator.tiktokUsername ? `@${creator.tiktokUsername}` : "Not set by creator"}
              </p>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleRefreshEngagement}
                disabled={isRefreshing || (!creator.instagramUsername && !creator.tiktokUsername)}
                data-testid="button-sync-creator-apify"
              >
                {isRefreshing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Refresh Engagement
              </Button>
              {lastRefreshedAt && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {isAdmin && (<><Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Account Status</CardTitle>
              <CardDescription>
                Trial and activation status
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="p-4 rounded-lg bg-muted flex-1 mr-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">Status</span>
              </div>
              {creator.trialCompleted ? (
                <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              ) : creator.trialEndsAt ? (
                <div className="space-y-1">
                  <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    In Trial
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Trial ends: {formatUTCDate(creator.trialEndsAt, "MMMM d, yyyy")}
                  </p>
                </div>
              ) : (
                <Badge variant="secondary">New</Badge>
              )}
            </div>
            {!creator.trialCompleted && (
              <Button
                variant="outline"
                onClick={() => skipTrialMutation.mutate()}
                disabled={skipTrialMutation.isPending}
                data-testid="button-skip-trial"
              >
                {skipTrialMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Skip Trial
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
              <UserX className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Account Management</CardTitle>
              <CardDescription>
                {creator.isDeleted ? "This creator account has been deleted" : "Pause or delete this creator account"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {creator.isDeleted ? (
              <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                <div>
                  <p className="font-medium text-sm text-green-700 dark:text-green-400">Revive Account</p>
                  <p className="text-xs text-green-600 dark:text-green-500">
                    Restore this creator account to make it active again.
                  </p>
                </div>
                <Button
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => reviveCreatorMutation.mutate()}
                  disabled={reviveCreatorMutation.isPending}
                >
                  {reviveCreatorMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4 mr-2" />
                  )}
                  Revive
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                  <div>
                    <p className="font-medium text-sm">Pause Account</p>
                    <p className="text-xs text-muted-foreground">
                      {creator.isPaused 
                        ? "Account is paused. Unpaid video views are not counted." 
                        : "Pausing will stop counting unpaid video views."}
                    </p>
                  </div>
                  <Button
                    variant={creator.isPaused ? "default" : "outline"}
                    onClick={() => pauseCreatorMutation.mutate(!creator.isPaused)}
                    disabled={pauseCreatorMutation.isPending}
                    className={creator.isPaused ? "bg-amber-500 hover:bg-amber-600" : ""}
                  >
                    {pauseCreatorMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : creator.isPaused ? (
                      <Play className="w-4 h-4 mr-2" />
                    ) : (
                      <Pause className="w-4 h-4 mr-2" />
                    )}
                    {creator.isPaused ? "Resume" : "Pause"}
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                  <div>
                    <p className="font-medium text-sm text-red-700 dark:text-red-400">Delete Account</p>
                    <p className="text-xs text-red-600 dark:text-red-500">
                      Remove this creator from the system. Can be revived later.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete this creator?")) {
                        deleteCreatorMutation.mutate();
                      }
                    }}
                    disabled={deleteCreatorMutation.isPending}
                  >
                    {deleteCreatorMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Delete
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Payment Information</CardTitle>
              <CardDescription>
                PayPal email for payouts
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isEditingPaypal ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-first-name">First Name</Label>
                  <Input
                    id="edit-first-name"
                    placeholder="First name"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-last-name">Last Name</Label>
                  <Input
                    id="edit-last-name"
                    placeholder="Last name"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paypal-email">PayPal Email Address</Label>
                <Input
                  id="paypal-email"
                  type="email"
                  placeholder="creator@paypal.com"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  data-testid="input-admin-paypal-email"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => updatePaypalMutation.mutate({ paypalEmail, firstName: editFirstName, lastName: editLastName })}
                  disabled={updatePaypalMutation.isPending || !paypalEmail.trim()}
                  data-testid="button-save-paypal"
                >
                  {updatePaypalMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditingPaypal(false);
                    setPaypalEmail("");
                    setEditFirstName("");
                    setEditLastName("");
                  }}
                  data-testid="button-cancel-paypal"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="p-4 rounded-lg bg-muted flex-1 mr-4 space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">Name</span>
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid="text-creator-name">
                    {creator.firstName && creator.lastName 
                      ? `${creator.firstName} ${creator.lastName}` 
                      : "Not set by creator"}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm font-medium">PayPal Email</span>
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid="text-creator-paypal">
                    {creator.paypalEmail || "Not set by creator"}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setPaypalEmail(creator.paypalEmail || "");
                  setEditFirstName(creator.firstName || "");
                  setEditLastName(creator.lastName || "");
                  setIsEditingPaypal(true);
                }}
                data-testid="button-edit-paypal"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card></>)}
      {isAdmin && (<Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Custom Base Pay</CardTitle>
              <CardDescription>
                Override the default base pay per video for this creator (applies immediately)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isEditingBasePay ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="custom-instagram-base-pay" className="flex items-center gap-2">
                    <SiInstagram className="w-4 h-4 text-pink-500" />
                    Instagram ($)
                  </Label>
                  <Input
                    id="custom-instagram-base-pay"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="System default"
                    value={customInstagramBasePay}
                    onChange={(e) => setCustomInstagramBasePay(e.target.value.replace(/\D/g, ''))}
                    data-testid="input-custom-instagram-base-pay"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-tiktok-base-pay" className="flex items-center gap-2">
                    <SiTiktok className="w-4 h-4" />
                    TikTok ($)
                  </Label>
                  <Input
                    id="custom-tiktok-base-pay"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="System default"
                    value={customTiktokBasePay}
                    onChange={(e) => setCustomTiktokBasePay(e.target.value.replace(/\D/g, ''))}
                    data-testid="input-custom-tiktok-base-pay"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to use the system rate. Changes apply immediately to current cycle.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => updateBasePayMutation.mutate({
                    customInstagramBasePay: customInstagramBasePay,
                    customTiktokBasePay: customTiktokBasePay,
                  })}
                  disabled={updateBasePayMutation.isPending}
                  data-testid="button-save-base-pay"
                >
                  {updateBasePayMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditingBasePay(false);
                    setCustomInstagramBasePay("");
                    setCustomTiktokBasePay("");
                  }}
                  data-testid="button-cancel-base-pay"
                >
                  Cancel
                </Button>
                {(creator.customInstagramBasePay !== null || creator.customTiktokBasePay !== null) && (
                  <Button
                    variant="destructive"
                    onClick={() => updateBasePayMutation.mutate({
                      customInstagramBasePay: "",
                      customTiktokBasePay: "",
                    })}
                    disabled={updateBasePayMutation.isPending}
                    data-testid="button-reset-base-pay"
                  >
                    Reset All to Default
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 mr-4">
                <div className="p-4 rounded-lg bg-muted">
                  <div className="flex items-center gap-2 mb-1">
                    <SiInstagram className="w-4 h-4 text-pink-500" />
                    <span className="text-sm font-medium">Instagram</span>
                  </div>
                  <p className="text-sm" data-testid="text-custom-instagram-base-pay">
                    {creator.customInstagramBasePay !== null ? (
                      <span className="text-foreground font-medium">
                        ${creator.customInstagramBasePay} <span className="text-muted-foreground font-normal text-xs">(Custom)</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <div className="flex items-center gap-2 mb-1">
                    <SiTiktok className="w-4 h-4" />
                    <span className="text-sm font-medium">TikTok</span>
                  </div>
                  <p className="text-sm" data-testid="text-custom-tiktok-base-pay">
                    {creator.customTiktokBasePay !== null ? (
                      <span className="text-foreground font-medium">
                        ${creator.customTiktokBasePay} <span className="text-muted-foreground font-normal text-xs">(Custom)</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setCustomInstagramBasePay(creator.customInstagramBasePay?.toString() || "");
                  setCustomTiktokBasePay(creator.customTiktokBasePay?.toString() || "");
                  setIsEditingBasePay(true);
                }}
                data-testid="button-edit-base-pay"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>)}
      {isAdmin && (<Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Current Cycle Payment</CardTitle>
              <CardDescription>
                Payment status for the current cycle
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="p-4 rounded-lg bg-muted flex-1">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm font-medium">Amount Owed</span>
                  </div>
                  <p className="text-lg font-bold">
                    {formatCurrency(currentCycleEarnings)}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">Status</span>
                  </div>
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-600 dark:text-blue-400">
                    <Clock className="w-3 h-3 mr-1" />
                    Ongoing
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>)}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Creator Overview</CardTitle>
                <CardDescription>Performance stats for this creator</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={overviewMode === "cycle" ? "default" : "ghost"}
                size="sm"
                onClick={() => setOverviewMode("cycle")}
                className="text-xs h-7"
              >
                Current Cycle
              </Button>
              <Button
                variant={overviewMode === "allTime" ? "default" : "ghost"}
                size="sm"
                onClick={() => setOverviewMode("allTime")}
                className="text-xs h-7"
              >
                All Time
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-center gap-2 mb-2">
                <Video className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium text-muted-foreground">
                  {overviewMode === "cycle" ? "Videos This Cycle" : "Eligible Videos"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold tabular-nums">
                  {overviewMode === "cycle" ? relevantCurrentCycleVideos.length : (allTimeStats?.totalVideos ?? eligibleVideos.length)}
                </p>
                {overviewMode === "cycle" && refreshChanges && refreshChanges.videos !== 0 && (
                  <span className={`text-sm font-medium ${refreshChanges.videos > 0 ? "text-green-500" : "text-red-500"}`}>
                    {formatChange(refreshChanges.videos)}
                  </span>
                )}
              </div>
              <div className="flex flex-col space-y-1 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <SiInstagram className="w-3 h-3 text-pink-500" />
                  <span className="tabular-nums">
                    {overviewMode === "cycle" ? relevantIgVideos.length : (allTimeStats?.igVideos ?? eligibleIgVideos.length)}
                  </span>
                  {overviewMode === "cycle" && refreshChanges && refreshChanges.igVideos !== 0 && (
                    <span className={`text-xs font-medium ${refreshChanges.igVideos > 0 ? "text-green-500" : "text-red-500"}`}>
                      {formatChange(refreshChanges.igVideos)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <SiTiktok className="w-3 h-3" />
                  <span className="tabular-nums">
                    {overviewMode === "cycle" ? relevantTtVideos.length : (allTimeStats?.tiktokVideos ?? eligibleTtVideos.length)}
                  </span>
                  {overviewMode === "cycle" && refreshChanges && refreshChanges.ttVideos !== 0 && (
                    <span className={`text-xs font-medium ${refreshChanges.ttVideos > 0 ? "text-green-500" : "text-red-500"}`}>
                      {formatChange(refreshChanges.ttVideos)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-green-500" />
                <span className="text-xs font-medium text-muted-foreground">
                  {overviewMode === "cycle" ? "Views This Cycle" : "Eligible Views"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold tabular-nums">
                  {overviewMode === "cycle" 
                    ? formatNumber(relevantCurrentCycleVideos.reduce((sum, v) => sum + v.views, 0))
                    : formatNumber(allTimeStats?.totalViews ?? eligibleVideos.reduce((sum, v) => sum + v.views, 0))}
                </p>
                {overviewMode === "cycle" && refreshChanges && refreshChanges.views !== 0 && (
                  <span className={`text-sm font-medium ${refreshChanges.views > 0 ? "text-green-500" : "text-red-500"}`}>
                    {formatChange(refreshChanges.views)}
                  </span>
                )}
              </div>
              <div className="flex flex-col space-y-1 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <SiInstagram className="w-3 h-3 text-pink-500" />
                  <span className="tabular-nums">
                    {overviewMode === "cycle" 
                      ? formatNumber(relevantIgVideos.reduce((sum, v) => sum + v.views, 0))
                      : formatNumber(allTimeStats?.igViews ?? eligibleIgVideos.reduce((sum, v) => sum + v.views, 0))}
                  </span>
                  {overviewMode === "cycle" && refreshChanges && refreshChanges.igViews !== 0 && (
                    <span className={`text-xs font-medium ${refreshChanges.igViews > 0 ? "text-green-500" : "text-red-500"}`}>
                      {formatChange(refreshChanges.igViews)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <SiTiktok className="w-3 h-3" />
                  <span className="tabular-nums">
                    {overviewMode === "cycle" 
                      ? formatNumber(relevantTtVideos.reduce((sum, v) => sum + v.views, 0))
                      : formatNumber(allTimeStats?.tiktokViews ?? eligibleTtVideos.reduce((sum, v) => sum + v.views, 0))}
                  </span>
                  {overviewMode === "cycle" && refreshChanges && refreshChanges.ttViews !== 0 && (
                    <span className={`text-xs font-medium ${refreshChanges.ttViews > 0 ? "text-green-500" : "text-red-500"}`}>
                      {formatChange(refreshChanges.ttViews)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {isAdmin && (
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {overviewMode === "cycle" ? "Earnings This Cycle" : "Total Paid"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold tabular-nums">
                    {overviewMode === "cycle"
                      ? formatCurrency(currentCycleEarnings)
                      : formatCurrency(totalPaidEarnings)}
                  </p>
                  {overviewMode === "cycle" && refreshChanges && refreshChanges.earnings !== 0 && (
                    <span className={`text-sm font-medium ${refreshChanges.earnings > 0 ? "text-green-500" : "text-red-500"}`}>
                      {formatChange(refreshChanges.earnings, true)}
                    </span>
                  )}
                </div>
                <div className="flex flex-col space-y-1 mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span>Base</span>
                    <span className="tabular-nums">
                      {overviewMode === "cycle"
                        ? formatCurrency(currentCycleEarningsBreakdown.basePay)
                        : formatCurrency(totalPaidBaseAmount)}
                    </span>
                    {overviewMode === "cycle" && refreshChanges && refreshChanges.basePay !== 0 && (
                      <span className={`text-xs font-medium ${refreshChanges.basePay > 0 ? "text-green-500" : "text-red-500"}`}>
                        {formatChange(refreshChanges.basePay, true)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Bonus</span>
                    <span className="tabular-nums">
                      {overviewMode === "cycle"
                        ? formatCurrency(currentCycleEarningsBreakdown.bonus)
                        : formatCurrency(totalPaidBonusAmount)}
                    </span>
                    {overviewMode === "cycle" && refreshChanges && refreshChanges.bonus !== 0 && (
                      <span className={`text-xs font-medium ${refreshChanges.bonus > 0 ? "text-green-500" : "text-red-500"}`}>
                        {formatChange(refreshChanges.bonus, true)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-cyan-500" />
                <span className="text-xs font-medium text-muted-foreground">Total Following</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold tabular-nums">
                  {formatNumber((creator.instagramFollowers || 0) + (creator.tiktokFollowers || 0))}
                </p>
                {refreshChanges && refreshChanges.following !== 0 && (
                  <span className={`text-sm font-medium ${refreshChanges.following > 0 ? "text-green-500" : "text-red-500"}`}>
                    {formatChange(refreshChanges.following)}
                  </span>
                )}
              </div>
              <div className="flex flex-col space-y-1 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <SiInstagram className="w-3 h-3 text-pink-500" />
                  <span className="tabular-nums">{formatNumber(creator.instagramFollowers || 0)}</span>
                  {refreshChanges && refreshChanges.igFollowers !== 0 && (
                    <span className={`text-xs font-medium ${refreshChanges.igFollowers > 0 ? "text-green-500" : "text-red-500"}`}>
                      {formatChange(refreshChanges.igFollowers)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <SiTiktok className="w-3 h-3" />
                  <span className="tabular-nums">{formatNumber(creator.tiktokFollowers || 0)}</span>
                  {refreshChanges && refreshChanges.ttFollowers !== 0 && (
                    <span className={`text-xs font-medium ${refreshChanges.ttFollowers > 0 ? "text-green-500" : "text-red-500"}`}>
                      {formatChange(refreshChanges.ttFollowers)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Views Bar Chart & Engagement Rate Side by Side */}
      <div className="flex items-center justify-end mb-3">
        <div className="flex bg-gray-100 dark:bg-[#1a1a1a] rounded-lg p-1">
          {([7, 14, 30, 'all'] as const).map((days) => (
            <button
              key={days}
              onClick={() => setViewsDayRange(days)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewsDayRange === days
                  ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {days === 'all' ? 'All' : `${days}d`}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Views Bar Chart */}
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525]">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-[#252525]">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-sky-500" />
              <h2 className="font-bold text-lg text-gray-900 dark:text-white">Views</h2>
            </div>
          </div>
          <div className="p-4">
            {dailyViewsData?.dataPoints && dailyViewsData.dataPoints.length > 0 ? (
              <div ref={viewsChartRef} className="relative w-full">
                <svg viewBox="0 0 500 300" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <linearGradient id="detailBarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgb(168, 85, 247)" />
                      <stop offset="100%" stopColor="rgb(126, 34, 206)" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const maxViews = Math.max(...dailyViewsData.dataPoints.map(d => d.views), 1);
                    return [0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                      const value = Math.round(maxViews * (1 - pct));
                      const label = value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}K` : `${value}`;
                      return (
                        <text key={i} x="40" y={40 + i * 50} textAnchor="end" className="text-[10px] fill-gray-400 dark:fill-gray-500">
                          {label}
                        </text>
                      );
                    });
                  })()}
                  {(() => {
                    const maxViews = Math.max(...dailyViewsData.dataPoints.map(d => d.views), 1);
                    const numBars = dailyViewsData.dataPoints.length;
                    const chartWidth = 430;
                    const startX = 50;
                    const slotWidth = chartWidth / numBars;
                    const barWidth = Math.min(30, slotWidth * 0.7);
                    const gap = Math.min(10, slotWidth * 0.3);
                    const actualTotalWidth = numBars * barWidth + (numBars - 1) * gap;
                    const centerOffset = (chartWidth - actualTotalWidth) / 2;
                    
                    return dailyViewsData.dataPoints.map((d, i) => {
                      const barHeight = Math.max(3, (d.views / maxViews) * 200);
                      const x = startX + centerOffset + i * (barWidth + gap);
                      const y = 240 - barHeight;
                      const isHovered = hoveredViewDate === d.date;
                      const cornerRadius = Math.min(barWidth / 2, 6);
                      
                      return (
                        <g key={d.date}>
                          <path
                            d={`M${x},${240} L${x},${y + cornerRadius} Q${x},${y} ${x + cornerRadius},${y} L${x + barWidth - cornerRadius},${y} Q${x + barWidth},${y} ${x + barWidth},${y + cornerRadius} L${x + barWidth},${240} Z`}
                            fill="url(#detailBarGradient)"
                            className={`cursor-pointer transition-all duration-300 ${isHovered ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
                            style={{ 
                              filter: isHovered ? 'brightness(1.2) drop-shadow(0 0 6px rgba(168, 85, 247, 0.6))' : 'none',
                            }}
                            onMouseEnter={() => handleDetailDotHover(d.date)}
                            onMouseLeave={handleDetailDotLeave}
                          />
                          {isHovered && (
                            <g>
                              <rect
                                x={Math.max(50, Math.min(x + barWidth / 2 - 50, 400))}
                                y={Math.max(5, y - 45)}
                                width="100"
                                height="38"
                                rx="6"
                                fill="rgba(26, 26, 26, 0.95)"
                                className="dark:fill-gray-800"
                                style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}
                              />
                              <text x={Math.max(100, Math.min(x + barWidth / 2, 450))} y={Math.max(20, y - 28)} textAnchor="middle" className="text-[9px] fill-white font-medium">
                                {formatUTCDate(d.date, "MMM d, yyyy")}
                              </text>
                              <text x={Math.max(100, Math.min(x + barWidth / 2, 450))} y={Math.max(34, y - 14)} textAnchor="middle" className="text-[9px] fill-sky-400 font-semibold">
                                {d.views >= 1000000 ? `${(d.views / 1000000).toFixed(1)}M` : d.views >= 1000 ? `${(d.views / 1000).toFixed(1)}K` : d.views} views
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    });
                  })()}
                  {dailyViewsData.dataPoints.filter((_, i, arr) => {
                    if (arr.length <= 7) return true;
                    if (arr.length <= 14) return i % 2 === 0;
                    if (arr.length <= 30) return i % 5 === 0 || i === arr.length - 1;
                    return i % Math.ceil(arr.length / 7) === 0 || i === arr.length - 1;
                  }).map((d) => {
                    const originalIndex = dailyViewsData.dataPoints.findIndex(p => p.date === d.date);
                    const numBars = dailyViewsData.dataPoints.length;
                    const chartWidth = 430;
                    const startX = 50;
                    const slotWidth = chartWidth / numBars;
                    const barWidth = Math.min(30, slotWidth * 0.7);
                    const gap = Math.min(10, slotWidth * 0.3);
                    const actualTotalWidth = numBars * barWidth + (numBars - 1) * gap;
                    const centerOffset = (chartWidth - actualTotalWidth) / 2;
                    const x = startX + centerOffset + originalIndex * (barWidth + gap) + barWidth / 2;
                    return (
                      <text key={d.date} x={x} y="270" textAnchor="middle" className="text-[9px] fill-gray-400 dark:fill-gray-500">
                        {formatUTCDate(d.date, "MMM d")}
                      </text>
                    );
                  })}
                </svg>
                {hoveredViewDate && !playingHoverVideo && dailyViewsData?.dataPoints && (() => {
                  const totalPoints = dailyViewsData.dataPoints.length;
                  const hoveredIndex = dailyViewsData.dataPoints.findIndex(d => d.date === hoveredViewDate);
                  if (hoveredIndex === -1) return null;
                  const d = dailyViewsData.dataPoints[hoveredIndex];
                  const isRightSide = hoveredIndex > totalPoints / 2;
                  
                  const numBars = totalPoints;
                  const chartWidth = 430;
                  const startX = 50;
                  const slotWidth = chartWidth / numBars;
                  const barWidth = Math.min(30, slotWidth * 0.7);
                  const gap = Math.min(10, slotWidth * 0.3);
                  const actualTotalWidth = numBars * barWidth + (numBars - 1) * gap;
                  const centerOffset = (chartWidth - actualTotalWidth) / 2;
                  const barX = startX + centerOffset + hoveredIndex * (barWidth + gap) + barWidth / 2;
                  
                  const containerEl = viewsChartRef.current;
                  if (!containerEl) return null;
                  const svgEl = containerEl.querySelector('svg');
                  if (!svgEl) return null;
                  const svgRect = svgEl.getBoundingClientRect();
                  const containerRect = containerEl.getBoundingClientRect();
                  const scaleX = svgRect.width / 500;
                  const pixelX = svgRect.left - containerRect.left + barX * scaleX;
                  const panelLeft = isRightSide ? pixelX - 260 : pixelX;
                  
                  return (
                    <div 
                      className="absolute z-50 pointer-events-auto"
                      style={{ top: '100%', left: `${Math.max(0, Math.min(panelLeft, containerRect.width - 300))}px`, marginTop: '8px' }}
                      onMouseEnter={handleDetailPanelEnter}
                      onMouseLeave={handleDetailDotLeave}
                    >
                      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl border border-gray-200 dark:border-[#333] min-w-[260px] max-w-[300px] overflow-hidden">
                        <div className={`absolute -top-2 ${isRightSide ? 'right-4' : 'left-4'} w-4 h-4 bg-white dark:bg-[#1a1a1a] transform rotate-45 border-l border-t border-gray-200 dark:border-[#333]`}></div>
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-[#333]">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-900 dark:text-white font-medium text-sm">
                              {formatUTCDate(d.date, "MMMM d, yyyy")}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">UTC</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                            <span className="text-sm text-sky-400">
                              {d.views >= 1000000 ? `${(d.views / 1000000).toFixed(1)}M` : d.views >= 1000 ? `${(d.views / 1000).toFixed(1)}K` : d.views} views
                            </span>
                          </div>
                        </div>
                        <div className="flex border-b border-gray-200 dark:border-[#333]">
                          <button onClick={(e) => { e.stopPropagation(); setHoverSortMode('views'); }} className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${hoverSortMode === 'views' ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-[#252525]' : 'text-gray-500 dark:text-gray-400'}`}>Most Views</button>
                          <button onClick={(e) => { e.stopPropagation(); setHoverSortMode('likes'); }} className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${hoverSortMode === 'likes' ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-[#252525]' : 'text-gray-500 dark:text-gray-400'}`}>Most Liked</button>
                        </div>
                        <div className="max-h-[320px] overflow-y-auto">
                          {isLoadingDetailVideos ? (
                            <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                          ) : sortedHoveredVideos.length > 0 ? (
                            <div className="divide-y divide-gray-100 dark:divide-[#333]">
                              {sortedHoveredVideos.map((video) => (
                                <button key={video.id} onClick={() => { if (video.platformVideoId) { setPlayingHoverVideo(video); setPlayingVideoId(video.id); } else if (video.url) { window.open(video.url, '_blank'); } }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors w-full text-left">
                                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
                                    {video.thumbnailUrl ? (
                                      <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center"><Play className="w-4 h-4 text-gray-400" /></div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      {video.platform === 'instagram' ? <DetailInstagramIcon className="w-3 h-3 text-pink-400" /> : <DetailTikTokIcon className="w-3 h-3 text-gray-900 dark:text-white" />}
                                      <span className="text-xs text-gray-500 truncate">@{video.username || video.creatorName || 'creator'}</span>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-1">{video.caption || 'No caption'}</p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                      {hoverSortMode === 'views' ? (video.views >= 1000 ? `${(video.views / 1000).toFixed(1)}K` : video.views) : (video.likes >= 1000 ? `${(video.likes / 1000).toFixed(1)}K` : video.likes)}
                                    </p>
                                    <p className="text-xs text-gray-500">{hoverSortMode === 'views' ? 'views' : 'likes'}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500 text-sm">No videos on this date</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Eye className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No view data available yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Engagement Rate Line Graph */}
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525]">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-[#252525]">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-sky-500" />
              <h2 className="font-bold text-lg text-gray-900 dark:text-white">Engagement Rate</h2>
            </div>
          </div>
          <div className="p-4">
            {dailyViewsData?.dataPoints && dailyViewsData.dataPoints.length > 0 ? (
              <div ref={engagementChartRef} className="relative w-full">
                <svg viewBox="0 0 500 300" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <linearGradient id="detailEngagementGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const maxEngagement = Math.max(...dailyViewsData.dataPoints.map(d => d.engagementRate), 1);
                    return [0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                      const value = maxEngagement * (1 - pct);
                      return (
                        <text key={i} x="40" y={40 + i * 50} textAnchor="end" className="text-[10px] fill-gray-400 dark:fill-gray-500">
                          {value.toFixed(1)}%
                        </text>
                      );
                    });
                  })()}
                  {(() => {
                    const maxEngagement = Math.max(...dailyViewsData.dataPoints.map(d => d.engagementRate), 1);
                    const points = dailyViewsData.dataPoints.map((d, i) => {
                      const x = 50 + (i / (dailyViewsData.dataPoints.length - 1 || 1)) * 430;
                      const y = 240 - (d.engagementRate / maxEngagement) * 200;
                      return `${x},${y}`;
                    });
                    const areaPath = `M50,240 L${points.join(' L')} L480,240 Z`;
                    
                    return (
                      <>
                        <path d={areaPath} fill="url(#detailEngagementGradient)" />
                        <polyline points={points.join(' ')} fill="none" stroke="rgb(16, 185, 129)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        {dailyViewsData.dataPoints.map((d, i) => {
                          const x = 50 + (i / (dailyViewsData.dataPoints.length - 1 || 1)) * 430;
                          const y = 240 - (d.engagementRate / maxEngagement) * 200;
                          const isHovered = engHoveredDate === d.date;
                          
                          return (
                            <g key={i}>
                              <circle 
                                cx={x} cy={y} r="10" fill="transparent" className="cursor-pointer"
                                onMouseEnter={() => handleEngDotHover(d.date)}
                                onMouseLeave={handleEngDotLeave}
                              />
                              <circle cx={x} cy={y} r="6" fill="rgb(16, 185, 129)" fillOpacity={isHovered ? "0.4" : "0.2"} className="pointer-events-none" />
                              <circle cx={x} cy={y} r="4" fill="white" stroke="rgb(16, 185, 129)" strokeWidth="2" className="pointer-events-none" />
                              {isHovered && (
                                <g>
                                  <rect x={Math.max(50, Math.min(x - 55, 390))} y={Math.max(5, y - 45)} width="110" height="38" rx="6" fill="#1a1a1a" className="dark:fill-gray-800" />
                                  <text x={Math.max(105, Math.min(x, 445))} y={Math.max(20, y - 28)} textAnchor="middle" className="text-[9px] fill-white font-medium">
                                    {formatUTCDate(d.date, "MMM d")}
                                  </text>
                                  <text x={Math.max(105, Math.min(x, 445))} y={Math.max(34, y - 14)} textAnchor="middle" className="text-[9px] fill-sky-400 font-medium">
                                    {d.engagementRate.toFixed(2)}% engagement
                                  </text>
                                </g>
                              )}
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                  {dailyViewsData.dataPoints.filter((_, i, arr) => {
                    if (arr.length <= 7) return true;
                    if (arr.length <= 14) return i % 2 === 0;
                    if (arr.length <= 30) return i % 5 === 0 || i === arr.length - 1;
                    return i % Math.ceil(arr.length / 7) === 0 || i === arr.length - 1;
                  }).map((d) => {
                    const originalIndex = dailyViewsData.dataPoints.findIndex(p => p.date === d.date);
                    const x = 50 + (originalIndex / (dailyViewsData.dataPoints.length - 1 || 1)) * 430;
                    return (
                      <text key={d.date} x={x} y="270" textAnchor="middle" className="text-[9px] fill-gray-400 dark:fill-gray-500">
                        {formatUTCDate(d.date, "MMM d")}
                      </text>
                    );
                  })}
                </svg>
                {engHoveredDate && !playingHoverVideo && dailyViewsData?.dataPoints && (() => {
                  const totalPoints = dailyViewsData.dataPoints.length;
                  const hoveredIndex = dailyViewsData.dataPoints.findIndex(d => d.date === engHoveredDate);
                  if (hoveredIndex === -1) return null;
                  const d = dailyViewsData.dataPoints[hoveredIndex];
                  const isRightSide = hoveredIndex > totalPoints / 2;
                  
                  const dotX = 50 + (hoveredIndex / (totalPoints - 1 || 1)) * 430;
                  
                  const containerEl = engagementChartRef.current;
                  if (!containerEl) return null;
                  const svgEl = containerEl.querySelector('svg');
                  if (!svgEl) return null;
                  const svgRect = svgEl.getBoundingClientRect();
                  const containerRect = containerEl.getBoundingClientRect();
                  const scaleX = svgRect.width / 500;
                  const pixelX = svgRect.left - containerRect.left + dotX * scaleX;
                  const panelLeft = isRightSide ? pixelX - 260 : pixelX;
                  
                  return (
                    <div 
                      className="absolute z-50 pointer-events-auto"
                      style={{ top: '100%', left: `${Math.max(0, Math.min(panelLeft, containerRect.width - 300))}px`, marginTop: '8px' }}
                      onMouseEnter={handleEngPanelEnter}
                      onMouseLeave={handleEngDotLeave}
                    >
                      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl border border-gray-200 dark:border-[#333] min-w-[260px] max-w-[300px] overflow-hidden">
                        <div className={`absolute -top-2 ${isRightSide ? 'right-4' : 'left-4'} w-4 h-4 bg-white dark:bg-[#1a1a1a] transform rotate-45 border-l border-t border-gray-200 dark:border-[#333]`}></div>
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-[#333]">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-900 dark:text-white font-medium text-sm">
                              {formatUTCDate(d.date, "MMMM d, yyyy")}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">UTC</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                            <span className="text-sm text-sky-400">
                              {d.engagementRate.toFixed(2)}% engagement
                            </span>
                          </div>
                        </div>
                        <div className="flex border-b border-gray-200 dark:border-[#333]">
                          <button onClick={(e) => { e.stopPropagation(); setEngHoverSortMode('views'); }} className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${engHoverSortMode === 'views' ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-[#252525]' : 'text-gray-500 dark:text-gray-400'}`}>Most Views</button>
                          <button onClick={(e) => { e.stopPropagation(); setEngHoverSortMode('likes'); }} className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${engHoverSortMode === 'likes' ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-[#252525]' : 'text-gray-500 dark:text-gray-400'}`}>Most Liked</button>
                        </div>
                        <div className="max-h-[320px] overflow-y-auto">
                          {engIsLoadingVideos ? (
                            <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                          ) : sortedEngHoveredVideos.length > 0 ? (
                            <div className="divide-y divide-gray-100 dark:divide-[#333]">
                              {sortedEngHoveredVideos.map((video) => (
                                <button key={video.id} onClick={() => { if (video.platformVideoId) { setPlayingHoverVideo(video); setPlayingVideoId(video.id); } else if (video.url) { window.open(video.url, '_blank'); } }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors w-full text-left">
                                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
                                    {video.thumbnailUrl ? (
                                      <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center"><Play className="w-4 h-4 text-gray-400" /></div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      {video.platform === 'instagram' ? <DetailInstagramIcon className="w-3 h-3 text-pink-400" /> : <DetailTikTokIcon className="w-3 h-3 text-gray-900 dark:text-white" />}
                                      <span className="text-xs text-gray-500 truncate">@{video.username || video.creatorName || 'creator'}</span>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-1">{video.caption || 'No caption'}</p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                      {engHoverSortMode === 'views' ? (video.views >= 1000 ? `${(video.views / 1000).toFixed(1)}K` : video.views) : (video.likes >= 1000 ? `${(video.likes / 1000).toFixed(1)}K` : video.likes)}
                                    </p>
                                    <p className="text-xs text-gray-500">{engHoverSortMode === 'views' ? 'views' : 'likes'}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500 text-sm">No videos on this date</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No engagement data available yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="videos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="videos" data-testid="tab-videos">
            Videos ({eligibleVideos.length})
          </TabsTrigger>
          <TabsTrigger value="violations" data-testid="tab-violations">
            Violations ({violations.length})
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="payouts" data-testid="tab-payouts">
              Payout History ({payouts.length})
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="bounties" data-testid="tab-bounties">
              Bounties
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="streak-survivor">
              Streak Survivor
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="videos">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 via-pink-500 to-orange-400 flex items-center justify-center">
                    <Video className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Videos - Current Cycle</CardTitle>
                    <CardDescription>
                      {relevantCurrentCycleVideos.length} videos in current cycle ({relevantCurrentCycleVideos.filter(v => v.platform === "instagram").length} IG, {relevantCurrentCycleVideos.filter(v => v.platform === "tiktok").length} TT)
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {currentCycleVideos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Video className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No videos in current cycle</h3>
                    <p className="text-muted-foreground">
                      This creator hasn't synced any videos for this cycle.
                    </p>
                  </div>
                ) : (
                  <>
                  <FilterButtons activeFilter={currentCycleFilter} onFilterChange={setCurrentCycleFilter} />
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Date</TableHead>
                          <TableHead className="w-28">IG Caption</TableHead>
                          <TableHead className="text-center w-36">
                            <div className="flex items-center justify-center gap-1">
                              <SiInstagram className="w-3 h-3 text-pink-500" />
                              Instagram
                            </div>
                          </TableHead>
                          <TableHead className="w-28">TT Caption</TableHead>
                          <TableHead className="text-center w-36">
                            <div className="flex items-center justify-center gap-1">
                              <SiTiktok className="w-3 h-3" />
                              TikTok
                            </div>
                          </TableHead>
                          <TableHead className="text-right w-20">Base Pay</TableHead>
                          <TableHead className="text-right w-20">Bonus</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {buildPairedMainRows(currentCycleVideos)
                          .sort((a, b) => {
                            if (currentCycleFilter === "views") {
                              const aViews = Math.max(a.ig?.views || 0, a.tiktok?.views || 0);
                              const bViews = Math.max(b.ig?.views || 0, b.tiktok?.views || 0);
                              return bViews - aViews;
                            }
                            if (currentCycleFilter === "payment") {
                              const aIgWinner = a.winnerPlatform === "instagram" || (a.winnerPlatform === null && !!a.ig && !a.tiktok);
                              const aTtWinner = a.winnerPlatform === "tiktok" || (a.winnerPlatform === null && !!a.tiktok && !a.ig);
                              const bIgWinner = b.winnerPlatform === "instagram" || (b.winnerPlatform === null && !!b.ig && !b.tiktok);
                              const bTtWinner = b.winnerPlatform === "tiktok" || (b.winnerPlatform === null && !!b.tiktok && !b.ig);
                              
                              const aPay = (aIgWinner && a.ig ? a.ig.basePayPerVideo + getVideoBonus(a.ig) : 0) +
                                           (aTtWinner && a.tiktok ? a.tiktok.basePayPerVideo + getVideoBonus(a.tiktok) : 0);
                              const bPay = (bIgWinner && b.ig ? b.ig.basePayPerVideo + getVideoBonus(b.ig) : 0) +
                                           (bTtWinner && b.tiktok ? b.tiktok.basePayPerVideo + getVideoBonus(b.tiktok) : 0);
                              return bPay - aPay;
                            }
                            return b.date.getTime() - a.date.getTime();
                          })
                          .map((row) => {
                            const igEligible = row.ig && !row.ig.isIrrelevant;
                            const ttEligible = row.tiktok && !row.tiktok.isIrrelevant;
                            const isPaired = !!row.ig && !!row.tiktok;
                            
                            // For paired videos, winner is determined by views (IG wins ties)
                            const igIsWinner = row.winnerPlatform === "instagram";
                            const ttIsWinner = row.winnerPlatform === "tiktok";
                            
                            const totalBasePay = (igEligible && row.ig ? row.ig.basePayPerVideo : 0) + (ttEligible && row.tiktok ? row.tiktok.basePayPerVideo : 0);
                            const igPaysBonus = isPaired ? (igEligible && igIsWinner) : !!igEligible;
                            const ttPaysBonus = isPaired ? (ttEligible && ttIsWinner) : !!ttEligible;
                            const totalBonus = (igPaysBonus && row.ig ? getVideoBonus(row.ig) : 0) + (ttPaysBonus && row.tiktok ? getVideoBonus(row.tiktok) : 0);
                            const hasAnyEligible = !!(igEligible || ttEligible);

                            const renderVideoCard = (video: VideoWithCycleInfo | null, platform: "instagram" | "tiktok", isWinner: boolean, isPaired: boolean) => {
                              if (!video) {
                                return (
                                  <div className="flex items-center justify-center h-24 text-muted-foreground text-sm border border-dashed rounded-lg">
                                    —
                                  </div>
                                );
                              }
                              
                              const isIneligible = false;
                              const isMarkedIrrelevant = video.isIrrelevant;
                              const isLoser = isPaired && !isWinner;
                              
                              const formatDuration = (seconds: number | null | undefined) => {
                                if (!seconds) return null;
                                const mins = Math.floor(seconds / 60);
                                const secs = seconds % 60;
                                return `${mins}:${secs.toString().padStart(2, '0')}`;
                              };

                              const videoKey = `admin-${video.platform}-${video.id}`;
                              const isPlaying = playingVideoId === videoKey;
                              const uname = video.platform === "instagram" ? creator.instagramUsername : video.platform === "tiktok" ? creator.tiktokUsername : undefined;

                              const thumbnailOrPlayer = isPlaying && video.platformVideoId ? (
                                <div className="relative w-[224px] h-[400px] rounded-md overflow-hidden bg-black flex-shrink-0">
                                  <VideoEmbed platform={video.platform} platformVideoId={video.platformVideoId} username={uname || undefined} videoFileUrl={video.videoFileUrl || undefined} thumbnailUrl={video.thumbnailUrl || undefined} small />
                                  <button
                                    onClick={() => setPlayingVideoId(null)}
                                    className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600 z-10"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    if (video.platformVideoId) {
                                      setPlayingVideoId(videoKey);
                                    } else if (video.url) {
                                      window.open(video.url, '_blank');
                                    }
                                  }}
                                  className="relative w-20 aspect-[9/16] rounded-md overflow-hidden bg-muted flex-shrink-0 cursor-pointer group"
                                >
                                  {video.thumbnailUrl ? (
                                    <img src={video.thumbnailUrl} alt="Video thumbnail" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                                      {platform === "instagram" ? <SiInstagram className="w-6 h-6 text-pink-500/40" /> : <SiTiktok className="w-6 h-6 text-muted-foreground/40" />}
                                    </div>
                                  )}
                                  {isMarkedIrrelevant && <div className="absolute inset-0 bg-black/50" />}
                                  {isPaired && isWinner && !isIneligible && !isMarkedIrrelevant && (
                                    <div className="absolute top-1 right-1">
                                      <Badge className="text-[8px] h-4 px-1 bg-sky-500 text-white">$</Badge>
                                    </div>
                                  )}
                                  {video.duration && (
                                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1 py-0.5 rounded font-mono">
                                      {formatDuration(video.duration)}
                                    </div>
                                  )}
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-0.5" />
                                    </div>
                                  </div>
                                </button>
                              );
                              
                              return (
                                <div className={`flex w-full gap-2 p-2 rounded-lg border ${isMarkedIrrelevant ? "opacity-70 bg-muted/30" : isIneligible ? "opacity-60 bg-muted/30" : "bg-card"}`}>
                                  {thumbnailOrPlayer}
                                  <div className="flex flex-col justify-between py-1 flex-1">
                                    <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Eye className="w-3 h-3" />
                                        <span className="font-mono font-medium text-[13px]">{formatNumber(video.views)}</span>
                                      </span>
                                      <span className="flex items-center gap-1 text-[12px]">
                                        <Heart className="w-3 h-3" />
                                        {formatNumber(video.likes)}
                                      </span>
                                      <span className="flex items-center gap-1 text-[12px]">
                                        <MessageCircle className="w-3 h-3" />
                                        {formatNumber(video.comments)}
                                      </span>
                                    </div>
                                    {(video.postedAt || (video as any).timestamp) && (
                                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                        <Clock className="w-3 h-3" />
                                        <span>{formatUTCDate(new Date((video as any).timestamp || video.postedAt || 0).toISOString(), "d MMM HH:mm")} UTC</span>
                                      </div>
                                    )}
                                    {video.url && (
                                      <a href={video.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-400 transition-colors mt-0.5" onClick={(e) => e.stopPropagation()}>
                                        <ExternalLink className="w-3 h-3" />
                                        <span>View</span>
                                      </a>
                                    )}
                                    
                                    {video.views < 1000 && (
                                      <div className="flex items-center gap-1 text-[10px] text-amber-600" title="Low views - under 1K">
                                        <Info className="w-3 h-3" />
                                        <span>Low views</span>
                                      </div>
                                    )}
                                    
                                    {isAdmin && (
                                    <div>
                                      {isIneligible ? (
                                        <Badge variant="secondary" className="text-[9px] h-5 bg-gray-500/20 text-gray-500">
                                          <Ban className="w-2.5 h-2.5 mr-0.5" />
                                          Ineligible
                                        </Badge>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant={isMarkedIrrelevant ? "destructive" : "default"}
                                          className={`h-5 px-2 text-[9px] ${isMarkedIrrelevant ? "shadow-[0_0_8px_rgba(239,68,68,0.6)]" : "bg-blue-500 hover:bg-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.6)]"}`}
                                          onClick={() => toggleIrrelevantMutation.mutate({ 
                                            videoId: video.id, 
                                            isIrrelevant: !video.isIrrelevant 
                                          })}
                                          disabled={toggleIrrelevantMutation.isPending}
                                        >
                                          {isMarkedIrrelevant ? "Irrelevant" : "Relevant"}
                                        </Button>
                                      )}
                                    </div>
                                    )}
                                  </div>
                                </div>
                              );
                            };

                            return (
                              <TableRow key={row.id} className="align-top">
                                <TableCell className="font-mono text-sm pt-4">
                                  <div className="flex flex-col gap-1">
                                    {row.ig && (row.ig.postedAt || (row.ig as any).timestamp) && (
                                      <div className="flex items-center gap-1 text-gray-400 text-xs">
                                        <SiInstagram className="w-3 h-3 text-pink-500 flex-shrink-0" />
                                        <span>{formatUTCDate(new Date((row.ig as any).timestamp || row.ig.postedAt || 0).toISOString(), "d MMM HH:mm")} UTC</span>
                                      </div>
                                    )}
                                    {row.tiktok && (row.tiktok.postedAt || (row.tiktok as any).timestamp) && (
                                      <div className="flex items-center gap-1 text-gray-400 text-xs">
                                        <SiTiktok className="w-3 h-3 flex-shrink-0" />
                                        <span>{formatUTCDate(new Date((row.tiktok as any).timestamp || row.tiktok.postedAt || 0).toISOString(), "d MMM HH:mm")} UTC</span>
                                      </div>
                                    )}
                                    {row.ig && row.tiktok && row.matchType && row.matchType !== "none" && (
                                      <div className="flex items-center gap-1">
                                        <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full ${row.matchType === "duration" ? "bg-blue-500/20 text-blue-600" : "bg-sky-500/20 text-sky-600"}`}>
                                          {row.matchType === "duration" ? (
                                            <>
                                              <Clock className="w-2.5 h-2.5" />
                                              Duration
                                            </>
                                          ) : (
                                            <>
                                              <ImageIcon className="w-2.5 h-2.5" />
                                              Thumbnail
                                            </>
                                          )}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="pt-4">
                                  {row.ig?.caption ? (
                                    <div className="max-w-[100px]">
                                      <span className="text-sm text-muted-foreground">
                                        {row.ig.caption.length > 30 ? row.ig.caption.slice(0, 30) + "..." : row.ig.caption}
                                      </span>
                                      {row.ig.caption.length > 30 && (
                                        <button
                                          onClick={() => {
                                            setSelectedCaption(row.ig!.caption || "");
                                            setCaptionDialogOpen(true);
                                          }}
                                          className="text-xs text-primary hover:underline ml-1"
                                        >
                                          see more
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center p-2">
                                  {renderVideoCard(row.ig, "instagram", igIsWinner, !!(row.ig && row.tiktok))}
                                </TableCell>
                                <TableCell className="pt-4">
                                  {row.tiktok?.caption ? (
                                    <div className="max-w-[100px]">
                                      <span className="text-sm text-muted-foreground">
                                        {row.tiktok.caption.length > 30 ? row.tiktok.caption.slice(0, 30) + "..." : row.tiktok.caption}
                                      </span>
                                      {row.tiktok.caption.length > 30 && (
                                        <button
                                          onClick={() => {
                                            setSelectedCaption(row.tiktok!.caption || "");
                                            setCaptionDialogOpen(true);
                                          }}
                                          className="text-xs text-primary hover:underline ml-1"
                                        >
                                          see more
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center p-2">
                                  {renderVideoCard(row.tiktok, "tiktok", ttIsWinner, !!(row.ig && row.tiktok))}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums pt-4">
                                  {isAdmin ? (hasAnyEligible ? formatCurrency(totalBasePay) : "—") : "—"}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums pt-4">
                                  {isAdmin ? (hasAnyEligible && totalBonus > 0 ? formatCurrency(totalBonus) : "—") : "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                  </>
                )}
              </CardContent>
            </Card>


            {/* Past Videos */}
            {pastCycleVideos.length > 0 && (
              <Collapsible open={pastOpen} onOpenChange={setPastOpen}>
                <Card>
                  <CardHeader className="pb-3">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                            <History className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="text-left">
                            <CardTitle className="text-lg">Past Videos</CardTitle>
                            <CardDescription>
                              {pastCycleVideos.length} videos from previous cycles ({pastCycleVideos.filter(v => v.platform === "instagram").length} IG, {pastCycleVideos.filter(v => v.platform === "tiktok").length} TT)
                            </CardDescription>
                          </div>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${pastOpen ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent>
                      <FilterButtons activeFilter={pastCycleFilter} onFilterChange={setPastCycleFilter} />
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-24">Date</TableHead>
                              <TableHead className="w-28">IG Caption</TableHead>
                              <TableHead className="text-center w-36">
                                <div className="flex items-center justify-center gap-1">
                                  <SiInstagram className="w-3 h-3 text-pink-500" />
                                  Instagram
                                </div>
                              </TableHead>
                              <TableHead className="w-28">TT Caption</TableHead>
                              <TableHead className="text-center w-36">
                                <div className="flex items-center justify-center gap-1">
                                  <SiTiktok className="w-3 h-3" />
                                  TikTok
                                </div>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {buildPairedMainRows(pastCycleVideos)
                              .sort((a, b) => {
                                if (pastCycleFilter === "views") {
                                  const aViews = Math.max(a.ig?.views || 0, a.tiktok?.views || 0);
                                  const bViews = Math.max(b.ig?.views || 0, b.tiktok?.views || 0);
                                  return bViews - aViews;
                                }
                                return b.date.getTime() - a.date.getTime();
                              })
                              .map((row) => {
                                const renderPastVideoCard = (video: VideoWithCycleInfo | null, platform: "instagram" | "tiktok") => {
                                  if (!video) {
                                    return (
                                      <div className="flex items-center justify-center h-24 text-muted-foreground text-sm border border-dashed rounded-lg">
                                        —
                                      </div>
                                    );
                                  }
                                  
                                  const isIneligible = false;
                                  
                                  const formatDuration = (seconds: number | null | undefined) => {
                                    if (!seconds) return null;
                                    const m = Math.floor(seconds / 60);
                                    const s = seconds % 60;
                                    return `${m}:${s.toString().padStart(2, '0')}`;
                                  };

                                  const pastVideoKey = `past-${video.platform}-${video.id}`;
                                  const isPastPlaying = playingVideoId === pastVideoKey;
                                  const pastUname = video.platform === "instagram" ? creator.instagramUsername : video.platform === "tiktok" ? creator.tiktokUsername : undefined;

                                  const pastThumbnailOrPlayer = isPastPlaying && video.platformVideoId ? (
                                    <div className="relative w-[224px] h-[400px] rounded-md overflow-hidden bg-black flex-shrink-0">
                                      <VideoEmbed platform={video.platform} platformVideoId={video.platformVideoId} username={pastUname || undefined} videoFileUrl={video.videoFileUrl || undefined} thumbnailUrl={video.thumbnailUrl || undefined} small />
                                      <button
                                        onClick={() => setPlayingVideoId(null)}
                                        className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600 z-10"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        if (video.platformVideoId) {
                                          setPlayingVideoId(pastVideoKey);
                                        } else if (video.url) {
                                          window.open(video.url, '_blank');
                                        }
                                      }}
                                      className="relative w-20 aspect-[9/16] rounded-md overflow-hidden bg-muted flex-shrink-0 cursor-pointer group"
                                    >
                                      {video.thumbnailUrl ? (
                                        <img src={video.thumbnailUrl} alt="Video thumbnail" className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                                          {platform === "instagram" ? <SiInstagram className="w-6 h-6 text-pink-500/40" /> : <SiTiktok className="w-6 h-6 text-muted-foreground/40" />}
                                        </div>
                                      )}
                                      {video.duration && (
                                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1 py-0.5 rounded font-mono">
                                          {formatDuration(video.duration)}
                                        </div>
                                      )}
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-0.5" />
                                        </div>
                                      </div>
                                    </button>
                                  );
                                  
                                  return (
                                    <div className={`flex w-full gap-2 p-2 rounded-lg border opacity-70 bg-muted/30`}>
                                      {pastThumbnailOrPlayer}
                                      
                                      <div className="flex flex-col justify-between py-1 flex-1">
                                        <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                                          <span className="flex items-center gap-1">
                                            <Eye className="w-3 h-3" />
                                            <span className="font-mono font-medium">{formatNumber(video.views)}</span>
                                          </span>
                                          <span className="flex items-center gap-1">
                                            <Heart className="w-3 h-3" />
                                            {formatNumber(video.likes)}
                                          </span>
                                          <span className="flex items-center gap-1">
                                            <MessageCircle className="w-3 h-3" />
                                            {formatNumber(video.comments)}
                                          </span>
                                        </div>
                                        {(video.postedAt || (video as any).timestamp) && (
                                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                            <Clock className="w-3 h-3" />
                                            <span>{formatUTCDate(new Date((video as any).timestamp || video.postedAt || 0).toISOString(), "d MMM HH:mm")} UTC</span>
                                          </div>
                                        )}
                                        
                                        {video.views < 1000 && (
                                          <div className="flex items-center gap-1 text-[10px] text-amber-600" title="Low views - under 1K">
                                            <Info className="w-3 h-3" />
                                            <span>Low views</span>
                                          </div>
                                        )}
                                        
                                        <div>
                                          {isIneligible ? (
                                            <Badge variant="secondary" className="text-[9px] h-5 bg-gray-500/20 text-gray-500">
                                              <Ban className="w-2.5 h-2.5 mr-0.5" />
                                              Ineligible
                                            </Badge>
                                          ) : (
                                            <Badge variant="secondary" className="text-[9px] h-5 bg-muted text-muted-foreground">
                                              Past Video
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                };

                                return (
                                  <TableRow key={row.id} className="align-top">
                                    <TableCell className="font-mono text-sm pt-4">
                                      <div className="flex flex-col gap-1">
                                        {row.ig && (row.ig.postedAt || (row.ig as any).timestamp) && (
                                          <div className="flex items-center gap-1 text-gray-400 text-xs">
                                            <SiInstagram className="w-3 h-3 text-pink-500 flex-shrink-0" />
                                            <span>{formatUTCDate(new Date((row.ig as any).timestamp || row.ig.postedAt || 0).toISOString(), "d MMM HH:mm")} UTC</span>
                                          </div>
                                        )}
                                        {row.tiktok && (row.tiktok.postedAt || (row.tiktok as any).timestamp) && (
                                          <div className="flex items-center gap-1 text-gray-400 text-xs">
                                            <SiTiktok className="w-3 h-3 flex-shrink-0" />
                                            <span>{formatUTCDate(new Date((row.tiktok as any).timestamp || row.tiktok.postedAt || 0).toISOString(), "d MMM HH:mm")} UTC</span>
                                          </div>
                                        )}
                                        {row.ig && row.tiktok && row.matchType && row.matchType !== "none" && (
                                          <div className="flex items-center gap-1">
                                            <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full ${row.matchType === "duration" ? "bg-blue-500/20 text-blue-600" : "bg-sky-500/20 text-sky-600"}`}>
                                              {row.matchType === "duration" ? (
                                                <>
                                                  <Clock className="w-2.5 h-2.5" />
                                                  Duration
                                                </>
                                              ) : (
                                                <>
                                                  <ImageIcon className="w-2.5 h-2.5" />
                                                  Thumbnail
                                                </>
                                              )}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="pt-4">
                                      {row.ig?.caption ? (
                                        <div className="max-w-[100px]">
                                          <span className="text-sm text-muted-foreground">
                                            {row.ig.caption.length > 30 ? row.ig.caption.slice(0, 30) + "..." : row.ig.caption}
                                          </span>
                                          {row.ig.caption.length > 30 && (
                                            <button
                                              onClick={() => {
                                                setSelectedCaption(row.ig!.caption || "");
                                                setCaptionDialogOpen(true);
                                              }}
                                              className="text-xs text-primary hover:underline ml-1"
                                            >
                                              see more
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-sm text-muted-foreground">—</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center p-2">
                                      {renderPastVideoCard(row.ig, "instagram")}
                                    </TableCell>
                                    <TableCell className="pt-4">
                                      {row.tiktok?.caption ? (
                                        <div className="max-w-[100px]">
                                          <span className="text-sm text-muted-foreground">
                                            {row.tiktok.caption.length > 30 ? row.tiktok.caption.slice(0, 30) + "..." : row.tiktok.caption}
                                          </span>
                                          {row.tiktok.caption.length > 30 && (
                                            <button
                                              onClick={() => {
                                                setSelectedCaption(row.tiktok!.caption || "");
                                                setCaptionDialogOpen(true);
                                              }}
                                              className="text-xs text-primary hover:underline ml-1"
                                            >
                                              see more
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-sm text-muted-foreground">—</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center p-2">
                                      {renderPastVideoCard(row.tiktok, "tiktok")}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}
          </div>
        </TabsContent>


        <TabsContent value="violations">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Violations</CardTitle>
              <CardDescription>Rule violations from this creator</CardDescription>
            </CardHeader>
            <CardContent>
              {violations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-chart-2/10 flex items-center justify-center mb-4">
                    <CheckCircle className="w-8 h-8 text-chart-2" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No violations</h3>
                  <p className="text-muted-foreground">
                    This creator has no rule violations.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {violations.map((violation) => (
                    <div
                      key={violation.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-destructive" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {violation.type === "max_2_per_day"
                              ? "Exceeded daily posting limit"
                              : "Did not meet weekly minimum"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatUTCDate(violation.date, "MMMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <Badge variant="destructive">Violation</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Payout History</CardTitle>
              <CardDescription>All payouts for this creator</CardDescription>
            </CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <DollarSign className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No payouts yet</h3>
                  <p className="text-muted-foreground">
                    This creator hasn't received any payouts.
                  </p>
                </div>
              ) : (
                <>
                <div className="flex gap-2 mb-4">
                  <Button
                    variant={payoutFilter === "latest" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPayoutFilter("latest")}
                    className="gap-1"
                  >
                    <Clock className="w-3 h-3" />
                    Latest
                  </Button>
                  <Button
                    variant={payoutFilter === "payment" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPayoutFilter("payment")}
                    className="gap-1"
                  >
                    <DollarSign className="w-3 h-3" />
                    Highest Pay
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cycle</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Videos</TableHead>
                        <TableHead className="text-right">Bounties</TableHead>
                        <TableHead className="text-right">Survivor</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...payouts].sort((a, b) => {
                        switch (payoutFilter) {
                          case "latest":
                            return new Date(b.cycle?.startDate || 0).getTime() - new Date(a.cycle?.startDate || 0).getTime();
                          case "payment":
                            return parseFloat(b.totalAmount) - parseFloat(a.totalAmount);
                          default:
                            return new Date(b.cycle?.startDate || 0).getTime() - new Date(a.cycle?.startDate || 0).getTime();
                        }
                      }).map((payout) => {
                        const cycleEndDate = payout.cycle ? new Date(payout.cycle.endDate) : new Date(0);
                        const isCycleEnded = new Date() > cycleEndDate;
                        const isPaid = !!payout.paidAt;
                        
                        const videosPay = parseFloat(payout.baseAmount || "0") + parseFloat(payout.bonusAmount || "0");
                        const bountyPay = parseFloat((payout as any).bountyTotal || "0");
                        const survivorPay = parseFloat((payout as any).survivorTotal || "0");
                        const combinedPay = parseFloat((payout as any).combinedTotal || payout.totalAmount || "0");
                        
                        return (
                          <TableRow 
                            key={payout.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              setSelectedCycleId(payout.cycleId);
                              setCycleDetailTab("videos");
                              setCycleVideosDialogOpen(true);
                            }}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {payout.cycle ? formatUTCDate(payout.cycle.startDate, "MMM d") : "—"} -{" "}
                                {payout.cycle ? formatUTCDate(payout.cycle.endDate, "MMM d, yyyy") : "—"}
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {formatNumber((payout as any).eligibleViews || 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {formatCurrency(videosPay)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              <span className={bountyPay > 0 ? "text-sky-600 dark:text-sky-400" : ""}>{formatCurrency(bountyPay)}</span>
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              <span className={survivorPay > 0 ? "text-orange-600 dark:text-orange-400" : ""}>{formatCurrency(survivorPay)}</span>
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums font-medium">
                              {formatCurrency(combinedPay)}
                            </TableCell>
                            <TableCell className="text-center">
                              {isPaid ? (
                                <Badge variant="secondary" className="gap-1 bg-chart-2/20 text-chart-2">
                                  <CheckCircle className="w-3 h-3" />
                                  Paid
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1 bg-chart-4/20 text-chart-4">
                                  Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                {!isCycleEnded ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : !isPaid ? (
                                  <>
                                    {isAdmin && payout.cycleId && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setRefreshConfirmPayout(payout);
                                          setRefreshConfirmOpen(true);
                                        }}
                                        disabled={refreshingCycleId === String(payout.cycleId)}
                                        title="Refresh video metrics for this cycle"
                                      >
                                        {refreshingCycleId === String(payout.cycleId) ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <RefreshCw className="w-3 h-3" />
                                        )}
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      onClick={() => markPayoutPaidMutation.mutate(payout.id)}
                                      disabled={markPayoutPaidMutation.isPending}
                                    >
                                      {markPayoutPaidMutation.isPending ? (
                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                      ) : (
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                      )}
                                      Mark Paid
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => unmarkPayoutPaidMutation.mutate(payout.id)}
                                    disabled={unmarkPayoutPaidMutation.isPending}
                                  >
                                    {unmarkPayoutPaidMutation.isPending ? (
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    ) : (
                                      <XCircle className="w-3 h-3 mr-1" />
                                    )}
                                    Unmark
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="bounties">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                    <Award className="w-5 h-5 text-sky-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Bounty Management</h2>
                    <p className="text-sm text-muted-foreground">Manage bounties and review claims</p>
                  </div>
                </div>
              </div>

              <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Creator's Bounty Claims</CardTitle>
                    <CardDescription>Bounties claimed by this creator</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!bountyHistory || bountyHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                          <Award className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No bounty claims</h3>
                        <p className="text-muted-foreground">This creator hasn't claimed any bounties yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Bounty</TableHead>
                              <TableHead className="text-right">Reward</TableHead>
                              <TableHead>Date Range</TableHead>
                              <TableHead className="text-center">Status</TableHead>
                              <TableHead className="text-center">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bountyHistory.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <Award className="w-4 h-4 text-sky-500" />
                                    {item.bountyTitle}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-green-600">
                                  ${parseFloat(item.bountyReward).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {format(new Date(item.bountyStartDate), "MMM d")} -{" "}
                                  {item.bountyDeadline ? format(new Date(item.bountyDeadline), "MMM d, yyyy") : "No deadline"}
                                </TableCell>
                                <TableCell className="text-center">
                                  {(item.status === "claimed" || item.status === "completed") && (
                                    <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-600">Pending Approval</Badge>
                                  )}
                                  {item.status === "approved" && (
                                    <Badge variant="secondary" className="gap-1 bg-green-500/20 text-green-600">
                                      <CheckCircle className="w-3 h-3" />
                                      Approved
                                    </Badge>
                                  )}
                                  {item.status === "rejected" && (
                                    <Badge variant="destructive" className="gap-1">
                                      <XCircle className="w-3 h-3" />
                                      Rejected
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {(item.status === "completed" || item.status === "claimed") ? (
                                    <div className="flex gap-1 justify-center">
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="bg-green-500 hover:bg-green-600 text-white"
                                        onClick={async () => {
                                          try {
                                            await apiRequest("POST", `/api/admin/bounties/${item.bountyId}/approve-claim/${item.id}`);
                                            queryClient.invalidateQueries({ queryKey: [bountyHistoryEndpoint] });
                                            queryClient.invalidateQueries({ queryKey: [apiBase, creatorId] });
                                            refetchBounties();
                                            toast({ title: "Claim approved", description: "Bounty claim has been approved and payout created." });
                                          } catch (error) {
                                            toast({ title: "Failed to approve", description: "Please try again.", variant: "destructive" });
                                          }
                                        }}
                                      >
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={async () => {
                                          try {
                                            await apiRequest("POST", `/api/admin/bounties/${item.bountyId}/reject-claim/${item.id}`);
                                            queryClient.invalidateQueries({ queryKey: [bountyHistoryEndpoint] });
                                            refetchBounties();
                                            toast({ title: "Claim rejected", description: "Bounty claim has been rejected." });
                                          } catch (error) {
                                            toast({ title: "Failed to reject", description: "Please try again.", variant: "destructive" });
                                          }
                                        }}
                                      >
                                        <XCircle className="w-3 h-3 mr-1" />
                                        Reject
                                      </Button>
                                    </div>
                                  ) : item.status === "approved" ? (
                                    <div className="flex items-center gap-2 justify-center">
                                      <Badge variant="outline" className={`text-xs ${item.isPaid ? "bg-green-50 dark:bg-green-900/20 text-green-600 border-green-200 dark:border-green-800" : "bg-orange-50 dark:bg-orange-900/20 text-orange-600 border-orange-200 dark:border-orange-800"}`}>
                                        {item.isPaid ? "Paid" : "Pending Payment"}
                                      </Badge>
                                      {!item.isPaid && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-xs"
                                          onClick={async () => {
                                            try {
                                              await apiRequest("POST", `/api/admin/bounties/${item.bountyId}/unapprove-claim/${item.id}`);
                                              queryClient.invalidateQueries({ queryKey: [bountyHistoryEndpoint] });
                                              queryClient.invalidateQueries({ queryKey: [apiBase, creatorId] });
                                              refetchBounties();
                                              toast({ title: "Rolled back", description: "Claim reverted to pending approval and payout removed." });
                                            } catch (error) {
                                              toast({ title: "Failed to rollback", description: "Please try again.", variant: "destructive" });
                                            }
                                          }}
                                        >
                                          <RotateCcw className="w-3 h-3 mr-1" />
                                          Undo
                                        </Button>
                                      )}
                                    </div>
                                  ) : item.status === "rejected" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs"
                                      onClick={async () => {
                                        try {
                                          await apiRequest("POST", `/api/admin/bounties/${item.bountyId}/unapprove-claim/${item.id}`);
                                          queryClient.invalidateQueries({ queryKey: [bountyHistoryEndpoint] });
                                          queryClient.invalidateQueries({ queryKey: [apiBase, creatorId] });
                                          refetchBounties();
                                          toast({ title: "Undone", description: "Claim reverted to pending approval." });
                                        } catch (error) {
                                          toast({ title: "Failed to undo", description: "Please try again.", variant: "destructive" });
                                        }
                                      }}
                                    >
                                      <RotateCcw className="w-3 h-3 mr-1" />
                                      Undo
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
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
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="streak-survivor">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Streak Survivor History</CardTitle>
                <CardDescription>Game participation and performance</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>Ended</TableHead>
                        <TableHead className="text-center">Lives</TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <SiTiktok className="w-3 h-3" /> TT
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <SiInstagram className="w-3 h-3 text-pink-500" /> IG
                          </div>
                        </TableHead>
                        <TableHead className="text-center">Streak</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Payout</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creatorSurvivorGames && creatorSurvivorGames.length > 0 ? (
                        creatorSurvivorGames.map((game: any) => (
                          game.creatorStats ? (
                            <TableRow key={game.id}>
                              <TableCell className="font-medium">{game.title}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {game.startDate ? formatUTCDate(game.startDate, "MMM d, yyyy") : "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {game.status === 'active' ? (
                                  <Badge variant="outline" className="text-xs bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800">Active</Badge>
                                ) : game.endDate ? formatUTCDate(game.endDate, "MMM d, yyyy") : "—"}
                              </TableCell>
                              <TableCell className="text-center">{game.creatorStats.lives ?? 0}</TableCell>
                              <TableCell className="text-center">{game.creatorStats.ttPosts || 0}</TableCell>
                              <TableCell className="text-center">{game.creatorStats.igPosts || 0}</TableCell>
                              <TableCell className="text-center">{game.creatorStats.longestStreak || 0}d</TableCell>
                              <TableCell className="text-center">
                                {game.creatorStats.isEliminated ? (
                                  <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800">Eliminated</Badge>
                                ) : game.status === 'active' ? (
                                  <Badge variant="outline" className="text-xs bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800">Alive</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800">Survived</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {game.creatorStats.isEliminated ? (
                                  <span className="text-muted-foreground">nil</span>
                                ) : game.creatorStats.projectedPayout > 0 ? (
                                  <span className="text-sky-600">${(game.creatorStats.projectedPayout || 0).toFixed(2)}</span>
                                ) : (
                                  <span className="text-muted-foreground">nil</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ) : (
                            <TableRow key={game.id}>
                              <TableCell className="font-medium">{game.title}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {game.startDate ? formatUTCDate(game.startDate, "MMM d, yyyy") : "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {game.endDate ? formatUTCDate(game.endDate, "MMM d, yyyy") : "—"}
                              </TableCell>
                              <TableCell colSpan={6} className="text-center text-muted-foreground text-sm">
                                Did not participate
                              </TableCell>
                            </TableRow>
                          )
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                            No streak survivor games found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

      </Tabs>
      <Dialog open={cycleVideosDialogOpen} onOpenChange={setCycleVideosDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {cycleVideosData?.isFrozen && (
                <Snowflake className="w-5 h-5 text-blue-500" />
              )}
              Cycle Details
              {cycleVideosData?.cycle && (
                <span className="text-muted-foreground font-normal text-sm ml-2">
                  {formatUTCDate(cycleVideosData.cycle.startDate, "MMM d")} -{" "}
                  {formatUTCDate(cycleVideosData.cycle.endDate, "MMM d, yyyy")}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {cycleVideosData?.isFrozen 
                ? "Frozen cycle — metrics locked at cycle end."
                : "Live metrics for the current cycle."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-1 bg-muted rounded-lg p-1 mb-2">
            {(["videos", "bounties", "survivor", "total"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setCycleDetailTab(tab)}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${cycleDetailTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab === "videos" ? "Videos" : tab === "bounties" ? "Bounties" : tab === "survivor" ? "Survivor" : "Total"}
              </button>
            ))}
          </div>

          {cycleDetailTab === "videos" && (isCycleVideosLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : cycleVideosData?.videos && cycleVideosData.videos.length > 0 ? (
            <div className="space-y-4">
              {cycleVideosData.isFrozen && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                  <Snowflake className="w-4 h-4" />
                  <span>
                    Frozen data - Views are locked at cycle end.
                    {(() => {
                      const selectedPayout = payouts.find(p => p.cycleId === selectedCycleId);
                      return !selectedPayout?.paidAt ? " Toggle relevance to adjust payouts." : "";
                    })()}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Sort:</span>
                  <Select value={cycleVideosSortBy} onValueChange={(v) => setCycleVideosSortBy(v as "views" | "latest")}>
                    <SelectTrigger className="w-[130px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="views">Most Views</SelectItem>
                      <SelectItem value="latest">Latest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Date</TableHead>
                      <TableHead className="w-28">IG Caption</TableHead>
                      <TableHead className="text-center w-36">
                        <div className="flex items-center justify-center gap-1">
                          <SiInstagram className="w-3 h-3 text-pink-500" />
                          Instagram
                        </div>
                      </TableHead>
                      <TableHead className="w-28">TT Caption</TableHead>
                      <TableHead className="text-center w-36">
                        <div className="flex items-center justify-center gap-1">
                          <SiTiktok className="w-3 h-3" />
                          TikTok
                        </div>
                      </TableHead>
                      <TableHead className="text-right w-20">Base Pay</TableHead>
                      <TableHead className="text-right w-20">Bonus</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {buildPairedCycleRows(cycleVideosData.videos)
                      .sort((a, b) => {
                        if (cycleVideosSortBy === "views") {
                          const aViews = Math.max(a.ig?.views || 0, a.tiktok?.views || 0);
                          const bViews = Math.max(b.ig?.views || 0, b.tiktok?.views || 0);
                          return bViews - aViews;
                        }
                        return b.date.getTime() - a.date.getTime();
                      })
                      .map((row) => {
                        const igEligible = row.ig && row.ig.isEligible !== false && !row.ig.isIrrelevant;
                        const ttEligible = row.tiktok && row.tiktok.isEligible !== false && !row.tiktok.isIrrelevant;
                        const isPaired = !!row.ig && !!row.tiktok;
                        
                        const igViews = row.ig ? (row.ig.views || 0) : 0;
                        const ttViews = row.tiktok ? (row.tiktok.views || 0) : 0;
                        const igIsWinner = isPaired && !!igEligible && igViews >= ttViews;
                        const ttIsWinner = isPaired && !!ttEligible && ttViews > igViews;
                        
                        const totalBasePay = (igEligible && row.ig ? row.ig.basePayPerVideo : 0) + (ttEligible && row.tiktok ? row.tiktok.basePayPerVideo : 0);
                        const igPaysBonus = isPaired ? (igEligible && igIsWinner) : !!igEligible;
                        const ttPaysBonus = isPaired ? (ttEligible && ttIsWinner) : !!ttEligible;
                        const totalBonus = (igPaysBonus && row.ig ? (row.ig.bonusAmount || 0) : 0) + (ttPaysBonus && row.tiktok ? (row.tiktok.bonusAmount || 0) : 0);
                        const hasAnyEligible = !!(igEligible || ttEligible);
                        const selectedPayout = payouts.find(p => p.cycleId === selectedCycleId);
                        const isPaid = selectedPayout?.paidAt != null;

                        const formatDuration = (seconds: number | null | undefined) => {
                          if (!seconds) return null;
                          const mins = Math.floor(seconds / 60);
                          const secs = seconds % 60;
                          return `${mins}:${secs.toString().padStart(2, '0')}`;
                        };

                        // Determine if toggle is allowed:
                        // - Current (non-frozen) cycle: always allow toggle
                        // - Frozen past cycle: only allow if unpaid
                        const isFrozenCycle = cycleVideosData?.isFrozen === true;
                        const canToggleVideos = !isFrozenCycle || (isFrozenCycle && !isPaid);

                        const renderVideoCard = (video: CycleVideoData | null, platform: "instagram" | "tiktok", isWinner: boolean, isPaired: boolean) => {
                          if (!video) {
                            return (
                              <div className="flex items-center justify-center h-24 text-muted-foreground text-sm border border-dashed rounded-lg">
                                —
                              </div>
                            );
                          }
                          
                          const isMarkedIrrelevant = video.isIrrelevant === true;
                          const isIneligible = video.isEligible === false && !isMarkedIrrelevant;
                          const isLoser = isPaired && !isWinner;

                          const cycleVideoKey = `cycle-${video.platform}-${video.id}`;
                          const isCyclePlaying = playingVideoId === cycleVideoKey;
                          const cycleUname = video.platform === "instagram" ? creator.instagramUsername : video.platform === "tiktok" ? creator.tiktokUsername : undefined;

                          const cycleThumbnailOrPlayer = isCyclePlaying && video.platformVideoId ? (
                            <div className="relative w-[224px] h-[400px] rounded-md overflow-hidden bg-black flex-shrink-0">
                              <VideoEmbed platform={video.platform} platformVideoId={video.platformVideoId} username={cycleUname || undefined} videoFileUrl={video.videoFileUrl || undefined} thumbnailUrl={video.thumbnailUrl || undefined} small />
                              <button
                                onClick={() => setPlayingVideoId(null)}
                                className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600 z-10"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                if (video.platformVideoId) {
                                  setPlayingVideoId(cycleVideoKey);
                                } else if (video.url) {
                                  window.open(video.url, '_blank');
                                }
                              }}
                              className="relative w-20 aspect-[9/16] rounded-md overflow-hidden bg-muted flex-shrink-0 cursor-pointer group"
                            >
                              {video.thumbnailUrl ? (
                                <img src={video.thumbnailUrl} alt="Video thumbnail" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                                  {platform === "instagram" ? <SiInstagram className="w-6 h-6 text-pink-500/40" /> : <SiTiktok className="w-6 h-6 text-muted-foreground/40" />}
                                </div>
                              )}
                              {isMarkedIrrelevant && <div className="absolute inset-0 bg-black/50" />}
                              {isPaired && isWinner && !isIneligible && !isMarkedIrrelevant && (
                                <div className="absolute top-1 right-1">
                                  <Badge className="text-[8px] h-4 px-1 bg-sky-500 text-white">$</Badge>
                                </div>
                              )}
                              {video.duration && (
                                <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1 py-0.5 rounded font-mono">
                                  {formatDuration(video.duration)}
                                </div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-0.5" />
                                </div>
                              </div>
                            </button>
                          );
                          
                          return (
                            <div className={`flex w-full gap-2 p-2 rounded-lg border ${isMarkedIrrelevant ? "opacity-70 bg-muted/30" : isIneligible ? "opacity-60 bg-muted/30" : "bg-card"}`}>
                              {cycleThumbnailOrPlayer}
                              <div className="flex flex-col justify-between py-1 flex-1">
                                <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Eye className="w-3 h-3" />
                                    <span className="font-mono font-medium text-[13px]">{formatNumber(video.views)}</span>
                                  </span>
                                  <span className="flex items-center gap-1 text-[12px]">
                                    <Heart className="w-3 h-3" />
                                    {formatNumber(video.likes)}
                                  </span>
                                  <span className="flex items-center gap-1 text-[12px]">
                                    <MessageCircle className="w-3 h-3" />
                                    {formatNumber(video.comments)}
                                  </span>
                                </div>
                                {(video.postedAt || (video as any).timestamp) && (
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                    <Clock className="w-3 h-3" />
                                    <span>{formatUTCDate(new Date((video as any).timestamp || video.postedAt || 0).toISOString(), "d MMM HH:mm")} UTC</span>
                                  </div>
                                )}
                                {video.url && (
                                  <a href={video.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-400 transition-colors mt-0.5" onClick={(e) => e.stopPropagation()}>
                                    <ExternalLink className="w-3 h-3" />
                                    <span>View</span>
                                  </a>
                                )}
                                
                                {video.views < 1000 && (
                                  <div className="flex items-center gap-1 text-[10px] text-amber-600" title="Low views - under 1K">
                                    <Info className="w-3 h-3" />
                                    <span>Low views</span>
                                  </div>
                                )}
                                
                                {isAdmin && (
                                <div className="relative z-10">
                                  {isIneligible ? (
                                    <Badge variant="secondary" className="text-[9px] h-5 bg-gray-500/20 text-gray-500">
                                      <Ban className="w-2.5 h-2.5 mr-0.5" />
                                      Ineligible
                                    </Badge>
                                  ) : canToggleVideos ? (
                                    <Button
                                      size="sm"
                                      variant={isMarkedIrrelevant ? "destructive" : "default"}
                                      className={`h-5 px-2 text-[9px] relative z-20 cursor-pointer ${isMarkedIrrelevant ? "shadow-[0_0_8px_rgba(239,68,68,0.6)]" : "bg-blue-500 hover:bg-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.6)]"}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isFrozenCycle) {
                                          toggleCycleVideoRelevanceMutation.mutate({ 
                                            snapshotId: video.id, 
                                            isIrrelevant: !video.isIrrelevant 
                                          });
                                        } else {
                                          toggleVideoRelevanceMutation.mutate({
                                            videoId: video.id,
                                            isIrrelevant: !video.isIrrelevant
                                          });
                                        }
                                      }}
                                      disabled={toggleCycleVideoRelevanceMutation.isPending || toggleVideoRelevanceMutation.isPending}
                                    >
                                      {isMarkedIrrelevant ? "Irrelevant" : "Relevant"}
                                    </Button>
                                  ) : (
                                    <Badge variant={isMarkedIrrelevant ? "destructive" : "secondary"} className="text-[9px] h-5">
                                      {isMarkedIrrelevant ? "Irrelevant" : "Relevant"}
                                    </Badge>
                                  )}
                                </div>
                                )}
                              </div>
                            </div>
                          );
                        };

                        return (
                          <TableRow key={row.id} className="align-top">
                            <TableCell className="font-mono text-sm pt-4">
                              <div className="flex flex-col gap-1">
                                {row.ig && (row.ig.postedAt || (row.ig as any).timestamp) && (
                                  <div className="flex items-center gap-1 text-gray-400 text-xs">
                                    <SiInstagram className="w-3 h-3 text-pink-500 flex-shrink-0" />
                                    <span>{formatUTCDate(new Date((row.ig as any).timestamp || row.ig.postedAt || 0).toISOString(), "d MMM HH:mm")} UTC</span>
                                  </div>
                                )}
                                {row.tiktok && (row.tiktok.postedAt || (row.tiktok as any).timestamp) && (
                                  <div className="flex items-center gap-1 text-gray-400 text-xs">
                                    <SiTiktok className="w-3 h-3 flex-shrink-0" />
                                    <span>{formatUTCDate(new Date((row.tiktok as any).timestamp || row.tiktok.postedAt || 0).toISOString(), "d MMM HH:mm")} UTC</span>
                                  </div>
                                )}
                                {row.ig && row.tiktok && row.matchType && row.matchType !== "none" && (
                                  <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full w-fit ${row.matchType === "duration" ? "bg-blue-500/20 text-blue-600" : "bg-sky-500/20 text-sky-600"}`}>
                                    {row.matchType === "duration" ? (
                                      <>
                                        <Clock className="w-2.5 h-2.5" />
                                        Duration
                                      </>
                                    ) : (
                                      <>
                                        <ImageIcon className="w-2.5 h-2.5" />
                                        Thumbnail
                                      </>
                                    )}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="pt-4">
                              {row.ig?.caption ? (
                                <p className="text-sm text-muted-foreground line-clamp-2 max-w-[120px]">
                                  {row.ig.caption}
                                </p>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {renderVideoCard(row.ig, "instagram", igIsWinner, isPaired)}
                            </TableCell>
                            <TableCell className="pt-4">
                              {row.tiktok?.caption ? (
                                <p className="text-sm text-muted-foreground line-clamp-2 max-w-[120px]">
                                  {row.tiktok.caption}
                                </p>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {renderVideoCard(row.tiktok, "tiktok", ttIsWinner, isPaired)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums pt-4">
                              {isAdmin ? (hasAnyEligible ? formatCurrency(totalBasePay) : "—") : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums pt-4">
                              {isAdmin ? (hasAnyEligible && totalBonus > 0 ? formatCurrency(totalBonus) : "—") : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Video className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No videos found for this cycle.</p>
            </div>
          ))}

          {cycleDetailTab === "bounties" && (
            <div className="space-y-3">
              {!cycleBountySurvivorData?.bounties || cycleBountySurvivorData.bounties.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-sky-500/10 flex items-center justify-center mb-3">
                    <Award className="w-6 h-6 text-sky-500" />
                  </div>
                  <p className="text-muted-foreground">No bounties completed in this cycle.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cycleBountySurvivorData.bounties.map((b: any) => (
                    <div key={b.id} className={`flex items-center justify-between p-3 rounded-lg border ${b.status === "rejected" ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30" : "bg-muted/50"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${b.status === "rejected" ? "bg-red-500/10" : "bg-sky-500/10"}`}>
                          <Award className={`w-4 h-4 ${b.status === "rejected" ? "text-red-500" : "text-sky-500"}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{b.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {b.completedAt ? `Completed ${formatUTCDate(b.completedAt, "MMM d, yyyy")}` : ""}
                            {b.deadline ? ` · Deadline ${formatUTCDate(b.deadline, "MMM d, yyyy")}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${b.status === "rejected" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>${parseFloat(b.reward).toFixed(2)}</span>
                        {b.status === "rejected" ? (
                          <Badge variant="destructive">Rejected</Badge>
                        ) : (
                          <Badge variant="secondary" className={b.paidAt ? "bg-green-500/20 text-green-600" : "bg-orange-500/20 text-orange-600"}>
                            {b.paidAt ? "Paid" : "Pending"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end pt-2 border-t">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total Bounties</p>
                      <p className="text-lg font-bold text-sky-600 dark:text-sky-400">
                        ${cycleBountySurvivorData.bounties.reduce((sum: number, b: any) => sum + parseFloat(b.reward || "0"), 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {cycleDetailTab === "survivor" && (
            <div className="space-y-3">
              {!cycleBountySurvivorData?.survivorGames || cycleBountySurvivorData.survivorGames.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-3">
                    <span className="text-xl">🔥</span>
                  </div>
                  <p className="text-muted-foreground">No streak survivor games ended in this cycle.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cycleBountySurvivorData.survivorGames.map((g: any) => (
                    <Card key={g.id} className="overflow-hidden">
                      <div className={`px-4 py-2.5 text-white ${g.status === 'active' ? 'bg-gradient-to-r from-sky-600 to-sky-700' : 'bg-gradient-to-r from-gray-600 to-gray-700'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-sm">{g.title}</h4>
                            <p className="text-white/70 text-xs">
                              Prize Pool: ${parseFloat(g.prizePool || "0").toFixed(0)}
                              {g.endDate && ` · Ended ${formatUTCDate(g.endDate, "MMM d, yyyy")}`}
                            </p>
                          </div>
                          <Badge className={g.isSurvivor ? "bg-green-500 text-white" : "bg-red-500/80 text-white"}>
                            {g.isSurvivor ? "Survived" : "Eliminated"}
                          </Badge>
                        </div>
                      </div>
                      <CardContent className="pt-3 pb-3">
                        <div className="grid grid-cols-4 gap-3">
                          <div className="text-center p-2 bg-gray-50 dark:bg-[#1a1a1a] rounded-md">
                            <p className="text-lg font-bold">{g.totalPosts || 0}</p>
                            <p className="text-[10px] text-muted-foreground">Posts</p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 dark:bg-[#1a1a1a] rounded-md">
                            <p className="text-lg font-bold">{(g.sharePercent || 0).toFixed(1)}%</p>
                            <p className="text-[10px] text-muted-foreground">Share</p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 dark:bg-[#1a1a1a] rounded-md">
                            <p className="text-lg font-bold">{g.isSurvivor ? "Yes" : "No"}</p>
                            <p className="text-[10px] text-muted-foreground">Survived</p>
                          </div>
                          <div className="text-center p-2 bg-sky-50 dark:bg-sky-900/20 rounded-md">
                            <p className="text-lg font-bold text-sky-600">${(g.projectedPayout || 0).toFixed(2)}</p>
                            <p className="text-[10px] text-muted-foreground">Payout</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {cycleDetailTab === "total" && (() => {
            const selectedPayout = payouts.find((p: any) => p.cycleId === selectedCycleId);
            const videosBase = parseFloat(selectedPayout?.baseAmount || "0");
            const videosBonus = parseFloat(selectedPayout?.bonusAmount || "0");
            const videosTotal = videosBase + videosBonus;
            const bountyTotal = cycleBountySurvivorData?.bounties && cycleBountySurvivorData.bounties.length > 0
              ? cycleBountySurvivorData.bounties.reduce((sum: number, b: any) => sum + parseFloat(b.reward), 0)
              : parseFloat((selectedPayout as any)?.bountyTotal || "0");
            const survivorTotal = cycleBountySurvivorData?.survivorGames && cycleBountySurvivorData.survivorGames.length > 0
              ? cycleBountySurvivorData.survivorGames.reduce((sum: number, s: any) => sum + parseFloat(s.projectedPayout || 0), 0)
              : parseFloat((selectedPayout as any)?.survivorTotal || "0");
            const grandTotal = videosTotal + bountyTotal + survivorTotal;

            return (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium">Videos</span>
                      <span className="text-xs text-muted-foreground">(Base + Bonus)</span>
                    </div>
                    <span className="font-bold font-mono">{formatCurrency(videosTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-sky-50 dark:bg-sky-900/20 rounded-lg border border-sky-200 dark:border-sky-800">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-sky-500" />
                      <span className="text-sm font-medium">Bounties</span>
                    </div>
                    <span className={`font-bold font-mono ${bountyTotal < 0 ? "text-red-600 dark:text-red-400" : "text-sky-600 dark:text-sky-400"}`}>{formatCurrency(bountyTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🔥</span>
                      <span className="text-sm font-medium">Streak Survivor</span>
                    </div>
                    <span className="font-bold font-mono text-orange-600 dark:text-orange-400">{formatCurrency(survivorTotal)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-sky-50 to-green-50 dark:from-sky-900/20 dark:to-green-900/20 rounded-lg border-2 border-sky-300 dark:border-sky-700">
                  <span className="text-base font-bold">Total Payout</span>
                  <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
      {playingHoverVideo && playingHoverVideo.platformVideoId && (() => {
        const hoverUname = playingHoverVideo.platform === "instagram" ? creator.instagramUsername : playingHoverVideo.platform === "tiktok" ? creator.tiktokUsername : undefined;
        const closePlayer = () => { setPlayingVideoId(null); setPlayingHoverVideo(null); };
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80" onClick={closePlayer}>
            <div className="relative w-[260px] h-[462px] rounded-2xl overflow-hidden bg-black shadow-2xl" onClick={e => e.stopPropagation()}>
              <VideoEmbed
                platform={playingHoverVideo.platform}
                platformVideoId={playingHoverVideo.platformVideoId}
                username={hoverUname || undefined}
                videoFileUrl={playingHoverVideo.videoFileUrl || undefined}
                thumbnailUrl={playingHoverVideo.thumbnailUrl || undefined}
                small
              />
              <button
                onClick={closePlayer}
                className="absolute top-2 right-2 w-7 h-7 bg-black/70 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-sm transition-colors z-10"
              >
                ✕
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                <p className="text-white text-xs font-medium truncate">{playingHoverVideo.caption}</p>
                <p className="text-white/60 text-[10px] mt-0.5">@{playingHoverVideo.username || playingHoverVideo.creatorName}</p>
              </div>
            </div>
          </div>
        );
      })()}
      <Dialog open={refreshConfirmOpen} onOpenChange={setRefreshConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Refresh Payout Cycle</DialogTitle>
            <DialogDescription>
              Are you sure you want to refresh this payout cycle?
            </DialogDescription>
          </DialogHeader>
          {refreshConfirmPayout && (
            <div className="space-y-3">
              <div className="p-3 bg-muted/50 rounded-lg space-y-2 text-sm">
                <div className="font-medium">
                  {refreshConfirmPayout.cycle
                    ? `${formatUTCDate(refreshConfirmPayout.cycle.startDate, "MMM d")} - ${formatUTCDate(refreshConfirmPayout.cycle.endDate, "MMM d, yyyy")}`
                    : "Unknown cycle"}
                </div>
                <div className="space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Global IG Base Pay:</span>
                    <span className="font-mono">${parseFloat(refreshConfirmPayout.snapshotIgBasePay || refreshConfirmPayout.snapshotDefaultBasePay || "0").toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Global TT Base Pay:</span>
                    <span className="font-mono">${parseFloat(refreshConfirmPayout.snapshotTtBasePay || refreshConfirmPayout.snapshotDefaultBasePay || "0").toFixed(2)}</span>
                  </div>
                  {refreshConfirmPayout.bonusTiersSnapshot && (() => {
                    try {
                      const tiers = JSON.parse(refreshConfirmPayout.bonusTiersSnapshot);
                      if (tiers.length > 0) {
                        return (
                          <div className="pt-1">
                            <span className="font-medium text-foreground">Bonus Tiers:</span>
                            <div className="mt-1 space-y-0.5">
                              {tiers.sort((a: any, b: any) => a.viewThreshold - b.viewThreshold).map((t: any, i: number) => (
                                <div key={i} className="flex justify-between text-xs">
                                  <span>{Number(t.viewThreshold).toLocaleString()}+ views</span>
                                  <span className="font-mono">${parseFloat(t.bonusAmount).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                    } catch { return null; }
                    return null;
                  })()}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRefreshConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setRefreshConfirmOpen(false);
                    handleRefreshCyclePayout(String(refreshConfirmPayout.cycleId));
                  }}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={captionDialogOpen} onOpenChange={setCaptionDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Full Caption</DialogTitle>
            <DialogDescription>
              Complete caption text for this video
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 p-4 bg-card border rounded-lg overflow-y-auto max-h-[50vh]">
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{selectedCaption}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
