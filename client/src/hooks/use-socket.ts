import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  initSocket,
  disconnectSocket,
  onSocketEvent,
  onConnectionStateChange,
  subscribeToRouteRun,
  unsubscribeFromRouteRun,
  isSocketConnected,
  SocketEvents,
} from "@/lib/socket";

type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";

export function useSocket() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const queryClient = useQueryClient();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const unsubscribeState = onConnectionStateChange(setConnectionState);

    initSocket().then((socket) => {
      if (socket) {
        console.log("[useSocket] Socket initialized");
      }
    });

    return () => {
      unsubscribeState();
    };
  }, []);

  const subscribeRoute = useCallback((routeRunId: string) => {
    subscribeToRouteRun(routeRunId);
  }, []);

  const unsubscribeRoute = useCallback((routeRunId: string) => {
    unsubscribeFromRouteRun(routeRunId);
  }, []);

  const disconnect = useCallback(() => {
    disconnectSocket();
    initializedRef.current = false;
  }, []);

  return {
    connectionState,
    isConnected: connectionState === "connected",
    isReconnecting: connectionState === "reconnecting",
    subscribeRoute,
    unsubscribeRoute,
    disconnect,
  };
}

export function useSocketEvent<T extends keyof SocketEvents>(
  event: T,
  handler: SocketEvents[T]
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrappedHandler = (...args: any[]) => {
      (handlerRef.current as Function)(...args);
    };

    const unsubscribe = onSocketEvent(event, wrappedHandler as any);
    return unsubscribe;
  }, [event]);
}

