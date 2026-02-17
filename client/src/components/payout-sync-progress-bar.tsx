import { usePayoutSync } from "@/lib/payout-sync";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

export function PayoutSyncProgressBar() {
  const { isSyncing, progress, syncPhase, syncProgressData } = usePayoutSync();

  if (!isSyncing) return null;

  return (
    <div className="w-full bg-muted/50 border-b p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-2">
          <div className="flex-1">
            <Progress value={progress} className="h-2" />
          </div>
          <div className="text-sm font-mono text-muted-foreground min-w-[60px] text-right">
            {progress}%
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {syncPhase === "unfreeze" && (
            <span className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Unfreezing payout cycle...
            </span>
          )}
          {syncPhase === "sync" && (
            <span className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Syncing {syncProgressData.creatorName} ({syncProgressData.current}/{syncProgressData.total} creators) — updating views...
            </span>
          )}
          {syncPhase === "recalculate" && (
            <span className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Recalculating payouts for all creators...
            </span>
          )}
          {syncPhase === "freeze" && (
            <span className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Freezing payout cycle with updated data...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
