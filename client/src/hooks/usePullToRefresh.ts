import { useState, useRef, useCallback, useEffect } from "react";
import { isNative } from "@/lib/config";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

interface UsePullToRefreshResult {
  isRefreshing: boolean;
  pullProgress: number;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: () => void;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  
  const startY = useRef(0);
  const currentY = useRef(0);
  const isPulling = useRef(false);
  const scrollableRef = useRef<HTMLElement | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const touch = e.touches[0];
    startY.current = touch.clientY;
    currentY.current = touch.clientY;
    
    const target = e.target as HTMLElement;
    scrollableRef.current = target.closest('[data-scroll-container]') || 
                            target.closest('main') || 
                            document.scrollingElement as HTMLElement;
    
    const scrollTop = scrollableRef.current?.scrollTop ?? window.scrollY;
    isPulling.current = scrollTop <= 0;
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing || !isPulling.current) return;
    
    const touch = e.touches[0];
    currentY.current = touch.clientY;
    
    const scrollTop = scrollableRef.current?.scrollTop ?? window.scrollY;
    if (scrollTop > 0) {
      isPulling.current = false;
      setPullProgress(0);
      return;
    }
    
    const pullDistance = currentY.current - startY.current;
    
    if (pullDistance > 0) {
      const progress = Math.min(pullDistance / threshold, 1.5);
      setPullProgress(progress);
    } else {
      setPullProgress(0);
    }
  }, [disabled, isRefreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshing) return;
    
    const pullDistance = currentY.current - startY.current;
    
    if (isPulling.current && pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullProgress(1);
      
      try {
        await onRefresh();
      } catch (error) {
        console.error("[PullToRefresh] Refresh error:", error);
      } finally {
        setIsRefreshing(false);
        setPullProgress(0);
      }
    } else {
      setPullProgress(0);
    }
    
    isPulling.current = false;
  }, [disabled, isRefreshing, threshold, onRefresh]);

  return {
    isRefreshing,
    pullProgress,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
