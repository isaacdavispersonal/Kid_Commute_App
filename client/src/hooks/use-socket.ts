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
  const lastRouteRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!routeRunId) {
      if (lastRouteRunIdRef.current) {
        unsubscribeRoute(lastRouteRunIdRef.current);
        lastRouteRunIdRef.current = null;
      }
      return;
    }

    if (routeRunId !== lastRouteRunIdRef.current) {
      if (lastRouteRunIdRef.current) {
        unsubscribeRoute(lastRouteRunIdRef.current);
      }
      subscribeRoute(routeRunId);
      lastRouteRunIdRef.current = routeRunId;
    }

    return () => {
      if (routeRunId) {
        unsubscribeRoute(routeRunId);
        lastRouteRunIdRef.current = null;
      }
    };
  }, [routeRunId, subscribeRoute, unsubscribeRoute]);

  useSocketEvent("route_run.started", (data) => {
    console.log("[Socket] Route run started:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs", routeRunId] });
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs/active"] });
  });

  useSocketEvent("route_run.ended_pending_review", (data) => {
    console.log("[Socket] Route run ended:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs", routeRunId] });
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs/active"] });
  });

  useSocketEvent("route_run.finalized", (data) => {
    console.log("[Socket] Route run finalized:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs", routeRunId] });
  });

  useSocketEvent("route_run.snapshot", (data) => {
    console.log("[Socket] Route run snapshot received:", data);
    queryClient.setQueryData(["/api/route-runs", routeRunId], data);
  });

  useSocketEvent("participant.joined", (data) => {
    console.log("[Socket] Participant joined:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs", routeRunId] });
  });

  useSocketEvent("participant.left", (data) => {
    console.log("[Socket] Participant left:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs", routeRunId] });
  });

  useSocketEvent("attendance.updated", (data) => {
    console.log("[Socket] Attendance updated:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    queryClient.invalidateQueries({ queryKey: ["/api/driver/attendance"] });
  });

  useSocketEvent("stop.arrived", (data) => {
    console.log("[Socket] Stop arrived:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs", routeRunId] });
  });

  useSocketEvent("stop.completed", (data) => {
    console.log("[Socket] Stop completed:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/route-runs", routeRunId] });
  });

  useEffect(() => {
    if (connectionState === "connected" && routeRunId && isSocketConnected()) {
      console.log("[Socket] Reconnected - refetching route run data");
      queryClient.invalidateQueries({ queryKey: ["/api/route-runs", routeRunId] });
    }
  }, [connectionState, routeRunId, queryClient]);

  return {
    connectionState,
    isReconnecting,
  };
}

export function useAnnouncementSocket() {
  const queryClient = useQueryClient();

  useSocketEvent("announcement.created", (data) => {
    console.log("[Socket] Announcement created:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/driver/announcements"] });
    queryClient.invalidateQueries({ queryKey: ["/api/parent/announcements"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
  });
}
