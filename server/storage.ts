// Reference: PostgreSQL database blueprint and Replit Auth blueprint
import {
  users,
  vehicles,
  routes,
  stops,
  routeStops,
  students,
  driverAssignments,
  shifts,
  clockEvents,
  adminSettings,
  timeEntries,
  messages,
  driverNotifications,
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
  studentAttendance,
  auditLogs,
  routeProgress,
  suppliesRequests,
  vehicleChecklists,
  driverFeedback,
  geofences,
  geofenceEvents,
  deviceTokens,
  type User,
  type UpsertUser,
  type UpdateProfile,
  type Vehicle,
  type InsertVehicle,
  type Route,
  type InsertRoute,
  type Stop,
  type InsertStop,
  type RouteStopWithMetadata,
  type ShiftRouteContext,
  type RouteStop,
  type InsertRouteStop,
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
  type AdminSetting,
  type InsertAdminSetting,
  type TimeEntry,
  type InsertTimeEntry,
  type Message,
  type InsertMessage,
  type DriverNotification,
  type InsertDriverNotification,
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
  type StudentAttendance,
  type InsertStudentAttendance,
  type UpdateStudentAttendance,
  type AuditLog,
  type InsertAuditLog,
  type RouteProgress,
  type InsertRouteProgress,
  type UpdateRouteProgress,
  type SuppliesRequest,
  type InsertSuppliesRequest,
  type VehicleChecklist,
  type InsertVehicleChecklist,
  type DriverFeedback,
  type InsertDriverFeedback,
  type DeviceToken,
  type InsertDeviceToken,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, or, sql, gte, lte, ne, lt } from "drizzle-orm";
import { NotFoundError, ValidationError } from "./errors";

export interface IStorage {
  // User operations (Required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(role: "admin" | "driver" | "parent"): Promise<User[]>;
  updateUserRole(userId: string, newRole: "admin" | "driver" | "parent"): Promise<User>;
  updateUserProfile(userId: string, profile: UpdateProfile): Promise<User>;

  // Device token operations (for push notifications)
  upsertDeviceToken(token: Omit<InsertDeviceToken, "userId"> & { userId: string }): Promise<DeviceToken>;
  deleteDeviceToken(userId: string, token: string): Promise<void>;
  getDeviceTokensByUser(userId: string): Promise<DeviceToken[]>;

