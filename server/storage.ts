// Reference: PostgreSQL database blueprint and Replit Auth blueprint
import {
  users,
  vehicles,
  routes,
  stops,
  students,
  driverAssignments,
  timeEntries,
  messages,
  incidents,
  vehicleInspections,
  type User,
  type UpsertUser,
  type Vehicle,
  type InsertVehicle,
  type Route,
  type InsertRoute,
  type Stop,
  type InsertStop,
  type Student,
  type InsertStudent,
  type DriverAssignment,
  type InsertDriverAssignment,
  type TimeEntry,
  type InsertTimeEntry,
  type Message,
  type InsertMessage,
  type Incident,
  type InsertIncident,
  type VehicleInspection,
  type InsertVehicleInspection,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, or, sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "./errors";

export interface IStorage {
  // User operations (Required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(userId: string, newRole: "admin" | "driver" | "parent"): Promise<User>;

  // Vehicle operations
  getAllVehicles(): Promise<Vehicle[]>;
  getVehicle(id: string): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicleLocation(id: string, lat: string, lng: string): Promise<void>;

  // Route operations
  getAllRoutes(): Promise<Route[]>;
  getRoute(id: string): Promise<Route | undefined>;
  createRoute(route: InsertRoute): Promise<Route>;
  getRouteStops(routeId: string): Promise<Stop[]>;
  createStop(stop: InsertStop): Promise<Stop>;

  // Student operations
  getAllStudents(): Promise<Student[]>;
  getStudentsByParent(parentId: string): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;

  // Driver assignment operations
  getAllDriverAssignments(): Promise<DriverAssignment[]>;
  getDriverAssignmentsByDriver(driverId: string): Promise<DriverAssignment[]>;
  getDriverAssignmentForToday(driverId: string): Promise<DriverAssignment | undefined>;
  createDriverAssignment(assignment: InsertDriverAssignment): Promise<DriverAssignment>;

  // Time entry operations
  getCurrentTimeEntry(driverId: string): Promise<TimeEntry | undefined>;
  createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: string, clockOut: Date): Promise<void>;

  // Message operations
  getMessages(userId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getConversations(userId: string): Promise<User[]>;

  // Incident operations
  getAllIncidents(): Promise<Incident[]>;
  getRecentIncidents(limit: number): Promise<Incident[]>;
  createIncident(incident: InsertIncident): Promise<Incident>;

  // Vehicle inspection operations
  createVehicleInspection(inspection: InsertVehicleInspection): Promise<VehicleInspection>;

  // Statistics
  getStats(): Promise<any>;
  getActiveDrivers(): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // ============ User operations (Required for Replit Auth) ============

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserRole(userId: string, newRole: "admin" | "driver" | "parent"): Promise<User> {
    // Use a transaction with consistent locking order to prevent deadlocks
    return await db.transaction(async (tx) => {
      // ALWAYS lock all admin rows FIRST to ensure consistent lock order across transactions
      // This prevents deadlocks when multiple admins are being demoted concurrently
      const allAdmins = await tx
        .select()
        .from(users)
        .where(eq(users.role, "admin"))
        .for("update");

      // Find the target user in the locked admin set, or fetch it separately if not an admin
      let targetUser = allAdmins.find(u => u.id === userId);
      
      if (!targetUser) {
        // Target is not an admin, fetch and lock it separately
        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .for("update");
        
        if (!user) {
          throw new NotFoundError(`User with id ${userId} not found`);
        }
        targetUser = user;
      }

      // If demoting an admin, validate that at least one other admin will remain
      if (targetUser.role === "admin" && newRole !== "admin") {
        const otherAdminCount = allAdmins.filter(u => u.id !== userId).length;

        if (otherAdminCount < 1) {
          throw new ValidationError(
            "Cannot demote the last administrator. Promote another user to admin first."
          );
        }
      }

      // Perform the update
      const [updatedUser] = await tx
        .update(users)
        .set({ role: newRole, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();

      return updatedUser;
    });
  }

  // ============ Vehicle operations ============

  async getAllVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles).orderBy(desc(vehicles.createdAt));
  }

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle;
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const [newVehicle] = await db.insert(vehicles).values(vehicle).returning();
    return newVehicle;
  }

  async updateVehicleLocation(id: string, lat: string, lng: string): Promise<void> {
    await db
      .update(vehicles)
      .set({
        currentLat: lat,
        currentLng: lng,
        lastLocationUpdate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(vehicles.id, id));
  }

  // ============ Route operations ============

  async getAllRoutes(): Promise<Route[]> {
    return await db.select().from(routes).orderBy(desc(routes.createdAt));
  }

  async getRoute(id: string): Promise<Route | undefined> {
    const [route] = await db.select().from(routes).where(eq(routes.id, id));
    return route;
  }

  async createRoute(route: InsertRoute): Promise<Route> {
    const [newRoute] = await db.insert(routes).values(route).returning();
    return newRoute;
  }

  async getRouteStops(routeId: string): Promise<Stop[]> {
    return await db
      .select()
      .from(stops)
      .where(eq(stops.routeId, routeId))
      .orderBy(stops.stopOrder);
  }

  async createStop(stop: InsertStop): Promise<Stop> {
    const [newStop] = await db.insert(stops).values(stop).returning();
    return newStop;
  }

  // ============ Student operations ============

  async getAllStudents(): Promise<Student[]> {
    return await db.select().from(students).orderBy(desc(students.createdAt));
  }

  async getStudentsByParent(parentId: string): Promise<Student[]> {
    return await db
      .select()
      .from(students)
      .where(eq(students.parentId, parentId))
      .orderBy(desc(students.createdAt));
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const [newStudent] = await db.insert(students).values(student).returning();
    return newStudent;
  }

  // ============ Driver assignment operations ============

  async getAllDriverAssignments(): Promise<DriverAssignment[]> {
    return await db.select().from(driverAssignments).orderBy(driverAssignments.dayOfWeek);
  }

  async getDriverAssignmentsByDriver(driverId: string): Promise<DriverAssignment[]> {
    return await db
      .select()
      .from(driverAssignments)
      .where(eq(driverAssignments.driverId, driverId))
      .orderBy(driverAssignments.dayOfWeek);
  }

  async getDriverAssignmentForToday(driverId: string): Promise<DriverAssignment | undefined> {
    const today = new Date().getDay();
    const [assignment] = await db
      .select()
      .from(driverAssignments)
      .where(
        and(
          eq(driverAssignments.driverId, driverId),
          eq(driverAssignments.dayOfWeek, today),
          eq(driverAssignments.isActive, true)
        )
      );
    return assignment;
  }

  async createDriverAssignment(assignment: InsertDriverAssignment): Promise<DriverAssignment> {
    const [newAssignment] = await db
      .insert(driverAssignments)
      .values(assignment)
      .returning();
    return newAssignment;
  }

  // ============ Time entry operations ============

  async getCurrentTimeEntry(driverId: string): Promise<TimeEntry | undefined> {
    const [entry] = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.driverId, driverId),
          eq(timeEntries.clockOut, null)
        )
      )
      .orderBy(desc(timeEntries.clockIn))
      .limit(1);
    return entry;
  }

  async createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry> {
    const [newEntry] = await db.insert(timeEntries).values(entry).returning();
    return newEntry;
  }

  async updateTimeEntry(id: string, clockOut: Date): Promise<void> {
    await db.update(timeEntries).set({ clockOut }).where(eq(timeEntries.id, id));
  }

  // ============ Message operations ============

  async getMessages(userId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(
        or(eq(messages.senderId, userId), eq(messages.recipientId, userId))
      )
      .orderBy(messages.createdAt);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  async getConversations(userId: string): Promise<User[]> {
    // Get unique users who have messaged with this user
    const messageUsers = await db
      .select({ userId: messages.senderId })
      .from(messages)
      .where(eq(messages.recipientId, userId))
      .union(
        db
          .select({ userId: messages.recipientId })
          .from(messages)
          .where(eq(messages.senderId, userId))
      );

    const userIds = [...new Set(messageUsers.map((m) => m.userId))].filter(
      (id) => id !== userId
    );

    if (userIds.length === 0) return [];

    return await db
      .select()
      .from(users)
      .where(
        or(...userIds.map((id) => eq(users.id, id)))
      );
  }

  // ============ Incident operations ============

  async getAllIncidents(): Promise<Incident[]> {
    return await db.select().from(incidents).orderBy(desc(incidents.createdAt));
  }

  async getRecentIncidents(limit: number): Promise<Incident[]> {
    return await db
      .select()
      .from(incidents)
      .orderBy(desc(incidents.createdAt))
      .limit(limit);
  }

  async createIncident(incident: InsertIncident): Promise<Incident> {
    const [newIncident] = await db.insert(incidents).values(incident).returning();
    return newIncident;
  }

  // ============ Vehicle inspection operations ============

  async createVehicleInspection(
    inspection: InsertVehicleInspection
  ): Promise<VehicleInspection> {
    const [newInspection] = await db
      .insert(vehicleInspections)
      .values(inspection)
      .returning();
    return newInspection;
  }

  // ============ Statistics ============

  async getStats(): Promise<any> {
    const allVehicles = await db.select().from(vehicles);
    const allUsers = await db.select().from(users);
    const allRoutes = await db.select().from(routes);
    const allStudents = await db.select().from(students);

    return {
      activeVehicles: allVehicles.filter((v) => v.status === "active").length,
      activeDrivers: allUsers.filter((u) => u.role === "driver").length,
      totalRoutes: allRoutes.filter((r) => r.isActive).length,
      activeStudents: allStudents.filter((s) => s.assignedRouteId !== null).length,
    };
  }

  async getActiveDrivers(): Promise<any[]> {
    const drivers = await db
      .select()
      .from(users)
      .where(eq(users.role, "driver"));

    const currentTimeEntries = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.clockOut, null));

    const activeDriverIds = new Set(currentTimeEntries.map((e) => e.driverId));

    return drivers
      .filter((d) => activeDriverIds.has(d.id))
      .map((d) => ({
        id: d.id,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
      }));
  }
}

export const storage = new DatabaseStorage();
