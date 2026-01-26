// Reference: WebSocket blueprint
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import cookieParser from "cookie-parser";
import unifiedAuthRouter, { requireAuth, requireRole, requireAdminOrLeadDriver } from "./routes/unified-auth";
import { NotFoundError, ValidationError } from "./errors";
import express from "express";
import memoizee from "memoizee";
import { registerAdminImportRoutes } from "./routes/admin-import";
import { verifyToken } from "./utils/jwt-auth";
import { pushNotificationService } from "./push-notification-service";
import { 
  emitRouteRunStarted, 
  emitRouteRunEndedPendingReview, 
  emitRouteRunFinalized,
  emitParticipantJoined,
  emitParticipantLeft,
  emitAttendanceUpdated,
  emitAnnouncementCreated,
  emitStopArrived,
  emitStopCompleted,
} from "./socket-server";

// Webhook authentication middleware
const verifyWebhookToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const webhookSecret = process.env.GPS_WEBHOOK_SECRET;

  // If no secret is configured, allow (for initial setup)
  if (!webhookSecret) {
    console.warn("[Webhook] GPS_WEBHOOK_SECRET not configured - webhook is unsecured!");
    return next();
  }

  // Verify Bearer token
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ 
      message: "Unauthorized - Missing or invalid Authorization header",
      hint: "Include 'Authorization: Bearer YOUR_SECRET_TOKEN' header"
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix
  
  if (token !== webhookSecret) {
    return res.status(403).json({ 
      message: "Forbidden - Invalid webhook token"
    });
  }

  next();
};

export interface RoutesBootstrapResult {
  httpServer: Server;
  wss: WebSocketServer;
}

// WebSocket room tracking for route run broadcasts
// Maps room name to set of WebSocket clients subscribed to that room
const wsRooms = new Map<string, Set<WebSocket>>();

