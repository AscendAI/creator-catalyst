import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

interface PayoutSyncContextType {
  isSyncing: boolean;
  progress: number;
  syncPhase: "unfreeze" | "sync" | "recalculate" | "freeze" | null;
  syncProgressData: { current: number; total: number; creatorName: string };
  startSyncAndRecalculate: (cycleId: string) => Promise<void>;
}

const PayoutSyncContext = createContext<PayoutSyncContextType | undefined>(undefined);

export function PayoutSyncProvider({ children }: { children: ReactNode }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncPhase, setSyncPhase] = useState<"unfreeze" | "sync" | "recalculate" | "freeze" | null>(null);
  const [syncProgressData, setSyncProgressData] = useState({ current: 0, total: 0, creatorName: "" });
  const [progress, setProgress] = useState(0);
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

  const startProgressAnimation = useCallback((from: number, to: number) => {
    stopAnimation();
    currentProgressRef.current = from;
    animationRef.current = setInterval(() => {
      if (currentProgressRef.current < to - 2) {
        currentProgressRef.current += 1;
        setProgress(currentProgressRef.current);
      }
    }, 150);
  }, [stopAnimation]);

  const startSyncAndRecalculate = useCallback(async (cycleId: string) => {
    if (isSyncing || !token) return;
    setIsSyncing(true);
    setProgress(0);
    currentProgressRef.current = 0;

    try {
      setSyncPhase("unfreeze");
      startProgressAnimation(0, 5);
      await new Promise((r) => setTimeout(r, 800));
      stopAnimation();
      setProgress(5);
      currentProgressRef.current = 5;

      const creatorsRes = await fetch(`/api/admin/creators?status=active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!creatorsRes.ok) throw new Error("Failed to fetch creators");
      const allCreators = await creatorsRes.json();
      const activeCreators = allCreators.filter((c: any) => !c.isPaused && !c.isDeleted);

      if (activeCreators.length === 0) {
        setSyncPhase("recalculate");
        startProgressAnimation(5, 90);
        await apiRequest("POST", `/api/admin/cycles/${cycleId}/refresh`);
        stopAnimation();
        setProgress(90);
        currentProgressRef.current = 90;

        setSyncPhase("freeze");
        startProgressAnimation(90, 100);
        await new Promise((r) => setTimeout(r, 600));
        stopAnimation();
        setProgress(100);

        queryClient.invalidateQueries({ queryKey: ["/api/admin/cycles"] });
        toast({
          title: "Recalculation complete",
          description: "No active creators to sync. Payouts recalculated with existing data.",
        });
        return;
      }

      setSyncPhase("sync");
      const syncStart = 5;
      const syncEnd = 75;
      const syncRange = syncEnd - syncStart;
      let failedCount = 0;

      for (let i = 0; i < activeCreators.length; i++) {
        const creator = activeCreators[i];
        const creatorProgress = syncStart + Math.round((i / activeCreators.length) * syncRange);
        const nextProgress = syncStart + Math.round(((i + 1) / activeCreators.length) * syncRange);

        setSyncProgressData({ current: i + 1, total: activeCreators.length, creatorName: creator.name || creator.email });
        startProgressAnimation(creatorProgress, nextProgress);

        try {
          const syncRes = await fetch(`/api/admin/sync/creator/${creator.id}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!syncRes.ok) failedCount++;
        } catch {
          failedCount++;
        }

        stopAnimation();
        setProgress(nextProgress);
        currentProgressRef.current = nextProgress;
      }

      setSyncPhase("recalculate");
      startProgressAnimation(75, 90);

      await apiRequest("POST", `/api/admin/cycles/${cycleId}/refresh`);

      stopAnimation();
      setProgress(90);
      currentProgressRef.current = 90;

      setSyncPhase("freeze");
      startProgressAnimation(90, 100);
      await new Promise((r) => setTimeout(r, 600));
      stopAnimation();
      setProgress(100);

      queryClient.invalidateQueries({ queryKey: ["/api/admin/cycles"] });

      toast({
        title: "Sync & Recalculate complete",
        description: failedCount > 0
          ? `Synced ${activeCreators.length - failedCount} of ${activeCreators.length} creators. ${failedCount} failed.`
          : `Successfully synced all ${activeCreators.length} creators and recalculated payouts.`,
        variant: failedCount === activeCreators.length ? "destructive" : "default",
      });
    } catch (error) {
      toast({
        title: "Sync & Recalculate failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      stopAnimation();
      setIsSyncing(false);
      setSyncPhase(null);
      setProgress(0);
      currentProgressRef.current = 0;
      setSyncProgressData({ current: 0, total: 0, creatorName: "" });
    }
  }, [isSyncing, token, toast, startProgressAnimation, stopAnimation]);

  return (
    <PayoutSyncContext.Provider value={{ isSyncing, progress, syncPhase, syncProgressData, startSyncAndRecalculate }}>
      {children}
    </PayoutSyncContext.Provider>
  );
}

export function usePayoutSync() {
  const context = useContext(PayoutSyncContext);
  if (context === undefined) {
    throw new Error("usePayoutSync must be used within a PayoutSyncProvider");
  }
  return context;
}
