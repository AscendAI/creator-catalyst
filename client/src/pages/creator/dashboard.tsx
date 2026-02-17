import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useRefresh } from "@/lib/refresh";
import { RefreshProgressBar } from "@/components/refresh-progress-bar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Gem } from "lucide-react";
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
  Video, 
  Eye, 
  Heart, 
  MessageCircle, 
  CheckCircle,
  DollarSign,
  AlertTriangle,
  Zap,
  Loader2,
  Wallet,
  RefreshCw,
  ChevronDown,
  History,
  Calendar,
  Ban,
  ExternalLink,
  Clock,
  TrendingUp,
  ImageIcon,
  Users,
  Info,
  Play,
  ChevronRight,
  Flame,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { SiTiktok, SiInstagram } from "react-icons/si";
import { VideoEmbed } from "@/components/video-embed";
import { format, formatDistanceToNow } from "date-fns";
import { formatUTCDate } from "@/lib/date-utils";
import type { Video as VideoType, Violation, Payout, Cycle } from "@shared/schema";

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

type VideoWithCycleInfo = VideoType & {
  basePayPerVideo: number;
  bonusAmount: number;
  isEligible?: boolean;
  timestamp?: Date | string | null;
  cycleId?: number | null;
  thumbnailHash?: string | null;
};

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

interface CreatorData {
  id: number;
  email: string;
  instagramUsername?: string | null;
  tiktokUsername?: string | null;
  instagramFollowers?: number | null;
  tiktokFollowers?: number | null;
  createdAt?: string | null;
  paypalEmail?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  instagramLastSyncAt?: string | null;
  tiktokLastSyncAt?: string | null;
}

interface CreatorDetailData {
  creator: CreatorData;
  videos: VideoWithCycleInfo[];
  violations: Violation[];
  payouts: (Payout & { cycle: { startDate: string; endDate: string } | null })[];
  activeCycle: Cycle | null;
  allTimeStats?: AllTimeStats;
}

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

const DashboardInstagramIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const DashboardTikTokIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

