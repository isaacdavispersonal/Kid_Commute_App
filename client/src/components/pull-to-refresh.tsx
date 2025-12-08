import { useQueryClient } from "@tanstack/react-query";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { isNative } from "@/lib/config";
import { Loader2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  children: React.ReactNode;
  queryKeys?: string[][];
  onRefresh?: () => Promise<void>;
  className?: string;
}

export function PullToRefresh({ 
  children, 
  queryKeys = [],
  onRefresh,
  className 
}: PullToRefreshProps) {
  const queryClient = useQueryClient();
  
  const handleRefresh = async () => {
    if (onRefresh) {
      await onRefresh();
    } else if (queryKeys.length > 0) {
      await Promise.all(
        queryKeys.map(key => queryClient.invalidateQueries({ queryKey: key }))
      );
    } else {
      await queryClient.invalidateQueries();
    }
  };

  const {
    isRefreshing,
    pullProgress,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    disabled: !isNative,
  });

  if (!isNative) {
    return <>{children}</>;
  }

  const indicatorOpacity = Math.min(pullProgress, 1);
  const indicatorScale = 0.5 + (Math.min(pullProgress, 1) * 0.5);
  const indicatorTranslate = Math.min(pullProgress * 60, 60);

  return (
    <div
      className={cn("relative", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      data-scroll-container
    >
      <div 
        className="absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center justify-center"
        style={{
          top: -40 + indicatorTranslate,
          opacity: indicatorOpacity,
          transform: `translateX(-50%) scale(${indicatorScale})`,
          transition: isRefreshing ? 'none' : 'opacity 0.15s, transform 0.15s',
        }}
      >
        <div className="bg-card border border-border rounded-full p-2 shadow-lg">
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <ArrowDown 
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                pullProgress >= 1 && "text-primary rotate-180"
              )}
            />
          )}
        </div>
      </div>
      
      <div 
        style={{
          transform: isRefreshing ? 'translateY(20px)' : `translateY(${Math.min(pullProgress * 20, 20)}px)`,
          transition: isRefreshing ? 'transform 0.2s' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
