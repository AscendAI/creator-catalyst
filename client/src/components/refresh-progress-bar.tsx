import { useRefresh } from "@/lib/refresh";
import { Progress } from "@/components/ui/progress";

interface RefreshProgressBarProps {
  inline?: boolean;
  isActive?: boolean;
  progressValue?: number;
  quoteText?: string;
}

export function RefreshProgressBar({ inline = false, isActive, progressValue, quoteText }: RefreshProgressBarProps) {
  const refresh = useRefresh();
  
  const isRefreshing = isActive !== undefined ? isActive : refresh.isRefreshing;
  const progress = progressValue !== undefined ? progressValue : refresh.progress;
  const quote = quoteText !== undefined ? quoteText : refresh.quote;

  if (!isRefreshing) return null;

  if (inline) {
    return (
      <div className="w-full bg-muted/50 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Progress value={progress} className="h-2" />
          </div>
          <div className="text-sm text-muted-foreground min-w-[240px] text-right">
            {Math.round(progress)}% - {quote}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-muted/50 border-b">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Progress value={progress} className="h-2" />
          </div>
          <div className="text-sm text-muted-foreground min-w-[240px] text-right">
            {Math.round(progress)}% - {quote}
          </div>
        </div>
      </div>
    </div>
  );
}
