import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

type PullToRefreshProps = {
  children: React.ReactNode;
  onRefresh?: () => Promise<void>;
  queryKeys?: (string | string[])[];
  disabled?: boolean;
  threshold?: number;
  className?: string;
};

export function PullToRefresh({
  children,
  onRefresh,
  queryKeys,
  disabled = false,
  threshold = 60,
  className = "",
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const canPull = useRef(false);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      await onRefresh();
    } else if (queryKeys && queryKeys.length > 0) {
      await Promise.all(
        queryKeys.map((key) => 
          queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] })
        )
      );
    }
  }, [onRefresh, queryKeys]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      
      const scrollTop = container.scrollTop;
      if (scrollTop <= 1) {
        startY.current = e.touches[0].clientY;
        canPull.current = true;
      } else {
        canPull.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (disabled || isRefreshing || !canPull.current) return;
      
      const scrollTop = container.scrollTop;
      if (scrollTop > 1) {
        canPull.current = false;
        if (isPulling.current) {
          setPullDistance(0);
          isPulling.current = false;
        }
        return;
      }
      
      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;
      
      if (distance <= 0) {
        if (isPulling.current) {
          setPullDistance(0);
          isPulling.current = false;
        }
        return;
      }
      
      const dampedDistance = Math.min(distance * 0.4, threshold * 1.5);
      
      if (dampedDistance > 5) {
        isPulling.current = true;
        setPullDistance(dampedDistance);
        e.preventDefault();
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current) {
        startY.current = 0;
        canPull.current = false;
        return;
      }
      
      const finalDistance = pullDistance;
      isPulling.current = false;
      canPull.current = false;
      startY.current = 0;
      
      if (finalDistance >= threshold) {
        setIsRefreshing(true);
        setPullDistance(threshold);
        
        try {
          await handleRefresh();
        } catch (error) {
          console.error("Pull to refresh error:", error);
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [disabled, isRefreshing, pullDistance, threshold, handleRefresh]);

  const showIndicator = pullDistance > 0 || isRefreshing;
  const indicatorProgress = Math.min(pullDistance / threshold, 1);
  const isReady = pullDistance >= threshold;

  return (
    <div
      ref={containerRef}
      className={`h-full w-full overflow-y-auto overflow-x-hidden ${className}`}
      style={{ 
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "none"
      }}
    >
      <div
        className="flex items-center justify-center overflow-hidden bg-muted/30"
        style={{
          height: showIndicator ? `${Math.max(pullDistance, isRefreshing ? threshold : 0)}px` : 0,
          transition: isPulling.current ? "none" : "height 0.2s ease-out",
        }}
      >
        <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground py-2">
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 animate-spin" data-testid="refresh-spinner" />
          ) : (
            <>
              <div
                style={{
                  transform: `rotate(${isReady ? 180 : indicatorProgress * 180}deg)`,
                  transition: "transform 0.15s ease-out",
                }}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </div>
              <span className="text-xs font-medium">
                {isReady ? "Release to refresh" : "Pull to refresh"}
              </span>
            </>
          )}
        </div>
      </div>
      
      <div ref={contentRef}>
        {children}
      </div>
    </div>
  );
}
