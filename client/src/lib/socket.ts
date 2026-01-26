import { io, Socket } from "socket.io-client";
import { getAuthToken as getMobileAuthToken } from "./mobile-auth";
import { isNative } from "./config";

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

export interface SocketEvents {
  "route_run.started": (data: { routeRun: any; primaryDriverId: string }) => void;
  "route_run.ended_pending_review": (data: { routeRun: any }) => void;
  "route_run.finalized": (data: { routeRun: any }) => void;
  "route_run.reopened": (data: { routeRun: any }) => void;
  "route_run.snapshot": (data: { routeRun: any; participants: any[] }) => void;
  "stop.arrived": (data: { stopId: string; arrivedAt: string; driverId: string }) => void;
  "stop.completed": (data: { stopId: string; completedAt: string; driverId: string }) => void;
  "attendance.updated": (data: {
    studentId: string;
    status: string;
    stopId?: string;
    pickupTime?: string;
    dropoffTime?: string;
    updatedBy: string;
  }) => void;
  "announcement.created": (data: { announcement: any; targetRouteId?: string }) => void;
  "participant.joined": (data: { userId: string; role: string; userName?: string }) => void;
  "participant.left": (data: { userId: string }) => void;
  connected: (data: { userId: string; role: string; rooms: string[] }) => void;
  reconnected: (data: { userId: string; role: string }) => void;
  subscribed: (data: { room: string }) => void;
  unsubscribed: (data: { room: string }) => void;
  error: (data: { message: string }) => void;
}

type EventName = keyof SocketEvents;
type EventCallback<T extends EventName> = SocketEvents[T];

const eventListeners = new Map<string, Set<Function>>();
let connectionStateListeners: Set<(state: "connecting" | "connected" | "disconnected" | "reconnecting") => void> = new Set();

async function getAuthToken(): Promise<string | null> {
  if (isNative) {
    return await getMobileAuthToken();
  }
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "auth_token") {
      return decodeURIComponent(value);
    }
  }
  return null;
}

export function getSocket(): Socket | null {
  return socket;
}

export async function initSocket(): Promise<Socket | null> {
  if (socket?.connected) {
    return socket;
  }

  const token = await getAuthToken();
  if (!token) {
    console.log("[Socket] No auth token, skipping connection");
    return null;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;

  socket = io({
    path: "/socket.io",
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: MAX_RECONNECT_DELAY,
    timeout: 20000,
  });

  socket.on("connect", () => {
    console.log("[Socket] Connected");
    reconnectAttempts = 0;
    notifyConnectionState("connected");
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket] Disconnected:", reason);
    notifyConnectionState("disconnected");
  });

  socket.on("connect_error", (error) => {
    console.error("[Socket] Connection error:", error.message);
    reconnectAttempts++;
    notifyConnectionState("reconnecting");
  });

  socket.io.on("reconnect_attempt", (attempt) => {
    console.log("[Socket] Reconnection attempt:", attempt);
    notifyConnectionState("reconnecting");
  });

  socket.io.on("reconnect", (attempt) => {
    console.log("[Socket] Reconnected after", attempt, "attempts");
    reconnectAttempts = 0;
    notifyConnectionState("connected");
    socket?.emit("reconnect_request");
  });

  socket.io.on("reconnect_failed", () => {
    console.error("[Socket] Reconnection failed");
    notifyConnectionState("disconnected");
  });

  Object.keys(eventListeners).forEach((eventName) => {
    const listeners = eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach((callback) => {
        socket?.on(eventName, callback as any);
      });
    }
  });

  notifyConnectionState("connecting");

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  eventListeners.clear();
  notifyConnectionState("disconnected");
}

export function subscribeToRouteRun(routeRunId: string): void {
  if (!socket?.connected) {
    console.warn("[Socket] Cannot subscribe - not connected");
    return;
  }
  socket.emit("subscribe_route_run", routeRunId);
}

export function unsubscribeFromRouteRun(routeRunId: string): void {
  if (!socket?.connected) {
    return;
  }
  socket.emit("unsubscribe_route_run", routeRunId);
}

export function onSocketEvent<T extends EventName>(
  event: T,
  callback: EventCallback<T>
): () => void {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event)!.add(callback);

  if (socket) {
    socket.on(event, callback as any);
  }

  return () => {
    eventListeners.get(event)?.delete(callback);
    socket?.off(event, callback as any);
  };
}

export function onConnectionStateChange(
  callback: (state: "connecting" | "connected" | "disconnected" | "reconnecting") => void
): () => void {
  connectionStateListeners.add(callback);
  return () => {
    connectionStateListeners.delete(callback);
  };
}

function notifyConnectionState(state: "connecting" | "connected" | "disconnected" | "reconnecting"): void {
  connectionStateListeners.forEach((callback) => callback(state));
}

export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}
