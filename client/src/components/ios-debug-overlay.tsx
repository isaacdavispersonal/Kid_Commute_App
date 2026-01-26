import { useState, useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { X, Bug, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DebugInfo {
  platform: string;
  isNative: boolean;
  currentLayout: "Auth" | "App" | "Loading";
  paddingTop: string;
  safeAreaTop: string;
  safeAreaBottom: string;
  windowHeight: number;
  windowWidth: number;
  visualViewportHeight: number | null;
  visualViewportOffsetTop: number | null;
  bodyScrollHeight: number;
  documentHeight: number;
  statusBarOverlay: string;
  timestamp: string;
}

interface IOSDebugOverlayProps {
  currentLayout: "Auth" | "App" | "Loading";
  isAuthenticated: boolean;
}

export function IOSDebugOverlay({ currentLayout, isAuthenticated }: IOSDebugOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevAuthRef = useRef(isAuthenticated);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  }, []);

  const collectDebugInfo = useCallback((): DebugInfo => {
    const computedStyle = getComputedStyle(document.documentElement);
    const rootContainer = document.getElementById("app-root") || document.body;
    const rootComputedStyle = getComputedStyle(rootContainer);
    
    const safeAreaTop = computedStyle.getPropertyValue("--sat").trim() ||
      computedStyle.getPropertyValue("env(safe-area-inset-top)").trim() ||
      "not set";
    
    const safeAreaBottom = computedStyle.getPropertyValue("--sab").trim() ||
      computedStyle.getPropertyValue("env(safe-area-inset-bottom)").trim() ||
      "not set";

    return {
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform(),
      currentLayout,
      paddingTop: rootComputedStyle.paddingTop || "0px",
      safeAreaTop,
      safeAreaBottom,
      windowHeight: window.innerHeight,
      windowWidth: window.innerWidth,
      visualViewportHeight: window.visualViewport?.height ?? null,
      visualViewportOffsetTop: window.visualViewport?.offsetTop ?? null,
      bodyScrollHeight: document.body.scrollHeight,
      documentHeight: document.documentElement.scrollHeight,
      statusBarOverlay: "checking...",
      timestamp: new Date().toISOString(),
    };
  }, [currentLayout]);

  const refreshDebugInfo = useCallback(() => {
    const info = collectDebugInfo();
    setDebugInfo(info);
    addLog("Debug info refreshed");
  }, [collectDebugInfo, addLog]);

  const applyLayoutFix = useCallback(async () => {
    addLog("Applying manual layout fix...");
    
    if (Capacitor.getPlatform() === "ios") {
      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: Style.Dark });
        addLog("StatusBar overlay: true, style: Dark");
      } catch (e) {
        addLog(`StatusBar error: ${e}`);
      }
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
        window.scrollTo(0, 0);
        addLog("Viewport recalculation triggered");
        refreshDebugInfo();
      });
    });
  }, [addLog, refreshDebugInfo]);

  useEffect(() => {
    if (prevAuthRef.current !== isAuthenticated && isAuthenticated) {
      addLog(`Auth transition detected: ${prevAuthRef.current} -> ${isAuthenticated}`);
      addLog("Layout should be: App");
      
      setTimeout(() => {
        refreshDebugInfo();
        const info = collectDebugInfo();
        const paddingNum = parseInt(info.paddingTop) || 0;
        const safeAreaNum = parseInt(info.safeAreaTop) || 0;
        
        if (paddingNum > 0 && safeAreaNum > 0 && paddingNum >= safeAreaNum * 1.8) {
          addLog(`WARNING: Possible doubled padding! padding=${paddingNum}px, safeArea=${safeAreaNum}px`);
        }
      }, 500);
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, addLog, refreshDebugInfo, collectDebugInfo]);

  const handleTripleTap = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 3) return;
    
    tapCountRef.current++;
    
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
    }
    
    if (tapCountRef.current >= 1) {
      setIsVisible(prev => !prev);
      if (!isVisible) {
        refreshDebugInfo();
      }
      tapCountRef.current = 0;
    } else {
      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, 500);
    }
  }, [isVisible, refreshDebugInfo]);

  useEffect(() => {
    document.addEventListener("touchstart", handleTripleTap);
    return () => {
      document.removeEventListener("touchstart", handleTripleTap);
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
      }
    };
  }, [handleTripleTap]);

  useEffect(() => {
    if (isVisible) {
      refreshDebugInfo();
    }
  }, [isVisible, refreshDebugInfo]);

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/90 text-white overflow-auto p-4"
      style={{ paddingTop: "env(safe-area-inset-top, 20px)" }}
      data-testid="ios-debug-overlay"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-yellow-400" />
          <h2 className="text-lg font-bold">iOS Debug Overlay</h2>
        </div>
        <div className="flex gap-2">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={applyLayoutFix}
            className="text-white hover:bg-white/20"
            data-testid="button-apply-layout-fix"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => setIsVisible(false)}
            className="text-white hover:bg-white/20"
            data-testid="button-close-debug"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="text-xs text-yellow-300 mb-4">
        Three-finger tap to toggle this overlay
      </div>

      {debugInfo && (
        <div className="space-y-4">
          <section className="bg-white/10 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-yellow-400 mb-2">Platform Info</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Platform:</div>
              <div className="font-mono">{debugInfo.platform}</div>
              <div>Native:</div>
              <div className="font-mono">{debugInfo.isNative ? "Yes" : "No"}</div>
              <div>Current Layout:</div>
              <div className={`font-mono ${debugInfo.currentLayout === "App" ? "text-green-400" : "text-orange-400"}`}>
                {debugInfo.currentLayout}
              </div>
            </div>
          </section>

          <section className="bg-white/10 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-yellow-400 mb-2">Safe Area & Padding</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Padding Top:</div>
              <div className="font-mono text-cyan-300">{debugInfo.paddingTop}</div>
              <div>Safe Area Top:</div>
              <div className="font-mono text-cyan-300">{debugInfo.safeAreaTop}</div>
              <div>Safe Area Bottom:</div>
              <div className="font-mono text-cyan-300">{debugInfo.safeAreaBottom}</div>
            </div>
            {(() => {
              const paddingNum = parseInt(debugInfo.paddingTop) || 0;
              const safeAreaNum = parseInt(debugInfo.safeAreaTop) || 0;
              if (paddingNum > 0 && safeAreaNum > 0 && paddingNum >= safeAreaNum * 1.8) {
                return (
                  <div className="mt-2 p-2 bg-red-500/30 rounded text-xs text-red-300">
                    Possible doubled padding detected! This may cause the white bar issue.
                  </div>
                );
              }
              return null;
            })()}
          </section>

          <section className="bg-white/10 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-yellow-400 mb-2">Viewport Dimensions</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Window:</div>
              <div className="font-mono">{debugInfo.windowWidth} x {debugInfo.windowHeight}</div>
              <div>Visual Viewport:</div>
              <div className="font-mono">
                {debugInfo.visualViewportHeight !== null 
                  ? `H: ${debugInfo.visualViewportHeight}, offset: ${debugInfo.visualViewportOffsetTop}`
                  : "N/A"}
              </div>
              <div>Body Scroll Height:</div>
              <div className="font-mono">{debugInfo.bodyScrollHeight}px</div>
              <div>Document Height:</div>
              <div className="font-mono">{debugInfo.documentHeight}px</div>
            </div>
          </section>

          <section className="bg-white/10 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-yellow-400 mb-2">Event Log</h3>
            <div className="max-h-40 overflow-y-auto text-xs font-mono space-y-1">
              {logs.length === 0 ? (
                <div className="text-gray-400">No events logged yet</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="text-gray-300">{log}</div>
                ))
              )}
            </div>
          </section>

          <div className="text-xs text-gray-400 text-center">
            Last updated: {debugInfo.timestamp}
          </div>
        </div>
      )}
    </div>
  );
}
