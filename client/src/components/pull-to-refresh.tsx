import { useState, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

type PullToRefreshProps = {
  children: React.ReactNode;
  onRefresh?: () => Promise<void>;
  queryKeys?: (string | string[])[];
  disabled?: boolean;
  threshold?: number;
  maxPull?: number;
  className?: string;
};

export function PullToRefresh({
  children,
  onRefresh,
  queryKeys,
  disabled = false,
  threshold = 80,
  maxPull = 120,
  className = "",
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

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

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container || container.scrollTop !== 0) return;
    
    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    if (startY.current === 0) return;
    
    if (container.scrollTop > 0) {
      startY.current = 0;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }
    
    currentY.current = e.touches[0].clientY;
    const distance = currentY.current - startY.current;
    
    if (distance <= 0) {
      setPullDistance(0);
      setIsPulling(false);
      return;
    }
    
    const resistedDistance = Math.min(distance * 0.5, maxPull);
    
    setIsPulling(true);
    setPullDistance(resistedDistance);
    
    if (resistedDistance > 0) {
      e.preventDefault();
    }
  }, [disabled, isRefreshing, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshing || !isPulling) {
      startY.current = 0;
      return;
    }
    
    startY.current = 0;
    setIsPulling(false);
    
    if (pullDistance >= threshold) {
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
  }, [disabled, isRefreshing, isPulling, pullDistance, threshold, handleRefresh]);

  const getIndicatorText = () => {
    if (isRefreshing) return null;
    if (pullDistance >= threshold) return "Release to refresh";
    return "Pull to refresh";
  };

  const indicatorHeight = isRefreshing ? threshold : pullDistance;
  const showIndicator = indicatorHeight > 0;

  return (
    <div
      ref={containerRef}
      className={`h-full w-full overflow-y-auto overflow-x-hidden overscroll-none ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200 ease-out"
        style={{
          height: showIndicator ? `${indicatorHeight}px` : 0,
          opacity: showIndicator ? 1 : 0,
        }}
      >
        <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <div
                className="transition-transform duration-200"
                style={{
                  transform: pullDistance >= threshold ? "rotate(180deg)" : "rotate(0deg)",
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
              <span className="text-xs font-medium">{getIndicatorText()}</span>
            </>
          )}
        </div>
      </div>
      
      {children}
    </div>
  );
}
