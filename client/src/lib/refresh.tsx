import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RefreshContextType {
  isRefreshing: boolean;
  progress: number;
  quote: string;
  startRefresh: () => Promise<void>;
  lastRefreshedAt: Date | null;
}

const RefreshContext = createContext<RefreshContextType | undefined>(undefined);

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

function getQuoteForProgress(progress: number): string {
  if (progress < 35) return QUOTES[0];
  if (progress < 55) return QUOTES[1];
  if (progress < 70) return QUOTES[2];
  return QUOTES[3];
}

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [quote, setQuote] = useState(QUOTES[0]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const { toast } = useToast();
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  const isCompletingRef = useRef(false);

  const animateProgress = useCallback(() => {
    if (!isRefreshing || isCompletingRef.current) return;

    const elapsed = Date.now() - startTimeRef.current;
    
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
    setProgress(targetProgress);
    setQuote(getQuoteForProgress(targetProgress));

    animationFrameRef.current = requestAnimationFrame(animateProgress);
  }, [isRefreshing]);

  useEffect(() => {
    if (isRefreshing && !isCompletingRef.current) {
      animationFrameRef.current = requestAnimationFrame(animateProgress);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRefreshing, animateProgress]);

  const startRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setProgress(0);
    setQuote(QUOTES[0]);
    startTimeRef.current = Date.now();
    isCompletingRef.current = false;

    try {
      const data = await apiRequest("POST", "/api/creator/refresh-engagement") as { 
        instagram: number; 
        tiktok: number; 
        remainingRefreshes?: number;
        refreshesRemaining?: number;
      };

      isCompletingRef.current = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      setProgress(100);
      
      await new Promise(resolve => setTimeout(resolve, 500));

      queryClient.invalidateQueries({ queryKey: ["/api/creator/videos-with-cycle"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/refresh-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/detail"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/todays-posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/top-videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/daily-views"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/celebrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/posting-streak"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/team-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/cycle-leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/team-members"] });

      toast({
        title: "Engagement refreshed",
        description: `Updated ${data.instagram} Instagram, ${data.tiktok} TikTok videos. ${data.remainingRefreshes || data.refreshesRemaining} refreshes left today.`,
      });
      
      setLastRefreshedAt(new Date());
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: ["/api/creator/refresh-status"] });
      toast({
        title: "Refresh failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
      setProgress(0);
      isCompletingRef.current = false;
    }
  }, [isRefreshing, toast]);

  return (
    <RefreshContext.Provider value={{ isRefreshing, progress, quote, startRefresh, lastRefreshedAt }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  const context = useContext(RefreshContext);
  if (context === undefined) {
    throw new Error("useRefresh must be used within a RefreshProvider");
  }
  return context;
}
