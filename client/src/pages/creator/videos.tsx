import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Video as VideoIcon, Eye, Heart, MessageCircle, RefreshCw, Loader2, Info, Ban, ExternalLink, Clock, ChevronDown, History, Type, ImageIcon, TrendingUp, DollarSign, Users, Instagram, MoreVertical, Download, Gauge } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VideoEmbed } from "@/components/video-embed";
import { SiTiktok, SiInstagram } from "react-icons/si";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { formatUTCDate } from "@/lib/date-utils";
import type { Video, Cycle } from "@shared/schema";
import { buildPairedVideoRows } from "@/lib/videoPairing";

interface VideoWithPayInfo extends Video {
  basePayPerVideo: number;
  bonusAmount: number;
}

interface CreatorVideosData {
  videos: VideoWithPayInfo[];
  activeCycle: Cycle | null;
  allCycles: Cycle[];
  settings?: {
    basePayPerVideo: number;
    instagramBasePayPerVideo: number;
    tiktokBasePayPerVideo: number;
  };
}

interface PayoutData {
  id: string;
  totalAmount: string;
  baseAmount: string;
  bonusAmount: string;
  paidAt: string | null;
  cycle: { startDate: string; endDate: string } | null;
}

export default function CreatorVideos() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [pastOpen, setPastOpen] = useState(false);
  const [preCycleOpen, setPreCycleOpen] = useState(false);
  const [captionDialogOpen, setCaptionDialogOpen] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState("");
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [overviewMode, setOverviewMode] = useState<"cycle" | "allTime">("cycle");

  const { data, isLoading } = useQuery<CreatorVideosData>({
    queryKey: ["/api/creator/videos-with-cycle"],
    enabled: !!token,
  });

  const { data: payouts } = useQuery<PayoutData[]>({
    queryKey: ["/api/creator/payouts"],
    enabled: !!token,
  });

  const { data: creatorDetail } = useQuery<{ creator: { instagramUsername?: string; tiktokUsername?: string } }>({
    queryKey: ["/api/creator/detail"],
    enabled: !!token,
  });

  const { data: allTimeStats } = useQuery<{
    totalVideos: number;
    totalViews: number;
    totalEarnings: number;
    totalBaseEarnings: number;
    totalBonusEarnings: number;
    igViews: number;
    tiktokViews: number;
    igVideos: number;
    tiktokVideos: number;
  }>({
    queryKey: ["/api/creator/stats/all-time"],
    enabled: !!token,
  });

  const videos = data?.videos || [];
  const activeCycle = data?.activeCycle;
  const allCycles = data?.allCycles || [];
  const pastCycles = allCycles.filter(c => activeCycle ? c.id !== activeCycle.id : true);

  const [, setTick] = useState(0); // Force re-render for time updates
  
  // Calculate the most recent sync timestamp from database-stored values
  const lastSyncAt = (() => {
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

  const toggleIrrelevantMutation = useMutation({
    mutationFn: async ({ videoId, isIrrelevant }: { videoId: string; isIrrelevant: boolean }) => {
      return await apiRequest("PUT", `/api/creator/videos/${videoId}/irrelevant`, { isIrrelevant });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creator/videos-with-cycle"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/dashboard"] });
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

  // Helper to check if video was posted before the cycle start date
  const isVideoBeforeCycleStart = (video: Video, cycle: Cycle): boolean => {
    if (!video.timestamp) return false;
    const videoDate = new Date(video.timestamp);
    const cycleStart = new Date(cycle.startDate);
    return videoDate < cycleStart;
  };

  // Current cycle videos = videos assigned to current cycle AND posted ON or AFTER cycle start date
  // (This includes videos during the cycle and any posted after cycle end)
  const currentCycleVideos = activeCycle 
    ? videos.filter(v => v.cycleId === activeCycle.id && !isVideoBeforeCycleStart(v, activeCycle))
    : videos;

  const currentInstagramVideos = currentCycleVideos.filter(v => v.platform === "instagram");
  const currentTiktokVideos = currentCycleVideos.filter(v => v.platform === "tiktok");
  
  // Pre-cycle videos = videos assigned to current cycle but posted BEFORE cycle started
  const preCycleVideos = activeCycle 
    ? videos.filter(v => v.cycleId === activeCycle.id && isVideoBeforeCycleStart(v, activeCycle))
    : [];

  const preCycleInstagramVideos = preCycleVideos.filter(v => v.platform === "instagram");
  const preCycleTiktokVideos = preCycleVideos.filter(v => v.platform === "tiktok");
  
  // Past cycle videos = videos from different (older) cycles
  const pastCycleVideos = activeCycle 
    ? videos.filter(v => v.cycleId !== activeCycle.id)
    : [];
  
  const pastInstagramVideos = pastCycleVideos.filter(v => v.platform === "instagram");
  const pastTiktokVideos = pastCycleVideos.filter(v => v.platform === "tiktok");

  const relevantCurrentCycleVideos = currentCycleVideos.filter(v => !v.isIrrelevant);
  
  const eligibleVideos = videos.filter(v => !v.isIrrelevant);
  
  const calculateEarnings = (videoList: VideoWithPayInfo[]) => {
    const rows = buildPairedVideoRows(videoList);
    let total = 0;
    
    for (const row of rows) {
      // Unpaired videos get $0 - only paired videos (both platforms) get paid
      const isPaired = !!row.ig && !!row.tiktok;
      if (!isPaired) continue;
      
      const igVideo = row.ig as VideoWithPayInfo | null;
      const ttVideo = row.tiktok as VideoWithPayInfo | null;
      
      const igEligible = igVideo && !igVideo.isIrrelevant;
      const ttEligible = ttVideo && !ttVideo.isIrrelevant;
      
      // For paired videos, winner is determined by views (IG wins ties)
      const igIsWinner = row.winnerPlatform === "instagram";
      const ttIsWinner = row.winnerPlatform === "tiktok";
      
      // Base pay for PAIRED videos only
      if (igEligible) {
        total += igVideo.basePayPerVideo;
      }
      if (ttEligible) {
        total += ttVideo.basePayPerVideo;
      }
      
      // Bonus only for winners from paired videos
      if (igEligible && igIsWinner) {
        total += igVideo.bonusAmount || 0;
      }
      if (ttEligible && ttIsWinner) {
        total += ttVideo.bonusAmount || 0;
      }
    }
    return total;
  };
  
  const currentCycleEarnings = calculateEarnings(relevantCurrentCycleVideos);
  
  const totalPaidEarnings = (payouts || [])
    .filter(p => p.paidAt !== null)
    .reduce((sum, p) => sum + parseFloat(p.totalAmount || "0"), 0);

  const relevantIgVideos = relevantCurrentCycleVideos.filter(v => v.platform === "instagram");
  const relevantTtVideos = relevantCurrentCycleVideos.filter(v => v.platform === "tiktok");
  const eligibleIgVideos = eligibleVideos.filter(v => v.platform === "instagram");
  const eligibleTtVideos = eligibleVideos.filter(v => v.platform === "tiktok");

  const calculateEarningsBreakdown = (videoList: VideoWithPayInfo[]) => {
    const rows = buildPairedVideoRows(videoList);
    let basePay = 0;
    let bonus = 0;
    
    for (const row of rows) {
      // Unpaired videos get $0 - only paired videos (both platforms) get paid
      const isPaired = !!row.ig && !!row.tiktok;
      if (!isPaired) continue;
      
      const igVideo = row.ig as VideoWithPayInfo | null;
      const ttVideo = row.tiktok as VideoWithPayInfo | null;
      
      const igEligible = igVideo && !igVideo.isIrrelevant;
      const ttEligible = ttVideo && !ttVideo.isIrrelevant;
      
      // For paired videos, winner is determined by views (IG wins ties)
      const igIsWinner = row.winnerPlatform === "instagram";
      const ttIsWinner = row.winnerPlatform === "tiktok";
      
      // Base pay for PAIRED videos only
      if (igEligible) {
        basePay += igVideo.basePayPerVideo;
      }
      if (ttEligible) {
        basePay += ttVideo.basePayPerVideo;
      }
      
      // Bonus only for winners from paired videos
      if (igEligible && igIsWinner) {
        bonus += igVideo.bonusAmount || 0;
      }
      if (ttEligible && ttIsWinner) {
        bonus += ttVideo.bonusAmount || 0;
      }
    }
    return { basePay, bonus };
  };

  const currentCycleEarningsBreakdown = calculateEarningsBreakdown(relevantCurrentCycleVideos);
  
  const totalPaidBaseAmount = (payouts || [])
    .filter(p => p.paidAt !== null)
    .reduce((sum, p) => sum + parseFloat(p.baseAmount || "0"), 0);
  const totalPaidBonusAmount = (payouts || [])
    .filter(p => p.paidAt !== null)
    .reduce((sum, p) => sum + parseFloat(p.bonusAmount || "0"), 0);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getVideoBonus = (video: VideoWithPayInfo | null): number => {
    if (!video) return 0;
    return video.bonusAmount || 0;
  };

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

  const renderVideoCard = (video: VideoWithPayInfo | null, platform: "instagram" | "tiktok", isWinner: boolean, isPaired: boolean) => {
    if (!video) {
      return (
        <div className="flex items-center justify-center h-24 text-muted-foreground text-sm border border-dashed rounded-lg">
          —
        </div>
      );
    }
    
    const isIneligible = false;
    const isMarkedIrrelevant = video.isIrrelevant;
    
    const videoKey = `${video.platform}-${video.id}`;
    const isPlaying = playingVideoId === videoKey;
    const cDetail = creatorDetail?.creator;
    const uname = video.platform === "instagram" ? cDetail?.instagramUsername : video.platform === "tiktok" ? cDetail?.tiktokUsername : undefined;

    const thumbnailOrPlayer = isPlaying && video.platformVideoId ? (
      <div className="relative w-[280px] h-[500px] rounded-md overflow-hidden bg-black flex-shrink-0" data-video-key={videoKey}>
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
          <a
            href={
              platform === "instagram"
                ? `https://www.instagram.com/reel/${video.platformVideoId}/`
                : `https://www.tiktok.com/@${uname || "user"}/video/${video.platformVideoId}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-400 transition-colors mt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" />
            <span>View</span>
          </a>
          
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
        </div>
      </div>
    );
  };

  const renderPastVideoCard = (video: VideoWithPayInfo | null, platform: "instagram" | "tiktok") => {
    if (!video) {
      return (
        <div className="flex items-center justify-center h-24 text-muted-foreground text-sm border border-dashed rounded-lg">
          —
        </div>
      );
    }
    
    const isIneligible = false;
    const isMarkedIrrelevant = video.isIrrelevant;
    
    const pastVideoKey = `past-${video.platform}-${video.id}`;
    const isPastPlaying = playingVideoId === pastVideoKey;
    const cDetail = creatorDetail?.creator;
    const pastUname = video.platform === "instagram" ? cDetail?.instagramUsername : video.platform === "tiktok" ? cDetail?.tiktokUsername : undefined;

    const pastThumbnailOrPlayer = isPastPlaying && video.platformVideoId ? (
      <div className="relative w-20 aspect-[9/16] rounded-md overflow-hidden bg-black flex-shrink-0">
        <VideoEmbed platform={video.platform} platformVideoId={video.platformVideoId} username={pastUname || undefined} videoFileUrl={video.videoFileUrl || undefined} thumbnailUrl={video.thumbnailUrl || undefined} small />
        <button
          onClick={() => setPlayingVideoId(null)}
          className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center text-white text-[8px] hover:bg-red-600 z-10"
        >
          ✕
        </button>
      </div>
    ) : (
      <button
        onClick={() => video.platformVideoId && setPlayingVideoId(pastVideoKey)}
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
      <div className={`flex w-full gap-2 p-2 rounded-lg border ${isMarkedIrrelevant ? "opacity-70 bg-muted/30" : isIneligible ? "opacity-60 bg-muted/30" : "bg-card"}`}>
        {pastThumbnailOrPlayer}
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
              <Badge 
                variant={isMarkedIrrelevant ? "destructive" : "default"}
                className={`text-[9px] h-5 ${isMarkedIrrelevant ? "" : "bg-blue-500"}`}
              >
                {isMarkedIrrelevant ? "Irrelevant" : "Relevant"}
              </Badge>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Creator Overview</h1>
        <p className="text-muted-foreground">
          View your synced videos and their performance metrics.
        </p>
      </div>

      {/* Creator Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Creator Overview</CardTitle>
                <CardDescription>
                  Performance stats for this cycle
                </CardDescription>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="group bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525] p-4 sm:p-5 transition-all duration-300 hover:shadow-[0_6px_30px_rgba(0,0,0,0.14)] hover:-translate-y-1 hover:border-blue-200 animate-stat-entrance">
              <div className="flex items-center gap-2 mb-2">
                <VideoIcon className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium text-muted-foreground">
                  {overviewMode === "cycle" ? "Videos This Cycle" : "Eligible Videos"}
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {overviewMode === "cycle" ? relevantCurrentCycleVideos.length : (allTimeStats?.totalVideos ?? eligibleVideos.length)}
              </p>
              <div className="flex flex-col space-y-1 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Instagram className="w-3 h-3 text-pink-500" />
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
            <div className="group bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525] p-4 sm:p-5 transition-all duration-300 hover:shadow-[0_6px_30px_rgba(0,0,0,0.14)] hover:-translate-y-1 hover:border-green-200 animate-stat-entrance-delay-1">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-green-500" />
                <span className="text-xs font-medium text-muted-foreground">
                  {overviewMode === "cycle" ? "Views This Cycle" : "Eligible Views"}
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {overviewMode === "cycle" 
                  ? formatNumber(relevantCurrentCycleVideos.reduce((sum, v) => sum + v.views, 0))
                  : formatNumber(allTimeStats?.totalViews ?? eligibleVideos.reduce((sum, v) => sum + v.views, 0))}
              </p>
              <div className="flex flex-col space-y-1 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Instagram className="w-3 h-3 text-pink-500" />
                  <span className="tabular-nums">
                    {overviewMode === "cycle" 
                      ? formatNumber(relevantIgVideos.reduce((sum, v) => sum + v.views, 0))
                      : formatNumber(allTimeStats?.igViews ?? eligibleIgVideos.reduce((sum, v) => sum + v.views, 0))}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <SiTiktok className="w-3 h-3" />
                  <span className="tabular-nums">
                    {overviewMode === "cycle" 
                      ? formatNumber(relevantTtVideos.reduce((sum, v) => sum + v.views, 0))
                      : formatNumber(allTimeStats?.tiktokViews ?? eligibleTtVideos.reduce((sum, v) => sum + v.views, 0))}
                  </span>
                </div>
              </div>
            </div>
            <div className="group bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525] p-4 sm:p-5 transition-all duration-300 hover:shadow-[0_6px_30px_rgba(0,0,0,0.14)] hover:-translate-y-1 hover:border-amber-200 animate-stat-entrance-delay-2">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium text-muted-foreground">
                  {overviewMode === "cycle" ? "Earnings This Cycle" : "Lifetime Earnings"}
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {overviewMode === "cycle"
                  ? formatCurrency(currentCycleEarnings)
                  : formatCurrency(totalPaidEarnings)}
              </p>
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
            <div className="group bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#252525] p-4 sm:p-5 transition-all duration-300 hover:shadow-[0_6px_30px_rgba(0,0,0,0.14)] hover:-translate-y-1 hover:border-cyan-200 animate-stat-entrance-delay-3">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-cyan-500" />
                <span className="text-xs font-medium text-muted-foreground">Total Following</span>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {formatNumber((user?.instagramFollowers || 0) + (user?.tiktokFollowers || 0))}
              </p>
              <div className="flex flex-col space-y-1 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Instagram className="w-3 h-3 text-pink-500" />
                  <span className="tabular-nums">{formatNumber(user?.instagramFollowers || 0)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <SiTiktok className="w-3 h-3" />
                  <span className="tabular-nums">{formatNumber(user?.tiktokFollowers || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Cycle Videos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 via-pink-500 to-orange-400 flex items-center justify-center">
                <VideoIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Current Cycle</CardTitle>
                <CardDescription>
                  {activeCycle && (
                    <span>
                      {formatUTCDate(activeCycle.startDate, "MMM d")} - {formatUTCDate(activeCycle.endDate, "MMM d, yyyy")} · 
                    </span>
                  )}
                  {" "}{currentCycleVideos.length} videos ({currentInstagramVideos.length} IG, {currentTiktokVideos.length} TT)
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentCycleVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <VideoIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No videos in current cycle</h3>
              <p className="text-muted-foreground max-w-sm">
                Connect your accounts and sync videos to see them here.
              </p>
            </div>
          ) : (
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
                  {buildPairedVideoRows(currentCycleVideos)
                    .sort((a, b) => b.date.getTime() - a.date.getTime())
                    .map((row) => {
                      const igVideo = row.ig as VideoWithPayInfo | null;
                      const ttVideo = row.tiktok as VideoWithPayInfo | null;
                      
                      const igIsWinner = row.winnerPlatform === "instagram";
                      const ttIsWinner = row.winnerPlatform === "tiktok";
                      const isPaired = !!igVideo && !!ttVideo;
                      
                      const igEligible = igVideo && !igVideo.isIrrelevant;
                      const ttEligible = ttVideo && !ttVideo.isIrrelevant;
                      
                      // Unpaired videos get $0 - only paired videos get paid
                      const totalBasePay = isPaired ? ((igEligible ? igVideo!.basePayPerVideo : 0) + (ttEligible ? ttVideo!.basePayPerVideo : 0)) : 0;
                      // Bonus only for winners from paired videos
                      const igPaysBonus = isPaired && igEligible && igIsWinner;
                      const ttPaysBonus = isPaired && ttEligible && ttIsWinner;
                      const totalBonus = (igPaysBonus ? getVideoBonus(igVideo!) : 0) + (ttPaysBonus ? getVideoBonus(ttVideo!) : 0);
                      const hasAnyEligible = isPaired && (igEligible || ttEligible);

                      return (
                        <TableRow key={row.id} className="align-top">
                          <TableCell className="font-mono text-sm pt-4">
                            <div className="flex flex-col gap-1">
                              {format(row.date, "MMM d, yyyy")}
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
                            {igVideo?.caption ? (
                              <div className="max-w-[100px]">
                                <span className="text-sm text-muted-foreground">
                                  {igVideo.caption.length > 30 ? igVideo.caption.slice(0, 30) + "..." : igVideo.caption}
                                </span>
                                {igVideo.caption.length > 30 && (
                                  <button
                                    onClick={() => {
                                      setSelectedCaption(igVideo.caption || "");
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
                            {renderVideoCard(igVideo, "instagram", igIsWinner, isPaired)}
                          </TableCell>
                          <TableCell className="pt-4">
                            {ttVideo?.caption ? (
                              <div className="max-w-[100px]">
                                <span className="text-sm text-muted-foreground">
                                  {ttVideo.caption.length > 30 ? ttVideo.caption.slice(0, 30) + "..." : ttVideo.caption}
                                </span>
                                {ttVideo.caption.length > 30 && (
                                  <button
                                    onClick={() => {
                                      setSelectedCaption(ttVideo.caption || "");
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
                            {renderVideoCard(ttVideo, "tiktok", ttIsWinner, isPaired)}
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
          )}
        </CardContent>
      </Card>

      {/* Pre-Cycle Videos - Collapsible */}
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
                        {preCycleVideos.length} videos posted before this cycle started ({preCycleInstagramVideos.length} IG, {preCycleTiktokVideos.length} TT)
                      </CardDescription>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${preCycleOpen ? "rotate-180" : ""}`} />
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
                            <SiInstagram className="w-4 h-4 text-pink-500" />
                            Instagram
                          </div>
                        </TableHead>
                        <TableHead className="w-28">TT Caption</TableHead>
                        <TableHead className="text-center w-36">
                          <div className="flex items-center justify-center gap-1">
                            <SiTiktok className="w-4 h-4" />
                            TikTok
                          </div>
                        </TableHead>
                        <TableHead className="text-right w-20">Base Pay</TableHead>
                        <TableHead className="text-right w-20">Bonus</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {buildPairedVideoRows(preCycleVideos)
                        .sort((a, b) => b.date.getTime() - a.date.getTime())
                        .map((row) => {
                          const igVideo = row.ig as VideoWithPayInfo | null;
                          const ttVideo = row.tiktok as VideoWithPayInfo | null;
                          
                          const igIsWinner = row.winnerPlatform === "instagram";
                          const ttIsWinner = row.winnerPlatform === "tiktok";
                          const isPaired = !!igVideo && !!ttVideo;
                          
                          const igEligible = igVideo && !igVideo.isIrrelevant;
                          const ttEligible = ttVideo && !ttVideo.isIrrelevant;
                          
                          const totalBasePay = isPaired ? ((igEligible ? igVideo!.basePayPerVideo : 0) + (ttEligible ? ttVideo!.basePayPerVideo : 0)) : 0;
                          const igPaysBonus = isPaired && igEligible && igIsWinner;
                          const ttPaysBonus = isPaired && ttEligible && ttIsWinner;
                          const totalBonus = (igPaysBonus ? getVideoBonus(igVideo!) : 0) + (ttPaysBonus ? getVideoBonus(ttVideo!) : 0);
                          const hasAnyEligible = isPaired && (igEligible || ttEligible);

                          return (
                            <TableRow key={row.id} className="align-top">
                              <TableCell className="font-mono text-sm pt-4">
                                <div className="flex flex-col gap-1">
                                  {format(row.date, "MMM d, yyyy")}
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
                                {igVideo?.caption ? (
                                  <div className="max-w-[100px]">
                                    <span className="text-sm text-muted-foreground">
                                      {igVideo.caption.length > 30 ? igVideo.caption.slice(0, 30) + "..." : igVideo.caption}
                                    </span>
                                    {igVideo.caption.length > 30 && (
                                      <button
                                        onClick={() => {
                                          setSelectedCaption(igVideo.caption || "");
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
                                {renderPastVideoCard(igVideo, "instagram")}
                              </TableCell>
                              <TableCell className="pt-4">
                                {ttVideo?.caption ? (
                                  <div className="max-w-[100px]">
                                    <span className="text-sm text-muted-foreground">
                                      {ttVideo.caption.length > 30 ? ttVideo.caption.slice(0, 30) + "..." : ttVideo.caption}
                                    </span>
                                    {ttVideo.caption.length > 30 && (
                                      <button
                                        onClick={() => {
                                          setSelectedCaption(ttVideo.caption || "");
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
                                {renderPastVideoCard(ttVideo, "tiktok")}
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
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Past Videos - Collapsible */}
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
                        {pastCycleVideos.length} videos from previous cycles ({pastInstagramVideos.length} IG, {pastTiktokVideos.length} TT)
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
                        <TableHead className="text-right w-20">Base Pay</TableHead>
                        <TableHead className="text-right w-20">Bonus</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {buildPairedVideoRows(pastCycleVideos)
                        .sort((a, b) => b.date.getTime() - a.date.getTime())
                        .map((row) => {
                          const igVideo = row.ig as VideoWithPayInfo | null;
                          const ttVideo = row.tiktok as VideoWithPayInfo | null;
                          
                          const igIsWinner = row.winnerPlatform === "instagram";
                          const ttIsWinner = row.winnerPlatform === "tiktok";
                          const isPaired = !!igVideo && !!ttVideo;
                          
                          const igEligible = igVideo && !igVideo.isIrrelevant;
                          const ttEligible = ttVideo && !ttVideo.isIrrelevant;
                          
                          // Unpaired videos get $0 - only paired videos get paid
                          const totalBasePay = isPaired ? ((igEligible ? igVideo!.basePayPerVideo : 0) + (ttEligible ? ttVideo!.basePayPerVideo : 0)) : 0;
                          // Bonus only for winners from paired videos
                          const igPaysBonus = isPaired && igEligible && igIsWinner;
                          const ttPaysBonus = isPaired && ttEligible && ttIsWinner;
                          const totalBonus = (igPaysBonus ? getVideoBonus(igVideo!) : 0) + (ttPaysBonus ? getVideoBonus(ttVideo!) : 0);
                          const hasAnyEligible = isPaired && (igEligible || ttEligible);

                          return (
                            <TableRow key={row.id} className="align-top">
                              <TableCell className="font-mono text-sm pt-4">
                                <div className="flex flex-col gap-1">
                                  {format(row.date, "MMM d, yyyy")}
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
                                {igVideo?.caption ? (
                                  <div className="max-w-[100px]">
                                    <span className="text-sm text-muted-foreground">
                                      {igVideo.caption.length > 30 ? igVideo.caption.slice(0, 30) + "..." : igVideo.caption}
                                    </span>
                                    {igVideo.caption.length > 30 && (
                                      <button
                                        onClick={() => {
                                          setSelectedCaption(igVideo.caption || "");
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
                                {renderPastVideoCard(igVideo, "instagram")}
                              </TableCell>
                              <TableCell className="pt-4">
                                {ttVideo?.caption ? (
                                  <div className="max-w-[100px]">
                                    <span className="text-sm text-muted-foreground">
                                      {ttVideo.caption.length > 30 ? ttVideo.caption.slice(0, 30) + "..." : ttVideo.caption}
                                    </span>
                                    {ttVideo.caption.length > 30 && (
                                      <button
                                        onClick={() => {
                                          setSelectedCaption(ttVideo.caption || "");
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
                                {renderPastVideoCard(ttVideo, "tiktok")}
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
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Caption Dialog */}
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
