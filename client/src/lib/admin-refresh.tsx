import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

interface AdminRefreshContextType {
  isRefreshing: boolean;
  progress: number;
  syncProgress: { current: number; total: number; failed: number };
  startRefresh: () => Promise<void>;
}

const AdminRefreshContext = createContext<AdminRefreshContextType | undefined>(undefined);

export function AdminRefreshProvider({ children }: { children: ReactNode }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, failed: 0 });
  const { toast } = useToast();
  const { token } = useAuth();
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const currentProgressRef = useRef(0);

  const stopAnimation = useCallback(() => {
    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const startProgressAnimation = useCallback((fromProgress: number, toProgress: number) => {
    stopAnimation();
    currentProgressRef.current = fromProgress;
    
    animationRef.current = setInterval(() => {
      if (currentProgressRef.current < toProgress - 2) {
        currentProgressRef.current += 1;
        setProgress(currentProgressRef.current);
      }
    }, 150);
  }, [stopAnimation]);

  const startRefresh = useCallback(async () => {
    if (isRefreshing || !token) return;

    try {
      const response = await fetch(`/api/admin/creators?status=active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        toast({
          title: "Failed to fetch creators",
          description: "Could not get the list of creators to sync.",
          variant: "destructive",
        });
        return;
      }
      const allCreators = await response.json();
      const activeCreators = allCreators.filter((c: any) => !c.isPaused && !c.isDeleted);
      
      if (activeCreators.length === 0) {
        toast({
          title: "No creators to sync",
          description: "There are no active creators to refresh.",
        });
        return;
      }

      setIsRefreshing(true);
      setProgress(0);
      currentProgressRef.current = 0;
      setSyncProgress({ current: 0, total: activeCreators.length, failed: 0 });
      
      // Capture dashboard snapshot before bulk refresh
      try {
        const dashboardResponse = await fetch('/api/admin/dashboard-stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (dashboardResponse.ok) {
          const dashboardStats = await dashboardResponse.json();
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
        }
      } catch (e) {
        console.error('Failed to capture dashboard snapshot:', e);
      }

      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < activeCreators.length; i++) {
        const creator = activeCreators[i];
        const currentMilestone = Math.round((i / activeCreators.length) * 100);
        const nextMilestone = Math.round(((i + 1) / activeCreators.length) * 100);
        
        startProgressAnimation(currentMilestone, nextMilestone);
        
        try {
          const syncResponse = await fetch(`/api/admin/sync/creator/${creator.id}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (syncResponse.ok) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          failedCount++;
        }
        
        stopAnimation();
        setProgress(nextMilestone);
        currentProgressRef.current = nextMilestone;
        setSyncProgress({ current: i + 1, total: activeCreators.length, failed: failedCount });
      }

      // Mark bulk refresh complete - this updates the lastBulkRefreshAt timestamp
      try {
        const bulkCompleteResponse = await fetch('/api/sync/bulk-complete', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!bulkCompleteResponse.ok) {
          console.error('Failed to mark bulk refresh complete:', await bulkCompleteResponse.text());
        }
      } catch (e) {
        console.error('Failed to mark bulk refresh complete:', e);
      }

      // Calculate and store dashboard changes after bulk refresh
      try {
        const dashboardResponse = await fetch('/api/admin/dashboard-stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (dashboardResponse.ok) {
          const dashboardStats = await dashboardResponse.json();
          const currentCycle = dashboardStats?.currentCycle;
          const followers = dashboardStats?.followers;
          
          if (currentCycle && followers) {
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
        console.error('Failed to calculate dashboard changes:', e);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/todays-posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/top-videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/daily-views"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/celebrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/team-posting-streak"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cycle-leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/streak-survivor/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bounties"] });

      if (failedCount > 0) {
        toast({
          title: "Engagement refresh complete",
          description: `Synced ${successCount} of ${activeCreators.length} creators. ${failedCount} failed.`,
          variant: failedCount === activeCreators.length ? "destructive" : "default",
        });
      } else {
        toast({
          title: "Engagement refresh complete",
          description: `Successfully synced all ${successCount} creators.`,
        });
      }
    } catch (error) {
      // Clear dashboard snapshot on failure to prevent stale deltas
      localStorage.removeItem('dashboardPreRefreshSnapshot');
      toast({
        title: "Sync failed",
        description: "An unexpected error occurred during sync.",
        variant: "destructive",
      });
    } finally {
      stopAnimation();
      setIsRefreshing(false);
      setProgress(0);
      currentProgressRef.current = 0;
      setSyncProgress({ current: 0, total: 0, failed: 0 });
    }
  }, [isRefreshing, token, toast, startProgressAnimation, stopAnimation]);

  return (
    <AdminRefreshContext.Provider value={{ isRefreshing, progress, syncProgress, startRefresh }}>
      {children}
    </AdminRefreshContext.Provider>
  );
}

export function useAdminRefresh() {
  const context = useContext(AdminRefreshContext);
  if (context === undefined) {
    throw new Error("useAdminRefresh must be used within an AdminRefreshProvider");
  }
  return context;
}
