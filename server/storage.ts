// Reference: PostgreSQL database blueprint and Replit Auth blueprint
import {
  users,
  vehicles,
  routes,
  stops,
  students,
  driverAssignments,
  shifts,
  clockEvents,
  timeEntries,
  messages,
  announcements,
  announcementReads,
  announcementDismissals,
  routeAnnouncements,
  routeAnnouncementReads,
  routeAnnouncementDismissals,
  incidents,
  vehicleInspections,
  households,
  householdMembers,
  type User,
  type UpsertUser,
  type UpdateProfile,
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
  type Shift,
  type InsertShift,
  type UpdateShift,
  type ClockEvent,
  type InsertClockEvent,
  type UpdateClockEvent,
  type TimeEntry,
  type InsertTimeEntry,
  type Message,
  type InsertMessage,
  type Announcement,
  type InsertAnnouncement,
  type AnnouncementRead,
  type InsertAnnouncementRead,
  type RouteAnnouncement,
  type InsertRouteAnnouncement,
  type RouteAnnouncementRead,
  type InsertRouteAnnouncementRead,
  type Incident,
  type InsertIncident,
  type VehicleInspection,
  type InsertVehicleInspection,
  type Household,
  type InsertHousehold,
  type HouseholdMember,
  type InsertHouseholdMember,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, or, sql, gte, lte, ne } from "drizzle-orm";
import { NotFoundError, ValidationError } from "./errors";

export interface IStorage {
  // User operations (Required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(role: "admin" | "driver" | "parent"): Promise<User[]>;
  updateUserRole(userId: string, newRole: "admin" | "driver" | "parent"): Promise<User>;
  updateUserProfile(userId: string, profile: UpdateProfile): Promise<User>;

  // Vehicle operations
  getAllVehicles(): Promise<Vehicle[]>;
  getVehicle(id: string): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicleLocation(id: string, lat: string, lng: string): Promise<void>;

