import { useState, useRef, useCallback, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className = "" }: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  const PULL_THRESHOLD = 80;
  const MAX_PULL = 120;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0 && !isRefreshing) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      const distance = Math.min(diff * 0.5, MAX_PULL);
      setPullDistance(distance);
    }
  }, [isPulling, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      
      try {
        await onRefresh();
      } catch (error) {
        console.error("Refresh failed:", error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    
    setIsPulling(false);
    startY.current = 0;
    currentY.current = 0;
  }, [isPulling, pullDistance, isRefreshing, onRefresh]);

  const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center overflow-hidden transition-all duration-200 ease-out"
        style={{
          height: pullDistance,
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          className={`flex items-center justify-center rounded-full bg-primary/10 p-2 transition-transform ${
            isRefreshing ? "animate-spin" : ""
          }`}
          style={{
            transform: `rotate(${pullProgress * 360}deg)`,
            opacity: pullProgress,
          }}
        >
          <RefreshCw className="h-5 w-5 text-primary" />
        </div>
      </div>

      {/* Content wrapper */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: `translateY(${pullDistance}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
