import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyToken } from "./utils/jwt-auth";
import { storage } from "./storage";

export interface AuthenticatedSocket extends Socket {
  userId: string;
  userRole: string;
  authorizedRoutes: string[];
}

interface SocketServerOptions {
  httpServer: HttpServer;
}

let io: Server | null = null;

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.IO server not initialized");
  }
  return io;
}

export async function canAccessRoute(userId: string, userRole: string, routeId: string): Promise<boolean> {
  if (userRole === "admin") return true;
  
  if (userRole === "driver") {
    const assignments = await storage.getDriverAssignmentsByDriver(userId);
    return assignments.some(a => a.routeId === routeId);
  }
  
  if (userRole === "parent") {
    const students = await storage.getStudentsByParent(userId);
    return students.some(s => s.assignedRouteId === routeId);
  }
  
  return false;
}

export function initSocketServer({ httpServer }: SocketServerOptions): Server {
  io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: true,
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "");
      
      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error("Invalid token"));
      }

      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return next(new Error("User not found"));
      }

      const authSocket = socket as AuthenticatedSocket;
      authSocket.userId = user.id;
      authSocket.userRole = user.role;

      if (user.role === "driver") {
        const assignments = await storage.getDriverAssignmentsByDriver(user.id);
        authSocket.authorizedRoutes = assignments.map(a => a.routeId);
      } else if (user.role === "parent") {
        const students = await storage.getStudentsByParent(user.id);
        authSocket.authorizedRoutes = students
          .map(s => s.assignedRouteId)
          .filter((id): id is string => id !== null);
      } else {
        authSocket.authorizedRoutes = [];
      }

      next();
    } catch (error) {
      console.error("[Socket.IO] Auth error:", error);
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    console.log(`[Socket.IO] Client connected: userId=${authSocket.userId}, role=${authSocket.userRole}`);

    authSocket.join(`user:${authSocket.userId}`);
    authSocket.join("org:default");
    
    // Join route rooms for route-scoped announcements
    if (authSocket.authorizedRoutes && authSocket.authorizedRoutes.length > 0) {
      for (const routeId of authSocket.authorizedRoutes) {
        authSocket.join(`route:${routeId}`);
      }
      console.log(`[Socket.IO] Joined rooms: user:${authSocket.userId}, org:default, routes: ${authSocket.authorizedRoutes.join(", ")}`);
    } else {
      console.log(`[Socket.IO] Joined rooms: user:${authSocket.userId}, org:default`);
    }

    authSocket.emit("connected", {
      userId: authSocket.userId,
      role: authSocket.userRole,
      rooms: [`user:${authSocket.userId}`, "org:default"],
    });

    authSocket.on("subscribe_route_run", async (routeRunId: string) => {
      try {
        const routeRun = await storage.getRouteRun(routeRunId);
        if (!routeRun) {
          authSocket.emit("error", { message: "Route run not found" });
          return;
        }

        const authorized = authSocket.userRole === "admin" || 
          authSocket.authorizedRoutes.includes(routeRun.routeId) ||
          await canAccessRoute(authSocket.userId, authSocket.userRole, routeRun.routeId);

        if (!authorized) {
          authSocket.emit("error", { message: "Not authorized to subscribe to this route run" });
          return;
        }

        authSocket.join(`route_run:${routeRunId}`);
        console.log(`[Socket.IO] User ${authSocket.userId} subscribed to route_run:${routeRunId}`);

        authSocket.emit("subscribed", { room: `route_run:${routeRunId}` });

        const participants = await storage.getRouteRunParticipants(routeRunId);
        authSocket.emit("route_run.snapshot", {
          routeRun,
          participants,
        });
      } catch (error) {
        console.error("[Socket.IO] Error subscribing to route run:", error);
        authSocket.emit("error", { message: "Failed to subscribe to route run" });
      }
    });

    authSocket.on("unsubscribe_route_run", (routeRunId: string) => {
      authSocket.leave(`route_run:${routeRunId}`);
      console.log(`[Socket.IO] User ${authSocket.userId} unsubscribed from route_run:${routeRunId}`);
      authSocket.emit("unsubscribed", { room: `route_run:${routeRunId}` });
    });

    authSocket.on("disconnect", (reason) => {
      console.log(`[Socket.IO] Client disconnected: userId=${authSocket.userId}, reason=${reason}`);
    });

    authSocket.on("reconnect_request", async () => {
      console.log(`[Socket.IO] Reconnect request from user ${authSocket.userId}`);
      authSocket.emit("reconnected", {
        userId: authSocket.userId,
        role: authSocket.userRole,
      });
    });
  });

  console.log("[Socket.IO] Server initialized");
  return io;
}

