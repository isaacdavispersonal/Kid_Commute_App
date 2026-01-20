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
  const touchStartY = useRef(0);
  const touchStartScrollTop = useRef(0);

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

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing || isDialogOpen()) return;
      
      const scrollTop = container.scrollTop;
      if (scrollTop > 5) return;
      
      touchStartY.current = e.touches[0].clientY;
      touchStartScrollTop.current = scrollTop;
      setIsPulling(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing || isDialogOpen()) return;
      
      const scrollTop = container.scrollTop;
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
      if (!isPulling) return;
      
      setIsPulling(false);
      
      if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
        await onRefresh();
      }
      
      setPullDistance(0);
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [scrollContainerRef, isPulling, pullDistance, isRefreshing, onRefresh, disabled, isDialogOpen]);

  const showIndicator = pullDistance > 0 || isRefreshing;
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const rotation = progress * 180;
  
  // Calculate translateY based on pull distance or fixed position when refreshing
  const translateY = isRefreshing ? 16 : Math.max(pullDistance - 40, -40);

  if (!showIndicator) return null;

  return (
    <div 
      className="fixed left-0 right-0 top-0 z-[100] flex items-start justify-center pointer-events-none"
      style={{ 
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4.5rem + 1rem)'
      }}
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
