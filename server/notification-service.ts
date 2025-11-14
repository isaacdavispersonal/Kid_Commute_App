import { WebSocketServer, WebSocket } from "ws";
import { db } from "./db";
import { students, users, shifts } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { log } from "./vite";
import type { GeofenceEvent } from "./geofence-service";
import type { StopCompletionEvent } from "./dwell-detection-service";
import type { DataUpdateMessage, DataUpdateResource, DataUpdateAction } from "@shared/notifications";

interface WebSocketNotification {
  type: "notification";
  category: "geofence_exit" | "stop_completion" | "stop_approaching";
  shiftId: string;
  routeId?: string;
  routeStopId?: string;
  message: string;
  occurredAt: string;
  meta: Record<string, any>;
}

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  userRole?: string;
  authorizedRoutes?: string[];
}

class NotificationService {
  private wss: WebSocketServer | null = null;
  private parentRouteCache = new Map<string, Set<string>>(); // routeId -> Set of parent user IDs

  /**
   * Initialize with WebSocket server reference
   */
  initialize(wss: WebSocketServer) {
    this.wss = wss;
    log("[notifications] Notification service initialized");
  }

  /**
   * Get parent user IDs who have students on a given route
   */
  private async getParentsForRoute(routeId: string): Promise<Set<string>> {
    // Check cache first
    if (this.parentRouteCache.has(routeId)) {
      return this.parentRouteCache.get(routeId)!;
    }

    // Query for students on this route
    const studentsOnRoute = await db
      .select()
      .from(students)
      .where(eq(students.assignedRouteId, routeId));

    // Get unique guardian phone numbers
    const guardianPhones = new Set<string>();
    for (const student of studentsOnRoute) {
      for (const phone of student.guardianPhones) {
        if (phone) {
          guardianPhones.add(phone);
        }
      }
    }

    if (guardianPhones.size === 0) {
      return new Set();
    }

    // Lookup parent user IDs by phone numbers
    const parentUsers = await db
      .select()
      .from(users)
      .where(
        inArray(users.phone, Array.from(guardianPhones))
      );

    const parentIds = new Set(parentUsers.map((u) => u.id));

    // Cache for 5 minutes
    this.parentRouteCache.set(routeId, parentIds);
    setTimeout(() => {
      this.parentRouteCache.delete(routeId);
    }, 5 * 60 * 1000);

    return parentIds;
  }

