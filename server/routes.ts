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

  // ============ Messaging routes (shared between driver and parent) ============

  // Get conversations
  app.get(
    "/api/:role/conversations",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const conversations = await storage.getConversations(userId);
        res.json(conversations);
      } catch (error) {
        console.error("Error fetching conversations:", error);
        res.status(500).json({ message: "Failed to fetch conversations" });
      }
    }
  );

  // Get messages
  app.get("/api/:role/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const messages = await storage.getMessages(userId);
      const messagesWithCurrentUser = messages.map((msg) => ({
        ...msg,
        currentUserId: userId,
      }));
      res.json(messagesWithCurrentUser);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send message
  app.post(
    "/api/:role/send-message",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const senderId = req.user.claims.sub;
        const { content } = req.body;

        // Simplified: Find first user of opposite role to message
        const sender = await storage.getUser(senderId);
        if (!sender) {
          return res.status(404).json({ message: "Sender not found" });
        }

        // Get a recipient (simplified logic)
        let recipientId = "";
        if (sender.role === "driver") {
          // Find a parent
          const students = await storage.getAllStudents();
          if (students.length > 0) {
            recipientId = students[0].parentId;
          }
        } else if (sender.role === "parent") {
          // Find a driver (simplified)
          const vehicles = await storage.getAllVehicles();
          const assignments = await storage.getAllDriverAssignments();
          if (assignments.length > 0) {
            recipientId = assignments[0].driverId;
          }
        }

        if (!recipientId) {
          return res.status(400).json({ message: "No recipient available" });
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