  // Vehicle operations
  getAllVehicles(): Promise<Vehicle[]>;
  getVehicle(id: string): Promise<Vehicle | undefined>;
  getVehicleByPlate(plateNumber: string): Promise<Vehicle | undefined>;
  getVehicleBySamsaraId(samsaraId: string): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, updates: Partial<InsertVehicle>): Promise<Vehicle>;
  updateVehicleLocation(id: string, lat: string, lng: string): Promise<void>;
  deleteVehicle(id: string): Promise<void>;

  // Route operations
  getAllRoutes(): Promise<Route[]>;
  getRoute(id: string): Promise<Route | undefined>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: string, updates: Partial<InsertRoute>): Promise<Route>;
  deleteRoute(id: string): Promise<void>;
  getRouteStops(routeId: string): Promise<RouteStopWithMetadata[]>;
  getAllStops(): Promise<Stop[]>;
  getStop(id: string): Promise<Stop | undefined>;
  createStop(stop: InsertStop): Promise<Stop>;
  updateStop(id: string, updates: Partial<InsertStop>): Promise<Stop>;
  deleteStop(id: string): Promise<void>;

  // Household operations
  createHousehold(household: InsertHousehold): Promise<Household>;
  findHouseholdByPhone(phone: string): Promise<Household | undefined>;
  findHouseholdByAnyGuardianPhone(phone: string): Promise<Household | undefined>;
  linkUserToHousehold(householdMember: InsertHouseholdMember): Promise<HouseholdMember>;
  unlinkUserFromHousehold(userId: string): Promise<void>;
  getUserHousehold(userId: string): Promise<Household | undefined>;
  relinkParentHouseholds(userId: string, phoneNumber: string): Promise<void>;

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
  getDriverAssignment(id: string): Promise<DriverAssignment | undefined>;
  getDriverAssignmentsByDriver(driverId: string): Promise<DriverAssignment[]>;
  getDriverAssignmentsByRoute(routeId: string): Promise<DriverAssignment[]>;
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
  getActiveBreak(driverId: string): Promise<ClockEvent | null>;
  startBreak(driverId: string, shiftId: string | null, notes?: string): Promise<ClockEvent>;
  endBreak(driverId: string, notes?: string): Promise<ClockEvent>;
  detectTimecardAnomalies(): Promise<any[]>;
  
  // Admin settings operations
  getAdminSetting(key: string): Promise<AdminSetting | undefined>;
  setAdminSetting(key: string, value: string, description?: string, updatedBy?: string): Promise<AdminSetting>;
  getAllAdminSettings(): Promise<AdminSetting[]>;

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

  // Driver notification operations
  createDriverNotification(notification: InsertDriverNotification): Promise<DriverNotification>;
  getDriverNotifications(driverId: string): Promise<any[]>;
  dismissDriverNotification(notificationId: string, driverId: string): Promise<void>;
  getUnreadDriverNotificationCount(driverId: string): Promise<number>;

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

  // Student attendance operations
  getStudentAttendance(studentId: string, date: string): Promise<StudentAttendance | undefined>;
  setStudentAttendance(attendance: InsertStudentAttendance): Promise<StudentAttendance>;
  updateStudentAttendance(id: string, updates: UpdateStudentAttendance): Promise<StudentAttendance>;
  getAttendanceForDate(date: string): Promise<any[]>;
  getStudentsByRouteForDate(routeId: string, date: string): Promise<any[]>;
  getAttendanceOverview(date: string): Promise<{ pending: number; riding: number; absent: number; total: number }>;
  getStudentAbsenceReport(studentId: string, startDate: string, endDate: string): Promise<any[]>;
  getAttendanceAnalytics(startDate: string, endDate: string): Promise<any[]>;
  getMonthlyAttendanceStats(year: number, month: number): Promise<any>;

  // Statistics
  getStats(): Promise<any>;
  getActiveDrivers(): Promise<any[]>;

  // Audit log operations
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
  getAllAuditLogs(): Promise<any[]>;
  getAuditLogsByUser(userId: string): Promise<any[]>;
  getAuditLogsByRole(role: "driver" | "parent"): Promise<any[]>;

  // Route progress operations
  initializeRouteProgress(shiftId: string): Promise<void>;
  getRouteProgress(shiftId: string): Promise<any[]>;
  updateStopStatus(
    shiftId: string,
    routeStopId: string,
    status: "PENDING" | "COMPLETED" | "SKIPPED",
    notes?: string
  ): Promise<RouteProgress>;
  getCurrentStopForShift(shiftId: string): Promise<any | null>;
  getStopProgressForStudent(studentId: string, date: string): Promise<any | null>;

  // Supplies requests operations
  createSuppliesRequest(request: InsertSuppliesRequest): Promise<SuppliesRequest>;
  getSuppliesRequestsByDriver(driverId: string): Promise<SuppliesRequest[]>;
  getAllSuppliesRequests(): Promise<SuppliesRequest[]>;
  updateSuppliesRequestStatus(
    id: string,
    status: "PENDING" | "APPROVED" | "ORDERED" | "DELIVERED" | "REJECTED",
    adminNotes?: string,
    approvedBy?: string
  ): Promise<SuppliesRequest>;

  // Vehicle checklists operations
  createVehicleChecklist(checklist: InsertVehicleChecklist): Promise<VehicleChecklist>;
  getVehicleChecklistsByDriver(driverId: string): Promise<VehicleChecklist[]>;
  getVehicleChecklistsByVehicle(vehicleId: string): Promise<VehicleChecklist[]>;
  getAllVehicleChecklists(): Promise<VehicleChecklist[]>;
  getTodayVehicleChecklist(driverId: string, vehicleId: string, type: "PRE_TRIP" | "POST_TRIP"): Promise<VehicleChecklist | undefined>;

  // Driver feedback operations
  createDriverFeedback(feedback: InsertDriverFeedback): Promise<DriverFeedback>;
  getDriverFeedbackByDriver(driverId: string): Promise<DriverFeedback[]>;
  getAllDriverFeedback(): Promise<DriverFeedback[]>;
  updateDriverFeedbackStatus(
    id: string,
    status: "NEW" | "REVIEWING" | "PLANNED" | "COMPLETED" | "DISMISSED",
    adminResponse?: string,
    respondedBy?: string
  ): Promise<DriverFeedback>;

  // Geofence operations
  getAllGeofences(): Promise<any[]>;
  getGeofence(id: string): Promise<any | undefined>;
  createGeofence(geofence: any): Promise<any>;
  updateGeofence(id: string, updates: any): Promise<any>;
  deleteGeofence(id: string): Promise<void>;
  getGeofenceEvents(limit?: number): Promise<any[]>;

  // Data retention operations
  cleanupOldMessages(retentionDays: number): Promise<number>;
  cleanupOldGeofenceEvents(retentionDays: number): Promise<number>;
  cleanupOldAuditLogs(retentionDays: number): Promise<number>;
  cleanupOldDismissedAnnouncements(retentionDays: number): Promise<number>;
  cleanupInactiveDeviceTokens(retentionDays: number): Promise<number>;
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
    
    // Audit log for driver/parent profile updates
    if (updatedUser.role === "driver" || updatedUser.role === "parent") {
      await this.createAuditLog({
        userId: updatedUser.id,
        userRole: updatedUser.role,
        action: "updated",
        entityType: "profile",
        entityId: updatedUser.id,
        description: `Updated profile information`,
        changes: profile,
      });
    }
    
    return updatedUser;
  }

  // ============ Device token operations ============

  async upsertDeviceToken(token: Omit<InsertDeviceToken, "userId"> & { userId: string }): Promise<DeviceToken> {
    const [deviceToken] = await db
      .insert(deviceTokens)
      .values(token)
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: {
          userId: token.userId,
          platform: token.platform,
          isActive: true,
          failureCount: 0,
          lastFailureAt: null,
          deactivatedAt: null,
          deviceModel: token.deviceModel,
          osVersion: token.osVersion,
          appVersion: token.appVersion,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    
    return deviceToken;
  }

  async deleteDeviceToken(userId: string, token: string): Promise<void> {
    await db
      .delete(deviceTokens)
      .where(and(
        eq(deviceTokens.userId, userId),
        eq(deviceTokens.token, token)
      ));
  }

  async getDeviceTokensByUser(userId: string): Promise<DeviceToken[]> {
    return await db
      .select()
      .from(deviceTokens)
      .where(eq(deviceTokens.userId, userId));
  }

  // ============ Vehicle operations ============

  async getAllVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles).orderBy(desc(vehicles.createdAt));
  }

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle;
  }

  async getVehicleByPlate(plateNumber: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.plateNumber, plateNumber));
    return vehicle;
  }

  async getVehicleBySamsaraId(samsaraId: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.samsaraVehicleId, samsaraId));
    return vehicle;
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const [newVehicle] = await db.insert(vehicles).values(vehicle).returning();
    return newVehicle;
  }

  async updateVehicle(id: string, updates: Partial<InsertVehicle>): Promise<Vehicle> {
    const [updatedVehicle] = await db
      .update(vehicles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(vehicles.id, id))
      .returning();
    
    if (!updatedVehicle) {
      throw new NotFoundError("Vehicle not found");
    }
    
    return updatedVehicle;
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

  async deleteVehicle(id: string): Promise<void> {
    // Check if vehicle is assigned to any active driver assignments
    const assignments = await db
      .select()
      .from(driverAssignments)
      .where(eq(driverAssignments.vehicleId, id));
    
    if (assignments.length > 0) {
      throw new ValidationError("Cannot delete vehicle that is assigned to drivers. Please remove all driver assignments first.");
    }

    // Check if vehicle is used in any active shifts
    const activeShifts = await db
      .select()
      .from(shifts)
      .where(and(
        eq(shifts.vehicleId, id),
        eq(shifts.status, "ACTIVE")
      ));
    
    if (activeShifts.length > 0) {
      throw new ValidationError("Cannot delete vehicle with active shifts. Please complete or cancel the shifts first.");
    }

    const result = await db.delete(vehicles).where(eq(vehicles.id, id));
    
    if (result.rowCount === 0) {
      throw new NotFoundError("Vehicle not found");
    }
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
    
    // Delete the route (route_stops will cascade delete automatically)
    await db.delete(routes).where(eq(routes.id, id));
  }

  async getRouteStops(routeId: string): Promise<RouteStopWithMetadata[]> {
    // Get route stops with stop details
    const result = await db
      .select({
        routeStop: routeStops,
        stop: stops,
      })
      .from(routeStops)
      .leftJoin(stops, eq(routeStops.stopId, stops.id))
      .where(eq(routeStops.routeId, routeId))
      .orderBy(routeStops.stopOrder);
    
    return result.map(r => ({
      ...r.stop!,
      stopOrder: r.routeStop.stopOrder,
      scheduledTime: r.routeStop.scheduledTime,
      routeStopId: r.routeStop.id,
    })) as RouteStopWithMetadata[];
  }

  async getAllStops(): Promise<(Stop & { 
    geofence: { 
      id: string; 
      name: string; 
      radiusMeters: number; 
      isActive: boolean;
    } | null 
  })[]> {
    // Join geofence details to show auto-managed geofence metadata
    const result = await db
      .select({
        stop: stops,
        geofence: geofences,
      })
      .from(stops)
      .leftJoin(geofences, eq(stops.geofenceId, geofences.id))
      .orderBy(stops.name);
    
    return result.map(r => ({
      ...r.stop,
      geofence: r.geofence ? {
        id: r.geofence.id,
        name: r.geofence.name,
        radiusMeters: r.geofence.radiusMeters,
        isActive: r.geofence.isActive,
      } : null,
    }));
  }

  async getStop(id: string): Promise<Stop | undefined> {
    const [stop] = await db.select().from(stops).where(eq(stops.id, id));
    return stop;
  }

  /**
   * Helper: Provision or update a STOP geofence for a stop location
   * @param stopData - Stop data with name and coordinates
   * @param tx - Transaction client
   * @param existingGeofenceId - Existing geofence ID if updating
   * @returns Created or updated geofence
   */
  private async provisionStopGeofence(
    stopData: { name: string; latitude?: string | null; longitude?: string | null },
    tx: any,
    existingGeofenceId?: string | null
  ): Promise<any> {
    if (!stopData.latitude || !stopData.longitude) {
      // No coordinates - delete existing geofence if present
      if (existingGeofenceId) {
        await tx.delete(geofences).where(eq(geofences.id, existingGeofenceId));
      }
      return null;
    }

    const geofenceData = {
      name: `Stop · ${stopData.name}`,
      type: "STOP" as const,
      centerLat: stopData.latitude,
      centerLng: stopData.longitude,
      radiusMeters: 100, // 100m radius for stop geofences
      scheduleStartTime: null, // Always active
      scheduleEndTime: null, // Always active
      isActive: true,
    };

    if (existingGeofenceId) {
      // Update existing geofence
      const [updated] = await tx
        .update(geofences)
        .set(geofenceData)
        .where(eq(geofences.id, existingGeofenceId))
        .returning();
      return updated;
    } else {
      // Create new geofence
      const [created] = await tx.insert(geofences).values(geofenceData).returning();
      return created;
    }
  }

  async createStop(stop: InsertStop): Promise<Stop> {
    return await db.transaction(async (tx) => {
      // Create stop
      const [newStop] = await tx.insert(stops).values(stop).returning();

      // Provision geofence if coordinates provided
      if (newStop.latitude && newStop.longitude) {
        const geofence = await this.provisionStopGeofence(newStop, tx);
        
        if (geofence) {
          // Update stop with geofenceId
          const [stopWithGeofence] = await tx
            .update(stops)
            .set({ geofenceId: geofence.id })
            .where(eq(stops.id, newStop.id))
            .returning();
          
          return stopWithGeofence;
        }
      }

      return newStop;
    });
  }

  async updateStop(id: string, updates: Partial<InsertStop>): Promise<Stop> {
    return await db.transaction(async (tx) => {
      // Get existing stop
      const [existingStop] = await tx
        .select()
        .from(stops)
        .where(eq(stops.id, id));
      
      if (!existingStop) {
        throw new NotFoundError("Stop not found");
      }

      // Merge updates with existing data for geofence provisioning
      const mergedData = {
        name: updates.name ?? existingStop.name,
        latitude: updates.latitude ?? existingStop.latitude,
        longitude: updates.longitude ?? existingStop.longitude,
      };

      // Check if coordinates or name changed
      const coordsChanged = 
        updates.latitude !== undefined || 
        updates.longitude !== undefined;
      const nameChanged = updates.name !== undefined;

      // Update stop
      const [updatedStop] = await tx
        .update(stops)
        .set(updates)
        .where(eq(stops.id, id))
        .returning();

      // Sync geofence if coordinates or name changed
      if (coordsChanged || nameChanged) {
        const geofence = await this.provisionStopGeofence(
          mergedData,
          tx,
          existingStop.geofenceId
        );

        // Update geofenceId if changed
        if (geofence && geofence.id !== existingStop.geofenceId) {
          const [stopWithGeofence] = await tx
            .update(stops)
            .set({ geofenceId: geofence.id })
            .where(eq(stops.id, id))
            .returning();
          return stopWithGeofence;
        } else if (!geofence && existingStop.geofenceId) {
          // Coords removed - clear geofenceId
          const [stopWithoutGeofence] = await tx
            .update(stops)
            .set({ geofenceId: null })
            .where(eq(stops.id, id))
            .returning();
          return stopWithoutGeofence;
        }
      }

      return updatedStop;
    });
  }

  async deleteStop(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Get stop to find linked geofence
      const [stop] = await tx
        .select()
        .from(stops)
        .where(eq(stops.id, id));
      
      if (!stop) {
        throw new NotFoundError("Stop not found");
      }

      // Delete linked geofence first
      if (stop.geofenceId) {
        await tx.delete(geofences).where(eq(geofences.id, stop.geofenceId));
      }

      // Delete stop
      await tx.delete(stops).where(eq(stops.id, id));
    });
  }

  // ============ Route Stops (Junction) operations ============

  async createRouteStop(routeStop: InsertRouteStop): Promise<RouteStop> {
    const [newRouteStop] = await db.insert(routeStops).values(routeStop).returning();
    return newRouteStop;
  }

  async updateRouteStop(id: string, updates: Partial<InsertRouteStop>): Promise<RouteStop> {
    const [updatedRouteStop] = await db
      .update(routeStops)
      .set(updates)
      .where(eq(routeStops.id, id))
      .returning();
    
    if (!updatedRouteStop) {
      throw new NotFoundError("Route stop not found");
    }
    
    return updatedRouteStop;
  }

  async deleteRouteStop(id: string): Promise<void> {
    const result = await db.delete(routeStops).where(eq(routeStops.id, id)).returning();
    
    if (result.length === 0) {
      throw new NotFoundError("Route stop not found");
    }
  }

  async deleteAllRouteStops(routeId: string): Promise<void> {
    await db.delete(routeStops).where(eq(routeStops.routeId, routeId));
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

  async findHouseholdByAnyGuardianPhone(phone: string): Promise<Household | undefined> {
    // Find any student that has this phone in their guardianPhones array
    const studentsWithPhone = await db
      .select()
      .from(students)
      .where(sql`${phone} = ANY(${students.guardianPhones})`)
      .limit(1);
    
    if (studentsWithPhone.length === 0 || !studentsWithPhone[0].householdId) {
      return undefined;
    }
    
    // Return the household
    const [household] = await db
      .select()
      .from(households)
      .where(eq(households.id, studentsWithPhone[0].householdId))
      .limit(1);
    
    return household;
  }

  async linkUserToHousehold(householdMember: InsertHouseholdMember): Promise<HouseholdMember> {
    // Check if already linked to avoid duplicates
    const existing = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.userId, householdMember.userId),
          eq(householdMembers.householdId, householdMember.householdId)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [newMember] = await db.insert(householdMembers).values(householdMember).returning();
    return newMember;
  }

  async unlinkUserFromHousehold(userId: string): Promise<void> {
    await db.delete(householdMembers).where(eq(householdMembers.userId, userId));
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

  async relinkParentHouseholds(userId: string, phoneNumber: string): Promise<void> {
    // Remove all existing household links for this user
    await this.unlinkUserFromHousehold(userId);
    
    // Find all households that have students with this guardian phone
    const studentsWithPhone = await db
      .select()
      .from(students)
      .where(sql`${phoneNumber} = ANY(${students.guardianPhones})`);
    
    // Get unique household IDs
    const uniqueHouseholdIds = new Set<string>();
    for (const student of studentsWithPhone) {
      if (student.householdId) {
        uniqueHouseholdIds.add(student.householdId);
      }
    }
    const householdIds = Array.from(uniqueHouseholdIds);
    
    // Link user to all matching households
    for (const householdId of householdIds) {
      await this.linkUserToHousehold({
        userId,
        householdId,
        roleInHousehold: "SECONDARY",
      });
    }
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
    return await db.select().from(driverAssignments).orderBy(driverAssignments.createdAt);
  }

  async getDriverAssignment(id: string): Promise<DriverAssignment | undefined> {
    const [assignment] = await db
      .select()
      .from(driverAssignments)
      .where(eq(driverAssignments.id, id))
      .limit(1);
    return assignment;
  }

  async getDriverAssignmentsByDriver(driverId: string): Promise<DriverAssignment[]> {
    return await db
      .select()
      .from(driverAssignments)
      .where(eq(driverAssignments.driverId, driverId))
      .orderBy(driverAssignments.createdAt);
  }

  async getDriverAssignmentsByRoute(routeId: string): Promise<DriverAssignment[]> {
    return await db
      .select()
      .from(driverAssignments)
      .where(eq(driverAssignments.routeId, routeId))
      .orderBy(driverAssignments.createdAt);
  }

  async getDriverAssignmentForToday(driverId: string): Promise<DriverAssignment | undefined> {
    // With the new schema, driver assignments are general - they don't have specific dates
    // Return the first assignment for the driver
    const [assignment] = await db
      .select()
      .from(driverAssignments)
      .where(eq(driverAssignments.driverId, driverId))
      .limit(1);
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
    
    // CASCADE UPDATE: Update all future shifts that reference this assignment
    // Use SQL CURRENT_DATE for timezone-safe comparison
    const shiftUpdates: any = { updatedAt: new Date() };
    
    // Map assignment updates to shift updates
    if (updates.driverId !== undefined) shiftUpdates.driverId = updates.driverId;
    if (updates.routeId !== undefined) shiftUpdates.routeId = updates.routeId;
    if (updates.vehicleId !== undefined) shiftUpdates.vehicleId = updates.vehicleId;
    if (updates.startTime !== undefined) shiftUpdates.plannedStart = updates.startTime;
    if (updates.endTime !== undefined) shiftUpdates.plannedEnd = updates.endTime;
    
    // Only update if there are actual changes to propagate
    if (Object.keys(shiftUpdates).length > 1) {
      try {
        await db
          .update(shifts)
          .set(shiftUpdates)
          .where(
            and(
              eq(shifts.driverAssignmentId, id),
              sql`${shifts.date}::date >= CURRENT_DATE`
            )
          );
      } catch (error) {
        // Log cascade update errors but don't fail the whole operation
        // The assignment update succeeded, so we return it
        console.error(`Failed to cascade update to shifts for assignment ${id}:`, error);
      }
    }
    
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

    // Check for overlapping shifts if time, date, or driver is being changed
    if (updates.plannedStart || updates.plannedEnd || updates.date || updates.driverId) {
      const plannedStart = updates.plannedStart || existing.plannedStart;
      const plannedEnd = updates.plannedEnd || existing.plannedEnd;
      const date = updates.date || existing.date;
      const driverId = updates.driverId || existing.driverId;
      
      const hasOverlap = await this.checkShiftOverlap(
        driverId,
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

  async getShiftRouteContext(shiftId: string): Promise<ShiftRouteContext> {
    // Get shift
    const shift = await this.getShift(shiftId);
    if (!shift) {
      throw new NotFoundError("Shift not found");
    }

    // Get route, vehicle
    const route = shift.routeId ? await this.getRoute(shift.routeId) : null;
    const vehicle = shift.vehicleId ? await this.getVehicle(shift.vehicleId) : null;

    if (!route) {
      throw new NotFoundError("Shift has no route assigned");
    }

    // Get ordered route stops
    const routeStopsData = await this.getRouteStops(route.id);

    // Get all students for this route
    const allStudents = await this.getStudentsByRouteForDate(route.id, shift.date);

    // Get route progress for all stops
    const progressRecords = await db
      .select()
      .from(routeProgress)
      .where(eq(routeProgress.shiftId, shiftId));

    const progressMap = new Map(progressRecords.map(p => [p.routeStopId, p]));

    // Filter students by stop based on route type (morning = pickup, afternoon = dropoff)
    const isPickup = shift.shiftType === "MORNING";
    
    // Enrich each stop with students and progress
    const enrichedStops = await Promise.all(
      routeStopsData.map(async (stop, index) => {
        // Get students for this stop
        const stopStudents = allStudents.filter(s => {
          const stopId = isPickup ? s.pickupStopId : s.dropoffStopId;
          return stopId === stop.id;
        });

        // Get progress for this stop
        const progress = progressMap.get(stop.routeStopId);
        const status = progress?.status || "PENDING";

        // Calculate stops away (number of pending stops before this one)
        const stopsAway = routeStopsData.slice(0, index).filter((_, i) => {
          const prog = progressMap.get(routeStopsData[i].routeStopId);
          return !prog || prog.status === "PENDING";
        }).length;

        return {
          ...stop,
          students: stopStudents.map(s => ({
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
            attendance: s.attendance,
          })),
          progress: {
            status,
            completedAt: progress?.completedAt || null,
            notes: progress?.notes || null,
          },
          stopsAway,
          scheduledTime: stop.scheduledTime,
        };
      })
    );

    // Calculate overall progress
    const completedStops = enrichedStops.filter(s => s.progress.status === "COMPLETED").length;
    const totalStops = enrichedStops.length;
    const activeStop = enrichedStops.find(s => s.progress.status === "PENDING");

    // Inspection status
    const inspectionComplete = !!shift.inspectionCompletedAt;

    return {
      shift: {
        id: shift.id,
        date: shift.date,
        shiftType: shift.shiftType,
        plannedStart: shift.plannedStart,
        plannedEnd: shift.plannedEnd,
        status: shift.status,
        inspectionCompletedAt: shift.inspectionCompletedAt,
        inspectionComplete,
      },
      route: {
        id: route.id,
        name: route.name,
        description: route.description,
      },
      vehicle: vehicle ? {
        id: vehicle.id,
        name: vehicle.name,
        plateNumber: vehicle.plateNumber,
      } : null,
      stops: enrichedStops,
      progress: {
        completedStops,
        totalStops,
        activeStopId: activeStop?.routeStopId || null,
      },
    };
  }

  async checkShiftOverlap(
    driverId: string,
    date: string,
    plannedStart: string,
    plannedEnd: string,
    excludeShiftId?: string
  ): Promise<boolean> {
    const conditions = [
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
    ];

    if (excludeShiftId) {
      conditions.push(sql`${shifts.id} != ${excludeShiftId}`);
    }

    const overlapping = await db
      .select()
      .from(shifts)
      .where(and(...conditions));

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
      
      // Validate the date is valid before proceeding
      if (isNaN(shiftEndDateTime.getTime())) {
        console.warn(`Invalid shift end time for shift ${shift.id}: ${shift.date}T${shift.plannedEnd}`);
        continue;
      }
      
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

  async getActiveBreak(driverId: string): Promise<ClockEvent | null> {
    // Find the most recent BREAK_START event without a matching BREAK_END
    const recentEvents = await db
      .select()
      .from(clockEvents)
      .where(eq(clockEvents.driverId, driverId))
      .orderBy(desc(clockEvents.timestamp))
      .limit(10);

    // Find the latest BREAK_START without a subsequent BREAK_END
    for (const event of recentEvents) {
      if (event.type === "BREAK_START") {
        return event;
      } else if (event.type === "BREAK_END" || event.type === "OUT") {
        // Found a BREAK_END or OUT, so no active break
        return null;
      }
    }

    return null;
  }

  async startBreak(driverId: string, shiftId: string | null, notes?: string): Promise<ClockEvent> {
    const breakStart: InsertClockEvent = {
      driverId,
      shiftId,
      type: "BREAK_START",
      source: "USER",
      notes: notes || null,
    };

    return await this.createClockEvent(breakStart);
  }

  async endBreak(driverId: string, notes?: string): Promise<ClockEvent> {
    const activeBreak = await this.getActiveBreak(driverId);
    if (!activeBreak) {
      throw new Error("No active break found");
    }

    const breakEnd: InsertClockEvent = {
      driverId,
      shiftId: activeBreak.shiftId,
      type: "BREAK_END",
      source: "USER",
      notes: notes || null,
    };

    return await this.createClockEvent(breakEnd);
  }

  async detectTimecardAnomalies(): Promise<any[]> {
    const anomalies: any[] = [];
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get all drivers
    const drivers = await db
      .select()
      .from(users)
      .where(eq(users.role, "driver"));

    for (const driver of drivers) {
      // Check for active clock-ins without clock-outs (missed clock-outs)
      const activeClockIn = await this.getActiveClockIn(driver.id);
      if (activeClockIn && activeClockIn.clockEvent) {
        // Only report if not already resolved
        if (activeClockIn.clockEvent.isResolved === false) {
          const clockInTime = new Date(activeClockIn.clockEvent.timestamp);
          // If clock-in is more than 12 hours old, it's an anomaly
          if (now.getTime() - clockInTime.getTime() > 12 * 60 * 60 * 1000) {
            anomalies.push({
              type: "MISSED_CLOCKOUT",
              driverId: driver.id,
              driverName: `${driver.firstName} ${driver.lastName}`,
              clockEventId: activeClockIn.clockEvent.id,
              clockEvent: activeClockIn.clockEvent,
              shift: activeClockIn.shift,
              message: `Driver has been clocked in for ${Math.floor((now.getTime() - clockInTime.getTime()) / (60 * 60 * 1000))} hours without clocking out`,
            });
          }
        }
      }

      // Check for orphaned breaks (BREAK_START without BREAK_END)
      const activeBreak = await this.getActiveBreak(driver.id);
      if (activeBreak && activeBreak.isResolved === false) {
        const breakStartTime = new Date(activeBreak.timestamp);
        if (now.getTime() - breakStartTime.getTime() > 4 * 60 * 60 * 1000) {
          anomalies.push({
            type: "ORPHANED_BREAK",
            driverId: driver.id,
            driverName: `${driver.firstName} ${driver.lastName}`,
            clockEventId: activeBreak.id,
            clockEvent: activeBreak,
            message: `Driver has been on break for ${Math.floor((now.getTime() - breakStartTime.getTime()) / (60 * 60 * 1000))} hours`,
          });
        }
      }

      // Check for multiple clock-ins in the past day (potential double clock-ins)
      const recentEvents = await db
        .select()
        .from(clockEvents)
        .where(
          and(
            eq(clockEvents.driverId, driver.id),
            sql`${clockEvents.timestamp} >= ${oneDayAgo.toISOString()}`
          )
        )
        .orderBy(clockEvents.timestamp);

      let consecutiveIns = 0;
      for (const event of recentEvents) {
        if (event.type === "IN") {
          consecutiveIns++;
          if (consecutiveIns > 1 && event.isResolved === false) {
            anomalies.push({
              type: "DOUBLE_CLOCKIN",
              driverId: driver.id,
              driverName: `${driver.firstName} ${driver.lastName}`,
              clockEventId: event.id,
              clockEvent: event,
              message: `Multiple consecutive clock-ins detected`,
            });
            consecutiveIns = 0; // Reset after reporting
          }
        } else if (event.type === "OUT") {
          consecutiveIns = 0;
        }
      }
    }

    return anomalies;
  }

  // ============ Admin Settings operations ============

  async getAdminSetting(key: string): Promise<AdminSetting | undefined> {
    const [setting] = await db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.settingKey, key))
      .limit(1);
    return setting;
  }

  async setAdminSetting(
    key: string,
    value: string,
    description?: string,
    updatedBy?: string
  ): Promise<AdminSetting> {
    const existingSetting = await this.getAdminSetting(key);

    if (existingSetting) {
      const [updated] = await db
        .update(adminSettings)
        .set({
          settingValue: value,
          description: description || existingSetting.description,
          updatedBy: updatedBy || existingSetting.updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(adminSettings.settingKey, key))
        .returning();
      return updated;
    } else {
      const newSetting: InsertAdminSetting = {
        settingKey: key,
        settingValue: value,
        description: description || null,
        updatedBy: updatedBy || null,
      };
      const [created] = await db.insert(adminSettings).values(newSetting).returning();
      return created;
    }
  }

  async getAllAdminSettings(): Promise<AdminSetting[]> {
    return await db.select().from(adminSettings).orderBy(adminSettings.settingKey);
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
          driverId: driver?.id || "",
          parentId: parent?.id || "",
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

  // ============ Driver Notification operations ============

  async createDriverNotification(notification: InsertDriverNotification): Promise<DriverNotification> {
    const [newNotification] = await db.insert(driverNotifications).values(notification).returning();
    return newNotification;
  }

  async getDriverNotifications(driverId: string): Promise<any[]> {
    const notifications = await db
      .select()
      .from(driverNotifications)
      .where(eq(driverNotifications.driverId, driverId))
      .orderBy(desc(driverNotifications.createdAt));

    // Enrich with parent and admin details
    const enriched = await Promise.all(
      notifications.map(async (notification) => {
        const parent = await this.getUser(notification.parentId);
        const message = await db
          .select()
          .from(messages)
          .where(eq(messages.id, notification.messageId))
          .limit(1);
        
        const admin = message[0]?.senderId ? await this.getUser(message[0].senderId) : null;

        return {
          ...notification,
          parentName: parent ? `${parent.firstName} ${parent.lastName}` : "Unknown",
          adminName: admin ? `${admin.firstName} ${admin.lastName}` : "Admin",
          createdAt: notification.createdAt,
        };
      })
    );

    return enriched;
  }

  async dismissDriverNotification(notificationId: string, driverId: string): Promise<void> {
    // Verify ownership before dismissing
    const [updated] = await db
      .update(driverNotifications)
      .set({ isDismissed: true })
      .where(
        and(
          eq(driverNotifications.id, notificationId),
          eq(driverNotifications.driverId, driverId)
        )
      )
      .returning();
    
    if (!updated) {
      throw new NotFoundError("Notification not found or access denied");
    }
  }

  async getUnreadDriverNotificationCount(driverId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(driverNotifications)
      .where(
        and(
          eq(driverNotifications.driverId, driverId),
          eq(driverNotifications.isDismissed, false)
        )
      );
    return Number(result[0]?.count || 0);
  }

  async getAdminMessageSummaries(adminId: string): Promise<any[]> {
    // Get all unique user IDs that have conversations with this admin
    const sentTo = await db
      .selectDistinct({ userId: messages.recipientId })
      .from(messages)
      .where(eq(messages.senderId, adminId));
    
    const receivedFrom = await db
      .selectDistinct({ userId: messages.senderId })
      .from(messages)
      .where(eq(messages.recipientId, adminId));

    // Combine and deduplicate user IDs
    const allUserIds = new Set<string>();
    sentTo.forEach(({ userId }) => allUserIds.add(userId));
    receivedFrom.forEach(({ userId }) => allUserIds.add(userId));

    // Build summaries for each user
    const result = [];
    for (const userId of allUserIds) {
      const msgs = await this.getMessagesBetweenUsers(adminId, userId);
      if (msgs.length > 0) {
        const user = await this.getUser(userId);
        if (user) {
          const lastMsg = msgs[msgs.length - 1];
          result.push({
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            lastMessageTime: lastMsg.createdAt,
            messageCount: msgs.length,
          });
        }
      }
    }

    return result;
  }

  // Get parents whose children are on routes this driver is assigned to
  async getMessageableParentsForDriver(driverId: string): Promise<any[]> {
    // Get driver's routes from driver assignments
    const driverRoutes = await db
      .select({ routeId: driverAssignments.routeId })
      .from(driverAssignments)
      .where(eq(driverAssignments.driverId, driverId));

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

    // Get driver assignments for these routes
    const activeAssignments = await db
      .select()
      .from(driverAssignments)
      .where(or(...routeIds.map(routeId => eq(driverAssignments.routeId, routeId!))));

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
    
    // Audit log for incident reporting (drivers only)
    const reporter = await this.getUser(incident.reporterId);
    if (reporter && reporter.role === "driver") {
      await this.createAuditLog({
        userId: reporter.id,
        userRole: reporter.role,
        action: "created",
        entityType: "incident",
        entityId: newIncident.id,
        description: `Reported incident: ${newIncident.title}`,
        changes: {
          severity: newIncident.severity,
          location: newIncident.location,
        },
      });
    }
    
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

  // ============ Student Attendance Operations ============

  async getStudentAttendance(studentId: string, date: string): Promise<StudentAttendance | undefined> {
    const [attendance] = await db
      .select()
      .from(studentAttendance)
      .where(
        and(
          eq(studentAttendance.studentId, studentId),
          eq(studentAttendance.date, date)
        )
      )
      .limit(1);
    return attendance;
  }

  async setStudentAttendance(attendance: InsertStudentAttendance): Promise<StudentAttendance> {
    // Check if attendance already exists for this student and date
    const existing = await this.getStudentAttendance(attendance.studentId, attendance.date);
    
    let result: StudentAttendance;
    if (existing) {
      // Update existing attendance
      const [updated] = await db
        .update(studentAttendance)
        .set({
          status: attendance.status,
          markedByUserId: attendance.markedByUserId,
          notes: attendance.notes,
          updatedAt: new Date(),
        })
        .where(eq(studentAttendance.id, existing.id))
        .returning();
      result = updated;
    } else {
      // Create new attendance record
      const [newAttendance] = await db
        .insert(studentAttendance)
        .values(attendance)
        .returning();
      result = newAttendance;
    }
    
    // Audit log for attendance marking (driver/parent only)
    if (attendance.markedByUserId) {
      const markedBy = await this.getUser(attendance.markedByUserId);
      if (markedBy && (markedBy.role === "driver" || markedBy.role === "parent")) {
        const student = await this.getStudent(attendance.studentId);
        await this.createAuditLog({
          userId: markedBy.id,
          userRole: markedBy.role,
          action: "created",
          entityType: "attendance",
          entityId: result.id,
          description: `Marked ${student?.firstName} ${student?.lastName} as ${attendance.status} for ${attendance.date}`,
          changes: {
            status: attendance.status,
            date: attendance.date,
          },
        });
      }
    }
    
    return result;
  }

  async updateStudentAttendance(id: string, updates: UpdateStudentAttendance): Promise<StudentAttendance> {
    const [updated] = await db
      .update(studentAttendance)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(studentAttendance.id, id))
      .returning();
    return updated;
  }

  async getAttendanceForDate(date: string): Promise<any[]> {
    const records = await db
      .select({
        attendance: studentAttendance,
        student: students,
        markedByUser: users,
      })
      .from(studentAttendance)
      .leftJoin(students, eq(studentAttendance.studentId, students.id))
      .leftJoin(users, eq(studentAttendance.markedByUserId, users.id))
      .where(eq(studentAttendance.date, date))
      .orderBy(students.lastName, students.firstName);
    
    return records.map((r) => ({
      ...r.attendance,
      student: r.student,
      markedBy: r.markedByUser ? {
        id: r.markedByUser.id,
        firstName: r.markedByUser.firstName,
        lastName: r.markedByUser.lastName,
        role: r.markedByUser.role,
      } : null,
    }));
  }

  async getStudentsByRouteForDate(routeId: string, date: string): Promise<any[]> {
    // Get all students assigned to this route
    const routeStudents = await db
      .select()
      .from(students)
      .where(eq(students.assignedRouteId, routeId))
      .orderBy(students.lastName, students.firstName);
    
    // Get attendance records for these students on this date
    const studentIds = routeStudents.map(s => s.id);
    let attendanceRecords: StudentAttendance[] = [];
    
    if (studentIds.length > 0) {
      attendanceRecords = await db
        .select()
        .from(studentAttendance)
        .where(
          and(
            eq(studentAttendance.date, date),
            or(...studentIds.map(id => eq(studentAttendance.studentId, id)))
          )
        );
    }
    
    const attendanceMap = new Map(attendanceRecords.map(a => [a.studentId, a]));
    
    return routeStudents.map(student => ({
      ...student,
      attendance: attendanceMap.get(student.id) || null,
    }));
  }

  async getAttendanceOverview(date: string): Promise<{ pending: number; riding: number; absent: number; total: number }> {
    // Get all active students
    const allStudents = await db.select().from(students);
    const total = allStudents.length;

    // Get attendance records for this date
    const records = await db
      .select()
      .from(studentAttendance)
      .where(eq(studentAttendance.date, date));

    const statusCounts = {
      PENDING: 0,
      riding: 0,
      absent: 0,
    };

    // Count each status
    records.forEach(record => {
      if (record.status in statusCounts) {
        statusCounts[record.status as keyof typeof statusCounts]++;
      }
    });

    // Students without attendance records are considered PENDING
    const pending = total - records.length + statusCounts.PENDING;

    return {
      pending,
      riding: statusCounts.riding,
      absent: statusCounts.absent,
      total,
    };
  }

  async getStudentAbsenceReport(studentId: string, startDate: string, endDate: string): Promise<any[]> {
    const absences = await db
      .select()
      .from(studentAttendance)
      .where(
        and(
          eq(studentAttendance.studentId, studentId),
          eq(studentAttendance.status, "absent"),
          gte(studentAttendance.date, startDate),
          lte(studentAttendance.date, endDate)
        )
      )
      .orderBy(studentAttendance.date);

    return absences;
  }

  async getAttendanceAnalytics(startDate: string, endDate: string): Promise<any[]> {
    // Get all attendance records in date range with student and route info
    const records = await db
      .select({
        attendance: studentAttendance,
        student: students,
        route: routes,
      })
      .from(studentAttendance)
      .leftJoin(students, eq(studentAttendance.studentId, students.id))
      .leftJoin(routes, eq(students.assignedRouteId, routes.id))
      .where(
        and(
          gte(studentAttendance.date, startDate),
          lte(studentAttendance.date, endDate)
        )
      )
      .orderBy(studentAttendance.date, students.lastName);

    return records.map(r => ({
      date: r.attendance.date,
      status: r.attendance.status,
      studentId: r.student?.id,
      studentName: r.student ? `${r.student.firstName} ${r.student.lastName}` : 'Unknown',
      routeId: r.route?.id,
      routeName: r.route?.name,
      notes: r.attendance.notes,
    }));
  }

  async getMonthlyAttendanceStats(year: number, month: number): Promise<any> {
    // Format start and end dates for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // Get all attendance records for this month
    const records = await db
      .select({
        attendance: studentAttendance,
        student: {
          id: students.id,
          firstName: students.firstName,
          lastName: students.lastName,
        },
      })
      .from(studentAttendance)
      .leftJoin(students, eq(studentAttendance.studentId, students.id))
      .where(
        and(
          gte(studentAttendance.date, startDate),
          lte(studentAttendance.date, endDate)
        )
      );

    // Group by student
    const studentStats = new Map<string, any>();

    records.forEach(r => {
      if (!r.student) return;

      const studentId = r.student.id;
      if (!studentStats.has(studentId)) {
        studentStats.set(studentId, {
          studentId: r.student.id,
          studentName: `${r.student.firstName} ${r.student.lastName}`,
          pending: 0,
          riding: 0,
          absent: 0,
          total: 0,
        });
      }

      const stats = studentStats.get(studentId);
      stats.total++;

      if (r.attendance.status === "PENDING") stats.pending++;
      else if (r.attendance.status === "riding") stats.riding++;
      else if (r.attendance.status === "absent") stats.absent++;
    });

    return {
      month,
      year,
      startDate,
      endDate,
      students: Array.from(studentStats.values()),
    };
  }

  // ============ Audit Log Operations ============

  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db
      .insert(auditLogs)
      .values(auditLog)
      .returning();
    return log;
  }

  async getAllAuditLogs(): Promise<any[]> {
    const logs = await db
      .select({
        log: auditLogs,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
        },
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.createdAt));
    
    return logs.map((l) => ({
      ...l.log,
      user: l.user,
    }));
  }

  async getAuditLogsByUser(userId: string): Promise<any[]> {
    const logs = await db
      .select({
        log: auditLogs,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
        },
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt));
    
    return logs.map((l) => ({
      ...l.log,
      user: l.user,
    }));
  }

  async getAuditLogsByRole(role: "driver" | "parent"): Promise<any[]> {
    const logs = await db
      .select({
        log: auditLogs,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
        },
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(eq(auditLogs.userRole, role))
      .orderBy(desc(auditLogs.createdAt));
    
    return logs.map((l) => ({
      ...l.log,
      user: l.user,
    }));
  }

  // ============ Route Progress operations ============

  async initializeRouteProgress(shiftId: string): Promise<void> {
    // Get the shift and its route
    const shift = await db.query.shifts.findFirst({
      where: eq(shifts.id, shiftId),
    });

    if (!shift || !shift.routeId) {
      throw new NotFoundError("Shift or route not found");
    }

    // Get all stops for this route
    const routeStopsList = await db.query.routeStops.findMany({
      where: eq(routeStops.routeId, shift.routeId),
      orderBy: routeStops.stopOrder,
    });

    // Create progress records for each stop
    for (const routeStop of routeStopsList) {
      // Check if progress record already exists
      const existing = await db.query.routeProgress.findFirst({
        where: and(
          eq(routeProgress.shiftId, shiftId),
          eq(routeProgress.routeStopId, routeStop.id)
        ),
      });

      if (!existing) {
        await db.insert(routeProgress).values({
          shiftId,
          routeStopId: routeStop.id,
          status: "PENDING",
        });
      }
    }
  }

  async getRouteProgress(shiftId: string): Promise<any[]> {
    const progress = await db
      .select({
        progress: routeProgress,
        stop: stops,
        routeStop: routeStops,
      })
      .from(routeProgress)
      .leftJoin(routeStops, eq(routeProgress.routeStopId, routeStops.id))
      .leftJoin(stops, eq(routeStops.stopId, stops.id))
      .where(eq(routeProgress.shiftId, shiftId))
      .orderBy(routeStops.stopOrder);

    return progress.map((p) => ({
      ...p.progress,
      stop: p.stop,
      stopOrder: p.routeStop?.stopOrder,
      scheduledTime: p.routeStop?.scheduledTime,
    }));
  }

  async updateStopStatus(
    shiftId: string,
    routeStopId: string,
    status: "PENDING" | "COMPLETED" | "SKIPPED",
    notes?: string
  ): Promise<RouteProgress> {
    const existing = await db.query.routeProgress.findFirst({
      where: and(
        eq(routeProgress.shiftId, shiftId),
        eq(routeProgress.routeStopId, routeStopId)
      ),
    });

    if (!existing) {
      throw new NotFoundError("Route progress record not found");
    }

    const updates: UpdateRouteProgress = {
      status,
      notes,
      completedAt: status === "COMPLETED" ? new Date() : null,
    };

    const [updated] = await db
      .update(routeProgress)
      .set(updates)
      .where(eq(routeProgress.id, existing.id))
      .returning();

    return updated;
  }

  async getCurrentStopForShift(shiftId: string): Promise<any | null> {
    // Get the first PENDING stop for this shift
    const progress = await db
      .select({
        progress: routeProgress,
        stop: stops,
        routeStop: routeStops,
      })
      .from(routeProgress)
      .leftJoin(routeStops, eq(routeProgress.routeStopId, routeStops.id))
      .leftJoin(stops, eq(routeStops.stopId, stops.id))
      .where(
        and(
          eq(routeProgress.shiftId, shiftId),
          eq(routeProgress.status, "PENDING")
        )
      )
      .orderBy(routeStops.stopOrder)
      .limit(1);

    if (progress.length === 0) {
      return null;
    }

    const p = progress[0];
    return {
      ...p.progress,
      stop: p.stop,
      stopOrder: p.routeStop?.stopOrder,
      scheduledTime: p.routeStop?.scheduledTime,
    };
  }

  async getStopProgressForStudent(studentId: string, date: string): Promise<any | null> {
    // Get student's route for this date
    const student = await db.query.students.findFirst({
      where: eq(students.id, studentId),
    });

    if (!student || !student.routeId) {
      return null;
    }

    // Find the shift for this route and date
    const shift = await db.query.shifts.findFirst({
      where: and(
        eq(shifts.routeId, student.routeId),
        eq(shifts.date, date)
      ),
    });

    if (!shift) {
      return null;
    }

    // Get all progress for this shift
    const allProgress = await this.getRouteProgress(shift.id);
    
    // Get current stop (first PENDING stop)
    const currentStop = await this.getCurrentStopForShift(shift.id);
    
    // Find student's pickup stop by matching route stops
    const studentPickupStop = allProgress.find((p) => 
      p.stop?.address && student.pickupAddress && 
      p.stop.address.toLowerCase().includes(student.pickupAddress.toLowerCase())
    );

    if (!studentPickupStop || !currentStop) {
      return {
        studentId,
        routeId: student.routeId,
        shiftId: shift.id,
        currentStop: null,
        studentStop: null,
        stopsAway: null,
        totalStops: allProgress.length,
        completedStops: allProgress.filter((p) => p.status === "COMPLETED").length,
      };
    }

    const stopsAway = Math.max(0, (studentPickupStop.stopOrder || 0) - (currentStop.stopOrder || 0));

    return {
      studentId,
      routeId: student.routeId,
      shiftId: shift.id,
      currentStop,
      studentStop: studentPickupStop,
      stopsAway,
      totalStops: allProgress.length,
      completedStops: allProgress.filter((p) => p.status === "COMPLETED").length,
    };
  }

  // ============ Supplies Requests operations ============

  async createSuppliesRequest(request: InsertSuppliesRequest): Promise<SuppliesRequest> {
    const [newRequest] = await db
      .insert(suppliesRequests)
      .values(request)
      .returning();
    return newRequest;
  }

  async getSuppliesRequestsByDriver(driverId: string): Promise<SuppliesRequest[]> {
    return await db
      .select()
      .from(suppliesRequests)
      .where(eq(suppliesRequests.driverId, driverId))
      .orderBy(desc(suppliesRequests.createdAt));
  }

  async getAllSuppliesRequests(): Promise<SuppliesRequest[]> {
    return await db
      .select()
      .from(suppliesRequests)
      .orderBy(desc(suppliesRequests.createdAt));
  }

  async updateSuppliesRequestStatus(
    id: string,
    status: "PENDING" | "APPROVED" | "ORDERED" | "DELIVERED" | "REJECTED",
    adminNotes?: string,
    approvedBy?: string
  ): Promise<SuppliesRequest> {
    const [updated] = await db
      .update(suppliesRequests)
      .set({
        status,
        adminNotes,
        approvedBy,
        updatedAt: new Date(),
      })
      .where(eq(suppliesRequests.id, id))
      .returning();
    return updated;
  }

  // ============ Vehicle Checklists operations ============

  async createVehicleChecklist(checklist: InsertVehicleChecklist): Promise<VehicleChecklist> {
    const [newChecklist] = await db
      .insert(vehicleChecklists)
      .values(checklist)
      .returning();
    return newChecklist;
  }

  async getVehicleChecklistsByDriver(driverId: string): Promise<VehicleChecklist[]> {
    return await db
      .select()
      .from(vehicleChecklists)
      .where(eq(vehicleChecklists.driverId, driverId))
      .orderBy(desc(vehicleChecklists.createdAt));
  }

  async getVehicleChecklistsByVehicle(vehicleId: string): Promise<VehicleChecklist[]> {
    return await db
      .select()
      .from(vehicleChecklists)
      .where(eq(vehicleChecklists.vehicleId, vehicleId))
      .orderBy(desc(vehicleChecklists.createdAt));
  }

  async getAllVehicleChecklists(): Promise<VehicleChecklist[]> {
    return await db
      .select()
      .from(vehicleChecklists)
      .orderBy(desc(vehicleChecklists.createdAt));
  }

  async getTodayVehicleChecklist(
    driverId: string,
    vehicleId: string,
    type: "PRE_TRIP" | "POST_TRIP"
  ): Promise<VehicleChecklist | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [checklist] = await db
      .select()
      .from(vehicleChecklists)
      .where(
        and(
          eq(vehicleChecklists.driverId, driverId),
          eq(vehicleChecklists.vehicleId, vehicleId),
          eq(vehicleChecklists.checklistType, type),
          gte(vehicleChecklists.createdAt, today),
          lt(vehicleChecklists.createdAt, tomorrow)
        )
      )
      .orderBy(desc(vehicleChecklists.createdAt))
      .limit(1);

    return checklist;
  }

  // ============ Driver Feedback operations ============

  async createDriverFeedback(feedback: InsertDriverFeedback): Promise<DriverFeedback> {
    const [newFeedback] = await db
      .insert(driverFeedback)
      .values(feedback)
      .returning();
    return newFeedback;
  }

  async getDriverFeedbackByDriver(driverId: string): Promise<DriverFeedback[]> {
    return await db
      .select()
      .from(driverFeedback)
      .where(eq(driverFeedback.driverId, driverId))
      .orderBy(desc(driverFeedback.createdAt));
  }

  async getAllDriverFeedback(): Promise<DriverFeedback[]> {
    return await db
      .select()
      .from(driverFeedback)
      .orderBy(desc(driverFeedback.createdAt));
  }

  async updateDriverFeedbackStatus(
    id: string,
    status: "NEW" | "REVIEWING" | "PLANNED" | "COMPLETED" | "DISMISSED",
    adminResponse?: string,
    respondedBy?: string
  ): Promise<DriverFeedback> {
    const [updated] = await db
      .update(driverFeedback)
      .set({
        status,
        adminResponse,
        respondedBy,
        updatedAt: new Date(),
      })
      .where(eq(driverFeedback.id, id))
      .returning();
    return updated;
  }

  // ============ Geofence operations ============

  async getAllGeofences(): Promise<any[]> {
    return await db.select().from(geofences).orderBy(geofences.name);
  }

  async getGeofence(id: string): Promise<any | undefined> {
    const [geofence] = await db
      .select()
      .from(geofences)
      .where(eq(geofences.id, id));
    return geofence;
  }

  async createGeofence(geofenceData: any): Promise<any> {
    const [newGeofence] = await db
      .insert(geofences)
      .values({
        ...geofenceData,
        updatedAt: new Date(),
      })
      .returning();
    return newGeofence;
  }

  async updateGeofence(id: string, updates: any): Promise<any> {
    const [updated] = await db
      .update(geofences)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(geofences.id, id))
      .returning();
    
    if (!updated) {
      throw new NotFoundError(`Geofence with ID ${id} not found`);
    }
    
    return updated;
  }

  async deleteGeofence(id: string): Promise<void> {
    const result = await db
      .delete(geofences)
      .where(eq(geofences.id, id))
      .returning();
    
    if (result.length === 0) {
      throw new NotFoundError(`Geofence with ID ${id} not found`);
    }
  }

  async getGeofenceEvents(limit: number = 100): Promise<any[]> {
    return await db
      .select({
        id: geofenceEvents.id,
        vehicleId: geofenceEvents.vehicleId,
        geofenceId: geofenceEvents.geofenceId,
        eventType: geofenceEvents.eventType,
        createdAt: geofenceEvents.createdAt,
        shiftId: geofenceEvents.shiftId,
        latitude: geofenceEvents.latitude,
        longitude: geofenceEvents.longitude,
        vehiclePlate: vehicles.plateNumber,
        geofenceName: geofences.name,
        geofenceType: geofences.type,
      })
      .from(geofenceEvents)
      .leftJoin(vehicles, eq(geofenceEvents.vehicleId, vehicles.id))
      .leftJoin(geofences, eq(geofenceEvents.geofenceId, geofences.id))
      .orderBy(desc(geofenceEvents.createdAt))
      .limit(limit);
  }

  // ============ Data retention operations ============

  async cleanupOldMessages(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deleted = await db
      .delete(messages)
      .where(lt(messages.createdAt, cutoffDate))
      .returning({ id: messages.id });

    return deleted.length;
  }

  async cleanupOldGeofenceEvents(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deleted = await db
      .delete(geofenceEvents)
      .where(lt(geofenceEvents.occurredAt, cutoffDate))
      .returning({ id: geofenceEvents.id });

    return deleted.length;
  }

  async cleanupOldAuditLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deleted = await db
      .delete(auditLogs)
      .where(lt(auditLogs.createdAt, cutoffDate))
      .returning({ id: auditLogs.id });

    return deleted.length;
  }

  async cleanupOldDismissedAnnouncements(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Delete announcement dismissals older than retention period
    const deletedDismissals = await db
      .delete(announcementDismissals)
      .where(lt(announcementDismissals.dismissedAt, cutoffDate))
      .returning({ id: announcementDismissals.id });

    // Delete route announcement dismissals older than retention period
    const deletedRouteDismissals = await db
      .delete(routeAnnouncementDismissals)
      .where(lt(routeAnnouncementDismissals.dismissedAt, cutoffDate))
      .returning({ id: routeAnnouncementDismissals.id });

    return deletedDismissals.length + deletedRouteDismissals.length;
  }

  async cleanupInactiveDeviceTokens(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Delete device tokens that haven't been used for the retention period
    // or were deactivated longer than the retention period ago
    const deleted = await db
      .delete(deviceTokens)
      .where(
        or(
          and(
            eq(deviceTokens.isActive, false),
            lt(deviceTokens.deactivatedAt, cutoffDate)
          ),
          lt(deviceTokens.lastUsedAt, cutoffDate)
        )
      )
      .returning({ id: deviceTokens.id });

    return deleted.length;
  }
}

export const storage = new DatabaseStorage();
