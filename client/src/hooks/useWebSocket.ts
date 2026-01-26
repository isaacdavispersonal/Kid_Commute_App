// WebSocket hook for real-time messaging - Reference: WebSocket blueprint
// Singleton pattern to prevent duplicate connections across components
import { useEffect, useRef, useState } from "react";
import { getWebSocketUrl, isNative } from "@/lib/config";

// Singleton state - shared across all hook instances
let sharedSocket: WebSocket | null = null;
let connectionCount = 0;
let connectionStateHandlers = new Set<(connected: boolean) => void>();

// Track connection state
let isConnectedState = false;

function notifyConnectionState(connected: boolean) {
  isConnectedState = connected;
  connectionStateHandlers.forEach(handler => handler(connected));
}

function createSocket(): WebSocket | null {
  const wsUrl = getWebSocketUrl();

  // Validate WebSocket URL before attempting connection
  // Skip WebSocket on native apps to avoid Safari WebSocket errors
  if (!wsUrl || wsUrl.includes('undefined') || wsUrl.includes('localhost:undefined')) {
    console.log("[WebSocket] Skipping connection - invalid URL or native app:", wsUrl);
    return null;
  }

  // On native apps, WebSocket connections can cause issues with Safari/iOS
  // Only connect if we have a valid production URL
  if (isNative && !wsUrl.startsWith('wss://kid-commute')) {
    console.log("[WebSocket] Skipping connection on native - not production URL");
    return null;
  }

  try {
    console.log("[WebSocket] Creating singleton connection to:", wsUrl);
    const socket = new WebSocket(wsUrl);

    // Use addEventListener instead of onX properties to preserve existing usage patterns
    // Components can still call socket.addEventListener("message", handler) directly
    socket.addEventListener("open", () => {
      console.log("[WebSocket] Connected (singleton)");
      notifyConnectionState(true);
    });

    socket.addEventListener("close", (event) => {
      console.log("[WebSocket] Disconnected (singleton)", event.code, event.reason);
      notifyConnectionState(false);
      // Clear shared socket reference if it was this socket
      if (sharedSocket === socket) {
        sharedSocket = null;
      }
    });

    socket.addEventListener("error", (error) => {
      // Don't log errors loudly on native to avoid cascading issues
      if (!isNative) {
        console.error("[WebSocket] Error (singleton):", error);
      }
    });

    return socket;
  } catch (error) {
    // Silently handle WebSocket construction errors on native
    // These are often Safari-specific issues that shouldn't block the UI
    if (!isNative) {
      console.error("[WebSocket] Failed to create connection:", error);
    }
    return null;
  }
}

function getOrCreateSocket(): WebSocket | null {
  if (sharedSocket && (sharedSocket.readyState === WebSocket.OPEN || sharedSocket.readyState === WebSocket.CONNECTING)) {
    return sharedSocket;
  }
  
  // Clean up dead socket reference
  if (sharedSocket && sharedSocket.readyState === WebSocket.CLOSED) {
    sharedSocket = null;
  }
  
  sharedSocket = createSocket();
  return sharedSocket;
}

function closeSocketIfUnused() {
  if (connectionCount <= 0 && sharedSocket) {
    console.log("[WebSocket] Last consumer unmounted, closing singleton connection");
    // Close socket in any state (CONNECTING or OPEN)
    if (sharedSocket.readyState === WebSocket.OPEN || sharedSocket.readyState === WebSocket.CONNECTING) {
      sharedSocket.close(1000, "All consumers unmounted");
    }
    sharedSocket = null;
    notifyConnectionState(false);
  }
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(isConnectedState);
  const hasInitializedRef = useRef(false);

  // Subscribe to connection state changes
  useEffect(() => {
    const handler = (connected: boolean) => setIsConnected(connected);
    connectionStateHandlers.add(handler);
    
    // Sync initial state
    setIsConnected(isConnectedState);
    
    return () => {
      connectionStateHandlers.delete(handler);
    };
  }, []);

  // Manage socket lifecycle with StrictMode-safe reference counting
  useEffect(() => {
    // Prevent double-counting in StrictMode
    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;
    
    connectionCount++;
    console.log(`[WebSocket] Consumer mounted (count: ${connectionCount})`);
    
    // Get or create the singleton socket
    getOrCreateSocket();

    return () => {
      // Only decrement if we actually incremented
      if (hasInitializedRef.current) {
        hasInitializedRef.current = false;
        connectionCount = Math.max(0, connectionCount - 1); // Prevent negative counts
        console.log(`[WebSocket] Consumer unmounted (count: ${connectionCount})`);
        
        // Close socket if this was the last consumer
        closeSocketIfUnused();
      }
    };
  }, []);

  return {
    socket: sharedSocket,
    isConnected,
  };
}

// Export for testing/debugging
export function getWebSocketState() {
  return {
    isConnected: isConnectedState,
    connectionCount,
    socketState: sharedSocket?.readyState ?? null,
  };
}