export function useRouteRunSocket(routeRunId: string | null) {
  const { subscribeRoute, unsubscribeRoute, connectionState, isReconnecting } = useSocket();
  const queryClient = useQueryClient();
  
  // Use ref to always have access to the latest routeRunId in event handlers
  // This prevents stale closures when routeRunId changes rapidly
  const currentRouteRunIdRef = useRef<string | null>(routeRunId);
  const subscribedRouteRunIdRef = useRef<string | null>(null);
  
  // Keep the ref in sync with the prop
  useEffect(() => {
    currentRouteRunIdRef.current = routeRunId;
  }, [routeRunId]);

  // Handle subscription/unsubscription with proper cleanup
  useEffect(() => {
    // If no routeRunId, clean up any existing subscription
    if (!routeRunId) {
      if (subscribedRouteRunIdRef.current) {
        console.log(`[Socket] Unsubscribing from route run: ${subscribedRouteRunIdRef.current}`);
        unsubscribeRoute(subscribedRouteRunIdRef.current);
        subscribedRouteRunIdRef.current = null;
      }
      return;
    }

    // If routeRunId changed, unsubscribe from old and subscribe to new
    if (routeRunId !== subscribedRouteRunIdRef.current) {
      // Unsubscribe from previous route run first
      if (subscribedRouteRunIdRef.current) {
        console.log(`[Socket] Unsubscribing from old route run: ${subscribedRouteRunIdRef.current}`);
        unsubscribeRoute(subscribedRouteRunIdRef.current);
      }
      
      // Subscribe to new route run
      console.log(`[Socket] Subscribing to route run: ${routeRunId}`);
      subscribeRoute(routeRunId);
      subscribedRouteRunIdRef.current = routeRunId;
    }

    // Cleanup on unmount
    return () => {
      if (subscribedRouteRunIdRef.current) {
        console.log(`[Socket] Cleanup - unsubscribing from route run: ${subscribedRouteRunIdRef.current}`);
        unsubscribeRoute(subscribedRouteRunIdRef.current);
        subscribedRouteRunIdRef.current = null;
      }
    };
  }, [routeRunId, subscribeRoute, unsubscribeRoute]);

  // Event handlers use the ref to check if the event is for the current route run
  // This prevents updates from previous routes after switching
  useSocketEvent("route_run.started", (data) => {
    const currentId = currentRouteRunIdRef.current;
    if (!currentId || data.routeRun?.id !== currentId) {
      console.log(`[Socket] Ignoring route_run.started for ${data.routeRun?.id} (current: ${currentId})`);
      return;
    }
    console.log("[Socket] Route run started:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs", currentId] });
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs/active"] });
  });

  useSocketEvent("route_run.ended_pending_review", (data) => {
    const currentId = currentRouteRunIdRef.current;
    if (!currentId || data.routeRun?.id !== currentId) {
      console.log(`[Socket] Ignoring route_run.ended for ${data.routeRun?.id} (current: ${currentId})`);
      return;
    }
    console.log("[Socket] Route run ended:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs", currentId] });
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs/active"] });
  });

  useSocketEvent("route_run.finalized", (data) => {
    const currentId = currentRouteRunIdRef.current;
    if (!currentId || data.routeRun?.id !== currentId) {
      return;
    }
    console.log("[Socket] Route run finalized:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs", currentId] });
  });

  useSocketEvent("route_run.snapshot", (data) => {
    const currentId = currentRouteRunIdRef.current;
    if (!currentId || data.routeRun?.id !== currentId) {
      console.log(`[Socket] Ignoring snapshot for ${data.routeRun?.id} (current: ${currentId})`);
      return;
    }
    console.log("[Socket] Route run snapshot received:", data);
    queryClient.setQueryData(["/api/route-runs", currentId], data);
  });

  useSocketEvent("participant.joined", (data) => {
    const currentId = currentRouteRunIdRef.current;
    if (!currentId) return;
    console.log("[Socket] Participant joined:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs", currentId] });
  });

  useSocketEvent("participant.left", (data) => {
    const currentId = currentRouteRunIdRef.current;
    if (!currentId) return;
    console.log("[Socket] Participant left:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs", currentId] });
  });

  useSocketEvent("attendance.updated", (data) => {
    const currentId = currentRouteRunIdRef.current;
    if (!currentId) return;
    console.log("[Socket] Attendance updated:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    queryClient.invalidateQueries({ queryKey: ["/api/driver/attendance"] });
  });

  useSocketEvent("stop.arrived", (data) => {
    const currentId = currentRouteRunIdRef.current;
    if (!currentId) return;
    console.log("[Socket] Stop arrived:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs", currentId] });
  });

  useSocketEvent("stop.completed", (data) => {
    const currentId = currentRouteRunIdRef.current;
    if (!currentId) return;
    console.log("[Socket] Stop completed:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs", currentId] });
  });

  useEffect(() => {
    const currentId = currentRouteRunIdRef.current;
    if (connectionState === "connected" && currentId && isSocketConnected()) {
      console.log("[Socket] Reconnected - refetching route run data");
      queryClient.invalidateQueries({ queryKey: ["/api/route-runs", currentId] });
    }
  }, [connectionState, queryClient]);

  return {
    connectionState,
    isReconnecting,
  };
}

export function useAnnouncementSocket() {
  const queryClient = useQueryClient();

  useSocketEvent("announcement.created", (data) => {
    console.log("[Socket] Announcement created:", data);
    
    // Invalidate announcement lists
    queryClient.invalidateQueries({ queryKey: ["/api/driver/announcements"] });
    queryClient.invalidateQueries({ queryKey: ["/api/parent/announcements"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
    
    // Invalidate unread counts/badges to update badge indicators
    queryClient.invalidateQueries({ queryKey: ["/api/user/unread-counts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/driver/notifications/unread-count"] });
    queryClient.invalidateQueries({ queryKey: ["/api/parent/notifications/unread-count"] });
    
    // Invalidate announcement history for admin
    queryClient.invalidateQueries({ 
      predicate: (query) => 
        typeof query.queryKey[0] === "string" && 
        query.queryKey[0].includes("/api/admin/announcement-history")
    });
  });
}
