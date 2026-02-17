import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useAdminRefresh } from "@/lib/admin-refresh";
import { useLocation } from "wouter";
import { RefreshProgressBar } from "@/components/refresh-progress-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, Label } from "recharts";
import { RefreshCw, Loader2, Clock, Video, Eye, DollarSign, Users, Heart, TrendingUp, Sparkles, Play, Clapperboard, Wallet, UsersRound, Flame, Zap, Search, CheckCircle, ArrowUpDown, AlertTriangle, Pause, Trash2, Filter, MessageCircle, X, Send, ExternalLink, Crown, Medal } from "lucide-react";
import { SiTiktok, SiInstagram } from "react-icons/si";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { VideoEmbed } from "@/components/video-embed";
import { 
  AnimatedCalendar, 
  AnimatedFire, 
  AnimatedTrophy, 
  AnimatedHeart, 
  AnimatedBlackHeart, 
  AnimatedUsers, 
  AnimatedChevronDown, 
  AnimatedUpDown, 
  AnimatedCelebration,
  AnimatedSkull,
  AnimatedTombstone
} from "@/components/AnimatedIcons";
import { formatDistanceToNow } from "date-fns";
import { formatUTCDate } from "@/lib/date-utils";

const InstagramIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const TikTokIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

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

interface DashboardStatsResponse {
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
  totalPay?: number;
  basePay?: number;
  bonusPay?: number;
  moneyPaidTillNow?: number;
  lastBulkRefreshAt: string | null;
  activeCycle?: {
    id: number;
    startDate: string;
    endDate: string;
  } | null;
  deltas?: {
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
    totalPay?: number;
    moneyPaidTillNow?: number;
  } | null;
}

interface SurvivorGame {
  id: string;
  title: string;
  description: string | null;
  prizePool: string;
  originalPrizePool: string;
  durationDays: number;
  startingLives: number;
  minPostsPerDay: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  currentDay: number;
  totalParticipants: number;
  addedFromEliminations: number;
}

interface MyStats {
  rank: number | null;
  lives: number;
  totalPosts: number;
  currentStreak: number;
  isEliminated: boolean;
  eliminatedOnDay: number | null;
  estimatedPayout: number;
}

interface SurvivorEntry {
  rank: number;
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  lives: number;
  totalPosts: number;
  currentStreak: number;
  igPosts?: number;
  ttPosts?: number;
}

interface EliminatedEntry {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  eliminatedOnDay: number | null;
  totalPosts: number;
  igPosts?: number;
  ttPosts?: number;
}

interface StreakSurvivorResponse {
  game: SurvivorGame | null;
  myStats: MyStats | null;
  survivors: SurvivorEntry[];
  eliminated: EliminatedEntry[];
}

interface TodaysPost {
  id: string;
  username: string;
  platform: string;
  thumbnail: string | null;
  views: number;
  likes: number;
  timeAgo: string;
  url: string | null;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  handle: string;
  value: string;
  color: string;
  instagramUsername?: string;
  tiktokUsername?: string;
}

const EmojiToAnimatedIcon: React.FC<{ emoji: string; size?: number }> = ({ emoji, size = 16 }) => {
  const iconMap: { [key: string]: React.ReactNode } = {
    '🎉': <AnimatedCelebration size={size} />,
    '🔥': <AnimatedFire size={size} />,
    '🏆': <AnimatedTrophy size={size} />,
    '❤️': <AnimatedHeart size={size} />,
    '🖤': <AnimatedBlackHeart size={size} />,
    '👥': <AnimatedUsers size={size} />,
    '📅': <AnimatedCalendar size={size} />,
    '💀': <AnimatedSkull size={size} />,
    '🪦': <AnimatedTombstone size={size} />,
    '⚡': <AnimatedFire size={size} className="text-yellow-400" />,
    '👑': <AnimatedTrophy size={size} className="text-yellow-500" />,
    '🎬': <AnimatedCelebration size={size} className="text-sky-500" />,
    '💰': <AnimatedTrophy size={size} className="text-green-500" />,
    '💎': <AnimatedTrophy size={size} className="text-blue-500" />,
    '🚀': <AnimatedFire size={size} className="text-sky-500" />,
    '📱': <AnimatedCelebration size={size} className="text-blue-400" />,
    '🎊': <AnimatedCelebration size={size} />,
  };
  return <>{iconMap[emoji] || <AnimatedCelebration size={size} />}</>;
};

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

interface VideoByDate {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  caption: string | null;
  timestamp: string;
  creatorName?: string;
  username?: string;
  platformVideoId: string | null;
  videoFileUrl: string | null;
}

interface BountyClaim {
  id: string;
  userId: number;
  userName: string;
  userEmail: string;
  status: string;
  videoId: string | null;
  completedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
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
  userClaim: {
    id: string;
    status: string;
    completedAt: string | null;
    approvedAt: string | null;
  } | null;
  penaltyAmount: number;
  canClaim: boolean;
  claims?: BountyClaim[];
  pendingApprovalCount?: number;
}

interface Celebration {
  id: string | number;
  creator: string;
  achievement: string;
  emoji?: string;
  time: string;
}

interface CreatorDisplay {
  id: string;
  name: string;
  email: string;
  status: string;
  instagramUsername: string | null;
  tiktokUsername: string | null;
  videosThisCycle: number;
  totalVideosAllTime: number;
  viewsThisCycle: number;
  totalViewsAllTime: number;
}

interface DonutChartData {
  name: string;
  value: number;
}

interface DonutChartProps {
  data: DonutChartData[];
  total: number;
  label: string;
  centerLabel: string;
}

interface CreatorStats {
  videosThisCycle: number;
  viewsThisCycle: number;
  earningsThisCycle: number;
  baseEarnings: number;
  bonusEarnings: number;
  totalFollowing: number;
  igVideos: number;
  tiktokVideos: number;
  igViews: number;
  tiktokViews: number;
  igFollowers: number;
  tiktokFollowers: number;
}

