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
      
      // Validate request body
      const result = updateProfileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid profile data", 
          errors: result.error.errors 
        });
      }
      
      const updatedUser = await storage.updateUserProfile(userId, result.data);
      
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to update profile" });
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

  // Get all schedules
  app.get(
    "/api/admin/schedules",
    isAuthenticated,
    requireRole("admin"),
    async (req, res) => {
      try {
        const assignments = await storage.getAllDriverAssignments();
        // Enrich with driver and route names
        const enrichedAssignments = await Promise.all(
          assignments.map(async (assignment) => {
            const driver = await storage.getUser(assignment.driverId);
            const route = await storage.getRoute(assignment.routeId);
            return {
              ...assignment,
              driverName: driver
                ? `${driver.firstName} ${driver.lastName}`
                : "Unknown",
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
        // Enrich with parent and route information
        const enrichedStudents = await Promise.all(
          students.map(async (student) => {
            const parent = await storage.getUser(student.parentId);
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
              parentName: parent ? `${parent.firstName} ${parent.lastName}` : "Unknown",
              parentEmail: parent?.email || null,
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

  // Clock in
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

  // Clock out
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

  // Get parent's students
  app.get(
    "/api/parent/students",
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.claims.sub;
        const students = await storage.getStudentsByParent(parentId);

        // Enrich with route and stop details
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

            return {
              ...student,
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
        const assignments = await storage.getAllDriverAssignments();
        const todayAssignment = assignments.find(
          (a) =>
            a.routeId === students[0].assignedRouteId &&
            a.dayOfWeek === new Date().getDay() &&
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

  // Create new child profile
  app.post(
    "/api/parent/students",
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.claims.sub;
        const { insertStudentSchema } = await import("@shared/schema");
        
        // Validate request body
        const result = insertStudentSchema.safeParse({
          ...req.body,
          parentId,
        });
        
        if (!result.success) {
          return res.status(400).json({ 
            message: "Invalid student data", 
            errors: result.error.errors 
          });
        }
        
        const newStudent = await storage.createStudent(result.data);
        res.json(newStudent);
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
        
        // Verify the student belongs to this parent
        const student = await storage.getStudent(studentId);
        if (!student || student.parentId !== parentId) {
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
        
        // Verify the student belongs to this parent
        const student = await storage.getStudent(studentId);
        if (!student || student.parentId !== parentId) {
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
    "/api/parent/messages/:driverId",
    isAuthenticated,
    requireRole("parent"),
    async (req: any, res) => {
      try {
        const parentId = req.user.claims.sub;
        const driverId = req.params.driverId;
        
        // Verify driver is assigned to at least one of parent's children
        const parentStudents = await storage.getStudentsByParent(parentId);
        const hasAssignedDriver = parentStudents.some((student: any) => student.driverId === driverId);
        
        if (!hasAssignedDriver) {
          return res.status(403).json({ message: "You can only message drivers assigned to your children" });
        }
        
        const messages = await storage.getMessagesBetweenUsers(parentId, driverId);
        
        // Add sender details to each message
        const messagesWithDetails = await Promise.all(
          messages.map(async (msg) => {
            const sender = await storage.getUser(msg.senderId);
            return {
              ...msg,
              isOwn: msg.senderId === parentId,
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

        // Verify driver is assigned to at least one of parent's children
        const parentStudents = await storage.getStudentsByParent(senderId);
        const hasAssignedDriver = parentStudents.some((student: any) => student.driverId === recipientId);
        
        if (!hasAssignedDriver) {
          return res.status(403).json({ message: "You can only message drivers assigned to your children" });
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

  // ============ Driver Messaging routes ============

  // Get conversations (parents who have messaged this driver)
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

  // Get messages between driver and specific parent
  app.get(
    "/api/driver/messages/:parentId",
    isAuthenticated,
    requireRole("driver"),
    async (req: any, res) => {
      try {
        const driverId = req.user.claims.sub;
        const parentId = req.params.parentId;
        const messages = await storage.getMessagesBetweenUsers(driverId, parentId);
        
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

        // Verify this is a response-only conversation (parent must have messaged driver first)
        const existingMessages = await storage.getMessagesBetweenUsers(senderId, recipientId);
        const parentInitiated = existingMessages.some((msg: any) => msg.senderId === recipientId);
        
        if (!parentInitiated) {
          return res.status(403).json({ message: "You can only respond to messages from parents. Parents must initiate conversations." });
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

  // ============ Admin Messaging routes ============

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
