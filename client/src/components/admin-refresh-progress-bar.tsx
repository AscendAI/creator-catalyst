import { useAdminRefresh } from "@/lib/admin-refresh";
import { Progress } from "@/components/ui/progress";

export function AdminRefreshProgressBar() {
  const { isRefreshing, progress, syncProgress } = useAdminRefresh();

  if (!isRefreshing) return null;

  return (
    <div className="w-full bg-muted/50 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Progress value={progress} className="h-2" />
        </div>
        <div className="text-sm text-muted-foreground min-w-[180px] text-right">
          {syncProgress.total > 0 
            ? `${progress}% - Syncing ${syncProgress.current}/${syncProgress.total} creators`
            : "Starting..."}
        </div>
      </div>
    </div>
  );
}