function formatTimeRemaining(resetAt: string): string {
  const now = new Date();
  const reset = new Date(resetAt);
  const diffMs = reset.getTime() - now.getTime();
  
  if (diffMs <= 0) return "now";
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDeadlineCountdown(deadline: string): string {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  
  if (diffMs <= 0) return "Expired";
  
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const days = totalDays % 365 % 30;
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (years > 0) {
    return months > 0 ? `${years}y ${months}mo left` : `${years}y left`;
  }
  if (months > 0) {
    return days > 0 ? `${months}mo ${days}d left` : `${months}mo left`;
  }
  if (totalDays > 0) {
    return `${totalDays}d ${hours}h left`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  return `${minutes}m left`;
}

type SortOption = "newest" | "highest_paid" | "highest_views";
type StatusFilter = "active" | "paused" | "deleted" | "all";

const CreatorHub = () => {
  const [, navigate] = useLocation();
  const [leaderboardCategory, setLeaderboardCategory] = useState<'views' | 'improved' | 'streak'>('views');
  const [cycleView, setCycleView] = useState<'current' | 'all'>('current');
  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>((urlParams.get("status") as StatusFilter) || "active");
  const [sortBy, setSortBy] = useState<SortOption>((urlParams.get("sort") as SortOption) || "newest");
  const [searchTerm, setSearchTerm] = useState(urlParams.get("search") || '');
  const [, setTick] = useState(0);
  const [showBountyForm, setShowBountyForm] = useState(false);
  const [showSubmissionsDialog, setShowSubmissionsDialog] = useState(false);
  const [expandedBountyId, setExpandedBountyId] = useState<string | null>(null);
  const [newBounty, setNewBounty] = useState({
    title: '',
    description: '',
    reward: '',
    startDate: '',
    deadline: '',
    maxSlots: '1',
    penaltyAmount: '',
  });
  const [creatingBounty, setCreatingBounty] = useState(false);
  const [editingBounty, setEditingBounty] = useState<any>(null);
  const [editBountyForm, setEditBountyForm] = useState({
    title: '',
    description: '',
    reward: '',
    startDate: '',
    deadline: '',
    maxSlots: '1',
    penaltyAmount: '',
  });
  const [savingBounty, setSavingBounty] = useState(false);
  const [processingClaimId, setProcessingClaimId] = useState<string | null>(null);
  const { user, token } = useAuth();
  const isCreator = user?.role === "creator";
  const isAdmin = user?.role === "admin";
  
  // Admin refresh hook
  const { isRefreshing: isSyncing, progress: syncProgressPercent, syncProgress: adminSyncProgress, startRefresh: syncAllCreatorsWithProgress } = useAdminRefresh();
  
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
  
  // Admin sync all functionality with same progress logic as creator refresh
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncQuote, setSyncQuote] = useState("Syncing your success...");
  const syncStartTimeRef = useRef<number>(0);
  const syncAnimationRef = useRef<number>(0);
  const isSyncCompletingRef = useRef(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const QUOTES = [
    "Syncing your success...",
    "Good things take time.",
    "Almost there...",
    "Gathering your latest wins...",
  ];

  const MILESTONES = [
    { time: 0, progress: 0 },
    { time: 5000, progress: 15 },
    { time: 8000, progress: 35 },
    { time: 12000, progress: 55 },
    { time: 17000, progress: 70 },
    { time: 45000, progress: 80 },
    { time: 60000, progress: 90 },
  ];

  const getQuoteForProgress = (progress: number): string => {
    if (progress < 35) return QUOTES[0];
    if (progress < 55) return QUOTES[1];
    if (progress < 70) return QUOTES[2];
    return QUOTES[3];
  };

  const animateSyncProgress = () => {
    if (!isSyncingAll || isSyncCompletingRef.current) return;

    const elapsed = Date.now() - syncStartTimeRef.current;
    
    let targetProgress = 0;
    for (let i = MILESTONES.length - 1; i >= 0; i--) {
      if (elapsed >= MILESTONES[i].time) {
        if (i === MILESTONES.length - 1) {
          targetProgress = MILESTONES[i].progress;
        } else {
          const current = MILESTONES[i];
          const next = MILESTONES[i + 1];
          const segmentElapsed = elapsed - current.time;
          const segmentDuration = next.time - current.time;
          const segmentProgress = Math.min(segmentElapsed / segmentDuration, 1);
          targetProgress = current.progress + (next.progress - current.progress) * segmentProgress;
        }
        break;
      }
    }

    targetProgress = Math.min(targetProgress, 90);
    setSyncProgress(targetProgress);
    setSyncQuote(getQuoteForProgress(targetProgress));

    syncAnimationRef.current = requestAnimationFrame(animateSyncProgress);
  };

  useEffect(() => {
    if (isSyncingAll && !isSyncCompletingRef.current) {
      syncAnimationRef.current = requestAnimationFrame(animateSyncProgress);
    }
    return () => {
      if (syncAnimationRef.current) {
        cancelAnimationFrame(syncAnimationRef.current);
      }
    };
  }, [isSyncingAll]);
  
  const handleSyncAll = async () => {
    if (!token || !isAdmin) return;
    
    setIsSyncingAll(true);
    setSyncProgress(0);
    setSyncQuote(QUOTES[0]);
    syncStartTimeRef.current = Date.now();
    isSyncCompletingRef.current = false;
    
    try {
      const res = await fetch("/api/admin/sync-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to sync all creators");
      const data = await res.json();

      isSyncCompletingRef.current = true;
      if (syncAnimationRef.current) {
        cancelAnimationFrame(syncAnimationRef.current);
      }

      setSyncProgress(100);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${data.success} of ${data.total} creators.${data.failed > 0 ? ` ${data.failed} failed.` : ''}`,
      });
      queryClient.invalidateQueries();
    } catch (error) {
      console.error("Sync all failed:", error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync creators. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncingAll(false);
      setSyncProgress(0);
      isSyncCompletingRef.current = false;
    }
  };
  
  // Calculate the most recent sync timestamp from database-stored values
  const lastSyncAt = (() => {
    if (!user) return null;
    const igSync = user?.instagramLastSyncAt ? new Date(user.instagramLastSyncAt) : null;
    const ttSync = user?.tiktokLastSyncAt ? new Date(user.tiktokLastSyncAt) : null;
    if (igSync && ttSync) return igSync > ttSync ? igSync : ttSync;
    return igSync || ttSync || null;
  })();
  
  // Update relative time display every minute
  useEffect(() => {
    if (!lastSyncAt) return;
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, [lastSyncAt]);
  
  // Fetch creator-specific stats
  const { data: creatorVideosData } = useQuery<{
    videos: any[];
    activeCycle: any;
    settings?: { instagramBasePayPerVideo: number; tiktokBasePayPerVideo: number };
  }>({
    queryKey: ["/api/creator/videos-with-cycle"],
    queryFn: async () => {
      const res = await fetch("/api/creator/videos-with-cycle", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch videos");
      return res.json();
    },
    enabled: !!token && isCreator,
  });
  
  // Fetch team stats for pie charts (all creators can see team performance)
  interface TeamCreatorStat {
    id: number;
    name: string;
    videosThisCycle: number;
    totalVideosAllTime: number;
    igViewsThisCycle: number;
    igViewsAllTime: number;
    tiktokViewsThisCycle: number;
    tiktokViewsAllTime: number;
    instagramFollowers?: number;
    tiktokFollowers?: number;
  }
  
  interface AdminCreatorResponse {
    id: number;
    instagramUsername?: string | null;
    tiktokUsername?: string | null;
    email: string;
    videosThisCycle: number;
    totalVideosAllTime: number;
    igViewsThisCycle: number;
    igViewsAllTime: number;
    tiktokViewsThisCycle: number;
    tiktokViewsAllTime: number;
    instagramFollowers?: number | null;
    tiktokFollowers?: number | null;
  }
  
  const teamStatsEndpoint = user?.role === "admin" ? "/api/admin/creators" : "/api/creator/team-stats";
  const { data: teamStatsData } = useQuery<{ creators?: TeamCreatorStat[] } | AdminCreatorResponse[]>({
    queryKey: [teamStatsEndpoint],
    queryFn: async () => {
      const res = await fetch(teamStatsEndpoint, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch team stats");
      return res.json();
    },
    enabled: !!token,
  });
  
  // Normalize team stats data - admin endpoint returns array with instagramUsername/tiktokUsername/email
  // creator endpoint returns {creators: []} with name field
  const teamCreators: TeamCreatorStat[] = (() => {
    if (!teamStatsData) return [];
    
    // Creator endpoint returns {creators: [...]}
    if ('creators' in teamStatsData && Array.isArray(teamStatsData.creators)) {
      return teamStatsData.creators;
    }
    
    // Admin endpoint returns array of AdminCreatorResponse
    if (Array.isArray(teamStatsData)) {
      return teamStatsData.map((c: AdminCreatorResponse) => ({
        id: c.id,
        name: c.instagramUsername || c.tiktokUsername || (c.email || 'Unknown').split('@')[0],
        videosThisCycle: c.videosThisCycle,
        totalVideosAllTime: c.totalVideosAllTime,
        igViewsThisCycle: c.igViewsThisCycle,
        igViewsAllTime: c.igViewsAllTime,
        tiktokViewsThisCycle: c.tiktokViewsThisCycle,
        tiktokViewsAllTime: c.tiktokViewsAllTime,
        instagramFollowers: c.instagramFollowers ?? 0,
        tiktokFollowers: c.tiktokFollowers ?? 0,
      }));
    }
    
    return [];
  })();
  
  // Determine API endpoint based on user role
  const apiEndpoint = user?.role === "admin" ? "/api/admin/dashboard-stats" : "/api/creator/dashboard-stats";
  
  // Fetch real dashboard stats from API
  const { data: dashboardStats, isLoading } = useQuery<DashboardStatsResponse>({
    queryKey: [apiEndpoint],
    queryFn: async () => {
      const res = await fetch(apiEndpoint, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch dashboard stats");
      return res.json();
    },
  });
  
  // Calculate creator-specific stats from videos data
  const creatorStats: CreatorStats = (() => {
    if (!creatorVideosData?.videos) {
      return {
        videosThisCycle: 0,
        viewsThisCycle: 0,
        earningsThisCycle: 0,
        baseEarnings: 0,
        bonusEarnings: 0,
        totalFollowing: 0,
        igVideos: 0,
        tiktokVideos: 0,
        igViews: 0,
        tiktokViews: 0,
        igFollowers: user?.instagramFollowers ?? 0,
        tiktokFollowers: user?.tiktokFollowers ?? 0,
      };
    }
    
    const activeCycle = creatorVideosData.activeCycle;
    const videos = creatorVideosData.videos || [];
    const cycleVideos = activeCycle 
      ? videos.filter((v: any) => v.cycleId === activeCycle.id)
      : videos;
    
    const igVideos = cycleVideos.filter((v: any) => v.platform === "instagram");
    const tiktokVideos = cycleVideos.filter((v: any) => v.platform === "tiktok");
    
    const baseEarnings = cycleVideos.reduce((sum: number, v: any) => sum + (v.basePayPerVideo || 0), 0);
    const bonusEarnings = cycleVideos.reduce((sum: number, v: any) => sum + (v.bonusAmount || 0), 0);
    
    return {
      videosThisCycle: cycleVideos.length,
      viewsThisCycle: cycleVideos.reduce((sum: number, v: any) => sum + (v.views || 0), 0),
      earningsThisCycle: baseEarnings + bonusEarnings,
      baseEarnings,
      bonusEarnings,
      totalFollowing: (user?.instagramFollowers ?? 0) + (user?.tiktokFollowers ?? 0),
      igVideos: igVideos.length,
      tiktokVideos: tiktokVideos.length,
      igViews: igVideos.reduce((sum: number, v: any) => sum + (v.views || 0), 0),
      tiktokViews: tiktokVideos.reduce((sum: number, v: any) => sum + (v.views || 0), 0),
      igFollowers: user?.instagramFollowers ?? 0,
      tiktokFollowers: user?.tiktokFollowers ?? 0,
    };
  })();

  const programStats = (() => {
    if (!dashboardStats) {
      return {
        newCreators: 0, totalCreators: teamCreators.length,
        videosThisCycle: 0, igVideosThisCycle: 0, ttVideosThisCycle: 0,
        eligibleVideos: 0, igEligibleVideos: 0, ttEligibleVideos: 0,
        viewsThisCycle: 0, igViewsThisCycle: 0, ttViewsThisCycle: 0,
        eligibleViews: 0, igEligibleViews: 0, ttEligibleViews: 0,
        followers: 0, igFollowers: 0, ttFollowers: 0,
        totalPay: 0, basePay: 0, bonusPay: 0, moneyPaidTillNow: 0,
        deltas: null as DashboardStatsResponse['deltas'],
      };
    }
    return {
      newCreators: dashboardStats.newCreators,
      totalCreators: dashboardStats.totalCreators,
      videosThisCycle: dashboardStats.videosThisCycle,
      igVideosThisCycle: dashboardStats.igVideosThisCycle,
      ttVideosThisCycle: dashboardStats.ttVideosThisCycle,
      eligibleVideos: dashboardStats.eligibleVideos,
      igEligibleVideos: dashboardStats.igEligibleVideos,
      ttEligibleVideos: dashboardStats.ttEligibleVideos,
      viewsThisCycle: dashboardStats.viewsThisCycle,
      igViewsThisCycle: dashboardStats.igViewsThisCycle,
      ttViewsThisCycle: dashboardStats.ttViewsThisCycle,
      eligibleViews: dashboardStats.eligibleViews,
      igEligibleViews: dashboardStats.igEligibleViews,
      ttEligibleViews: dashboardStats.ttEligibleViews,
      followers: dashboardStats.followers,
      igFollowers: dashboardStats.igFollowers,
      ttFollowers: dashboardStats.ttFollowers,
      totalPay: dashboardStats.totalPay ?? 0,
      basePay: dashboardStats.basePay ?? 0,
      bonusPay: dashboardStats.bonusPay ?? 0,
      moneyPaidTillNow: dashboardStats.moneyPaidTillNow ?? 0,
      deltas: dashboardStats.deltas ?? null,
    };
  })();

  // Compute pie chart data from team stats - respects cycleView toggle
  const videosChartData = teamCreators
    .filter(c => cycleView === 'all' ? c.totalVideosAllTime > 0 : c.videosThisCycle > 0)
    .map(c => ({
      name: c.name,
      value: cycleView === 'all' ? c.totalVideosAllTime : c.videosThisCycle,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const igViewsChartData = teamCreators
    .filter(c => cycleView === 'all' ? c.igViewsAllTime > 0 : c.igViewsThisCycle > 0)
    .map(c => ({
      name: c.name,
      value: cycleView === 'all' ? c.igViewsAllTime : c.igViewsThisCycle,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const tiktokViewsChartData = teamCreators
    .filter(c => cycleView === 'all' ? c.tiktokViewsAllTime > 0 : c.tiktokViewsThisCycle > 0)
    .map(c => ({
      name: c.name,
      value: cycleView === 'all' ? c.tiktokViewsAllTime : c.tiktokViewsThisCycle,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Calculate totals for pie chart labels
  const totalVideos = videosChartData.reduce((sum, c) => sum + c.value, 0);
  const totalIgViews = igViewsChartData.reduce((sum, c) => sum + c.value, 0);
  const totalTiktokViews = tiktokViewsChartData.reduce((sum, c) => sum + c.value, 0);

  // Calculate all-time stats from dashboard stats API (uses proper pairing calculation)

  const { data: streakSurvivorData } = useQuery<StreakSurvivorResponse>({
    queryKey: ['streak-survivor-active'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const endpoint = user?.role === 'admin' ? '/api/admin/streak-survivor/active' : '/api/creator/streak-survivor/active';
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch streak survivor data');
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  const survivorGame = streakSurvivorData?.game;
  const myStats = streakSurvivorData?.myStats;
  const survivors = streakSurvivorData?.survivors || [];
  const eliminated = streakSurvivorData?.eliminated || [];

  const getTimeUntilMidnight = () => {
    const now = new Date();
    // Calculate next UTC midnight
    const midnightUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0
    ));
    const diff = midnightUTC.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // State for showing all today's posts
  const [showAllTodaysPosts, setShowAllTodaysPosts] = useState(false);
  
  const [showAllTopPosts, setShowAllTopPosts] = useState(false);
  const [playingPostId, setPlayingPostId] = useState<string | null>(null);

  // Leaderboard state
  const [leaderboardVideoSort, setLeaderboardVideoSort] = useState<string>("views");
  const [leaderboardVideoLimit, setLeaderboardVideoLimit] = useState<number>(5);
  const [leaderboardAccountSort, setLeaderboardAccountSort] = useState<string>("views");
  const [leaderboardAccountLimit, setLeaderboardAccountLimit] = useState<number>(5);
  const [playingHoverVideo, setPlayingHoverVideo] = useState<VideoByDate | null>(null);
  const [captionPostId, setCaptionPostId] = useState<string | null>(null);
  
  // State for showing all celebrations
  const [showAllCelebrations, setShowAllCelebrations] = useState(false);

  // State for video fires and comments
  const [videoFires, setVideoFires] = useState<Record<string, { count: number; userFired: boolean; users: string[] }>>({});
  const [videoCommentCounts, setVideoCommentCounts] = useState<Record<string, number>>({});
  const [selectedVideoForComments, setSelectedVideoForComments] = useState<{ id: string; caption: string } | null>(null);
  const [comments, setComments] = useState<Array<{ id: string; content: string; userName: string; createdAt: string }>>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  
  const [showGameHistory, setShowGameHistory] = useState(false);

  // State for admin streak survivor game creation
  const [showGameCreator, setShowGameCreator] = useState(false);
  const [gameForm, setGameForm] = useState({
    title: 'Streak Survivor',
    description: 'Last creator standing wins the pot',
    prizePool: 500,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    startingLives: 2,
    minPostsPerDay: 1,
  });
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [showEditGame, setShowEditGame] = useState(false);
  const [showDeleteGameConfirm, setShowDeleteGameConfirm] = useState(false);
  const [isDeletingGame, setIsDeletingGame] = useState(false);
  const [editGameForm, setEditGameForm] = useState({
    title: '',
    description: '',
    prizePool: 0,
    endDate: '',
    startingLives: 2,
    minPostsPerDay: 1,
  });

  const { data: gameHistory } = useQuery<any[]>({
    queryKey: ['streak-survivor-history', isAdmin],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const endpoint = isAdmin ? '/api/admin/streak-survivor/history' : '/api/creator/streak-survivor/history';
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch game history');
      return response.json();
    },
    enabled: !!user && showGameHistory,
  });

  const handleCreateGame = async () => {
    try {
      setIsCreatingGame(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/streak-survivor/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(gameForm),
      });
      if (!response.ok) throw new Error('Failed to create game');
      const game = await response.json();
      
      const startResponse = await fetch(`/api/admin/streak-survivor/games/${game.id}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!startResponse.ok) throw new Error('Failed to start game');
      
      setShowGameCreator(false);
      window.location.reload();
    } catch (error) {
      console.error('Error creating game:', error);
      alert('Failed to create game');
    } finally {
      setIsCreatingGame(false);
    }
  };

  const handleEndGame = async () => {
    if (!survivorGame?.id) return;
    if (!confirm('Are you sure you want to end this game early? Survivors will split the current pot.')) return;
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/admin/streak-survivor/games/${survivorGame.id}/end`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      window.location.reload();
    } catch (error) {
      console.error('Error ending game:', error);
      alert('Failed to end game');
    }
  };

  const handleOpenEditGame = () => {
    if (!survivorGame) return;
    setEditGameForm({
      title: survivorGame.title || 'Streak Survivor',
      description: survivorGame.description || '',
      prizePool: parseFloat(survivorGame.prizePool || '0'),
      endDate: survivorGame.endDate ? new Date(survivorGame.endDate).toISOString().split('T')[0] : '',
      startingLives: survivorGame.startingLives || 2,
      minPostsPerDay: survivorGame.minPostsPerDay || 1,
    });
    setShowEditGame(true);
  };

  const handleSaveEditGame = async () => {
    if (!survivorGame?.id) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/streak-survivor/games/${survivorGame.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(editGameForm),
      });
      if (!response.ok) throw new Error('Failed to update game');
      setShowEditGame(false);
      window.location.reload();
    } catch (error) {
      console.error('Error updating game:', error);
      alert('Failed to update game');
    }
  };

  const handleDeleteGame = async () => {
    if (!survivorGame?.id) return;
    setIsDeletingGame(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/streak-survivor/games/${survivorGame.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to delete game');
      setShowDeleteGameConfirm(false);
      window.location.reload();
    } catch (error) {
      console.error('Error deleting game:', error);
      alert('Failed to delete game');
    } finally {
      setIsDeletingGame(false);
    }
  };

  const handleToggleFire = async (videoId: string) => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = isAdmin ? `/api/admin/videos/${videoId}/fire` : `/api/creator/videos/${videoId}/fire`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to toggle fire');
      
      // Refetch accurate count from server after toggle
      const firesEndpoint = isAdmin ? `/api/admin/videos/${videoId}/fires` : `/api/creator/videos/${videoId}/fires`;
      const firesRes = await fetch(firesEndpoint, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (firesRes.ok) {
        const fires = await firesRes.json();
        setVideoFires(prev => ({ ...prev, [videoId]: fires }));
      }
    } catch (error) {
      console.error('Error toggling fire:', error);
    }
  };

  const fetchVideoFiresAndComments = async (videoId: string) => {
    try {
      const token = localStorage.getItem('token');
      const baseUrl = isAdmin ? '/api/admin' : '/api/creator';
      
      const [firesRes, commentsRes] = await Promise.all([
        fetch(`${baseUrl}/videos/${videoId}/fires`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${baseUrl}/videos/${videoId}/comments`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);
      
      if (firesRes.ok) {
        const fires = await firesRes.json();
        setVideoFires(prev => ({ ...prev, [videoId]: fires }));
      }
      if (commentsRes.ok) {
        const { comments: videoComments } = await commentsRes.json();
        setVideoCommentCounts(prev => ({ ...prev, [videoId]: videoComments.length }));
      }
    } catch (error) {
      console.error('Error fetching fires/comments:', error);
    }
  };

  const openCommentsPanel = async (videoId: string, caption: string) => {
    setSelectedVideoForComments({ id: videoId, caption });
    setIsLoadingComments(true);
    try {
      const token = localStorage.getItem('token');
      const endpoint = isAdmin ? `/api/admin/videos/${videoId}/comments` : `/api/creator/videos/${videoId}/comments`;
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const { comments: videoComments } = await response.json();
        setComments(videoComments);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handlePostComment = async () => {
    if (!selectedVideoForComments || !newComment.trim()) return;
    setIsPostingComment(true);
    try {
      const token = localStorage.getItem('token');
      const baseUrl = isAdmin ? '/api/admin' : '/api/creator';
      const endpoint = `${baseUrl}/videos/${selectedVideoForComments.id}/comments`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (response.ok) {
        setNewComment("");
        // Refetch comments to get accurate count and data from server
        const commentsRes = await fetch(endpoint, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (commentsRes.ok) {
          const { comments: refreshedComments } = await commentsRes.json();
          setComments(refreshedComments);
          setVideoCommentCounts(prev => ({
            ...prev,
            [selectedVideoForComments.id]: refreshedComments.length,
          }));
        }
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setIsPostingComment(false);
    }
  };

// State for views line graph
  const [viewsDayRange, setViewsDayRange] = useState<7 | 14 | 30 | 'all'>(7);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [hoveredDateVideos, setHoveredDateVideos] = useState<VideoByDate[]>([]);
  const [hoverSortMode, setHoverSortMode] = useState<'views' | 'likes'>('views');
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoCacheRef = useRef<Record<string, VideoByDate[]>>({});
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const currentRangeRef = useRef<7 | 14 | 30 | 'all'>(viewsDayRange);
  const viewsChartRef = useRef<HTMLDivElement | null>(null);
  const engagementChartRef = useRef<HTMLDivElement>(null);
  const [engHoveredDate, setEngHoveredDate] = useState<string | null>(null);
  const [engHoveredDateVideos, setEngHoveredDateVideos] = useState<VideoByDate[]>([]);
  const [engHoverSortMode, setEngHoverSortMode] = useState<'views' | 'likes'>('views');
  const [engIsLoadingVideos, setEngIsLoadingVideos] = useState(false);
  const engHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const engVideoCacheRef = useRef<Record<string, VideoByDate[]>>({});
  
  // Clear cache when day range changes
  useEffect(() => {
    if (currentRangeRef.current !== viewsDayRange) {
      videoCacheRef.current = {};
      engVideoCacheRef.current = {};
      currentRangeRef.current = viewsDayRange;
    }
  }, [viewsDayRange]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (engHoverTimeoutRef.current) {
        clearTimeout(engHoverTimeoutRef.current);
      }
    };
  }, []);
  
  // Fetch daily views data
  const dailyViewsEndpoint = isAdmin ? "/api/admin/daily-views" : "/api/creator/daily-views";
  const { data: dailyViewsData } = useQuery<DailyViewsResponse>({
    queryKey: [dailyViewsEndpoint, viewsDayRange],
    queryFn: async () => {
      const daysParam = viewsDayRange === 'all' ? 'all' : viewsDayRange;
      const scopeParam = !isAdmin ? '&scope=team' : '';
      const res = await fetch(`${dailyViewsEndpoint}?days=${daysParam}${scopeParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch daily views');
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 60000,
  });
  
  // Fetch videos on dot hover with caching and debounce
  const handleDotHover = async (date: string) => {
    // Clear any pending hide timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    if (date === hoveredDate) return;
    setHoveredDate(date);
    
    // Check cache first
    if (videoCacheRef.current[date]) {
      setHoveredDateVideos(videoCacheRef.current[date]);
      return;
    }
    
    setIsLoadingVideos(true);
    try {
      const endpoint = isAdmin ? "/api/admin/videos-by-date" : "/api/creator/videos-by-date";
      const scopeParam = !isAdmin ? '&scope=team' : '';
      const res = await fetch(`${endpoint}?date=${date}${scopeParam}`, {
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
      setIsLoadingVideos(false);
    }
  };
  
  // Delayed hide to allow moving from dot to panel
  const handleDotLeave = () => {
    // Clear any existing timeout first to prevent stale closures
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredDate(null);
      setHoveredDateVideos([]);
    }, 250); // 250ms delay gives user time to move to panel
  };
  
  // Keep panel open when hovering the panel itself
  const handlePanelEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  
  // Sort videos based on selected mode
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
      const scopeParam = !isAdmin ? '&scope=team' : '';
      const res = await fetch(`${endpoint}?date=${date}${scopeParam}`, {
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

  // Fetch today's posts from API
  interface TodaysPostsResponse {
    posts: TodaysPost[];
    totalCount: number;
  }
  
  const todaysPostsEndpoint = isAdmin ? "/api/admin/todays-posts" : "/api/creator/todays-posts";
  const { data: todaysPostsData } = useQuery<TodaysPostsResponse>({
    queryKey: [todaysPostsEndpoint],
    queryFn: async () => {
      const res = await fetch(todaysPostsEndpoint, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch today's posts");
      return res.json();
    },
    enabled: !!token,
  });
  
  const todaysPosts: TodaysPost[] = todaysPostsData?.posts || [];
  const displayedPosts = showAllTodaysPosts ? todaysPosts : todaysPosts.slice(0, 7);

  // Fetch top videos with filters
  interface TopVideo {
    id: string;
    caption: string;
    username: string;
    creatorName: string;
    creatorEmail: string | null;
    platform: string;
    platformVideoId: string | null;
    videoFileUrl: string | null;
    thumbnail: string | null;
    views: number;
    likes: number;
    comments: number;
    engagementRate: number;
    url: string | null;
    postedAt: string | null;
  }
  
  interface TopVideosResponse {
    videos: TopVideo[];
    totalCount: number;
  }
  
  const topVideosEndpoint = isAdmin ? "/api/admin/top-videos" : "/api/creator/top-videos";
  const { data: topVideosData } = useQuery<TopVideosResponse>({
    queryKey: [topVideosEndpoint, "today"],
    queryFn: async () => {
      const params = new URLSearchParams({
        period: "today",
        sortBy: "views",
        limit: "100",
      });
      const res = await fetch(`${topVideosEndpoint}?${params}`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch today's posts");
      return res.json();
    },
    enabled: !!token,
    placeholderData: (previousData) => previousData,
  });
  
  const allTodayTopPosts: TopVideo[] = topVideosData?.videos || [];
  const displayedTopPosts = showAllTopPosts ? allTodayTopPosts : allTodayTopPosts.slice(0, 5);

  // Fetch fire and comment counts for visible videos
  useEffect(() => {
    allTodayTopPosts.forEach(video => {
      if (!videoFires[video.id]) {
        fetchVideoFiresAndComments(video.id);
      }
    });
  }, [allTodayTopPosts]);
  
  // Top Accounts query
  interface TopAccount {
    id: number;
    name: string;
    handle: string;
    email: string | null;
    avatar: string | null;
    views: number;
    likes: number;
    comments: number;
    videoCount: number;
    avgViews: number;
    improvement: number;
    prevViews: number;
    hasInstagram: boolean;
    hasTiktok: boolean;
    instagramUsername: string | null;
    tiktokUsername: string | null;
    instagramViews: number;
    tiktokViews: number;
    instagramLikes: number;
    tiktokLikes: number;
    instagramComments: number;
    tiktokComments: number;
    instagramAvgViews: number;
    tiktokAvgViews: number;
    avgLikes: number;
  }
  
  interface TopAccountsResponse {
    accounts: TopAccount[];
    totalCount: number;
  }

  const leaderboardVideosEndpoint = isAdmin ? "/api/admin/top-videos" : "/api/creator/top-videos";
  const { data: leaderboardVideosData } = useQuery<TopVideosResponse>({
    queryKey: [leaderboardVideosEndpoint, "leaderboard", leaderboardVideoSort, leaderboardVideoLimit],
    queryFn: async () => {
      const params = new URLSearchParams({
        period: "all",
        sortBy: leaderboardVideoSort,
        limit: String(leaderboardVideoLimit),
      });
      const res = await fetch(`${leaderboardVideosEndpoint}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch leaderboard videos");
      return res.json();
    },
    enabled: !!token,
    placeholderData: (previousData) => previousData,
  });

  const leaderboardAccountsEndpoint = isAdmin ? "/api/admin/top-accounts" : "/api/creator/top-accounts";
  const { data: leaderboardAccountsData } = useQuery<TopAccountsResponse>({
    queryKey: [leaderboardAccountsEndpoint, "leaderboard", leaderboardAccountSort, leaderboardAccountLimit],
    queryFn: async () => {
      const params = new URLSearchParams({
        period: "all",
        metric: leaderboardAccountSort,
        limit: String(leaderboardAccountLimit),
      });
      const res = await fetch(`${leaderboardAccountsEndpoint}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch leaderboard accounts");
      return res.json();
    },
    enabled: !!token,
    placeholderData: (previousData) => previousData,
  });

  const leaderboardVideos: TopVideo[] = leaderboardVideosData?.videos || [];
  const leaderboardAccounts: TopAccount[] = leaderboardAccountsData?.accounts || [];

  // Format number with K/M suffix
  const formatStatNumber = (num: number | undefined | null): string => {
    const n = num ?? 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const truncateCaption = (caption: string | null, wordCount: number = 5): string => {
    if (!caption) return '';
    const words = caption.split(/\s+/);
    if (words.length <= wordCount) return caption;
    return words.slice(0, wordCount).join(' ') + '...';
  };

  // Fetch cycle leaderboard from API
  const leaderboardEndpoint = isAdmin ? "/api/admin/cycle-leaderboard" : "/api/creator/cycle-leaderboard";
  interface LeaderboardData {
    mostViews: { rank: number; name: string; handle: string; displayValue: string; avatar: string; instagramUsername?: string; tiktokUsername?: string }[];
    mostImproved: { rank: number; name: string; handle: string; displayValue: string; avatar: string; instagramUsername?: string; tiktokUsername?: string }[];
    longestStreak: { rank: number; name: string; handle: string; displayValue: string; avatar: string; instagramUsername?: string; tiktokUsername?: string }[];
  }
  
  const { data: leaderboardData } = useQuery<LeaderboardData>({
    queryKey: [leaderboardEndpoint],
    queryFn: async () => {
      const res = await fetch(leaderboardEndpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
    enabled: !!token,
  });

  const rankColors = ['bg-sky-500', 'bg-pink-500', 'bg-sky-500', 'bg-orange-500', 'bg-blue-500'];
  
  const leaderboard: Record<'views' | 'improved' | 'streak', LeaderboardEntry[]> = {
    views: (leaderboardData?.mostViews || []).map((item, i) => ({
      rank: item.rank,
      name: item.name,
      handle: item.handle,
      value: item.displayValue,
      color: rankColors[i] || 'bg-gray-500',
      instagramUsername: item.instagramUsername,
      tiktokUsername: item.tiktokUsername,
    })),
    improved: (leaderboardData?.mostImproved || []).map((item, i) => ({
      rank: item.rank,
      name: item.name,
      handle: item.handle,
      value: item.displayValue,
      color: rankColors[i] || 'bg-gray-500',
      instagramUsername: item.instagramUsername,
      tiktokUsername: item.tiktokUsername,
    })),
    streak: (leaderboardData?.longestStreak || []).map((item, i) => ({
      rank: item.rank,
      name: item.name,
      handle: item.handle,
      value: item.displayValue,
      color: rankColors[i] || 'bg-gray-500',
      instagramUsername: item.instagramUsername,
      tiktokUsername: item.tiktokUsername,
    })),
  };

  const bountyEndpoint = isAdmin ? "/api/admin/bounties" : "/api/creator/bounties";
  
  const { data: bountiesData, refetch: refetchBounties } = useQuery<Bounty[]>({
    queryKey: [bountyEndpoint],
    queryFn: async () => {
      const res = await fetch(bountyEndpoint, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch bounties");
      return res.json();
    },
    enabled: !!token,
  });
  
  const allBounties = bountiesData || [];
  const bounties = allBounties.filter(b => !b.deadlineDate || new Date(b.deadlineDate).getTime() > Date.now());
  const expiredBounties = allBounties.filter(b => b.deadlineDate && new Date(b.deadlineDate).getTime() <= Date.now());
  
  const [claimingBountyId, setClaimingBountyId] = useState<string | null>(null);
  const [claimConfirmBounty, setClaimConfirmBounty] = useState<Bounty | null>(null);
  
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
    } catch (error) {
      alert("Failed to claim bounty");
    } finally {
      setClaimingBountyId(null);
    }
  };
  
  const handleCreateBounty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBounty.title || !newBounty.reward || !newBounty.startDate || !newBounty.deadline) {
      alert("Title, reward, start date, and end date are required");
      return;
    }
    setCreatingBounty(true);
    try {
      const res = await fetch("/api/admin/bounties", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: newBounty.title,
          description: newBounty.description || null,
          reward: parseFloat(newBounty.reward),
          startDate: newBounty.startDate,
          deadline: newBounty.deadline,
          maxClaims: parseInt(newBounty.maxSlots) || 1,
          penaltyAmount: parseFloat(newBounty.penaltyAmount) || 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || "Failed to create bounty");
        return;
      }
      setNewBounty({ title: '', description: '', reward: '', startDate: '', deadline: '', maxSlots: '1', penaltyAmount: '' });
      setShowBountyForm(false);
      refetchBounties();
    } catch (error) {
      alert("Failed to create bounty");
    } finally {
      setCreatingBounty(false);
    }
  };
  
  const handleEditBounty = (bounty: Bounty) => {
    setEditingBounty(bounty);
    setEditBountyForm({
      title: bounty.title || '',
      description: bounty.description || '',
      reward: String(bounty.rewardAmount || ''),
      startDate: bounty.startDate ? new Date(bounty.startDate).toISOString().split('T')[0] : '',
      deadline: bounty.deadlineDate ? new Date(bounty.deadlineDate).toISOString().split('T')[0] : '',
      maxSlots: String(bounty.maxSlots || '1'),
      penaltyAmount: bounty.penaltyAmount ? String(bounty.penaltyAmount) : '',
    });
  };

  const handleSaveBounty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBounty) return;
    setSavingBounty(true);
    try {
      const res = await fetch(`/api/admin/bounties/${editingBounty.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: editBountyForm.title,
          description: editBountyForm.description || null,
          reward: parseFloat(editBountyForm.reward),
          startDate: editBountyForm.startDate,
          deadline: editBountyForm.deadline,
          maxClaims: parseInt(editBountyForm.maxSlots) || 1,
          penaltyAmount: parseFloat(editBountyForm.penaltyAmount) || 0,
        }),
      });
      if (!res.ok) {
        alert("Failed to update bounty");
        return;
      }
      setEditingBounty(null);
      refetchBounties();
    } catch (error) {
      alert("Failed to update bounty");
    } finally {
      setSavingBounty(false);
    }
  };

  const handleDeleteBounty = async (bountyId: string) => {
    if (!confirm("Are you sure you want to delete this bounty?")) return;
    try {
      const res = await fetch(`/api/admin/bounties/${bountyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        alert("Failed to delete bounty");
        return;
      }
      refetchBounties();
    } catch (error) {
      alert("Failed to delete bounty");
    }
  };

  const handleApproveClaim = async (bountyId: string, claimId: string) => {
    setProcessingClaimId(claimId);
    try {
      const res = await fetch(`/api/admin/bounties/${bountyId}/approve-claim/${claimId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || "Failed to approve claim");
        return;
      }
      refetchBounties();
    } catch (error) {
      alert("Failed to approve claim");
    } finally {
      setProcessingClaimId(null);
    }
  };

  const handleRejectClaim = async (bountyId: string, claimId: string) => {
    if (!confirm("Are you sure you want to reject this claim?")) return;
    setProcessingClaimId(claimId);
    try {
      const res = await fetch(`/api/admin/bounties/${bountyId}/reject-claim/${claimId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || "Failed to reject claim");
        return;
      }
      refetchBounties();
    } catch (error) {
      alert("Failed to reject claim");
    } finally {
      setProcessingClaimId(null);
    }
  };

  const totalPendingClaims = allBounties.reduce((sum, b) => sum + (b.pendingApprovalCount || 0), 0);

  const celebrationsEndpoint = isAdmin ? "/api/admin/celebrations" : "/api/creator/celebrations";
  const { data: celebrationsData } = useQuery<Celebration[]>({
    queryKey: [celebrationsEndpoint],
    queryFn: async () => {
      const res = await fetch(celebrationsEndpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch celebrations");
      return res.json();
    },
    enabled: !!token,
  });
  
  const celebrations: Celebration[] = celebrationsData || [];

  // Fetch real creators data from API - visible to everyone
  const creatorsEndpoint = isAdmin ? "/api/admin/creators" : "/api/creator/team-members";
  const { data: creatorsApiData } = useQuery<UserWithStats[]>({
    queryKey: [creatorsEndpoint, { status: statusFilter }],
    queryFn: async () => {
      const res = await fetch(`${creatorsEndpoint}?status=${statusFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch creators");
      return res.json();
    },
    enabled: !!token,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const sortCreators = (creatorsList: UserWithStats[]) => {
    const sorted = [...creatorsList];
    const isAllTime = cycleView === 'all';
    const getViews = (c: UserWithStats): number => isAllTime ? Number(c.eligibleViews || 0) : Number(c.viewsThisCycle || 0);
    const getPayout = (c: UserWithStats): number => isAllTime ? Number(c.totalPaid || 0) : Number(c.earningsThisCycle || 0);
    
    switch (sortBy) {
      case "highest_paid":
        return sorted.sort((a, b) => {
          const payDiff = getPayout(b) - getPayout(a);
          if (payDiff !== 0) return payDiff;
          const viewDiff = getViews(b) - getViews(a);
          if (viewDiff !== 0) return viewDiff;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
      case "highest_views":
        return sorted.sort((a, b) => {
          const viewDiff = getViews(b) - getViews(a);
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

  const filteredCreatorsList = creatorsApiData?.filter((creator) => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${creator.firstName || ''} ${creator.lastName || ''}`.toLowerCase();
    return creator.email.toLowerCase().includes(searchLower) || fullName.includes(searchLower);
  });

  const sortedCreators = filteredCreatorsList ? sortCreators(filteredCreatorsList) : [];

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  
  // Fetch posting streak data - admin sees team-wide, creator sees personal
  interface PostingStreakResponse {
    streakData: number[];
    dates: string[];
    currentStreak: number;
    thisWeek: string;
    totalPosts28d: number;
    cycleVideos: number;
    cycleViews: number;
    cycleEarnings: number;
  }
  
  const postingStreakEndpoint = isAdmin ? "/api/admin/team-posting-streak" : "/api/creator/posting-streak";
  
  const { data: postingStreakData } = useQuery<PostingStreakResponse>({
    queryKey: [postingStreakEndpoint],
    queryFn: async () => {
      const res = await fetch(postingStreakEndpoint, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch posting streak");
      return res.json();
    },
    enabled: !!token,
  });
  
  const streakData = postingStreakData?.streakData || Array(28).fill(0);

  const formatNumber = (num: number | undefined | null): string => {
    if (num == null) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const CHART_COLORS = ['#38BDF8', '#0EA5E9', '#06B6D4', '#22D3EE', '#67E8F9', '#A5F3FC', '#EC4899', '#0284C7'];

  const DonutChart = ({ data, total, label, centerLabel }: DonutChartProps) => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    const textColor = isDarkMode ? '#ffffff' : '#111827';
    const tooltipBg = isDarkMode ? '#1a1a1a' : '#ffffff';
    const tooltipBorder = isDarkMode ? '#333333' : '#e5e7eb';
    
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
            <Label
              content={(props: any) => {
                const viewBox = props?.viewBox;
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <g>
                      <text 
                        x={viewBox.cx} 
                        y={(viewBox.cy || 0) - 8} 
                        textAnchor="middle" 
                        dominantBaseline="middle"
                        style={{ fill: '#22c55e', fontSize: '12px', fontWeight: 500 }}
                      >
                        {centerLabel}
                      </text>
                      <text 
                        x={viewBox.cx} 
                        y={(viewBox.cy || 0) + 8} 
                        textAnchor="middle" 
                        dominantBaseline="middle"
                        style={{ fill: textColor, fontSize: '18px', fontWeight: 700 }}
                      >
                        {label}
                      </text>
                    </g>
                  );
                }
                return null;
              }}
            />
          </Pie>
          <Tooltip 
            formatter={(value: number, _name: string, props: any) => [formatNumber(value), props.payload?.name || 'Creator']}
            contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '8px', color: textColor }}
          />
          <Legend 
            layout="vertical" 
            align="right" 
            verticalAlign="middle"
            wrapperStyle={{ fontSize: '12px', color: textColor }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const StreakCalendar = () => {
    const getColor = (posts: number): string => {
      if (posts === 0) return 'bg-gray-100 dark:bg-[#1e1e1e]';
      if (posts <= 2) return 'bg-sky-200 dark:bg-sky-400/40';
      if (posts <= 5) return 'bg-sky-300 dark:bg-sky-400/60';
      if (posts <= 9) return 'bg-sky-500 dark:bg-sky-500/80';
      if (posts <= 15) return 'bg-sky-600 dark:bg-sky-600';
      return 'bg-sky-800 dark:bg-sky-700';
    };
    
    const formatDateForTooltip = (dateStr: string): string => {
      return formatUTCDate(dateStr, "MMM d");
    };

    return (
      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map((day, i) => (
            <div key={i} className="text-xs text-gray-400 dark:text-gray-500 text-center">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {streakData.map((posts, i) => {
            const dateStr = postingStreakData?.dates?.[i];
            const dateLabel = dateStr ? formatDateForTooltip(dateStr) : '';
            const isCurrentWeek = i >= 21;
            return (
              <div
                key={i}
                className="relative group z-0 hover:z-10"
              >
                <div
                  className={`aspect-square rounded-sm ${getColor(posts)} ${isCurrentWeek ? 'ring-1 ring-sky-400 dark:ring-sky-500/60' : ''} relative transition-all duration-200 ease-out group-hover:scale-125 group-hover:shadow-lg group-hover:rounded-md cursor-pointer animate-calendar-day flex items-center justify-center`}
                  style={{ animationDelay: `${1.8 + i * 0.04}s` }}
                >
                  {dateStr && (
                    <span className={`text-[8px] sm:text-[9px] font-medium leading-none ${posts > 0 ? 'text-white/90' : 'text-gray-400 dark:text-gray-500'}`}>
                      {formatDateForTooltip(dateStr)}
                    </span>
                  )}
                </div>
                {dateStr && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                    <div className="font-medium">{dateLabel}</div>
                    <div className="text-gray-300">{posts} video{posts !== 1 ? 's' : ''}</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-1.5 mt-3 text-xs text-gray-500 dark:text-gray-400">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-[#1e1e1e]"></div>
          <div className="w-3 h-3 rounded-sm bg-sky-200 dark:bg-sky-400/40"></div>
          <div className="w-3 h-3 rounded-sm bg-sky-300 dark:bg-sky-400/60"></div>
          <div className="w-3 h-3 rounded-sm bg-sky-500 dark:bg-sky-500/80"></div>
          <div className="w-3 h-3 rounded-sm bg-sky-600 dark:bg-sky-600"></div>
          <div className="w-3 h-3 rounded-sm bg-sky-800 dark:bg-sky-700"></div>
          <span>More</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0d] text-gray-900 dark:text-gray-100">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Program Hub</h2>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 dark:text-gray-500">Track team performance and stay connected.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {!isCreator && (
              <>
                <button
                  onClick={syncAllCreatorsWithProgress}
                  disabled={isSyncing}
                  data-testid="button-refresh-engagement"
                  className="group relative px-5 py-2.5 rounded-xl text-sm font-semibold text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(56,189,248,0.4)] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
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
                        {adminSyncProgress.total > 0 
                          ? `${syncProgressPercent}%`
                          : "Starting..."}
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 group-hover:animate-pulse fill-current" />
                        Refresh All Engagement
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
              </>
            )}
            <div className="flex bg-gray-100 dark:bg-[#1a1a1a] rounded-lg p-1">
              <button 
                onClick={() => setCycleView('current')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  cycleView === 'current' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'
                }`}
              >
                Current Cycle
              </button>
              <button 
                onClick={() => setCycleView('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  cycleView === 'all' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'
                }`}
              >
                All Time
              </button>
            </div>
          </div>
        </div>
        
        {isCreator && <RefreshProgressBar inline />}
        
        {isAdmin && <RefreshProgressBar inline isActive={isSyncingAll} progressValue={syncProgress} quoteText={syncQuote} />}

        <div className={`grid grid-cols-2 ${isAdmin ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3 sm:gap-4 mb-6`}>
          <div className={`group bg-white dark:bg-[#141414] rounded-xl border p-4 sm:p-5 stat-hover-zoom animate-stat-entrance ${cycleView === 'all' ? 'border-sky-300 bg-sky-50/50 dark:bg-sky-900/10' : 'border-gray-200 dark:border-[#252525] hover:border-sky-200'}`}>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">{cycleView === 'all' ? 'Total Creators' : 'New Creators'}</span>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-100 to-sky-50 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:from-sky-200 group-hover:to-sky-100">
                <UsersRound className="w-5 h-5 text-sky-600 transition-transform duration-300 group-hover:scale-110" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{cycleView === 'all' ? programStats.totalCreators : programStats.newCreators}</p>
              {programStats.deltas && (() => {
                const delta = cycleView === 'all' ? programStats.deltas!.totalCreators : programStats.deltas!.newCreators;
                return delta > 0 ? <span className="text-xs font-semibold text-green-500">+{delta}</span> : null;
              })()}
            </div>
          </div>

          <div className={`group bg-white dark:bg-[#141414] rounded-xl border p-4 sm:p-5 stat-hover-zoom animate-stat-entrance-delay-1 ${cycleView === 'all' ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-[#252525] hover:border-blue-200'}`}>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">{cycleView === 'all' ? 'Eligible Videos' : 'Videos This Cycle'}</span>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:from-blue-200 group-hover:to-blue-100">
                <Clapperboard className="w-5 h-5 text-blue-600 transition-transform duration-300 group-hover:scale-110" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{cycleView === 'all' ? programStats.eligibleVideos : programStats.videosThisCycle}</p>
              {programStats.deltas && (() => {
                const delta = cycleView === 'all' ? programStats.deltas!.eligibleVideos : programStats.deltas!.videosThisCycle;
                return delta > 0 ? <span className="text-xs font-semibold text-green-500">+{delta}</span> : null;
              })()}
            </div>
            <div className="flex flex-col mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500">
              <span className="flex items-center gap-1"><InstagramIcon className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-pink-500" /> {cycleView === 'all' ? programStats.igEligibleVideos : programStats.igVideosThisCycle}</span>
              <span className="flex items-center gap-1"><TikTokIcon className="w-3 sm:w-3.5 h-3 sm:h-3.5" /> {cycleView === 'all' ? programStats.ttEligibleVideos : programStats.ttVideosThisCycle}</span>
            </div>
          </div>

          <div className={`group bg-white dark:bg-[#141414] rounded-xl border p-4 sm:p-5 stat-hover-zoom animate-stat-entrance-delay-2 ${cycleView === 'all' ? 'border-cyan-300 bg-cyan-50/50 dark:bg-cyan-900/10' : 'border-gray-200 dark:border-[#252525] hover:border-cyan-200'}`}>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">{cycleView === 'all' ? 'Eligible Views' : 'Views This Cycle'}</span>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-100 to-cyan-50 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:from-cyan-200 group-hover:to-cyan-100">
                <Eye className="w-5 h-5 text-cyan-600 transition-transform duration-300 group-hover:scale-110" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{formatNumber(cycleView === 'all' ? programStats.eligibleViews : programStats.viewsThisCycle)}</p>
              {programStats.deltas && (() => {
                const delta = cycleView === 'all' ? programStats.deltas!.eligibleViews : programStats.deltas!.viewsThisCycle;
                return delta > 0 ? <span className="text-xs font-semibold text-green-500">+{formatNumber(delta)}</span> : null;
              })()}
            </div>
            <div className="flex flex-col mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500">
              <span className="flex items-center gap-1"><InstagramIcon className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-pink-500" /> {formatNumber(cycleView === 'all' ? programStats.igEligibleViews : programStats.igViewsThisCycle)}</span>
              <span className="flex items-center gap-1"><TikTokIcon className="w-3 sm:w-3.5 h-3 sm:h-3.5" /> {formatNumber(cycleView === 'all' ? programStats.ttEligibleViews : programStats.ttViewsThisCycle)}</span>
            </div>
          </div>

          <div className={`group bg-white dark:bg-[#141414] rounded-xl border p-4 sm:p-5 stat-hover-zoom animate-stat-entrance-delay-3 ${cycleView === 'all' ? 'border-orange-300 bg-orange-50/50 dark:bg-orange-900/10' : 'border-gray-200 dark:border-[#252525] hover:border-orange-200'}`}>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">Followers</span>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:from-orange-200 group-hover:to-orange-100">
                <TrendingUp className="w-5 h-5 text-orange-600 transition-all duration-300 group-hover:scale-110" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{formatNumber(programStats.followers)}</p>
              {programStats.deltas && (() => {
                const delta = programStats.deltas!.followers;
                return delta > 0 ? <span className="text-xs font-semibold text-green-500">+{formatNumber(delta)}</span> : null;
              })()}
            </div>
            <div className="flex flex-col mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500">
              <span className="flex items-center gap-1"><InstagramIcon className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-pink-500" /> {formatNumber(programStats.igFollowers)}</span>
              <span className="flex items-center gap-1"><TikTokIcon className="w-3 sm:w-3.5 h-3 sm:h-3.5" /> {formatNumber(programStats.ttFollowers)}</span>
            </div>
          </div>

          {isAdmin && (
            <div className={`group bg-white dark:bg-[#141414] rounded-xl border p-4 sm:p-5 stat-hover-zoom animate-stat-entrance-delay-4 ${cycleView === 'all' ? 'border-green-300 bg-green-50/50 dark:bg-green-900/10' : 'border-gray-200 dark:border-[#252525] hover:border-green-200'}`}>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">{cycleView === 'all' ? 'Money Paid Till Now' : 'Total Pay'}</span>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:from-green-200 group-hover:to-green-100">
                  <DollarSign className="w-5 h-5 text-green-600 transition-transform duration-300 group-hover:scale-110" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-bold text-green-600">${formatNumber(cycleView === 'all' ? programStats.moneyPaidTillNow : programStats.totalPay)}</p>
                {programStats.deltas && (() => {
                  const delta = cycleView === 'all' ? (programStats.deltas!.moneyPaidTillNow ?? 0) : (programStats.deltas!.totalPay ?? 0);
                  return delta > 0 ? <span className="text-xs font-semibold text-green-500">+${formatNumber(delta)}</span> : null;
                })()}
              </div>
              {cycleView !== 'all' && (
                <div className="flex flex-col mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500">
                  <span className="flex items-center gap-1">Base: <span className="text-green-600 font-mono">${formatNumber(programStats.basePay)}</span></span>
                  <span className="flex items-center gap-1">Bonus: <span className="text-amber-600 font-mono">${formatNumber(programStats.bonusPay)}</span></span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="group bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525] p-4 sm:p-5 stat-hover-zoom hover:border-blue-200 animate-stat-entrance-delay-4">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                <Clapperboard className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-gray-700 dark:text-gray-300 font-medium text-sm sm:text-base">{cycleView === 'all' ? 'All Time Videos' : 'Videos This Cycle'}</span>
            </div>
            {videosChartData.length > 0 ? (
              <DonutChart 
                data={videosChartData}
                total={totalVideos}
                label={totalVideos.toString()}
                centerLabel=""
              />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">No video data</div>
            )}
          </div>

          <div className="group bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525] p-5 stat-hover-zoom hover:border-pink-200 animate-stat-entrance-delay-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-100 to-pink-50 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                <InstagramIcon className="w-4 h-4 text-pink-500" />
              </div>
              <span className="text-gray-700 font-medium">{cycleView === 'all' ? 'All Time IG Views' : 'Instagram Views'}</span>
            </div>
            {igViewsChartData.length > 0 ? (
              <DonutChart 
                data={igViewsChartData}
                total={totalIgViews}
                label={formatNumber(totalIgViews)}
                centerLabel=""
              />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">No IG view data</div>
            )}
          </div>

          <div className="group bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525] p-5 stat-hover-zoom hover:border-gray-300 animate-stat-entrance-delay-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                <TikTokIcon className="w-4 h-4 text-gray-900" />
              </div>
              <span className="text-gray-700 font-medium">{cycleView === 'all' ? 'All Time TikTok Views' : 'TikTok Views'}</span>
            </div>
            {tiktokViewsChartData.length > 0 ? (
              <DonutChart 
                data={tiktokViewsChartData}
                total={totalTiktokViews}
                label={formatNumber(totalTiktokViews)}
                centerLabel=""
              />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">No TikTok view data</div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525] mb-6">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-[#252525] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AnimatedTrophy size={24} className="text-yellow-500" />
              <h2 className="font-bold text-gray-900 dark:text-white">Cycle Leaderboard</h2>
            </div>
            <div className="flex gap-2">
              {[
                { id: 'views' as const, label: 'Most Views' },
                { id: 'improved' as const, label: 'Most Improved' },
                { id: 'streak' as const, label: 'Longest Streak' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setLeaderboardCategory(cat.id)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    leaderboardCategory === cat.id
                      ? 'bg-sky-500 text-white'
                      : 'bg-gray-100 dark:bg-[#252525] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#303030]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="p-4 overflow-x-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 min-w-0">
              {leaderboard[leaderboardCategory].map((entry) => (
                <div 
                  key={entry.rank} 
                  className={`group relative p-4 rounded-xl text-center transition-all duration-300 hover:-translate-y-2 hover:scale-105 ${
                    entry.rank === 1 
                      ? 'bg-gradient-to-b from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-amber-900/20 border-2 border-yellow-300 dark:border-yellow-700 hover:shadow-[0_8px_30px_rgba(234,179,8,0.4)] hover:border-yellow-400 animate-stat-entrance-delay-7' 
                      : entry.rank === 2 
                        ? 'bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#303030] hover:shadow-[0_8px_30px_rgba(139,92,246,0.25)] hover:border-sky-300 dark:hover:border-sky-600 animate-stat-entrance-delay-8' 
                        : entry.rank === 3 
                          ? 'bg-orange-50 dark:bg-orange-900/15 border border-orange-200 dark:border-orange-800/40 hover:shadow-[0_8px_30px_rgba(249,115,22,0.3)] hover:border-orange-300 dark:hover:border-orange-600 animate-stat-entrance-delay-9' 
                          : entry.rank === 4
                            ? 'bg-gray-50 dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#303030] hover:shadow-[0_8px_30px_rgba(139,92,246,0.2)] hover:border-sky-200 dark:hover:border-sky-700 animate-stat-entrance-delay-10'
                            : 'bg-gray-50 dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#303030] hover:shadow-[0_8px_30px_rgba(139,92,246,0.2)] hover:border-sky-200 dark:hover:border-sky-700 animate-stat-entrance-delay-11'
                  }`}
                >
                  {entry.rank === 1 && (
                    <div className="flex justify-center mb-1">
                      <svg 
                        width="24" 
                        height="18" 
                        viewBox="0 0 24 18" 
                        className="animate-[gentle-bounce_2s_ease-in-out_infinite]"
                        style={{ 
                          filter: 'drop-shadow(0 2px 4px rgba(218,165,32,0.4))',
                          animation: 'gentle-bounce 2s ease-in-out infinite'
                        }}
                      >
                        <defs>
                          <linearGradient id={`crownGold-${entry.rank}`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#FFE55C" />
                            <stop offset="50%" stopColor="#FFD700" />
                            <stop offset="100%" stopColor="#DAA520" />
                          </linearGradient>
                        </defs>
                        <path 
                          d="M12 0L15 6L21 3L19 12H5L3 3L9 6L12 0Z" 
                          fill={`url(#crownGold-${entry.rank})`}
                          stroke="#B8860B"
                          strokeWidth="0.5"
                        />
                        <circle cx="12" cy="4" r="1.2" fill="#FF6B6B" />
                        <circle cx="7" cy="6" r="0.8" fill="#4ECDC4" />
                        <circle cx="17" cy="6" r="0.8" fill="#4ECDC4" />
                        <rect x="5" y="12" width="14" height="3" rx="0.5" fill={`url(#crownGold-${entry.rank})`} stroke="#B8860B" strokeWidth="0.5" />
                      </svg>
                    </div>
                  )}
                  <div className={`w-12 h-12 mx-auto rounded-full ${entry.color} flex items-center justify-center text-white text-lg font-bold mb-2`}>
                    {entry.name.charAt(0)}
                  </div>
                  <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mb-2 ${
                    entry.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                    entry.rank === 2 ? 'bg-gray-400 dark:bg-gray-600 text-white' :
                    entry.rank === 3 ? 'bg-orange-400 text-white' :
                    'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                  }`}>
                    {entry.rank}
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{entry.name}</p>
                  <div className="mt-1 space-y-0.5">
                    {entry.instagramUsername && (
                      <p className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <SiInstagram className="w-3 h-3 text-pink-500" />
                        <span className="truncate">@{entry.instagramUsername}</span>
                      </p>
                    )}
                    {entry.tiktokUsername && (
                      <p className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <SiTiktok className="w-3 h-3 dark:text-white" />
                        <span className="truncate">@{entry.tiktokUsername}</span>
                      </p>
                    )}
                  </div>
                  <p className="text-sky-600 dark:text-sky-400 font-bold text-lg mt-1">{entry.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <div className="lg:col-span-8 space-y-6">

            <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525]">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-[#252525] flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  Today's Posts
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">({allTodayTopPosts.length} total)</span>
                </h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-[#252525]">
                {allTodayTopPosts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No posts today yet
                  </div>
                ) : (
                  displayedTopPosts.map((video) => {
                    const isPlaying = playingPostId === video.id;
                    return (
                      <div key={video.id} className="hover:bg-gray-50 dark:hover:bg-[#1a1a1a]/50 transition-colors">
                        <div className="group px-3 sm:px-5 py-3 space-y-2">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <button
                              onClick={() => {
                                if (video.platformVideoId) {
                                  setPlayingPostId(isPlaying ? null : video.id);
                                } else if (video.url) {
                                  window.open(video.url, '_blank');
                                }
                              }}
                              className="relative w-10 h-14 bg-gray-200 dark:bg-gray-700 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer group/thumb"
                            >
                              {video.thumbnail ? (
                                <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-lg">🎬</span>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center animate-[breathe_2s_ease-in-out_infinite] group-hover/thumb:scale-110 transition-transform">
                                  <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[7px] border-l-white border-b-[4px] border-b-transparent ml-0.5" />
                                </div>
                              </div>
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                  {truncateCaption(video.caption, 5)}
                                </p>
                                {video.caption && video.caption.split(/\s+/).length > 5 && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setCaptionPostId(video.id); }}
                                    className="text-[10px] text-sky-500 hover:text-sky-700 dark:hover:text-sky-300 font-medium flex-shrink-0 whitespace-nowrap"
                                  >
                                    more
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 ${
                                  video.platform === 'instagram' 
                                    ? 'bg-gradient-to-br from-sky-500 to-pink-500' 
                                    : 'bg-black'
                                }`}>
                                  {video.platform === 'instagram' ? (
                                    <InstagramIcon className="w-2 h-2 text-white" />
                                  ) : (
                                    <TikTokIcon className="w-2 h-2 text-white" />
                                  )}
                                </span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">@{video.username}</span>
                                {video.postedAt && (
                                  <span className="text-[9px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                    {formatUTCDate(video.postedAt, "MMM d HH:mm")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 hidden sm:block space-y-0.5">
                              <p className="text-[12px] font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                                {formatStatNumber(video.views)} <span className="text-gray-400 dark:text-gray-500">views</span>
                              </p>
                              <p className="text-[12px] text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {formatStatNumber(video.likes)} <span className="text-gray-400 dark:text-gray-500">likes</span>
                              </p>
                              <p className="text-[12px] text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {formatStatNumber(video.comments)} <span className="text-gray-400 dark:text-gray-500">comments</span>
                              </p>
                            </div>
                            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                              <div className="relative group/fire">
                                <button
                                  onClick={() => handleToggleFire(video.id)}
                                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                                    videoFires[video.id]?.userFired 
                                      ? 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 shadow-sm' 
                                      : 'bg-white dark:bg-[#252525] border-gray-200 dark:border-[#3a3a3a] text-gray-500 dark:text-gray-400 hover:border-orange-300 dark:hover:border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-500 hover:scale-105 hover:shadow-sm'
                                  }`}
                                >
                                  <span className="text-sm">🔥</span>
                                  <span className="text-xs font-medium">{videoFires[video.id]?.count || 0}</span>
                                </button>
                                {(videoFires[video.id]?.users?.length || 0) > 0 && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/fire:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                                    <div className="font-medium mb-1">Fired by:</div>
                                    <div className="space-y-0.5">
                                      {videoFires[video.id]?.users?.slice(0, 5).map((name, i) => (
                                        <div key={i} className="flex items-center gap-1.5">
                                          <span className="w-4 h-4 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-[8px] font-bold">{name.charAt(0).toUpperCase()}</span>
                                          <span>{name}</span>
                                        </div>
                                      ))}
                                      {(videoFires[video.id]?.users?.length || 0) > 5 && (
                                        <div className="text-gray-400">+{(videoFires[video.id]?.users?.length || 0) - 5} more</div>
                                      )}
                                    </div>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => openCommentsPanel(video.id, video.caption || '')}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border bg-white dark:bg-[#252525] border-gray-200 dark:border-[#3a3a3a] text-gray-500 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500 hover:scale-105 hover:shadow-sm transition-all duration-200 cursor-pointer"
                                title="View comments"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">{videoCommentCounts[video.id] || 0}</span>
                              </button>
                              {video.platformVideoId && (
                                <button
                                  onClick={() => setPlayingPostId(video.id)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium hover:scale-105 hover:shadow-sm transition-all duration-200 cursor-pointer"
                                  title="Watch video"
                                >
                                  <Play className="w-3 h-3" />
                                  Watch
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex sm:hidden items-center justify-between ml-12">
                            <div className="flex items-center gap-3 text-[11px]">
                              <span className="font-semibold text-gray-900 dark:text-white">{formatStatNumber(video.views)} <span className="text-gray-400">views</span></span>
                              <span className="text-gray-600 dark:text-gray-400">{formatStatNumber(video.likes)} <span className="text-gray-400">likes</span></span>
                              <span className="text-gray-600 dark:text-gray-400">{formatStatNumber(video.comments)} <span className="text-gray-400">cmts</span></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="relative group/fire">
                                <button
                                  onClick={() => handleToggleFire(video.id)}
                                  className={`flex items-center gap-1 px-1.5 py-1 rounded-md border transition-all duration-200 cursor-pointer ${
                                    videoFires[video.id]?.userFired 
                                      ? 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400' 
                                      : 'bg-white dark:bg-[#252525] border-gray-200 dark:border-[#3a3a3a] text-gray-500 dark:text-gray-400'
                                  }`}
                                >
                                  <span className="text-xs">🔥</span>
                                  <span className="text-[10px] font-medium">{videoFires[video.id]?.count || 0}</span>
                                </button>
                              </div>
                              <button
                                onClick={() => openCommentsPanel(video.id, video.caption || '')}
                                className="flex items-center gap-1 px-1.5 py-1 rounded-md border bg-white dark:bg-[#252525] border-gray-200 dark:border-[#3a3a3a] text-gray-500 dark:text-gray-400 transition-all duration-200 cursor-pointer"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span className="text-[10px] font-medium">{videoCommentCounts[video.id] || 0}</span>
                              </button>
                              {video.platformVideoId && (
                                <button
                                  onClick={() => setPlayingPostId(video.id)}
                                  className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-blue-500 text-white text-[10px] font-medium cursor-pointer"
                                >
                                  <Play className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {allTodayTopPosts.length > 5 && (
                  <button
                    onClick={() => setShowAllTopPosts(!showAllTopPosts)}
                    className="w-full py-3 text-sm font-medium text-sky-600 dark:text-sky-400 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]/50 transition-colors border-t border-gray-100 dark:border-[#252525]"
                  >
                    {showAllTopPosts ? "Show Less" : `View All ${allTodayTopPosts.length} Posts`}
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525]">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-[#252525] flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white">💎 Bounty Board</h2>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-sky-500">{bounties.length} active bounties</span>
                  {isAdmin && (
                    <button
                      onClick={() => { setShowSubmissionsDialog(true); setExpandedBountyId(null); }}
                      className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {`Submissions${totalPendingClaims > 0 ? ` (${totalPendingClaims})` : ''}`}
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setShowBountyForm(!showBountyForm)}
                      className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      + New Bounty
                    </button>
                  )}
                </div>
              </div>
              
              {isAdmin && showBountyForm && (
                <form onSubmit={handleCreateBounty} className="p-4 bg-sky-50 border-b border-sky-100">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Bounty title *"
                      value={newBounty.title}
                      onChange={(e) => setNewBounty({ ...newBounty, title: e.target.value })}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={newBounty.description}
                      onChange={(e) => setNewBounty({ ...newBounty, description: e.target.value })}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <input
                      type="number"
                      placeholder="Reward $ *"
                      value={newBounty.reward}
                      onChange={(e) => setNewBounty({ ...newBounty, reward: e.target.value })}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      required
                      min="1"
                    />
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-500 mb-1">Start Date *</label>
                      <input
                        type="date"
                        value={newBounty.startDate}
                        onChange={(e) => setNewBounty({ ...newBounty, startDate: e.target.value })}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        required
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-500 mb-1">End Date *</label>
                      <input
                        type="date"
                        value={newBounty.deadline}
                        onChange={(e) => setNewBounty({ ...newBounty, deadline: e.target.value })}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        required
                      />
                    </div>
                    <input
                      type="number"
                      placeholder="Max slots"
                      value={newBounty.maxSlots}
                      onChange={(e) => setNewBounty({ ...newBounty, maxSlots: e.target.value })}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      min="1"
                    />
                    <input
                      type="number"
                      placeholder="Penalty $ (optional)"
                      value={newBounty.penaltyAmount}
                      onChange={(e) => setNewBounty({ ...newBounty, penaltyAmount: e.target.value })}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="submit"
                      disabled={creatingBounty}
                      className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {creatingBounty ? "Creating..." : "Create Bounty"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBountyForm(false)}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              
              <div className="p-4 space-y-3">
                {bounties.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No active bounties at the moment</p>
                    {isAdmin && <p className="text-sm mt-1">Click "New Bounty" above to create one</p>}
                  </div>
                ) : (
                  bounties.map((bounty) => (
                    <div key={bounty.id} className="group flex items-center gap-4 p-4 bg-gray-50 dark:bg-[#1a1a1a]/50 rounded-xl border border-gray-100 dark:border-[#2a2a2a] hover:border-sky-300 dark:hover:border-sky-500 hover:shadow-lg hover:shadow-sky-100 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                      <div className="w-1.5 h-12 rounded-full bg-sky-500"></div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white">{bounty.title}</h3>
                        {bounty.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{bounty.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4 text-sky-500 group-hover:animate-spin" style={{ animationDuration: '2s' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            {formatDeadlineCountdown(bounty.deadlineDate)}
                          </span>
                          <span className="flex items-center gap-1"><AnimatedUsers size={16} className="text-gray-500" /> {bounty.slots}</span>
                          {bounty.penaltyAmount > 0 && (
                            <span className="text-red-400 text-xs">${bounty.penaltyAmount.toFixed(2)} deducted if not completed</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-green-500 font-bold text-lg">{bounty.reward}</span>
                        <div className="mt-1">
                          {isAdmin ? (
                            <div className="flex gap-1">
                              <button 
                                onClick={() => handleEditBounty(bounty)}
                                className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg text-sm font-medium transition-colors"
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteBounty(bounty.id)}
                                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-sm font-medium transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          ) : bounty.userClaim ? (
                            bounty.userClaim.status === "approved" ? (
                              <span className="px-4 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                                Approved ✓
                              </span>
                            ) : bounty.userClaim.status === "completed" ? (
                              <span className="px-4 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium">
                                Pending Review
                              </span>
                            ) : bounty.userClaim.status === "rejected" ? (
                              <span className="px-4 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                                Rejected
                              </span>
                            ) : (
                              <span className="px-4 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-sm font-medium">
                                Claimed
                              </span>
                            )
                          ) : new Date(bounty.deadlineDate).getTime() <= Date.now() ? (
                            <span className="px-4 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-lg text-sm font-medium">
                              Expired
                            </span>
                          ) : bounty.canClaim ? (
                            <button 
                              onClick={() => setClaimConfirmBounty(bounty)}
                              disabled={claimingBountyId === bounty.id}
                              className="px-4 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              {claimingBountyId === bounty.id ? "..." : "Claim"}
                            </button>
                          ) : (
                            <span className="px-4 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium">
                              Full
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

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

            <Dialog open={!!editingBounty} onOpenChange={(open) => !open && setEditingBounty(null)}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Edit Bounty</DialogTitle>
                  <DialogDescription>Update bounty details</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSaveBounty} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Bounty title *"
                      value={editBountyForm.title}
                      onChange={(e) => setEditBountyForm({ ...editBountyForm, title: e.target.value })}
                      className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={editBountyForm.description}
                      onChange={(e) => setEditBountyForm({ ...editBountyForm, description: e.target.value })}
                      className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <input
                      type="number"
                      placeholder="Reward $ *"
                      value={editBountyForm.reward}
                      onChange={(e) => setEditBountyForm({ ...editBountyForm, reward: e.target.value })}
                      className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      required
                      min="1"
                    />
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-500 mb-1">Start Date *</label>
                      <input
                        type="date"
                        value={editBountyForm.startDate}
                        onChange={(e) => setEditBountyForm({ ...editBountyForm, startDate: e.target.value })}
                        className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        required
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-500 mb-1">End Date *</label>
                      <input
                        type="date"
                        value={editBountyForm.deadline}
                        onChange={(e) => setEditBountyForm({ ...editBountyForm, deadline: e.target.value })}
                        className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        required
                      />
                    </div>
                    <input
                      type="number"
                      placeholder="Max slots"
                      value={editBountyForm.maxSlots}
                      onChange={(e) => setEditBountyForm({ ...editBountyForm, maxSlots: e.target.value })}
                      className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      min="1"
                    />
                    <input
                      type="number"
                      placeholder="Penalty $ (optional)"
                      value={editBountyForm.penaltyAmount}
                      onChange={(e) => setEditBountyForm({ ...editBountyForm, penaltyAmount: e.target.value })}
                      className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <DialogFooter>
                    <button
                      type="button"
                      onClick={() => setEditingBounty(null)}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingBounty}
                      className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {savingBounty ? "Saving..." : "Save Changes"}
                    </button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={showSubmissionsDialog} onOpenChange={setShowSubmissionsDialog}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Bounty Submissions</DialogTitle>
                  <DialogDescription>Click on a bounty to view its submissions</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 mt-2">
                  {allBounties.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No bounties yet</p>
                    </div>
                  ) : (
                    allBounties.map((bounty) => {
                      const isExpired = bounty.deadlineDate && new Date(bounty.deadlineDate).getTime() <= Date.now();
                      const isExpanded = expandedBountyId === bounty.id;
                      const claimCount = bounty.claims?.length || 0;
                      const pendingCount = bounty.claims?.filter((c: BountyClaim) => c.status === 'completed').length || 0;
                      return (
                        <div key={bounty.id} className="border border-gray-200 dark:border-[#2a2a2a] rounded-xl overflow-hidden">
                          <button
                            onClick={() => setExpandedBountyId(isExpanded ? null : bounty.id)}
                            className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]/50 transition-colors text-left"
                          >
                            <div className={`w-1.5 h-10 rounded-full ${isExpired ? 'bg-gray-300 dark:bg-gray-600' : 'bg-sky-500'}`}></div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-gray-900 dark:text-white truncate">{bounty.title}</h3>
                                {isExpired && (
                                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded text-xs font-medium flex-shrink-0">Expired</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                                <span>{bounty.startDate ? new Date(bounty.startDate).toLocaleDateString() : "N/A"} - {bounty.deadlineDate ? new Date(bounty.deadlineDate).toLocaleDateString() : "No deadline"}</span>
                                <span className="text-green-500 font-medium">{bounty.reward}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {claimCount > 0 && (
                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs font-medium">
                                  {claimCount} claim{claimCount !== 1 ? 's' : ''}
                                </span>
                              )}
                              {pendingCount > 0 && (
                                <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded text-xs font-medium">
                                  {pendingCount} pending
                                </span>
                              )}
                              <AnimatedChevronDown size={16} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="border-t border-gray-100 dark:border-[#252525] bg-gray-50/50 dark:bg-[#0a0a0a]/50 p-4">
                              {!bounty.claims || bounty.claims.length === 0 ? (
                                <p className="text-center text-sm text-gray-500 py-4">No submissions for this bounty</p>
                              ) : (
                                <div className="space-y-3">
                                  {bounty.claims.map((claim: BountyClaim) => (
                                    <div key={claim.id} className="flex items-center gap-3 p-3 bg-white dark:bg-[#141414] rounded-lg border border-gray-100 dark:border-[#2a2a2a]">
                                      <div className={`w-1 h-8 rounded-full ${
                                        claim.status === 'approved' ? 'bg-green-500' :
                                        claim.status === 'completed' ? 'bg-yellow-500' :
                                        claim.status === 'rejected' ? 'bg-red-500' : 'bg-blue-500'
                                      }`}></div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-sm text-gray-900 dark:text-white">{claim.userName}</h4>
                                        <p className="text-xs text-gray-500">{claim.userEmail}</p>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                          claim.status === 'approved' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                          claim.status === 'completed' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                                          claim.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                          'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                        }`}>
                                          {claim.status === 'claimed' ? 'In Progress' : 
                                           claim.status === 'completed' ? 'Pending Review' :
                                           claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                                        </span>
                                        {claim.status === 'completed' && (
                                          <>
                                            <button
                                              onClick={() => handleApproveClaim(bounty.id, claim.id)}
                                              disabled={processingClaimId === claim.id}
                                              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                            >
                                              {processingClaimId === claim.id ? '...' : 'Approve'}
                                            </button>
                                            <button
                                              onClick={() => handleRejectClaim(bounty.id, claim.id)}
                                              disabled={processingClaimId === claim.id}
                                              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                            >
                                              Reject
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525] overflow-hidden">
              <div className="bg-gradient-to-r from-sky-600 to-sky-700 px-4 sm:px-6 py-4 text-white">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <AnimatedFire size={28} className="text-orange-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <h2 className="font-bold text-lg truncate">{survivorGame?.title || 'Streak Survivor'}</h2>
                      <p className="text-sky-200 text-sm truncate">{survivorGame?.description || 'Last creator standing wins the pot'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    {survivorGame ? (
                      <div className="text-left sm:text-right">
                        <p className="text-sky-200 text-sm">
                          {survivorGame.startDate && survivorGame.endDate ? (
                            <>
                              {formatUTCDate(survivorGame.startDate, "MMM d")} - {formatUTCDate(survivorGame.endDate, "MMM d")}
                            </>
                          ) : (
                            `Day ${survivorGame.currentDay}`
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-24 sm:w-32 h-2 bg-sky-400/30 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-white rounded-full"
                              style={{ 
                                width: survivorGame.startDate && survivorGame.endDate 
                                  ? `${Math.min(100, Math.max(0, ((Date.now() - new Date(survivorGame.startDate).getTime()) / (new Date(survivorGame.endDate).getTime() - new Date(survivorGame.startDate).getTime())) * 100))}%`
                                  : '0%'
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sky-200 text-sm">No active game</p>
                    )}
                    <button
                      onClick={() => setShowGameHistory(true)}
                      className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    >
                      📜 History
                    </button>
                    {isAdmin && (
                      survivorGame ? (
                        <>
                          <button
                            onClick={() => setShowDeleteGameConfirm(true)}
                            className="bg-red-500/80 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={handleOpenEditGame}
                            className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                          >
                            Edit
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setShowGameCreator(!showGameCreator)}
                          className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                        >
                          {showGameCreator ? 'Cancel' : 'New Game'}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6">
                {survivorGame ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
                      <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 rounded-xl p-3 sm:p-4 text-center transition-all duration-200 hover:scale-110 hover:shadow-lg hover:shadow-sky-200 cursor-pointer">
                        <p className="text-sky-600 dark:text-sky-400 text-xs font-medium mb-1">Prize Pool</p>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">${parseFloat(survivorGame.prizePool || '0').toFixed(0)}</p>
                        <p className="text-sky-500 text-xs mt-1">+${parseFloat(survivorGame.addedFromEliminations || '0').toFixed(0)} added</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-[#1a1a1a]/50 border border-gray-100 dark:border-[#2a2a2a] rounded-xl p-3 sm:p-4 text-center transition-all duration-200 hover:scale-110 hover:shadow-lg hover:shadow-gray-200 cursor-pointer">
                        <p className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">Survivors</p>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{survivors.length}</p>
                        <p className="text-gray-500 text-xs mt-1">of {survivorGame.totalParticipants} creators</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-[#1a1a1a]/50 border border-gray-100 dark:border-[#2a2a2a] rounded-xl p-3 sm:p-4 text-center transition-all duration-200 hover:scale-110 hover:shadow-lg hover:shadow-red-200 cursor-pointer">
                        <p className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">Your Lives</p>
                        <p className="text-lg font-semibold text-gray-400 dark:text-gray-500 mt-2">Not available</p>
                        <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Admins don't participate</p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 sm:p-4 text-center transition-all duration-200 hover:scale-110 hover:shadow-lg hover:shadow-amber-200 cursor-pointer">
                        <p className="text-amber-600 dark:text-amber-400 text-xs font-medium mb-1">Post Deadline</p>
                        <p className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400">{getTimeUntilMidnight()}</p>
                        <p className="text-amber-500 text-xs mt-1">until elimination</p>
                      </div>
                    </div>

                    {myStats && (
                      <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-sky-500 rounded-full flex items-center justify-center text-2xl font-bold text-white">
                              {user?.firstName?.charAt(0) || 'Y'}
                            </div>
                            <div>
                              <p className="font-semibold text-lg text-gray-900 dark:text-white">Your Status</p>
                              {myStats.isEliminated ? (
                                <p className="text-red-600 text-sm">Eliminated on Day {myStats.eliminatedOnDay}</p>
                              ) : (
                                <p className="text-sky-600 dark:text-sky-400 text-sm">Rank #{myStats.rank} of {survivors.length} survivors</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-6 text-center">
                            <div>
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">{myStats.currentStreak}</p>
                              <p className="text-gray-500 text-xs">Day Streak</p>
                            </div>
                            <div>
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">{myStats.totalPosts}</p>
                              <p className="text-gray-500 text-xs">Total Posts</p>
                            </div>
                            {isAdmin && (
                              <div>
                                <p className="text-2xl font-bold text-green-500">${(myStats.estimatedPayout || 0).toFixed(0)}</p>
                                <p className="text-gray-500 text-xs">Est. Payout</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="border border-gray-200 dark:border-[#2a2a2a] rounded-xl p-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <AnimatedUsers size={18} className="text-gray-700 dark:text-gray-300" /> Survivors ({survivors.length})
                        </h3>
                        <div className="space-y-2 max-h-[480px] overflow-y-auto dark:dark-scrollbar light-scrollbar">
                          {survivors.map((survivor) => {
                            const isYou = survivor.userId === user?.id;
                            const displayName = survivor.name 
                              || survivor.instagramUsername 
                              || survivor.tiktokUsername 
                              || (survivor.email || 'Unknown').split('@')[0];
                            return (
                              <div 
                                key={survivor.id} 
                                className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-200 hover:scale-105 cursor-pointer hover:shadow-[0_0_15px_rgba(147,51,234,0.3)] dark:hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] ${isYou ? 'bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-700' : 'bg-gray-50 dark:bg-[#1a1a1a]/50'}`}
                              >
                                <span className="text-sm font-bold text-gray-500 w-5">#{survivor.rank}</span>
                                <div className={`w-8 h-8 rounded-full ${isYou ? 'bg-sky-500' : 'bg-gray-300 dark:bg-gray-600'} flex items-center justify-center text-sm font-bold text-white`}>
                                  {displayName.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm text-gray-900 dark:text-white">{isYou ? 'You' : displayName}</p>
                                  <p className="text-gray-500 text-xs flex items-center gap-1">
                                    {(survivor.igPosts != null && survivor.igPosts > 0) && (
                                      <span className="inline-flex items-center gap-0.5"><SiInstagram className="w-2.5 h-2.5 text-pink-500" />{survivor.igPosts}</span>
                                    )}
                                    {(survivor.ttPosts != null && survivor.ttPosts > 0) && (
                                      <span className="inline-flex items-center gap-0.5"><SiTiktok className="w-2.5 h-2.5" />{survivor.ttPosts}</span>
                                    )}
                                    {(!survivor.igPosts && !survivor.ttPosts) && <span>{survivor.totalPosts} posts</span>}
                                    <span>• {survivor.currentStreak}d streak</span>
                                  </p>
                                </div>
                                <div className="text-sm flex items-center gap-0.5">
                                  {[...Array(survivorGame.startingLives)].map((_, i) => (
                                    i < survivor.lives 
                                      ? <AnimatedHeart key={i} size={16} /> 
                                      : <AnimatedBlackHeart key={i} size={16} />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="border border-gray-200 dark:border-[#2a2a2a] rounded-xl p-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <AnimatedTombstone size={18} className="text-gray-500" /> Eliminated ({eliminated.length})
                        </h3>
                        <div className="space-y-2 max-h-[480px] overflow-y-auto dark:dark-scrollbar light-scrollbar">
                          {eliminated.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-4">No eliminations yet</p>
                          ) : (
                            eliminated.map((person) => {
                              const displayName = person.name 
                                || person.instagramUsername 
                                || person.tiktokUsername 
                                || (person.email || 'Unknown').split('@')[0];
                              return (
                                <div key={person.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-[#1a1a1a]/50 rounded-lg opacity-60 transition-all duration-200 hover:scale-105 cursor-pointer hover:shadow-[0_0_15px_rgba(147,51,234,0.3)] dark:hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:opacity-80">
                                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                                    <AnimatedSkull size={20} className="text-gray-500" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-medium text-sm text-gray-700 dark:text-gray-300">{displayName}</p>
                                    <p className="text-gray-400 dark:text-gray-500 text-xs">Eliminated Day {person.eliminatedOnDay}</p>
                                  </div>
                                  <p className="text-gray-400 dark:text-gray-500 text-xs flex items-center gap-1">
                                    {(person.igPosts != null && person.igPosts > 0) && (
                                      <span className="inline-flex items-center gap-0.5"><SiInstagram className="w-2.5 h-2.5 text-pink-500" />{person.igPosts}</span>
                                    )}
                                    {(person.ttPosts != null && person.ttPosts > 0) && (
                                      <span className="inline-flex items-center gap-0.5"><SiTiktok className="w-2.5 h-2.5" />{person.ttPosts}</span>
                                    )}
                                    {(!person.igPosts && !person.ttPosts) && <span>{person.totalPosts} posts</span>}
                                  </p>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : showGameCreator && isAdmin ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Game Title</label>
                        <input
                          type="text"
                          value={gameForm.title}
                          onChange={(e) => setGameForm({ ...gameForm, title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prize Pool ($)</label>
                        <input
                          type="number"
                          value={gameForm.prizePool}
                          onChange={(e) => setGameForm({ ...gameForm, prizePool: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                      <input
                        type="text"
                        value={gameForm.description}
                        onChange={(e) => setGameForm({ ...gameForm, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={gameForm.startDate}
                          onChange={(e) => setGameForm({ ...gameForm, startDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                        <input
                          type="date"
                          value={gameForm.endDate}
                          onChange={(e) => setGameForm({ ...gameForm, endDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prize Pool ($)</label>
                        <input
                          type="number"
                          value={gameForm.prizePool}
                          onChange={(e) => setGameForm({ ...gameForm, prizePool: parseInt(e.target.value) || 500 })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Starting Lives</label>
                        <input
                          type="number"
                          value={gameForm.startingLives}
                          onChange={(e) => setGameForm({ ...gameForm, startingLives: parseInt(e.target.value) || 2 })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Posts/Day</label>
                        <input
                          type="number"
                          value={gameForm.minPostsPerDay}
                          onChange={(e) => setGameForm({ ...gameForm, minPostsPerDay: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setShowGameCreator(false)}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateGame}
                        disabled={isCreatingGame}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        {isCreatingGame ? 'Creating...' : 'Start Game'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AnimatedFire size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No active Streak Survivor game</p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                      {isAdmin ? 'Click "New Game" to start a competition!' : 'Check back later for the next competition!'}
                    </p>
                    <button
                      onClick={() => setShowGameHistory(true)}
                      className="mt-3 bg-sky-100 dark:bg-sky-900/30 hover:bg-sky-200 dark:hover:bg-sky-900/50 text-sky-600 dark:text-sky-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      📜 View Previous Games
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>

          <div className="lg:col-span-4 space-y-6">
            
            <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525] p-4 sm:p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Your Stats This Cycle</h3>
              {isAdmin ? (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Not available for admins</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 dark:bg-[#1a1a1a]/50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-gray-300 dark:text-gray-600">N/A</p>
                      <p className="text-xs text-gray-500 mt-1">Total Videos</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#1a1a1a]/50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-gray-300 dark:text-gray-600">N/A</p>
                      <p className="text-xs text-gray-500 mt-1">Views</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#1a1a1a]/50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-gray-300 dark:text-gray-600">N/A</p>
                      <p className="text-xs text-gray-500 mt-1">Earnings</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#1a1a1a]/50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-gray-300 dark:text-gray-600">N/A</p>
                      <p className="text-xs text-gray-500 mt-1">Day Streak</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-[#1a1a1a]/50 rounded-xl p-3 text-center transition-all duration-200 ease-out hover:scale-110 hover:shadow-lg hover:shadow-sky-200 hover:border hover:border-sky-300 cursor-pointer">
                    <p className="text-2xl font-bold text-sky-500">{postingStreakData?.cycleVideos ?? 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Total Videos</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-[#1a1a1a]/50 rounded-xl p-3 text-center transition-all duration-200 ease-out hover:scale-110 hover:shadow-lg hover:shadow-blue-200 hover:border hover:border-blue-300 cursor-pointer">
                    <p className="text-2xl font-bold text-blue-500">
                      {postingStreakData?.cycleViews ? 
                        (postingStreakData.cycleViews >= 1000000 
                          ? `${(postingStreakData.cycleViews / 1000000).toFixed(1)}M`
                          : postingStreakData.cycleViews >= 1000 
                            ? `${(postingStreakData.cycleViews / 1000).toFixed(1)}K`
                            : postingStreakData.cycleViews.toLocaleString())
                        : '0'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Views</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-[#1a1a1a]/50 rounded-xl p-3 text-center transition-all duration-200 ease-out hover:scale-110 hover:shadow-lg hover:shadow-orange-200 hover:border hover:border-orange-300 cursor-pointer">
                    <p className="text-2xl font-bold text-orange-500 flex items-center justify-center gap-1">{postingStreakData?.currentStreak ?? 0} <AnimatedFire size={22} /></p>
                    <p className="text-xs text-gray-500 mt-1">Day Streak</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-[#1a1a1a]/50 rounded-xl p-3 text-center transition-all duration-200 ease-out hover:scale-110 hover:shadow-lg hover:shadow-green-200 hover:border hover:border-green-300 cursor-pointer">
                    <p className="text-2xl font-bold text-green-500">${postingStreakData?.cycleEarnings?.toFixed(0) ?? 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Earnings</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  {isAdmin ? <><AnimatedCalendar size={18} className="text-sky-500" /> All Creators Videos Calendar</> : <><AnimatedFire size={18} /> Your Posting Streak</>}
                </h3>
                <span className="text-sm font-medium text-orange-500">{postingStreakData?.currentStreak || 0} days</span>
              </div>
              <StreakCalendar />
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#252525]">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">This week</span>
                  <span className="font-medium text-gray-900 dark:text-white">{postingStreakData?.thisWeek || "0 / 7 days"}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-500 dark:text-gray-400">Total posts (28d)</span>
                  <span className="font-medium text-gray-900 dark:text-white">{postingStreakData?.totalPosts28d || 0} posts</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525]">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-[#252525]">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><AnimatedCelebration size={20} /> Celebrations</h3>
              </div>
              <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto dark-scrollbar">
                {celebrations.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
                    <p>No celebrations yet</p>
                    <p className="text-xs mt-1">Sync creators to detect achievements</p>
                  </div>
                ) : (
                  (showAllCelebrations ? celebrations : celebrations.slice(0, 4)).map((item) => (
                    <div key={item.id} className="group flex items-start gap-3 p-3 bg-gray-50 dark:bg-[#1a1a1a]/50 rounded-xl border border-gray-100 dark:border-[#2a2a2a] hover:border-sky-300 dark:hover:border-sky-500 hover:shadow-lg hover:shadow-sky-100 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                      <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-pink-500 rounded-full flex items-center justify-center">
                        <EmojiToAnimatedIcon emoji={item.emoji || '🎉'} size={18} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-medium text-gray-900 dark:text-white">{item.creator}</span>
                          <span className="text-gray-400 dark:text-gray-500"> — </span>
                          <span>{item.achievement}</span>
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{item.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {celebrations.length > 4 && (
                <div className="px-5 py-3 border-t border-gray-100 dark:border-[#252525] text-center">
                  <button 
                    onClick={() => setShowAllCelebrations(!showAllCelebrations)}
                    className="text-sky-500 hover:text-sky-600 dark:hover:text-sky-400 text-sm font-medium"
                  >
                    {showAllCelebrations ? "Show less" : `View all ${celebrations.length} notifications →`}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Leaderboard: Top Videos & Top Accounts */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Videos */}
          <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Top Videos</h3>
              <div className="flex items-center gap-2">
                <Select value={leaderboardVideoSort} onValueChange={setLeaderboardVideoSort}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="views">Views</SelectItem>
                    <SelectItem value="likes">Likes</SelectItem>
                    <SelectItem value="comments">Comments</SelectItem>
                    <SelectItem value="engagementRate">Engagement Rate</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={String(leaderboardVideoLimit)} onValueChange={(v) => setLeaderboardVideoLimit(Number(v))}>
                  <SelectTrigger className="w-[60px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              {leaderboardVideos.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No eligible videos found</p>
              ) : (
                leaderboardVideos.map((video, index) => (
                  <div key={video.id} className="flex items-start gap-3">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 mt-3 w-4 text-right">{index + 1}</span>
                    <button
                      className="relative w-12 h-16 rounded-md overflow-hidden bg-gray-100 dark:bg-[#1a1a1a] cursor-pointer flex-shrink-0 group/thumb"
                      onClick={() => {
                        if (video.platformVideoId) {
                          setPlayingPostId(video.id);
                        } else if (video.url) {
                          window.open(video.url, '_blank');
                        }
                      }}
                    >
                      {video.thumbnail ? (
                        <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center animate-[breathe_2s_ease-in-out_infinite] group-hover/thumb:scale-110 transition-transform">
                          <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[7px] border-l-white border-b-[4px] border-b-transparent ml-0.5" />
                        </div>
                      </div>
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate block">@{video.username}</span>
                      {video.creatorEmail && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{video.creatorEmail}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {video.platform === "instagram" && (
                          <a href={`https://instagram.com/${video.username}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Instagram_logo_2016.svg/132px-Instagram_logo_2016.svg.png" alt="Instagram" className="w-3.5 h-3.5" />
                            <span className="text-[10px]" style={{ color: '#E1306C' }}>Instagram</span>
                          </a>
                        )}
                        {video.platform === "tiktok" && (
                          <a href={`https://tiktok.com/@${video.username}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                            <img src="https://sf-tb-sg.ibytedtos.com/obj/eden-sg/uhtyvueh7nulogpoguhm/tiktok-icon2.png" alt="TikTok" className="w-3.5 h-3.5" />
                            <span className="text-[10px]" style={{ color: '#69C9D0' }}>TikTok</span>
                          </a>
                        )}
                        {video.platform === "youtube" && (
                          <a href={video.url || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/120px-YouTube_full-color_icon_%282017%29.svg.png" alt="YouTube" className="w-4 h-3" />
                            <span className="text-[10px]" style={{ color: '#FF0000' }}>YouTube</span>
                          </a>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{truncateCaption(video.caption, 8)}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xs font-semibold text-gray-900 dark:text-white">{formatStatNumber(video.views)}</div>
                      <div className="text-[10px] text-gray-400">views</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{formatStatNumber(video.likes)} likes</div>
                      {leaderboardVideoSort === "engagementRate" && (
                        <div className="text-[10px] text-blue-500 font-medium mt-0.5">{video.engagementRate?.toFixed(1)}% ER</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Accounts */}
          <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Top Accounts</h3>
              <div className="flex items-center gap-2">
                <Select value={leaderboardAccountSort} onValueChange={setLeaderboardAccountSort}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="views">Total Views</SelectItem>
                    <SelectItem value="avgViews">Avg Views</SelectItem>
                    <SelectItem value="likes">Total Likes</SelectItem>
                    <SelectItem value="avgLikes">Avg Likes</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={String(leaderboardAccountLimit)} onValueChange={(v) => setLeaderboardAccountLimit(Number(v))}>
                  <SelectTrigger className="w-[60px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              {leaderboardAccounts.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No accounts found</p>
              ) : (
                leaderboardAccounts.map((account, index) => (
                  <div key={account.id} className="flex items-start gap-3">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 mt-2 w-4 text-right">{index + 1}</span>
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 dark:bg-[#1a1a1a] flex-shrink-0 mt-1">
                      {account.avatar ? (
                        <img src={account.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                          {account.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate block">{account.name || account.handle}</span>
                      {account.email && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{account.email}</p>
                      )}
                      <div className="flex items-center gap-3 mt-0.5">
                        {account.instagramUsername && (
                          <a href={`https://instagram.com/${account.instagramUsername}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Instagram_logo_2016.svg/132px-Instagram_logo_2016.svg.png" alt="Instagram" className="w-3.5 h-3.5" />
                            <span className="text-[10px]" style={{ color: '#E1306C' }}>@{account.instagramUsername}</span>
                          </a>
                        )}
                        {account.tiktokUsername && (
                          <a href={`https://tiktok.com/@${account.tiktokUsername}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                            <img src="https://sf-tb-sg.ibytedtos.com/obj/eden-sg/uhtyvueh7nulogpoguhm/tiktok-icon2.png" alt="TikTok" className="w-3.5 h-3.5" />
                            <span className="text-[10px]" style={{ color: '#69C9D0' }}>@{account.tiktokUsername}</span>
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xs font-semibold text-gray-900 dark:text-white">{formatStatNumber(account.views)}</div>
                      <div className="text-[10px] text-gray-400">views</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{formatStatNumber(account.likes)} likes</div>
                      <div className="text-[10px] text-gray-400">{account.videoCount} videos</div>
                      {leaderboardAccountSort === "avgViews" && (
                        <div className="text-[10px] text-blue-500 font-medium">{formatStatNumber(account.avgViews)} avg</div>
                      )}
                      {leaderboardAccountSort === "avgLikes" && (
                        <div className="text-[10px] text-blue-500 font-medium">{formatStatNumber(account.avgLikes)} avg</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="mt-6 flex items-center justify-end">
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

        {/* Side by Side Charts */}
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Views Bar Chart */}
          <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525]">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-[#252525]">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-sky-500" />
                <h2 className="font-bold text-lg text-gray-900 dark:text-white">Team Views</h2>
              </div>
            </div>
            <div className="p-4">
              {dailyViewsData?.dataPoints && dailyViewsData.dataPoints.length > 0 ? (
                <div 
                  ref={(el) => { graphContainerRef.current = el; viewsChartRef.current = el; }}
                  className="relative w-full"
                  onMouseMove={(e) => {
                    if (graphContainerRef.current) {
                      const rect = graphContainerRef.current.getBoundingClientRect();
                      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                    }
                  }}
                  onMouseLeave={() => setCursorPos(null)}
                >
                  <svg viewBox="0 0 500 300" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgb(168, 85, 247)" />
                        <stop offset="100%" stopColor="rgb(126, 34, 206)" />
                      </linearGradient>
                    </defs>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <line key={i} x1="50" y1={40 + i * 50} x2="480" y2={40 + i * 50} stroke="currentColor" strokeOpacity="0.08" className="text-gray-300 dark:text-gray-700" />
                    ))}
                    {(() => {
                      const maxViews = Math.max(...dailyViewsData.dataPoints.map(d => d.views), 1);
                      return [0, 1, 2, 3, 4].map((i) => {
                        const value = maxViews - (maxViews / 4) * i;
                        const formatValue = (v: number) => {
                          if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                          if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                          return v.toFixed(0);
                        };
                        return (
                          <text key={i} x="40" y={44 + i * 50} textAnchor="end" className="text-[10px] fill-gray-400 dark:fill-gray-500">
                            {formatValue(value)}
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
                        const isHovered = hoveredDate === d.date;
                        const cornerRadius = Math.min(barWidth / 2, 6);
                        
                        return (
                          <g key={d.date}>
                            <path
                              d={`M${x},${240} L${x},${y + cornerRadius} Q${x},${y} ${x + cornerRadius},${y} L${x + barWidth - cornerRadius},${y} Q${x + barWidth},${y} ${x + barWidth},${y + cornerRadius} L${x + barWidth},${240} Z`}
                              fill="url(#barGradient)"
                              className={`cursor-pointer transition-all duration-300 ${isHovered ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
                              style={{ 
                                filter: isHovered ? 'brightness(1.2) drop-shadow(0 0 6px rgba(168, 85, 247, 0.6))' : 'none',
                              }}
                              onMouseEnter={() => handleDotHover(d.date)}
                              onMouseLeave={handleDotLeave}
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
                        <text key={d.date} x={x} y="268" textAnchor="middle" className="text-[9px] fill-gray-400 dark:fill-gray-500">
                          {formatUTCDate(d.date, "MMM d")}
                        </text>
                      );
                    })}
                  </svg>
                  
                  {/* Interactive overlay for hover panels */}
                  {hoveredDate && !playingPostId && !selectedVideoForComments && !captionPostId && (() => {
                    const totalPoints = dailyViewsData.dataPoints.length;
                    const hoveredIndex = dailyViewsData.dataPoints.findIndex(d => d.date === hoveredDate);
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
                        onMouseEnter={handlePanelEnter}
                        onMouseLeave={handleDotLeave}
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
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setHoverSortMode('views'); }}
                                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                                      hoverSortMode === 'views' ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-[#252525]' : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                  >
                                    Most Views
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setHoverSortMode('likes'); }}
                                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                                      hoverSortMode === 'likes' ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-[#252525]' : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                  >
                                    Most Liked
                                  </button>
                                </div>
                                <div className="max-h-[320px] overflow-y-auto">
                                  {isLoadingVideos ? (
                                    <div className="flex items-center justify-center py-6">
                                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                    </div>
                                  ) : sortedHoveredVideos.length > 0 ? (
                                    <div className="divide-y divide-gray-100 dark:divide-[#333]">
                                      {sortedHoveredVideos.map((video) => (
                                        <button key={video.id} onClick={() => { if (video.platformVideoId) { setPlayingHoverVideo(video); setPlayingPostId(video.id); } else if (video.url) { window.open(video.url, '_blank'); } }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors w-full text-left">
                                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
                                            {video.thumbnailUrl ? (
                                              <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                              <div className="w-full h-full flex items-center justify-center">
                                                <Play className="w-4 h-4 text-gray-400" />
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                              {video.platform === 'instagram' ? (
                                                <InstagramIcon className="w-3 h-3 text-pink-400" />
                                              ) : (
                                                <TikTokIcon className="w-3 h-3 text-gray-900 dark:text-white" />
                                              )}
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
                <div className="text-center py-12 text-gray-400">
                  <Eye className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No view data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Engagement Rate Line Graph */}
          <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525]">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-[#252525]">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-sky-500" />
                <h2 className="font-bold text-lg text-gray-900 dark:text-white">Team Engagement Rate</h2>
              </div>
            </div>
            <div className="p-4">
              {dailyViewsData?.dataPoints && dailyViewsData.dataPoints.length > 0 ? (
                <div className="relative w-full" ref={engagementChartRef}>
                  <svg viewBox="0 0 500 300" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <linearGradient id="engagementGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <line key={i} x1="50" y1={40 + i * 50} x2="480" y2={40 + i * 50} stroke="currentColor" strokeOpacity="0.08" className="text-gray-300 dark:text-gray-700" />
                    ))}
                    {(() => {
                      const maxEngagement = Math.max(...dailyViewsData.dataPoints.map(d => d.engagementRate), 1);
                      const roundedMax = Math.ceil(maxEngagement);
                      return [0, 1, 2, 3, 4].map((i) => {
                        const value = roundedMax - (roundedMax / 4) * i;
                        return (
                          <text key={i} x="40" y={44 + i * 50} textAnchor="end" className="text-[10px] fill-gray-400 dark:fill-gray-500">
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
                          <path d={areaPath} fill="url(#engagementGradient)" />
                          <polyline points={points.join(' ')} fill="none" stroke="rgb(16, 185, 129)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          {dailyViewsData.dataPoints.map((d, i) => {
                            const x = 50 + (i / (dailyViewsData.dataPoints.length - 1 || 1)) * 430;
                            const y = 240 - (d.engagementRate / maxEngagement) * 200;
                            const isHovered = engHoveredDate === d.date;
                            
                            return (
                              <g key={i}>
                                <circle cx={x} cy={y} r="10" fill="transparent" className="cursor-pointer"
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
                        <text key={d.date} x={x} y="268" textAnchor="middle" className="text-[9px] fill-gray-400 dark:fill-gray-500">
                          {formatUTCDate(d.date, "MMM d")}
                        </text>
                      );
                    })}
                  </svg>
                  
                  {engHoveredDate && !playingPostId && !selectedVideoForComments && !captionPostId && (() => {
                    const totalPoints = dailyViewsData.dataPoints.length;
                    const hoveredIndex = dailyViewsData.dataPoints.findIndex(d => d.date === engHoveredDate);
                    if (hoveredIndex === -1) return null;
                    const d = dailyViewsData.dataPoints[hoveredIndex];
                    const isRightSide = hoveredIndex > totalPoints / 2;
                    
                    const x = 50 + (hoveredIndex / (totalPoints - 1 || 1)) * 430;
                    
                    const containerEl = engagementChartRef.current;
                    if (!containerEl) return null;
                    const svgEl = containerEl.querySelector('svg');
                    if (!svgEl) return null;
                    const svgRect = svgEl.getBoundingClientRect();
                    const containerRect = containerEl.getBoundingClientRect();
                    const scaleX = svgRect.width / 500;
                    const pixelX = svgRect.left - containerRect.left + x * scaleX;
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
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEngHoverSortMode('views'); }}
                                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                                      engHoverSortMode === 'views' ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-[#252525]' : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                  >
                                    Most Views
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEngHoverSortMode('likes'); }}
                                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                                      engHoverSortMode === 'likes' ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-[#252525]' : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                  >
                                    Most Liked
                                  </button>
                                </div>
                                <div className="max-h-[320px] overflow-y-auto">
                                  {engIsLoadingVideos ? (
                                    <div className="flex items-center justify-center py-6">
                                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                    </div>
                                  ) : sortedEngHoveredVideos.length > 0 ? (
                                    <div className="divide-y divide-gray-100 dark:divide-[#333]">
                                      {sortedEngHoveredVideos.map((video) => (
                                        <button key={video.id} onClick={() => { if (video.platformVideoId) { setPlayingHoverVideo(video); setPlayingPostId(video.id); } else if (video.url) { window.open(video.url, '_blank'); } }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors w-full text-left">
                                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
                                            {video.thumbnailUrl ? (
                                              <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                              <div className="w-full h-full flex items-center justify-center">
                                                <Play className="w-4 h-4 text-gray-400" />
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                              {video.platform === 'instagram' ? (
                                                <InstagramIcon className="w-3 h-3 text-pink-400" />
                                              ) : (
                                                <TikTokIcon className="w-3 h-3 text-gray-900 dark:text-white" />
                                              )}
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
                <div className="text-center py-12 text-gray-400">
                  <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No engagement data available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    All Creators
                  </CardTitle>
                  <CardDescription>
                    {creatorsApiData?.length || 0} creators registered
                  </CardDescription>
                </div>
                <div className="flex items-center bg-gray-100 dark:bg-[#1a1a1a] rounded-lg p-1">
                  <button
                    onClick={() => setCycleView('current')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      cycleView === 'current'
                        ? 'bg-white dark:bg-[#2a2a2a] text-sky-600 dark:text-sky-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Current Cycle
                  </button>
                  <button
                    onClick={() => setCycleView('all')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      cycleView === 'all'
                        ? 'bg-white dark:bg-[#2a2a2a] text-sky-600 dark:text-sky-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    All Time
                  </button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
                  <SelectTrigger className="w-full sm:w-36">
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
                  <SelectTrigger className="w-full sm:w-44">
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    {isAdmin && <SelectItem value="highest_paid">Highest Paid</SelectItem>}
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
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!filteredCreatorsList || filteredCreatorsList.length === 0 ? (
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
                      <TableHead>NAME</TableHead>
                      <TableHead className="text-center">STATUS</TableHead>
                      <TableHead className="text-center">INSTAGRAM</TableHead>
                      <TableHead className="text-center">TIKTOK</TableHead>
                      <TableHead className="text-center">{cycleView === 'all' ? 'ELIGIBLE VIDEOS' : 'VIDEOS THIS CYCLE'}</TableHead>
                      <TableHead className="text-center">{cycleView === 'all' ? 'ELIGIBLE VIEWS' : 'VIEWS THIS CYCLE'}</TableHead>
                      {isAdmin && <TableHead className="text-center">{cycleView === 'all' ? 'TOTAL PAID' : 'EARNINGS THIS CYCLE'}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCreators.map((creator) => {
                      const displayName = (creator.firstName || creator.lastName) 
                        ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim()
                        : (creator.instagramUsername || creator.tiktokUsername || creator.email.split('@')[0]);
                      const initial = (displayName?.charAt(0) || 'U').toUpperCase();
                      
                      return (
                        <TableRow 
                          key={creator.id} 
                          className="cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:shadow-lg hover:shadow-sky-100 dark:hover:shadow-sky-900/30 hover:-translate-y-0.5 transition-all duration-200"
                          onClick={() => {
                            const filterParams = new URLSearchParams();
                            filterParams.set("from", "creator-hub");
                            if (statusFilter !== "active") filterParams.set("status", statusFilter);
                            if (sortBy !== "newest") filterParams.set("sort", sortBy);
                            if (searchTerm) filterParams.set("search", searchTerm);
                            const base = isAdmin ? `/admin/creators/${creator.id}` : `/creator/creators/${creator.id}`;
                            navigate(`${base}?${filterParams.toString()}`);
                          }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold text-sm">
                                {initial}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{displayName}</p>
                                <p className="text-sm text-muted-foreground">{creator.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {creator.status === 'deleted' || creator.isDeleted ? (
                              <Badge variant="secondary" className="bg-red-500/20 text-red-600 dark:text-red-400">
                                Deleted
                              </Badge>
                            ) : creator.status === 'paused' || creator.isPaused ? (
                              <Badge variant="secondary" className="bg-orange-500/20 text-orange-600 dark:text-orange-400">
                                Paused
                              </Badge>
                            ) : creator.status === 'trial' ? (
                              <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                                Trial
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-green-500/20 text-green-600 dark:text-green-400">
                                Active
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {creator.instagramUsername ? (
                              <div className="flex items-center justify-center">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 via-pink-500 to-orange-400 flex items-center justify-center">
                                  <SiInstagram className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                  <SiInstagram className="w-4 h-4 text-muted-foreground" />
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {creator.tiktokUsername ? (
                              <div className="flex items-center justify-center">
                                <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
                                  <SiTiktok className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                  <SiTiktok className="w-4 h-4 text-muted-foreground" />
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {cycleView === 'all' ? creator.eligibleVideos : creator.videosThisCycle}
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {formatNumber(cycleView === 'all' ? creator.eligibleViews : creator.viewsThisCycle)}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-center font-medium">
                              ${cycleView === 'all' 
                                ? (creator.totalPaid || 0).toFixed(2)
                                : (creator.earningsThisCycle || 0).toFixed(2)}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </main>

      {/* Comments Panel Modal */}
      {selectedVideoForComments && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setSelectedVideoForComments(null)}>
          <div 
            className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#2a2a2a]">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Comments</h3>
                <p className="text-xs text-gray-500 truncate max-w-[250px]">{truncateCaption(selectedVideoForComments.caption, 8)}</p>
              </div>
              <button 
                onClick={() => setSelectedVideoForComments(null)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[400px]">
              {isLoadingComments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No comments yet</p>
                  <p className="text-xs mt-1">Be the first to comment!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 dark:bg-[#252525] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 bg-gradient-to-br from-sky-500 to-pink-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-[10px] font-medium">
                          {comment.userName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-gray-900 dark:text-white">{comment.userName}</span>
                      <span className="text-[10px] text-gray-400">
                        {formatUTCDate(comment.createdAt, "MMM d")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 pl-8">{comment.content}</p>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-gray-200 dark:border-[#2a2a2a] p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                  placeholder="Write a comment..."
                  className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-[#252525] border border-gray-200 dark:border-[#3a3a3a] rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400"
                />
                <button
                  onClick={handlePostComment}
                  disabled={isPostingComment || !newComment.trim()}
                  className="p-2 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  {isPostingComment ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {captionPostId && (() => {
        const video = allTodayTopPosts.find(v => v.id === captionPostId);
        if (!video) return null;
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80" onClick={() => setCaptionPostId(null)}>
            <div className="relative bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl max-w-sm w-full mx-4 p-5" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setCaptionPostId(null)}
                className="absolute top-3 right-3 w-6 h-6 bg-gray-100 dark:bg-[#252525] hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full flex items-center justify-center text-gray-500 hover:text-red-500 text-xs transition-colors"
              >
                ✕
              </button>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                  video.platform === 'instagram' ? 'bg-gradient-to-br from-sky-500 to-pink-500' : 'bg-black'
                }`}>
                  {video.platform === 'instagram' ? <InstagramIcon className="w-2.5 h-2.5 text-white" /> : <TikTokIcon className="w-2.5 h-2.5 text-white" />}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">@{video.username}</span>
              </div>
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words leading-relaxed">{video.caption}</p>
            </div>
          </div>
        );
      })()}

      {playingPostId && (() => {
        const topVideo = allTodayTopPosts.find(v => v.id === playingPostId) || leaderboardVideos.find(v => v.id === playingPostId);
        const video = topVideo || playingHoverVideo;
        if (!video) return null;
        const pVideoId = topVideo ? topVideo.platformVideoId : (playingHoverVideo ? playingHoverVideo.platformVideoId : null);
        if (!pVideoId) return null;
        const thumbUrl = topVideo ? (topVideo.thumbnail || undefined) : (playingHoverVideo ? (playingHoverVideo.thumbnailUrl || undefined) : undefined);
        const closePlayer = () => { setPlayingPostId(null); setPlayingHoverVideo(null); };
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80" onClick={closePlayer}>
            <div className="relative w-[260px] h-[462px] rounded-2xl overflow-hidden bg-black shadow-2xl" onClick={e => e.stopPropagation()}>
              <VideoEmbed
                platform={video.platform}
                platformVideoId={pVideoId}
                username={video.username || undefined}
                videoFileUrl={video.videoFileUrl || undefined}
                thumbnailUrl={thumbUrl}
                small
              />
              <button
                onClick={closePlayer}
                className="absolute top-2 right-2 w-7 h-7 bg-black/70 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-sm transition-colors z-10"
              >
                ✕
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                <p className="text-white text-xs font-medium truncate">{video.caption}</p>
                <p className="text-white/60 text-[10px] mt-0.5">@{video.username}</p>
              </div>
            </div>
          </div>
        );
      })()}

      <Dialog open={showDeleteGameConfirm} onOpenChange={setShowDeleteGameConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Streak Survivor Game</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this game? All creators who participated and their payouts will be deleted. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteGameConfirm(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGame}
              disabled={isDeletingGame}
            >
              {isDeletingGame ? "Deleting..." : "Delete Game"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditGame} onOpenChange={setShowEditGame}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Streak Survivor Game</DialogTitle>
            <DialogDescription>Update the game settings</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
              <input
                type="text"
                value={editGameForm.title}
                onChange={(e) => setEditGameForm({ ...editGameForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <input
                type="text"
                value={editGameForm.description}
                onChange={(e) => setEditGameForm({ ...editGameForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prize Pool ($)</label>
                <input
                  type="number"
                  value={editGameForm.prizePool}
                  onChange={(e) => setEditGameForm({ ...editGameForm, prizePool: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                <input
                  type="date"
                  value={editGameForm.endDate}
                  onChange={(e) => setEditGameForm({ ...editGameForm, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Starting Lives</label>
                <input
                  type="number"
                  value={editGameForm.startingLives}
                  onChange={(e) => setEditGameForm({ ...editGameForm, startingLives: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Posts/Day</label>
                <input
                  type="number"
                  value={editGameForm.minPostsPerDay}
                  onChange={(e) => setEditGameForm({ ...editGameForm, minPostsPerDay: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <button
              onClick={() => setShowEditGame(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEditGame}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors"
            >
              Save Changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGameHistory} onOpenChange={setShowGameHistory}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📜 Previous Streak Survivor Games</DialogTitle>
            <DialogDescription>History of completed games and their results</DialogDescription>
          </DialogHeader>
          
          {!gameHistory || gameHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No completed games yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {gameHistory.map((game: any) => (
                <div key={game.id} className="border border-gray-200 dark:border-[#2a2a2a] rounded-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-sky-600 to-sky-700 px-4 py-3 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold">{game.title}</h3>
                        <p className="text-sky-200 text-sm">
                          {game.startDate && game.endDate ? (
                            <>{formatUTCDate(game.startDate, "MMM d")} - {formatUTCDate(game.endDate, "MMM d, yyyy")}</>
                          ) : 'Dates not set'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">${parseFloat(game.prizePool || '0').toFixed(0)}</p>
                        <p className="text-sky-200 text-xs">Prize Pool</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center p-2 bg-gray-50 dark:bg-[#1a1a1a] rounded-lg">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{game.totalParticipants}</p>
                        <p className="text-xs text-gray-500">Total Players</p>
                      </div>
                      <div className="text-center p-2 bg-sky-50 dark:bg-sky-900/20 rounded-lg">
                        <p className="text-lg font-bold text-sky-600">{game.survivorCount}</p>
                        <p className="text-xs text-gray-500">Survivors</p>
                      </div>
                      <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-lg font-bold text-red-500">{game.eliminatedCount}</p>
                        <p className="text-xs text-gray-500">Eliminated</p>
                      </div>
                    </div>
                    
                    {isAdmin && game.participants && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">All Participants</h4>
                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                          {game.participants
                            .sort((a: any, b: any) => (b.totalPosts || 0) - (a.totalPosts || 0))
                            .map((p: any) => (
                              <div key={p.id} className={`flex items-center gap-3 p-2 rounded-lg text-sm ${p.isEliminated ? 'bg-gray-50 dark:bg-[#1a1a1a]/50 opacity-60' : 'bg-sky-50 dark:bg-sky-900/10'}`}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${p.isEliminated ? 'bg-gray-400' : 'bg-sky-500'}`}>
                                  {(p.name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900 dark:text-white text-sm">{p.name} {p.email && <span className="text-gray-400 font-normal text-xs">({p.email})</span>}</p>
                                  <p className="text-gray-500 text-xs">
                                    {p.totalPosts || 0} posts • {p.currentStreak || 0}d streak • Best: {p.longestStreak || 0}d
                                    {p.isEliminated && ` • Eliminated Day ${p.eliminatedOnDay}`}
                                  </p>
                                </div>
                                <div className="text-right">
                                  {!p.isEliminated && p.projectedPayout > 0 && (
                                    <p className="text-sky-600 font-mono text-sm font-bold">${p.projectedPayout.toFixed(2)}</p>
                                  )}
                                  {!p.isEliminated && p.sharePercent > 0 && (
                                    <p className="text-gray-400 text-xs">{p.sharePercent.toFixed(1)}%</p>
                                  )}
                                  {p.isEliminated && <span className="text-gray-400 text-xs">☠️</span>}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                    
                    {!isAdmin && game.myStats && (
                      <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg p-3">
                        <h4 className="text-sm font-semibold text-sky-700 dark:text-sky-300 mb-2">Your Results</h4>
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{game.myStats.totalPosts || 0}</p>
                            <p className="text-xs text-gray-500">Posts</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{game.myStats.longestStreak || 0}d</p>
                            <p className="text-xs text-gray-500">Best Streak</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{game.myStats.isSurvivor ? '✅' : '☠️'}</p>
                            <p className="text-xs text-gray-500">{game.myStats.isSurvivor ? 'Survived' : `Eliminated D${game.myStats.eliminatedOnDay}`}</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-sky-600">${(game.myStats.projectedPayout || 0).toFixed(2)}</p>
                            <p className="text-xs text-gray-500">Payout</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {!isAdmin && !game.myStats && (
                      <p className="text-center text-sm text-gray-400 py-2">You didn't participate in this game</p>
                    )}

                    {!isAdmin && game.survivors && game.survivors.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Survivors</h4>
                        <div className="space-y-1">
                          {game.survivors.map((s: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-sm p-1.5 bg-gray-50 dark:bg-[#1a1a1a]/50 rounded">
                              <span className="text-sky-500">🏆</span>
                              <span className="font-medium text-gray-900 dark:text-white">{s.name}</span>
                              {s.email && <span className="text-gray-400 text-xs">({s.email})</span>}
                              <span className="text-gray-400 text-xs ml-auto">{s.totalPosts} posts • {s.longestStreak}d best streak</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatorHub;