export function emitToUser(userId: string, event: string, data: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

export function emitToOrg(event: string, data: any) {
  if (!io) return;
  io.to("org:default").emit(event, data);
}

export function emitToRouteRun(routeRunId: string, event: string, data: any) {
  if (!io) return;
  io.to(`route_run:${routeRunId}`).emit(event, data);
}

export function emitRouteRunStarted(routeRunId: string, data: {
  routeRun: any;
  primaryDriverId: string;
}) {
  emitToRouteRun(routeRunId, "route_run.started", data);
}

export function emitRouteRunEndedPendingReview(routeRunId: string, data: {
  routeRun: any;
}) {
  emitToRouteRun(routeRunId, "route_run.ended_pending_review", data);
}

export function emitRouteRunFinalized(routeRunId: string, data: {
  routeRun: any;
}) {
  emitToRouteRun(routeRunId, "route_run.finalized", data);
}

export function emitRouteRunReopened(routeRunId: string, data: {
  routeRun: any;
}) {
  emitToRouteRun(routeRunId, "route_run.reopened", data);
}

export function emitStopArrived(routeRunId: string, data: {
  stopId: string;
  arrivedAt: string;
  driverId: string;
}) {
  emitToRouteRun(routeRunId, "stop.arrived", data);
}

export function emitStopCompleted(routeRunId: string, data: {
  stopId: string;
  completedAt: string;
  driverId: string;
}) {
  emitToRouteRun(routeRunId, "stop.completed", data);
}

export function emitAttendanceUpdated(routeRunId: string, data: {
  studentId: string;
  status: string;
  stopId?: string;
  pickupTime?: string;
  dropoffTime?: string;
  updatedBy: string;
}) {
  emitToRouteRun(routeRunId, "attendance.updated", data);
}

export function emitAnnouncementCreated(data: {
  announcement: any;
  targetRouteId?: string;
  audienceType?: string;
}) {
  if (!io) {
    console.warn("[Socket.IO] Cannot emit announcement.created - server not initialized");
    return;
  }

  const announcementId = data.announcement?.id || "unknown";
  const audienceType = data.audienceType || data.announcement?.audienceType;

  if (data.targetRouteId) {
    // Route-scoped announcement
    const room = `route:${data.targetRouteId}`;
    const roomClients = io.sockets.adapter.rooms.get(room);
    const clientCount = roomClients ? roomClients.size : 0;
    
    console.log(`[Socket.IO] Emitting announcement.created to room=${room}, clients=${clientCount}, announcement_id=${announcementId}, audience_type=${audienceType}`);
    io.to(room).emit("announcement.created", data);
  } else {
    // Org-wide announcement
    const room = "org:default";
    const roomClients = io.sockets.adapter.rooms.get(room);
    const clientCount = roomClients ? roomClients.size : 0;
    
    console.log(`[Socket.IO] Emitting announcement.created to room=${room}, clients=${clientCount}, announcement_id=${announcementId}, audience_type=${audienceType}`);
    io.to(room).emit("announcement.created", data);
  }
}

export function emitParticipantJoined(routeRunId: string, data: {
  userId: string;
  role: string;
  userName?: string;
}) {
  emitToRouteRun(routeRunId, "participant.joined", data);
}

export function emitParticipantLeft(routeRunId: string, data: {
  userId: string;
}) {
  emitToRouteRun(routeRunId, "participant.left", data);
}