export default function CreatorDashboard() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [pastOpen, setPastOpen] = useState(false);
  const [preCycleOpen, setPreCycleOpen] = useState(false);
  type FilterPreset = "latest" | "views" | "payment";
  const [currentCycleFilter, setCurrentCycleFilter] = useState<FilterPreset>("latest");
  const [pastCycleFilter, setPastCycleFilter] = useState<FilterPreset>("latest");
  const [overviewMode, setOverviewMode] = useState<"cycle" | "allTime">("cycle");
  const [captionDialogOpen, setCaptionDialogOpen] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState<string>("");
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [playingHoverVideo, setPlayingHoverVideo] = useState<VideoByDate | null>(null);
  const [viewsDayRange, setViewsDayRange] = useState<7 | 14 | 30 | 'all'>(7);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [hoveredDateVideos, setHoveredDateVideos] = useState<VideoByDate[]>([]);
  const [hoverSortMode, setHoverSortMode] = useState<'views' | 'likes'>('views');
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoCacheRef = useRef<Record<string, VideoByDate[]>>({});
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const viewsChartRef = useRef<HTMLDivElement | null>(null);
  const engagementChartRef = useRef<HTMLDivElement | null>(null);
  const [engHoveredDate, setEngHoveredDate] = useState<string | null>(null);
  const [engHoveredDateVideos, setEngHoveredDateVideos] = useState<VideoByDate[]>([]);
  const [engHoverSortMode, setEngHoverSortMode] = useState<'views' | 'likes'>('views');
  const [engIsLoadingVideos, setEngIsLoadingVideos] = useState(false);
  const engHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const engVideoCacheRef = useRef<Record<string, VideoByDate[]>>({});
  
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
  
  const getStoredRefreshChanges = (): RefreshChanges | null => {
    try {
      const stored = localStorage.getItem(`creatorRefreshChanges`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };
  
  const [refreshChanges, setRefreshChanges] = useState<RefreshChanges | null>(null);
  const [, setTick] = useState(0);
  
  const { isRefreshing, startRefresh } = useRefresh();

  interface RefreshStatus {
    refreshesUsed: number;
    refreshesRemaining: number;
    maxRefreshesPerDay: number;
    canRefresh: boolean;
    lastRefreshedAt: string | null;
    nextResetAt: string | null;
  }

  const { data: refreshStatus } = useQuery<RefreshStatus>({
    queryKey: ["/api/creator/refresh-status"],
    enabled: !!token,
  });

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    const stored = getStoredRefreshChanges();
    setRefreshChanges(stored);
  }, []);
  
  useEffect(() => {
    if (refreshChanges) {
      localStorage.setItem(`creatorRefreshChanges`, JSON.stringify(refreshChanges));
    }
  }, [refreshChanges]);
  
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
    queryKey: ["/api/creator/detail"],
    enabled: !!token,
  });

  const prevIsRefreshing = useRef(false);
  useEffect(() => {
    if (prevIsRefreshing.current && !isRefreshing) {
      if (!preRefreshSnapshot) {
        prevIsRefreshing.current = isRefreshing;
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/creator/detail"] }).then(() => {
        return queryClient.fetchQuery<CreatorDetailData>({
          queryKey: ["/api/creator/detail"],
          staleTime: 0,
        });
      }).then((freshData) => {
        if (freshData && preRefreshSnapshot) {
          const { creator: freshCreator, videos: freshVideos } = freshData;
          const activeCycle = freshData.activeCycle;
          const freshCurrentCycleVideos = freshVideos.filter(v => 
            activeCycle && v.cycleId === activeCycle.id && !v.isIrrelevant
          );
          const freshIgVideos = freshCurrentCycleVideos.filter(v => v.platform === "instagram");
          const freshTtVideos = freshCurrentCycleVideos.filter(v => v.platform === "tiktok");
          const changes: RefreshChanges = {
            videos: freshCurrentCycleVideos.length - preRefreshSnapshot.videos,
            igVideos: freshIgVideos.length - preRefreshSnapshot.igVideos,
            ttVideos: freshTtVideos.length - preRefreshSnapshot.ttVideos,
            views: freshCurrentCycleVideos.reduce((sum, v) => sum + (v.views || 0), 0) - preRefreshSnapshot.views,
            igViews: freshIgVideos.reduce((sum, v) => sum + (v.views || 0), 0) - preRefreshSnapshot.igViews,
            ttViews: freshTtVideos.reduce((sum, v) => sum + (v.views || 0), 0) - preRefreshSnapshot.ttViews,
            earnings: 0,
            basePay: 0,
            bonus: 0,
            following: ((freshCreator.instagramFollowers || 0) + (freshCreator.tiktokFollowers || 0)) - preRefreshSnapshot.following,
            igFollowers: (freshCreator.instagramFollowers || 0) - preRefreshSnapshot.igFollowers,
            ttFollowers: (freshCreator.tiktokFollowers || 0) - preRefreshSnapshot.ttFollowers,
          };
          setRefreshChanges(changes);
        }
        setPreRefreshSnapshot(null);
      }).catch(() => {
        setPreRefreshSnapshot(null);
      });
    }
    prevIsRefreshing.current = isRefreshing;
  }, [isRefreshing]);

  const toggleIrrelevantMutation = useMutation({
    mutationFn: async ({ videoId, isIrrelevant }: { videoId: string; isIrrelevant: boolean }) => {
      return await apiRequest("PUT", `/api/creator/videos/${videoId}/irrelevant`, { isIrrelevant });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creator/detail"] });
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

  interface PairedVideoRow {
    id: string;
    date: Date;
    caption: string;
    ig: VideoWithCycleInfo | null;
    tiktok: VideoWithCycleInfo | null;
    matchType?: "duration" | "thumbnail" | "none";
    winnerPlatform?: "instagram" | "tiktok" | null;
  }

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

  interface CycleVideoData {
    id: string;
    videoId?: string | null;
    platform: string;
    platformVideoId?: string | null;
    caption: string | null;
    thumbnailUrl?: string | null;
    thumbnailHash?: string | null;
    url?: string | null;
    videoFileUrl?: string | null;
    views: number;
    likes: number;
    comments: number;
    postedAt?: string | null;
    timestamp?: string | Date;
    isIrrelevant: boolean | null;
    isEligible: boolean;
    isFrozen: boolean;
    duration?: number | null;
    isPaired?: boolean | null;
    pairedVideoId?: string | null;
    basePayPerVideo: number;
    bonusAmount: number;
  }

  interface PairedCycleRow {
    id: string;
    date: Date;
    caption: string;
    ig: CycleVideoData | null;
    tiktok: CycleVideoData | null;
    matchType: "duration" | "thumbnail" | "none";
    winnerPlatform: "instagram" | "tiktok" | null;
  }

  const buildPairedCycleRows = (videos: CycleVideoData[]): PairedCycleRow[] => {
    const igVideos = videos.filter(v => v.platform === "instagram");
    const tiktokVideos = videos.filter(v => v.platform === "tiktok");
    const usedTiktokIds = new Set<string>();
    const rows: PairedCycleRow[] = [];

    for (const ig of igVideos) {
      let bestMatch: CycleVideoData | null = null;
      let bestDurationDiff = Infinity;
      let bestTimeDiff = Infinity;
      let matchType: "duration" | "thumbnail" | "none" = "none";

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

  const buildPairedMainRows = (vids: VideoWithCycleInfo[]): PairedVideoRow[] => {
    const igVideos = vids.filter(v => v.platform === "instagram");
    const ttVideos = vids.filter(v => v.platform === "tiktok");
    const usedTT = new Set<number>();
    const pairs: PairedVideoRow[] = [];

    for (const ig of igVideos) {
      const igTime = ig.timestamp ? new Date(ig.timestamp) : new Date();
      let bestMatch: VideoWithCycleInfo | null = null;
      let matchType: "duration" | "thumbnail" | "none" = "none";
      
      for (const tt of ttVideos) {
        if (usedTT.has(tt.id)) continue;
        const ttTime = tt.timestamp ? new Date(tt.timestamp) : new Date();
        
        if (!isWithin36Hours(igTime, ttTime)) continue;
        
        if (ig.duration && tt.duration && ig.duration === tt.duration) {
          bestMatch = tt;
          matchType = "duration";
          break;
        }
        
        if (areThumbnailsSimilar(ig.thumbnailHash, tt.thumbnailHash)) {
          bestMatch = tt;
          matchType = "thumbnail";
          break;
        }
      }
      
      if (bestMatch) {
        usedTT.add(bestMatch.id);
      }

      const igViews = ig.views || 0;
      const ttViews = bestMatch?.views || 0;
      const maxViews = Math.max(igViews, ttViews);
      let winnerPlatform: "instagram" | "tiktok" | null = null;
      if (bestMatch) {
        if (maxViews === igViews) winnerPlatform = "instagram";
        else winnerPlatform = "tiktok";
      }

      pairs.push({
        id: bestMatch ? `pair-${ig.id}-${bestMatch.id}` : `ig-${ig.id}`,
        date: igTime,
        caption: ig.caption || "",
        ig,
        tiktok: bestMatch,
        matchType,
        winnerPlatform,
      });
    }

    for (const tt of ttVideos) {
      if (usedTT.has(tt.id)) continue;
      const ttTime = tt.timestamp ? new Date(tt.timestamp) : new Date();

      pairs.push({
        id: `tt-${tt.id}`,
        date: ttTime,
        caption: tt.caption || "",
        ig: null,
        tiktok: tt,
        matchType: "none",
        winnerPlatform: null,
      });
    }

    return pairs.sort((a, b) => b.date.getTime() - a.date.getTime());
  };

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

  const formatTimeAgo = (date: string | null | undefined) => {
    if (!date) return "never";
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  const { data: dailyViewsData } = useQuery<DailyViewsResponse>({
    queryKey: ["/api/creator/daily-views", viewsDayRange],
    queryFn: async () => {
      const daysParam = viewsDayRange === 'all' ? 'all' : viewsDayRange;
      const res = await fetch(`/api/creator/daily-views?days=${daysParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch daily views');
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 60000,
  });

  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [cycleVideosDialogOpen, setCycleVideosDialogOpen] = useState(false);
  const [cycleVideosSortBy, setCycleVideosSortBy] = useState<"views" | "latest">("latest");
  const [payoutFilter, setPayoutFilter] = useState<"latest" | "payment">("latest");
  const [cycleDetailTab, setCycleDetailTab] = useState<"videos" | "bounties" | "survivor" | "total">("videos");

  const { data: cycleVideosData, isLoading: isCycleVideosLoading } = useQuery<{
    cycle: { id: string; startDate: string; endDate: string };
    videos: CycleVideoData[];
    isFrozen: boolean;
  }>({
    queryKey: ["/api/creator/cycle", selectedCycleId, "videos"],
    queryFn: async () => {
      const res = await fetch(`/api/creator/cycle/${selectedCycleId}/videos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch cycle videos");
      return res.json();
    },
    enabled: !!selectedCycleId && cycleVideosDialogOpen && !!token,
  });

  const { data: cycleBsData, isLoading: isCycleBsLoading } = useQuery<{
    bounties: { id: number; title: string; reward: string; deadline: string | null; status: string; completedAt: string | null }[];
    survivor: { id: number; title: string; prizePool: string; projectedPayout: string; sharePercent: number; isSurvivor: boolean; totalPosts: number }[];
  }>({
    queryKey: ["/api/creator/cycles", selectedCycleId, "bounties-and-survivor"],
    queryFn: async () => {
      const res = await fetch(`/api/creator/cycles/${selectedCycleId}/bounties-and-survivor`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch cycle bounties and survivor data");
      return res.json();
    },
    enabled: !!selectedCycleId && cycleVideosDialogOpen && !!token && (cycleDetailTab === "bounties" || cycleDetailTab === "survivor" || cycleDetailTab === "total"),
  });

  const { data: bountyHistory } = useQuery<BountyHistoryItem[]>({
    queryKey: ["/api/creator/bounty-history"],
    enabled: !!token,
  });

  const { data: survivorActive } = useQuery<any>({
    queryKey: ["/api/creator/streak-survivor/active"],
    queryFn: async () => {
      const res = await fetch("/api/creator/streak-survivor/active", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch active game");
      return res.json();
    },
    enabled: !!token,
  });

  const { data: survivorHistory } = useQuery<any[]>({
    queryKey: ["/api/creator/streak-survivor/history"],
    queryFn: async () => {
      const res = await fetch("/api/creator/streak-survivor/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch game history");
      return res.json();
    },
    enabled: !!token,
  });

  const handleDotHover = async (date: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (date === hoveredDate) return;
    setHoveredDate(date);
    if (videoCacheRef.current[date]) {
      setHoveredDateVideos(videoCacheRef.current[date]);
      return;
    }
    setIsLoadingVideos(true);
    try {
      const res = await fetch(`/api/creator/videos-by-date?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch videos');
      const vData = await res.json();
      const vVideos = vData.videos || [];
      setHoveredDateVideos(vVideos);
      videoCacheRef.current[date] = vVideos;
    } catch (error) {
      console.error('Error fetching videos by date:', error);
      setHoveredDateVideos([]);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  const handleDotLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredDate(null);
      setHoveredDateVideos([]);
    }, 250);
  };

  const handlePanelEnter = () => {
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
      const res = await fetch(`/api/creator/videos-by-date?date=${date}`, {
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

  const FilterButtons = ({ activeFilter, onFilterChange }: { activeFilter: FilterPreset; onFilterChange: (f: FilterPreset) => void }) => (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xs text-muted-foreground">Sort:</span>
      <div className="flex gap-1">
        {[
          { key: "latest", label: "Latest" },
          { key: "views", label: "Most Views" },
          { key: "payment", label: "Highest Pay" },
        ].map(({ key, label }) => (
          <Button
            key={key}
            variant={activeFilter === key ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onFilterChange(key as FilterPreset)}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Card className="mb-6">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Unable to load dashboard data.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { creator, videos, violations, payouts, activeCycle, allTimeStats } = data;
  const relevantVideos = videos.filter(v => !v.isIrrelevant);
  const eligibleVideos = videos.filter(v => v.isEligible && !v.isIrrelevant);
  
  const isVideoBeforeCycleStart = (video: VideoWithCycleInfo, cycle: Cycle): boolean => {
    if (!video.timestamp) return false;
    const videoDate = new Date(video.timestamp);
    const cycleStart = new Date(cycle.startDate);
    return videoDate < cycleStart;
  };

  const currentCycleVideos = activeCycle 
    ? videos.filter(v => v.cycleId === activeCycle.id && !isVideoBeforeCycleStart(v, activeCycle))
    : [];

  const preCycleVideos = activeCycle 
    ? videos.filter(v => v.cycleId === activeCycle.id && isVideoBeforeCycleStart(v, activeCycle))
    : [];

  const pastCycleVideos = activeCycle 
    ? videos.filter(v => v.cycleId !== activeCycle.id)
    : videos;
  
  const relevantCurrentCycleVideos = currentCycleVideos.filter(v => !v.isIrrelevant);
  
  const calculateEarnings = (vids: VideoWithCycleInfo[]) => {
    const pairedRows = buildPairedMainRows(vids);
    let baseEarnings = 0;
    let bonusEarnings = 0;
    
    for (const row of pairedRows) {
      const isPaired = !!row.ig && !!row.tiktok;
      if (!isPaired) continue;
      
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
      
      if (igEligible && igIsWinner && row.ig) {
        bonusEarnings += getVideoBonus(row.ig);
      }
      if (ttEligible && ttIsWinner && row.tiktok) {
        bonusEarnings += getVideoBonus(row.tiktok);
      }
    }
    
    return baseEarnings + bonusEarnings;
  };
  
  const currentCycleEarnings = calculateEarnings(relevantCurrentCycleVideos);
  
  const totalPaidEarnings = payouts
    .filter(p => p.paidAt !== null)
    .reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);

  const relevantIgVideos = relevantCurrentCycleVideos.filter(v => v.platform === "instagram");
  const relevantTtVideos = relevantCurrentCycleVideos.filter(v => v.platform === "tiktok");
  const eligibleIgVideos = eligibleVideos.filter(v => v.platform === "instagram");
  const eligibleTtVideos = eligibleVideos.filter(v => v.platform === "tiktok");

  const calculateEarningsBreakdown = (vids: VideoWithCycleInfo[]) => {
    const pairedRows = buildPairedMainRows(vids);
    let basePay = 0;
    let bonus = 0;
    
    for (const row of pairedRows) {
      const isPaired = !!row.ig && !!row.tiktok;
      if (!isPaired) continue;
      
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
      
      if (igEligible && igIsWinner && row.ig) {
        bonus += getVideoBonus(row.ig);
      }
      if (ttEligible && ttIsWinner && row.tiktok) {
        bonus += getVideoBonus(row.tiktok);
      }
    }
    
    return { basePay, bonus };
  };

  const currentCycleEarningsBreakdown = calculateEarningsBreakdown(relevantCurrentCycleVideos);
  
  const totalPaidBaseAmount = payouts
    .filter(p => p.paidAt !== null)
    .reduce((sum, p) => sum + parseFloat(p.basePay || "0"), 0);
  const totalPaidBonusAmount = payouts
    .filter(p => p.paidAt !== null)
    .reduce((sum, p) => sum + parseFloat(p.bonusPay || "0"), 0);

  const getCurrentStatsSnapshot = () => ({
    videos: relevantCurrentCycleVideos.length,
    igVideos: relevantIgVideos.length,
    ttVideos: relevantTtVideos.length,
    views: relevantCurrentCycleVideos.reduce((sum, v) => sum + (v.views || 0), 0),
    igViews: relevantIgVideos.reduce((sum, v) => sum + (v.views || 0), 0),
    ttViews: relevantTtVideos.reduce((sum, v) => sum + (v.views || 0), 0),
    earnings: currentCycleEarnings,
    basePay: currentCycleEarningsBreakdown.basePay,
    bonus: currentCycleEarningsBreakdown.bonus,
    following: (creator.instagramFollowers || 0) + (creator.tiktokFollowers || 0),
    igFollowers: creator.instagramFollowers || 0,
    ttFollowers: creator.tiktokFollowers || 0,
  });

  const handleRefreshEngagement = () => {
    if (isRefreshing) return;
    
    const snapshot = getCurrentStatsSnapshot();
    setPreRefreshSnapshot(snapshot);
    setRefreshChanges(null);
    
    startRefresh();
  };

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
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
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
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Joined {creator.createdAt ? formatUTCDate(creator.createdAt, "MMMM d, yyyy") : "Unknown"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col text-right text-xs text-muted-foreground leading-tight mr-1">
              <span>3 refreshes a day</span>
              <span>Last refreshed {refreshStatus?.lastRefreshedAt ? formatDistanceToNow(new Date(refreshStatus.lastRefreshedAt), { addSuffix: true }) : "never"}</span>
            </div>
            <button
              onClick={handleRefreshEngagement}
              disabled={isRefreshing || (refreshStatus ? !refreshStatus.canRefresh : false) || (!creator.instagramUsername && !creator.tiktokUsername)}
              className="group relative px-5 py-2.5 rounded-xl text-sm font-semibold text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                background: 'linear-gradient(135deg, #f97316, #ec4899, #a855f7, #06b6d4, #10b981)',
                backgroundSize: '300% 300%',
                animation: 'gradient-shift 4s ease infinite',
              }}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
              <span className="relative z-10 flex items-center gap-2">
                {isRefreshing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 group-hover:animate-pulse fill-current" />
                    Refresh Engagement {refreshStatus ? `${refreshStatus.refreshesRemaining}/3` : "0/3"}
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      <RefreshProgressBar inline />

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Creator Overview</CardTitle>
                <CardDescription>Your performance stats</CardDescription>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                </div>
                <div className="flex items-center gap-1">
                  <SiTiktok className="w-3 h-3" />
                  <span className="tabular-nums">
                    {overviewMode === "cycle" ? relevantTtVideos.length : (allTimeStats?.tiktokVideos ?? eligibleTtVideos.length)}
                  </span>
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
                    ? formatNumber(relevantCurrentCycleVideos.reduce((sum, v) => sum + (v.views || 0), 0))
                    : formatNumber(allTimeStats?.totalViews ?? eligibleVideos.reduce((sum, v) => sum + (v.views || 0), 0))}
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
                      ? formatNumber(relevantIgVideos.reduce((sum, v) => sum + (v.views || 0), 0))
                      : formatNumber(allTimeStats?.igViews ?? eligibleIgVideos.reduce((sum, v) => sum + (v.views || 0), 0))}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <SiTiktok className="w-3 h-3" />
                  <span className="tabular-nums">
                    {overviewMode === "cycle" 
                      ? formatNumber(relevantTtVideos.reduce((sum, v) => sum + (v.views || 0), 0))
                      : formatNumber(allTimeStats?.tiktokViews ?? eligibleTtVideos.reduce((sum, v) => sum + (v.views || 0), 0))}
                  </span>
                </div>
              </div>
            </div>
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
              </div>
              <div className="flex flex-col space-y-1 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span>Base</span>
                  <span className="tabular-nums">
                    {overviewMode === "cycle"
                      ? formatCurrency(currentCycleEarningsBreakdown.basePay)
                      : formatCurrency(totalPaidBaseAmount)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span>Bonus</span>
                  <span className="tabular-nums">
                    {overviewMode === "cycle"
                      ? formatCurrency(currentCycleEarningsBreakdown.bonus)
                      : formatCurrency(totalPaidBonusAmount)}
                  </span>
                </div>
              </div>
            </div>
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
                </div>
                <div className="flex items-center gap-1">
                  <SiTiktok className="w-3 h-3" />
                  <span className="tabular-nums">{formatNumber(creator.tiktokFollowers || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <h2 className="font-bold text-lg text-gray-900 dark:text-white">Your Views</h2>
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
                    <linearGradient id="creatorBarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
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
                            fill="url(#creatorBarGradient)"
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
                {hoveredDate && !playingHoverVideo && (() => {
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
                                      <button key={video.id} onClick={() => { if (video.platformVideoId) { setPlayingHoverVideo(video); setPlayingVideoId(video.id); } else if (video.url) { window.open(video.url, '_blank'); } }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors w-full text-left">
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
                                              <DashboardInstagramIcon className="w-3 h-3 text-pink-400" />
                                            ) : (
                                              <DashboardTikTokIcon className="w-3 h-3 text-gray-900 dark:text-white" />
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
              <h2 className="font-bold text-lg text-gray-900 dark:text-white">Your Engagement Rate</h2>
            </div>
          </div>
          <div className="p-4">
            {dailyViewsData?.dataPoints && dailyViewsData.dataPoints.length > 0 ? (
              <div ref={engagementChartRef} className="relative w-full">
                <svg viewBox="0 0 500 300" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <linearGradient id="creatorEngagementGradient" x1="0%" y1="0%" x2="0%" y2="100%">
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
                        <path d={areaPath} fill="url(#creatorEngagementGradient)" />
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
                
                {engHoveredDate && !playingHoverVideo && (() => {
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
                                      <button key={video.id} onClick={() => { if (video.platformVideoId) { setPlayingHoverVideo(video); setPlayingVideoId(video.id); } else if (video.url) { window.open(video.url, '_blank'); } }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors w-full text-left">
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
                                              <DashboardInstagramIcon className="w-3 h-3 text-pink-400" />
                                            ) : (
                                              <DashboardTikTokIcon className="w-3 h-3 text-gray-900 dark:text-white" />
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

      <Tabs defaultValue="videos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="videos">
            Videos ({eligibleVideos.length})
          </TabsTrigger>
          <TabsTrigger value="violations">
            Violations ({violations.length})
          </TabsTrigger>
          <TabsTrigger value="payouts">
            Payout History ({payouts.length})
          </TabsTrigger>
          <TabsTrigger value="bounties">
            Bounties
          </TabsTrigger>
          <TabsTrigger value="streak-survivor">
            Streak Survivor
          </TabsTrigger>
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
                      You haven't synced any videos for this cycle yet.
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
                              
                              const formatDuration = (seconds: number | null | undefined) => {
                                if (!seconds) return null;
                                const mins = Math.floor(seconds / 60);
                                const secs = seconds % 60;
                                return `${mins}:${secs.toString().padStart(2, '0')}`;
                              };
                              
                              const videoKey = `${video.platform}-${video.id}`;
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
                                  onClick={() => video.platformVideoId && setPlayingVideoId(videoKey)}
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
                                        <span className="font-mono font-medium text-[13px]">{formatNumber(video.views || 0)}</span>
                                      </span>
                                      <span className="flex items-center gap-1 text-[12px]">
                                        <Heart className="w-3 h-3" />
                                        {formatNumber(video.likes || 0)}
                                      </span>
                                      <span className="flex items-center gap-1 text-[12px]">
                                        <MessageCircle className="w-3 h-3" />
                                        {formatNumber(video.comments || 0)}
                                      </span>
                                    </div>
                                    
                                    {(video.views || 0) < 1000 && (
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
                                        <Button
                                          size="sm"
                                          variant={isMarkedIrrelevant ? "destructive" : "default"}
                                          className={`h-5 px-2 text-[9px] ${isMarkedIrrelevant ? "shadow-[0_0_8px_rgba(239,68,68,0.6)]" : "bg-blue-500 hover:bg-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.6)]"}`}
                                          onClick={() => toggleIrrelevantMutation.mutate({ 
                                            videoId: String(video.id), 
                                            isIrrelevant: !video.isIrrelevant 
                                          })}
                                          disabled={toggleIrrelevantMutation.isPending}
                                        >
                                          {isMarkedIrrelevant ? "Irrelevant" : "Relevant"}
                                        </Button>
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
                                  {hasAnyEligible ? formatCurrency(totalBasePay) : "—"}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums pt-4">
                                  {hasAnyEligible && totalBonus > 0 ? formatCurrency(totalBonus) : "—"}
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

            {preCycleVideos.length > 0 && (
              <Collapsible open={preCycleOpen} onOpenChange={setPreCycleOpen}>
                <Card>
                  <CardHeader className="pb-3">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-600" />
                          </div>
                          <div className="text-left">
                            <CardTitle className="text-lg">Pre-Cycle Videos</CardTitle>
                            <CardDescription>
                              {preCycleVideos.length} videos posted before this cycle started
                            </CardDescription>
                          </div>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${preCycleOpen ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        These videos were posted before the current cycle started and are not eligible for this cycle's payout.
                      </p>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

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
                              {pastCycleVideos.length} videos from previous cycles
                            </CardDescription>
                          </div>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${pastOpen ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent>
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
                              .sort((a, b) => b.date.getTime() - a.date.getTime())
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
                                  
                                  const pastVideoKey = `past-${video.platform}-${video.id}`;
                                  const isPastPlaying = playingVideoId === pastVideoKey;
                                  const pastUname = video.platform === "instagram" ? creator.instagramUsername : video.platform === "tiktok" ? creator.tiktokUsername : undefined;

                                  const formatDuration = (seconds: number | null | undefined) => {
                                    if (!seconds) return null;
                                    const m = Math.floor(seconds / 60);
                                    const s = seconds % 60;
                                    return `${m}:${s.toString().padStart(2, '0')}`;
                                  };

                                  const pastThumbnailOrPlayer = isPastPlaying && video.platformVideoId ? (
                                    <div className="relative w-[224px] h-[400px] rounded-md overflow-hidden bg-black flex-shrink-0">
                                      <VideoEmbed platform={video.platform} platformVideoId={video.platformVideoId} username={pastUname || undefined} videoFileUrl={video.videoFileUrl || undefined} thumbnailUrl={video.thumbnailUrl || video.thumbnail || undefined} small />
                                      <button
                                        onClick={() => setPlayingVideoId(null)}
                                        className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600 z-10"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => video.platformVideoId && setPlayingVideoId(pastVideoKey)}
                                      className="relative w-20 aspect-[9/16] rounded-md overflow-hidden bg-muted flex-shrink-0 cursor-pointer group"
                                    >
                                      {video.thumbnail ? (
                                        <img src={video.thumbnail.replace('.heic', '.jpeg')} alt="Video thumbnail" className="w-full h-full object-cover" />
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
                                            <span className="font-mono font-medium">{formatNumber(video.views || 0)}</span>
                                          </span>
                                          <span className="flex items-center gap-1">
                                            <Heart className="w-3 h-3" />
                                            {formatNumber(video.likes || 0)}
                                          </span>
                                          <span className="flex items-center gap-1">
                                            <MessageCircle className="w-3 h-3" />
                                            {formatNumber(video.comments || 0)}
                                          </span>
                                        </div>
                                        {(video.postedAt || (video as any).timestamp) && (
                                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                            <Clock className="w-3 h-3" />
                                            <span>{formatUTCDate(new Date((video as any).timestamp || video.postedAt || 0).toISOString(), "d MMM HH:mm")} UTC</span>
                                          </div>
                                        )}
                                        
                                        {(video.views || 0) < 1000 && (
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
              <CardDescription>Any rule violations on your account</CardDescription>
            </CardHeader>
            <CardContent>
              {violations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-chart-2/10 flex items-center justify-center mb-4">
                    <CheckCircle className="w-8 h-8 text-chart-2" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No violations</h3>
                  <p className="text-muted-foreground">
                    You have no rule violations. Keep up the great work!
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
                              : violation.type || "Rule violation"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {violation.date
                              ? formatUTCDate(typeof violation.date === 'string' ? violation.date : violation.date.toISOString(), "MMMM d, yyyy")
                              : "Unknown date"}
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
              <CardDescription>Your payout records</CardDescription>
            </CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <DollarSign className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No payouts yet</h3>
                  <p className="text-muted-foreground">
                    You don't have any payout records yet. Keep posting videos!
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...payouts].sort((a, b) => {
                        switch (payoutFilter) {
                          case "latest":
                            return new Date(b.cycle?.startDate || 0).getTime() - new Date(a.cycle?.startDate || 0).getTime();
                          case "payment":
                            return parseFloat((b as any).combinedTotal || b.amount || "0") - parseFloat((a as any).combinedTotal || a.amount || "0");
                          default:
                            return new Date(b.cycle?.startDate || 0).getTime() - new Date(a.cycle?.startDate || 0).getTime();
                        }
                      }).map((payout) => {
                        const isPaid = !!payout.paidAt;
                        const videosPay = parseFloat(payout.basePay || "0") + parseFloat(payout.bonusPay || "0");
                        const bountyPay = parseFloat((payout as any).bountyTotal || "0");
                        const survivorPay = parseFloat((payout as any).survivorTotal || "0");
                        const combinedPay = parseFloat((payout as any).combinedTotal || payout.amount || "0");
                        
                        return (
                          <TableRow 
                            key={payout.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              if (payout.cycleId) {
                                setSelectedCycleId(String(payout.cycleId));
                                setCycleDetailTab("videos");
                                setCycleVideosDialogOpen(true);
                              }
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

        <TabsContent value="bounties">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">My Bounty Claims</CardTitle>
              <CardDescription>Your bounty claim history</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bounty</TableHead>
                      <TableHead className="text-right">Reward</TableHead>
                      <TableHead>Date Range</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bountyHistory && bountyHistory.length > 0 ? (
                      bountyHistory.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Gem className="w-4 h-4 text-sky-500" />
                              {item.bountyTitle}
                            </div>
                          </TableCell>
                          <TableCell className={`text-right font-mono tabular-nums ${item.status === "rejected" && item.penaltyAmount > 0 ? "text-red-600" : "text-green-600"}`}>
                            {item.status === "rejected" && item.penaltyAmount > 0
                              ? `-$${item.penaltyAmount.toFixed(2)}`
                              : `$${parseFloat(item.bountyReward).toFixed(2)}`}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(item.bountyStartDate), "MMM d")} -{" "}
                            {item.bountyDeadline ? format(new Date(item.bountyDeadline), "MMM d, yyyy") : "No deadline"}
                          </TableCell>
                          <TableCell className="text-center">
                            {(item.status === "claimed" || item.status === "completed") && (
                              <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-600">Pending Approval</Badge>
                            )}
                            {item.status === "approved" && item.isPaid && (
                              <Badge variant="secondary" className="gap-1 bg-green-500/20 text-green-600">
                                <CheckCircle className="w-3 h-3" />
                                Paid
                              </Badge>
                            )}
                            {item.status === "approved" && !item.isPaid && (
                              <Badge variant="secondary" className="gap-1 bg-blue-500/20 text-blue-600">
                                Approved - Pending Payment
                              </Badge>
                            )}
                            {item.status === "rejected" && (
                              <Badge variant="destructive" className="gap-1">
                                {item.penaltyAmount > 0 ? `Rejected (-$${item.penaltyAmount.toFixed(2)})` : "Rejected"}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          No bounty claims yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="streak-survivor">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Your Games</CardTitle>
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
                      {survivorActive?.game && survivorActive.myStats && (
                        <TableRow>
                          <TableCell className="font-medium">{survivorActive.game.title}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {survivorActive.game.startDate ? formatUTCDate(survivorActive.game.startDate, "MMM d, yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <Badge variant="outline" className="text-xs bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800">Active</Badge>
                          </TableCell>
                          <TableCell className="text-center">{survivorActive.myStats.lives}</TableCell>
                          <TableCell className="text-center">{survivorActive.myStats.ttPosts || 0}</TableCell>
                          <TableCell className="text-center">{survivorActive.myStats.igPosts || 0}</TableCell>
                          <TableCell className="text-center">{survivorActive.myStats.currentStreak || 0}d</TableCell>
                          <TableCell className="text-center">
                            {survivorActive.myStats.isEliminated ? (
                              <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800">Eliminated</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800">Alive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {survivorActive.myStats.isEliminated ? (
                              <span className="text-muted-foreground">nil</span>
                            ) : (
                              <span className="text-sky-600">${(survivorActive.myStats.projectedPayout || 0).toFixed(2)}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                      {survivorHistory && survivorHistory.map((game: any) => (
                        game.myStats ? (
                          <TableRow key={game.id}>
                            <TableCell className="font-medium">{game.title}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {game.startDate ? formatUTCDate(game.startDate, "MMM d, yyyy") : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {game.endDate ? formatUTCDate(game.endDate, "MMM d, yyyy") : "—"}
                            </TableCell>
                            <TableCell className="text-center">{game.myStats.lives ?? 0}</TableCell>
                            <TableCell className="text-center">{game.myStats.ttPosts || 0}</TableCell>
                            <TableCell className="text-center">{game.myStats.igPosts || 0}</TableCell>
                            <TableCell className="text-center">{game.myStats.longestStreak || 0}d</TableCell>
                            <TableCell className="text-center">
                              {game.myStats.isSurvivor ? (
                                <Badge variant="outline" className="text-xs bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800">Survived</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800">Eliminated</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {game.myStats.isSurvivor && game.myStats.projectedPayout > 0 ? (
                                <span className="text-sky-600">${game.myStats.projectedPayout.toFixed(2)}</span>
                              ) : (
                                <span className="text-muted-foreground">nil</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ) : null
                      ))}
                      {!survivorActive?.myStats && (!survivorHistory || survivorHistory.length === 0 || survivorHistory.every((g: any) => !g.myStats)) && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                            No Streak Survivor games to show
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={captionDialogOpen} onOpenChange={setCaptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Video Caption</DialogTitle>
            <DialogDescription>Full caption text</DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap">{selectedCaption}</p>
          </div>
        </DialogContent>
      </Dialog>

      {playingHoverVideo && playingHoverVideo.platformVideoId && (() => {
        const closePlayer = () => { setPlayingVideoId(null); setPlayingHoverVideo(null); };
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80" onClick={closePlayer}>
            <div className="relative w-[260px] h-[462px] rounded-2xl overflow-hidden bg-black shadow-2xl" onClick={e => e.stopPropagation()}>
              <VideoEmbed
                platform={playingHoverVideo.platform}
                platformVideoId={playingHoverVideo.platformVideoId}
                username={playingHoverVideo.username || undefined}
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
                <p className="text-white/60 text-[10px] mt-0.5">@{playingHoverVideo.username}</p>
              </div>
            </div>
          </div>
        );
      })()}

      <Dialog open={cycleVideosDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setPlayingVideoId(null);
          setPlayingHoverVideo(null);
        }
        setCycleVideosDialogOpen(open);
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {cycleVideosData?.isFrozen && (
                <span className="text-blue-500">❄️</span>
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
          ) : cycleVideosData?.videos && cycleVideosData.videos.length > 0 ? (() => {
            const pairedRows = buildPairedCycleRows(cycleVideosData.videos);
            const eligibleCount = cycleVideosData.videos.filter(v => v.isEligible && !v.isIrrelevant).length;
            const totalViews = cycleVideosData.videos.reduce((sum, v) => sum + (v.views || 0), 0);
            const totalPayout = cycleVideosData.videos.reduce((sum, v) => sum + (v.basePayPerVideo || 0) + (v.bonusAmount || 0), 0);

            const formatDuration = (seconds: number | null | undefined) => {
              if (!seconds) return null;
              const mins = Math.floor(seconds / 60);
              const secs = seconds % 60;
              return `${mins}:${secs.toString().padStart(2, '0')}`;
            };

            const renderCycleVideoCard = (video: CycleVideoData | null, platform: "instagram" | "tiktok", isWinner: boolean, isPairedRow: boolean) => {
              if (!video) {
                return (
                  <div className="flex items-center justify-center h-24 text-muted-foreground text-sm border border-dashed rounded-lg">
                    —
                  </div>
                );
              }

              const isMarkedIrrelevant = video.isIrrelevant === true;
              const isIneligible = video.isEligible === false && !isMarkedIrrelevant;

              const cycleVideoKey = `cycle-${video.platform}-${video.id}`;
              const isCyclePlaying = playingVideoId === cycleVideoKey;

              const cycleThumbnailOrPlayer = isCyclePlaying && video.platformVideoId ? (
                <div className="relative w-[224px] h-[400px] rounded-md overflow-hidden bg-black flex-shrink-0">
                  <VideoEmbed platform={video.platform} platformVideoId={video.platformVideoId} videoFileUrl={video.videoFileUrl || undefined} thumbnailUrl={video.thumbnailUrl || undefined} small />
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
                  {isPairedRow && isWinner && !isIneligible && !isMarkedIrrelevant && (
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
                    <div className="relative z-10">
                      {isIneligible ? (
                        <Badge variant="secondary" className="text-[9px] h-5 bg-gray-500/20 text-gray-500">
                          <Ban className="w-2.5 h-2.5 mr-0.5" />
                          Ineligible
                        </Badge>
                      ) : isMarkedIrrelevant ? (
                        <Badge variant="destructive" className="text-[9px] h-5">Irrelevant</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px] h-5 bg-blue-500/20 text-blue-600">Eligible</Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <div className="space-y-4">
                {cycleVideosData.isFrozen && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                    <span>❄️</span>
                    <span>Frozen data - Views are locked at cycle end.</span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{eligibleCount}</div>
                    <div className="text-sm text-muted-foreground">Eligible Videos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{formatNumber(totalViews)}</div>
                    <div className="text-sm text-muted-foreground">Total Views</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-sky-500">{formatCurrency(totalPayout)}</div>
                    <div className="text-sm text-muted-foreground">Total Payout</div>
                  </div>
                </div>
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
                      {pairedRows
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

                          return (
                            <TableRow key={row.id} className="align-top">
                              <TableCell className="font-mono text-sm pt-4">
                                <div className="flex flex-col gap-1">
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
                                  <p className="text-sm text-muted-foreground line-clamp-2 max-w-[120px] cursor-pointer hover:text-foreground" onClick={() => { setSelectedCaption(row.ig?.caption || ""); setCaptionDialogOpen(true); }}>
                                    {row.ig.caption}
                                  </p>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {renderCycleVideoCard(row.ig, "instagram", igIsWinner, isPaired)}
                              </TableCell>
                              <TableCell className="pt-4">
                                {row.tiktok?.caption ? (
                                  <p className="text-sm text-muted-foreground line-clamp-2 max-w-[120px] cursor-pointer hover:text-foreground" onClick={() => { setSelectedCaption(row.tiktok?.caption || ""); setCaptionDialogOpen(true); }}>
                                    {row.tiktok.caption}
                                  </p>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {renderCycleVideoCard(row.tiktok, "tiktok", ttIsWinner, isPaired)}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums pt-4">
                                {hasAnyEligible ? formatCurrency(totalBasePay) : "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums pt-4">
                                {hasAnyEligible && totalBonus > 0 ? formatCurrency(totalBonus) : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })() : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Video className="w-8 h-8 mb-2" />
              <p>No videos in this cycle.</p>
            </div>
          ))}

          {cycleDetailTab === "bounties" && (
            isCycleBsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : cycleBsData?.bounties && cycleBsData.bounties.length > 0 ? (
              <div className="space-y-3">
                {cycleBsData.bounties.map((b) => (
                  <div key={b.id} className={`flex items-center justify-between p-3 rounded-lg border ${b.status === "rejected" ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30" : "bg-sky-50 dark:bg-sky-900/10 border-sky-200 dark:border-sky-800/30"}`}>
                    <div>
                      <div className="font-medium">{b.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {b.completedAt ? `Completed ${formatUTCDate(b.completedAt, "MMM d, yyyy")}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${b.status === "rejected" ? "text-red-600 dark:text-red-400" : "text-sky-600 dark:text-sky-400"}`}>${b.reward}</div>
                      {b.status === "rejected" ? (
                        <Badge variant="destructive" className="text-xs mt-1">Rejected</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 mt-1">
                          Approved
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-medium">Bounty Total</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">
                    ${cycleBsData.bounties.reduce((sum, b) => sum + parseFloat(b.reward), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Gem className="w-8 h-8 mb-2" />
                <p>No bounties completed in this cycle.</p>
              </div>
            )
          )}

          {cycleDetailTab === "survivor" && (
            isCycleBsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : cycleBsData?.survivor && cycleBsData.survivor.length > 0 ? (
              <div className="space-y-3">
                {cycleBsData.survivor.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-200 dark:border-orange-800/30">
                    <div>
                      <div className="font-medium">{s.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Prize Pool: ${s.prizePool} · {s.totalPosts} posts · {s.sharePercent}% share
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-orange-600 dark:text-orange-400">${s.projectedPayout}</div>
                      <Badge variant="secondary" className={`text-xs mt-1 ${s.isSurvivor ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                        {s.isSurvivor ? "Survived" : "Eliminated"}
                      </Badge>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-medium">Survivor Total</span>
                  <span className="font-bold text-orange-600 dark:text-orange-400">
                    ${cycleBsData.survivor.reduce((sum, s) => sum + parseFloat(s.projectedPayout), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Flame className="w-8 h-8 mb-2" />
                <p>No Streak Survivor games ended in this cycle.</p>
              </div>
            )
          )}

          {cycleDetailTab === "total" && (() => {
            const selectedPayout = payouts.find(p => String(p.cycleId) === selectedCycleId);
            const videosTotal = selectedPayout ? parseFloat(selectedPayout.basePay || "0") + parseFloat(selectedPayout.bonusPay || "0") : 0;
            const bountyTotal = cycleBsData?.bounties && cycleBsData.bounties.length > 0
              ? cycleBsData.bounties.reduce((sum: number, b: any) => sum + parseFloat(b.reward), 0)
              : (selectedPayout ? parseFloat((selectedPayout as any).bountyTotal || "0") : 0);
            const survivorTotal = cycleBsData?.survivor && cycleBsData.survivor.length > 0
              ? cycleBsData.survivor.reduce((sum: number, s: any) => sum + parseFloat(s.projectedPayout || 0), 0)
              : (selectedPayout ? parseFloat((selectedPayout as any).survivorTotal || "0") : 0);
            const grandTotal = videosTotal + bountyTotal + survivorTotal;

            return (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-blue-500" />
                      <span className="font-medium">Videos</span>
                    </div>
                    <span className="font-bold">{videosTotal > 0 ? formatCurrency(videosTotal) : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-sky-50 dark:bg-sky-900/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Gem className="w-4 h-4 text-sky-500" />
                      <span className="font-medium">Bounties</span>
                    </div>
                    <span className={`font-bold ${bountyTotal < 0 ? "text-red-600 dark:text-red-400" : "text-sky-600 dark:text-sky-400"}`}>{bountyTotal !== 0 ? formatCurrency(bountyTotal) : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span className="font-medium">Streak Survivor</span>
                    </div>
                    <span className="font-bold text-orange-600 dark:text-orange-400">{survivorTotal > 0 ? formatCurrency(survivorTotal) : "—"}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-sky-50 to-green-50 dark:from-sky-900/20 dark:to-green-900/20 rounded-lg border-2 border-sky-200 dark:border-sky-800/30">
                  <span className="text-lg font-bold">Grand Total</span>
                  <span className={`text-2xl font-bold ${grandTotal < 0 ? "text-red-600 dark:text-red-400" : "text-sky-600 dark:text-sky-400"}`}>{grandTotal !== 0 ? formatCurrency(grandTotal) : "—"}</span>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}