// Helper to broadcast a message to all clients in a specific room
function broadcastToRoom(room: string, message: any) {
  const clients = wsRooms.get(room);
  if (!clients) return;
  
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Helper to subscribe a client to a room
function subscribeToRoom(ws: WebSocket, room: string) {
  if (!wsRooms.has(room)) {
    wsRooms.set(room, new Set());
  }
  wsRooms.get(room)!.add(ws);
}

// Helper to unsubscribe a client from all rooms
function unsubscribeFromAllRooms(ws: WebSocket) {
  wsRooms.forEach((clients, room) => {
    clients.delete(ws);
    if (clients.size === 0) {
      wsRooms.delete(room);
    }
  });
}

// Helper function to calculate net hours worked for a single shift
// Reuses the same state machine logic as calculatePayrollData
async function calculateShiftHours(shiftId: string, driverName: string): Promise<{
  netHours: number;
  breakMinutes: number;
}> {
  const events = await storage.getClockEventsByShift(shiftId);
  const shift = await storage.getShift(shiftId);
  
  if (events.length === 0 || !shift) {
    return { netHours: 0, breakMinutes: 0 };
  }

  // Sort events by timestamp
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // State machine for clock events
  type ClockState = "CLOCKED_OUT" | "CLOCKED_IN";
  let clockState: ClockState = "CLOCKED_OUT";
  let currentInEvent: typeof events[0] | null = null;
  let shiftHours = 0;

  // Break tracking with stack
  const breakStack: typeof events = [];
  let shiftBreakMinutes = 0;

  // Process clock events
  for (const event of events) {
    if (event.type === "IN") {
      if (clockState === "CLOCKED_IN") {
        console.warn(`[Payroll Export] Duplicate IN event ignored - Driver: ${driverName}, Shift: ${shiftId}, Event: ${event.id}`);
        continue;
      }
      clockState = "CLOCKED_IN";
      currentInEvent = event;
    } 
    else if (event.type === "OUT") {
      if (clockState === "CLOCKED_OUT") {
        console.warn(`[Payroll Export] OUT without IN ignored - Driver: ${driverName}, Shift: ${shiftId}, Event: ${event.id}`);
        continue;
      }
      if (!currentInEvent) {
        console.warn(`[Payroll Export] OUT event without matching IN - Driver: ${driverName}, Shift: ${shiftId}, Event: ${event.id}`);
        continue;
      }
      const inTime = new Date(currentInEvent.timestamp);
      const outTime = new Date(event.timestamp);
      const hoursWorked = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
      shiftHours += hoursWorked;
      clockState = "CLOCKED_OUT";
      currentInEvent = null;
    }
    else if (event.type === "BREAK_START") {
      breakStack.push(event);
    }
    else if (event.type === "BREAK_END") {
      if (breakStack.length === 0) {
        console.warn(`[Payroll Export] Unpaired BREAK_END ignored - Driver: ${driverName}, Shift: ${shiftId}, Event: ${event.id}`);
        continue;
      }
      const breakStart = breakStack.pop()!;
      const breakStartTime = new Date(breakStart.timestamp);
      const breakEndTime = new Date(event.timestamp);
      const breakMinutes = (breakEndTime.getTime() - breakStartTime.getTime()) / (1000 * 60);
      shiftBreakMinutes += breakMinutes;
    }
  }

  // Handle orphaned IN (still clocked in at end of shift)
  if (clockState === "CLOCKED_IN" && currentInEvent) {
    if (shift.plannedEnd) {
      const inTime = new Date(currentInEvent.timestamp);
      const shiftEndDateTime = new Date(`${shift.date}T${shift.plannedEnd}`);
      const hoursWorked = (shiftEndDateTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
      if (hoursWorked > 0) {
        shiftHours += hoursWorked;
        console.warn(`[Payroll Export] Orphaned IN resolved using shift plannedEnd - Driver: ${driverName}, Shift: ${shiftId}, Hours: ${hoursWorked.toFixed(2)}`);
      }
    } else {
      console.warn(`[Payroll Export] Orphaned IN ignored (no shift plannedEnd) - Driver: ${driverName}, Shift: ${shiftId}, Event: ${currentInEvent.id}`);
    }
  }

  // Handle unpaired BREAK_START
  if (breakStack.length > 0) {
    console.warn(`[Payroll Export] ${breakStack.length} unpaired BREAK_START events ignored - Driver: ${driverName}, Shift: ${shiftId}`);
  }

  // Calculate net hours (worked hours minus break time)
  const breakHours = shiftBreakMinutes / 60;
  let netHours = shiftHours - breakHours;

  // Cap break deduction to prevent negative hours
  if (netHours < 0) {
    console.warn(`[Payroll Export] Break deduction capped to prevent negative hours - Driver: ${driverName}, Shift: ${shiftId}, Worked: ${shiftHours.toFixed(2)}h, Break: ${breakHours.toFixed(2)}h`);
    netHours = 0;
  }

  return { netHours, breakMinutes: shiftBreakMinutes };
}

export async function registerRoutes(app: Express): Promise<RoutesBootstrapResult> {
  // Cookie parser for JWT auth cookies
  app.use(cookieParser());
  app.use(express.json());

  // ============ Unified Auth Routes (JWT-based for web and mobile) ============
  app.use("/api/auth", unifiedAuthRouter);
  
  // Legacy mobile auth route (redirect to unified)
  app.use("/api/mobile/auth", unifiedAuthRouter);

  // ============ Health Check (Public - for mobile app connectivity testing) ============
  
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development"
    });
  });

  // Update user profile
  app.patch("/api/profile", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { updateProfileSchema } = await import("@shared/schema");
      
      console.log(`[PATCH /api/profile] Request body:`, req.body);
      
      // Validate request body
      const result = updateProfileSchema.safeParse(req.body);
      if (!result.success) {
        console.log(`[PATCH /api/profile] Validation failed:`, result.error.errors);
        return res.status(400).json({ 
          message: "Invalid profile data", 
          errors: result.error.errors 
        });
      }
      
      // Normalize phone to digits only if provided, preserve empty/undefined as-is
      let normalizedNewPhone: string | undefined = undefined;
      if (result.data.phoneNumber && result.data.phoneNumber.trim() !== '') {
        normalizedNewPhone = result.data.phoneNumber.replace(/\D/g, '');
        // If after normalization it's empty (e.g. only had special chars), treat as undefined
        if (normalizedNewPhone === '') {
          normalizedNewPhone = undefined;
        }
      }
      
      // For parents changing their phone number, automatically sync children's guardian phones
      const user = await storage.getUser(userId);
      if (user?.role === "parent" && normalizedNewPhone) {
        const currentPhone = user.phoneNumber;
        
        // If parent is changing their phone (not just setting it for the first time), sync to children
        if (currentPhone && normalizedNewPhone !== currentPhone) {
          console.log(`[PATCH /api/profile] Parent phone change detected: ${currentPhone} -> ${normalizedNewPhone}`);
          
          // Find students by OLD guardian phone and update them
          const students = await storage.findStudentsByGuardianPhone(currentPhone);
          console.log(`[PATCH /api/profile] Found ${students.length} students with guardian phone ${currentPhone}`);
          
          for (const student of students) {
            const updatedGuardianPhones = student.guardianPhones.map((phone: string) => 
              phone === currentPhone ? normalizedNewPhone : phone
            );
            
            if (JSON.stringify(updatedGuardianPhones) !== JSON.stringify(student.guardianPhones)) {
              console.log(`[PATCH /api/profile] Updating student ${student.id} guardian phones`);
              await storage.updateStudent(student.id, { guardianPhones: updatedGuardianPhones } as any);
            }
          }
        }
      }
      
      // Update profile with normalized data
      // Destructure phoneNumber out, then only add it back if normalizedNewPhone is defined
      const { phoneNumber: _rawPhone, ...dataWithoutPhone } = result.data;
      const normalizedData = {
        ...dataWithoutPhone,
        ...(normalizedNewPhone !== undefined ? { phoneNumber: normalizedNewPhone } : {})
      };
      
      console.log(`[PATCH /api/profile] Normalized data:`, normalizedData);
      
      const updatedUser = await storage.updateUserProfile(userId, normalizedData);
      
      // For parents, re-link to households with their phone number
      // This handles: 1) phone number changes, 2) first-time phone set, 3) existing phone but never linked to household
      if (user?.role === "parent" && normalizedNewPhone) {
        const phoneChanged = user.phoneNumber !== normalizedNewPhone;
        const currentHousehold = await storage.getUserHousehold(userId);
        const needsLinking = phoneChanged || !currentHousehold;
        
        if (needsLinking) {
          console.log(`[PATCH /api/profile] Parent needs household linking - phoneChanged: ${phoneChanged}, hasHousehold: ${!!currentHousehold}`);
          await storage.relinkParentHouseholds(userId, normalizedNewPhone);
          console.log(`[PATCH /api/profile] Parent re-linked to households`);
        }
      }
      
      console.log(`[PATCH /api/profile] Updated user:`, {
        id: updatedUser.id,
        phoneNumber: updatedUser.phoneNumber,
        email: updatedUser.email
      });
      
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Delete user account permanently
  app.delete("/api/profile/delete-account", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Delete user and all associated data
      await storage.deleteUser(userId);
      
      // Clear auth cookie
      res.clearCookie("auth_token");
      res.json({ success: true, message: "Account deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // ============ Billing Portal Configuration Routes ============

  // Get enabled payment portals for parents
  app.get("/api/billing/portals", requireAuth, async (req: any, res) => {
    try {
      const portals = await storage.getEnabledPaymentPortals();
      res.json(portals);
    } catch (error: any) {
      console.error("Error fetching payment portals:", error);
      res.status(500).json({ message: "Failed to fetch payment portals" });
    }
  });

  // ============ Push Notification Device Token Routes ============

  // Register or update device token for push notifications
  app.post("/api/push-tokens", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { insertDeviceTokenSchema } = await import("@shared/schema");
      
      // Enhanced logging for troubleshooting (C5 requirement)
      console.log(`[push-token] Registration request from user ${userId}`);
      console.log(`[push-token] Platform: ${req.body?.platform}, Token prefix: ${req.body?.token?.substring(0, 20)}...`);
      
      const result = insertDeviceTokenSchema.safeParse(req.body);
      if (!result.success) {
        console.log(`[push-token] Validation failed for user ${userId}:`, result.error.errors);
        return res.status(400).json({
          message: "Invalid device token data",
          errors: result.error.errors
        });
      }

      const tokenData = {
        ...result.data,
        userId,
      };

      const deviceToken = await storage.upsertDeviceToken(tokenData);
      console.log(`[push-token] Successfully registered token for user ${userId} on ${deviceToken.platform}`);
      res.json(deviceToken);
    } catch (error: any) {
      console.error(`[push-token] Error registering device token for user:`, error);
      res.status(500).json({ message: "Failed to register device token" });
    }
  });

  // Delete device token (when user logs out of device)
  app.delete("/api/push-tokens/:token", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { token } = req.params;

      await storage.deleteDeviceToken(userId, token);
      res.json({ success: true, message: "Device token deleted" });
    } catch (error: any) {
      console.error("Error deleting device token:", error);
      res.status(500).json({ message: "Failed to delete device token" });
    }
  });

  // ============ Push Notification Test Routes (Admin Only) ============

  // Send a test push notification (admin only)
  app.post("/api/admin/push-notifications/test", requireRole("admin"), async (req: any, res) => {
    try {
      const { targetUserId, title, body } = req.body;

      if (!targetUserId) {
        return res.status(400).json({ message: "Target user ID is required" });
      }

      // Get device tokens for the target user
      const tokens = await storage.getDeviceTokensByUser(targetUserId);
      
      if (tokens.length === 0) {
        return res.status(404).json({ 
          message: "No registered device tokens found for this user",
          tokenCount: 0
        });
      }

      // Send test notification
      await pushNotificationService.sendToUsers([targetUserId], {
        title: title || "Test Notification",
        body: body || "This is a test push notification from Kid Commute",
        data: { 
          type: "test", 
          timestamp: new Date().toISOString(),
          deeplink: "/"
        }
      });

      res.json({ 
        success: true, 
        message: `Test notification sent to ${tokens.length} device(s)`,
        tokenCount: tokens.length 
      });
    } catch (error: any) {
      console.error("Error sending test push notification:", error);
      res.status(500).json({ message: "Failed to send test notification", error: error.message });
    }
  });

  // Get users with registered device tokens (admin only)
  app.get("/api/admin/push-tokens/users", requireRole("admin"), async (req: any, res) => {
    try {
      // Get all users and check which have device tokens
      const allUsers = await storage.getAllUsers();
      
      const usersWithTokens = await Promise.all(
        allUsers.map(async (user) => {
          const tokens = await storage.getDeviceTokensByUser(user.id);
          const activeTokens = tokens.filter(t => t.isActive);
          return {
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            userRole: user.role,
            tokenCount: activeTokens.length,
            platforms: activeTokens.map(t => t.platform).filter((v, i, a) => a.indexOf(v) === i)
          };
        })
      );

      // Only return users who have at least one token
      res.json(usersWithTokens.filter(u => u.tokenCount > 0));
    } catch (error: any) {
      console.error("Error fetching users with tokens:", error);
      res.status(500).json({ message: "Failed to fetch users with tokens" });
    }
  });

  // Get unread counts for current user (with 3-second cache to reduce DB load)
  const getUnreadCountsCached = memoizee(
    async (userId: string, userRole: string) => {
      const messageCount = await storage.getUnreadMessageCount(userId);
      const messageCounts = await storage.getUnreadCountsBySender(userId);
      let announcementCount = 0;
      let notificationCount = 0;
      let flaggedChecklistsCount = 0;

      if (userRole === "driver" || userRole === "parent") {
        announcementCount = await storage.getUnreadAnnouncementCount(userId, userRole);
      }

      if (userRole === "driver") {
        notificationCount = await storage.getUnreadDriverNotificationCount(userId);
      }

      if (userRole === "admin") {
        // Use acknowledgement-based count for accurate badge
        flaggedChecklistsCount = await storage.getUnacknowledgedFlaggedChecklistsCount(userId);
      }

      return {
        messages: messageCount,
        announcements: announcementCount,
        notifications: notificationCount,
        messageBySender: messageCounts,
        flaggedChecklists: flaggedChecklistsCount,
      };
    },
    {
      maxAge: 3000, // Cache for 3 seconds
      promise: true,
      primitive: true,
    }
  );

  app.get("/api/user/unread-counts", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const counts = await getUnreadCountsCached(userId, user.role);
      res.json(counts);
    } catch (error) {
      console.error("Error fetching unread counts:", error);
      res.status(500).json({ message: "Failed to fetch unread counts" });
    }
  });

  // Get unread announcement IDs for current user
  app.get("/api/user/unread-announcements", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let unreadIds: string[] = [];

      if (user.role === "driver" || user.role === "parent") {
        unreadIds = await storage.getUnreadAnnouncementIds(userId, user.role);
      }

      res.json({ unreadIds });
    } catch (error) {
      console.error("Error fetching unread announcements:", error);
      res.status(500).json({ message: "Failed to fetch unread announcements" });
    }
  });

  // ============ GPS/Vehicle Tracking (No Auth - External Webhooks) ============

  // Import and mount Samsara webhook router
  const samsaraWebhookRouter = (await import("./samsara-webhook")).default;
  app.use("/api/webhooks", samsaraWebhookRouter);

  // Generic webhook endpoint for GPS updates from navigation software (Google Maps, Waze, etc.)
  app.post("/api/vehicles/gps-update", verifyWebhookToken, async (req: any, res) => {
    try {
      const { gpsUpdateSchema } = await import("@shared/schema");
      const { gpsIngestionPipeline } = await import("./gps-pipeline");
      const { CanonicalGPSUpdate } = await import("./gps-pipeline");
      
      // Validate GPS data
      const result = gpsUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid GPS data", 
          errors: result.error.errors 
        });
      }

      const gpsData = result.data;
      
      // Convert to canonical format
      const canonicalUpdate = {
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        speed: gpsData.speed,
        heading: gpsData.heading,
        timestamp: gpsData.timestamp ? new Date(gpsData.timestamp) : new Date(),
        source: "generic" as const,
        vehicleIdentifier: {
          fleetTrackId: gpsData.vehicle_id,
          plateNumber: gpsData.plate_number,
        },
        provenance: {
          rawPayload: gpsData,
        },
      };

      await gpsIngestionPipeline.ingest(canonicalUpdate);

      res.json({ 
        success: true,
        message: "Location updated"
      });
    } catch (error: any) {
      console.error("Error updating GPS location:", error);
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  // Mark messages as read
  app.post("/api/messages/mark-read", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { senderId } = req.body;

      if (!senderId) {
        return res.status(400).json({ message: "senderId is required" });
      }

      await storage.markMessagesAsRead(userId, senderId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  // Mark announcement as read
  app.post("/api/announcements/mark-read", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { announcementId } = req.body;

      if (!announcementId) {
        return res.status(400).json({ message: "announcementId is required" });
      }

      await storage.markAnnouncementAsRead(userId, announcementId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking announcement as read:", error);
      res.status(500).json({ message: "Failed to mark announcement as read" });
    }
  });

  // ============ Admin routes ============

  // Get dashboard statistics
  app.get(
    "/api/admin/stats",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const stats = await storage.getStats();
        res.json(stats);
      } catch (error) {
        console.error("Error fetching stats:", error);
        res.status(500).json({ message: "Failed to fetch statistics" });
      }
    }
  );

  // Get GPS webhook configuration status
  app.get(
    "/api/admin/gps-webhook-status",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const hasSecret = !!process.env.GPS_WEBHOOK_SECRET;
        res.json({ 
          configured: hasSecret,
          webhookUrl: `${req.protocol}://${req.get('host')}/api/vehicles/gps-update`
        });
      } catch (error) {
        console.error("Error fetching GPS webhook status:", error);
        res.status(500).json({ message: "Failed to fetch GPS webhook status" });
      }
    }
  );

  // Get Samsara integration status
  app.get(
    "/api/admin/samsara/status",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const webhookConfigured = !!process.env.SAMSARA_WEBHOOK_SECRET;
        const apiTokenConfigured = !!process.env.SAMSARA_API_TOKEN;
        
        res.json({ 
          webhookConfigured,
          apiTokenConfigured,
          webhookUrl: `${req.protocol}://${req.get('host')}/api/webhooks/samsara-webhook`
        });
      } catch (error) {
        console.error("Error fetching Samsara status:", error);
        res.status(500).json({ message: "Failed to fetch Samsara status" });
      }
    }
  );

  // Get Samsara vehicle mappings
  app.get(
    "/api/admin/samsara/vehicle-mappings",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const allVehicles = await storage.getAllVehicles();
        
        const mappings = allVehicles.map(vehicle => ({
          id: vehicle.id,
          name: vehicle.name,
          plateNumber: vehicle.plateNumber,
          samsaraVehicleId: vehicle.samsaraVehicleId,
          samsaraLastSync: vehicle.samsaraLastSync,
        }));
        
        res.json(mappings);
      } catch (error) {
        console.error("Error fetching Samsara vehicle mappings:", error);
        res.status(500).json({ message: "Failed to fetch vehicle mappings" });
      }
    }
  );

  // Sync vehicles from Samsara
  app.post(
    "/api/admin/samsara/sync-vehicles",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { samsaraClient } = await import("./samsara-client");
        
        if (!samsaraClient) {
          return res.status(400).json({ message: "Samsara API token not configured" });
        }

        // Fetch all vehicles from Samsara
        const samsaraVehicles = await samsaraClient.getAllVehicles();
        
        const results = {
          created: [] as string[],
          updated: [] as string[],
          skipped: [] as string[],
          errors: [] as { vehicle: string; error: string }[]
        };

        for (const samsaraVehicle of samsaraVehicles) {
          try {
            // Check if vehicle exists by Samsara ID or plate number
            let existingVehicle = samsaraVehicle.samsaraId 
              ? await storage.getVehicleBySamsaraId(samsaraVehicle.samsaraId)
              : undefined;
            
            if (!existingVehicle && samsaraVehicle.licensePlate) {
              existingVehicle = await storage.getVehicleByPlate(samsaraVehicle.licensePlate);
            }

            if (existingVehicle) {
              // Update existing vehicle with Samsara ID if not already set
              if (!existingVehicle.samsaraVehicleId && samsaraVehicle.samsaraId) {
                await storage.updateVehicle(existingVehicle.id, {
                  samsaraVehicleId: samsaraVehicle.samsaraId,
                  samsaraLastSync: new Date(),
                });
                results.updated.push(`${samsaraVehicle.name} (${samsaraVehicle.licensePlate || 'No plate'})`);
              } else {
                // Just update the sync timestamp
                await storage.updateVehicle(existingVehicle.id, {
                  samsaraLastSync: new Date(),
                });
                results.skipped.push(`${samsaraVehicle.name} (${samsaraVehicle.licensePlate || 'No plate'}) - already synced`);
              }
            } else {
              // Create new vehicle
              if (!samsaraVehicle.licensePlate) {
                results.errors.push({
                  vehicle: samsaraVehicle.name,
                  error: "No license plate - cannot create vehicle without plate number"
                });
                continue;
              }

              await storage.createVehicle({
                name: samsaraVehicle.name,
                plateNumber: samsaraVehicle.licensePlate,
                capacity: 12, // Default capacity
                status: "active",
                samsaraVehicleId: samsaraVehicle.samsaraId,
                samsaraLastSync: new Date(),
              });
              results.created.push(`${samsaraVehicle.name} (${samsaraVehicle.licensePlate})`);
            }
          } catch (error: any) {
            results.errors.push({
              vehicle: samsaraVehicle.name,
              error: error.message || "Unknown error"
            });
          }
        }

        res.json(results);
      } catch (error) {
        console.error("Error syncing Samsara vehicles:", error);
        res.status(500).json({ message: "Failed to sync vehicles from Samsara" });
      }
    }
  );

  // Get route health overview
  app.get(
    "/api/admin/route-health",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const routes = await storage.getAllRoutes();
        const today = new Date().toISOString().split('T')[0];
        
        const routeHealth = await Promise.all(
          routes.map(async (route) => {
            // Get assigned driver for today
            const assignments = await storage.getDriverAssignmentsByRoute(route.id);
            const todayAssignment = assignments.find(a => a.startTime <= today && a.endTime >= today);
            let assignedDriver = null;
            if (todayAssignment) {
              assignedDriver = await storage.getUser(todayAssignment.driverId);
            }

            // Get student count
            const students = await storage.getStudentsByRouteForDate(route.id, today);
            
            // Get unresolved incidents
            const incidents = await storage.getIncidentsByRoute(route.id);
            const unresolvedIncidents = incidents.filter(i => i.status === "REPORTED").length;

            // Determine driver status and operational running status
            let driverStatus = "NOT_STARTED";
            let isRunning = false; // Operational status: driver clocked in + route explicitly started
            let activeShiftId = null;
            
            if (!assignedDriver) {
              driverStatus = "NO_DRIVER";
            } else {
              // Check if driver has active shift today
              const shifts = await storage.getShiftsByDate(today, today);
              const driverShift = shifts.find(s => s.driverId === assignedDriver.id && s.routeId === route.id);
              if (driverShift) {
                activeShiftId = driverShift.id;
                
                // Route is operationally running only when routeStartedAt is set
                // This means: driver clocked in + completed inspection + explicitly started route
                // Just checking status === "ACTIVE" is not enough since clock-in also sets ACTIVE
                const routeStarted = !!driverShift.routeStartedAt;
                isRunning = routeStarted && driverShift.status === "ACTIVE";
                
                if (driverShift.status === "COMPLETED") {
                  driverStatus = "COMPLETED";
                } else if (routeStarted) {
                  driverStatus = "ON_TIME";
                } else if (driverShift.status === "ACTIVE" && !routeStarted) {
                  // Driver clocked in but hasn't started route yet
                  driverStatus = "CLOCKED_IN";
                } else {
                  driverStatus = "NOT_STARTED";
                }
              }
            }

            return {
              routeId: route.id,
              routeName: route.name,
              isEnabled: route.isActive, // Configuration: route is enabled in system
              isRunning, // Operational: driver is actively running this route right now
              activeShiftId,
              assignedDriver: assignedDriver ? {
                id: assignedDriver.id,
                firstName: assignedDriver.firstName,
                lastName: assignedDriver.lastName,
              } : null,
              driverStatus,
              studentCount: students.length,
              unresolvedIncidents,
              lastActivity: null, // Could be enhanced to track last GPS update or shift activity
            };
          })
        );

        res.json(routeHealth);
      } catch (error) {
        console.error("Error fetching route health:", error);
        res.status(500).json({ message: "Failed to fetch route health" });
      }
    }
  );

  // Get active drivers
  app.get(
    "/api/admin/active-drivers",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const drivers = await storage.getActiveDrivers();
        res.json(drivers);
      } catch (error) {
        console.error("Error fetching active drivers:", error);
        res.status(500).json({ message: "Failed to fetch active drivers" });
      }
    }
  );

  // Get recent incidents
  app.get(
    "/api/admin/recent-incidents",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const incidents = await storage.getRecentIncidents(10);
        res.json(incidents);
      } catch (error) {
        console.error("Error fetching incidents:", error);
        res.status(500).json({ message: "Failed to fetch incidents" });
      }
    }
  );

  // Get all incidents
  app.get(
    "/api/admin/incidents",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const incidents = await storage.getAllIncidents();
        
        // Enrich with student info if available
        const enrichedIncidents = await Promise.all(
          incidents.map(async (incident: any) => {
            let studentFirstName: string | null = null;
            let studentLastName: string | null = null;
            
            if (incident.studentId) {
              const student = await storage.getStudent(incident.studentId);
              if (student) {
                studentFirstName = student.firstName;
                studentLastName = student.lastName;
              }
            }
            
            return {
              ...incident,
              studentId: incident.studentId || null,
              studentFirstName,
              studentLastName,
            };
          })
        );
        
        res.json(enrichedIncidents);
      } catch (error) {
        console.error("Error fetching incidents:", error);
        res.status(500).json({ message: "Failed to fetch incidents" });
      }
    }
  );

  // Update incident status (resolve incident)
  app.patch(
    "/api/admin/incidents/:id",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !["pending", "reviewed", "resolved"].includes(status)) {
          return res.status(400).json({ message: "Invalid status. Must be: pending, reviewed, or resolved" });
        }

        const updatedIncident = await storage.updateIncidentStatus(id, status);
        res.json(updatedIncident);
      } catch (error) {
        console.error("Error updating incident:", error);
        res.status(500).json({ message: "Failed to update incident" });
      }
    }
  );

  // ============ Admin Driver Utility Routes ============

  // Get all supplies requests
  app.get(
    "/api/admin/supplies-requests",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const requests = await storage.getAllSuppliesRequests();
        res.json(requests);
      } catch (error) {
        console.error("Error fetching supplies requests:", error);
        res.status(500).json({ message: "Failed to fetch supplies requests" });
      }
    }
  );

  // Update supplies request status
  app.patch(
    "/api/admin/supplies-requests/:id",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { status, adminNotes } = req.body;
        const approvedBy = req.user.id;

        if (!status || !["PENDING", "APPROVED", "ORDERED", "DELIVERED", "REJECTED"].includes(status)) {
          return res.status(400).json({ message: "Invalid status" });
        }

        const updated = await storage.updateSuppliesRequestStatus(
          id,
          status,
          adminNotes,
          approvedBy
        );

        res.json(updated);
      } catch (error) {
        console.error("Error updating supplies request:", error);
        res.status(500).json({ message: "Failed to update supplies request" });
      }
    }
  );

  // Get all driver feedback
  app.get(
    "/api/admin/feedback",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const feedback = await storage.getAllDriverFeedback();
        res.json(feedback);
      } catch (error) {
        console.error("Error fetching driver feedback:", error);
        res.status(500).json({ message: "Failed to fetch driver feedback" });
      }
    }
  );

  // Update driver feedback status
  app.patch(
    "/api/admin/feedback/:id",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { status, adminResponse } = req.body;
        const respondedBy = req.user.id;

        if (!status || !["NEW", "REVIEWING", "PLANNED", "COMPLETED", "DISMISSED"].includes(status)) {
          return res.status(400).json({ message: "Invalid status" });
        }

        const updated = await storage.updateDriverFeedbackStatus(
          id,
          status,
          adminResponse,
          respondedBy
        );

        res.json(updated);
      } catch (error) {
        console.error("Error updating driver feedback:", error);
        res.status(500).json({ message: "Failed to update driver feedback" });
      }
    }
  );

  // Get all vehicle checklists (admin)
  app.get(
    "/api/admin/vehicle-checklists",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const checklists = await storage.getAllVehicleChecklists();
        res.json(checklists);
      } catch (error) {
        console.error("Error fetching vehicle checklists:", error);
        res.status(500).json({ message: "Failed to fetch vehicle checklists" });
      }
    }
  );

  // Delete a vehicle checklist (admin)
  app.delete(
    "/api/admin/vehicle-checklists/:id",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { id } = req.params;
        await storage.deleteVehicleChecklist(id);
        res.json({ message: "Checklist deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting vehicle checklist:", error);
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: "Failed to delete vehicle checklist" });
      }
    }
  );

  // ============ Admin Badges & Acknowledgements ============

  // Get activity operations badge counts
  app.get(
    "/api/admin/badges/activity-operations",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const adminId = req.user.id;
        const badges = await storage.getActivityOperationsBadges(adminId);
        res.json(badges);
      } catch (error) {
        console.error("Error fetching activity badges:", error);
        res.status(500).json({ message: "Failed to fetch badge counts" });
      }
    }
  );

  // Acknowledge items (mark as reviewed)
  app.post(
    "/api/admin/acknowledge",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const adminId = req.user.id;
        const { entityType, entityIds } = req.body;
        
        if (!entityType || !entityIds || !Array.isArray(entityIds)) {
          return res.status(400).json({ 
            message: "entityType and entityIds array are required" 
          });
        }
        
        const validTypes = [
          "AUDIT_LOG", "FLAGGED_CHECKLIST", "TIME_EXCEPTION", 
          "INCIDENT", "SUPPLY_REQUEST", "DRIVER_FEEDBACK"
        ];
        if (!validTypes.includes(entityType)) {
          return res.status(400).json({ 
            message: `Invalid entityType. Must be one of: ${validTypes.join(", ")}` 
          });
        }
        
        await storage.createBulkAcknowledgements(adminId, entityType, entityIds);
        
        // Return updated badge counts
        const badges = await storage.getActivityOperationsBadges(adminId);
        res.json({ success: true, badges });
      } catch (error) {
        console.error("Error acknowledging items:", error);
        res.status(500).json({ message: "Failed to acknowledge items" });
      }
    }
  );

  // Acknowledge all items of a type (mark section as reviewed)
  app.post(
    "/api/admin/acknowledge-section",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const adminId = req.user.id;
        const { section } = req.body;
        
        if (!section) {
          return res.status(400).json({ message: "section is required" });
        }
        
        // Get all unacknowledged items for the section
        let entityIds: string[] = [];
        let entityType = "";
        
        switch (section) {
          case "routeHealth":
            entityType = "FLAGGED_CHECKLIST";
            const checklists = await storage.getAllVehicleChecklists();
            entityIds = checklists
              .filter(c => c.hasIssues)
              .map(c => c.id);
            break;
          case "driverUtilities":
            // Acknowledge both supply requests and feedback
            const supplies = await storage.getSuppliesRequests();
            const supplyIds = supplies
              .filter(s => s.status === "PENDING")
              .map(s => s.id);
            await storage.createBulkAcknowledgements(adminId, "SUPPLY_REQUEST", supplyIds);
            
            const feedback = await storage.getAllDriverFeedback();
            const feedbackIds = feedback
              .filter(f => f.status === "NEW")
              .map(f => f.id);
            await storage.createBulkAcknowledgements(adminId, "DRIVER_FEEDBACK", feedbackIds);
            break;
          case "auditLog":
            entityType = "INCIDENT";
            const incidents = await storage.getAllIncidents();
            entityIds = incidents
              .filter(i => i.status === "pending")
              .map(i => i.id);
            break;
          case "timeManagement":
            entityType = "TIME_EXCEPTION";
            // Get open time entries
            const today = new Date().toISOString().split("T")[0];
            const entries = await storage.getTimeEntriesForPayroll(
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              today
            );
            entityIds = entries
              .filter(e => !e.clockOut)
              .map(e => e.id);
            break;
          default:
            return res.status(400).json({ 
              message: "Invalid section. Must be: routeHealth, driverUtilities, auditLog, or timeManagement" 
            });
        }
        
        if (entityType && entityIds.length > 0) {
          await storage.createBulkAcknowledgements(adminId, entityType, entityIds);
        }
        
        // Return updated badge counts
        const badges = await storage.getActivityOperationsBadges(adminId);
        res.json({ success: true, badges });
      } catch (error) {
        console.error("Error acknowledging section:", error);
        res.status(500).json({ message: "Failed to acknowledge section" });
      }
    }
  );

  // ============ Route Requests Routes ============

  // Create a route request (driver)
  app.post(
    "/api/route-requests",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { routeRunId, routeId, requestType, studentId, studentName, description, priority } = req.body;
        
        if (!routeRunId || !requestType) {
          return res.status(400).json({ 
            message: "routeRunId and requestType are required" 
          });
        }
        
        const validTypes = ["MISSING_STUDENT", "UNEXPECTED_STUDENT", "WRONG_STOP", "ROSTER_CLARIFICATION"];
        if (!validTypes.includes(requestType)) {
          return res.status(400).json({ 
            message: `Invalid requestType. Must be one of: ${validTypes.join(", ")}` 
          });
        }
        
        const request = await storage.createRouteRequest({
          routeRunId,
          routeId,
          createdByUserId: driverId,
          requestType,
          studentId,
          studentName,
          description,
          priority: priority || "normal",
        });
        
        // Create audit log
        await storage.createAuditLog({
          userId: driverId,
          action: "ROUTE_REQUEST_CREATED",
          details: `Created ${requestType} request for route run ${routeRunId}`,
        });
        
        // Emit Socket.IO event for real-time updates
        const io = getSocketIO();
        if (io) {
          io.to(`route_run:${routeRunId}`).emit("route_request.created", { request });
          io.to("org:default").emit("route_request.created", { request });
        }
        
        res.status(201).json(request);
      } catch (error) {
        console.error("Error creating route request:", error);
        res.status(500).json({ message: "Failed to create route request" });
      }
    }
  );

  // Get route requests for a specific route run (driver/admin)
  app.get(
    "/api/route-requests/route-run/:routeRunId",
    requireAuth,
    async (req: any, res) => {
      try {
        const { routeRunId } = req.params;
        const requests = await storage.getRouteRequestsByRouteRun(routeRunId);
        res.json(requests);
      } catch (error) {
        console.error("Error fetching route requests:", error);
        res.status(500).json({ message: "Failed to fetch route requests" });
      }
    }
  );

  // Get all route requests (admin)
  app.get(
    "/api/admin/route-requests",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { status } = req.query;
        const requests = await storage.getAllRouteRequests(status as string | undefined);
        
        // Enrich with driver and student names
        const enrichedRequests = await Promise.all(
          requests.map(async (request) => {
            const driver = await storage.getUser(request.createdByUserId);
            let student = null;
            if (request.studentId) {
              student = await storage.getStudent(request.studentId);
            }
            let route = null;
            if (request.routeId) {
              route = await storage.getRoute(request.routeId);
            }
            return {
              ...request,
              driverName: driver?.name || "Unknown Driver",
              studentInfo: student ? { id: student.id, name: student.name } : null,
              routeName: route?.name || null,
            };
          })
        );
        
        res.json(enrichedRequests);
      } catch (error) {
        console.error("Error fetching route requests:", error);
        res.status(500).json({ message: "Failed to fetch route requests" });
      }
    }
  );

  // Get open route requests count (admin)
  app.get(
    "/api/admin/route-requests/count",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const count = await storage.getOpenRouteRequestsCount();
        res.json({ count });
      } catch (error) {
        console.error("Error fetching route request count:", error);
        res.status(500).json({ message: "Failed to fetch route request count" });
      }
    }
  );

  // Update route request status (admin)
  app.patch(
    "/api/admin/route-requests/:id",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const adminId = req.user.id;
        const { status, resolutionNote } = req.body;
        
        if (!status) {
          return res.status(400).json({ message: "status is required" });
        }
        
        const validStatuses = ["OPEN", "APPROVED", "DENIED", "RESOLVED"];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ 
            message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` 
          });
        }
        
        const existingRequest = await storage.getRouteRequestById(id);
        if (!existingRequest) {
          return res.status(404).json({ message: "Route request not found" });
        }
        
        const updated = await storage.updateRouteRequestStatus(
          id,
          status,
          adminId,
          resolutionNote
        );
        
        // Create audit log
        await storage.createAuditLog({
          userId: adminId,
          action: "ROUTE_REQUEST_UPDATED",
          details: `Updated route request ${id} to ${status}`,
        });
        
        // Emit Socket.IO event for real-time updates
        const io = getSocketIO();
        if (io) {
          io.to(`route_run:${existingRequest.routeRunId}`).emit("route_request.updated", { request: updated });
          io.to("org:default").emit("route_request.updated", { request: updated });
        }
        
        res.json(updated);
      } catch (error) {
        console.error("Error updating route request:", error);
        res.status(500).json({ message: "Failed to update route request" });
      }
    }
  );

  // Get driver's own route requests
  app.get(
    "/api/driver/route-requests",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const requests = await storage.getRouteRequestsByDriver(driverId);
        res.json(requests);
      } catch (error) {
        console.error("Error fetching driver route requests:", error);
        res.status(500).json({ message: "Failed to fetch route requests" });
      }
    }
  );

  // ============ Audit Log Routes ============

  // Get all audit logs
  app.get(
    "/api/admin/audit-logs",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const logs = await storage.getAllAuditLogs();
        res.json(logs);
      } catch (error) {
        console.error("Error fetching audit logs:", error);
        res.status(500).json({ message: "Failed to fetch audit logs" });
      }
    }
  );

  // Get audit logs filtered by role
  app.get(
    "/api/admin/audit-logs/role/:role",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { role } = req.params;
        if (!role || !["driver", "parent"].includes(role)) {
          return res.status(400).json({ message: "Invalid role. Must be: driver or parent" });
        }
        const logs = await storage.getAuditLogsByRole(role as "driver" | "parent");
        res.json(logs);
      } catch (error) {
        console.error("Error fetching audit logs by role:", error);
        res.status(500).json({ message: "Failed to fetch audit logs" });
      }
    }
  );

  // Get audit logs for a specific user
  app.get(
    "/api/admin/audit-logs/user/:userId",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { userId } = req.params;
        const logs = await storage.getAuditLogsByUser(userId);
        res.json(logs);
      } catch (error) {
        console.error("Error fetching audit logs for user:", error);
        res.status(500).json({ message: "Failed to fetch audit logs" });
      }
    }
  );

  // ============ Timecard Anomaly Detection Routes ============

  // Detect timecard anomalies
  app.get(
    "/api/admin/timecard-anomalies",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const anomalies = await storage.detectTimecardAnomalies();
        res.json(anomalies);
      } catch (error) {
        console.error("Error detecting timecard anomalies:", error);
        res.status(500).json({ message: "Failed to detect timecard anomalies" });
      }
    }
  );

  // ============ Admin Settings Routes ============

  // Get all admin settings
  app.get(
    "/api/admin/settings",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const settings = await storage.getAllAdminSettings();
        res.json(settings);
      } catch (error) {
        console.error("Error fetching admin settings:", error);
        res.status(500).json({ message: "Failed to fetch admin settings" });
      }
    }
  );

  // Get specific admin setting by key
  app.get(
    "/api/admin/settings/:key",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { key } = req.params;
        const setting = await storage.getAdminSetting(key);
        if (!setting) {
          return res.status(404).json({ message: "Setting not found" });
        }
        res.json(setting);
      } catch (error) {
        console.error("Error fetching admin setting:", error);
        res.status(500).json({ message: "Failed to fetch admin setting" });
      }
    }
  );

  // Create or update admin setting
  app.post(
    "/api/admin/settings",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { key, value, description } = req.body;
        const userId = req.user.id;

        if (!key || !value) {
          return res.status(400).json({ message: "Key and value are required" });
        }

        const setting = await storage.setAdminSetting(key, value, description, userId);
        res.json(setting);
      } catch (error) {
        console.error("Error setting admin setting:", error);
        res.status(500).json({ message: "Failed to set admin setting" });
      }
    }
  );

  // ============ Admin Data Cleanup Routes ============

  // Cleanup stale route assignments (routes that no longer exist)
  app.post(
    "/api/admin/cleanup/stale-routes",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const result = await storage.cleanupStaleRouteAssignments();
        
        // Audit log - use "deleted" action since we're removing stale records
        if (result.removed > 0) {
          await storage.createAuditLog({
            userId: req.user.id,
            userRole: "admin",
            action: "deleted",
            entityType: "student",
            entityId: "cleanup",
            description: `Cleaned up ${result.removed} stale route assignments`,
          });
        }

        res.json({
          success: true,
          message: `Cleaned up ${result.removed} stale route assignments`,
          ...result,
        });
      } catch (error) {
        console.error("Error cleaning up stale routes:", error);
        res.status(500).json({ message: "Failed to cleanup stale routes" });
      }
    }
  );

  // ============ Public Settings Routes (for drivers/parents) ============

  // Get emergency phone setting (accessible by all authenticated users)
  app.get(
    "/api/settings/emergency-phone",
    requireAuth,
    async (req, res) => {
      try {
        const setting = await storage.getAdminSetting("emergency_phone");
        if (!setting) {
          return res.json(null);
        }
        res.json({ settingValue: setting.settingValue });
      } catch (error) {
        console.error("Error fetching emergency phone setting:", error);
        res.status(500).json({ message: "Failed to fetch emergency phone setting" });
      }
    }
  );

  // ============ Admin Payroll Export Routes (BambooHR Integration) ============

  // Get drivers with BambooHR employee mapping
  app.get(
    "/api/admin/payroll/drivers",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const drivers = await storage.getDriversForPayroll();
        res.json(drivers);
      } catch (error) {
        console.error("Error fetching drivers for payroll:", error);
        res.status(500).json({ message: "Failed to fetch drivers" });
      }
    }
  );

  // Update driver's BambooHR employee ID
  app.put(
    "/api/admin/payroll/drivers/:driverId/bamboo-id",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { driverId } = req.params;
        const { bambooEmployeeId } = req.body;

        if (!bambooEmployeeId) {
          return res.status(400).json({ message: "bambooEmployeeId is required" });
        }

        const driver = await storage.updateDriverBambooId(driverId, bambooEmployeeId);
        res.json(driver);
      } catch (error) {
        console.error("Error updating driver BambooHR ID:", error);
        res.status(500).json({ message: "Failed to update BambooHR employee ID" });
      }
    }
  );

  // Calculate payroll for a pay period (preview before export)
  app.post(
    "/api/admin/payroll/calculate",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { startDate, endDate, includeOvertime } = req.body;

        if (!startDate || !endDate) {
          return res.status(400).json({ message: "startDate and endDate are required" });
        }

        const payrollData = await storage.calculatePayrollData(
          startDate,
          endDate,
          { includeOvertime: includeOvertime !== false }
        );
        res.json(payrollData);
      } catch (error) {
        console.error("Error calculating payroll:", error);
        res.status(500).json({ message: "Failed to calculate payroll data" });
      }
    }
  );

  // Create and execute payroll export to BambooHR
  app.post(
    "/api/admin/payroll/exports",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { startDate, endDate, includeOvertime } = req.body;
        const userId = req.user.id;

        if (!startDate || !endDate) {
          return res.status(400).json({ message: "startDate and endDate are required" });
        }

        // Create BambooHR service
        const { createBambooHRService } = await import("./bamboohr-service");
        const bambooHRService = createBambooHRService();

        if (!bambooHRService) {
          return res.status(400).json({ 
            message: "BambooHR integration not configured. Please set BAMBOOHR_API_KEY and BAMBOOHR_SUBDOMAIN environment variables." 
          });
        }

        // Test connection first
        const connectionTest = await bambooHRService.testConnection();
        if (!connectionTest.success) {
          return res.status(400).json({ 
            message: `BambooHR connection failed: ${connectionTest.error}` 
          });
        }

        // Calculate payroll data
        const payrollData = await storage.calculatePayrollData(
          startDate,
          endDate,
          { includeOvertime: includeOvertime !== false }
        );

        // Filter out drivers without BambooHR employee ID
        const driversWithoutMapping = payrollData.filter(d => !d.bambooEmployeeId);
        if (driversWithoutMapping.length > 0) {
          return res.status(400).json({ 
            message: `${driversWithoutMapping.length} driver(s) missing BambooHR employee ID mapping. Please map all drivers before exporting.`,
            unmappedDrivers: driversWithoutMapping.map(d => ({ id: d.driverId, name: d.driverName }))
          });
        }

        // Create export record
        const exportRecord = await storage.createPayrollExport({
          exportedBy: userId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status: "processing",
          totalDrivers: payrollData.length,
          totalHours: payrollData.reduce((sum, d) => sum + d.totalHours, 0).toFixed(2),
        }, []);

        // Export each driver's data to BambooHR
        const exportResults = [];
        for (const driver of payrollData) {
          try {
            // Step 1: Calculate hours for each shift using actual clock events
            const shiftHoursMap = new Map<string, { netHours: number; breakMinutes: number }>();
            for (const shiftId of driver.shiftIds) {
              const shiftCalc = await calculateShiftHours(shiftId, driver.driverName);
              shiftHoursMap.set(shiftId, shiftCalc);
            }

            // Step 2: Group shifts by date and accumulate total hours per day
            const dailyHoursMap = new Map<string, number>();
            const shiftsByDate = new Map<string, string[]>();

            for (const shiftId of driver.shiftIds) {
              const shift = await storage.getShift(shiftId);
              if (!shift || !shift.date) continue;

              const shiftDate = shift.date;
              const shiftCalc = shiftHoursMap.get(shiftId);
              if (!shiftCalc) continue;

              // Accumulate daily hours
              const currentDayHours = dailyHoursMap.get(shiftDate) || 0;
              dailyHoursMap.set(shiftDate, currentDayHours + shiftCalc.netHours);

              // Track shift IDs by date
              if (!shiftsByDate.has(shiftDate)) {
                shiftsByDate.set(shiftDate, []);
              }
              shiftsByDate.get(shiftDate)!.push(shiftId);
            }

            // Step 3: Apply California overtime rules at daily level
            const dateBreakdown = new Map<string, {
              regularHours: number;
              overtimeHours: number;
              doubleTimeHours: number;
              shiftIds: string[];
            }>();

            for (const [date, totalDayHours] of Array.from(dailyHoursMap.entries())) {
              let regularHours = 0;
              let overtimeHours = 0;
              let doubleTimeHours = 0;

              if (includeOvertime !== false) {
                // California daily overtime: 0-8 regular, 8-12 overtime, >12 double-time
                if (totalDayHours <= 8) {
                  regularHours = totalDayHours;
                } else if (totalDayHours <= 12) {
                  regularHours = 8;
                  overtimeHours = totalDayHours - 8;
                } else {
                  regularHours = 8;
                  overtimeHours = 4; // Hours 8-12
                  doubleTimeHours = totalDayHours - 12;
                }
              } else {
                // No overtime calculation - all hours are regular
                regularHours = totalDayHours;
              }

              dateBreakdown.set(date, {
                regularHours,
                overtimeHours,
                doubleTimeHours,
                shiftIds: shiftsByDate.get(date) || [],
              });
            }

            // Step 4: Create entry records and submit to BambooHR
            for (const [date, dayData] of Array.from(dateBreakdown.entries())) {
              const entryRecord = await storage.createPayrollExportEntry({
                exportId: exportRecord.id,
                driverId: driver.driverId,
                bambooEmployeeId: driver.bambooEmployeeId!,
                date: new Date(date),
                regularHours: dayData.regularHours.toFixed(2),
                overtimeHours: dayData.overtimeHours.toFixed(2),
                doubleTimeHours: dayData.doubleTimeHours.toFixed(2),
                totalHours: (dayData.regularHours + dayData.overtimeHours + dayData.doubleTimeHours).toFixed(2),
                shiftIds: dayData.shiftIds,
                status: "pending",
              });

              // Submit to BambooHR
              const bambooEntry = bambooHRService.convertPayrollEntryToBambooHR(entryRecord);
              const result = await bambooHRService.submitTimeEntry(bambooEntry);

              // Update entry status
              await storage.updatePayrollExportEntryStatus(
                entryRecord.id,
                result.success ? "completed" : "failed",
                result.success ? result.entryId : undefined,
                result.success ? undefined : result.error
              );

              exportResults.push({
                driverName: driver.driverName,
                date,
                success: result.success,
                error: result.error,
              });
            }
          } catch (error) {
            console.error(`Error exporting payroll for driver ${driver.driverName}:`, error);
            exportResults.push({
              driverName: driver.driverName,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        // Update export record status
        const allSuccessful = exportResults.every(r => r.success);
        await storage.updatePayrollExportStatus(
          exportRecord.id,
          allSuccessful ? "completed" : "failed",
          allSuccessful ? undefined : "Some entries failed to export",
          { results: exportResults }
        );

        res.json({
          exportId: exportRecord.id,
          status: allSuccessful ? "completed" : "failed",
          totalEntries: exportResults.length,
          successfulEntries: exportResults.filter(r => r.success).length,
          failedEntries: exportResults.filter(r => !r.success).length,
          results: exportResults,
        });
      } catch (error) {
        console.error("Error creating payroll export:", error);
        res.status(500).json({ message: "Failed to create payroll export" });
      }
    }
  );

  // Get list of payroll exports
  app.get(
    "/api/admin/payroll/exports",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const exports = await storage.getPayrollExports();
        res.json(exports);
      } catch (error) {
        console.error("Error fetching payroll exports:", error);
        res.status(500).json({ message: "Failed to fetch payroll exports" });
      }
    }
  );

  // Get details of a specific payroll export
  app.get(
    "/api/admin/payroll/exports/:exportId",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { exportId } = req.params;
        const exportRecord = await storage.getPayrollExport(exportId);
        
        if (!exportRecord) {
          return res.status(404).json({ message: "Payroll export not found" });
        }

        const entries = await storage.getPayrollExportEntries(exportId);
        
        res.json({
          ...exportRecord,
          entries,
        });
      } catch (error) {
        console.error("Error fetching payroll export details:", error);
        res.status(500).json({ message: "Failed to fetch payroll export details" });
      }
    }
  );

  // ============ Admin Import Routes ============
  // Register bulk import routes for stops and students
  registerAdminImportRoutes(app, storage, requireAuth, requireRole);

  // Get all users (admin or lead driver)
  app.get(
    "/api/admin/users",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const users = await storage.getAllUsers();
        res.json(users);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Failed to fetch users" });
      }
    }
  );

  // Update user role
  app.patch(
    "/api/admin/users/:userId/role",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { userId } = req.params;
        const { role } = req.body;
        const currentUserId = req.user.id;

        if (!role || !["admin", "driver", "parent"].includes(role)) {
          return res.status(400).json({ message: "Invalid role specified" });
        }

        // Prevent admins from demoting themselves
        if (userId === currentUserId && role !== "admin") {
          return res.status(403).json({ 
            message: "You cannot change your own role. Please ask another administrator." 
          });
        }

        // Note: Last admin check is now handled atomically in storage.updateUserRole()
        const updatedUser = await storage.updateUserRole(userId, role);
        res.json(updatedUser);
      } catch (error: any) {
        console.error("Error updating user role:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        if (error instanceof ValidationError) {
          return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to update user role" });
      }
    }
  );

  // Toggle lead driver status
  app.patch(
    "/api/admin/users/:userId/lead-driver",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { userId } = req.params;
        const { isLeadDriver } = req.body;

        if (typeof isLeadDriver !== "boolean") {
          return res.status(400).json({ message: "isLeadDriver must be a boolean" });
        }

        // Get the user and verify they are a driver
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        if (user.role !== "driver") {
          return res.status(400).json({ message: "Lead driver status can only be set for drivers" });
        }

        // Update the lead driver status
        const updatedUser = await storage.updateLeadDriverStatus(userId, isLeadDriver);
        res.json(updatedUser);
      } catch (error: any) {
        console.error("Error updating lead driver status:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to update lead driver status" });
      }
    }
  );

  // Update driver's assigned vehicle (admin only)
  app.patch(
    "/api/admin/users/:userId/assigned-vehicle",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { userId } = req.params;
        const { vehicleId } = req.body;

        // Get the user and verify they are a driver
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        if (user.role !== "driver") {
          return res.status(400).json({ message: "Assigned vehicle can only be set for drivers" });
        }

        // Validate vehicle exists if provided
        if (vehicleId) {
          const vehicle = await storage.getVehicle(vehicleId);
          if (!vehicle) {
            return res.status(404).json({ message: "Vehicle not found" });
          }
        }

        // Update the assigned vehicle (null to clear)
        const updatedUser = await storage.updateUserProfile(userId, { 
          assignedVehicleId: vehicleId || null 
        } as any);
        res.json(updatedUser);
      } catch (error: any) {
        console.error("Error updating driver assigned vehicle:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to update driver assigned vehicle" });
      }
    }
  );

  // Get all vehicles (for any authenticated user - drivers need this for checklists)
  app.get(
    "/api/vehicles",
    requireAuth,
    async (req, res) => {
      try {
        const vehicles = await storage.getAllVehicles();
        res.json(vehicles);
      } catch (error) {
        console.error("Error fetching vehicles:", error);
        res.status(500).json({ message: "Failed to fetch vehicles" });
      }
    }
  );

  // Get all vehicles (admin-specific route)
  app.get(
    "/api/admin/vehicles",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const vehicles = await storage.getAllVehicles();
        res.json(vehicles);
      } catch (error) {
        console.error("Error fetching vehicles:", error);
        res.status(500).json({ message: "Failed to fetch vehicles" });
      }
    }
  );

  // Create a new vehicle
  app.post(
    "/api/admin/vehicles",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { insertVehicleSchema } = await import("@shared/schema");
        
        // Validate request body
        const result = insertVehicleSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ 
            message: "Invalid vehicle data", 
            errors: result.error.errors 
          });
        }
        
        const newVehicle = await storage.createVehicle(result.data);
        res.json(newVehicle);
      } catch (error: any) {
        console.error("Error creating vehicle:", error);
        
        if (error.code === '23505') { // Unique constraint violation
          return res.status(400).json({ message: "A vehicle with this plate number already exists" });
        }
        
        res.status(500).json({ message: "Failed to create vehicle" });
      }
    }
  );

  // Update a vehicle
  app.put(
    "/api/admin/vehicles/:id",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { insertVehicleSchema } = await import("@shared/schema");
        
        // Validate request body
        const result = insertVehicleSchema.partial().safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ 
            message: "Invalid vehicle data", 
            errors: result.error.errors 
          });
        }
        
        const updatedVehicle = await storage.updateVehicle(req.params.id, result.data);
        res.json(updatedVehicle);
      } catch (error: any) {
        console.error("Error updating vehicle:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        if (error.code === '23505') { // Unique constraint violation
          return res.status(400).json({ message: "A vehicle with this plate number already exists" });
        }
        
        res.status(500).json({ message: "Failed to update vehicle" });
      }
    }
  );

  // Delete a vehicle
  app.delete(
    "/api/admin/vehicles/:id",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        await storage.deleteVehicle(req.params.id);
        res.json({ message: "Vehicle deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting vehicle:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        if (error instanceof ValidationError) {
          return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to delete vehicle" });
      }
    }
  );

  // Get all geofences
  app.get(
    "/api/admin/geofences",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const geofences = await storage.getAllGeofences();
        res.json(geofences);
      } catch (error) {
        console.error("Error fetching geofences:", error);
        res.status(500).json({ message: "Failed to fetch geofences" });
      }
    }
  );

  // Create a new geofence
  app.post(
    "/api/admin/geofences",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { insertGeofenceSchema } = await import("@shared/schema");
        
        // Validate request body
        const result = insertGeofenceSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ 
            message: "Invalid geofence data", 
            errors: result.error.errors 
          });
        }
        
        const newGeofence = await storage.createGeofence(result.data);
        res.json(newGeofence);
      } catch (error: any) {
        console.error("Error creating geofence:", error);
        res.status(500).json({ message: "Failed to create geofence" });
      }
    }
  );

  // Update a geofence
  app.patch(
    "/api/admin/geofences/:id",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { insertGeofenceSchema } = await import("@shared/schema");
        
        // Validate request body (partial update)
        const result = insertGeofenceSchema.partial().safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ 
            message: "Invalid geofence data", 
            errors: result.error.errors 
          });
        }
        
        const updatedGeofence = await storage.updateGeofence(id, result.data);
        res.json(updatedGeofence);
      } catch (error: any) {
        console.error("Error updating geofence:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to update geofence" });
      }
    }
  );

  // Delete a geofence
  app.delete(
    "/api/admin/geofences/:id",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        await storage.deleteGeofence(req.params.id);
        res.json({ message: "Geofence deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting geofence:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to delete geofence" });
      }
    }
  );

  // Get geofence events (audit log)
  app.get(
    "/api/admin/geofence-events",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const events = await storage.getGeofenceEvents();
        res.json(events);
      } catch (error) {
        console.error("Error fetching geofence events:", error);
        res.status(500).json({ message: "Failed to fetch geofence events" });
      }
    }
  );

  // ============ Route Group endpoints ============

  // Get all route groups
  app.get(
    "/api/admin/route-groups",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const groups = await storage.getAllRouteGroups();
        res.json(groups);
      } catch (error) {
        console.error("Error fetching route groups:", error);
        res.status(500).json({ message: "Failed to fetch route groups" });
      }
    }
  );

  // Create a new route group
  app.post(
    "/api/admin/route-groups",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { insertRouteGroupSchema } = await import("@shared/schema");
        
        const result = insertRouteGroupSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ 
            message: "Invalid route group data", 
            errors: result.error.errors 
          });
        }
        
        const newGroup = await storage.createRouteGroup(result.data);
        res.json(newGroup);
      } catch (error: any) {
        console.error("Error creating route group:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        if (error instanceof ValidationError) {
          return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to create route group" });
      }
    }
  );

  // Update a route group
  app.patch(
    "/api/admin/route-groups/:id",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { insertRouteGroupSchema } = await import("@shared/schema");
        
        const result = insertRouteGroupSchema.partial().safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ 
            message: "Invalid route group data", 
            errors: result.error.errors 
          });
        }
        
        const updatedGroup = await storage.updateRouteGroup(id, result.data);
        res.json(updatedGroup);
      } catch (error: any) {
        console.error("Error updating route group:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        if (error instanceof ValidationError) {
          return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to update route group" });
      }
    }
  );

  // Delete a route group
  app.delete(
    "/api/admin/route-groups/:id",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { id } = req.params;
        await storage.deleteRouteGroup(id);
        res.json({ message: "Route group deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting route group:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to delete route group" });
      }
    }
  );

  // ============ Route endpoints ============

  // Get all routes (admin or lead driver)
  app.get(
    "/api/admin/routes",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const routes = await storage.getAllRoutes();
        // Enrich with stop count and student count
        const enrichedRoutes = await Promise.all(
          routes.map(async (route) => {
            const stops = await storage.getRouteStops(route.id);
            const students = await storage.getStudentsByRoute(route.id);
            return { ...route, stopCount: stops.length, studentCount: students.length };
          })
        );
        res.json(enrichedRoutes);
      } catch (error) {
        console.error("Error fetching routes:", error);
        res.status(500).json({ message: "Failed to fetch routes" });
      }
    }
  );

  // Get students for a specific route (admin or lead driver)
  app.get(
    "/api/admin/routes/:routeId/students",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { routeId } = req.params;
        const students = await storage.getStudentsByRoute(routeId);
        res.json(students);
      } catch (error) {
        console.error("Error fetching route students:", error);
        res.status(500).json({ message: "Failed to fetch students for route" });
      }
    }
  );

  // Remove a student from a route (admin or lead driver)
  app.delete(
    "/api/admin/routes/:routeId/students/:studentId",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req: any, res) => {
      try {
        const { routeId, studentId } = req.params;
        
        await storage.deleteStudentRouteAssignmentByRouteAndStudent(routeId, studentId);
        
        // Log the action
        await storage.createAuditLog({
          action: "STUDENT_REMOVED_FROM_ROUTE",
          performedByUserId: req.user.id,
          targetEntityType: "student",
          targetEntityId: studentId,
          details: { routeId, studentId },
        });
        
        res.json({ message: "Student removed from route successfully" });
      } catch (error: any) {
        console.error("Error removing student from route:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to remove student from route" });
      }
    }
  );

  // Create a new route (admin or lead driver)
  app.post(
    "/api/admin/routes",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { insertRouteSchema } = await import("@shared/schema");
        
        // Validate request body
        const result = insertRouteSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ 
            message: "Invalid route data", 
            errors: result.error.errors 
          });
        }
        
        const newRoute = await storage.createRoute(result.data);
        res.json(newRoute);
      } catch (error: any) {
        console.error("Error creating route:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        if (error instanceof ValidationError) {
          return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to create route" });
      }
    }
  );

  // Update a route (admin or lead driver)
  app.patch(
    "/api/admin/routes/:id",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { insertRouteSchema } = await import("@shared/schema");
        
        // Validate request body (partial update)
        const result = insertRouteSchema.partial().safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ 
            message: "Invalid route data", 
            errors: result.error.errors 
          });
        }
        
        const updatedRoute = await storage.updateRoute(id, result.data);
        res.json(updatedRoute);
      } catch (error: any) {
        console.error("Error updating route:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        if (error instanceof ValidationError) {
          return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to update route" });
      }
    }
  );

  // Delete a route (admin or lead driver)
  app.delete(
    "/api/admin/routes/:id",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { id } = req.params;
        await storage.deleteRoute(id);
        res.json({ message: "Route deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting route:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to delete route" });
      }
    }
  );

  // Get stops for a specific route (admin or lead driver)
  app.get(
    "/api/admin/routes/:routeId/stops",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { routeId } = req.params;
        
        // Verify route exists
        const route = await storage.getRoute(routeId);
        if (!route) {
          return res.status(404).json({ message: "Route not found" });
        }
        
        const stops = await storage.getRouteStops(routeId);
        res.json(stops);
      } catch (error) {
        console.error("Error fetching route stops:", error);
        res.status(500).json({ message: "Failed to fetch route stops" });
      }
    }
  );

  // Get all stops (independent of routes) (admin or lead driver)
  app.get(
    "/api/admin/stops",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const stops = await storage.getAllStops();
        res.json(stops);
      } catch (error) {
        console.error("Error fetching stops:", error);
        res.status(500).json({ message: "Failed to fetch stops" });
      }
    }
  );

  // Create a new stop (not tied to any route) (admin or lead driver)
  app.post(
    "/api/admin/stops",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { insertStopSchema } = await import("@shared/schema");
        
        // Validate request body
        const result = insertStopSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ 
            message: "Invalid stop data", 
            errors: result.error.errors 
          });
        }
        
        const newStop = await storage.createStop(result.data);
        res.json(newStop);
      } catch (error: any) {
        console.error("Error creating stop:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        if (error instanceof ValidationError) {
          return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to create stop" });
      }
    }
  );

  // Update a stop (admin or lead driver)
  app.patch(
    "/api/admin/stops/:id",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { insertStopSchema } = await import("@shared/schema");
        
        // Validate request body (partial update)
        const result = insertStopSchema.partial().safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ 
            message: "Invalid stop data", 
            errors: result.error.errors 
          });
        }
        
        const updatedStop = await storage.updateStop(id, result.data);
        res.json(updatedStop);
      } catch (error: any) {
        console.error("Error updating stop:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        if (error instanceof ValidationError) {
          return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to update stop" });
      }
    }
  );

  // Delete a stop (admin or lead driver)
  app.delete(
    "/api/admin/stops/:id",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { id } = req.params;
        await storage.deleteStop(id);
        res.json({ message: "Stop deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting stop:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to delete stop" });
      }
    }
  );

  // Add a stop to a route (create route_stop junction) (admin or lead driver)
  app.post(
    "/api/admin/routes/:routeId/stops",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { routeId } = req.params;
        const { insertRouteStopSchema } = await import("@shared/schema");
        
        // Validate request body
        const result = insertRouteStopSchema.safeParse({
          ...req.body,
          routeId,
        });
        if (!result.success) {
          return res.status(400).json({ 
            message: "Invalid route stop data", 
            errors: result.error.errors 
          });
        }
        
        // Verify route and stop exist
        const route = await storage.getRoute(routeId);
        if (!route) {
          return res.status(404).json({ message: "Route not found" });
        }
        
        const newRouteStop = await storage.createRouteStop(result.data);
        res.json(newRouteStop);
      } catch (error: any) {
        console.error("Error adding stop to route:", error);
        res.status(500).json({ message: "Failed to add stop to route" });
      }
    }
  );

  // Update route stops (for reordering or changing scheduled times) (admin or lead driver)
  app.patch(
    "/api/admin/routes/:routeId/stops",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { routeId } = req.params;
        const { stops } = req.body; // Array of { id, stopOrder, scheduledTime }
        
        if (!Array.isArray(stops)) {
          return res.status(400).json({ message: "Stops must be an array" });
        }
        
        // Update each route stop
        await Promise.all(
          stops.map(stop =>
            storage.updateRouteStop(stop.id, {
              stopOrder: stop.stopOrder,
              scheduledTime: stop.scheduledTime,
            })
          )
        );
        
        res.json({ message: "Route stops updated successfully" });
      } catch (error: any) {
        console.error("Error updating route stops:", error);
        res.status(500).json({ message: "Failed to update route stops" });
      }
    }
  );

  // Remove a stop from a route (delete route_stop junction) (admin or lead driver)
  app.delete(
    "/api/admin/routes/:routeId/stops/:routeStopId",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { routeStopId } = req.params;
        await storage.deleteRouteStop(routeStopId);
        res.json({ message: "Stop removed from route successfully" });
      } catch (error: any) {
        console.error("Error removing stop from route:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to remove stop from route" });
      }
    }
  );

  // Get all schedules (admin or lead driver)
  app.get(
    "/api/admin/schedules",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const assignments = await storage.getAllDriverAssignments();
        // Enrich with driver and route information
        const enrichedAssignments = await Promise.all(
          assignments.map(async (assignment) => {
            const driver = await storage.getUser(assignment.driverId);
            const route = await storage.getRoute(assignment.routeId);
            
            return {
              ...assignment,
              driverName: driver
                ? `${driver.firstName} ${driver.lastName}`
                : "Unknown",
              driverEmail: driver?.email || "",
              routeName: route?.name || "Unknown",
            };
          })
        );
        res.json(enrichedAssignments);
      } catch (error) {
        console.error("Error fetching schedules:", error);
        res.status(500).json({ message: "Failed to fetch schedules" });
      }
    }
  );

  // Get all students for route assignment
  app.get(
    "/api/admin/students",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const students = await storage.getAllStudents();
        const today = new Date().toISOString().split('T')[0];
        
        // Enrich with household, route, and attendance information
        const enrichedStudents = await Promise.all(
          students.map(async (student) => {
            // Get household information
            let householdInfo = "No household";
            if (student.householdId) {
              const household = await storage.findHouseholdByPhone("");
              if (household) {
                householdInfo = household.primaryPhone;
              }
            }
            
            // Get all valid route assignments from junction table (only routes that exist and are active)
            const validAssignments = await storage.getValidStudentRouteAssignments(student.id);
            const assignedRoutes = validAssignments.map((assignment) => ({
              assignmentId: assignment.id,
              routeId: assignment.routeId,
              routeName: assignment.route?.name || "Unknown",
              routeType: assignment.route?.routeType || null,
              pickupStopId: assignment.pickupStopId,
              dropoffStopId: assignment.dropoffStopId,
            }));

            // Legacy single-route support for backwards compatibility
            // Only show if route still exists and is active
            let routeName = null;
            let pickupStop = null;
            let dropoffStop = null;

            if (student.assignedRouteId) {
              const route = await storage.getRoute(student.assignedRouteId);
              if (route && route.isActive) {
                routeName = route.name || null;
                
                const stops = await storage.getRouteStops(student.assignedRouteId);
                if (student.pickupStopId) {
                  pickupStop = stops.find(s => s.id === student.pickupStopId);
                }
                if (student.dropoffStopId) {
                  dropoffStop = stops.find(s => s.id === student.dropoffStopId);
                }
              }
            }

            // Get today's attendance (all shifts for admin overview)
            const attendanceRecords = await storage.getStudentAttendanceForDate(student.id, today);
            // Return all records, or single record for backward compatibility
            const attendance = attendanceRecords.length > 0 ? attendanceRecords[0] : null;

            return {
              ...student,
              guardianPhones: student.guardianPhones || [],
              householdInfo,
              routeName,
              pickupStop,
              dropoffStop,
              assignedRoutes, // New multi-route assignments
              attendance,
              attendanceRecords, // All AM/PM attendance records
            };
          })
        );
        res.json(enrichedStudents);
      } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).json({ message: "Failed to fetch students" });
      }
    }
  );

  // Create new student (admin)
  app.post(
    "/api/admin/students",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { insertStudentSchema } = await import("@shared/schema");
        
        // Validate request body
        const result = insertStudentSchema.safeParse(req.body);
        
        if (!result.success) {
          return res.status(400).json({ 
            message: "Invalid student data", 
            errors: result.error.errors 
          });
        }
        
        // Normalize guardian phones to digits only
        const normalizedGuardianPhones = result.data.guardianPhones.map((phone: string) => 
          phone.replace(/\D/g, '')
        );
        
        // Create or find household for primary guardian phone (digits only)
        const primaryPhone = normalizedGuardianPhones[0];
        let household = await storage.findHouseholdByPhone(primaryPhone);
        
        if (!household) {
          household = await storage.createHousehold({
            primaryPhone,
            notes: `Auto-created for student: ${result.data.firstName} ${result.data.lastName}`,
          });
        }
        
        // Create student linked to household (manually add householdId since schema excludes it)
        const studentData: any = {
          ...result.data,
          guardianPhones: normalizedGuardianPhones,
          householdId: household.id,
        };
        const newStudent = await storage.createStudent(studentData);
        
        res.json(newStudent);
      } catch (error: any) {
        console.error("Error creating student:", error);
        res.status(500).json({ message: "Failed to create student" });
      }
    }
  );

  // Update student (admin)
  app.patch(
    "/api/admin/students/:id",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const studentId = req.params.id;
        const { updateStudentSchema } = await import("@shared/schema");
        
        // Verify student exists
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        
        // Validate request body
        const result = updateStudentSchema.safeParse(req.body);
        
        if (!result.success) {
          return res.status(400).json({ 
            message: "Invalid student data", 
            errors: result.error.errors 
          });
        }
        
        // If guardian phones changed, update household
        if (result.data.guardianPhones && result.data.guardianPhones.length > 0) {
          // Normalize guardian phones to digits only
          const normalizedGuardianPhones = result.data.guardianPhones.map((phone: string) => 
            phone.replace(/\D/g, '')
          );
          
          const primaryPhone = normalizedGuardianPhones[0];
          let household = await storage.findHouseholdByPhone(primaryPhone);
          
          if (!household) {
            // Create new household if it doesn't exist
            household = await storage.createHousehold({
              primaryPhone,
              notes: `Auto-created for student: ${result.data.firstName} ${result.data.lastName}`,
            });
          }
          
          // Update student with new household and normalized phones
          const updatedStudent = await storage.updateStudent(studentId, {
            ...result.data,
            guardianPhones: normalizedGuardianPhones,
            householdId: household.id,
          } as any);
          
          res.json(updatedStudent);
        } else {
          // Update student without changing household
          const updatedStudent = await storage.updateStudent(studentId, result.data);
          res.json(updatedStudent);
        }
      } catch (error: any) {
        console.error("Error updating student:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to update student" });
      }
    }
  );

  // Assign student to route
  app.patch(
    "/api/admin/students/:id/assign-route",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const studentId = req.params.id;
        const { assignedRouteId, pickupStopId, dropoffStopId } = req.body;

        // Validate required fields
        if (!assignedRouteId) {
          return res.status(400).json({ 
            message: "Route ID is required. Use the unassign endpoint to remove route assignments." 
          });
        }

        // Verify student exists
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }

        // Verify route exists
        const route = await storage.getRoute(assignedRouteId);
        if (!route) {
          return res.status(404).json({ message: "Route not found" });
        }

        // Validate that stops belong to the route if provided
        if (pickupStopId || dropoffStopId) {
          const stops = await storage.getRouteStops(assignedRouteId);
          const stopIds = stops.map(s => s.id);
          
          if (pickupStopId && !stopIds.includes(pickupStopId)) {
            return res.status(400).json({ 
              message: "Pickup stop does not belong to the selected route" 
            });
          }
          
          if (dropoffStopId && !stopIds.includes(dropoffStopId)) {
            return res.status(400).json({ 
              message: "Dropoff stop does not belong to the selected route" 
            });
          }
        }

        const updatedStudent = await storage.updateStudent(studentId, {
          assignedRouteId,
          pickupStopId: pickupStopId || null,
          dropoffStopId: dropoffStopId || null,
        });

        res.json(updatedStudent);
      } catch (error: any) {
        console.error("Error assigning student to route:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to assign student to route" });
      }
    }
  );

  // Unassign student from route
  app.delete(
    "/api/admin/students/:id/unassign-route",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const studentId = req.params.id;
        
        const updatedStudent = await storage.updateStudent(studentId, {
          assignedRouteId: null,
          pickupStopId: null,
          dropoffStopId: null,
        });

        res.json(updatedStudent);
      } catch (error: any) {
        console.error("Error unassigning student from route:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to unassign student from route" });
      }
    }
  );

  // Delete student
  app.delete(
    "/api/admin/students/:id",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const studentId = req.params.id;
        
        await storage.deleteStudent(studentId);
        res.json({ success: true, message: "Student deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting student:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to delete student" });
      }
    }
  );

  // ============ Student-Route Assignment Routes ============

  // Get student's route assignments
  app.get(
    "/api/admin/students/:id/routes",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const studentId = req.params.id;
        const assignments = await storage.getStudentRouteAssignments(studentId);
        res.json(assignments);
      } catch (error) {
        console.error("Error fetching student route assignments:", error);
        res.status(500).json({ message: "Failed to fetch student route assignments" });
      }
    }
  );

  // Create student-route assignment
  app.post(
    "/api/admin/students/:id/routes",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const studentId = req.params.id;
        const { routeId, pickupStopId, dropoffStopId } = req.body;

        if (!routeId) {
          return res.status(400).json({ message: "Route ID is required" });
        }

        const assignment = await storage.createStudentRouteAssignment({
          studentId,
          routeId,
          pickupStopId: pickupStopId || null,
          dropoffStopId: dropoffStopId || null,
        });

        res.json(assignment);
      } catch (error: any) {
        console.error("Error creating student route assignment:", error);
        if (error instanceof ValidationError) {
          return res.status(400).json({ message: error.message });
        }
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: "Failed to create student route assignment" });
      }
    }
  );

  // Bulk create student-route assignments
  app.post(
    "/api/admin/students/:id/routes/bulk",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const studentId = req.params.id;
        const { routeIds } = req.body;

        if (!routeIds || !Array.isArray(routeIds) || routeIds.length === 0) {
          return res.status(400).json({ message: "At least one route ID is required" });
        }

        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }

        const existingAssignments = await storage.getStudentRouteAssignments(studentId);
        const existingRouteIds = new Set(existingAssignments.map(a => a.routeId));

        const results: { success: any[]; errors: string[] } = { success: [], errors: [] };

        for (const routeId of routeIds) {
          if (existingRouteIds.has(routeId)) {
            const route = await storage.getRoute(routeId);
            results.errors.push(`Already assigned to ${route?.name || 'route'}`);
            continue;
          }

          try {
            const assignment = await storage.createStudentRouteAssignment({
              studentId,
              routeId,
              pickupStopId: null,
              dropoffStopId: null,
            });
            results.success.push(assignment);
            existingRouteIds.add(routeId);
          } catch (error: any) {
            if (error instanceof NotFoundError) {
              results.errors.push(`Route not found: ${routeId}`);
            } else {
              results.errors.push(`Failed to assign route: ${routeId}`);
            }
          }
        }

        res.json({
          message: `Assigned ${results.success.length} route(s)${results.errors.length > 0 ? `, ${results.errors.length} skipped` : ''}`,
          assignments: results.success,
          errors: results.errors,
        });
      } catch (error: any) {
        console.error("Error bulk creating student route assignments:", error);
        res.status(500).json({ message: "Failed to assign routes" });
      }
    }
  );

  // Update student-route assignment stops
  app.patch(
    "/api/admin/student-routes/:assignmentId",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { assignmentId } = req.params;
        const { pickupStopId, dropoffStopId } = req.body;

        const updated = await storage.updateStudentRouteStops(
          assignmentId,
          pickupStopId || null,
          dropoffStopId || null
        );

        res.json(updated);
      } catch (error: any) {
        console.error("Error updating student route stops:", error);
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: "Failed to update student route stops" });
      }
    }
  );

  // Delete student-route assignment
  app.delete(
    "/api/admin/student-routes/:assignmentId",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { assignmentId } = req.params;
        await storage.deleteStudentRouteAssignment(assignmentId);
        res.json({ message: "Assignment deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting student route assignment:", error);
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: "Failed to delete student route assignment" });
      }
    }
  );

  // ============ Driver Assignment routes (Admin or Lead Driver) ============

  // Get all driver assignments (admin or lead driver)
  app.get(
    "/api/admin/driver-assignments",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const assignments = await storage.getAllDriverAssignments();
        // Enrich with driver, route, and vehicle information
        const enrichedAssignments = await Promise.all(
          assignments.map(async (assignment) => {
            const driver = await storage.getUser(assignment.driverId);
            const route = await storage.getRoute(assignment.routeId);
            const vehicle = assignment.vehicleId 
              ? await storage.getVehicle(assignment.vehicleId)
              : null;
            
            return {
              ...assignment,
              driver: driver || null,
              route: route || null,
              vehicle: vehicle || null,
            };
          })
        );

        res.json(enrichedAssignments);
      } catch (error) {
        console.error("Error fetching driver assignments:", error);
        res.status(500).json({ message: "Failed to fetch driver assignments" });
      }
    }
  );

  // Create new driver assignment (admin or lead driver)
  app.post(
    "/api/admin/driver-assignments",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req: any, res) => {
      try {
        const { insertDriverAssignmentSchema } = await import("@shared/schema");
        const validatedData = insertDriverAssignmentSchema.parse(req.body);
        
        // Validate driver exists and has driver role
        const driver = await storage.getUser(validatedData.driverId);
        if (!driver) {
          return res.status(404).json({ message: "Driver not found" });
        }
        if (driver.role !== "driver") {
          return res.status(400).json({ message: "User is not a driver" });
        }

        // Validate route exists
        const route = await storage.getRoute(validatedData.routeId);
        if (!route) {
          return res.status(404).json({ message: "Route not found" });
        }

        const assignment = await storage.createDriverAssignment(validatedData);
        res.json(assignment);
      } catch (error: any) {
        console.error("Error creating driver assignment:", error);
        
        if (error instanceof ValidationError) {
          return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to create driver assignment" });
      }
    }
  );

  // Update driver assignment (admin or lead driver)
  app.patch(
    "/api/admin/driver-assignments/:id",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req: any, res) => {
      try {
        const assignmentId = req.params.id;
        const updates = req.body;

        // Validate updates if provided
        if (updates.driverId) {
          const driver = await storage.getUser(updates.driverId);
          if (!driver) {
            return res.status(404).json({ message: "Driver not found" });
          }
          if (driver.role !== "driver") {
            return res.status(400).json({ message: "User is not a driver" });
          }
        }

        if (updates.routeId) {
          const route = await storage.getRoute(updates.routeId);
          if (!route) {
            return res.status(404).json({ message: "Route not found" });
          }
        }

        const updated = await storage.updateDriverAssignment(assignmentId, updates);
        res.json(updated);
      } catch (error: any) {
        console.error("Error updating driver assignment:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to update driver assignment" });
      }
    }
  );

  // Delete driver assignment (admin or lead driver)
  app.delete(
    "/api/admin/driver-assignments/:id",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req: any, res) => {
      try {
        const assignmentId = req.params.id;
        await storage.deleteDriverAssignment(assignmentId);
        res.json({ message: "Driver assignment deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting driver assignment:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to delete driver assignment" });
      }
    }
  );

  // ============ Shift routes (Admin or Lead Driver) ============

  // Get shifts by date (optionally filtered by driver) (admin or lead driver)
  app.get(
    "/api/admin/shifts",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { date, driverId, startDate, endDate } = req.query;
        
        // Support date range query without driverId (for monthly calendar view)
        if (startDate && endDate && typeof startDate === "string" && typeof endDate === "string") {
          if (driverId && typeof driverId === "string") {
            const shifts = await storage.getShiftsByDriver(driverId, startDate, endDate);
            return res.json(shifts);
          } else {
            // Query all shifts in date range
            const shifts = await storage.getShiftsByDateRange(startDate, endDate);
            return res.json(shifts);
          }
        } else if (driverId && typeof driverId === "string") {
          if (date && typeof date === "string") {
            const shifts = await storage.getShiftsByDate(date, driverId);
            return res.json(shifts);
          } else {
            const shifts = await storage.getShiftsByDriver(driverId);
            return res.json(shifts);
          }
        } else if (date && typeof date === "string") {
          const shifts = await storage.getShiftsByDate(date);
          return res.json(shifts);
        }
        
        return res.status(400).json({ message: "Please provide date, date range (startDate & endDate), or driverId" });
      } catch (error) {
        console.error("Error fetching shifts:", error);
        res.status(500).json({ message: "Failed to fetch shifts" });
      }
    }
  );

  // Create new shift (admin or lead driver)
  app.post(
    "/api/admin/shifts",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { insertShiftSchema } = await import("@shared/schema");
        const validatedData = insertShiftSchema.parse(req.body);
        
        // Validate driver exists
        const driver = await storage.getUser(validatedData.driverId);
        if (!driver || driver.role !== "driver") {
          return res.status(400).json({ message: "Invalid driver specified" });
        }
        
        // Validate route exists (if provided)
        if (validatedData.routeId) {
          const route = await storage.getRoute(validatedData.routeId);
          if (!route) {
            return res.status(400).json({ message: "Route not found" });
          }
        }
        
        // Validate vehicle exists (if provided)
        if (validatedData.vehicleId) {
          const vehicle = await storage.getVehicle(validatedData.vehicleId);
          if (!vehicle) {
            return res.status(400).json({ message: "Vehicle not found" });
          }
        }
        
        const shift = await storage.createShift(validatedData);
        res.json(shift);
      } catch (error: any) {
        console.error("Error creating shift:", error);
        
        if (error instanceof ValidationError) {
          return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to create shift" });
      }
    }
  );

  // Bulk create shifts from driver assignments (admin or lead driver)
  app.post(
    "/api/admin/shifts/bulk",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { z } = await import("zod");
        
        // Validate bulk request
        const bulkSchema = z.object({
          driverIds: z.array(z.string()).min(1, "At least one driver required"),
          startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          daysOfWeek: z.array(z.number().min(0).max(6)).min(1, "At least one day required"),
          vehicleId: z.string().min(1, "Vehicle ID is required"),
          plannedStart: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
          plannedEnd: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
        });

        const bulkData = bulkSchema.parse(req.body);
        
        // Validate all drivers exist and are drivers
        for (const driverId of bulkData.driverIds) {
          const driver = await storage.getUser(driverId);
          if (!driver || driver.role !== "driver") {
            return res.status(400).json({ message: `Invalid driver: ${driverId}` });
          }
        }
        
        // Validate date range
        const startDate = new Date(bulkData.startDate);
        const endDate = new Date(bulkData.endDate);
        if (startDate > endDate) {
          return res.status(400).json({ message: "Start date must be before end date" });
        }
        
        // Generate all dates in range that match selected days of week
        const dates: string[] = [];
        const current = new Date(startDate);
        while (current <= endDate) {
          const dayOfWeek = current.getDay();
          if (bulkData.daysOfWeek.includes(dayOfWeek)) {
            dates.push(current.toISOString().split('T')[0]);
          }
          current.setDate(current.getDate() + 1);
        }
        
        // Create shifts from driver assignments for each driver on each matching date
        const createdShifts = [];
        for (const driverId of bulkData.driverIds) {
          // Get all assignments for this driver
          const assignments = await storage.getDriverAssignmentsByDriver(driverId);
          
          if (assignments.length === 0) {
            console.warn(`No assignments found for driver: ${driverId}`);
            continue;
          }
          
          // For each date, create a shift for each assignment
          for (const date of dates) {
            for (const assignment of assignments) {
              // Fetch the route to determine shift type
              const route = await storage.getRoute(assignment.routeId);
              let shiftType: "MORNING" | "AFTERNOON" | "EXTRA" = "MORNING";
              if (route?.routeType) {
                shiftType = route.routeType as "MORNING" | "AFTERNOON" | "EXTRA";
              }
              
              const shiftData = {
                driverId,
                driverAssignmentId: assignment.id,
                date,
                shiftType,
                routeId: assignment.routeId,
                vehicleId: bulkData.vehicleId,
                plannedStart: bulkData.plannedStart,
                plannedEnd: bulkData.plannedEnd,
                status: "SCHEDULED" as const,
                notes: assignment.notes,
              };
              
              const shift = await storage.createShift(shiftData);
              createdShifts.push(shift);
            }
          }
        }
        
        res.json({ 
          count: createdShifts.length,
          shifts: createdShifts 
        });
      } catch (error: any) {
        console.error("Error creating bulk shifts:", error);
        
        if (error instanceof ValidationError) {
          return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to create bulk shifts" });
      }
    }
  );

  // Create shifts from driver assignments (admin or lead driver)
  app.post(
    "/api/admin/shifts/from-assignments",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { z } = await import("zod");
        
        // Validate request - only need date and assignmentIds
        // Vehicle/times come from the assignments themselves
        const schema = z.object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
          assignmentIds: z.array(z.string()).min(1, "At least one assignment required"),
        });

        const data = schema.parse(req.body);
        
        // Fetch all assignments and create shifts
        const createdShifts = [];
        const skipped = [];
        
        for (const assignmentId of data.assignmentIds) {
          const assignment = await storage.getDriverAssignment(assignmentId);
          if (!assignment) {
            console.warn(`Assignment not found: ${assignmentId}`);
            skipped.push({ assignmentId, reason: "Assignment not found" });
            continue;
          }
          
          // Validate required fields - must have vehicle
          if (!assignment.vehicleId) {
            console.warn(`Assignment ${assignmentId} missing required vehicle`);
            skipped.push({ 
              assignmentId, 
              reason: "Missing vehicle information" 
            });
            continue;
          }
          
          // Fetch the route to determine shift type
          const route = await storage.getRoute(assignment.routeId);
          let shiftType: "MORNING" | "AFTERNOON" | "EXTRA" = "MORNING";
          if (route?.routeType) {
            shiftType = route.routeType as "MORNING" | "AFTERNOON" | "EXTRA";
          }
          
          // Provide default times based on route type
          let plannedStart = "07:00";
          let plannedEnd = "09:00";
          
          if (shiftType === "AFTERNOON") {
            plannedStart = "14:00";
            plannedEnd = "16:00";
          } else if (shiftType === "EXTRA") {
            plannedStart = "10:00";
            plannedEnd = "12:00";
          }
          
          // Use vehicle from the assignment
          const shiftData = {
            driverId: assignment.driverId,
            driverAssignmentId: assignmentId,
            date: data.date,
            shiftType,
            routeId: assignment.routeId,
            vehicleId: assignment.vehicleId,
            plannedStart,
            plannedEnd,
            status: "SCHEDULED" as const,
            notes: assignment.notes,
          };
          
          try {
            const shift = await storage.createShift(shiftData);
            createdShifts.push(shift);
          } catch (shiftError: any) {
            // Skip if shift already exists or other error
            console.warn(`Failed to create shift for assignment ${assignmentId}:`, shiftError.message);
            skipped.push({ 
              assignmentId, 
              reason: shiftError.message || "Failed to create shift" 
            });
          }
        }
        
        res.json({ 
          count: createdShifts.length,
          shifts: createdShifts,
          skipped: skipped.length > 0 ? skipped : undefined
        });
      } catch (error: any) {
        console.error("Error creating shifts from assignments:", error);
        
        if (error instanceof ValidationError) {
          return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to create shifts from assignments" });
      }
    }
  );

  // Bulk add shifts for selected dates and drivers (admin or lead driver)
  app.post(
    "/api/admin/shifts/bulk-add",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { z } = await import("zod");
        
        const schema = z.object({
          dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")).min(1),
          driverIds: z.array(z.string()).min(1),
          vehicleId: z.string().optional(),
          plannedStart: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)").optional(),
          plannedEnd: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)").optional(),
        });

        const data = schema.parse(req.body);
        
        const createdShifts = [];
        const skipped: { driverId: string; reason: string }[] = [];
        
        // For each driver, get their assignments and create shifts for each selected date
        for (const driverId of data.driverIds) {
          const assignments = await storage.getDriverAssignmentsByDriver(driverId);
          
          // If driver has no assignments, skip with a message
          if (!assignments || assignments.length === 0) {
            skipped.push({ driverId, reason: "No driver assignments found" });
            continue;
          }
          
          for (const date of data.dates) {
            // Create shifts from all of this driver's assignments
            for (const assignment of assignments) {
              const route = await storage.getRoute(assignment.routeId);
              let shiftType: "MORNING" | "AFTERNOON" | "EXTRA" = "MORNING";
              if (route?.routeType) {
                shiftType = route.routeType as "MORNING" | "AFTERNOON" | "EXTRA";
              }
              
              // Use provided values or defaults from assignment/route type
              const defaultStart = shiftType === "MORNING" ? "07:00" : shiftType === "AFTERNOON" ? "14:00" : "09:00";
              const defaultEnd = shiftType === "MORNING" ? "09:00" : shiftType === "AFTERNOON" ? "16:00" : "11:00";
              
              const shiftData = {
                driverId: assignment.driverId,
                driverAssignmentId: assignment.id,
                date,
                shiftType,
                routeId: assignment.routeId,
                vehicleId: data.vehicleId || assignment.vehicleId || null,
                plannedStart: data.plannedStart || defaultStart,
                plannedEnd: data.plannedEnd || defaultEnd,
                status: "SCHEDULED" as const,
                notes: assignment.notes,
              };
              
              try {
                const shift = await storage.createShift(shiftData);
                createdShifts.push(shift);
              } catch (error: any) {
                // Skip if shift already exists or overlaps
                console.warn(`Skipped shift creation for driver ${driverId} on ${date}:`, error.message);
              }
            }
          }
        }
        
        res.json({ 
          count: createdShifts.length,
          shifts: createdShifts,
          skipped: skipped.length > 0 ? skipped : undefined
        });
      } catch (error: any) {
        console.error("Error bulk adding shifts:", error);
        
        if (error instanceof ValidationError) {
          return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to bulk add shifts" });
      }
    }
  );

  // Bulk delete shifts for selected dates and drivers (admin or lead driver)
  app.post(
    "/api/admin/shifts/bulk-delete",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const { z } = await import("zod");
        
        const schema = z.object({
          dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")).min(1),
          driverIds: z.array(z.string()).min(1),
        });

        const data = schema.parse(req.body);
        
        let deletedCount = 0;
        
        // For each date, get all shifts and delete those matching the selected drivers
        for (const date of data.dates) {
          const shifts = await storage.getShiftsByDate(date);
          
          for (const shift of shifts) {
            if (data.driverIds.includes(shift.driverId)) {
              try {
                await storage.deleteShift(shift.id);
                deletedCount++;
              } catch (error: any) {
                console.warn(`Failed to delete shift ${shift.id}:`, error.message);
              }
            }
          }
        }
        
        res.json({ 
          count: deletedCount 
        });
      } catch (error: any) {
        console.error("Error bulk deleting shifts:", error);
        
        if (error instanceof ValidationError) {
          return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to bulk delete shifts" });
      }
    }
  );

  // Update shift (admin or lead driver)
  app.patch(
    "/api/admin/shifts/:id",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const shiftId = req.params.id;
        const { updateShiftSchema } = await import("@shared/schema");
        const updates = updateShiftSchema.parse(req.body);
        
        // Validate references if they're being updated
        if (updates.routeId) {
          const route = await storage.getRoute(updates.routeId);
          if (!route) {
            return res.status(400).json({ message: "Route not found" });
          }
        }
        
        if (updates.vehicleId) {
          const vehicle = await storage.getVehicle(updates.vehicleId);
          if (!vehicle) {
            return res.status(400).json({ message: "Vehicle not found" });
          }
        }
        
        const updated = await storage.updateShift(shiftId, updates);
        res.json(updated);
      } catch (error: any) {
        console.error("Error updating shift:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        if (error instanceof ValidationError) {
          return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to update shift" });
      }
    }
  );

  // Delete shift (admin or lead driver)
  app.delete(
    "/api/admin/shifts/:id",
    requireAuth,
    requireAdminOrLeadDriver,
    async (req, res) => {
      try {
        const shiftId = req.params.id;
        await storage.deleteShift(shiftId);
        res.json({ message: "Shift deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting shift:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to delete shift" });
      }
    }
  );

  // Get all clock events with optional date filtering (for admin time management dashboard)
  app.get(
    "/api/admin/all-clock-events",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { startDate, endDate } = req.query;
        
        let startDateObj: Date | undefined;
        let endDateObj: Date | undefined;
        
        if (startDate && typeof startDate === "string") {
          startDateObj = new Date(startDate + "T00:00:00");
        }
        if (endDate && typeof endDate === "string") {
          endDateObj = new Date(endDate + "T23:59:59");
        }
        
        const events = await storage.getClockEventsByDriver("", startDateObj, endDateObj);
        
        // Enrich events with driver names and shift info
        const enrichedEvents = await Promise.all(
          events.map(async (event) => {
            const driver = await storage.getUser(event.driverId);
            let shiftDate: string | null = null;
            let shiftType: string | null = null;
            
            if (event.shiftId) {
              const shift = await storage.getShift(event.shiftId);
              if (shift) {
                shiftDate = shift.date;
                shiftType = shift.shiftType;
              }
            }
            
            // Build driver name
            let driverName = "Unknown Driver";
            if (driver) {
              const firstName = driver.firstName?.trim();
              const lastName = driver.lastName?.trim();
              if (firstName && lastName) {
                driverName = `${firstName} ${lastName}`;
              } else if (firstName) {
                driverName = firstName;
              } else if (lastName) {
                driverName = lastName;
              } else if (driver.email) {
                driverName = driver.email;
              }
            }
            
            return {
              ...event,
              driverName,
              shiftDate,
              shiftType,
            };
          })
        );
        
        res.json(enrichedEvents);
      } catch (error) {
        console.error("Error fetching all clock events:", error);
        res.status(500).json({ message: "Failed to fetch clock events" });
      }
    }
  );

  // Get unresolved clock events (for admin time exceptions queue)
  app.get(
    "/api/admin/clock-events/unresolved",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const events = await storage.getUnresolvedClockEvents();
        
        // Enrich events with driver names and shift info
        const enrichedEvents = await Promise.all(
          events.map(async (event) => {
            const driver = await storage.getUser(event.driverId);
            let shiftDate: string | null = null;
            let shiftType: string | null = null;
            
            if (event.shiftId) {
              const shift = await storage.getShift(event.shiftId);
              if (shift) {
                shiftDate = shift.date;
                shiftType = shift.shiftType;
              }
            }
            
            // Build driver name
            let driverName = "Unknown Driver";
            if (driver) {
              const firstName = driver.firstName?.trim();
              const lastName = driver.lastName?.trim();
              if (firstName && lastName) {
                driverName = `${firstName} ${lastName}`;
              } else if (firstName) {
                driverName = firstName;
              } else if (lastName) {
                driverName = lastName;
              } else if (driver.email) {
                driverName = driver.email;
              }
            }
            
            return {
              ...event,
              driverName,
              shiftDate,
              shiftType,
            };
          })
        );
        
        res.json(enrichedEvents);
      } catch (error) {
        console.error("Error fetching unresolved clock events:", error);
        res.status(500).json({ message: "Failed to fetch unresolved clock events" });
      }
    }
  );

  // Resolve clock event
  app.patch(
    "/api/admin/clock-events/:id/resolve",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const eventId = req.params.id;
        const { notes } = req.body;
        
        const resolved = await storage.resolveClockEvent(eventId, notes);
        res.json(resolved);
      } catch (error: any) {
        console.error("Error resolving clock event:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to resolve clock event" });
      }
    }
  );

  // Edit clock event (admin can edit any clock event)
  app.patch(
    "/api/admin/clock-events/:id/edit",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const eventId = req.params.id;
        const { updateClockEventSchema } = await import("@shared/schema");

        // Validate request body
        const result = updateClockEventSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            message: "Invalid clock event data",
            errors: result.error.errors,
          });
        }

        // Verify the clock event exists
        const event = await storage.getClockEvent(eventId);
        if (!event) {
          return res.status(404).json({ message: "Clock event not found" });
        }

        // Update the clock event
        const updatedEvent = await storage.updateClockEvent(eventId, {
          ...result.data,
          isResolved: true, // Mark as resolved after admin editing
        });

        res.json(updatedEvent);
      } catch (error) {
        console.error("Error updating clock event:", error);
        res.status(500).json({ message: "Failed to update clock event" });
      }
    }
  );

  // Auto-clockout orphaned shifts (run failsafe)
  app.post(
    "/api/admin/auto-clockout",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        let { graceHours } = req.body;
        
        // Validate graceHours is a non-negative number or use default
        if (graceHours !== undefined && graceHours !== null) {
          graceHours = Number(graceHours);
          if (isNaN(graceHours) || graceHours < 0) {
            return res.status(400).json({ message: "graceHours must be a non-negative number" });
          }
        } else {
          graceHours = undefined; // Let storage use its default
        }
        
        const result = await storage.autoClockoutOrphanedShifts(graceHours);
        
        res.json({
          message: `Auto-clockout completed. Processed ${result.processed} orphaned shift(s).`,
          processed: result.processed,
          clockedOut: result.clockedOut,
        });
      } catch (error) {
        console.error("Error running auto-clockout:", error);
        res.status(500).json({ message: "Failed to run auto-clockout" });
      }
    }
  );

  // ============ Admin Reporting Endpoints ============

  // Get driver payroll summary
  app.get(
    "/api/admin/reports/payroll/:driverId",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { driverId } = req.params;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate || typeof startDate !== "string" || typeof endDate !== "string") {
          return res.status(400).json({ message: "startDate and endDate are required" });
        }

        const { generatePayrollSummary } = await import("./utils/timeCalculations");

        // Get shifts for the date range
        const shifts = await storage.getShiftsByDriver(driverId, startDate, endDate);

        // Get clock events for all shifts
        const clockEventsMap = new Map();
        for (const shift of shifts) {
          const events = await storage.getClockEventsByShift(shift.id);
          clockEventsMap.set(shift.id, events);
        }

        const summary = generatePayrollSummary(driverId, shifts, clockEventsMap, startDate, endDate);
        res.json(summary);
      } catch (error) {
        console.error("Error generating payroll summary:", error);
        res.status(500).json({ message: "Failed to generate payroll summary" });
      }
    }
  );

  // Get single shift hours details
  app.get(
    "/api/admin/reports/shift/:shiftId",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { shiftId } = req.params;
        const { calculateShiftHours } = await import("./utils/timeCalculations");

        const shift = await storage.getShift(shiftId);
        if (!shift) {
          return res.status(404).json({ message: "Shift not found" });
        }

        const clockEvents = await storage.getClockEventsByShift(shiftId);
        const shiftHours = calculateShiftHours(shift, clockEvents);

        res.json({
          shift,
          clockEvents,
          hours: shiftHours,
        });
      } catch (error) {
        console.error("Error calculating shift hours:", error);
        res.status(500).json({ message: "Failed to calculate shift hours" });
      }
    }
  );

  // Get daily hours breakdown for all drivers
  app.get(
    "/api/admin/reports/daily-hours",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { date } = req.query;

        if (!date || typeof date !== "string") {
          return res.status(400).json({ message: "date is required" });
        }

        const { calculateDailyHours } = await import("./utils/timeCalculations");

        // Get all shifts for this date
        const shifts = await storage.getShiftsByDate(date);

        // Get clock events for all shifts
        const clockEventsMap = new Map();
        for (const shift of shifts) {
          const events = await storage.getClockEventsByShift(shift.id);
          clockEventsMap.set(shift.id, events);
        }

        const dailyHours = calculateDailyHours(shifts, clockEventsMap);

        // Group by driver
        const driverMap = new Map();
        for (const shift of shifts) {
          if (!driverMap.has(shift.driverId)) {
            const driver = await storage.getUser(shift.driverId);
            driverMap.set(shift.driverId, {
              driverId: shift.driverId,
              driverName: driver ? `${driver.firstName} ${driver.lastName}` : "Unknown",
              shifts: [],
            });
          }
        }

        // Add shifts to drivers
        for (const dayData of dailyHours) {
          for (const shiftHours of dayData.shifts) {
            const shift = shifts.find(s => s.id === shiftHours.shiftId);
            if (shift) {
              const driverData = driverMap.get(shift.driverId);
              if (driverData) {
                driverData.shifts.push(shiftHours);
              }
            }
          }
        }

        const driverBreakdown = Array.from(driverMap.values()).map(driver => ({
          ...driver,
          totalPlannedHours: driver.shifts.reduce((sum: number, s: any) => sum + s.plannedHours, 0),
          totalActualHours: driver.shifts.reduce((sum: number, s: any) => sum + (s.status === "complete" ? s.actualHours : 0), 0),
        }));

        res.json({
          date,
          dailyHours,
          driverBreakdown,
        });
      } catch (error) {
        console.error("Error calculating daily hours:", error);
        res.status(500).json({ message: "Failed to calculate daily hours" });
      }
    }
  );

  // ============ Driver routes ============

  // Get current time entry
  app.get(
    "/api/driver/current-time-entry",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const entry = await storage.getCurrentTimeEntry(driverId);
        res.json(entry || null);
      } catch (error) {
        console.error("Error fetching time entry:", error);
        res.status(500).json({ message: "Failed to fetch time entry" });
      }
    }
  );

  // Get today's shifts for driver
  app.get(
    "/api/driver/today-shifts",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const shifts = await storage.getDriverTodayShifts(driverId);
        
        // Enrich with route and vehicle information
        const enrichedShifts = await Promise.all(
          shifts.map(async (shift) => {
            const route = shift.routeId ? await storage.getRoute(shift.routeId) : null;
            const vehicle = shift.vehicleId ? await storage.getVehicle(shift.vehicleId) : null;
            
            // First try to get clock events linked by shift_id
            let clockEvents = await storage.getClockEventsByShift(shift.id);
            
            // If no linked events found, try to match by driver and date range
            if (clockEvents.length === 0 && shift.date) {
              const shiftStart = new Date(`${shift.date}T${shift.plannedStart || "00:00"}`);
              const shiftEnd = new Date(`${shift.date}T${shift.plannedEnd || "23:59"}`);
              shiftStart.setHours(shiftStart.getHours() - 1);
              shiftEnd.setHours(shiftEnd.getHours() + 2);
              
              const driverEvents = await storage.getClockEventsByDriver(
                shift.driverId,
                shiftStart,
                shiftEnd
              );
              clockEvents = driverEvents.filter(e => !e.shiftId);
            }
            
            return {
              ...shift,
              routeName: route?.name || "Unknown",
              vehicleName: vehicle?.name || "Unknown",
              vehiclePlate: vehicle?.plateNumber || "Unknown",
              clockEvents,
            };
          })
        );
        
        res.json(enrichedShifts);
      } catch (error) {
        console.error("Error fetching today's shifts:", error);
        res.status(500).json({ message: "Failed to fetch shifts" });
      }
    }
  );

  // Get driver's shifts (with date range) - enriched with clock events and calculated hours
  app.get(
    "/api/driver/shifts",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { startDate, endDate } = req.query;
        
        const shifts = await storage.getShiftsByDriver(
          driverId,
          startDate as string | undefined,
          endDate as string | undefined
        );
        
        // Enrich with route, vehicle, clock events, and calculated hours
        const { calculateShiftHours } = await import("./utils/timeCalculations");
        
        const enrichedShifts = await Promise.all(
          shifts.map(async (shift) => {
            const route = shift.routeId ? await storage.getRoute(shift.routeId) : null;
            const vehicle = shift.vehicleId ? await storage.getVehicle(shift.vehicleId) : null;
            
            // First try to get clock events linked by shift_id
            let clockEvents = await storage.getClockEventsByShift(shift.id);
            
            // If no linked events found, try to match by driver and date range
            if (clockEvents.length === 0 && shift.date) {
              const shiftStart = new Date(`${shift.date}T${shift.plannedStart || "00:00"}`);
              const shiftEnd = new Date(`${shift.date}T${shift.plannedEnd || "23:59"}`);
              // Add buffer before/after shift window (1 hour)
              shiftStart.setHours(shiftStart.getHours() - 1);
              shiftEnd.setHours(shiftEnd.getHours() + 2);
              
              const driverEvents = await storage.getClockEventsByDriver(
                shift.driverId,
                shiftStart,
                shiftEnd
              );
              
              // Filter to only include events without shiftId (unlinked general clock events)
              clockEvents = driverEvents.filter(e => !e.shiftId);
            }
            
            const calculatedHours = calculateShiftHours(shift, clockEvents);
            
            return {
              ...shift,
              routeName: route?.name || "No Route",
              vehicleName: vehicle?.name || "No Vehicle",
              vehiclePlate: vehicle?.plateNumber || "N/A",
              clockEvents,
              calculatedHours,
            };
          })
        );
        
        res.json(enrichedShifts);
      } catch (error) {
        console.error("Error fetching driver shifts:", error);
        res.status(500).json({ message: "Failed to fetch shifts" });
      }
    }
  );

  // Clock in for shift
  app.post(
    "/api/driver/shifts/:shiftId/clock-in",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { shiftId } = req.params;
        
        // Verify shift belongs to this driver
        const shift = await storage.getShift(shiftId);
        if (!shift) {
          return res.status(404).json({ message: "Shift not found" });
        }
        
        if (shift.driverId !== driverId) {
          return res.status(403).json({ message: "Not authorized for this shift" });
        }
        
        // Check if already clocked in
        const activeClockIn = await storage.getActiveClockIn(driverId);
        if (activeClockIn) {
          return res.status(400).json({ 
            message: "Already clocked in. Please clock out first.",
            activeShift: activeClockIn.shift
          });
        }
        
        // Create clock IN event
        const clockEvent = await storage.createClockEvent({
          shiftId,
          driverId,
          type: "IN",
          timestamp: new Date(),
          source: "USER",
          isResolved: true,
        });
        
        // Update shift status to ACTIVE
        await storage.updateShift(shiftId, { status: "ACTIVE" });
        
        res.json({ clockEvent, shift });
      } catch (error) {
        console.error("Error clocking in:", error);
        res.status(500).json({ message: "Failed to clock in" });
      }
    }
  );

  // Clock out from shift
  app.post(
    "/api/driver/shifts/:shiftId/clock-out",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { shiftId } = req.params;
        const { notes } = req.body;
        
        // Verify shift belongs to this driver
        const shift = await storage.getShift(shiftId);
        if (!shift) {
          return res.status(404).json({ message: "Shift not found" });
        }
        
        if (shift.driverId !== driverId) {
          return res.status(403).json({ message: "Not authorized for this shift" });
        }
        
        // Verify driver is clocked in for this shift
        const activeClockIn = await storage.getActiveClockIn(driverId);
        if (!activeClockIn || activeClockIn.clockEvent.shiftId !== shiftId) {
          return res.status(400).json({ 
            message: "Not currently clocked in for this shift" 
          });
        }
        
        // Create clock OUT event with optional notes
        const clockEvent = await storage.createClockEvent({
          shiftId,
          driverId,
          type: "OUT",
          timestamp: new Date(),
          source: "USER",
          notes: notes || null,
          isResolved: true,
        });
        
        // Update shift with notes if provided (for unscheduled shifts)
        if (notes && shift.routeId === null) {
          await storage.updateShift(shiftId, { 
            status: "COMPLETED",
            notes: notes
          });
        } else {
          await storage.updateShift(shiftId, { status: "COMPLETED" });
        }
        
        res.json({ clockEvent, shift });
      } catch (error) {
        console.error("Error clocking out:", error);
        res.status(500).json({ message: "Failed to clock out" });
      }
    }
  );

  // Start break
  app.post(
    "/api/driver/break/start",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { notes } = req.body;
        
        // Check if already on break
        const activeBreak = await storage.getActiveBreak(driverId);
        if (activeBreak) {
          return res.status(400).json({ 
            message: "Already on break. Please end current break first." 
          });
        }
        
        // Check if clocked in
        const activeClockIn = await storage.getActiveClockIn(driverId);
        const shiftId = activeClockIn?.clockEvent.shiftId || null;
        
        // Start break
        const breakEvent = await storage.startBreak(driverId, shiftId, notes);
        
        res.json({ breakEvent });
      } catch (error) {
        console.error("Error starting break:", error);
        res.status(500).json({ message: "Failed to start break" });
      }
    }
  );

  // End break
  app.post(
    "/api/driver/break/end",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { notes } = req.body;
        
        // End break
        const breakEvent = await storage.endBreak(driverId, notes);
        
        res.json({ breakEvent });
      } catch (error: any) {
        console.error("Error ending break:", error);
        const message = error.message || "Failed to end break";
        res.status(400).json({ message });
      }
    }
  );

  // Get active break status
  app.get(
    "/api/driver/break/status",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const activeBreak = await storage.getActiveBreak(driverId);
        
        res.json({ activeBreak });
      } catch (error) {
        console.error("Error getting break status:", error);
        res.status(500).json({ message: "Failed to get break status" });
      }
    }
  );

  // ============ Simple Clock In/Out System (Auto-links to shifts when possible) ============

  // Simple clock-in (auto-links to today's shift if available)
  app.post(
    "/api/driver/clock-in",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const now = new Date();
        const today = now.toISOString().split("T")[0];
        
        console.log("[clock-in] CLOCK EVENT ATTEMPT", {
          driverId,
          timestamp: now.toISOString(),
          today
        });
        
        // Check if already clocked in
        const activeClockIn = await storage.getActiveClockIn(driverId);
        if (activeClockIn) {
          console.log("[clock-in] Already clocked in, rejecting", { activeClockIn: activeClockIn.clockEvent.id });
          return res.status(400).json({ 
            message: "Already clocked in. Please clock out first." 
          });
        }
        
        // Try to find a scheduled/active shift for today to auto-link
        const todaysShifts = await storage.getShiftsByDate(today, driverId);
        let autoLinkedShiftId: string | null = null;
        
        if (todaysShifts.length > 0) {
          // Prefer SCHEDULED shifts, then ACTIVE
          const eligibleShift = todaysShifts.find(s => s.status === "SCHEDULED") 
            || todaysShifts.find(s => s.status === "ACTIVE");
          if (eligibleShift) {
            autoLinkedShiftId = eligibleShift.id;
            console.log("[clock-in] Auto-linking to shift", { shiftId: autoLinkedShiftId, shiftType: eligibleShift.shiftType });
            // Also update shift status to ACTIVE
            await storage.updateShift(eligibleShift.id, { status: "ACTIVE" });
          }
        }
        
        // Create clock IN event (auto-linked to shift if found)
        const clockEvent = await storage.createClockEvent({
          driverId,
          shiftId: autoLinkedShiftId,
          type: "IN",
          source: "USER",
          notes: null,
          isResolved: true,
        });
        
        console.log("[clock-in] CLOCK EVENT SAVED", { 
          eventId: clockEvent.id, 
          shiftId: autoLinkedShiftId,
          timestamp: clockEvent.timestamp
        });
        
        res.json({ clockEvent, autoLinkedShiftId });
      } catch (error) {
        console.error("[clock-in] Error clocking in:", error);
        res.status(500).json({ message: "Failed to clock in" });
      }
    }
  );

  // Simple clock-out (auto-links to active shift if clock-in was linked)
  app.post(
    "/api/driver/clock-out",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { notes } = req.body;
        const now = new Date();
        
        console.log("[clock-out] CLOCK EVENT ATTEMPT", {
          driverId,
          timestamp: now.toISOString(),
          notes: notes || null
        });
        
        // Check if clocked in
        const activeClockIn = await storage.getActiveClockIn(driverId);
        if (!activeClockIn) {
          console.log("[clock-out] Not clocked in, rejecting");
          return res.status(400).json({ 
            message: "Not currently clocked in" 
          });
        }
        
        // Use the same shiftId as the clock-in event for consistency
        const linkedShiftId = activeClockIn.clockEvent.shiftId;
        
        // Create clock OUT event (linked to same shift as clock-in)
        const clockEvent = await storage.createClockEvent({
          driverId,
          shiftId: linkedShiftId,
          type: "OUT",
          source: "USER",
          notes: notes || null,
          isResolved: true,
        });
        
        // If linked to a shift, mark it as COMPLETED
        if (linkedShiftId) {
          await storage.updateShift(linkedShiftId, { 
            status: "COMPLETED",
            notes: notes || undefined
          });
          console.log("[clock-out] Marked shift as COMPLETED", { shiftId: linkedShiftId });
        }
        
        console.log("[clock-out] CLOCK EVENT SAVED", { 
          eventId: clockEvent.id, 
          shiftId: linkedShiftId,
          timestamp: clockEvent.timestamp
        });
        
        res.json({ clockEvent, linkedShiftId });
      } catch (error) {
        console.error("[clock-out] Error clocking out:", error);
        res.status(500).json({ message: "Failed to clock out" });
      }
    }
  );

  // Get current clock status
  app.get(
    "/api/driver/clock-status",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const activeClockIn = await storage.getActiveClockIn(driverId);
        const activeBreak = await storage.getActiveBreak(driverId);
        
        res.json({ 
          isClockedIn: !!activeClockIn,
          clockInTime: activeClockIn?.clockEvent.timestamp || null,
          isOnBreak: !!activeBreak,
          breakStartTime: activeBreak?.timestamp || null,
        });
      } catch (error) {
        console.error("Error getting clock status:", error);
        res.status(500).json({ message: "Failed to get clock status" });
      }
    }
  );

  // Complete vehicle inspection for a shift (pre-trip)
  app.post(
    "/api/driver/shift/:shiftId/complete-inspection",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { shiftId } = req.params;
        const inspectionData = req.body;
        
        // Verify shift belongs to this driver
        const shift = await storage.getShift(shiftId);
        if (!shift) {
          return res.status(404).json({ message: "Shift not found" });
        }
        if (shift.driverId !== driverId) {
          return res.status(403).json({ message: "Not authorized for this shift" });
        }
        
        // Validate beginning mileage is provided
        if (!inspectionData.beginningMileage && inspectionData.beginningMileage !== 0) {
          return res.status(400).json({ 
            message: "Beginning mileage is required" 
          });
        }
        
        // Update shift with inspection completion timestamp
        await storage.updateShift(shiftId, {
          inspectionCompletedAt: new Date(),
        } as any);
        
        // Create a vehicle checklist record if vehicleId exists
        if (shift.vehicleId) {
          const hasIssues = inspectionData.newBodyDamage || 
            !inspectionData.emergencyEquipmentOk || 
            inspectionData.notes;

          await storage.createVehicleChecklist({
            driverId,
            vehicleId: shift.vehicleId,
            shiftId,
            checklistType: "PRE_TRIP",
            // New pre-trip fields
            headTailBrakeLightsOk: inspectionData.headTailBrakeLightsOk,
            turnSignalHazardOk: inspectionData.turnSignalHazardOk,
            interiorLightsOk: inspectionData.interiorLightsOk,
            tiresOk: inspectionData.tiresOk,
            undercarriageLeaksOk: inspectionData.undercarriageLeaksOk,
            windshieldWipersFluidOk: inspectionData.windshieldWipersFluidOk,
            windshieldConditionOk: inspectionData.windshieldConditionOk,
            mirrorsOk: inspectionData.mirrorsOk,
            newBodyDamage: inspectionData.newBodyDamage,
            doorsConditionOk: inspectionData.doorsConditionOk,
            driverPassengerAreaOk: inspectionData.driverPassengerAreaOk,
            gaugesSwitchesControlsOk: inspectionData.gaugesSwitchesControlsOk,
            acPerformanceOk: inspectionData.acPerformanceOk,
            heatPerformanceOk: inspectionData.heatPerformanceOk,
            backSeatConditionOk: inspectionData.backSeatConditionOk,
            seatbeltsOk: inspectionData.seatbeltsOk,
            emergencyEquipmentOk: inspectionData.emergencyEquipmentOk,
            beginningMileage: inspectionData.beginningMileage,
            issues: inspectionData.notes || null,
            hasIssues,
          } as any);
        }
        
        const updatedShift = await storage.getShift(shiftId);
        res.json({ shift: updatedShift });
      } catch (error) {
        console.error("Error completing inspection:", error);
        res.status(500).json({ message: "Failed to complete inspection" });
      }
    }
  );

  // Start route (requires clock-in and completed inspection)
  app.post(
    "/api/driver/shift/:shiftId/start-route",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { shiftId } = req.params;
        
        // Verify shift belongs to this driver
        const shift = await storage.getShift(shiftId);
        if (!shift) {
          return res.status(404).json({ message: "Shift not found" });
        }
        if (shift.driverId !== driverId) {
          return res.status(403).json({ message: "Not authorized for this shift" });
        }
        
        // Check if driver is clocked in
        const activeClockIn = await storage.getActiveClockIn(driverId);
        if (!activeClockIn) {
          return res.status(400).json({ 
            message: "You must clock in before starting a route" 
          });
        }
        
        // Check if inspection is completed
        if (!shift.inspectionCompletedAt) {
          return res.status(400).json({ 
            message: "Vehicle inspection must be completed before starting route" 
          });
        }
        
        // Check if route already started
        if (shift.routeStartedAt) {
          return res.status(400).json({ 
            message: "Route has already been started" 
          });
        }
        
        // Start the route
        await storage.updateShift(shiftId, {
          routeStartedAt: new Date(),
          status: "ACTIVE",
        });
        
        // Automatically initialize route progress for all stops
        if (shift.routeId) {
          await storage.initializeRouteProgress(shiftId);
          
          // Send push notification to parents on this route
          try {
            const route = await storage.getRoute(shift.routeId);
            const routeName = route?.name || "Your child's route";
            const studentsOnRoute = await storage.getStudentsByRoute(shift.routeId);
            const parentPhones = new Set<string>();
            for (const student of studentsOnRoute) {
              for (const phone of student.guardianPhones || []) {
                if (phone) parentPhones.add(phone);
              }
            }
            if (parentPhones.size > 0) {
              const parentUsers = await storage.getUsersByPhones(Array.from(parentPhones));
              const parentIds = parentUsers.map(p => p.id);
              if (parentIds.length > 0) {
                await pushNotificationService.sendToUsers(parentIds, {
                  title: "Route Started",
                  body: `${routeName} has begun. Live tracking is now available.`,
                  data: { 
                    type: "route_started", 
                    routeId: shift.routeId, 
                    shiftId,
                    deeplink: "/tracking"
                  }
                });
              }
            }
          } catch (pushError) {
            console.error("[push] Error sending route started notification:", pushError);
          }
        }
        
        const updatedShift = await storage.getShift(shiftId);
        res.json({ shift: updatedShift });
      } catch (error) {
        console.error("Error starting route:", error);
        res.status(500).json({ message: "Failed to start route" });
      }
    }
  );

  // Record student ride event (board/deboard)
  app.post(
    "/api/driver/ride-events",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { shiftId, studentId, actualStopId, eventType, notes } = req.body;

        // Verify shift belongs to this driver and route is currently running
        const shift = await storage.getShift(shiftId);
        if (!shift) {
          return res.status(404).json({ message: "Shift not found" });
        }
        if (shift.driverId !== driverId) {
          return res.status(403).json({ message: "Not authorized for this shift" });
        }
        if (!shift.routeStartedAt) {
          return res.status(400).json({ 
            message: "Route must be started before recording ride events" 
          });
        }
        if (shift.routeCompletedAt) {
          return res.status(400).json({ 
            message: "Route has already been completed. Ride events cannot be recorded after route completion." 
          });
        }

        // Validate event type
        if (eventType !== "BOARD" && eventType !== "DEBOARD") {
          return res.status(400).json({ message: "Invalid event type. Must be BOARD or DEBOARD" });
        }

        // Check for duplicate events and enforce mutual exclusivity
        if (eventType === "BOARD") {
          const existingBoardEvent = await storage.getStudentBoardEvent(shiftId, studentId);
          if (existingBoardEvent) {
            return res.status(400).json({ 
              message: "Student has already boarded on this route" 
            });
          }
          
          // Prevent boarding after deboarding
          const existingDeboardEvent = await storage.getStudentDeboardEvent(shiftId, studentId);
          if (existingDeboardEvent) {
            return res.status(400).json({ 
              message: "Cannot board - student has already deboarded on this route. Complete the route to reset." 
            });
          }
        }

        // For DEBOARD events, ensure student has already boarded
        if (eventType === "DEBOARD") {
          const boardEvent = await storage.getStudentBoardEvent(shiftId, studentId);
          if (!boardEvent) {
            return res.status(400).json({ 
              message: "Student must board before deboarding. Use the Board button first." 
            });
          }
          
          // Check for duplicate deboard
          const existingDeboardEvent = await storage.getStudentDeboardEvent(shiftId, studentId);
          if (existingDeboardEvent) {
            return res.status(400).json({ 
              message: "Student has already deboarded on this route" 
            });
          }
        }

        // Get student to find their planned stop
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }

        // Determine planned stop based on shift type
        const isPickup = shift.shiftType === "MORNING";
        const plannedStopId = isPickup ? student.pickupStopId : student.dropoffStopId;

        // Create the ride event
        const event = await storage.createRideEvent({
          shiftId,
          studentId,
          plannedStopId,
          actualStopId,
          eventType,
          notes,
        });

        // Send push notification to parents when student is picked up (BOARD event)
        if (eventType === "BOARD") {
          try {
            const stop = actualStopId ? await storage.getStop(actualStopId) : null;
            const stopName = stop?.name || "the stop";
            const studentName = `${student.firstName} ${student.lastName}`;
            
            // Get parent users from student's guardian phones
            const parentPhones = (student.guardianPhones || []).filter(Boolean);
            
            if (parentPhones.length > 0) {
              const parentUsers = await storage.getUsersByPhones(parentPhones);
              const parentIds = parentUsers.map(p => p.id);
              if (parentIds.length > 0) {
                await pushNotificationService.notifyStudentPickup(parentIds, studentName, stopName);
              }
            }
          } catch (pushError) {
            console.error("[push] Error sending pickup notification:", pushError);
          }
        }

        res.json(event);
      } catch (error) {
        console.error("Error creating ride event:", error);
        res.status(500).json({ message: "Failed to record ride event" });
      }
    }
  );

  // Finish route (requires all stops complete and all students processed)
  app.post(
    "/api/driver/shift/:shiftId/finish-route",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { shiftId } = req.params;
        const { postTripInspection } = req.body;

        // Verify shift belongs to this driver
        const shift = await storage.getShift(shiftId);
        if (!shift) {
          return res.status(404).json({ message: "Shift not found" });
        }
        if (shift.driverId !== driverId) {
          return res.status(403).json({ message: "Not authorized for this shift" });
        }

        // Check if route has been started
        if (!shift.routeStartedAt) {
          return res.status(400).json({ 
            message: "Route has not been started yet" 
          });
        }

        // Check if route is already completed
        if (shift.routeCompletedAt) {
          return res.status(400).json({ 
            message: "Route has already been completed" 
          });
        }

        // Verify all stops are completed
        const routeProgress = await storage.getRouteProgress(shiftId);
        const allStopsComplete = routeProgress.every(p => p.status === "COMPLETED" || p.status === "SKIPPED");
        if (!allStopsComplete) {
          return res.status(400).json({ 
            message: "All stops must be completed before finishing route" 
          });
        }

        // Verify all non-absent students have deboarded
        if (shift.routeId) {
          // Get students with attendance specific to this shift to avoid AM/PM confusion
          const students = await storage.getStudentsByRouteForDate(shift.routeId, shift.date, shiftId);
          const nonAbsentStudents = students.filter(s => s.attendance !== "absent");
          
          for (const student of nonAbsentStudents) {
            const deboardEvent = await storage.getStudentDeboardEvent(shiftId, student.id);
            if (!deboardEvent) {
              return res.status(400).json({ 
                message: `Not all students have deboarded. Missing: ${student.firstName} ${student.lastName}` 
              });
            }
          }
        }

        // Save post-trip inspection if provided
        if (postTripInspection && shift.vehicleId) {
          const hasIssues = postTripInspection.newDamageFound || 
            !postTripInspection.cameraUnplugged || 
            !postTripInspection.trashRemoved ||
            !postTripInspection.doorsLocked;

          await storage.createVehicleChecklist({
            driverId,
            vehicleId: shift.vehicleId,
            shiftId,
            checklistType: "POST_TRIP",
            cameraUnplugged: postTripInspection.cameraUnplugged,
            trashRemoved: postTripInspection.trashRemoved,
            newDamageFound: postTripInspection.newDamageFound,
            headlightsPoweredOff: postTripInspection.headlightsPoweredOff,
            doorsLocked: postTripInspection.doorsLocked,
            endingMileage: postTripInspection.endingMileage,
            issues: postTripInspection.notes,
            hasIssues,
          });
        }

        // Complete the route
        await storage.updateShift(shiftId, {
          routeCompletedAt: new Date(),
          status: "COMPLETED",
        });

        const updatedShift = await storage.getShift(shiftId);
        res.json({ shift: updatedShift });
      } catch (error) {
        console.error("Error finishing route:", error);
        res.status(500).json({ message: "Failed to finish route" });
      }
    }
  );

  // ============ Driver Utility Routes ============

  // Supplies Requests - Create new request
  app.post(
    "/api/driver/supplies-request",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { itemName, quantity, urgency, reason } = req.body;

        const request = await storage.createSuppliesRequest({
          driverId,
          itemName,
          quantity,
          urgency,
          reason,
        });

        res.json(request);
      } catch (error) {
        console.error("Error creating supplies request:", error);
        res.status(500).json({ message: "Failed to create supplies request" });
      }
    }
  );

  // Get driver's supplies requests
  app.get(
    "/api/driver/supplies-requests",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const requests = await storage.getSuppliesRequestsByDriver(driverId);
        res.json(requests);
      } catch (error) {
        console.error("Error fetching supplies requests:", error);
        res.status(500).json({ message: "Failed to fetch supplies requests" });
      }
    }
  );

  // Vehicle Checklists - Create new checklist
  app.post(
    "/api/driver/vehicle-checklist",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const {
          vehicleId,
          shiftId,
          checklistType,
          tiresOk,
          lightsOk,
          brakesOk,
          fluidLevelsOk,
          interiorCleanOk,
          emergencyEquipmentOk,
          mirrorsOk,
          seatsOk,
          odometerReading,
          fuelLevel,
          issues,
        } = req.body;

        const checklist = await storage.createVehicleChecklist({
          driverId,
          vehicleId,
          shiftId,
          checklistType,
          tiresOk,
          lightsOk,
          brakesOk,
          fluidLevelsOk,
          interiorCleanOk,
          emergencyEquipmentOk,
          mirrorsOk,
          seatsOk,
          odometerReading,
          fuelLevel,
          issues,
        });

        res.json(checklist);
      } catch (error) {
        console.error("Error creating vehicle checklist:", error);
        res.status(500).json({ message: "Failed to create vehicle checklist" });
      }
    }
  );

  // Get driver's vehicle checklists
  app.get(
    "/api/driver/vehicle-checklists",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const checklists = await storage.getVehicleChecklistsByDriver(driverId);
        res.json(checklists);
      } catch (error) {
        console.error("Error fetching vehicle checklists:", error);
        res.status(500).json({ message: "Failed to fetch vehicle checklists" });
      }
    }
  );

  // Get today's vehicle checklist for specific vehicle and type
  app.get(
    "/api/driver/vehicle-checklist/today",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { vehicleId, type } = req.query;

        if (!vehicleId || !type) {
          return res.status(400).json({ message: "vehicleId and type are required" });
        }

        const checklist = await storage.getTodayVehicleChecklist(
          driverId,
          vehicleId as string,
          type as "PRE_TRIP" | "POST_TRIP"
        );

        res.json(checklist || null);
      } catch (error) {
        console.error("Error fetching today's checklist:", error);
        res.status(500).json({ message: "Failed to fetch today's checklist" });
      }
    }
  );

  // Driver Feedback - Create new feedback
  app.post(
    "/api/driver/feedback",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { category, subject, description } = req.body;

        const feedback = await storage.createDriverFeedback({
          driverId,
          category,
          subject,
          description,
        });

        res.json(feedback);
      } catch (error) {
        console.error("Error creating driver feedback:", error);
        res.status(500).json({ message: "Failed to create feedback" });
      }
    }
  );

  // Get driver's feedback submissions
  app.get(
    "/api/driver/feedback",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const feedback = await storage.getDriverFeedbackByDriver(driverId);
        res.json(feedback);
      } catch (error) {
        console.error("Error fetching driver feedback:", error);
        res.status(500).json({ message: "Failed to fetch feedback" });
      }
    }
  );

  // Get active clock-in status
  app.get(
    "/api/driver/active-clock-in",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const activeClockIn = await storage.getActiveClockIn(driverId);
        res.json(activeClockIn);
      } catch (error) {
        console.error("Error fetching active clock-in:", error);
        res.status(500).json({ message: "Failed to fetch clock-in status" });
      }
    }
  );

  // Clock in for unscheduled shift (creates shift on-the-fly)
  app.post(
    "/api/driver/clock-in-unscheduled",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        
        // Check if already clocked in
        const activeClockIn = await storage.getActiveClockIn(driverId);
        if (activeClockIn) {
          return res.status(400).json({ 
            message: "Already clocked in. Please clock out first.",
            activeShift: activeClockIn.shift
          });
        }
        
        // Create an unscheduled shift for today using local time (not UTC)
        const { format } = await import("date-fns");
        const now = new Date();
        const today = format(now, "yyyy-MM-dd"); // Local date
        const currentTime = format(now, "HH:mm"); // Local time
        
        // Create shift ending 8 hours from now as a reasonable default
        const endTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const plannedEnd = format(endTime, "HH:mm");
        
        const shift = await storage.createShift({
          driverId,
          date: today,
          shiftType: "EXTRA",
          plannedStart: currentTime,
          plannedEnd,
          status: "ACTIVE",
          routeId: null,
          vehicleId: null,
          notes: "Unscheduled shift - created at clock-in",
        });
        
        // Create clock IN event
        const clockEvent = await storage.createClockEvent({
          shiftId: shift.id,
          driverId,
          type: "IN",
          timestamp: now,
          source: "USER",
          isResolved: true,
        });
        
        res.json({ shift, clockEvent });
      } catch (error) {
        console.error("Error creating unscheduled shift:", error);
        res.status(500).json({ message: "Failed to create unscheduled shift" });
      }
    }
  );

  // Legacy clock in (kept for backwards compatibility, maps to shift-based system)
  app.post(
    "/api/driver/clock-in",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;

        // Check if already clocked in
        const currentEntry = await storage.getCurrentTimeEntry(driverId);
        if (currentEntry) {
          return res.status(400).json({ message: "Already clocked in" });
        }

        const entry = await storage.createTimeEntry({
          driverId,
          clockIn: new Date(),
        });

        res.json(entry);
      } catch (error) {
        console.error("Error clocking in:", error);
        res.status(500).json({ message: "Failed to clock in" });
      }
    }
  );

  // Legacy clock out (kept for backwards compatibility)
  app.post(
    "/api/driver/clock-out",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;

        const currentEntry = await storage.getCurrentTimeEntry(driverId);
        if (!currentEntry) {
          return res.status(400).json({ message: "Not currently clocked in" });
        }

        await storage.updateTimeEntry(currentEntry.id, new Date());

        res.json({ message: "Clocked out successfully" });
      } catch (error) {
        console.error("Error clocking out:", error);
        res.status(500).json({ message: "Failed to clock out" });
      }
    }
  );

  // Update clock event (for drivers to fix mistakes)
  app.patch(
    "/api/driver/clock-event/:id",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const eventId = req.params.id;
        const { updateClockEventSchema } = await import("@shared/schema");

        // Validate request body
        const result = updateClockEventSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            message: "Invalid clock event data",
            errors: result.error.errors,
          });
        }

        // Verify the clock event exists and belongs to this driver
        const event = await storage.getClockEvent(eventId);
        if (!event) {
          return res.status(404).json({ message: "Clock event not found" });
        }
        if (event.driverId !== driverId) {
          return res.status(403).json({ message: "Not authorized to edit this clock event" });
        }

        // Update the clock event
        const updatedEvent = await storage.updateClockEvent(eventId, {
          ...result.data,
          isResolved: true, // Mark as resolved after editing
        });

        res.json(updatedEvent);
      } catch (error) {
        console.error("Error updating clock event:", error);
        res.status(500).json({ message: "Failed to update clock event" });
      }
    }
  );

  // Get today's route (based on shifts)
  app.get(
    "/api/driver/today-route",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const today = new Date().toISOString().split("T")[0];
        const shifts = await storage.getShiftsByDate(today, driverId);

        // Get the first shift for today (if any)
        const shift = shifts[0];
        if (!shift || !shift.routeId) {
          return res.json(null);
        }

        const route = await storage.getRoute(shift.routeId);
        const stops = route ? await storage.getRouteStops(route.id) : [];
        const vehicle = shift.vehicleId ? await storage.getVehicle(shift.vehicleId) : null;

        // Fetch group color if route has a groupId
        let groupColor = null;
        if (route?.groupId) {
          const group = await storage.getRouteGroup(route.groupId);
          groupColor = group?.color || null;
        }

        res.json({
          id: shift.id,
          routeId: shift.routeId,
          vehicleId: shift.vehicleId,
          date: shift.date,
          routeName: route?.name || "Unknown",
          routeColor: route?.color || null,
          groupColor,
          vehicleName: vehicle?.name || "Unknown Vehicle",
          vehiclePlate: vehicle?.plateNumber || "",
          stops,
        });
      } catch (error) {
        console.error("Error fetching today's route:", error);
        res.status(500).json({ message: "Failed to fetch route" });
      }
    }
  );

  // Get comprehensive route context for unified driver dashboard
  app.get(
    "/api/driver/route/:shiftId",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { shiftId } = req.params;

        // Get shift and verify ownership
        const shift = await storage.getShift(shiftId);
        if (!shift) {
          return res.status(404).json({ message: "Shift not found" });
        }

        if (shift.driverId !== driverId) {
          return res.status(403).json({ message: "Not authorized to view this shift" });
        }

        // Check if route has been started
        if (!shift.routeStartedAt) {
          return res.status(400).json({ 
            message: "Route has not been started. Please start the route from the dashboard first." 
          });
        }

        // Get comprehensive route context
        const routeContext = await storage.getShiftRouteContext(shiftId);
        console.log("[route-context] Active stop:", routeContext.progress.activeStopId);
        console.log("[route-context] Stops:", routeContext.stops.map(s => ({ 
          id: s.id, 
          routeStopId: s.routeStopId, 
          status: s.progress.status,
          stopOrder: s.stopOrder
        })));
        res.json(routeContext);
      } catch (error: any) {
        console.error("Error fetching route context:", error);
        if (error.name === "NotFoundError") {
          return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: "Failed to fetch route context" });
      }
    }
  );

  // Get today's shifts
  app.get(
    "/api/driver/shifts/today",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const today = new Date().toISOString().split("T")[0];
        const shifts = await storage.getShiftsByDate(today, driverId);
        res.json(shifts);
      } catch (error) {
        console.error("Error fetching today's shifts:", error);
        res.status(500).json({ message: "Failed to fetch shifts" });
      }
    }
  );

  // Get driver's weekly schedule (returns shifts for the next 7 days)
  app.get(
    "/api/driver/schedule",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        
        // Get today's date
        const today = new Date();
        const startDate = today.toISOString().split("T")[0];
        
        // Get date 6 days from now (total 7 days including today)
        const endDateObj = new Date(today);
        endDateObj.setDate(endDateObj.getDate() + 6);
        const endDate = endDateObj.toISOString().split("T")[0];
        
        // Get shifts for this driver in the date range
        const shifts = await storage.getShiftsByDriver(driverId, startDate, endDate);
        
        // Enrich with route and vehicle information
        const enrichedShifts = await Promise.all(
          shifts.map(async (shift) => {
            const route = shift.routeId ? await storage.getRoute(shift.routeId) : null;
            const vehicle = shift.vehicleId ? await storage.getVehicle(shift.vehicleId) : null;
            const stops = route ? await storage.getRouteStops(route.id) : [];
            
            return {
              id: shift.id,
              routeId: shift.routeId,
              vehicleId: shift.vehicleId,
              date: shift.date,
              startTime: shift.plannedStart,
              endTime: shift.plannedEnd,
              isActive: shift.status !== "MISSED",
              routeName: route?.name || "Unknown Route",
              vehicleName: vehicle?.name || "Unknown Vehicle",
              vehiclePlate: vehicle?.plateNumber || "",
              stops,
            };
          })
        );

        res.json(enrichedShifts);
      } catch (error) {
        console.error("Error fetching driver schedule:", error);
        res.status(500).json({ message: "Failed to fetch schedule" });
      }
    }
  );

  // Submit vehicle inspection
  app.post(
    "/api/driver/inspection",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { tiresOk, lightsOk, brakesOk, fluidLevelsOk, cleanlinessOk, notes } =
          req.body;

        // Check that driver is clocked in before allowing inspection
        const activeClockIn = await storage.getActiveClockIn(driverId);
        if (!activeClockIn) {
          return res.status(400).json({ message: "You must clock in before submitting a vehicle inspection" });
        }

        // Get driver's assigned vehicle (simplified - in production, would fetch from assignment)
        const vehicles = await storage.getAllVehicles();
        const vehicleId = vehicles[0]?.id;

        if (!vehicleId) {
          return res.status(400).json({ message: "No vehicle assigned" });
        }

        const inspection = await storage.createVehicleInspection({
          vehicleId,
          driverId,
          tiresOk,
          lightsOk,
          brakesOk,
          fluidLevelsOk,
          cleanlinessOk,
          notes: notes || null,
        });

        res.json(inspection);
      } catch (error) {
        console.error("Error submitting inspection:", error);
        res.status(500).json({ message: "Failed to submit inspection" });
      }
    }
  );

  // Get students available for incident reporting (from driver's assigned routes)
  app.get(
    "/api/driver/incident-students",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        
        // Get driver's assigned routes
        const assignments = await storage.getDriverAssignments(driverId);
        
        if (!assignments || assignments.length === 0) {
          return res.json({ routes: [], students: [] });
        }
        
        // Get unique route IDs
        const routeIds = [...new Set(assignments.map(a => a.routeId))];
        
        // Fetch routes and their students
        const routesWithStudents = await Promise.all(
          routeIds.map(async (routeId) => {
            const route = await storage.getRoute(routeId);
            if (!route) return null;
            
            // Get students assigned to this route
            const students = await storage.getStudentsByRoute(routeId);
            
            return {
              id: route.id,
              name: route.name,
              routeType: route.routeType,
              students: students.map(s => ({
                id: s.id,
                firstName: s.firstName,
                lastName: s.lastName,
                grade: s.grade,
              })),
            };
          })
        );
        
        const validRoutes = routesWithStudents.filter(Boolean);
        
        // Flatten all students with route info
        const allStudents = validRoutes.flatMap(r => 
          r!.students.map(s => ({
            ...s,
            routeId: r!.id,
            routeName: r!.name,
          }))
        );
        
        res.json({
          routes: validRoutes,
          students: allStudents,
        });
      } catch (error) {
        console.error("Error fetching incident students:", error);
        res.status(500).json({ message: "Failed to fetch students" });
      }
    }
  );

  // Report incident
  app.post(
    "/api/driver/incident",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { title, description, severity, location, studentId, routeId } = req.body;

        const incident = await storage.createIncident({
          reporterId: driverId,
          title,
          description,
          severity,
          location: location || null,
          studentId: studentId || null,
          routeId: routeId || null,
        });

        res.json(incident);
      } catch (error) {
        console.error("Error reporting incident:", error);
        res.status(500).json({ message: "Failed to report incident" });
      }
    }
  );

  // ============ Route Progress routes (Driver) ============

  // Get route progress for driver's current shift
  app.get(
    "/api/driver/route-progress",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { shiftId } = req.query;

        if (!shiftId || typeof shiftId !== "string") {
          return res.status(400).json({ message: "Shift ID is required" });
        }

        // Verify this shift belongs to the driver
        const shift = await storage.getShift(shiftId);
        if (!shift || shift.driverId !== driverId) {
          return res.status(403).json({ message: "Access denied" });
        }

        // Check if route has been started
        if (!shift.routeStartedAt) {
          return res.status(400).json({ 
            message: "Route has not been started. Please start the route from the dashboard first." 
          });
        }

        const progress = await storage.getRouteProgress(shiftId);
        res.json(progress);
      } catch (error) {
        console.error("Error fetching route progress:", error);
        res.status(500).json({ message: "Failed to fetch route progress" });
      }
    }
  );

  // Initialize route progress for a shift
  app.post(
    "/api/driver/route-progress/initialize",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { shiftId } = req.body;

        if (!shiftId) {
          return res.status(400).json({ message: "Shift ID is required" });
        }

        // Verify this shift belongs to the driver
        const shift = await storage.getShift(shiftId);
        if (!shift || shift.driverId !== driverId) {
          return res.status(403).json({ message: "Access denied" });
        }

        // Check if route has been started
        if (!shift.routeStartedAt) {
          return res.status(400).json({ 
            message: "Route has not been started. Please start the route from the dashboard first." 
          });
        }

        await storage.initializeRouteProgress(shiftId);
        const progress = await storage.getRouteProgress(shiftId);
        res.json(progress);
      } catch (error) {
        console.error("Error initializing route progress:", error);
        res.status(500).json({ message: "Failed to initialize route progress" });
      }
    }
  );

  // Update stop status
  app.post(
    "/api/driver/route-progress/update-stop",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { shiftId, routeStopId, status, notes } = req.body;

        if (!shiftId || !routeStopId || !status) {
          return res.status(400).json({ message: "Shift ID, route stop ID, and status are required" });
        }

        // Verify this shift belongs to the driver
        const shift = await storage.getShift(shiftId);
        if (!shift || shift.driverId !== driverId) {
          return res.status(403).json({ message: "Access denied" });
        }

        // Check if route has been started
        if (!shift.routeStartedAt) {
          return res.status(400).json({ 
            message: "Route has not been started. Please start the route from the dashboard first." 
          });
        }

        console.log("[update-stop] Updating stop:", { shiftId, routeStopId, status });
        const updated = await storage.updateStopStatus(shiftId, routeStopId, status, notes);
        console.log("[update-stop] Updated result:", { id: updated.id, status: updated.status, routeStopId: updated.routeStopId });
        
        // Log what the new active stop would be after this update
        const newContext = await storage.getShiftRouteContext(shiftId);
        console.log("[update-stop] After update - new activeStopId:", newContext.progress.activeStopId);
        console.log("[update-stop] Stops status:", newContext.stops.map(s => ({ 
          stopOrder: s.stopOrder, 
          routeStopId: s.routeStopId, 
          status: s.progress.status 
        })));
        
        res.json(updated);
      } catch (error: any) {
        console.error("Error updating stop status:", error);
        if (error.name === "NotFoundError") {
          return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: "Failed to update stop status" });
      }
    }
  );

  // ============ RouteRun Routes (Multi-Driver Safety) ============

  // Helper to check if user has access to a route
  async function canAccessRoute(userId: string, userRole: string, routeId: string): Promise<boolean> {
    // Admins can access all routes
    if (userRole === "admin") return true;
    
    // Drivers can access routes they are assigned to
    if (userRole === "driver") {
      const assignments = await storage.getDriverAssignmentsByDriver(userId);
      return assignments.some(a => a.routeId === routeId);
    }
    
    // Parents can access routes their children are on
    if (userRole === "parent") {
      const students = await storage.getStudentsByParent(userId);
      return students.some(s => s.assignedRouteId === routeId);
    }
    
    return false;
  }

  // Get active route run by context (route + date + shift type)
  app.get(
    "/api/route-runs/active",
    requireAuth,
    async (req: any, res) => {
      try {
        const { routeId, date, shiftType } = req.query;
        if (!routeId || !date || !shiftType) {
          return res.status(400).json({ 
            message: "routeId, date, and shiftType are required" 
          });
        }
        
        // Validate shiftType
        if (!["MORNING", "AFTERNOON", "EXTRA"].includes(shiftType as string)) {
          return res.status(400).json({ message: "Invalid shiftType" });
        }
        
        // Check authorization for this route
        const canAccess = await canAccessRoute(req.user.id, req.user.role, routeId as string);
        if (!canAccess) {
          return res.status(403).json({ message: "Not authorized to access this route" });
        }
        
        const run = await storage.getRouteRunByContext(
          routeId as string, 
          date as string, 
          shiftType as "MORNING" | "AFTERNOON" | "EXTRA"
        );
        
        if (!run) {
          return res.status(404).json({ message: "No route run found" });
        }
        
        // Include participants
        const participants = await storage.getRouteRunParticipants(run.id);
        
        res.json({ routeRun: run, participants });
      } catch (error) {
        console.error("Error getting active route run:", error);
        res.status(500).json({ message: "Failed to get route run" });
      }
    }
  );

  // Get a specific route run by ID
  app.get(
    "/api/route-runs/:id",
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const run = await storage.getRouteRun(id);
        
        if (!run) {
          return res.status(404).json({ message: "Route run not found" });
        }
        
        // Check authorization for this route
        const canAccess = await canAccessRoute(req.user.id, req.user.role, run.routeId);
        if (!canAccess) {
          return res.status(403).json({ message: "Not authorized to access this route run" });
        }
        
        const participants = await storage.getRouteRunParticipants(run.id);
        const events = await storage.getRouteRunEvents(run.id);
        
        res.json({ routeRun: run, participants, events });
      } catch (error) {
        console.error("Error getting route run:", error);
        res.status(500).json({ message: "Failed to get route run" });
      }
    }
  );

  // Create or get existing route run for a context
  app.post(
    "/api/route-runs",
    requireAuth,
    requireRole("driver", "admin"),
    async (req: any, res) => {
      try {
        const { routeId, serviceDate, shiftType, vehicleId } = req.body;
        
        if (!routeId || !serviceDate || !shiftType) {
          return res.status(400).json({ 
            message: "routeId, serviceDate, and shiftType are required" 
          });
        }
        
        // Validate shiftType
        if (!["MORNING", "AFTERNOON", "EXTRA"].includes(shiftType)) {
          return res.status(400).json({ message: "Invalid shiftType" });
        }
        
        // Check authorization for this route (drivers must be assigned)
        const canAccess = await canAccessRoute(req.user.id, req.user.role, routeId);
        if (!canAccess) {
          return res.status(403).json({ message: "Not authorized to create route run for this route" });
        }
        
        // Check if a run already exists for this context
        const existingRun = await storage.getRouteRunByContext(
          routeId, 
          serviceDate, 
          shiftType
        );
        
        if (existingRun) {
          // Return existing run instead of creating duplicate
          const participants = await storage.getRouteRunParticipants(existingRun.id);
          return res.json({ routeRun: existingRun, participants, created: false });
        }
        
        // Create new route run
        const newRun = await storage.createRouteRun({
          routeId,
          serviceDate,
          shiftType,
          vehicleId: vehicleId || null,
          status: "SCHEDULED",
        });
        
        // Log creation event
        await storage.logRouteRunEvent({
          routeRunId: newRun.id,
          eventType: "RUN_CREATED",
          actorUserId: req.user.id,
          payload: { routeId, serviceDate, shiftType },
        });
        
        res.status(201).json({ routeRun: newRun, participants: [], created: true });
      } catch (error) {
        console.error("Error creating route run:", error);
        res.status(500).json({ message: "Failed to create route run" });
      }
    }
  );

  // Start a route run (requires driver to be clocked in)
  app.post(
    "/api/route-runs/:id/start",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const driverId = req.user.id;
        
        // Get the route run
        const run = await storage.getRouteRun(id);
        if (!run) {
          return res.status(404).json({ message: "Route run not found" });
        }
        
        // Check authorization - driver must be assigned to this route
        const canAccess = await canAccessRoute(driverId, req.user.role, run.routeId);
        if (!canAccess) {
          return res.status(403).json({ message: "Not authorized to start this route run" });
        }
        
        // Check if already started
        if (run.status === "ACTIVE") {
          const participants = await storage.getRouteRunParticipants(run.id);
          return res.json({ routeRun: run, participants, message: "Route already active" });
        }
        
        if (run.status !== "SCHEDULED") {
          return res.status(400).json({ 
            message: `Cannot start route run with status: ${run.status}` 
          });
        }
        
        // Verify driver is clocked in
        const clockedIn = await storage.isDriverClockedIn(driverId);
        if (!clockedIn) {
          return res.status(400).json({ 
            message: "You must clock in before starting a route" 
          });
        }
        
        // Start the route run
        const startedRun = await storage.startRouteRun(id, driverId);
        
        // Add driver as PRIMARY participant if not already
        const existingParticipant = await storage.getParticipantRole(id, driverId);
        if (!existingParticipant) {
          await storage.addRouteRunParticipant({
            routeRunId: id,
            userId: driverId,
            role: "PRIMARY",
          });
        } else if (existingParticipant.role !== "PRIMARY") {
          await storage.updateParticipantRole(id, driverId, "PRIMARY");
        }
        
        // Log start event
        await storage.logRouteRunEvent({
          routeRunId: id,
          eventType: "RUN_STARTED",
          actorUserId: driverId,
          payload: { primaryDriverId: driverId },
        });
        
        const participants = await storage.getRouteRunParticipants(id);
        
        // Broadcast via WebSocket (legacy)
        broadcastToRoom(`route_run:${id}`, {
          type: "route_run.started",
          routeRunId: id,
          primaryDriverId: driverId,
          status: "ACTIVE",
        });
        
        // Emit via Socket.IO
        emitRouteRunStarted(id, {
          routeRun: startedRun,
          primaryDriverId: driverId,
        });
        
        res.json({ routeRun: startedRun, participants });
      } catch (error) {
        console.error("Error starting route run:", error);
        res.status(500).json({ message: "Failed to start route run" });
      }
    }
  );

  // End a route run (soft close - allows corrections)
  app.post(
    "/api/route-runs/:id/end",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const driverId = req.user.id;
        
        const run = await storage.getRouteRun(id);
        if (!run) {
          return res.status(404).json({ message: "Route run not found" });
        }
        
        // Check authorization - driver must be assigned to this route
        const canAccess = await canAccessRoute(driverId, req.user.role, run.routeId);
        if (!canAccess) {
          return res.status(403).json({ message: "Not authorized to end this route run" });
        }
        
        // Only PRIMARY can end the run
        const participant = await storage.getParticipantRole(id, driverId);
        if (!participant || participant.role !== "PRIMARY") {
          return res.status(403).json({ 
            message: "Only the primary driver can end the route" 
          });
        }
        
        if (run.status !== "ACTIVE") {
          return res.status(400).json({ 
            message: `Cannot end route run with status: ${run.status}` 
          });
        }
        
        const endedRun = await storage.endRouteRun(id);
        
        // Log end event
        await storage.logRouteRunEvent({
          routeRunId: id,
          eventType: "RUN_ENDED",
          actorUserId: driverId,
          payload: {},
        });
        
        // Broadcast via WebSocket (legacy)
        broadcastToRoom(`route_run:${id}`, {
          type: "route_run.ended",
          routeRunId: id,
          status: "ENDED_PENDING_REVIEW",
        });
        
        // Emit via Socket.IO
        emitRouteRunEndedPendingReview(id, {
          routeRun: endedRun,
        });
        
        res.json({ routeRun: endedRun });
      } catch (error) {
        console.error("Error ending route run:", error);
        res.status(500).json({ message: "Failed to end route run" });
      }
    }
  );

  // Finalize a route run (locks corrections)
  app.post(
    "/api/route-runs/:id/finalize",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        
        const run = await storage.getRouteRun(id);
        if (!run) {
          return res.status(404).json({ message: "Route run not found" });
        }
        
        if (run.status === "FINALIZED") {
          return res.json({ routeRun: run, message: "Already finalized" });
        }
        
        if (run.status !== "ENDED_PENDING_REVIEW") {
          return res.status(400).json({ 
            message: `Cannot finalize route run with status: ${run.status}` 
          });
        }
        
        const finalizedRun = await storage.finalizeRouteRun(id);
        
        // Log finalize event
        await storage.logRouteRunEvent({
          routeRunId: id,
          eventType: "RUN_FINALIZED",
          actorUserId: req.user.id,
          payload: {},
        });
        
        // Broadcast via WebSocket (legacy)
        broadcastToRoom(`route_run:${id}`, {
          type: "route_run.finalized",
          routeRunId: id,
          status: "FINALIZED",
        });
        
        // Emit via Socket.IO
        emitRouteRunFinalized(id, {
          routeRun: finalizedRun,
        });
        
        res.json({ routeRun: finalizedRun });
      } catch (error) {
        console.error("Error finalizing route run:", error);
        res.status(500).json({ message: "Failed to finalize route run" });
      }
    }
  );

  // Reopen a finalized route run (admin only - for corrections)
  app.post(
    "/api/route-runs/:id/reopen",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        
        const run = await storage.getRouteRun(id);
        if (!run) {
          return res.status(404).json({ message: "Route run not found" });
        }
        
        if (run.status !== "FINALIZED") {
          return res.status(400).json({ 
            message: `Can only reopen finalized routes. Current status: ${run.status}` 
          });
        }
        
        const reopenedRun = await storage.reopenRouteRun(id);
        
        // Log reopen event
        await storage.logRouteRunEvent({
          routeRunId: id,
          eventType: "RUN_REOPENED",
          actorUserId: req.user.id,
          payload: { reason: req.body.reason || "Admin correction" },
        });
        
        // Broadcast via WebSocket (legacy)
        broadcastToRoom(`route_run:${id}`, {
          type: "route_run.reopened",
          routeRunId: id,
          status: "ENDED_PENDING_REVIEW",
        });
        
        // Emit via Socket.IO
        emitRouteRunEndedPendingReview(id, {
          routeRun: reopenedRun,
        });
        
        res.json({ routeRun: reopenedRun });
      } catch (error) {
        console.error("Error reopening route run:", error);
        res.status(500).json({ message: "Failed to reopen route run" });
      }
    }
  );

  // Join a route run as a participant
  app.post(
    "/api/route-runs/:id/join",
    requireAuth,
    requireRole("driver", "admin"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const userId = req.user.id;
        const { role } = req.body; // Optional, defaults to VIEWER
        
        // Validate role if provided
        if (role && !["PRIMARY", "AID", "VIEWER"].includes(role)) {
          return res.status(400).json({ message: "Invalid role" });
        }
        
        const run = await storage.getRouteRun(id);
        if (!run) {
          return res.status(404).json({ message: "Route run not found" });
        }
        
        // Check authorization - must be assigned to this route
        const canAccess = await canAccessRoute(userId, req.user.role, run.routeId);
        if (!canAccess) {
          return res.status(403).json({ message: "Not authorized to join this route run" });
        }
        
        // Check if already a participant
        const existing = await storage.getParticipantRole(id, userId);
        if (existing) {
          return res.json({ participant: existing, message: "Already a participant" });
        }
        
        // Determine role - only allow PRIMARY if run not started
        let assignedRole: "PRIMARY" | "AID" | "VIEWER" = role || "VIEWER";
        if (assignedRole === "PRIMARY" && run.status === "ACTIVE" && run.primaryDriverId) {
          assignedRole = "AID"; // Can't be PRIMARY if already has one
        }
        
        const participant = await storage.addRouteRunParticipant({
          routeRunId: id,
          userId,
          role: assignedRole,
        });
        
        // Log join event
        await storage.logRouteRunEvent({
          routeRunId: id,
          eventType: "PARTICIPANT_JOINED",
          actorUserId: userId,
          payload: { role: assignedRole },
        });
        
        // Broadcast via WebSocket (legacy)
        broadcastToRoom(`route_run:${id}`, {
          type: "route_run.participant_joined",
          routeRunId: id,
          userId,
          role: assignedRole,
        });
        
        // Emit via Socket.IO
        emitParticipantJoined(id, {
          userId,
          role: assignedRole,
        });
        
        res.json({ participant });
      } catch (error) {
        console.error("Error joining route run:", error);
        res.status(500).json({ message: "Failed to join route run" });
      }
    }
  );

  // Leave a route run
  app.post(
    "/api/route-runs/:id/leave",
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const run = await storage.getRouteRun(id);
        if (!run) {
          return res.status(404).json({ message: "Route run not found" });
        }
        
        // Check if user is actually a participant (authorization via participation)
        const participant = await storage.getParticipantRole(id, userId);
        if (!participant) {
          return res.status(403).json({ message: "You are not a participant of this route run" });
        }
        
        // PRIMARY cannot leave while route is active
        if (participant.role === "PRIMARY" && run.status === "ACTIVE") {
          return res.status(400).json({ 
            message: "Primary driver cannot leave an active route. End the route first." 
          });
        }
        
        await storage.removeRouteRunParticipant(id, userId);
        
        // Log leave event
        await storage.logRouteRunEvent({
          routeRunId: id,
          eventType: "PARTICIPANT_LEFT",
          actorUserId: userId,
          payload: {},
        });
        
        // Broadcast via WebSocket (legacy)
        broadcastToRoom(`route_run:${id}`, {
          type: "route_run.participant_left",
          routeRunId: id,
          userId,
        });
        
        // Emit via Socket.IO
        emitParticipantLeft(id, {
          userId,
        });
        
        res.json({ success: true });
      } catch (error) {
        console.error("Error leaving route run:", error);
        res.status(500).json({ message: "Failed to leave route run" });
      }
    }
  );

  // Get route run events (audit log)
  app.get(
    "/api/route-runs/:id/events",
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        
        const run = await storage.getRouteRun(id);
        if (!run) {
          return res.status(404).json({ message: "Route run not found" });
        }
        
        // Check authorization for this route
        const canAccess = await canAccessRoute(req.user.id, req.user.role, run.routeId);
        if (!canAccess) {
          return res.status(403).json({ message: "Not authorized to view events for this route run" });
        }
        
        const events = await storage.getRouteRunEvents(id);
        res.json({ events });
      } catch (error) {
        console.error("Error getting route run events:", error);
        res.status(500).json({ message: "Failed to get events" });
      }
    }
  );

  // Get route run summary (for review screen after ending route)
  app.get(
    "/api/route-runs/:id/summary",
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        
        const run = await storage.getRouteRun(id);
        if (!run) {
          return res.status(404).json({ message: "Route run not found" });
        }
        
        // Check authorization
        const canAccess = await canAccessRoute(req.user.id, req.user.role, run.routeId);
        if (!canAccess) {
          return res.status(403).json({ message: "Not authorized to view this route run" });
        }
        
        // Get route details
        const route = await storage.getRoute(run.routeId);
        
        // Get participants
        const participants = await storage.getRouteRunParticipants(id);
        const participantsWithDetails = await Promise.all(
          participants.map(async (p) => {
            const user = await storage.getUser(p.userId);
            return {
              ...p,
              firstName: user?.firstName,
              lastName: user?.lastName,
            };
          })
        );
        
        // Get route stops with completion status
        const routeStops = await storage.getRouteStops(run.routeId);
        const events = await storage.getRouteRunEvents(id);
        
        const completedStops = events.filter(e => 
          e.eventType === "STOP_COMPLETED" || e.eventType === "STOP_SKIPPED"
        ).length;
        
        // Get students on this route with their attendance for this run's date
        const students = await storage.getStudentsByRouteForDate(run.routeId, run.serviceDate, null);
        
        // Get attendance change logs for this run
        const attendanceLogs = await storage.getAttendanceChangeLogs(id);
        
        // Calculate attendance breakdown
        const attendanceBreakdown = {
          total: students.length,
          rode: students.filter(s => s.attendance === "riding").length,
          absentPremarked: students.filter(s => s.attendance === "absent").length,
          pending: students.filter(s => s.attendance === "PENDING").length,
        };
        
        // Get events and map student boarding/deboarding
        const studentEvents = events.filter(e => 
          e.eventType === "STUDENT_BOARDED" || e.eventType === "STUDENT_DEBOARDED"
        );
        
        // Build per-student timeline
        const studentDetails = students.map(student => {
          const boardingEvent = studentEvents.find(
            e => e.eventType === "STUDENT_BOARDED" && 
            (e.payload as any)?.studentId === student.id
          );
          const deboardingEvent = studentEvents.find(
            e => e.eventType === "STUDENT_DEBOARDED" && 
            (e.payload as any)?.studentId === student.id
          );
          
          // Find last modification
          const studentLogs = attendanceLogs.filter(l => l.studentId === student.id);
          const lastModified = studentLogs[0]; // Already ordered by desc
          
          return {
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            attendance: student.attendance,
            pickupStopId: (boardingEvent?.payload as any)?.stopId,
            pickupTime: boardingEvent?.createdAt,
            dropoffStopId: (deboardingEvent?.payload as any)?.stopId,
            dropoffTime: deboardingEvent?.createdAt,
            lastModifiedBy: lastModified?.actorUserId,
            lastModifiedAt: lastModified?.createdAt,
          };
        });
        
        // Calculate duration
        let durationMinutes = null;
        if (run.startedAt && run.endedAt) {
          durationMinutes = Math.round(
            (new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()) / 60000
          );
        }
        
        res.json({
          routeRun: run,
          route: {
            id: route?.id,
            name: route?.name,
            shiftType: run.shiftType,
          },
          participants: participantsWithDetails,
          stops: {
            total: routeStops.length,
            completed: completedStops,
          },
          attendance: attendanceBreakdown,
          students: studentDetails,
          mileage: {
            start: run.startMileage,
            end: run.endMileage,
          },
          duration: {
            startedAt: run.startedAt,
            endedAt: run.endedAt,
            minutes: durationMinutes,
          },
          attendanceLogs,
        });
      } catch (error) {
        console.error("Error getting route run summary:", error);
        res.status(500).json({ message: "Failed to get summary" });
      }
    }
  );

  // Correct attendance for a route run (drivers while ENDED_PENDING_REVIEW, admins anytime)
  app.post(
    "/api/route-runs/:id/correct-attendance",
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { studentId, newStatus, reason } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;
        
        if (!studentId || !newStatus) {
          return res.status(400).json({ message: "studentId and newStatus are required" });
        }
        
        if (!["PENDING", "riding", "absent"].includes(newStatus)) {
          return res.status(400).json({ message: "Invalid status. Must be PENDING, riding, or absent" });
        }
        
        const run = await storage.getRouteRun(id);
        if (!run) {
          return res.status(404).json({ message: "Route run not found" });
        }
        
        // Authorization check
        const canAccess = await canAccessRoute(userId, userRole, run.routeId);
        if (!canAccess) {
          return res.status(403).json({ message: "Not authorized for this route" });
        }
        
        // Status-based permission check
        if (run.status === "FINALIZED") {
          // Only admins can correct after finalization
          if (userRole !== "admin") {
            return res.status(403).json({ 
              message: "Route is finalized. Only admins can make corrections." 
            });
          }
        } else if (run.status !== "ENDED_PENDING_REVIEW" && run.status !== "ACTIVE") {
          return res.status(400).json({ 
            message: `Cannot correct attendance for route with status: ${run.status}` 
          });
        }
        
        // Get current attendance state
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        
        // Get current attendance for this student on this date
        const currentAttendance = await storage.getStudentAttendance(studentId, run.serviceDate, null);
        const oldStatus = currentAttendance?.status || "PENDING";
        
        // Update attendance
        const updatedAttendance = await storage.setStudentAttendance({
          studentId,
          date: run.serviceDate,
          status: newStatus,
          markedByUserId: userId,
          shiftId: null, // Route runs may not have a shift association
          routeRunId: id,
        });
        
        // Log the change to audit table
        await storage.logAttendanceChange({
          routeRunId: id,
          studentId,
          actorUserId: userId,
          oldValueJson: { status: oldStatus },
          newValueJson: { status: newStatus },
          reason: reason || null,
        });
        
        // Log event
        await storage.logRouteRunEvent({
          routeRunId: id,
          eventType: "ATTENDANCE_UPDATED",
          actorUserId: userId,
          payload: { 
            studentId, 
            oldStatus, 
            newStatus,
            reason,
          },
        });
        
        // Emit via Socket.IO
        emitAttendanceUpdated(id, {
          studentId,
          status: newStatus,
          updatedBy: userId,
        });
        
        res.json({ 
          success: true, 
          attendance: updatedAttendance,
          message: `Attendance updated from ${oldStatus} to ${newStatus}` 
        });
      } catch (error) {
        console.error("Error correcting attendance:", error);
        res.status(500).json({ message: "Failed to correct attendance" });
      }
    }
  );

  // Update route run mileage
  app.patch(
    "/api/route-runs/:id/mileage",
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { startMileage, endMileage } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;
        
        const run = await storage.getRouteRun(id);
        if (!run) {
          return res.status(404).json({ message: "Route run not found" });
        }
        
        // Check authorization
        const canAccess = await canAccessRoute(userId, userRole, run.routeId);
        if (!canAccess) {
          return res.status(403).json({ message: "Not authorized for this route" });
        }
        
        // Only allow updates while not finalized (or admin override)
        if (run.status === "FINALIZED" && userRole !== "admin") {
          return res.status(403).json({ 
            message: "Route is finalized. Only admins can update mileage." 
          });
        }
        
        const updatedRun = await storage.updateRouteRun(id, {
          startMileage: startMileage !== undefined ? startMileage : run.startMileage,
          endMileage: endMileage !== undefined ? endMileage : run.endMileage,
        });
        
        res.json({ routeRun: updatedRun });
      } catch (error) {
        console.error("Error updating mileage:", error);
        res.status(500).json({ message: "Failed to update mileage" });
      }
    }
  );

  // Get attendance change logs for a route run
  app.get(
    "/api/route-runs/:id/attendance-logs",
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        
        const run = await storage.getRouteRun(id);
        if (!run) {
          return res.status(404).json({ message: "Route run not found" });
        }
        
        // Check authorization
        const canAccess = await canAccessRoute(req.user.id, req.user.role, run.routeId);
        if (!canAccess) {
          return res.status(403).json({ message: "Not authorized to view this route run" });
        }
        
        const logs = await storage.getAttendanceChangeLogs(id);
        
        // Enrich with user and student details
        const enrichedLogs = await Promise.all(
          logs.map(async (log) => {
            const actor = await storage.getUser(log.actorUserId);
            const student = await storage.getStudent(log.studentId);
            return {
              ...log,
              actorName: actor ? `${actor.firstName} ${actor.lastName}` : "Unknown",
              studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
            };
          })
        );
        
        res.json({ logs: enrichedLogs });
      } catch (error) {
        console.error("Error getting attendance logs:", error);
        res.status(500).json({ message: "Failed to get attendance logs" });
      }
    }
  );

  // ============ Route Progress routes (Parent) ============

  // Get route progress for student
  app.get(
    "/api/parent/student-progress/:studentId",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.id;
        const { studentId } = req.params;
        const date = req.query.date || new Date().toISOString().split("T")[0];

        // Verify parent has access to this student
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }

        const household = await storage.getUserHousehold(parentId);
        const studentHousehold = await storage.getStudentsByHousehold(student.householdId);
        
        const hasAccess = studentHousehold.some((s) => s.id === studentId);
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied" });
        }

        const progress = await storage.getStopProgressForStudent(studentId, date as string);
        res.json(progress);
      } catch (error) {
        console.error("Error fetching student progress:", error);
        res.status(500).json({ message: "Failed to fetch student progress" });
      }
    }
  );

  // ============ Parent routes ============

  // Connect children by phone number matching
  app.post(
    "/api/parent/connect-children",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);
        
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Check if user has a phone number
        if (!user.phoneNumber) {
          return res.status(400).json({ 
            message: "Phone number required", 
            requiresPhoneNumber: true 
          });
        }
        
        // Find household by phone number
        const household = await storage.findHouseholdByPhone(user.phoneNumber);
        
        if (!household) {
          return res.json({ 
            success: true, 
            message: "No matching children found", 
            linkedCount: 0 
          });
        }
        
        // Check if user is already linked to this household
        const existingHousehold = await storage.getUserHousehold(userId);
        
        if (!existingHousehold || existingHousehold.id !== household.id) {
          // Link user to household
          await storage.linkUserToHousehold({
            userId,
            householdId: household.id,
            roleInHousehold: "SECONDARY",
          });
          console.log(`Manually linked user ${userId} to household ${household.id} via phone ${user.phoneNumber}`);
        }
        
        // Get the students in this household
        const students = await storage.getStudentsByParent(userId);
        
        res.json({ 
          success: true, 
          message: `Successfully connected to ${students.length} child${students.length !== 1 ? 'ren' : ''}`, 
          linkedCount: students.length 
        });
      } catch (error) {
        console.error("Error connecting children:", error);
        res.status(500).json({ message: "Failed to connect children" });
      }
    }
  );

  // Get parent's students
  app.get(
    "/api/parent/students",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.id;
        const students = await storage.getStudentsByParent(parentId);
        const today = new Date().toISOString().split('T')[0];

        // Cache for route progress by shiftId to avoid duplicate queries
        const shiftProgressCache = new Map();

        // Enrich with route, stop details, driver info, attendance, and route progress
        const enrichedStudents = await Promise.all(
          students.map(async (student) => {
            let routeName = null;
            let pickupStop = null;
            let dropoffStop = null;
            let driverId = null;
            let driverName = null;
            let driverPhone = null;
            let activeShiftId = null;
            let stopsRemaining = null;
            let totalStops = null;
            let stopsCompleted = null;
            let routeProgressPct = null;
            let studentPickedUp = false;
            let routeStatus = "inactive";

            // First check for route assignments in studentRoutes junction table (multi-route system)
            // Only return assignments for routes that exist AND are active
            let effectiveRouteId = null;
            let effectivePickupStopId = null;
            let effectiveDropoffStopId = null;
            let effectiveRoute = null;

            const validAssignments = await storage.getValidStudentRouteAssignments(student.id);
            if (validAssignments && validAssignments.length > 0) {
              // Use the first valid route assignment (route exists and is active)
              const assignment = validAssignments[0];
              effectiveRouteId = assignment.routeId;
              effectivePickupStopId = assignment.pickupStopId;
              effectiveDropoffStopId = assignment.dropoffStopId;
              effectiveRoute = assignment.route;
            } else if (student.assignedRouteId) {
              // Fall back to legacy single-route fields for backward compatibility
              // But only if the route still exists and is active
              const legacyRoute = await storage.getRoute(student.assignedRouteId);
              if (legacyRoute && legacyRoute.isActive) {
                effectiveRouteId = student.assignedRouteId;
                effectivePickupStopId = student.pickupStopId;
                effectiveDropoffStopId = student.dropoffStopId;
                effectiveRoute = legacyRoute;
              }
            }

            if (effectiveRouteId && effectiveRoute) {
              routeName = effectiveRoute.name || null;

              // Get current driver assignment for this route (assignments are ongoing, not date-specific)
              const assignments = await storage.getDriverAssignmentsByRoute(effectiveRouteId);
              const activeAssignment = assignments.find(a => a.isActive !== false);
              if (activeAssignment) {
                const driver = await storage.getUser(activeAssignment.driverId);
                if (driver) {
                  driverId = driver.id;
                  driverName = `${driver.firstName} ${driver.lastName}`;
                  driverPhone = driver.phone || null;

                  // Find active shift for this driver to get route progress
                  const driverShifts = await storage.getShiftsByDriver(driver.id);
                  const activeShift = driverShifts.find(shift => 
                    shift.routeId === effectiveRouteId && 
                    shift.status === "ACTIVE"
                  );

                  if (activeShift) {
                    activeShiftId = activeShift.id;
                    routeStatus = "active";

                    // Get or fetch route progress from cache
                    let routeProgress = shiftProgressCache.get(activeShift.id);
                    if (!routeProgress) {
                      routeProgress = await storage.getRouteProgress(activeShift.id);
                      shiftProgressCache.set(activeShift.id, routeProgress);
                    }

                    if (routeProgress && routeProgress.length > 0) {
                      totalStops = routeProgress.length;
                      stopsCompleted = routeProgress.filter((p: any) => p.progress.status === "COMPLETED").length;
                      routeProgressPct = Math.round((stopsCompleted / totalStops) * 100);

                      // Calculate stops remaining before pickup
                      if (effectivePickupStopId) {
                        // Find pickup stop's order
                        const pickupProgress = routeProgress.find((p: any) => p.routeStop.stopId === effectivePickupStopId);
                        if (pickupProgress) {
                          const pickupOrder = pickupProgress.routeStop.stopOrder;
                          
                          // Check if student was already picked up
                          if (pickupProgress.progress.status === "COMPLETED") {
                            studentPickedUp = true;
                            stopsRemaining = 0;
                          } else {
                            // Count pending stops before pickup
                            stopsRemaining = routeProgress.filter((p: any) => 
                              p.routeStop.stopOrder < pickupOrder && 
                              p.progress.status === "PENDING"
                            ).length;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }

            if (effectivePickupStopId) {
              const stops = effectiveRouteId
                ? await storage.getRouteStops(effectiveRouteId)
                : [];
              pickupStop = stops.find((s) => s.id === effectivePickupStopId);
            }

            if (effectiveDropoffStopId) {
              const stops = effectiveRouteId
                ? await storage.getRouteStops(effectiveRouteId)
                : [];
              dropoffStop = stops.find((s) => s.id === effectiveDropoffStopId);
            }

            // Get today's attendance - prioritize per-shift if activeShiftId exists
            let attendance = null;
            if (activeShiftId) {
              // Get attendance specific to the active shift (AM or PM)
              attendance = await storage.getStudentAttendanceWithFallback(student.id, today, activeShiftId);
            } else {
              // No active shift, get date-level attendance
              attendance = await storage.getStudentAttendance(student.id, today, null);
            }

            return {
              ...student,
              assignedRoute: effectiveRouteId, // Include effective route ID for frontend
              routeName,
              pickupStop,
              dropoffStop,
              driverId,
              driverName,
              driverPhone,
              attendance,
              activeShiftId,
              stopsRemaining,
              totalStops,
              stopsCompleted,
              routeProgressPct,
              studentPickedUp,
              routeStatus,
            };
          })
        );

        res.json(enrichedStudents);
      } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).json({ message: "Failed to fetch students" });
      }
    }
  );

  // Get vehicle location for parent's student
  app.get(
    "/api/parent/vehicle-location",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.id;
        const students = await storage.getStudentsByParent(parentId);

        if (students.length === 0) {
          return res.json(null);
        }

        // Get effective route ID (check junction table first, fall back to legacy field)
        // Only use valid routes (exist and are active)
        let effectiveRouteId = null;
        const validAssignments = await storage.getValidStudentRouteAssignments(students[0].id);
        if (validAssignments && validAssignments.length > 0) {
          effectiveRouteId = validAssignments[0].routeId;
        } else if (students[0].assignedRouteId) {
          // Check if legacy route exists and is active
          const legacyRoute = await storage.getRoute(students[0].assignedRouteId);
          if (legacyRoute && legacyRoute.isActive) {
            effectiveRouteId = students[0].assignedRouteId;
          }
        }

        if (!effectiveRouteId) {
          return res.json(null);
        }

        // Get vehicle assigned to this route (simplified)
        const today = new Date().toISOString().split('T')[0];
        const assignments = await storage.getAllDriverAssignments();
        const todayAssignment = assignments.find(
          (a) =>
            a.routeId === effectiveRouteId &&
            a.date === today &&
            a.isActive
        );

        if (!todayAssignment) {
          return res.json(null);
        }

        const vehicle = await storage.getVehicle(todayAssignment.vehicleId);
        const route = await storage.getRoute(effectiveRouteId);

        res.json({
          vehicleId: vehicle?.id,
          vehicleName: vehicle?.name,
          routeName: route?.name,
          latitude: vehicle?.currentLat,
          longitude: vehicle?.currentLng,
          lastUpdate: vehicle?.lastLocationUpdate,
        });
      } catch (error) {
        console.error("Error fetching vehicle location:", error);
        res.status(500).json({ message: "Failed to fetch vehicle location" });
      }
    }
  );

  // Create new child profile (DEPRECATED - parents should not create students directly)
  app.post(
    "/api/parent/students",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        return res.status(403).json({ 
          message: "Parents cannot create student profiles. Please contact an administrator to add your child to the system." 
        });
      } catch (error: any) {
        console.error("Error creating student:", error);
        res.status(500).json({ message: "Failed to create student" });
      }
    }
  );

  // Update parent phone number with option to sync to children
  app.post(
    "/api/parent/update-phone",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.id;
        const { z } = await import("zod");
        
        const schema = z.object({
          newPhoneNumber: z.string().min(1, "Phone number is required"),
          syncToChildren: z.boolean().default(false),
        });
        
        const result = schema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ 
            message: "Invalid request data", 
            errors: result.error.errors 
          });
        }
        
        const { newPhoneNumber, syncToChildren } = result.data;
        
        // Normalize phone to digits only
        const normalizedPhone = newPhoneNumber.replace(/\D/g, '');
        
        // Get parent's current info
        const parent = await storage.getUser(parentId);
        if (!parent) {
          return res.status(404).json({ message: "User not found" });
        }
        
        const oldPhone = parent.phoneNumber;
        console.log(`[update-phone] Parent ${parentId}: old phone = ${oldPhone}, new phone = ${normalizedPhone}`);
        
        // ALWAYS sync guardian phones when changing phone number
        // This ensures parent can re-link to households via the new phone number
        // Otherwise they would lose access to their children
        if (oldPhone) {
          console.log(`[update-phone] Syncing phone change from ${oldPhone} to ${normalizedPhone}`);
          
          // Find students by OLD guardian phone (before updating parent)
          const students = await storage.findStudentsByGuardianPhone(oldPhone);
          console.log(`[update-phone] Found ${students.length} students with guardian phone ${oldPhone}`);
          
          for (const student of students) {
            console.log(`[update-phone] Updating student ${student.id}, current guardianPhones:`, student.guardianPhones);
            
            // Replace old phone with new phone in guardianPhones array
            const updatedGuardianPhones = student.guardianPhones.map((phone: string) => 
              phone === oldPhone ? normalizedPhone : phone
            );
            
            console.log(`[update-phone] Updated guardianPhones:`, updatedGuardianPhones);
            
            // Only update if there was a change
            if (JSON.stringify(updatedGuardianPhones) !== JSON.stringify(student.guardianPhones)) {
              console.log(`[update-phone] Updating student ${student.id} with new phones`);
              await storage.updateStudent(student.id, { 
                guardianPhones: updatedGuardianPhones 
              } as any);
              console.log(`[update-phone] Successfully updated student ${student.id}`);
            } else {
              console.log(`[update-phone] No changes needed for student ${student.id}`);
            }
          }
        }
        
        // Now update parent's phone number
        console.log(`[update-phone] Updating parent ${parentId} phone to ${normalizedPhone}`);
        await storage.updateUserProfile(parentId, { phoneNumber: normalizedPhone });
        console.log(`[update-phone] Parent phone updated successfully`);
        
        // Re-link to households with new phone
        console.log(`[update-phone] Re-linking parent ${parentId} to households`);
        await storage.relinkParentHouseholds(parentId, normalizedPhone);
        console.log(`[update-phone] Re-linking complete`);

        
        res.json({ 
          success: true, 
          message: syncToChildren 
            ? "Phone number updated and synced to children" 
            : "Phone number updated"
        });
      } catch (error: any) {
        console.error("Error updating phone number:", error);
        res.status(500).json({ message: "Failed to update phone number" });
      }
    }
  );

  // Update child profile
  app.patch(
    "/api/parent/students/:id",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.id;
        const studentId = req.params.id;
        const { updateStudentSchema } = await import("@shared/schema");
        
        // Verify the student belongs to this parent's household
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        
        // Check if parent is in the same household
        const parentHousehold = await storage.getUserHousehold(parentId);
        if (!parentHousehold || student.householdId !== parentHousehold.id) {
          return res.status(404).json({ message: "Student not found" });
        }
        
        // Validate request body
        const result = updateStudentSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ 
            message: "Invalid student data", 
            errors: result.error.errors 
          });
        }
        
        const updatedStudent = await storage.updateStudent(studentId, result.data);
        res.json(updatedStudent);
      } catch (error: any) {
        console.error("Error updating student:", error);
        
        if (error instanceof NotFoundError) {
          return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: "Failed to update student" });
      }
    }
  );

  // Delete child profile
  app.delete(
    "/api/parent/students/:id",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.id;
        const studentId = req.params.id;
        
        // Verify the student belongs to this parent's household
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        
        // Check if parent is in the same household
        const parentHousehold = await storage.getUserHousehold(parentId);
        if (!parentHousehold || student.householdId !== parentHousehold.id) {
          return res.status(404).json({ message: "Student not found" });
        }
        
        await storage.deleteStudent(studentId);
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting student:", error);
        res.status(500).json({ message: "Failed to delete student" });
      }
    }
  );

  // Get available stops for student's route (for pickup stop selection)
  app.get(
    "/api/parent/students/:id/available-stops",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.id;
        const studentId = req.params.id;
        
        // Verify the student belongs to this parent's household
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        
        const parentHousehold = await storage.getUserHousehold(parentId);
        if (!parentHousehold || student.householdId !== parentHousehold.id) {
          return res.status(404).json({ message: "Student not found" });
        }

        // If student is not assigned to a route, return empty list
        if (!student.assignedRouteId) {
          return res.json([]);
        }

        // Get all stops on the student's route
        const stops = await storage.getRouteStops(student.assignedRouteId);
        res.json(stops);
      } catch (error: any) {
        console.error("Error fetching available stops:", error);
        res.status(500).json({ message: "Failed to fetch available stops" });
      }
    }
  );

  // Update student's pickup stop
  app.patch(
    "/api/parent/students/:id/pickup-stop",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const { students } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");

        const parentId = req.user.id;
        const studentId = req.params.id;
        const { pickupStopId } = req.body;
        
        // Verify the student belongs to this parent's household
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        
        const parentHousehold = await storage.getUserHousehold(parentId);
        if (!parentHousehold || student.householdId !== parentHousehold.id) {
          return res.status(404).json({ message: "Student not found" });
        }

        // Validate that the stop belongs to the student's route
        if (pickupStopId && student.assignedRouteId) {
          const routeStops = await storage.getRouteStops(student.assignedRouteId);
          const isValidStop = routeStops.some((s) => s.id === pickupStopId);
          
          if (!isValidStop) {
            return res.status(400).json({ 
              message: "Selected stop is not on the student's route" 
            });
          }
        }

        // Update the pickup stop
        await db
          .update(students)
          .set({ pickupStopId, updatedAt: new Date() })
          .where(eq(students.id, studentId));

        const updatedStudent = await storage.getStudent(studentId);
        res.json(updatedStudent);
      } catch (error: any) {
        console.error("Error updating pickup stop:", error);
        res.status(500).json({ message: "Failed to update pickup stop" });
      }
    }
  );

  // Get route assignments for a parent's student
  app.get(
    "/api/parent/students/:id/routes",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.id;
        const studentId = req.params.id;
        
        // Verify the student belongs to this parent's household
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        
        const parentHousehold = await storage.getUserHousehold(parentId);
        if (!parentHousehold || student.householdId !== parentHousehold.id) {
          return res.status(404).json({ message: "Student not found" });
        }

        // Get all valid route assignments from junction table (only routes that exist and are active)
        const validAssignments = await storage.getValidStudentRouteAssignments(studentId);
        
        // Format response with route details already included
        const enrichedAssignments = validAssignments.map((assignment) => ({
          id: assignment.id,
          routeId: assignment.routeId,
          routeName: assignment.route?.name || "Unknown Route",
          routeType: assignment.route?.routeType || null,
          pickupStopId: assignment.pickupStopId,
          dropoffStopId: assignment.dropoffStopId,
        }));

        res.json(enrichedAssignments);
      } catch (error: any) {
        console.error("Error fetching student route assignments:", error);
        res.status(500).json({ message: "Failed to fetch route assignments" });
      }
    }
  );

  // Remove a route assignment from a parent's student
  app.delete(
    "/api/parent/students/:id/routes/:assignmentId",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.id;
        const studentId = req.params.id;
        const assignmentId = req.params.assignmentId;
        
        // Verify the student belongs to this parent's household
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        
        const parentHousehold = await storage.getUserHousehold(parentId);
        if (!parentHousehold || student.householdId !== parentHousehold.id) {
          return res.status(404).json({ message: "Student not found" });
        }

        // Verify the assignment belongs to this student
        const assignments = await storage.getStudentRouteAssignments(studentId);
        const assignment = assignments.find(a => a.id === assignmentId);
        if (!assignment) {
          return res.status(404).json({ message: "Route assignment not found" });
        }

        // Delete the assignment
        await storage.deleteStudentRouteAssignment(assignmentId);
        
        // Audit log
        await storage.createAuditLog({
          userId: parentId,
          userRole: "parent",
          action: "deleted",
          entityType: "student_route_assignment",
          entityId: assignmentId,
          description: `Parent removed route assignment for student ${student.firstName} ${student.lastName}`,
        });

        res.json({ success: true });
      } catch (error: any) {
        console.error("Error removing route assignment:", error);
        res.status(500).json({ message: "Failed to remove route assignment" });
      }
    }
  );

  // Get ETA to student's pickup stop
  app.get(
    "/api/parent/eta/:studentId",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const { calculateDistance, calculateETA, formatDistance, formatETA } = await import("./gps-utils");

        const parentId = req.user.id;
        const { studentId } = req.params;
        
        // Verify the student belongs to this parent's household
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        
        const parentHousehold = await storage.getUserHousehold(parentId);
        if (!parentHousehold || student.householdId !== parentHousehold.id) {
          return res.status(404).json({ message: "Student not found" });
        }

        // Check if student has a pickup stop and route
        if (!student.pickupStopId || !student.assignedRouteId) {
          return res.json({ available: false, message: "No pickup stop selected" });
        }

        // Get pickup stop coordinates
        const stop = await storage.getStop(student.pickupStopId);
        if (!stop || !stop.latitude || !stop.longitude) {
          return res.json({ available: false, message: "Stop location not available" });
        }

        // Get current driver assignment for this route
        const today = new Date().toISOString().split('T')[0];
        const assignments = await storage.getAllDriverAssignments();
        const todayAssignment = assignments.find(
          (a) =>
            a.routeId === student.assignedRouteId &&
            a.date === today &&
            a.isActive
        );

        if (!todayAssignment) {
          return res.json({ available: false, message: "No active route today" });
        }

        // Get vehicle location
        const vehicle = await storage.getVehicle(todayAssignment.vehicleId);
        if (!vehicle || !vehicle.currentLat || !vehicle.currentLng) {
          return res.json({ available: false, message: "Vehicle location not available" });
        }

        // Calculate distance and ETA
        const vehicleLat = parseFloat(vehicle.currentLat);
        const vehicleLng = parseFloat(vehicle.currentLng);
        const stopLat = parseFloat(stop.latitude);
        const stopLng = parseFloat(stop.longitude);

        const distanceMiles = calculateDistance(vehicleLat, vehicleLng, stopLat, stopLng);
        const etaMinutes = calculateETA(distanceMiles, 25); // Default 25 mph average speed

        res.json({
          available: true,
          distanceMiles: parseFloat(distanceMiles.toFixed(1)),
          distanceFormatted: formatDistance(distanceMiles),
          etaMinutes,
          etaFormatted: formatETA(etaMinutes),
          vehicleName: vehicle.name,
          stopName: stop.name,
          lastUpdate: vehicle.lastLocationUpdate,
        });
      } catch (error: any) {
        console.error("Error calculating ETA:", error);
        res.status(500).json({ message: "Failed to calculate ETA" });
      }
    }
  );

  // ============ Parent Messaging routes ============

  // Get drivers currently assigned to parent's children's routes
  app.get(
    "/api/parent/assigned-drivers",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.id;
        const drivers = await storage.getActiveDriversForParent(parentId);
        res.json(drivers);
      } catch (error) {
        console.error("Error fetching assigned drivers:", error);
        res.status(500).json({ message: "Failed to fetch assigned drivers" });
      }
    }
  );

  // Get admins who have messaged this parent
  app.get(
    "/api/parent/admin-conversations",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.id;
        
        // Get all admins
        const admins = await storage.getUsersByRole("admin");
        
        // Filter admins who have messaged this parent
        const adminsWithMessages = [];
        for (const admin of admins) {
          const messages = await storage.getMessagesBetweenUsers(parentId, admin.id);
          if (messages.length > 0) {
            adminsWithMessages.push({
              ...admin,
              lastMessage: messages[messages.length - 1],
            });
          }
        }
        
        res.json(adminsWithMessages);
      } catch (error) {
        console.error("Error fetching admin conversations:", error);
        res.status(500).json({ message: "Failed to fetch admin conversations" });
      }
    }
  );

  // Get driver info for parent
  app.get(
    "/api/parent/driver-info/:driverId",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const driverId = req.params.driverId;
        const driver = await storage.getUser(driverId);
        if (!driver) {
          return res.status(404).json({ message: "Driver not found" });
        }
        res.json(driver);
      } catch (error) {
        console.error("Error fetching driver info:", error);
        res.status(500).json({ message: "Failed to fetch driver info" });
      }
    }
  );

  // Get messages between parent and specific driver
  app.get(
    "/api/parent/messages/:recipientId",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.id;
        const recipientId = req.params.recipientId;
        
        // Check if recipient is admin - no route restriction needed for admin conversations
        const recipient = await storage.getUser(recipientId);
        const isAdmin = recipient?.role === "admin";
        
        // If not admin, verify driver is currently assigned to parent's children's routes
        if (!isAdmin) {
          const assignedDrivers = await storage.getActiveDriversForParent(parentId);
          const isDriverAssigned = assignedDrivers.some((driver: any) => driver.id === recipientId);
          
          if (!isDriverAssigned) {
            return res.status(403).json({ message: "You can only message drivers assigned to your children" });
          }
        }
        
        const messages = await storage.getMessagesBetweenUsers(parentId, recipientId);
        
        // Add sender details to each message
        const messagesWithDetails = await Promise.all(
          messages.map(async (msg) => {
            const sender = await storage.getUser(msg.senderId);
            let forwardedByAdminName = null;
            
            // If message was forwarded by admin, get admin name
            if (msg.forwardedByAdminId) {
              const admin = await storage.getUser(msg.forwardedByAdminId);
              forwardedByAdminName = admin ? `${admin.firstName} ${admin.lastName}` : "Admin";
            }
            
            return {
              ...msg,
              isOwn: msg.senderId === parentId,
              senderRole: sender?.role || "unknown",
              senderName: sender ? `${sender.firstName} ${sender.lastName}` : "Unknown",
              forwardedByAdminName,
            };
          })
        );
        
        res.json(messagesWithDetails);
      } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ message: "Failed to fetch messages" });
      }
    }
  );

  // Send message from parent to driver
  app.post(
    "/api/parent/send-message",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const senderId = req.user.id;
        const { content, recipientId } = req.body;

        if (!recipientId) {
          return res.status(400).json({ message: "Recipient ID required" });
        }

        // Check if recipient is an admin - parents can always reply to admins
        const recipient = await storage.getUser(recipientId);
        const isAdmin = recipient?.role === "admin";

        if (!isAdmin) {
          // Verify driver is currently assigned to parent's children's routes
          const assignedDrivers = await storage.getActiveDriversForParent(senderId);
          const isDriverAssigned = assignedDrivers.some((driver: any) => driver.id === recipientId);
          
          if (!isDriverAssigned) {
            return res.status(403).json({ message: "You can only message drivers assigned to your children" });
          }
        }

        const message = await storage.createMessage({
          senderId,
          recipientId,
          content,
        });

        // Broadcast via WebSocket if available
        if (wss) {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "new_message",
                  message: { ...message, currentUserId: senderId },
                })
              );
            }
          });
        }

        res.json(message);
      } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ message: "Failed to send message" });
      }
    }
  );

  // Get admin contacts for parent (admins who have messaged this parent)
  app.get(
    "/api/parent/admin-contacts",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.id;
        
        // Get all admins who have messaged this parent
        const admins = await storage.getUsersByRole("admin");
        const adminsWithMessages = [];
        
        for (const admin of admins) {
          const messages = await storage.getMessagesBetweenUsers(parentId, admin.id);
          if (messages.length > 0) {
            adminsWithMessages.push({
              id: admin.id,
              firstName: admin.firstName,
              lastName: admin.lastName,
              email: admin.email,
              role: admin.role,
            });
          }
        }
        
        res.json(adminsWithMessages);
      } catch (error) {
        console.error("Error fetching admin contacts:", error);
        res.status(500).json({ message: "Failed to fetch admin contacts" });
      }
    }
  );

  // ============ Driver Messaging routes ============

  // Get all parents whose children are on driver's routes (can message any of them)
  app.get(
    "/api/driver/messageable-parents",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const parents = await storage.getMessageableParentsForDriver(driverId);
        res.json(parents);
      } catch (error) {
        console.error("Error fetching messageable parents:", error);
        res.status(500).json({ message: "Failed to fetch messageable parents" });
      }
    }
  );

  // Get admins who have messaged this driver
  app.get(
    "/api/driver/admin-conversations",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        
        // Get all admins
        const admins = await storage.getUsersByRole("admin");
        
        // Filter admins who have messaged this driver
        const adminsWithMessages = [];
        for (const admin of admins) {
          const messages = await storage.getMessagesBetweenUsers(driverId, admin.id);
          if (messages.length > 0) {
            adminsWithMessages.push({
              ...admin,
              lastMessage: messages[messages.length - 1],
            });
          }
        }
        
        res.json(adminsWithMessages);
      } catch (error) {
        console.error("Error fetching admin conversations:", error);
        res.status(500).json({ message: "Failed to fetch admin conversations" });
      }
    }
  );

  // Get conversations (parents who have messaged this driver) - legacy endpoint for active conversations
  app.get(
    "/api/driver/conversations",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const conversations = await storage.getConversations(driverId);
        res.json(conversations);
      } catch (error) {
        console.error("Error fetching conversations:", error);
        res.status(500).json({ message: "Failed to fetch conversations" });
      }
    }
  );

  // Get messages between driver and specific parent/admin
  app.get(
    "/api/driver/messages/:recipientId",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const recipientId = req.params.recipientId;
        
        // Check if recipient is admin - no route restriction needed for admin conversations
        const recipient = await storage.getUser(recipientId);
        const isAdmin = recipient?.role === "admin";
        
        // If messaging parent, check if driver has a started route today
        if (!isAdmin) {
          const today = new Date().toISOString().split('T')[0];
          const shifts = await storage.getShiftsByDriver(driverId, today, today);
          const hasStartedRoute = shifts.some(s => s.routeStartedAt);
          
          if (!hasStartedRoute) {
            return res.status(400).json({ 
              message: "Route has not been started. Please start the route from the dashboard first." 
            });
          }
          
          // Verify driver can message this parent (via routes)
          const messageableParents = await storage.getMessageableParentsForDriver(driverId);
          const canMessage = messageableParents.some((parent: any) => parent.id === recipientId);
          
          if (!canMessage) {
            return res.status(403).json({ message: "You can only message parents whose children are on your assigned routes" });
          }
        }
        
        const messages = await storage.getMessagesBetweenUsers(driverId, recipientId);
        
        // Add sender details to each message
        const messagesWithDetails = await Promise.all(
          messages.map(async (msg) => {
            const sender = await storage.getUser(msg.senderId);
            return {
              ...msg,
              isOwn: msg.senderId === driverId,
              senderRole: sender?.role || "unknown",
              senderName: sender ? `${sender.firstName} ${sender.lastName}` : "Unknown",
            };
          })
        );
        
        res.json(messagesWithDetails);
      } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ message: "Failed to fetch messages" });
      }
    }
  );

  // Send message from driver to parent
  app.post(
    "/api/driver/send-message",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const senderId = req.user.id;
        const { content, recipientId } = req.body;

        if (!recipientId) {
          return res.status(400).json({ message: "Recipient ID required" });
        }

        // Check if recipient is an admin - drivers can always reply to admins
        const recipient = await storage.getUser(recipientId);
        const isAdmin = recipient?.role === "admin";

        if (!isAdmin) {
          // Check if driver has a started route today before messaging parents
          const today = new Date().toISOString().split('T')[0];
          const shifts = await storage.getShiftsByDriver(senderId, today, today);
          const hasStartedRoute = shifts.some(s => s.routeStartedAt);
          
          if (!hasStartedRoute) {
            return res.status(400).json({ 
              message: "Route has not been started. Please start the route from the dashboard first." 
            });
          }
          
          // Verify driver can message this parent (parent's child is on driver's route)
          const messageableParents = await storage.getMessageableParentsForDriver(senderId);
          const canMessage = messageableParents.some((parent: any) => parent.id === recipientId);
          
          if (!canMessage) {
            return res.status(403).json({ message: "You can only message parents whose children are on your assigned routes" });
          }
        }

        const message = await storage.createMessage({
          senderId,
          recipientId,
          content,
        });

        // Broadcast via WebSocket if available
        if (wss) {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "new_message",
                  message,
                })
              );
            }
          });
        }

        // Send push notification to parent recipient
        try {
          const recipient = await storage.getUser(recipientId);
          if (recipient?.role === "parent") {
            const sender = await storage.getUser(senderId);
            const senderName = sender ? `${sender.firstName} ${sender.lastName}` : "Driver";
            await pushNotificationService.notifyNewMessage(
              recipientId,
              senderName,
              content,
              message.id,
              senderId
            );
          }
        } catch (pushError) {
          console.error("[push] Error sending message notification:", pushError);
        }

        res.json(message);
      } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ message: "Failed to send message" });
      }
    }
  );

  // Get admin contacts for driver (admins who have messaged this driver)
  app.get(
    "/api/driver/admin-contacts",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        
        // Get all admins who have messaged this driver
        const admins = await storage.getUsersByRole("admin");
        const adminsWithMessages = [];
        
        for (const admin of admins) {
          const messages = await storage.getMessagesBetweenUsers(driverId, admin.id);
          if (messages.length > 0) {
            adminsWithMessages.push({
              id: admin.id,
              firstName: admin.firstName,
              lastName: admin.lastName,
              email: admin.email,
              role: admin.role,
            });
          }
        }
        
        res.json(adminsWithMessages);
      } catch (error) {
        console.error("Error fetching admin contacts:", error);
        res.status(500).json({ message: "Failed to fetch admin contacts" });
      }
    }
  );

  // Get driver notifications
  app.get(
    "/api/driver/notifications",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const notifications = await storage.getDriverNotifications(driverId);
        res.json(notifications);
      } catch (error) {
        console.error("Error fetching driver notifications:", error);
        res.status(500).json({ message: "Failed to fetch notifications" });
      }
    }
  );

  // Dismiss driver notification
  app.post(
    "/api/driver/notifications/:id/dismiss",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const notificationId = req.params.id;
        await storage.dismissDriverNotification(notificationId, driverId);
        res.json({ message: "Notification dismissed" });
      } catch (error: any) {
        if (error.name === "NotFoundError") {
          return res.status(404).json({ message: "Notification not found or access denied" });
        }
        console.error("Error dismissing notification:", error);
        res.status(500).json({ message: "Failed to dismiss notification" });
      }
    }
  );

  // ============ Admin Messaging routes ============

  // Get all drivers for admin to message
  app.get(
    "/api/admin/all-drivers",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const drivers = await storage.getUsersByRole("driver");
        res.json(drivers);
      } catch (error) {
        console.error("Error fetching drivers:", error);
        res.status(500).json({ message: "Failed to fetch drivers" });
      }
    }
  );

  // Get all parents for admin to message
  app.get(
    "/api/admin/all-parents",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const parents = await storage.getUsersByRole("parent");
        res.json(parents);
      } catch (error) {
        console.error("Error fetching parents:", error);
        res.status(500).json({ message: "Failed to fetch parents" });
      }
    }
  );

  // Get all admins (excluding current user) for admin-to-admin messaging
  app.get(
    "/api/admin/all-admins",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const currentUserId = req.user.id;
        const admins = await storage.getUsersByRole("admin");
        // Filter out the current user
        const otherAdmins = admins.filter((admin: any) => admin.id !== currentUserId);
        res.json(otherAdmins);
      } catch (error) {
        console.error("Error fetching admins:", error);
        res.status(500).json({ message: "Failed to fetch admins" });
      }
    }
  );

  // Get direct messages between admin and specific user
  app.get(
    "/api/admin/direct-messages/:userId",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const adminId = req.user.id;
        const userId = req.params.userId;
        
        const messages = await storage.getMessagesBetweenUsers(adminId, userId);
        
        // Add sender details to each message
        const messagesWithDetails = await Promise.all(
          messages.map(async (msg) => {
            const sender = await storage.getUser(msg.senderId);
            return {
              ...msg,
              isOwn: msg.senderId === adminId,
              senderRole: sender?.role || "unknown",
              senderName: sender ? `${sender.firstName} ${sender.lastName}` : "Unknown",
            };
          })
        );
        
        res.json(messagesWithDetails);
      } catch (error) {
        console.error("Error fetching admin direct messages:", error);
        res.status(500).json({ message: "Failed to fetch messages" });
      }
    }
  );

  // Get message summaries for all users (for Recent tab)
  app.get(
    "/api/admin/message-summaries",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const adminId = req.user.id;
        const summaries = await storage.getAdminMessageSummaries(adminId);
        res.json(summaries);
      } catch (error) {
        console.error("Error fetching message summaries:", error);
        res.status(500).json({ message: "Failed to fetch message summaries" });
      }
    }
  );

  // Get all conversations between drivers and parents
  app.get(
    "/api/admin/all-conversations",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const conversations = await storage.getAllConversations();
        res.json(conversations);
      } catch (error) {
        console.error("Error fetching all conversations:", error);
        res.status(500).json({ message: "Failed to fetch conversations" });
      }
    }
  );

  // Get messages for a specific conversation
  app.get(
    "/api/admin/conversation-messages/:conversationKey",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const conversationKey = req.params.conversationKey;
        const [userId1, userId2] = conversationKey.split("_");
        const messages = await storage.getMessagesBetweenUsers(userId1, userId2);
        
        // Add sender details to each message
        const messagesWithDetails = await Promise.all(
          messages.map(async (msg) => {
            const sender = await storage.getUser(msg.senderId);
            return {
              ...msg,
              senderName: sender ? `${sender.firstName} ${sender.lastName}` : "Unknown",
              senderRole: sender?.role || "unknown",
            };
          })
        );
        
        res.json(messagesWithDetails);
      } catch (error) {
        console.error("Error fetching conversation messages:", error);
        res.status(500).json({ message: "Failed to fetch messages" });
      }
    }
  );

  // Send message from admin to anyone
  app.post(
    "/api/admin/send-message",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const senderId = req.user.id;
        const { content, recipientId } = req.body;

        if (!recipientId) {
          return res.status(400).json({ message: "Recipient ID required" });
        }

        // Admins can message anyone without restrictions
        const message = await storage.createMessage({
          senderId,
          recipientId,
          content,
        });

        // Broadcast via WebSocket if available
        if (wss) {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "new_message",
                  message,
                })
              );
            }
          });
        }

        res.json(message);
      } catch (error) {
        console.error("Error sending admin message:", error);
        res.status(500).json({ message: "Failed to send message" });
      }
    }
  );

  // Send intervention message in driver-parent conversation
  app.post(
    "/api/admin/send-conversation-message",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const adminId = req.user.id;
        const { content, conversationId, driverId, parentId } = req.body;

        if (!content || !conversationId || !driverId || !parentId) {
          return res.status(400).json({ 
            message: "Content, conversation ID, driver ID, and parent ID are required" 
          });
        }

        // Create forwarded message to parent only
        const message = await storage.createMessage({
          senderId: adminId,
          recipientId: parentId,
          content,
          forwardedFromConversationId: conversationId,
          forwardedByAdminId: adminId,
        });

        // Create notification for driver
        await storage.createDriverNotification({
          driverId,
          conversationId,
          messageId: message.id,
          parentId,
        });

        // Broadcast via WebSocket if available
        if (wss) {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "new_message",
                  message,
                })
              );
            }
          });
        }

        res.json(message);
      } catch (error) {
        console.error("Error sending conversation message:", error);
        res.status(500).json({ message: "Failed to send message" });
      }
    }
  );

  // ============ Announcement routes ============

  // Create announcement
  app.post(
    "/api/admin/create-announcement",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const adminId = req.user.id;
        const { title, content, targetRole, routeId, audienceType: requestedAudienceType } = req.body;

        // Log request details
        console.log(`[announcements] POST /announcements - actor=${adminId}, audience_type=${requestedAudienceType || targetRole}, route_id=${routeId || "none"}`);

        if (!title || !content) {
          return res.status(400).json({ message: "Title and content are required" });
        }

        // Valid audience types
        const validAudienceTypes = ["ORG_ALL", "ROLE_DRIVERS", "ROLE_PARENTS", "ROUTE_DRIVERS", "ROUTE_PARENTS"];

        // Determine audience type
        let audienceType = requestedAudienceType;
        if (!audienceType && targetRole) {
          audienceType = targetRole === "driver" ? "ROLE_DRIVERS" : "ROLE_PARENTS";
        }
        if (!audienceType) {
          return res.status(400).json({ message: "Audience type or target role is required" });
        }

        // Validate audienceType against enum
        if (!validAudienceTypes.includes(audienceType)) {
          console.log(`[announcements] Rejected: invalid audience_type=${audienceType}`);
          return res.status(400).json({ message: `Invalid audience type. Must be one of: ${validAudienceTypes.join(", ")}` });
        }

        // Validate route-scoped announcements require route_id
        const isRouteScopedAudience = audienceType === "ROUTE_DRIVERS" || audienceType === "ROUTE_PARENTS";
        if (isRouteScopedAudience && !routeId) {
          console.log(`[announcements] Rejected: route-scoped audience ${audienceType} requires route_id`);
          return res.status(400).json({ message: "Route ID is required for route-scoped announcements" });
        }

        // Determine target role for backwards compatibility
        const isDriverAudience = audienceType === "ROLE_DRIVERS" || audienceType === "ROUTE_DRIVERS";
        const effectiveTargetRole = targetRole || (isDriverAudience ? "driver" : "parent");

        // Get target users for delivery tracking
        let targetUsers: any[] = [];
        if (audienceType === "ROUTE_DRIVERS" && routeId) {
          targetUsers = await storage.getDriversForRoute(routeId);
        } else if (audienceType === "ROUTE_PARENTS" && routeId) {
          targetUsers = await storage.getParentsForRoute(routeId);
        } else if (audienceType === "ROLE_DRIVERS") {
          targetUsers = await storage.getUsersByRole("driver");
        } else if (audienceType === "ROLE_PARENTS") {
          targetUsers = await storage.getUsersByRole("parent");
        } else if (audienceType === "ORG_ALL") {
          const drivers = await storage.getUsersByRole("driver");
          const parents = await storage.getUsersByRole("parent");
          targetUsers = [...drivers, ...parents];
        }
        const targetCount = targetUsers.length;

        console.log(`[announcements] Target users resolved: count=${targetCount}, audience_type=${audienceType}${routeId ? `, route_id=${routeId}` : ""}`);

        const announcement = await storage.createAnnouncement({
          adminId,
          title,
          content,
          targetRole: effectiveTargetRole,
          audienceType,
          routeId: routeId || null,
          targetCount,
        });

        // Log insert success
        console.log(`[announcements] Created announcement_id=${announcement.id}, audience_type=${audienceType}, target_count=${targetCount}`);

        // Broadcast via WebSocket (legacy)
        if (wss) {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "new_announcement",
                  announcement,
                })
              );
            }
          });
        }

        // Emit via Socket.IO with appropriate targeting
        emitAnnouncementCreated({
          announcement,
          targetRouteId: routeId || undefined,
          audienceType,
        });

        // Send push notifications to target users and track delivery
        (async () => {
          try {
            let successCount = 0;
            let failureCount = 0;
            let lastError: string | null = null;

            const pushAttemptedAt = new Date();

            for (const user of targetUsers) {
              try {
                const tokens = await storage.getActiveDeviceTokens(user.id);
                if (tokens.length > 0) {
                  await pushNotificationService.sendToUsers([user.id], {
                    title: title,
                    body: content.substring(0, 200),
                    data: {
                      type: "announcement",
                      announcementId: announcement.id,
                      deeplink: `/announcements/${announcement.id}`,
                    },
                  });
                  successCount++;
                }
              } catch (pushError: any) {
                failureCount++;
                lastError = pushError.message || "Unknown push error";
                console.error(`[push] Error sending announcement to user ${user.id}:`, pushError);
              }
            }

            // Update announcement with delivery stats
            await storage.updateAnnouncementDeliveryStats(announcement.id, {
              pushAttemptedAt,
              pushSuccessCount: successCount,
              pushFailureCount: failureCount,
              lastPushError: lastError,
            });
          } catch (statsError) {
            console.error("[push] Error updating announcement delivery stats:", statsError);
          }
        })();

        res.json(announcement);
      } catch (error) {
        console.error("Error creating announcement:", error);
        res.status(500).json({ message: "Failed to create announcement" });
      }
    }
  );

  // Admin: Create route-specific announcement
  app.post(
    "/api/admin/route-announcements",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const adminId = req.user.id;
        const { routeId, title, content } = req.body;

        if (!routeId || !title || !content) {
          return res.status(400).json({ message: "Route ID, title, and content are required" });
        }

        // Create route announcement (will be visible to all parents on this route)
        const announcement = await storage.createRouteAnnouncement({
          routeId,
          driverId: adminId, // Use admin ID as driverId for admin-created announcements
          title,
          content,
        });

        // Emit via Socket.IO (route-specific broadcast)
        emitAnnouncementCreated({
          announcement,
          targetRouteId: routeId,
        });

        res.json(announcement);
      } catch (error) {
        console.error("Error creating route announcement:", error);
        res.status(500).json({ message: "Failed to create route announcement" });
      }
    }
  );

  // Admin: Get announcement history with filters
  app.get(
    "/api/admin/announcement-history",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { 
          startDate, 
          endDate, 
          audienceType, 
          routeId, 
          createdBy, 
          search,
          limit,
          offset 
        } = req.query;

        const filters: any = {};
        if (startDate) filters.startDate = new Date(startDate);
        if (endDate) filters.endDate = new Date(endDate);
        if (audienceType) filters.audienceType = audienceType;
        if (routeId) filters.routeId = routeId;
        if (createdBy) filters.createdBy = createdBy;
        if (search) filters.search = search;
        if (limit) filters.limit = parseInt(limit as string, 10);
        if (offset) filters.offset = parseInt(offset as string, 10);

        const result = await storage.getAnnouncementHistory(filters);
        res.json(result);
      } catch (error) {
        console.error("Error getting announcement history:", error);
        res.status(500).json({ message: "Failed to get announcement history" });
      }
    }
  );

  // Admin: Get single announcement details
  app.get(
    "/api/admin/announcements/:id",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const announcement = await storage.getAnnouncementById(id);
        if (!announcement) {
          return res.status(404).json({ message: "Announcement not found" });
        }
        res.json(announcement);
      } catch (error) {
        console.error("Error getting announcement:", error);
        res.status(500).json({ message: "Failed to get announcement" });
      }
    }
  );

  // Get announcements for drivers
  app.get(
    "/api/driver/announcements",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const announcements = await storage.getNonDismissedAnnouncementsByRole(userId, "driver");
        
        // Add admin details to each announcement
        const announcementsWithDetails = await Promise.all(
          announcements.map(async (announcement) => {
            const admin = await storage.getUser(announcement.adminId);
            return {
              ...announcement,
              adminName: admin ? `${admin.firstName} ${admin.lastName}` : "Admin",
            };
          })
        );

        res.json(announcementsWithDetails);
      } catch (error) {
        console.error("Error fetching announcements:", error);
        res.status(500).json({ message: "Failed to fetch announcements" });
      }
    }
  );

  // Get announcements for parents
  app.get(
    "/api/parent/announcements",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const announcements = await storage.getNonDismissedAnnouncementsByRole(userId, "parent");
        
        // Add admin details to each announcement
        const announcementsWithDetails = await Promise.all(
          announcements.map(async (announcement) => {
            const admin = await storage.getUser(announcement.adminId);
            return {
              ...announcement,
              adminName: admin ? `${admin.firstName} ${admin.lastName}` : "Admin",
            };
          })
        );

        res.json(announcementsWithDetails);
      } catch (error) {
        console.error("Error fetching announcements:", error);
        res.status(500).json({ message: "Failed to fetch announcements" });
      }
    }
  );

  // Get dismissed announcements for drivers
  app.get(
    "/api/driver/announcements/dismissed",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const announcements = await storage.getDismissedAnnouncementsByRole(userId, "driver");
        
        // Add admin details to each announcement
        const announcementsWithDetails = await Promise.all(
          announcements.map(async (announcement) => {
            const admin = await storage.getUser(announcement.adminId);
            return {
              ...announcement,
              adminName: admin ? `${admin.firstName} ${admin.lastName}` : "Admin",
            };
          })
        );

        res.json(announcementsWithDetails);
      } catch (error) {
        console.error("Error fetching dismissed announcements:", error);
        res.status(500).json({ message: "Failed to fetch dismissed announcements" });
      }
    }
  );

  // Get dismissed announcements for parents
  app.get(
    "/api/parent/announcements/dismissed",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const announcements = await storage.getDismissedAnnouncementsByRole(userId, "parent");
        
        // Add admin details to each announcement
        const announcementsWithDetails = await Promise.all(
          announcements.map(async (announcement) => {
            const admin = await storage.getUser(announcement.adminId);
            return {
              ...announcement,
              adminName: admin ? `${admin.firstName} ${admin.lastName}` : "Admin",
            };
          })
        );

        res.json(announcementsWithDetails);
      } catch (error) {
        console.error("Error fetching dismissed announcements:", error);
        res.status(500).json({ message: "Failed to fetch dismissed announcements" });
      }
    }
  );

  // Dismiss an admin announcement
  app.post(
    "/api/announcements/:id/dismiss",
    requireAuth,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const announcementId = req.params.id;
        await storage.dismissAnnouncement(userId, announcementId);
        res.json({ success: true });
      } catch (error) {
        console.error("Error dismissing announcement:", error);
        res.status(500).json({ message: "Failed to dismiss announcement" });
      }
    }
  );

  // Create a route announcement (driver only)
  app.post(
    "/api/route-announcements",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const { routeId, message } = req.body;

        if (!routeId || !message) {
          return res.status(400).json({ message: "Route ID and message are required" });
        }

        // Verify driver is assigned to this route
        const isAssigned = await storage.isDriverAssignedToRoute(driverId, routeId);
        if (!isAssigned) {
          return res.status(403).json({ message: "You are not assigned to this route" });
        }

        const announcement = await storage.createRouteAnnouncement({
          routeId,
          driverId,
          message,
        });

        res.json(announcement);
      } catch (error) {
        console.error("Error creating route announcement:", error);
        res.status(500).json({ message: "Failed to create route announcement" });
      }
    }
  );

  // Get route announcements for driver
  app.get(
    "/api/route-announcements/driver",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const announcements = await storage.getRouteAnnouncementsForDriver(driverId);
        res.json(announcements);
      } catch (error) {
        console.error("Error fetching driver route announcements:", error);
        res.status(500).json({ message: "Failed to fetch route announcements" });
      }
    }
  );

  // Get route announcements for parent
  app.get(
    "/api/route-announcements/parent",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.id;
        const announcements = await storage.getRouteAnnouncementsForParent(parentId);
        res.json(announcements);
      } catch (error) {
        console.error("Error fetching parent route announcements:", error);
        res.status(500).json({ message: "Failed to fetch route announcements" });
      }
    }
  );

  // Mark route announcement as read
  app.post(
    "/api/route-announcements/:id/read",
    requireAuth,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const routeAnnouncementId = req.params.id;
        await storage.markRouteAnnouncementAsRead(userId, routeAnnouncementId);
        res.json({ success: true });
      } catch (error) {
        console.error("Error marking route announcement as read:", error);
        res.status(500).json({ message: "Failed to mark route announcement as read" });
      }
    }
  );

  // Dismiss a route announcement
  app.post(
    "/api/route-announcements/:id/dismiss",
    requireAuth,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const routeAnnouncementId = req.params.id;
        await storage.dismissRouteAnnouncement(userId, routeAnnouncementId);
        res.json({ success: true });
      } catch (error) {
        console.error("Error dismissing route announcement:", error);
        res.status(500).json({ message: "Failed to dismiss route announcement" });
      }
    }
  );

  // ============ Student Attendance Routes ============

  // Get all students from driver's assigned routes for today (view only, no route start required)
  app.get(
    "/api/driver/students",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        
        // Use local date for shift lookup to match how shifts are stored
        const now = new Date();
        const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        // Get all driver's shifts for today
        const todayShifts = await storage.getShiftsByDriver(driverId, localToday, localToday);
        
        if (todayShifts.length === 0) {
          return res.json([]);
        }
        
        // Get unique route IDs from shifts
        const routeIds = [...new Set(todayShifts.map(s => s.routeId).filter(Boolean))];
        
        // Get students from all routes, using each shift's actual date and shiftId for consistency
        const allStudents: any[] = [];
        for (const routeId of routeIds) {
          if (routeId) {
            const shift = todayShifts.find(s => s.routeId === routeId);
            // Use the shift's date and shiftId to get per-shift attendance
            const queryDate = shift?.date || localToday;
            const students = await storage.getStudentsByRouteForDate(routeId, queryDate, shift?.id);
            const route = await storage.getRoute(routeId);
            
            allStudents.push(...students.map(s => ({ 
              ...s, 
              routeName: route?.name || "Unknown Route",
              routeId,
              shiftId: shift?.id,
              shiftType: shift?.shiftType
            })));
          }
        }
        
        res.json(allStudents);
      } catch (error) {
        console.error("Error fetching driver students:", error);
        res.status(500).json({ message: "Failed to fetch students" });
      }
    }
  );

  // Get students on driver's route for attendance (driver-specific)
  app.get(
    "/api/driver/route-students/:routeId",
    requireAuth,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.id;
        const routeId = req.params.routeId;
        
        // Use local date for shift lookup to match how shifts are stored
        const now = new Date();
        const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        // Find driver's active shift for this route today
        const shifts = await storage.getShiftsByDriver(driverId, localToday, localToday);
        const activeShift = shifts.find(s => s.routeId === routeId);
        
        if (!activeShift) {
          return res.status(404).json({ message: "No shift found for this route today" });
        }
        
        // Check if route has been started
        if (!activeShift.routeStartedAt) {
          return res.status(400).json({ 
            message: "Route has not been started. Please start the route from the dashboard first." 
          });
        }
        
        // Use the shift date and shiftId to query students with per-shift attendance
        const shiftDate = activeShift.date;
        const students = await storage.getStudentsByRouteForDate(routeId, shiftDate, activeShift.id);
        res.json(students);
      } catch (error) {
        console.error("Error fetching route students:", error);
        res.status(500).json({ message: "Failed to fetch route students" });
      }
    }
  );

  // Set student attendance (all roles) - supports single date or date range
  // Now includes shiftId to properly track AM/PM attendance separately
  app.post(
    "/api/attendance",
    requireAuth,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { studentId, date, endDate, status, notes, shiftId } = req.body;
        
        console.log("[attendance] Request:", { userId, studentId, date, status, shiftId });
        
        // Validate request
        if (!studentId || !date || !status) {
          console.log("[attendance] Missing required fields");
          return res.status(400).json({ message: "Missing required fields" });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Determine the shiftId to use for attendance tracking
        let effectiveShiftId = shiftId || null;

        // Authorization check for drivers - ONLY lead drivers can mark attendance
        // Regular drivers can only record board/deboard events via ride-events endpoint
        if (user.role === "driver") {
          console.log("[attendance] Driver check - isLeadDriver:", user.isLeadDriver);
          // Check if driver is a lead driver
          if (!user.isLeadDriver) {
            console.log("[attendance] REJECTED: Not a lead driver");
            return res.status(403).json({ 
              message: "Only lead drivers can mark students as absent or riding. Regular drivers can record when students board or leave the bus during the route." 
            });
          }
          
          const student = await storage.getStudent(studentId);
          if (!student) {
            return res.status(404).json({ message: "Student not found" });
          }
          
          // Find driver's shift for the student's route on the given date
          const shifts = await storage.getShiftsByDriver(userId, date, date);
          
          // If a specific shiftId was provided, validate it belongs to this driver
          // This allows modifying attendance for a specific shift (AM or PM)
          if (shiftId) {
            const targetShift = shifts.find(s => s.id === shiftId);
            if (!targetShift) {
              return res.status(403).json({ 
                message: "You don't have access to this shift" 
              });
            }
            if (!targetShift.routeStartedAt) {
              return res.status(400).json({ 
                message: "Route has not been started for this shift" 
              });
            }
            effectiveShiftId = shiftId;
          } else {
            // No shiftId provided - find the currently active (running) shift
            // Active means: routeStartedAt is set AND routeCompletedAt is NOT set
            let activeShift: any = null;
            
            // Check studentRoutes (multi-route assignments)
            const studentRouteAssignments = await storage.getStudentRouteAssignments(studentId);
            for (const sr of studentRouteAssignments) {
              // Find shift for this route that is currently running (started but not completed)
              const shift = shifts.find(s => 
                s.routeId === sr.routeId && 
                s.date === date && 
                s.routeStartedAt && 
                !s.routeCompletedAt  // Only if route is still running
              );
              if (shift) {
                activeShift = shift;
                break;
              }
            }
            
            // Also check legacy assignedRouteId
            if (!activeShift && student.assignedRouteId) {
              const shift = shifts.find(s => 
                s.routeId === student.assignedRouteId && 
                s.date === date && 
                s.routeStartedAt && 
                !s.routeCompletedAt  // Only if route is still running
              );
              if (shift) {
                activeShift = shift;
              }
            }
            
            if (!activeShift) {
              console.log("[attendance] No active shift found. Available shifts:", shifts.map(s => ({ id: s.id, routeId: s.routeId, routeStartedAt: s.routeStartedAt, routeCompletedAt: s.routeCompletedAt })));
              // Check if there's a started but completed shift (route finished)
              const completedShift = shifts.find(s => s.routeStartedAt && s.routeCompletedAt);
              if (completedShift) {
                console.log("[attendance] REJECTED: Route already completed");
                return res.status(400).json({ 
                  message: "Route has already been completed. Attendance cannot be modified after route completion." 
                });
              }
              console.log("[attendance] REJECTED: Route not started");
              return res.status(400).json({ 
                message: "Route has not been started. Please start the route from the dashboard first." 
              });
            }
            
            // Use the active shift's ID to track AM/PM attendance separately
            effectiveShiftId = activeShift.id;
          }
        }

        // Authorization check for parents
        if (user.role === "parent") {
          const student = await storage.getStudent(studentId);
          if (!student) {
            return res.status(404).json({ message: "Student not found" });
          }
          
          // Check if parent is authorized (via household or guardian phone)
          const household = await storage.getUserHousehold(userId);
          const userPhoneNormalized = user.phoneNumber?.replace(/\D/g, '') || '';
          const isAuthorized = 
            (household && student.householdId === household.id) ||
            student.guardianPhones.some(gp => gp.replace(/\D/g, '') === userPhoneNormalized);
          
          if (!isAuthorized) {
            return res.status(403).json({ message: "Not authorized to mark attendance for this student" });
          }
        }

        // If endDate is provided, set attendance for date range
        // Note: Date range attendance doesn't use shiftId (typically for advance scheduling)
        if (endDate) {
          const startDate = new Date(date);
          const finalDate = new Date(endDate);
          
          if (finalDate < startDate) {
            return res.status(400).json({ message: "End date must be after start date" });
          }
          
          const attendanceRecords = [];
          const currentDate = new Date(startDate);
          
          while (currentDate <= finalDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const record = await storage.setStudentAttendance({
              studentId,
              date: dateStr,
              status,
              markedByUserId: userId,
              notes: notes || null,
              shiftId: null, // Date range attendance is date-level, not shift-specific
            });
            attendanceRecords.push(record);
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          return res.json({ 
            message: `Attendance set for ${attendanceRecords.length} days`,
            records: attendanceRecords 
          });
        }

        // Single date attendance - uses shiftId to track AM/PM separately
        const attendance = await storage.setStudentAttendance({
          studentId,
          date,
          status,
          markedByUserId: userId,
          notes: notes || null,
          shiftId: effectiveShiftId, // Track attendance per-shift to avoid AM/PM overwrites
        });
        
        // Broadcast WebSocket notification if parent updated attendance
        // Only send to authorized clients (drivers on this route, admins)
        if (user.role === "parent") {
          const student = await storage.getStudent(studentId);
          const wss = req.app.locals.wss;
          if (wss && student?.assignedRouteId) {
            const notification = {
              type: "attendance_update",
              routeId: student.assignedRouteId,
              date,
            };
            
            // Broadcast only to authorized clients
            wss.clients.forEach((client: any) => {
              if (client.readyState === 1) {
                const clientRole = client.userRole;
                const clientRoutes = client.authorizedRoutes || [];
                
                // Send to admins (all routes) or drivers/parents with this route
                const isAuthorized = 
                  clientRole === 'admin' || 
                  clientRoutes.includes(student.assignedRouteId);
                
                if (isAuthorized) {
                  client.send(JSON.stringify(notification));
                }
              }
            });
          }
        }
        
        res.json(attendance);
      } catch (error: any) {
        console.error("[attendance] Error setting attendance:", error);
        res.status(500).json({ message: error?.message || "Failed to set attendance" });
      }
    }
  );

  // Get attendance for a specific date (admin only)
  app.get(
    "/api/admin/attendance/:date",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const date = req.params.date;
        const attendance = await storage.getAttendanceForDate(date);
        res.json(attendance);
      } catch (error) {
        console.error("Error fetching attendance:", error);
        res.status(500).json({ message: "Failed to fetch attendance" });
      }
    }
  );

  // Debug endpoint for admin to diagnose driver attendance issues
  // Only accessible in development or by explicitly enabling DEBUG_MODE env var
  app.get(
    "/api/admin/debug/driver-attendance/:driverId/:date",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      // Allow in development or if DEBUG_MODE is enabled
      const isDebugAllowed = process.env.NODE_ENV === 'development' || process.env.DEBUG_MODE === 'true';
      if (!isDebugAllowed) {
        return res.status(404).json({ message: "Not found" });
      }
      
      try {
        const { driverId, date } = req.params;
        
        // Get driver info
        const driver = await storage.getUser(driverId);
        if (!driver) {
          return res.status(404).json({ message: "Driver not found" });
        }
        
        // Get driver's shifts for date
        const shifts = await storage.getShiftsByDriver(driverId, date, date);
        
        // Get students for each route with per-shift attendance
        const routeStudentData = [];
        for (const shift of shifts) {
          if (shift.routeId) {
            const route = await storage.getRoute(shift.routeId);
            // Pass shiftId to get attendance specific to this shift (AM vs PM)
            const students = await storage.getStudentsByRouteForDate(shift.routeId, date, shift.id);
            const studentRouteAssignments = await Promise.all(
              students.map(async (s) => {
                const assignments = await storage.getStudentRouteAssignments(s.id);
                return {
                  studentId: s.id,
                  studentName: `${s.firstName} ${s.lastName}`,
                  attendance: s.attendance,
                  legacyRouteId: s.assignedRouteId,
                  junctionAssignments: assignments.map(a => ({ routeId: a.routeId })),
                };
              })
            );
            
            routeStudentData.push({
              shiftId: shift.id,
              routeId: shift.routeId,
              routeName: route?.name,
              shiftType: shift.shiftType,
              shiftDate: shift.date,
              routeStartedAt: shift.routeStartedAt,
              studentCount: students.length,
              students: studentRouteAssignments,
            });
          }
        }
        
        // Use local date for server comparison
        const now = new Date();
        const serverLocalDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        res.json({
          driver: {
            id: driver.id,
            name: `${driver.firstName} ${driver.lastName}`,
            isLeadDriver: driver.isLeadDriver,
          },
          queryDate: date,
          serverLocalDate,
          serverTimestamp: new Date().toISOString(),
          shiftCount: shifts.length,
          routeData: routeStudentData,
        });
      } catch (error) {
        console.error("Error in debug endpoint:", error);
        res.status(500).json({ message: "Failed to get debug info" });
      }
    }
  );

  // Get student attendance for parent (their children only)
  app.get(
    "/api/parent/student-attendance/:studentId/:date",
    requireAuth,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { studentId, date } = req.params;
        
        // Authorization check
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        
        const user = await storage.getUser(userId);
        const household = await storage.getUserHousehold(userId);
        const userPhoneNormalized = user?.phone?.replace(/\D/g, '') || '';
        const isAuthorized = 
          (household && student.householdId === household.id) ||
          student.guardianPhones.some(gp => gp.replace(/\D/g, '') === userPhoneNormalized);
        
        if (!isAuthorized) {
          return res.status(403).json({ message: "Not authorized to view this student's attendance" });
        }

        // Return all attendance records for the date (AM and PM)
        const attendanceRecords = await storage.getStudentAttendanceForDate(studentId, date);
        // Return array of all records, or single record for backward compatibility
        res.json(attendanceRecords.length > 0 ? attendanceRecords : null);
      } catch (error) {
        console.error("Error fetching student attendance:", error);
        res.status(500).json({ message: "Failed to fetch student attendance" });
      }
    }
  );

  // Get attendance overview for a specific date (admin only)
  app.get(
    "/api/admin/attendance/overview/:date",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const date = req.params.date;
        const overview = await storage.getAttendanceOverview(date);
        res.json(overview);
      } catch (error) {
        console.error("Error fetching attendance overview:", error);
        res.status(500).json({ message: "Failed to fetch attendance overview" });
      }
    }
  );

  // Get attendance analytics for date range (admin only)
  app.get(
    "/api/admin/attendance/analytics",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
          return res.status(400).json({ message: "startDate and endDate are required" });
        }
        const analytics = await storage.getAttendanceAnalytics(startDate as string, endDate as string);
        res.json(analytics);
      } catch (error) {
        console.error("Error fetching attendance analytics:", error);
        res.status(500).json({ message: "Failed to fetch attendance analytics" });
      }
    }
  );

  // Get monthly attendance stats (admin only)
  app.get(
    "/api/admin/attendance/monthly-stats/:year/:month",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const year = parseInt(req.params.year);
        const month = parseInt(req.params.month);
        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
          return res.status(400).json({ message: "Invalid year or month" });
        }
        const stats = await storage.getMonthlyAttendanceStats(year, month);
        res.json(stats);
      } catch (error) {
        console.error("Error fetching monthly stats:", error);
        res.status(500).json({ message: "Failed to fetch monthly stats" });
      }
    }
  );

  // Get student absence report for date range (admin only)
  app.get(
    "/api/admin/attendance/student-absences/:studentId",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { studentId } = req.params;
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
          return res.status(400).json({ message: "startDate and endDate are required" });
        }
        const absences = await storage.getStudentAbsenceReport(studentId, startDate as string, endDate as string);
        res.json(absences);
      } catch (error) {
        console.error("Error fetching student absences:", error);
        res.status(500).json({ message: "Failed to fetch student absences" });
      }
    }
  );

  // Create HTTP server
  const httpServer = createServer(app);

  // ============ WebSocket server for real-time messaging ============
  // Reference: WebSocket blueprint

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", async (ws, req) => {
    console.log("WebSocket client connected");

    // Parse session cookie to get user info
    let userId: number | null = null;
    let userRole: string | null = null;
    let authorizedRoutes: string[] = [];

    try {
      // Extract session from cookie
      const cookieHeader = req.headers.cookie;
      if (cookieHeader) {
        const sessionCookie = cookieHeader.split(';').find(c => c.trim().startsWith('connect.sid='));
        if (sessionCookie) {
          // Decode the URL-encoded cookie value
          const encodedSessionId = sessionCookie.split('=')[1];
          const sessionId = decodeURIComponent(encodedSessionId);
          // Parse the signed cookie (format: s:sessionId.signature)
          const unsignedSessionId = sessionId.startsWith('s:') ? sessionId.slice(2).split('.')[0] : sessionId;
          
          // Query session from database using raw SQL
          const sessionResult = await db.execute(
            sql`SELECT sess FROM sessions WHERE sid = ${unsignedSessionId}`
          );
          
          if (sessionResult.rows.length > 0) {
            const sessionData = sessionResult.rows[0].sess as any;
            if (sessionData?.passport?.user) {
              const sessionUserId = sessionData.passport.user;
              
              // Get user role
              const user = await storage.getUser(sessionUserId.toString());
              if (user) {
                userId = sessionUserId;
                userRole = user.role;
                
                // Get authorized routes based on role
                if (userRole === 'driver') {
                  // Get all routes this driver is assigned to
                  const assignments = await storage.getDriverAssignmentsByDriver(sessionUserId.toString());
                  authorizedRoutes = assignments.map(a => a.routeId);
                } else if (userRole === 'parent') {
                  // Get all routes for this parent's children
                  const students = await storage.getStudentsByHousehold(sessionUserId.toString());
                  authorizedRoutes = students
                    .map(s => s.assignedRouteId)
                    .filter((id): id is string => id !== null);
                }
                // Admin can see all routes, so leave authorizedRoutes empty (will allow all)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error parsing WebSocket session:", error);
    }

    // Store user info on the WebSocket client
    (ws as any).userId = userId;
    (ws as any).userRole = userRole;
    (ws as any).authorizedRoutes = authorizedRoutes;

    console.log(`WebSocket authenticated: userId=${userId}, role=${userRole}, routes=[${authorizedRoutes.join(', ')}]`);

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log("Received WebSocket message:", message);
        
        // Handle room subscription requests
        if (message.type === "subscribe" && message.room) {
          // Allow subscribing to route_run rooms if authorized
          if (message.room.startsWith("route_run:")) {
            const routeRunId = message.room.replace("route_run:", "");
            
            // Authorization check for route run access
            const wsUserId = (ws as any).userId;
            const wsUserRole = (ws as any).userRole;
            
            // Require authentication
            if (!wsUserId) {
              ws.send(JSON.stringify({ 
                type: "error", 
                message: "Not authenticated",
                room: message.room
              }));
              console.log(`Client rejected from room ${message.room}: not authenticated`);
              return;
            }
            
            // Fresh authorization check (not cached) using canAccessRoute
            const routeRun = await storage.getRouteRun(routeRunId);
            if (!routeRun) {
              ws.send(JSON.stringify({ 
                type: "error", 
                message: "Route run not found",
                room: message.room
              }));
              console.log(`Client rejected from room ${message.room}: route run not found`);
              return;
            }
            
            // Check authorization using fresh route assignment data
            const authorized = await canAccessRoute(wsUserId.toString(), wsUserRole, routeRun.routeId);
            
            if (!authorized) {
              ws.send(JSON.stringify({ 
                type: "error", 
                message: "Not authorized to subscribe to this route run",
                room: message.room
              }));
              console.log(`Client rejected from room ${message.room}: not authorized`);
              return;
            }
            
            subscribeToRoom(ws, message.room);
            ws.send(JSON.stringify({ 
              type: "subscribed", 
              room: message.room 
            }));
            console.log(`Client subscribed to room: ${message.room}`);
          }
        } else if (message.type === "unsubscribe" && message.room) {
          // Handle unsubscription
          const clients = wsRooms.get(message.room);
          if (clients) {
            clients.delete(ws);
            if (clients.size === 0) {
              wsRooms.delete(message.room);
            }
          }
          ws.send(JSON.stringify({ 
            type: "unsubscribed", 
            room: message.room 
          }));
          console.log(`Client unsubscribed from room: ${message.room}`);
        }
      } catch (e) {
        console.log("Non-JSON WebSocket message:", data.toString());
      }
    });

    ws.on("close", () => {
      // Clean up room subscriptions when client disconnects
      unsubscribeFromAllRooms(ws);
      console.log("WebSocket client disconnected");
    });
  });

  // Store wss for broadcasting from routes
  app.locals.wss = wss;

  return { httpServer, wss };
}