  /**
   * Broadcast notification to specific users
   */
  private broadcastToUsers(
    notification: WebSocketNotification,
    targetUserIds: Set<string>
  ) {
    if (!this.wss) {
      log("[notifications] WebSocket server not initialized", "warn");
      return;
    }

    let broadcastCount = 0;
    let errorCount = 0;

    this.wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedWebSocket;

      // Check if client is authenticated and in target list
      if (
        authClient.userId &&
        targetUserIds.has(authClient.userId) &&
        authClient.readyState === WebSocket.OPEN
      ) {
        try {
          client.send(JSON.stringify(notification));
          broadcastCount++;
        } catch (error) {
          errorCount++;
          log(`[notifications] Error broadcasting to user ${authClient.userId}: ${error}`, "error");
        }
      }
    });

    log(
      `[notifications] Broadcast ${notification.category} to ${broadcastCount} clients (${errorCount} errors)`,
      "info"
    );
  }

  /**
   * Handle geofence ENTRY event - notify parents when approaching stop
   */
  async handleGeofenceEntry(event: GeofenceEvent) {
    try {
      if (event.type !== "ENTRY" || !event.shiftId) {
        return;
      }

      // Only notify for STOP geofences (120m proximity)
      if (event.geofenceType !== "STOP") {
        return;
      }

      // Get the route from the shift
      const [shift] = await db
        .select()
        .from(shifts)
        .where(eq(shifts.id, event.shiftId))
        .limit(1);

      if (!shift?.routeId) {
        return;
      }

      // Get parents for this route
      const parentIds = await this.getParentsForRoute(shift.routeId);

      if (parentIds.size === 0) {
        return;
      }

      const notification: WebSocketNotification = {
        type: "notification",
        category: "stop_approaching",
        shiftId: event.shiftId,
        routeId: shift.routeId,
        message: `Bus is approaching ${event.geofenceName}.`,
        occurredAt: event.occurredAt.toISOString(),
        meta: {
          geofenceId: event.geofenceId,
          geofenceName: event.geofenceName,
          geofenceType: event.geofenceType,
          vehicleId: event.vehicleId,
        },
      };

      this.broadcastToUsers(notification, parentIds);
      log(`[notifications] Stop approaching: ${event.geofenceName} (route: ${shift.routeId})`, "info");
    } catch (error) {
      log(`[notifications] Error handling geofence entry: ${error}`, "error");
    }
  }

  /**
   * Handle geofence EXIT event - notify parents when van leaves school/stop
   */
  async handleGeofenceExit(event: GeofenceEvent) {
    try {
      if (event.type !== "EXIT" || !event.shiftId) {
        return;
      }

      // Get the route from the shift
      const [shift] = await db
        .select()
        .from(shifts)
        .where(eq(shifts.id, event.shiftId))
        .limit(1);

      if (!shift?.routeId) {
        return;
      }

      // Get parents for this route
      const parentIds = await this.getParentsForRoute(shift.routeId);

      if (parentIds.size === 0) {
        return;
      }

      // Differentiate message by geofence type
      let message: string;
      if (event.geofenceType === "SCHOOL") {
        message = `Route is departing ${event.geofenceName}. Live ETAs now available.`;
      } else if (event.geofenceType === "STOP") {
        message = `Bus has departed ${event.geofenceName}.`;
      } else {
        message = `Route is departing ${event.geofenceName}.`;
      }

      const notification: WebSocketNotification = {
        type: "notification",
        category: "geofence_exit",
        shiftId: event.shiftId,
        routeId: shift.routeId,
        message,
        occurredAt: event.occurredAt.toISOString(),
        meta: {
          geofenceId: event.geofenceId,
          geofenceName: event.geofenceName,
          geofenceType: event.geofenceType,
          vehicleId: event.vehicleId,
        },
      };

      this.broadcastToUsers(notification, parentIds);
    } catch (error) {
      log(`[notifications] Error handling geofence exit: ${error}`, "error");
    }
  }

  /**
   * Handle automatic stop completion - notify parents with updated progress
   */
  async handleStopCompletion(event: StopCompletionEvent) {
    try {
      // Get the route from the shift
      const [shift] = await db
        .select()
        .from(shifts)
        .where(eq(shifts.id, event.shiftId))
        .limit(1);

      if (!shift?.routeId) {
        return;
      }

      // Get parents for this route
      const parentIds = await this.getParentsForRoute(shift.routeId);

      if (parentIds.size === 0) {
        return;
      }

      const notification: WebSocketNotification = {
        type: "notification",
        category: "stop_completion",
        shiftId: event.shiftId,
        routeId: shift.routeId,
        routeStopId: event.routeStopId,
        message: `Stop "${event.stopName}" completed. Updating route progress.`,
        occurredAt: event.completedAt.toISOString(),
        meta: {
          stopName: event.stopName,
          dwellDuration: event.dwellDuration,
          autoCompleted: true,
        },
      };

      this.broadcastToUsers(notification, parentIds);
    } catch (error) {
      log(`[notifications] Error handling stop completion: ${error}`, "error");
    }
  }

  /**
   * Publish data update notification to authorized clients
   * Broadcasts when resources are created/updated/deleted so all clients can refresh
   */
  publishDataUpdate(params: {
    resource: DataUpdateResource;
    action: DataUpdateAction;
    entityIds?: string[];
    scope?: { routeId?: string; organizationId?: string };
    metadata?: Record<string, any>;
    actorId?: string;
    targetRoles?: string[];
  }) {
    if (!this.wss) {
      log("[notifications] WebSocket server not initialized", "warn");
      return;
    }

    const { resource, action, entityIds, scope, metadata, actorId, targetRoles = ["admin"] } = params;

    const message: DataUpdateMessage = {
      type: "data_update",
      version: 1,
      resource,
      action,
      entityIds,
      scope,
      metadata,
      actorId,
      timestamp: new Date().toISOString(),
    };

    let broadcastCount = 0;
    let errorCount = 0;

    this.wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedWebSocket;

      // Check if client is authenticated and has authorized role
      if (
        authClient.userId &&
        authClient.userRole &&
        targetRoles.includes(authClient.userRole) &&
        authClient.readyState === WebSocket.OPEN
      ) {
        try {
          client.send(JSON.stringify(message));
          broadcastCount++;
        } catch (error) {
          errorCount++;
          log(`[notifications] Error broadcasting data update to user ${authClient.userId}: ${error}`, "error");
        }
      }
    });

    log(
      `[notifications] Broadcast ${resource}.${action} to ${broadcastCount} ${targetRoles.join("/")} clients (${errorCount} errors)`,
      "info"
    );
  }

  /**
   * Clear caches (useful for testing)
   */
  clearCaches() {
    this.parentRouteCache.clear();
  }
}

export const notificationService = new NotificationService();
