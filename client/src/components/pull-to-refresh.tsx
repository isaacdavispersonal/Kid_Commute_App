import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  scrollContainerRef: React.RefObject<HTMLElement>;
  disabled?: boolean;
}

export function PullToRefresh({ 
  onRefresh, 
  isRefreshing, 
  scrollContainerRef,
  disabled = false 
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  
  // Use refs for mutable state accessed by event handlers
  // This prevents re-attaching listeners on every state change
  const isPullingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const touchStartY = useRef(0);
  const touchStartScrollTop = useRef(0);
  const listenersAttachedRef = useRef(false);
  
  // Store callbacks in refs to avoid stale closures
  const onRefreshRef = useRef(onRefresh);
  const isRefreshingRef = useRef(isRefreshing);
  
  // Keep refs in sync with props/state
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);
  
  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);
  
  // Sync ref with state for handlers
  useEffect(() => {
    isPullingRef.current = isPulling;
  }, [isPulling]);
  
  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  const PULL_THRESHOLD = 80;
  const MAX_PULL = 120;

  const isDialogOpen = useCallback(() => {
    const openOverlays = document.querySelectorAll(
      '[data-state="open"][role="dialog"], ' +
      '[data-state="open"][role="alertdialog"], ' +
      '[data-radix-dialog-overlay], ' +
      '[data-radix-alert-dialog-overlay], ' +
      '.fixed.inset-0[role="dialog"], ' +
      '[data-slot="sheet-overlay"]'
    );
    return openOverlays.length > 0;
  }, []);
  
  // Reset state when dialog opens mid-pull
  useEffect(() => {
    if (disabled) {
      setIsPulling(false);
      setPullDistance(0);
    }
  }, [disabled]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    
    // Define handlers outside conditional so cleanup can always reference them
    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current || isDialogOpen()) {
        // Reset state if dialog opened
        if (isPullingRef.current) {
          setIsPulling(false);
          setPullDistance(0);
        }
        return;
      }
      
      const scrollTop = container?.scrollTop ?? 0;
      if (scrollTop > 5) return;
      
      touchStartY.current = e.touches[0].clientY;
      touchStartScrollTop.current = scrollTop;
      setIsPulling(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Check for dialog opening mid-gesture
      if (isDialogOpen()) {
        if (isPullingRef.current) {
          setIsPulling(false);
          setPullDistance(0);
        }
        return;
      }
      
      if (!isPullingRef.current || isRefreshingRef.current) return;
      
      const scrollTop = container?.scrollTop ?? 0;
      if (scrollTop > 5) {
        setIsPulling(false);
        setPullDistance(0);
        return;
      }

      const touchY = e.touches[0].clientY;
      const deltaY = touchY - touchStartY.current;
      
      if (deltaY > 0) {
        const resistance = 0.4;
        const distance = Math.min(deltaY * resistance, MAX_PULL);
        setPullDistance(distance);
        
        if (distance > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isPullingRef.current) return;
      
      const currentPullDistance = pullDistanceRef.current;
      const currentIsRefreshing = isRefreshingRef.current;
      
      setIsPulling(false);
      
      if (currentPullDistance >= PULL_THRESHOLD && !currentIsRefreshing) {
        await onRefreshRef.current();
      }
      
      setPullDistance(0);
    };
    
    // Cleanup function - always runs, removes listeners unconditionally
    const cleanup = () => {
      if (container && listenersAttachedRef.current) {
        container.removeEventListener("touchstart", handleTouchStart);
        container.removeEventListener("touchmove", handleTouchMove);
        container.removeEventListener("touchend", handleTouchEnd);
        listenersAttachedRef.current = false;
      }
    };
    
    // Skip attaching if disabled or no container
    if (!container || disabled) {
      // Reset state when becoming disabled
      if (isPullingRef.current) {
        setIsPulling(false);
        setPullDistance(0);
      }
      return cleanup;
    }

    // Attach listeners
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    listenersAttachedRef.current = true;

    return cleanup;
  }, [scrollContainerRef, disabled, isDialogOpen]);

  const showIndicator = pullDistance > 0 || isRefreshing;
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const rotation = progress * 180;
  
  // Calculate translateY based on pull distance or fixed position when refreshing
  const translateY = isRefreshing ? 16 : Math.max(pullDistance - 40, -40);

  if (!showIndicator) return null;

  return (
    <div 
      className="absolute left-0 right-0 top-0 z-[100] flex items-start justify-center pointer-events-none"
    >
      <div 
        className={cn(
          "flex items-center justify-center rounded-full bg-background border shadow-lg transition-all duration-200",
          isRefreshing ? "w-10 h-10" : "w-8 h-8"
        )}
        style={{ 
          transform: `translateY(${translateY}px) rotate(${isRefreshing ? 0 : rotation}deg)`,
          opacity: isRefreshing ? 1 : Math.max(0.3, progress)
        }}
      >
        <Loader2 
          className={cn(
            "text-primary",
            isRefreshing ? "h-5 w-5 animate-spin" : "h-4 w-4"
          )} 
        />
      </div>
    </div>
  );
}
