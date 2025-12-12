// WebSocket hook for real-time messaging - Reference: WebSocket blueprint
import { useEffect, useRef, useState } from "react";
import { getWebSocketUrl, isNative } from "@/lib/config";

export function useWebSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket server
    const wsUrl = getWebSocketUrl();

    // Validate WebSocket URL before attempting connection
    // Skip WebSocket on native apps to avoid Safari WebSocket errors
    if (!wsUrl || wsUrl.includes('undefined') || wsUrl.includes('localhost:undefined')) {
      console.log("[WebSocket] Skipping connection - invalid URL or native app:", wsUrl);
      return;
    }

    // On native apps, WebSocket connections can cause issues with Safari/iOS
    // Only connect if we have a valid production URL
    if (isNative && !wsUrl.startsWith('wss://kid-commute')) {
      console.log("[WebSocket] Skipping connection on native - not production URL");
      return;
    }

    try {
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
      };

      socket.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
      };

      socket.onerror = (error) => {
        // Don't log errors loudly on native to avoid cascading issues
        if (!isNative) {
          console.error("WebSocket error:", error);
        }
      };

      socketRef.current = socket;

      return () => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };
    } catch (error) {
      // Silently handle WebSocket construction errors on native
      // These are often Safari-specific issues that shouldn't block the UI
      if (!isNative) {
        console.error("Failed to create WebSocket:", error);
      }
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
  };
}