  // Route operations
  getAllRoutes(): Promise<Route[]>;
  getRoute(id: string): Promise<Route | undefined>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: string, updates: Partial<InsertRoute>): Promise<Route>;
  deleteRoute(id: string): Promise<void>;
  getRouteStops(routeId: string): Promise<Stop[]>;
  getAllStops(): Promise<Stop[]>;
  createStop(stop: InsertStop): Promise<Stop>;
  updateStop(id: string, updates: Partial<InsertStop>): Promise<Stop>;
  deleteStop(id: string): Promise<void>;

  // Household operations
  createHousehold(household: InsertHousehold): Promise<Household>;
  findHouseholdByPhone(phone: string): Promise<Household | undefined>;
  linkUserToHousehold(householdMember: InsertHouseholdMember): Promise<HouseholdMember>;
  getUserHousehold(userId: string): Promise<Household | undefined>;

  // Student operations
  getAllStudents(): Promise<Student[]>;
  getStudentsByParent(parentId: string): Promise<Student[]>;
  getStudentsByHousehold(householdId: string): Promise<Student[]>;
  findStudentsByGuardianPhone(phone: string): Promise<Student[]>;
  getStudent(id: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: string, updates: Partial<InsertStudent>): Promise<Student>;
  deleteStudent(id: string): Promise<void>;

  // Driver assignment operations
  getAllDriverAssignments(): Promise<DriverAssignment[]>;
  getDriverAssignmentsByDriver(driverId: string): Promise<DriverAssignment[]>;
  getDriverAssignmentForToday(driverId: string): Promise<DriverAssignment | undefined>;
  createDriverAssignment(assignment: InsertDriverAssignment): Promise<DriverAssignment>;
  updateDriverAssignment(id: string, updates: Partial<InsertDriverAssignment>): Promise<DriverAssignment>;
  deleteDriverAssignment(id: string): Promise<void>;

  // Shift operations
  createShift(shift: InsertShift): Promise<Shift>;
  updateShift(id: string, updates: UpdateShift): Promise<Shift>;
  deleteShift(id: string): Promise<void>;
  getShift(id: string): Promise<Shift | undefined>;
  getShiftsByDate(date: string, driverId?: string): Promise<Shift[]>;
  getShiftsByDateRange(startDate: string, endDate: string): Promise<Shift[]>;
  getShiftsByDriver(driverId: string, startDate?: string, endDate?: string): Promise<Shift[]>;
  getDriverTodayShifts(driverId: string): Promise<Shift[]>;
  checkShiftOverlap(driverId: string, date: string, plannedStart: string, plannedEnd: string, excludeShiftId?: string): Promise<boolean>;

  // Clock event operations
  createClockEvent(event: InsertClockEvent): Promise<ClockEvent>;
  updateClockEvent(id: string, updates: UpdateClockEvent): Promise<ClockEvent>;
  getClockEvent(id: string): Promise<ClockEvent | undefined>;
  getClockEventsByShift(shiftId: string): Promise<ClockEvent[]>;
  getClockEventsByDriver(driverId: string, startDate?: Date, endDate?: Date): Promise<ClockEvent[]>;
  getUnresolvedClockEvents(): Promise<ClockEvent[]>;
  resolveClockEvent(id: string, notes?: string): Promise<ClockEvent>;
  getActiveClockIn(driverId: string): Promise<{clockEvent: ClockEvent, shift: Shift} | null>;
  autoClockoutOrphanedShifts(graceHours?: number): Promise<{processed: number, clockedOut: ClockEvent[]}>;

  // Time entry operations
  getCurrentTimeEntry(driverId: string): Promise<TimeEntry | undefined>;
  createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: string, clockOut: Date): Promise<void>;

  // Message operations
  getMessages(userId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getConversations(userId: string): Promise<User[]>;
  getMessagesBetweenUsers(userId1: string, userId2: string): Promise<Message[]>;
  getAllConversations(): Promise<any[]>;
  markMessagesAsRead(recipientId: string, senderId: string): Promise<void>;
  getUnreadMessageCount(userId: string): Promise<number>;
  getUnreadCountsBySender(userId: string): Promise<{ [senderId: string]: number }>;

  // Announcement operations
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement[]>;
  getAnnouncementsByRole(role: "driver" | "parent"): Promise<Announcement[]>;
  getNonDismissedAnnouncementsByRole(userId: string, role: "driver" | "parent"): Promise<Announcement[]>;
  getDismissedAnnouncementsByRole(userId: string, role: "driver" | "parent"): Promise<Announcement[]>;
  getAllAnnouncements(): Promise<Announcement[]>;
  markAnnouncementAsRead(userId: string, announcementId: string): Promise<void>;
  dismissAnnouncement(userId: string, announcementId: string): Promise<void>;
  getUnreadAnnouncementCount(userId: string, role: "driver" | "parent"): Promise<number>;
  getUnreadAnnouncementIds(userId: string, role: "driver" | "parent"): Promise<string[]>;
  
  // Route announcement operations
  isDriverAssignedToRoute(driverId: string, routeId: string): Promise<boolean>;
  createRouteAnnouncement(announcement: InsertRouteAnnouncement): Promise<RouteAnnouncement>;
  getRouteAnnouncementsForParent(parentId: string): Promise<any[]>;
  getRouteAnnouncementsForDriver(driverId: string): Promise<any[]>;
  markRouteAnnouncementAsRead(userId: string, routeAnnouncementId: string): Promise<void>;
  dismissRouteAnnouncement(userId: string, routeAnnouncementId: string): Promise<void>;
  getUnreadRouteAnnouncementIds(userId: string): Promise<string[]>;

  // Incident operations
  getAllIncidents(): Promise<any[]>;
  getRecentIncidents(limit: number): Promise<Incident[]>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  updateIncidentStatus(id: string, status: "pending" | "reviewed" | "resolved"): Promise<Incident>;

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
    try {
      // Use PostgreSQL's native INSERT ... ON CONFLICT to handle upserts
      // First try to insert, if conflict on id or email, then update
      const [user] = await db
        .insert(users)
        .values({
          ...userData,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.id, // conflict on ID
          set: {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            role: userData.role,
            phoneNumber: userData.phoneNumber,
            address: userData.address,
            updatedAt: new Date(),
          },
        })
        .returning();
      return user;
    } catch (error: any) {
      // If there's still a conflict (e.g., on email), try to find and update by email
      if (error.message?.includes('duplicate') && userData.email) {
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, userData.email))
          .limit(1);
        
        if (existingUser) {
          const [user] = await db
            .update(users)
            .set({
              email: userData.email,
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
              role: userData.role || existingUser.role,
              phoneNumber: userData.phoneNumber,
              address: userData.address,
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingUser.id))
            .returning();
          return user;
        }
      }
      throw error;
    }
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUsersByRole(role: "admin" | "driver" | "parent"): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role)).orderBy(desc(users.createdAt));
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

  async updateUserProfile(userId: string, profile: UpdateProfile): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new NotFoundError(`User with id ${userId} not found`);
    }
    
    return updatedUser;
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

  async updateRoute(id: string, updates: Partial<InsertRoute>): Promise<Route> {
    const [updatedRoute] = await db
      .update(routes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(routes.id, id))
      .returning();
    
    if (!updatedRoute) {
      throw new NotFoundError("Route not found");
    }
    
    return updatedRoute;
  }

  async deleteRoute(id: string): Promise<void> {
    // First check if route exists
    const route = await this.getRoute(id);
    if (!route) {
      throw new NotFoundError("Route not found");
    }
    
    // Delete all stops associated with this route first
    await db.delete(stops).where(eq(stops.routeId, id));
    
    // Delete the route
    await db.delete(routes).where(eq(routes.id, id));
  }

  async getRouteStops(routeId: string): Promise<Stop[]> {
    return await db
      .select()
      .from(stops)
      .where(eq(stops.routeId, routeId))
      .orderBy(stops.stopOrder);
  }

  async getAllStops(): Promise<Stop[]> {
    return await db
      .select()
      .from(stops)
      .orderBy(stops.stopOrder);
  }

  async createStop(stop: InsertStop): Promise<Stop> {
    const [newStop] = await db.insert(stops).values(stop).returning();
    return newStop;
  }

  async updateStop(id: string, updates: Partial<InsertStop>): Promise<Stop> {
    const [updatedStop] = await db
      .update(stops)
      .set(updates)
      .where(eq(stops.id, id))
      .returning();
    
    if (!updatedStop) {
      throw new NotFoundError("Stop not found");
    }
    
    return updatedStop;
  }

  async deleteStop(id: string): Promise<void> {
    const result = await db.delete(stops).where(eq(stops.id, id)).returning();
    
    if (result.length === 0) {
      throw new NotFoundError("Stop not found");
    }
  }

  // ============ Household operations ============

  async createHousehold(household: InsertHousehold): Promise<Household> {
    const [newHousehold] = await db.insert(households).values(household).returning();
    return newHousehold;
  }

  async findHouseholdByPhone(phone: string): Promise<Household | undefined> {
    const [household] = await db
      .select()
      .from(households)
      .where(eq(households.primaryPhone, phone))
      .limit(1);
    return household;
  }

  async linkUserToHousehold(householdMember: InsertHouseholdMember): Promise<HouseholdMember> {
    const [newMember] = await db.insert(householdMembers).values(householdMember).returning();
    return newMember;
  }

  async getUserHousehold(userId: string): Promise<Household | undefined> {
    const result = await db
      .select({
        id: households.id,
        primaryPhone: households.primaryPhone,
        notes: households.notes,
        createdAt: households.createdAt,
      })
      .from(householdMembers)
      .innerJoin(households, eq(householdMembers.householdId, households.id))
      .where(eq(householdMembers.userId, userId))
      .limit(1);
    
    return result[0] ? {
      id: result[0].id,
      primaryPhone: result[0].primaryPhone,
      notes: result[0].notes,
      createdAt: result[0].createdAt,
    } : undefined;
  }

  // ============ Student operations ============

  async getAllStudents(): Promise<Student[]> {
    return await db.select().from(students).orderBy(desc(students.createdAt));
  }

  async getStudentsByParent(parentId: string): Promise<Student[]> {
    // Legacy method - now redirects to household-based lookup
    const household = await this.getUserHousehold(parentId);
    if (!household) {
      return [];
    }
    return this.getStudentsByHousehold(household.id);
  }

  async getStudentsByHousehold(householdId: string): Promise<Student[]> {
    return await db
      .select()
      .from(students)
      .where(eq(students.householdId, householdId))
      .orderBy(desc(students.createdAt));
  }

  async findStudentsByGuardianPhone(phone: string): Promise<Student[]> {
    // Query students where guardianPhones array contains the phone number
    return await db
      .select()
      .from(students)
      .where(sql`${phone} = ANY(${students.guardianPhones})`)
      .orderBy(desc(students.createdAt));
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const [newStudent] = await db.insert(students).values(student).returning();
    return newStudent;
  }

  async getStudent(id: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.id, id));
    return student;
  }

  async updateStudent(id: string, updates: Partial<InsertStudent>): Promise<Student> {
    const [updatedStudent] = await db
      .update(students)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(students.id, id))
      .returning();
    
    if (!updatedStudent) {
      throw new NotFoundError("Student not found");
    }
    
    return updatedStudent;
  }

  async deleteStudent(id: string): Promise<void> {
    await db.delete(students).where(eq(students.id, id));
  }

  // ============ Driver assignment operations ============

  async getAllDriverAssignments(): Promise<DriverAssignment[]> {
    return await db.select().from(driverAssignments).orderBy(driverAssignments.date);
  }

  async getDriverAssignmentsByDriver(driverId: string): Promise<DriverAssignment[]> {
    return await db
      .select()
      .from(driverAssignments)
      .where(eq(driverAssignments.driverId, driverId))
      .orderBy(driverAssignments.date);
  }

  async getDriverAssignmentForToday(driverId: string): Promise<DriverAssignment | undefined> {
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const [assignment] = await db
      .select()
      .from(driverAssignments)
      .where(
        and(
          eq(driverAssignments.driverId, driverId),
          eq(driverAssignments.date, today),
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

  async updateDriverAssignment(id: string, updates: Partial<InsertDriverAssignment>): Promise<DriverAssignment> {
    const [existing] = await db
      .select()
      .from(driverAssignments)
      .where(eq(driverAssignments.id, id));
    
    if (!existing) {
      throw new NotFoundError("Driver assignment not found");
    }

    const [updated] = await db
      .update(driverAssignments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(driverAssignments.id, id))
      .returning();
    
    return updated;
  }

  async deleteDriverAssignment(id: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(driverAssignments)
      .where(eq(driverAssignments.id, id));
    
    if (!existing) {
      throw new NotFoundError("Driver assignment not found");
    }

    await db.delete(driverAssignments).where(eq(driverAssignments.id, id));
  }

  // ============ Shift operations ============

  async createShift(shift: InsertShift): Promise<Shift> {
    // Check for overlapping shifts
    const hasOverlap = await this.checkShiftOverlap(
      shift.driverId,
      shift.date,
      shift.plannedStart,
      shift.plannedEnd
    );
    
    if (hasOverlap) {
      throw new ValidationError("Shift overlaps with another shift for this driver on this date");
    }

    const [newShift] = await db.insert(shifts).values(shift).returning();
    return newShift;
  }

  async updateShift(id: string, updates: UpdateShift): Promise<Shift> {
    const [existing] = await db.select().from(shifts).where(eq(shifts.id, id));
    
    if (!existing) {
      throw new NotFoundError("Shift not found");
    }

    // Check for overlapping shifts if time is being changed
    if (updates.plannedStart || updates.plannedEnd) {
      const plannedStart = updates.plannedStart || existing.plannedStart;
      const plannedEnd = updates.plannedEnd || existing.plannedEnd;
      const date = updates.date || existing.date;
      
      const hasOverlap = await this.checkShiftOverlap(
        existing.driverId,
        date,
        plannedStart,
        plannedEnd,
        id
      );
      
      if (hasOverlap) {
        throw new ValidationError("Updated shift would overlap with another shift");
      }
    }

    const [updated] = await db
      .update(shifts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(shifts.id, id))
      .returning();
    
    return updated;
  }

  async deleteShift(id: string): Promise<void> {
    const [existing] = await db.select().from(shifts).where(eq(shifts.id, id));
    
    if (!existing) {
      throw new NotFoundError("Shift not found");
    }

    await db.delete(shifts).where(eq(shifts.id, id));
  }

  async getShift(id: string): Promise<Shift | undefined> {
    const [shift] = await db.select().from(shifts).where(eq(shifts.id, id));
    return shift;
  }

  async getShiftsByDate(date: string, driverId?: string): Promise<Shift[]> {
    if (driverId) {
      return await db
        .select()
        .from(shifts)
        .where(and(eq(shifts.date, date), eq(shifts.driverId, driverId)))
        .orderBy(shifts.plannedStart);
    }
    
    return await db
      .select()
      .from(shifts)
      .where(eq(shifts.date, date))
      .orderBy(shifts.plannedStart);
  }

  async getShiftsByDateRange(startDate: string, endDate: string): Promise<Shift[]> {
    return await db
      .select()
      .from(shifts)
      .where(and(gte(shifts.date, startDate), lte(shifts.date, endDate)))
      .orderBy(shifts.date, shifts.plannedStart);
  }

  async getShiftsByDriver(driverId: string, startDate?: string, endDate?: string): Promise<Shift[]> {
    if (startDate && endDate) {
      return await db
        .select()
        .from(shifts)
        .where(
          and(
            eq(shifts.driverId, driverId),
            sql`${shifts.date} >= ${startDate}`,
            sql`${shifts.date} <= ${endDate}`
          )
        )
        .orderBy(shifts.date, shifts.plannedStart);
    }
    
    return await db
      .select()
      .from(shifts)
      .where(eq(shifts.driverId, driverId))
      .orderBy(shifts.date, shifts.plannedStart);
  }

  async getDriverTodayShifts(driverId: string): Promise<Shift[]> {
    const today = new Date().toISOString().split('T')[0];
    return await this.getShiftsByDate(today, driverId);
  }

  async checkShiftOverlap(
    driverId: string,
    date: string,
    plannedStart: string,
    plannedEnd: string,
    excludeShiftId?: string
  ): Promise<boolean> {
    let query = db
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.driverId, driverId),
          eq(shifts.date, date),
          or(
            // New shift starts during existing shift
            and(
              sql`${plannedStart} >= ${shifts.plannedStart}`,
              sql`${plannedStart} < ${shifts.plannedEnd}`
            ),
            // New shift ends during existing shift
            and(
              sql`${plannedEnd} > ${shifts.plannedStart}`,
              sql`${plannedEnd} <= ${shifts.plannedEnd}`
            ),
            // New shift completely contains existing shift
            and(
              sql`${plannedStart} <= ${shifts.plannedStart}`,
              sql`${plannedEnd} >= ${shifts.plannedEnd}`
            )
          )
        )
      );

    if (excludeShiftId) {
      query = query.where(sql`${shifts.id} != ${excludeShiftId}`);
    }

    const overlapping = await query;
    return overlapping.length > 0;
  }

  // ============ Clock event operations ============

  async createClockEvent(event: InsertClockEvent): Promise<ClockEvent> {
    const [newEvent] = await db.insert(clockEvents).values(event).returning();
    return newEvent;
  }

  async updateClockEvent(id: string, updates: UpdateClockEvent): Promise<ClockEvent> {
    const [updated] = await db
      .update(clockEvents)
      .set(updates)
      .where(eq(clockEvents.id, id))
      .returning();
    return updated;
  }

  async getClockEvent(id: string): Promise<ClockEvent | undefined> {
    const [event] = await db
      .select()
      .from(clockEvents)
      .where(eq(clockEvents.id, id))
      .limit(1);
    return event;
  }

  async getClockEventsByShift(shiftId: string): Promise<ClockEvent[]> {
    return await db
      .select()
      .from(clockEvents)
      .where(eq(clockEvents.shiftId, shiftId))
      .orderBy(clockEvents.timestamp);
  }

  async getClockEventsByDriver(driverId: string, startDate?: Date, endDate?: Date): Promise<ClockEvent[]> {
    // If driverId is empty string, fetch all events (for admin dashboard)
    if (!driverId || driverId === "") {
      if (startDate && endDate) {
        return await db
          .select()
          .from(clockEvents)
          .where(
            and(
              sql`${clockEvents.timestamp} >= ${startDate}`,
              sql`${clockEvents.timestamp} <= ${endDate}`
            )
          )
          .orderBy(desc(clockEvents.timestamp));
      }
      
      return await db
        .select()
        .from(clockEvents)
        .orderBy(desc(clockEvents.timestamp));
    }
    
    // Filter by specific driver
    if (startDate && endDate) {
      return await db
        .select()
        .from(clockEvents)
        .where(
          and(
            eq(clockEvents.driverId, driverId),
            sql`${clockEvents.timestamp} >= ${startDate}`,
            sql`${clockEvents.timestamp} <= ${endDate}`
          )
        )
        .orderBy(clockEvents.timestamp);
    }
    
    return await db
      .select()
      .from(clockEvents)
      .where(eq(clockEvents.driverId, driverId))
      .orderBy(desc(clockEvents.timestamp));
  }

  async getUnresolvedClockEvents(): Promise<ClockEvent[]> {
    return await db
      .select()
      .from(clockEvents)
      .where(eq(clockEvents.isResolved, false))
      .orderBy(desc(clockEvents.timestamp));
  }

  async resolveClockEvent(id: string, notes?: string): Promise<ClockEvent> {
    const [updated] = await db
      .update(clockEvents)
      .set({ isResolved: true, notes })
      .where(eq(clockEvents.id, id))
      .returning();
    
    if (!updated) {
      throw new NotFoundError("Clock event not found");
    }
    
    return updated;
  }

  async getActiveClockIn(driverId: string): Promise<{clockEvent: ClockEvent, shift: Shift} | null> {
    // Find the most recent IN event without a matching OUT
    const recentEvents = await db
      .select()
      .from(clockEvents)
      .where(eq(clockEvents.driverId, driverId))
      .orderBy(desc(clockEvents.timestamp))
      .limit(10);

    // Find the latest IN without a subsequent OUT
    let activeIn: ClockEvent | null = null;
    for (const event of recentEvents) {
      if (event.type === "IN") {
        activeIn = event;
        break;
      } else if (event.type === "OUT") {
        // Found an OUT, so no active IN
        return null;
      }
    }

    if (!activeIn) {
      return null;
    }

    // Get the associated shift if any
    if (activeIn.shiftId) {
      const shift = await this.getShift(activeIn.shiftId);
      if (shift) {
        return { clockEvent: activeIn, shift };
      }
    }

    // Return with a minimal shift object if no shift is linked
    return { clockEvent: activeIn, shift: null as any };
  }

  async autoClockoutOrphanedShifts(graceHours: number = 2): Promise<{processed: number, clockedOut: ClockEvent[]}> {
    // Get all shifts from the past week that might have orphaned clock-ins
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];
    
    const allShifts = await db
      .select()
      .from(shifts)
      .where(sql`${shifts.date} >= ${oneWeekAgoStr}`)
      .orderBy(shifts.date, shifts.plannedStart);

    const clockedOutEvents: ClockEvent[] = [];
    const now = new Date();

    for (const shift of allShifts) {
      // Get all clock events for this shift
      const events = await this.getClockEventsByShift(shift.id);
      
      if (events.length === 0) continue;

      // Check if the last event is an IN (orphaned)
      const lastEvent = events[events.length - 1];
      if (lastEvent.type !== "IN") continue;

      // Calculate shift end time + grace period
      const shiftEndDateTime = new Date(`${shift.date}T${shift.plannedEnd}`);
      const graceEndTime = new Date(shiftEndDateTime.getTime() + graceHours * 60 * 60 * 1000);

      // Only auto-clockout if grace period has passed
      if (now < graceEndTime) continue;

      // Create automatic clock-out event at the planned end time
      const autoClockOut: InsertClockEvent = {
        driverId: shift.driverId,
        shiftId: shift.id,
        type: "OUT",
        timestamp: shiftEndDateTime,
        source: "AUTO",
        notes: `Auto-clocked out after ${graceHours}h grace period. Original clock-in: ${new Date(lastEvent.timestamp).toLocaleString()}`,
      };

      const clockOutEvent = await this.createClockEvent(autoClockOut);
      clockedOutEvents.push(clockOutEvent);

      // Update shift status to COMPLETED if it's still ACTIVE
      if (shift.status === "ACTIVE") {
        await this.updateShift(shift.id, { status: "COMPLETED" });
      }
    }

    return {
      processed: clockedOutEvents.length,
      clockedOut: clockedOutEvents,
    };
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

  async getMessagesBetweenUsers(userId1: string, userId2: string): Promise<Message[]> {
    // Simple approach: Get messages directly between the two users only
    // Admin interventions are shown separately in the admin view
    return await db
      .select()
      .from(messages)
      .where(
        or(
          and(eq(messages.senderId, userId1), eq(messages.recipientId, userId2)),
          and(eq(messages.senderId, userId2), eq(messages.recipientId, userId1))
        )
      )
      .orderBy(messages.createdAt);
  }

  async getAllConversations(): Promise<any[]> {
    // Get all messages and group by unique sender-recipient pairs
    const allMessages = await db
      .select({
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .orderBy(desc(messages.createdAt));

    // Create unique conversation keys
    const conversationMap = new Map<string, any>();

    for (const msg of allMessages) {
      // Create a consistent key for the conversation
      const key = [msg.senderId, msg.recipientId].sort().join("_");
      
      if (!conversationMap.has(key)) {
        const [user1, user2] = await Promise.all([
          this.getUser(msg.senderId),
          this.getUser(msg.recipientId),
        ]);

        const isUser1Driver = user1?.role === "driver";
        const driver = isUser1Driver ? user1 : user2;
        const parent = isUser1Driver ? user2 : user1;

        conversationMap.set(key, {
          conversationKey: key,
          driverName: driver ? `${driver.firstName || ""} ${driver.lastName || ""}`.trim() || driver.email : "Unknown",
          parentName: parent ? `${parent.firstName || ""} ${parent.lastName || ""}`.trim() || parent.email : "Unknown",
          lastMessagePreview: msg.content.substring(0, 50) + (msg.content.length > 50 ? "..." : ""),
          lastMessageAt: msg.createdAt,
          messageCount: 0,
        });
      }

      // Increment message count
      const conv = conversationMap.get(key);
      if (conv) {
        conv.messageCount += 1;
      }
    }

    return Array.from(conversationMap.values());
  }

  async markMessagesAsRead(recipientId: string, senderId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.recipientId, recipientId),
          eq(messages.senderId, senderId),
          eq(messages.isRead, false)
        )
      );
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, userId),
          eq(messages.isRead, false)
        )
      );
    return Number(result[0]?.count || 0);
  }

  async getUnreadCountsBySender(userId: string): Promise<{ [senderId: string]: number }> {
    const results = await db
      .select({
        senderId: messages.senderId,
        count: sql<number>`count(*)`,
      })
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, userId),
          eq(messages.isRead, false)
        )
      )
      .groupBy(messages.senderId);

    const counts: { [senderId: string]: number } = {};
    for (const result of results) {
      counts[result.senderId] = Number(result.count);
    }
    return counts;
  }

  async getAdminMessageSummaries(adminId: string): Promise<any[]> {
    // Use a SQL query to efficiently get message summaries for all conversations
    // This aggregates data in a single query instead of iterating through users
    const summaries = await db
      .select({
        otherUserId: sql<string>`
          CASE 
            WHEN ${messages.senderId} = ${adminId} THEN ${messages.recipientId}
            ELSE ${messages.senderId}
          END
        `,
        lastMessageTime: sql<Date>`MAX(${messages.createdAt})`,
        messageCount: sql<number>`COUNT(*)`,
      })
      .from(messages)
      .where(
        or(
          eq(messages.senderId, adminId),
          eq(messages.recipientId, adminId)
        )
      )
      .groupBy(sql`
        CASE 
          WHEN ${messages.senderId} = ${adminId} THEN ${messages.recipientId}
          ELSE ${messages.senderId}
        END
      `);

    // Now fetch user details for each conversation
    const result = [];
    for (const summary of summaries) {
      const user = await this.getUser(summary.otherUserId);
      if (user && user.id !== adminId) {
        result.push({
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          lastMessageTime: summary.lastMessageTime,
          messageCount: Number(summary.messageCount),
        });
      }
    }

    return result;
  }

  // Get parents whose children are on routes this driver is assigned to
  async getMessageableParentsForDriver(driverId: string): Promise<any[]> {
    // Get driver's active routes from driver assignments
    const driverRoutes = await db
      .select({ routeId: driverAssignments.routeId })
      .from(driverAssignments)
      .where(
        and(
          eq(driverAssignments.driverId, driverId),
          eq(driverAssignments.isActive, true)
        )
      );

    const routeIds = driverRoutes.map(r => r.routeId);
    if (routeIds.length === 0) return [];

    // Get students on these routes
    const studentsOnRoutes = await db
      .select()
      .from(students)
      .where(
        or(...routeIds.map(routeId => eq(students.assignedRouteId, routeId)))
      );

    // Get unique household IDs
    const householdIdsSet = new Set(studentsOnRoutes.map(s => s.householdId).filter(Boolean));
    const householdIds = Array.from(householdIdsSet);
    if (householdIds.length === 0) return [];

    // Get household members who are parents
    const parentMembers = await db
      .select()
      .from(householdMembers)
      .where(
        or(...householdIds.map(hId => eq(householdMembers.householdId, hId!)))
      );

    const parentUserIdsSet = new Set(parentMembers.map(pm => pm.userId));
    const parentUserIds = Array.from(parentUserIdsSet);
    if (parentUserIds.length === 0) return [];

    // Get parent user details
    const parents = await db
      .select()
      .from(users)
      .where(
        and(
          or(...parentUserIds.map(pId => eq(users.id, pId))),
          eq(users.role, "parent")
        )
      );

    // Build result with child context
    const result = [];
    for (const parent of parents) {
      // Get parent's household memberships
      const parentHouseholds = parentMembers
        .filter(pm => pm.userId === parent.id)
        .map(pm => pm.householdId);

      // Get children on driver's routes
      const children = studentsOnRoutes.filter(s => 
        parentHouseholds.includes(s.householdId!)
      );

      if (children.length > 0) {
        // Get route names
        const childRoutes = await Promise.all(
          children.map(async (child) => {
            if (!child.assignedRouteId) return null;
            const [route] = await db
              .select()
              .from(routes)
              .where(eq(routes.id, child.assignedRouteId));
            return route;
          })
        );

        result.push({
          id: parent.id,
          firstName: parent.firstName,
          lastName: parent.lastName,
          email: parent.email,
          children: children.map((child, idx) => ({
            id: child.id,
            firstName: child.firstName,
            lastName: child.lastName,
            routeName: childRoutes[idx]?.name || "Unknown Route",
          })),
        });
      }
    }

    return result;
  }

  // Get drivers currently assigned to a parent's children's routes
  async getActiveDriversForParent(parentId: string): Promise<any[]> {
    // Get parent's household memberships
    const parentHouseholds = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.userId, parentId));

    const householdIds = parentHouseholds.map(h => h.householdId);
    if (householdIds.length === 0) return [];

    // Get children in parent's households
    const children = await db
      .select()
      .from(students)
      .where(
        or(...householdIds.map(hId => eq(students.householdId, hId)))
      );

    // Get unique route IDs for children
    const routeIdsSet = new Set(children.map(c => c.assignedRouteId).filter(Boolean));
    const routeIds = Array.from(routeIdsSet);
    if (routeIds.length === 0) return [];

    // Get active driver assignments for these routes
    const activeAssignments = await db
      .select()
      .from(driverAssignments)
      .where(
        and(
          or(...routeIds.map(routeId => eq(driverAssignments.routeId, routeId!))),
          eq(driverAssignments.isActive, true)
        )
      );

    // Get unique driver IDs
    const driverIdsSet = new Set(activeAssignments.map(a => a.driverId));
    const driverIds = Array.from(driverIdsSet);
    if (driverIds.length === 0) return [];

    // Get driver details
    const drivers = await db
      .select()
      .from(users)
      .where(
        or(...driverIds.map(dId => eq(users.id, dId)))
      );

    // Build result with route and child context
    const result = [];
    for (const driver of drivers) {
      // Get driver's route assignments
      const driverRoutes = activeAssignments
        .filter(a => a.driverId === driver.id)
        .map(a => a.routeId);

      // Get children on driver's routes
      const childrenOnDriverRoutes = children.filter(c => 
        c.assignedRouteId && driverRoutes.includes(c.assignedRouteId)
      );

      if (childrenOnDriverRoutes.length > 0) {
        // Get route names
        const uniqueRouteIdsSet = new Set(childrenOnDriverRoutes.map(c => c.assignedRouteId));
        const uniqueRouteIds = Array.from(uniqueRouteIdsSet);
        const routesData: Array<typeof routes.$inferSelect | null> = await Promise.all(
          uniqueRouteIds.map(async (routeId) => {
            if (!routeId) return null;
            const [route] = await db
              .select()
              .from(routes)
              .where(eq(routes.id, routeId));
            return route;
          })
        );

        result.push({
          id: driver.id,
          firstName: driver.firstName,
          lastName: driver.lastName,
          email: driver.email,
          children: childrenOnDriverRoutes.map((child) => ({
            id: child.id,
            firstName: child.firstName,
            lastName: child.lastName,
            routeId: child.assignedRouteId,
            routeName: routesData.find((r) => r?.id === child.assignedRouteId)?.name || "Unknown Route",
          })),
        });
      }
    }

    return result;
  }

  // ============ Incident operations ============

  async getAllIncidents(): Promise<any[]> {
    const result = await db
      .select({
        id: incidents.id,
        reporterId: incidents.reporterId,
        vehicleId: incidents.vehicleId,
        routeId: incidents.routeId,
        title: incidents.title,
        description: incidents.description,
        severity: incidents.severity,
        status: incidents.status,
        location: incidents.location,
        photoUrl: incidents.photoUrl,
        createdAt: incidents.createdAt,
        updatedAt: incidents.updatedAt,
        reporterFirstName: users.firstName,
        reporterLastName: users.lastName,
        reporterEmail: users.email,
      })
      .from(incidents)
      .leftJoin(users, eq(incidents.reporterId, users.id))
      .orderBy(desc(incidents.createdAt));
    return result;
  }

  async getRecentIncidents(limit: number): Promise<Incident[]> {
    return await db
      .select()
      .from(incidents)
      .where(ne(incidents.status, "resolved"))
      .orderBy(desc(incidents.createdAt))
      .limit(limit);
  }

  async createIncident(incident: InsertIncident): Promise<Incident> {
    const [newIncident] = await db.insert(incidents).values(incident).returning();
    return newIncident;
  }

  async updateIncidentStatus(id: string, status: "pending" | "reviewed" | "resolved"): Promise<Incident> {
    const [updatedIncident] = await db
      .update(incidents)
      .set({ status, updatedAt: new Date() })
      .where(eq(incidents.id, id))
      .returning();
    return updatedIncident;
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

  // ============ Announcement operations ============

  async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const [newAnnouncement] = await db
      .insert(announcements)
      .values(announcement)
      .returning();
    return newAnnouncement;
  }

  async getAnnouncementsByRole(role: "driver" | "parent"): Promise<Announcement[]> {
    return await db
      .select()
      .from(announcements)
      .where(eq(announcements.targetRole, role))
      .orderBy(desc(announcements.createdAt));
  }

  async getNonDismissedAnnouncementsByRole(userId: string, role: "driver" | "parent"): Promise<Announcement[]> {
    // Get all announcements for this role
    const allAnnouncements = await this.getAnnouncementsByRole(role);
    
    // Get dismissed announcement IDs for this user
    const dismissedRecords = await db
      .select({ announcementId: announcementDismissals.announcementId })
      .from(announcementDismissals)
      .where(eq(announcementDismissals.userId, userId));
    
    const dismissedIds = new Set(dismissedRecords.map(r => r.announcementId));
    
    // Filter out dismissed announcements
    return allAnnouncements.filter(a => !dismissedIds.has(a.id));
  }

  async getDismissedAnnouncementsByRole(userId: string, role: "driver" | "parent"): Promise<Announcement[]> {
    // Get all announcements for this role
    const allAnnouncements = await this.getAnnouncementsByRole(role);
    
    // Get dismissed announcement IDs for this user
    const dismissedRecords = await db
      .select({ announcementId: announcementDismissals.announcementId })
      .from(announcementDismissals)
      .where(eq(announcementDismissals.userId, userId));
    
    const dismissedIds = new Set(dismissedRecords.map(r => r.announcementId));
    
    // Return only dismissed announcements
    return allAnnouncements.filter(a => dismissedIds.has(a.id));
  }

  async getAllAnnouncements(): Promise<Announcement[]> {
    return await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.createdAt));
  }

  async markAnnouncementAsRead(userId: string, announcementId: string): Promise<void> {
    // Check if already marked as read
    const existing = await db
      .select()
      .from(announcementReads)
      .where(
        and(
          eq(announcementReads.userId, userId),
          eq(announcementReads.announcementId, announcementId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(announcementReads).values({
        userId,
        announcementId,
      });
    }
  }

  async getUnreadAnnouncementCount(userId: string, role: "driver" | "parent"): Promise<number> {
    // Get all announcements for this role
    const allAnnouncements = await db
      .select({ id: announcements.id })
      .from(announcements)
      .where(eq(announcements.targetRole, role));

    const announcementIds = allAnnouncements.map(a => a.id);
    if (announcementIds.length === 0) return 0;

    // Get announcements this user has read
    const readAnnouncements = await db
      .select({ announcementId: announcementReads.announcementId })
      .from(announcementReads)
      .where(
        and(
          eq(announcementReads.userId, userId),
          or(...announcementIds.map(id => eq(announcementReads.announcementId, id)))
        )
      );

    const readIds = new Set(readAnnouncements.map(r => r.announcementId));
    return announcementIds.filter(id => !readIds.has(id)).length;
  }

  async dismissAnnouncement(userId: string, announcementId: string): Promise<void> {
    // Check if already dismissed
    const existing = await db
      .select()
      .from(announcementDismissals)
      .where(
        and(
          eq(announcementDismissals.userId, userId),
          eq(announcementDismissals.announcementId, announcementId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(announcementDismissals).values({
        userId,
        announcementId,
      });
    }
  }

  async getUnreadAnnouncementIds(userId: string, role: "driver" | "parent"): Promise<string[]> {
    // Get all announcements for this role
    const allAnnouncements = await db
      .select({ id: announcements.id })
      .from(announcements)
      .where(eq(announcements.targetRole, role));

    const announcementIds = allAnnouncements.map(a => a.id);
    if (announcementIds.length === 0) return [];

    // Get announcements this user has dismissed
    const dismissedAnnouncements = await db
      .select({ announcementId: announcementDismissals.announcementId })
      .from(announcementDismissals)
      .where(eq(announcementDismissals.userId, userId));

    const dismissedIds = dismissedAnnouncements.map(d => d.announcementId);
    
    // Filter out dismissed announcements
    const nonDismissedIds = announcementIds.filter(id => !dismissedIds.includes(id));
    if (nonDismissedIds.length === 0) return nonDismissedIds;

    // Get announcements this user has read
    const readAnnouncements = await db
      .select({ announcementId: announcementReads.announcementId })
      .from(announcementReads)
      .where(
        and(
          eq(announcementReads.userId, userId),
          or(...nonDismissedIds.map(id => eq(announcementReads.announcementId, id)))
        )
      );

    const readIds = new Set(readAnnouncements.map(r => r.announcementId));
    return nonDismissedIds.filter(id => !readIds.has(id));
  }

  // Route Announcement Methods
  async isDriverAssignedToRoute(driverId: string, routeId: string): Promise<boolean> {
    // Check if driver has any shifts on this route
    const result = await db
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.driverId, driverId),
          eq(shifts.routeId, routeId)
        )
      )
      .limit(1);

    return result.length > 0;
  }

  async createRouteAnnouncement(announcement: InsertRouteAnnouncement): Promise<RouteAnnouncement> {
    const [newAnnouncement] = await db
      .insert(routeAnnouncements)
      .values(announcement)
      .returning();
    return newAnnouncement;
  }

  async getRouteAnnouncementsForParent(parentId: string): Promise<any[]> {
    // Get all households this parent belongs to
    const parentHouseholds = await db
      .select({ householdId: householdMembers.householdId })
      .from(householdMembers)
      .where(eq(householdMembers.userId, parentId));

    if (parentHouseholds.length === 0) return [];

    // Get all students in these households
    const householdIds = parentHouseholds.map(h => h.householdId);
    const studentsInHouseholds = await db
      .select({ assignedRouteId: students.assignedRouteId })
      .from(students)
      .where(
        or(...householdIds.map(hid => eq(students.householdId, hid)))
      );

    const uniqueRouteIds = Array.from(new Set(studentsInHouseholds.map(s => s.assignedRouteId).filter(id => id !== null)));
    if (uniqueRouteIds.length === 0) return [];

    // Get all route announcements for these routes
    const announcements = await db
      .select()
      .from(routeAnnouncements)
      .where(
        or(...uniqueRouteIds.map(routeId => eq(routeAnnouncements.routeId, routeId!)))
      )
      .orderBy(desc(routeAnnouncements.createdAt));

    // Add driver and route details
    const announcementsWithDetails = await Promise.all(
      announcements.map(async (announcement) => {
        const driver = await this.getUser(announcement.driverId);
        const route = await this.getRoute(announcement.routeId);
        
        // Check if dismissed
        const dismissal = await db
          .select()
          .from(routeAnnouncementDismissals)
          .where(
            and(
              eq(routeAnnouncementDismissals.userId, parentId),
              eq(routeAnnouncementDismissals.routeAnnouncementId, announcement.id)
            )
          )
          .limit(1);

        // Skip if dismissed
        if (dismissal.length > 0) return null;

        return {
          ...announcement,
          driverName: driver ? `${driver.firstName} ${driver.lastName}` : "Unknown Driver",
          routeName: route?.name || "Unknown Route",
        };
      })
    );

    return announcementsWithDetails.filter(a => a !== null);
  }

  async getRouteAnnouncementsForDriver(driverId: string): Promise<any[]> {
    const announcements = await db
      .select()
      .from(routeAnnouncements)
      .where(eq(routeAnnouncements.driverId, driverId))
      .orderBy(desc(routeAnnouncements.createdAt));

    // Add route details
    const announcementsWithDetails = await Promise.all(
      announcements.map(async (announcement) => {
        const route = await this.getRoute(announcement.routeId);
        return {
          ...announcement,
          routeName: route?.name || "Unknown Route",
        };
      })
    );

    return announcementsWithDetails;
  }

  async markRouteAnnouncementAsRead(userId: string, routeAnnouncementId: string): Promise<void> {
    // Check if already marked as read
    const existing = await db
      .select()
      .from(routeAnnouncementReads)
      .where(
        and(
          eq(routeAnnouncementReads.userId, userId),
          eq(routeAnnouncementReads.routeAnnouncementId, routeAnnouncementId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(routeAnnouncementReads).values({
        userId,
        routeAnnouncementId,
      });
    }
  }

  async dismissRouteAnnouncement(userId: string, routeAnnouncementId: string): Promise<void> {
    // Check if already dismissed
    const existing = await db
      .select()
      .from(routeAnnouncementDismissals)
      .where(
        and(
          eq(routeAnnouncementDismissals.userId, userId),
          eq(routeAnnouncementDismissals.routeAnnouncementId, routeAnnouncementId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(routeAnnouncementDismissals).values({
        userId,
        routeAnnouncementId,
      });
    }
  }

  async getUnreadRouteAnnouncementIds(userId: string): Promise<string[]> {
    // Get all route announcements visible to this parent
    const allAnnouncements = await this.getRouteAnnouncementsForParent(userId);
    const announcementIds = allAnnouncements.map(a => a!.id);
    
    if (announcementIds.length === 0) return [];

    // Get announcements this user has read
    const readAnnouncements = await db
      .select({ routeAnnouncementId: routeAnnouncementReads.routeAnnouncementId })
      .from(routeAnnouncementReads)
      .where(
        and(
          eq(routeAnnouncementReads.userId, userId),
          or(...announcementIds.map(id => eq(routeAnnouncementReads.routeAnnouncementId, id)))
        )
      );

    const readIds = new Set(readAnnouncements.map(r => r.routeAnnouncementId));
    return announcementIds.filter(id => !readIds.has(id));
  }
}

export const storage = new DatabaseStorage();
