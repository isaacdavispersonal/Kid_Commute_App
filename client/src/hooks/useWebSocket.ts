// WebSocket hook for real-time messaging - Reference: WebSocket blueprint
import { useEffect, useRef, useState } from "react";
import { getWebSocketUrl } from "@/lib/config";

export function useWebSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket server
    const wsUrl = getWebSocketUrl();

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
        console.error("WebSocket error:", error);
      };

      socketRef.current = socket;

      return () => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
  };
}
