// Reference: Replit Auth blueprint and WebSocket blueprint
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, requireRole } from "./replitAuth";
import { NotFoundError, ValidationError } from "./errors";
import express from "express";

export async function registerRoutes(app: Express): Promise<Server> {
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
      
      // If user is a parent and updated their phone number, check for household linking
      if (updatedUser.role === "parent" && normalizedData.phoneNumber) {
        try {
          // Find household by phone number (digits only)
          const household = await storage.findHouseholdByPhone(normalizedData.phoneNumber);
          
          if (household) {
            // Check if user is already linked to this household
            const existingHousehold = await storage.getUserHousehold(userId);
            
            if (!existingHousehold || existingHousehold.id !== household.id) {
              // Link user to household with proper object structure
              await storage.linkUserToHousehold({
                userId,
                householdId: household.id,
                roleInHousehold: "SECONDARY",
              });
              console.log(`Linked user ${userId} to household ${household.id} via phone ${normalizedData.phoneNumber}`);
            }
          }
        } catch (householdError) {
          // Don't fail the profile update if household linking fails
          console.error("Error linking user to household:", householdError);
        }
      }
      
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Get unread counts for current user
  app.get("/api/user/unread-counts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const messageCount = await storage.getUnreadMessageCount(userId);
      const messageCounts = await storage.getUnreadCountsBySender(userId);
      let announcementCount = 0;
      let notificationCount = 0;

      if (user.role === "driver" || user.role === "parent") {
        announcementCount = await storage.getUnreadAnnouncementCount(userId, user.role);
      }

      // Get driver notification count for drivers only
      if (user.role === "driver") {
        notificationCount = await storage.getUnreadDriverNotificationCount(userId);
      }

      res.json({
        messages: messageCount,
        announcements: announcementCount,
        notifications: notificationCount,
        messageBySender: messageCounts,
      });
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

  // Get all stops
  app.get(
    "/api/admin/stops",
    isAuthenticated,
    requireRole("admin"),
    async (req, res) => {
      try {
        const stops = await storage.getAllStops();
        // Enrich with route names
        const enrichedStops = await Promise.all(
          stops.map(async (stop) => {
            const route = await storage.getRoute(stop.routeId);
            return { ...stop, routeName: route?.name || "Unknown" };
          })
        );
        res.json(enrichedStops);
      } catch (error) {
        console.error("Error fetching stops:", error);
        res.status(500).json({ message: "Failed to fetch stops" });
      }
    }
  );

  // Create a new stop
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
        
        // Verify route exists
        const route = await storage.getRoute(result.data.routeId);
        if (!route) {
          return res.status(404).json({ message: "Route not found" });
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
        
        // If routeId is being updated, verify the route exists
        if (result.data.routeId) {
          const route = await storage.getRoute(result.data.routeId);
          if (!route) {
            return res.status(404).json({ message: "Route not found" });
          }
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

  // Get all schedules
  app.get(
    "/api/admin/schedules",
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
            const vehicle = await storage.getVehicle(assignment.vehicleId);
            
            return {
              ...assignment,
              driverName: driver
                ? `${driver.firstName} ${driver.lastName}`
                : "Unknown",
              driverEmail: driver?.email || "",
              routeName: route?.name || "Unknown",
              vehicleName: vehicle?.name || "Unknown",
              vehiclePlate: vehicle?.plateNumber || "Unknown",
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
        // Enrich with household and route information
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

            return {
              ...student,
              guardianPhones: student.guardianPhones || [],
              householdInfo,
              routeName,
              pickupStop,
              dropoffStop,
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
            const vehicle = await storage.getVehicle(assignment.vehicleId);
            
            return {
              ...assignment,
              driverName: driver ? `${driver.firstName} ${driver.lastName}` : "Unknown",
              driverEmail: driver?.email || "",
              routeName: route?.name || "Unknown",
              vehicleName: vehicle?.name || "Unknown",
              vehiclePlate: vehicle?.plateNumber || "Unknown",
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

        // Validate vehicle exists
        const vehicle = await storage.getVehicle(validatedData.vehicleId);
        if (!vehicle) {
          return res.status(404).json({ message: "Vehicle not found" });
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

        if (updates.vehicleId) {
          const vehicle = await storage.getVehicle(updates.vehicleId);
          if (!vehicle) {
            return res.status(404).json({ message: "Vehicle not found" });
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

  // Bulk create shifts
  app.post(
    "/api/admin/shifts/bulk",
    isAuthenticated,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { z } = await import("zod");
        const { insertShiftSchema } = await import("@shared/schema");
        
        // Validate bulk request
        const bulkSchema = z.object({
          driverIds: z.array(z.string()).min(1, "At least one driver required"),
          startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          daysOfWeek: z.array(z.number().min(0).max(6)).min(1, "At least one day required"),
          shiftType: z.enum(["MORNING", "AFTERNOON", "EXTRA"]),
          routeId: z.string().nullable(),
          vehicleId: z.string().nullable(),
          plannedStart: z.string(),
          plannedEnd: z.string(),
          status: z.enum(["SCHEDULED", "ACTIVE", "COMPLETED", "MISSED"]).optional().default("SCHEDULED"),
          notes: z.string().nullable(),
        });

        const bulkData = bulkSchema.parse(req.body);
        
        // Validate all drivers exist and are drivers
        for (const driverId of bulkData.driverIds) {
          const driver = await storage.getUser(driverId);
          if (!driver || driver.role !== "driver") {
            return res.status(400).json({ message: `Invalid driver: ${driverId}` });
          }
        }
        
        // Validate route exists (if provided)
        if (bulkData.routeId) {
          const route = await storage.getRoute(bulkData.routeId);
          if (!route) {
            return res.status(400).json({ message: "Route not found" });
          }
        }
        
        // Validate vehicle exists (if provided)
        if (bulkData.vehicleId) {
          const vehicle = await storage.getVehicle(bulkData.vehicleId);
          if (!vehicle) {
            return res.status(400).json({ message: "Vehicle not found" });
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
        
        // Create shifts for each driver on each matching date
        const createdShifts = [];
        for (const driverId of bulkData.driverIds) {
          for (const date of dates) {
            const shiftData = {
              driverId,
              date,
              shiftType: bulkData.shiftType,
              routeId: bulkData.routeId,
              vehicleId: bulkData.vehicleId,
              plannedStart: bulkData.plannedStart,
              plannedEnd: bulkData.plannedEnd,
              status: bulkData.status,
              notes: bulkData.notes,
            };
            
            const shift = await storage.createShift(shiftData);
            createdShifts.push(shift);
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

  // Get today's route
  app.get(
    "/api/driver/today-route",
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
        const assignment = await storage.getDriverAssignmentForToday(driverId);

        if (!assignment) {
          return res.json(null);
        }

        const route = await storage.getRoute(assignment.routeId);
        const stops = route ? await storage.getRouteStops(route.id) : [];

        res.json({
          ...assignment,
          routeName: route?.name || "Unknown",
          stops,
        });
      } catch (error) {
        console.error("Error fetching today's route:", error);
        res.status(500).json({ message: "Failed to fetch route" });
      }
    }
  );

  // Get driver's weekly schedule
  app.get(
    "/api/driver/schedule",
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
        const allAssignments = await storage.getAllDriverAssignments();
        
        // Filter assignments for this driver
        const driverAssignments = allAssignments.filter(
          a => a.driverId === driverId && a.isActive
        );

        // Enrich with route and vehicle information
        const enrichedAssignments = await Promise.all(
          driverAssignments.map(async (assignment) => {
            const route = await storage.getRoute(assignment.routeId);
            const vehicle = await storage.getVehicle(assignment.vehicleId);
            const stops = route ? await storage.getRouteStops(route.id) : [];
            
            return {
              ...assignment,
              routeName: route?.name || "Unknown",
              vehicleName: vehicle?.name || "Unknown",
              vehiclePlate: vehicle?.plateNumber || "Unknown",
              stops,
            };
          })
        );

        res.json(enrichedAssignments);
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

        // Enrich with route, stop details, and attendance
        const enrichedStudents = await Promise.all(
          students.map(async (student) => {
            let routeName = null;
            let pickupStop = null;
            let dropoffStop = null;

            if (student.assignedRouteId) {
              const route = await storage.getRoute(student.assignedRouteId);
              routeName = route?.name || null;
            }

            if (student.pickupStopId) {
              const stops = student.assignedRouteId
                ? await storage.getRouteStops(student.assignedRouteId)
                : [];
              pickupStop = stops.find((s) => s.id === student.pickupStopId);
            }

            if (student.dropoffStopId) {
              const stops = student.assignedRouteId
                ? await storage.getRouteStops(student.assignedRouteId)
                : [];
              dropoffStop = stops.find((s) => s.id === student.dropoffStopId);
            }

            // Get today's attendance
            const attendance = await storage.getStudentAttendance(student.id, today);

            return {
              ...student,
              routeName,
              pickupStop,
              dropoffStop,
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

  // Get vehicle location for parent's student
  app.get(
    "/api/parent/vehicle-location",
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.claims.sub;
        const students = await storage.getStudentsByParent(parentId);

        if (students.length === 0 || !students[0].assignedRouteId) {
          return res.json(null);
        }

        // Get vehicle assigned to this route (simplified)
        const today = new Date().toISOString().split('T')[0];
        const assignments = await storage.getAllDriverAssignments();
        const todayAssignment = assignments.find(
          (a) =>
            a.routeId === students[0].assignedRouteId &&
            a.date === today &&
            a.isActive
        );

        if (!todayAssignment) {
          return res.json(null);
        }

        const vehicle = await storage.getVehicle(todayAssignment.vehicleId);
        const route = await storage.getRoute(students[0].assignedRouteId);

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
        
        // If not admin, verify driver can message this parent (via routes)
        if (!isAdmin) {
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
        const routeId = req.params.routeId;
        const today = new Date().toISOString().split('T')[0];
        const students = await storage.getStudentsByRouteForDate(routeId, today);
        res.json(students);
      } catch (error) {
        console.error("Error fetching route students:", error);
        res.status(500).json({ message: "Failed to fetch route students" });
      }
    }
  );

  // Set student attendance (all roles)
  app.post(
    "/api/attendance",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { studentId, date, status, notes } = req.body;
        
        // Validate request
        if (!studentId || !date || !status) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Authorization check for parents
        if (user.role === "parent") {
          const student = await storage.getStudent(studentId);
          if (!student) {
            return res.status(404).json({ message: "Student not found" });
          }
          
          // Check if parent is authorized (via household or guardian phone)
          const household = await storage.getUserHousehold(userId);
          const userPhoneNormalized = user.phone?.replace(/\D/g, '') || '';
          const isAuthorized = 
            (household && student.householdId === household.id) ||
            student.guardianPhones.some(gp => gp.replace(/\D/g, '') === userPhoneNormalized);
          
          if (!isAuthorized) {
            return res.status(403).json({ message: "Not authorized to mark attendance for this student" });
          }
        }

        const attendance = await storage.setStudentAttendance({
          studentId,
          date,
          status,
          markedByUserId: userId,
          notes: notes || null,
        });
        
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

  // Create HTTP server
  const httpServer = createServer(app);

  // ============ WebSocket server for real-time messaging ============
  // Reference: WebSocket blueprint

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    console.log("WebSocket client connected");

    ws.on("message", (data) => {
      console.log("Received WebSocket message:", data.toString());
    });

    ws.on("close", () => {
      console.log("WebSocket client disconnected");
    });
  });

  return httpServer;
}

// Export wss for broadcasting
let wss: WebSocketServer | null = null;
