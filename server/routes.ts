// Reference: Replit Auth blueprint and WebSocket blueprint
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { setupAuth, isAuthenticated, requireRole } from "./replitAuth";
import { NotFoundError, ValidationError } from "./errors";
import express from "express";
import memoizee from "memoizee";
import { registerAdminImportRoutes } from "./routes/admin-import";

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
  // Auth middleware
  await setupAuth(app);

  app.use(express.json());

  // ============ Auth routes (Required for Replit Auth) ============

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user profile
  app.patch("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      
      // Prevent phone number changes through this endpoint for parents
      // Parents must use the dedicated /api/parent/update-phone endpoint to ensure guardian phone sync
      const user = await storage.getUser(userId);
      if (user?.role === "parent" && result.data.phoneNumber) {
        const normalizedNewPhone = result.data.phoneNumber.replace(/\D/g, '');
        const currentPhone = user.phoneNumber;
        
        if (normalizedNewPhone !== currentPhone) {
          return res.status(400).json({
            message: "Please use the 'Change Phone' button to update your phone number. This ensures your children's records stay synchronized."
          });
        }
      }
      
      // Strip phone formatting to store only digits
      const normalizedData = {
        ...result.data,
        phoneNumber: result.data.phoneNumber ? result.data.phoneNumber.replace(/\D/g, '') : result.data.phoneNumber
      };
      
      console.log(`[PATCH /api/profile] Normalized data:`, normalizedData);
      
      const updatedUser = await storage.updateUserProfile(userId, normalizedData);
      
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
  app.delete("/api/profile/delete-account", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Delete user and all associated data
      await storage.deleteUser(userId);
      
      // Log the user out by destroying session
      req.logout((err: any) => {
        if (err) {
          console.error("Error logging out after account deletion:", err);
        }
        res.json({ success: true, message: "Account deleted successfully" });
      });
    } catch (error: any) {
      console.error("Error deleting account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // ============ Billing Portal Configuration Routes ============

  // Get enabled payment portals for parents
  app.get("/api/billing/portals", isAuthenticated, async (req: any, res) => {
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
  app.post("/api/push-tokens", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { insertDeviceTokenSchema } = await import("@shared/schema");
      
      const result = insertDeviceTokenSchema.safeParse(req.body);
      if (!result.success) {
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
      res.json(deviceToken);
    } catch (error: any) {
      console.error("Error registering device token:", error);
      res.status(500).json({ message: "Failed to register device token" });
    }
  });

  // Delete device token (when user logs out of device)
  app.delete("/api/push-tokens/:token", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { token } = req.params;

      await storage.deleteDeviceToken(userId, token);
      res.json({ success: true, message: "Device token deleted" });
    } catch (error: any) {
      console.error("Error deleting device token:", error);
      res.status(500).json({ message: "Failed to delete device token" });
    }
  });

  // Get unread counts for current user (with 3-second cache to reduce DB load)
  const getUnreadCountsCached = memoizee(
    async (userId: string, userRole: string) => {
      const messageCount = await storage.getUnreadMessageCount(userId);
      const messageCounts = await storage.getUnreadCountsBySender(userId);
      let announcementCount = 0;
      let notificationCount = 0;

      if (userRole === "driver" || userRole === "parent") {
        announcementCount = await storage.getUnreadAnnouncementCount(userId, userRole);
      }

      if (userRole === "driver") {
        notificationCount = await storage.getUnreadDriverNotificationCount(userId);
      }

      return {
        messages: messageCount,
        announcements: announcementCount,
        notifications: notificationCount,
        messageBySender: messageCounts,
      };
    },
    {
      maxAge: 3000, // Cache for 3 seconds
      promise: true,
      primitive: true,
    }
  );

  app.get("/api/user/unread-counts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.get("/api/user/unread-announcements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.post("/api/messages/mark-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.post("/api/announcements/mark-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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

            // Determine driver status
            let driverStatus = "NOT_STARTED";
            if (!assignedDriver) {
              driverStatus = "NO_DRIVER";
            } else {
              // Check if driver has active shift today
              const shifts = await storage.getShiftsByDate(today, today);
              const driverShift = shifts.find(s => s.driverId === assignedDriver.id && s.routeId === route.id);
              if (driverShift) {
                driverStatus = driverShift.status === "ACTIVE" ? "ON_TIME" : "NOT_STARTED";
              }
            }

            return {
              routeId: route.id,
              routeName: route.name,
              isActive: route.isActive,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
    requireRole("admin"),
    async (req, res) => {
      try {
        const incidents = await storage.getAllIncidents();
        res.json(incidents);
      } catch (error) {
        console.error("Error fetching incidents:", error);
        res.status(500).json({ message: "Failed to fetch incidents" });
      }
    }
  );

  // Update incident status (resolve incident)
  app.patch(
    "/api/admin/incidents/:id",
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { status, adminNotes } = req.body;
        const approvedBy = req.user.claims.sub;

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
    isAuthenticated,
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
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { status, adminResponse } = req.body;
        const respondedBy = req.user.claims.sub;

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
    isAuthenticated,
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
    isAuthenticated,
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

  // ============ Audit Log Routes ============

  // Get all audit logs
  app.get(
    "/api/admin/audit-logs",
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { key, value, description } = req.body;
        const userId = req.user.claims.sub;

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

  // ============ Admin Payroll Export Routes (BambooHR Integration) ============

  // Get drivers with BambooHR employee mapping
  app.get(
    "/api/admin/payroll/drivers",
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { startDate, endDate, includeOvertime } = req.body;
        const userId = req.user.claims.sub;

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
    isAuthenticated,
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
    isAuthenticated,
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
  registerAdminImportRoutes(app, storage, isAuthenticated, requireRole);

  // Get all users
  app.get(
    "/api/admin/users",
    isAuthenticated,
    requireRole("admin"),
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
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { userId } = req.params;
        const { role } = req.body;
        const currentUserId = req.user.claims.sub;

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

  // Get all vehicles
  app.get(
    "/api/admin/vehicles",
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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

  // Get all routes
  app.get(
    "/api/admin/routes",
    isAuthenticated,
    requireRole("admin"),
    async (req, res) => {
      try {
        const routes = await storage.getAllRoutes();
        // Enrich with stop count
        const enrichedRoutes = await Promise.all(
          routes.map(async (route) => {
            const stops = await storage.getRouteStops(route.id);
            return { ...route, stopCount: stops.length };
          })
        );
        res.json(enrichedRoutes);
      } catch (error) {
        console.error("Error fetching routes:", error);
        res.status(500).json({ message: "Failed to fetch routes" });
      }
    }
  );

  // Create a new route
  app.post(
    "/api/admin/routes",
    isAuthenticated,
    requireRole("admin"),
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

  // Update a route
  app.patch(
    "/api/admin/routes/:id",
    isAuthenticated,
    requireRole("admin"),
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

  // Delete a route
  app.delete(
    "/api/admin/routes/:id",
    isAuthenticated,
    requireRole("admin"),
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

  // Get stops for a specific route
  app.get(
    "/api/admin/routes/:routeId/stops",
    isAuthenticated,
    requireRole("admin"),
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

  // Get all stops (independent of routes)
  app.get(
    "/api/admin/stops",
    isAuthenticated,
    requireRole("admin"),
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

  // Create a new stop (not tied to any route)
  app.post(
    "/api/admin/stops",
    isAuthenticated,
    requireRole("admin"),
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

  // Update a stop
  app.patch(
    "/api/admin/stops/:id",
    isAuthenticated,
    requireRole("admin"),
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

  // Delete a stop
  app.delete(
    "/api/admin/stops/:id",
    isAuthenticated,
    requireRole("admin"),
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

  // Add a stop to a route (create route_stop junction)
  app.post(
    "/api/admin/routes/:routeId/stops",
    isAuthenticated,
    requireRole("admin"),
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

  // Update route stops (for reordering or changing scheduled times)
  app.patch(
    "/api/admin/routes/:routeId/stops",
    isAuthenticated,
    requireRole("admin"),
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

  // Remove a stop from a route (delete route_stop junction)
  app.delete(
    "/api/admin/routes/:routeId/stops/:routeStopId",
    isAuthenticated,
    requireRole("admin"),
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

  // Get all schedules
  app.get(
    "/api/admin/schedules",
    isAuthenticated,
    requireRole("admin"),
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
    isAuthenticated,
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
            
            // Get all route assignments from junction table
            const routeAssignments = await storage.getStudentRouteAssignments(student.id);
            const assignedRoutes = await Promise.all(
              routeAssignments.map(async (assignment) => {
                const route = await storage.getRoute(assignment.routeId);
                return {
                  assignmentId: assignment.id,
                  routeId: assignment.routeId,
                  routeName: route?.name || "Unknown",
                  routeType: route?.routeType || null,
                  pickupStopId: assignment.pickupStopId,
                  dropoffStopId: assignment.dropoffStopId,
                };
              })
            );

            // Legacy single-route support for backwards compatibility
            let routeName = null;
            let pickupStop = null;
            let dropoffStop = null;

            if (student.assignedRouteId) {
              const route = await storage.getRoute(student.assignedRouteId);
              routeName = route?.name || null;
              
              const stops = await storage.getRouteStops(student.assignedRouteId);
              if (student.pickupStopId) {
                pickupStop = stops.find(s => s.id === student.pickupStopId);
              }
              if (student.dropoffStopId) {
                dropoffStop = stops.find(s => s.id === student.dropoffStopId);
              }
            }

            // Get today's attendance
            const attendance = await storage.getStudentAttendance(student.id, today);

            return {
              ...student,
              guardianPhones: student.guardianPhones || [],
              householdInfo,
              routeName,
              pickupStop,
              dropoffStop,
              assignedRoutes, // New multi-route assignments
              attendance,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
      } catch (error) {
        console.error("Error creating student route assignment:", error);
        res.status(500).json({ message: "Failed to create student route assignment" });
      }
    }
  );

  // Update student-route assignment stops
  app.patch(
    "/api/admin/student-routes/:assignmentId",
    isAuthenticated,
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
    isAuthenticated,
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

  // ============ Driver Assignment routes (Admin) ============

  // Get all driver assignments
  app.get(
    "/api/admin/driver-assignments",
    isAuthenticated,
    requireRole("admin"),
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

  // Create new driver assignment
  app.post(
    "/api/admin/driver-assignments",
    isAuthenticated,
    requireRole("admin"),
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

  // Update driver assignment
  app.patch(
    "/api/admin/driver-assignments/:id",
    isAuthenticated,
    requireRole("admin"),
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

  // Delete driver assignment
  app.delete(
    "/api/admin/driver-assignments/:id",
    isAuthenticated,
    requireRole("admin"),
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

  // ============ Shift routes (Admin) ============

  // Get shifts by date (optionally filtered by driver)
  app.get(
    "/api/admin/shifts",
    isAuthenticated,
    requireRole("admin"),
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

  // Create new shift
  app.post(
    "/api/admin/shifts",
    isAuthenticated,
    requireRole("admin"),
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

  // Bulk create shifts from driver assignments
  app.post(
    "/api/admin/shifts/bulk",
    isAuthenticated,
    requireRole("admin"),
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

  // Create shifts from driver assignments
  app.post(
    "/api/admin/shifts/from-assignments",
    isAuthenticated,
    requireRole("admin"),
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

  // Bulk add shifts for selected dates and drivers
  app.post(
    "/api/admin/shifts/bulk-add",
    isAuthenticated,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { z } = await import("zod");
        
        const schema = z.object({
          dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")).min(1),
          driverIds: z.array(z.string()).min(1),
          vehicleId: z.string().min(1, "Vehicle ID is required"),
          plannedStart: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
          plannedEnd: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
        });

        const data = schema.parse(req.body);
        
        const createdShifts = [];
        
        // For each driver, get their assignments and create shifts for each selected date
        for (const driverId of data.driverIds) {
          const assignments = await storage.getDriverAssignmentsByDriver(driverId);
          
          for (const date of data.dates) {
            // Create shifts from all of this driver's assignments
            for (const assignment of assignments) {
              const route = await storage.getRoute(assignment.routeId);
              let shiftType: "MORNING" | "AFTERNOON" | "EXTRA" = "MORNING";
              if (route?.routeType) {
                shiftType = route.routeType as "MORNING" | "AFTERNOON" | "EXTRA";
              }
              
              const shiftData = {
                driverId: assignment.driverId,
                driverAssignmentId: assignment.id,
                date,
                shiftType,
                routeId: assignment.routeId,
                vehicleId: data.vehicleId,
                plannedStart: data.plannedStart,
                plannedEnd: data.plannedEnd,
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
          shifts: createdShifts 
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

  // Bulk delete shifts for selected dates and drivers
  app.post(
    "/api/admin/shifts/bulk-delete",
    isAuthenticated,
    requireRole("admin"),
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

  // Update shift
  app.patch(
    "/api/admin/shifts/:id",
    isAuthenticated,
    requireRole("admin"),
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

  // Delete shift
  app.delete(
    "/api/admin/shifts/:id",
    isAuthenticated,
    requireRole("admin"),
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
    isAuthenticated,
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
        res.json(events);
      } catch (error) {
        console.error("Error fetching all clock events:", error);
        res.status(500).json({ message: "Failed to fetch clock events" });
      }
    }
  );

  // Get unresolved clock events (for admin time exceptions queue)
  app.get(
    "/api/admin/clock-events/unresolved",
    isAuthenticated,
    requireRole("admin"),
    async (req, res) => {
      try {
        const events = await storage.getUnresolvedClockEvents();
        res.json(events);
      } catch (error) {
        console.error("Error fetching unresolved clock events:", error);
        res.status(500).json({ message: "Failed to fetch unresolved clock events" });
      }
    }
  );

  // Resolve clock event
  app.patch(
    "/api/admin/clock-events/:id/resolve",
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
        const shifts = await storage.getDriverTodayShifts(driverId);
        
        // Enrich with route and vehicle information
        const enrichedShifts = await Promise.all(
          shifts.map(async (shift) => {
            const route = shift.routeId ? await storage.getRoute(shift.routeId) : null;
            const vehicle = shift.vehicleId ? await storage.getVehicle(shift.vehicleId) : null;
            const clockEvents = await storage.getClockEventsByShift(shift.id);
            
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
            const clockEvents = await storage.getClockEventsByShift(shift.id);
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
        const activeBreak = await storage.getActiveBreak(driverId);
        
        res.json({ activeBreak });
      } catch (error) {
        console.error("Error getting break status:", error);
        res.status(500).json({ message: "Failed to get break status" });
      }
    }
  );

  // ============ Simple Clock In/Out System (Not Shift-Based) ============

  // Simple clock-in (general timekeeping, not tied to a specific shift)
  app.post(
    "/api/driver/clock-in",
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
        
        // Check if already clocked in
        const activeClockIn = await storage.getActiveClockIn(driverId);
        if (activeClockIn) {
          return res.status(400).json({ 
            message: "Already clocked in. Please clock out first." 
          });
        }
        
        // Create clock IN event (no shift association)
        const clockEvent = await storage.createClockEvent({
          driverId,
          shiftId: null, // Not tied to a specific shift
          type: "IN",
          source: "USER",
          notes: null,
          isResolved: true,
        });
        
        res.json({ clockEvent });
      } catch (error) {
        console.error("Error clocking in:", error);
        res.status(500).json({ message: "Failed to clock in" });
      }
    }
  );

  // Simple clock-out (general timekeeping)
  app.post(
    "/api/driver/clock-out",
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
        const { notes } = req.body;
        
        // Check if clocked in
        const activeClockIn = await storage.getActiveClockIn(driverId);
        if (!activeClockIn) {
          return res.status(400).json({ 
            message: "Not currently clocked in" 
          });
        }
        
        // Create clock OUT event
        const clockEvent = await storage.createClockEvent({
          driverId,
          shiftId: null,
          type: "OUT",
          source: "USER",
          notes: notes || null,
          isResolved: true,
        });
        
        res.json({ clockEvent });
      } catch (error) {
        console.error("Error clocking out:", error);
        res.status(500).json({ message: "Failed to clock out" });
      }
    }
  );

  // Get current clock status
  app.get(
    "/api/driver/clock-status",
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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

  // Complete vehicle inspection for a shift
  app.post(
    "/api/driver/shift/:shiftId/complete-inspection",
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
        const { shiftId } = req.params;
        const { tiresOk, lightsOk, brakesOk, fluidLevelsOk, cleanlinessOk, notes } = req.body;
        
        // Verify shift belongs to this driver
        const shift = await storage.getShift(shiftId);
        if (!shift) {
          return res.status(404).json({ message: "Shift not found" });
        }
        if (shift.driverId !== driverId) {
          return res.status(403).json({ message: "Not authorized for this shift" });
        }
        
        // Validate all checks are completed
        if (!tiresOk || !lightsOk || !brakesOk || !fluidLevelsOk || !cleanlinessOk) {
          return res.status(400).json({ 
            message: "All inspection items must be marked OK before completing inspection" 
          });
        }
        
        // Update shift with inspection completion timestamp
        await storage.updateShift(shiftId, {
          inspectionCompletedAt: new Date(),
        });
        
        // Also create a vehicle checklist record if vehicleId exists
        if (shift.vehicleId) {
          await storage.createVehicleChecklist({
            driverId,
            vehicleId: shift.vehicleId,
            shiftId,
            checklistType: "PRE_TRIP",
            tiresOk,
            lightsOk,
            brakesOk,
            fluidLevelsOk,
            interiorCleanOk: cleanlinessOk,
            emergencyEquipmentOk: true,
            mirrorsOk: true,
            seatsOk: true,
            odometerReading: null,
            fuelLevel: null,
            issues: notes || null,
          });
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
        }
        
        const updatedShift = await storage.getShift(shiftId);
        res.json({ shift: updatedShift });
      } catch (error) {
        console.error("Error starting route:", error);
        res.status(500).json({ message: "Failed to start route" });
      }
    }
  );

  // ============ Driver Utility Routes ============

  // Supplies Requests - Create new request
  app.post(
    "/api/driver/supplies-request",
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
        
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;

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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;

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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
        
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
        const { tiresOk, lightsOk, brakesOk, fluidLevelsOk, cleanlinessOk, notes } =
          req.body;

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

  // Report incident
  app.post(
    "/api/driver/incident",
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
        const { title, description, severity, location } = req.body;

        const incident = await storage.createIncident({
          reporterId: driverId,
          title,
          description,
          severity,
          location: location || null,
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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

        const updated = await storage.updateStopStatus(shiftId, routeStopId, status, notes);
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

  // ============ Route Progress routes (Parent) ============

  // Get route progress for student
  app.get(
    "/api/parent/student-progress/:studentId",
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.claims.sub;
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
            let effectiveRouteId = null;
            let effectivePickupStopId = null;
            let effectiveDropoffStopId = null;

            const routeAssignments = await storage.getStudentRouteAssignments(student.id);
            if (routeAssignments && routeAssignments.length > 0) {
              // Use the first route assignment (could be enhanced to prioritize AM routes or active routes)
              const assignment = routeAssignments[0];
              effectiveRouteId = assignment.routeId;
              effectivePickupStopId = assignment.pickupStopId;
              effectiveDropoffStopId = assignment.dropoffStopId;
            } else if (student.assignedRouteId) {
              // Fall back to legacy single-route fields for backward compatibility
              effectiveRouteId = student.assignedRouteId;
              effectivePickupStopId = student.pickupStopId;
              effectiveDropoffStopId = student.dropoffStopId;
            }

            if (effectiveRouteId) {
              const route = await storage.getRoute(effectiveRouteId);
              routeName = route?.name || null;

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

            // Get today's attendance
            const attendance = await storage.getStudentAttendance(student.id, today);

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
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.claims.sub;
        const students = await storage.getStudentsByParent(parentId);

        if (students.length === 0) {
          return res.json(null);
        }

        // Get effective route ID (check junction table first, fall back to legacy field)
        let effectiveRouteId = null;
        const routeAssignments = await storage.getStudentRouteAssignments(students[0].id);
        if (routeAssignments && routeAssignments.length > 0) {
          effectiveRouteId = routeAssignments[0].routeId;
        } else if (students[0].assignedRouteId) {
          effectiveRouteId = students[0].assignedRouteId;
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
    isAuthenticated,
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
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const { students } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");

        const parentId = req.user.claims.sub;
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

  // Get ETA to student's pickup stop
  app.get(
    "/api/parent/eta/:studentId",
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const { calculateDistance, calculateETA, formatDistance, formatETA } = await import("./gps-utils");

        const parentId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.claims.sub;
        
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
    isAuthenticated,
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
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const senderId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.claims.sub;
        
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
        
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const senderId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
        
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const currentUserId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const adminId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const adminId = req.user.claims.sub;
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const senderId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const adminId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const adminId = req.user.claims.sub;
        const { title, content, targetRole } = req.body;

        if (!title || !content || !targetRole) {
          return res.status(400).json({ message: "Title, content, and target role are required" });
        }

        if (targetRole !== "driver" && targetRole !== "parent") {
          return res.status(400).json({ message: "Target role must be 'driver' or 'parent'" });
        }

        const announcement = await storage.createAnnouncement({
          adminId,
          title,
          content,
          targetRole,
        });

        // Broadcast via WebSocket
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
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const adminId = req.user.claims.sub;
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

        res.json(announcement);
      } catch (error) {
        console.error("Error creating route announcement:", error);
        res.status(500).json({ message: "Failed to create route announcement" });
      }
    }
  );

  // Get announcements for drivers
  app.get(
    "/api/driver/announcements",
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
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
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
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
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.claims.sub;
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
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
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
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
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

  // Get students on driver's route for attendance (driver-specific)
  app.get(
    "/api/driver/route-students/:routeId",
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
        const routeId = req.params.routeId;
        const today = new Date().toISOString().split('T')[0];
        
        // Find driver's active shift for this route today
        const shifts = await storage.getShiftsByDriver(driverId, today, today);
        const activeShift = shifts.find(s => s.routeId === routeId && s.date === today);
        
        if (!activeShift) {
          return res.status(404).json({ message: "No shift found for this route today" });
        }
        
        // Check if route has been started
        if (!activeShift.routeStartedAt) {
          return res.status(400).json({ 
            message: "Route has not been started. Please start the route from the dashboard first." 
          });
        }
        
        const students = await storage.getStudentsByRouteForDate(routeId, today);
        res.json(students);
      } catch (error) {
        console.error("Error fetching route students:", error);
        res.status(500).json({ message: "Failed to fetch route students" });
      }
    }
  );

  // Set student attendance (all roles) - supports single date or date range
  app.post(
    "/api/attendance",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { studentId, date, endDate, status, notes } = req.body;
        
        // Validate request
        if (!studentId || !date || !status) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Authorization check for drivers - must have started route
        if (user.role === "driver") {
          const student = await storage.getStudent(studentId);
          if (!student) {
            return res.status(404).json({ message: "Student not found" });
          }
          
          // Find driver's shift for the student's route on the given date
          const shifts = await storage.getShiftsByDriver(userId, date, date);
          
          // Check if driver has a shift for any of the student's assigned routes
          let hasActiveStartedShift = false;
          
          // Check studentRoutes (multi-route assignments)
          const studentRoutes = await storage.getStudentRoutes(studentId);
          for (const sr of studentRoutes) {
            const shift = shifts.find(s => s.routeId === sr.routeId && s.date === date);
            if (shift?.routeStartedAt) {
              hasActiveStartedShift = true;
              break;
            }
          }
          
          // Also check legacy assignedRouteId
          if (!hasActiveStartedShift && student.assignedRouteId) {
            const shift = shifts.find(s => s.routeId === student.assignedRouteId && s.date === date);
            if (shift?.routeStartedAt) {
              hasActiveStartedShift = true;
            }
          }
          
          if (!hasActiveStartedShift) {
            return res.status(400).json({ 
              message: "Route has not been started. Please start the route from the dashboard first." 
            });
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
            });
            attendanceRecords.push(record);
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          return res.json({ 
            message: `Attendance set for ${attendanceRecords.length} days`,
            records: attendanceRecords 
          });
        }

        // Single date attendance
        const attendance = await storage.setStudentAttendance({
          studentId,
          date,
          status,
          markedByUserId: userId,
          notes: notes || null,
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
      } catch (error) {
        console.error("Error setting attendance:", error);
        res.status(500).json({ message: "Failed to set attendance" });
      }
    }
  );

  // Get attendance for a specific date (admin only)
  app.get(
    "/api/admin/attendance/:date",
    isAuthenticated,
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

  // Get student attendance for parent (their children only)
  app.get(
    "/api/parent/student-attendance/:studentId/:date",
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
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

        const attendance = await storage.getStudentAttendance(studentId, date);
        res.json(attendance || null);
      } catch (error) {
        console.error("Error fetching student attendance:", error);
        res.status(500).json({ message: "Failed to fetch student attendance" });
      }
    }
  );

  // Get attendance overview for a specific date (admin only)
  app.get(
    "/api/admin/attendance/overview/:date",
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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
    isAuthenticated,
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

    ws.on("message", (data) => {
      console.log("Received WebSocket message:", data.toString());
    });

    ws.on("close", () => {
      console.log("WebSocket client disconnected");
    });
  });

  // Store wss for broadcasting from routes
  app.locals.wss = wss;

  return { httpServer, wss };
}
