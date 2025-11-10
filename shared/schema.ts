// Schema for Transportation Service Management System
// Reference: Replit Auth blueprint and PostgreSQL database blueprint

import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  integer,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============ Auth Tables (Required for Replit Auth) ============

// Session storage table - Required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User role enum
export const userRoleEnum = pgEnum("user_role", ["admin", "driver", "parent"]);

// User storage table - Extended for multi-role system
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email"),
  phone: varchar("phone").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").notNull().default("parent"),
  phoneNumber: varchar("phone_number"),
  address: text("address"),
  isLeadDriver: boolean("is_lead_driver").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Profile update schema - for user profile updates
export const updateProfileSchema = createInsertSchema(users).pick({
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  address: true,
}).refine(
  (data) => {
    if (!data.phoneNumber) return true; // Allow empty if optional
    // Strip formatting and check digit count
    const digits = data.phoneNumber.replace(/\D/g, '');
    return digits.length === 10;
  },
  {
    message: "Phone number must be exactly 10 digits",
    path: ["phoneNumber"],
  }
);

export type UpdateProfile = z.infer<typeof updateProfileSchema>;

// ============ Fleet Management Tables ============

// Vehicle status enum
export const vehicleStatusEnum = pgEnum("vehicle_status", [
  "active",
  "maintenance",
  "offline",
]);

// Vehicles table
export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  plateNumber: varchar("plate_number").notNull().unique(),
  capacity: integer("capacity").notNull(),
  status: vehicleStatusEnum("status").notNull().default("active"),
  currentLat: decimal("current_lat", { precision: 10, scale: 7 }),
  currentLng: decimal("current_lng", { precision: 10, scale: 7 }),
  lastLocationUpdate: timestamp("last_location_update"),
  samsaraVehicleId: varchar("samsara_vehicle_id").unique(),
  samsaraLastSync: timestamp("samsara_last_sync"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

// GPS location update schema for navigation webhook
export const gpsUpdateSchema = z.object({
  vehicle_id: z.string().optional(),
  plate_number: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timestamp: z.string().datetime().optional(),
  speed: z.number().optional(),
  heading: z.number().min(0).max(360).optional(),
}).refine(
  (data) => data.vehicle_id || data.plate_number,
  {
    message: "Either vehicle_id or plate_number must be provided",
  }
);

export type GpsUpdate = z.infer<typeof gpsUpdateSchema>;

// ============ Route Management Tables ============

// Route type enum
export const routeTypeEnum = pgEnum("route_type", ["MORNING", "AFTERNOON", "EXTRA"]);

// Routes table
export const routes = pgTable("routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  routeType: routeTypeEnum("route_type"), // Morning, Afternoon, or Extra Route
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRouteSchema = createInsertSchema(routes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Route = typeof routes.$inferSelect;

// Note: Forward reference to geofences table defined later in schema
// geofenceId FK will be validated at runtime by PostgreSQL
export const stops = pgTable("stops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  geofenceId: varchar("geofence_id"), // Auto-created geofence for stop location alerts, FK added below
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStopSchema = createInsertSchema(stops)
  .omit({
    id: true,
    geofenceId: true, // Auto-managed by backend
    createdAt: true,
  })
  .extend({
    // Transform empty strings to null for coordinates
    latitude: z.string().transform(val => val === "" ? null : val).nullable().optional(),
    longitude: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  });

export type InsertStop = z.infer<typeof insertStopSchema>;
export type Stop = typeof stops.$inferSelect;

// Route stops junction table - Links routes to stops with ordering
export const routeStops = pgTable("route_stops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  routeId: varchar("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  stopId: varchar("stop_id")
    .notNull()
    .references(() => stops.id, { onDelete: "cascade" }),
  stopOrder: integer("stop_order").notNull(),
  scheduledTime: varchar("scheduled_time"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRouteStopSchema = createInsertSchema(routeStops).omit({
  id: true,
  createdAt: true,
});

export type InsertRouteStop = z.infer<typeof insertRouteStopSchema>;
export type RouteStop = typeof routeStops.$inferSelect;

// ============ Household Management Tables ============

// Household table - Groups families by phone number
export const households = pgTable("households", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  primaryPhone: varchar("primary_phone").notNull().unique(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHouseholdSchema = createInsertSchema(households).omit({
  id: true,
  createdAt: true,
});

export type InsertHousehold = z.infer<typeof insertHouseholdSchema>;
export type Household = typeof households.$inferSelect;

// Household role enum
export const householdRoleEnum = pgEnum("household_role", ["PRIMARY", "SECONDARY"]);

// Household members table - Links users to households
export const householdMembers = pgTable("household_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  householdId: varchar("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  roleInHousehold: householdRoleEnum("role_in_household").notNull().default("PRIMARY"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHouseholdMemberSchema = createInsertSchema(householdMembers).omit({
  id: true,
  createdAt: true,
});

export type InsertHouseholdMember = z.infer<typeof insertHouseholdMemberSchema>;
export type HouseholdMember = typeof householdMembers.$inferSelect;

// ============ Student Management Tables ============

// Students table - Enhanced child profiles with guardian phones
export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  householdId: varchar("household_id").references(() => households.id, {
    onDelete: "set null",
  }),
  guardianPhones: text("guardian_phones").array().notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  dateOfBirth: varchar("date_of_birth"),
  grade: varchar("grade"),
  heightInches: integer("height_inches"),
  race: varchar("race"),
  gender: varchar("gender"),
  photoUrl: varchar("photo_url"),
  medicalNotes: text("medical_notes"),
  specialNeeds: text("special_needs"),
  emergencyContactName: varchar("emergency_contact_name"),
  emergencyContactPhone: varchar("emergency_contact_phone"),
  emergencyContactRelation: varchar("emergency_contact_relation"),
  notes: text("notes"),
  assignedRouteId: varchar("assigned_route_id").references(() => routes.id, {
    onDelete: "set null",
  }),
  pickupStopId: varchar("pickup_stop_id").references(() => stops.id, {
    onDelete: "set null",
  }),
  dropoffStopId: varchar("dropoff_stop_id").references(() => stops.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  householdId: true,
}).extend({
  guardianPhones: z.array(z.string()).min(1, "At least one guardian phone is required"),
});

export const updateStudentSchema = createInsertSchema(students).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  householdId: true,
  assignedRouteId: true,
  pickupStopId: true,
  dropoffStopId: true,
}).extend({
  guardianPhones: z.array(z.string()).min(1, "At least one guardian phone is required"),
});

export const adminUpdateStudentSchema = createInsertSchema(students).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  householdId: true,
}).extend({
  guardianPhones: z.array(z.string()).min(1, "At least one guardian phone is required"),
});

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type UpdateStudent = z.infer<typeof updateStudentSchema>;
export type AdminUpdateStudent = z.infer<typeof adminUpdateStudentSchema>;
export type Student = typeof students.$inferSelect;

// Attendance status enum (for type safety only - stored as varchar in DB)
export const attendanceStatusEnum = pgEnum("attendance_status", ["PENDING", "riding", "absent"]);

// Student attendance table - Daily attendance tracking
export const studentAttendance = pgTable("student_attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  date: varchar("date").notNull(), // Format: YYYY-MM-DD
  status: varchar("status").notNull().default("PENDING"), // PENDING | riding | absent
  markedByUserId: varchar("marked_by_user_id")
    .references(() => users.id, { onDelete: "cascade" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStudentAttendanceSchema = createInsertSchema(studentAttendance).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(["PENDING", "riding", "absent"]),
});

export const updateStudentAttendanceSchema = createInsertSchema(studentAttendance).omit({
  id: true,
  studentId: true,
  date: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(["PENDING", "riding", "absent"]).optional(),
}).partial();

export type InsertStudentAttendance = z.infer<typeof insertStudentAttendanceSchema>;
export type UpdateStudentAttendance = z.infer<typeof updateStudentAttendanceSchema>;
export type StudentAttendance = typeof studentAttendance.$inferSelect;

// ============ Schedule Management Tables ============

// Schedule pattern enum
export const schedulePatternEnum = pgEnum("schedule_pattern", [
  "WEEKDAYS",      // Monday-Friday
  "DAILY",         // Every day
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
  "CUSTOM",        // For custom scheduling
]);

// Driver assignments table - Simplified to just assign drivers to routes
export const driverAssignments = pgTable("driver_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  routeId: varchar("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  vehicleId: varchar("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  startTime: varchar("start_time").notNull(), // When the route starts (e.g., "07:00")
  endTime: varchar("end_time").notNull(), // When the route ends (e.g., "08:30")
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDriverAssignmentSchema = createInsertSchema(
  driverAssignments
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDriverAssignment = z.infer<
  typeof insertDriverAssignmentSchema
>;
export type DriverAssignment = typeof driverAssignments.$inferSelect;

// ============ Shift-Based Scheduling Tables ============

// Shift type enum
export const shiftTypeEnum = pgEnum("shift_type", ["MORNING", "AFTERNOON", "EXTRA"]);

// Shift status enum
export const shiftStatusEnum = pgEnum("shift_status", [
  "SCHEDULED",
  "ACTIVE",
  "COMPLETED",
  "MISSED",
]);

// Shifts table - Can reference driver assignments or be created standalone
export const shifts = pgTable(
  "shifts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    driverAssignmentId: varchar("driver_assignment_id").references(() => driverAssignments.id, {
      onDelete: "set null",
    }), // Optional reference to driver assignment
    driverId: varchar("driver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: varchar("date").notNull(), // Format: YYYY-MM-DD
    shiftType: shiftTypeEnum("shift_type").notNull(),
    plannedStart: varchar("planned_start").notNull(), // Format: HH:MM
    plannedEnd: varchar("planned_end").notNull(), // Format: HH:MM
    routeId: varchar("route_id").references(() => routes.id, {
      onDelete: "set null",
    }),
    vehicleId: varchar("vehicle_id").references(() => vehicles.id, {
      onDelete: "set null",
    }),
    status: shiftStatusEnum("status").notNull().default("SCHEDULED"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_shifts_driver_date").on(table.driverId, table.date),
  ]
);

export const insertShiftSchema = createInsertSchema(shifts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  plannedStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format"),
  plannedEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

export const updateShiftSchema = createInsertSchema(shifts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  plannedStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format").optional(),
  plannedEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format").optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
}).partial();

export type InsertShift = z.infer<typeof insertShiftSchema>;
export type UpdateShift = z.infer<typeof updateShiftSchema>;
export type Shift = typeof shifts.$inferSelect;

// Clock event type enum
export const clockEventTypeEnum = pgEnum("clock_event_type", ["IN", "OUT", "BREAK_START", "BREAK_END"]);

// Clock event source enum
export const clockEventSourceEnum = pgEnum("clock_event_source", [
  "USER",
  "AUTO",
  "ADMIN_EDIT",
  "AUTO_CLOCKOUT",
]);

// Clock events table - tracks actual clock in/out times per shift
export const clockEvents = pgTable(
  "clock_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    driverId: varchar("driver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shiftId: varchar("shift_id").references(() => shifts.id, {
      onDelete: "set null",
    }),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
    type: clockEventTypeEnum("type").notNull(),
    source: clockEventSourceEnum("source").notNull().default("USER"),
    notes: text("notes"),
    isResolved: boolean("is_resolved").notNull().default(true), // False for orphaned events
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_clock_events_driver_timestamp").on(table.driverId, table.timestamp),
    index("idx_clock_events_shift").on(table.shiftId),
    index("idx_clock_events_is_resolved").on(table.isResolved),
  ]
);

export const insertClockEventSchema = createInsertSchema(clockEvents).omit({
  id: true,
  createdAt: true,
});

export const updateClockEventSchema = createInsertSchema(clockEvents).omit({
  id: true,
  driverId: true,
  shiftId: true,
  type: true,
  createdAt: true,
}).partial();

export type InsertClockEvent = z.infer<typeof insertClockEventSchema>;
export type UpdateClockEvent = z.infer<typeof updateClockEventSchema>;
export type ClockEvent = typeof clockEvents.$inferSelect;

// Admin settings table - stores system configuration
export const adminSettings = pgTable("admin_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settingKey: varchar("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export const insertAdminSettingSchema = createInsertSchema(adminSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertAdminSetting = z.infer<typeof insertAdminSettingSchema>;
export type AdminSetting = typeof adminSettings.$inferSelect;

// ============ Route Progress Tracking Tables ============

// Stop status enum for route progress
export const stopStatusEnum = pgEnum("stop_status", ["PENDING", "COMPLETED", "SKIPPED"]);

// Route progress table - tracks which stops have been completed during a shift
export const routeProgress = pgTable(
  "route_progress",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    shiftId: varchar("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    routeStopId: varchar("route_stop_id")
      .notNull()
      .references(() => routeStops.id, { onDelete: "cascade" }),
    status: stopStatusEnum("status").notNull().default("PENDING"),
    completedAt: timestamp("completed_at"),
    notes: text("notes"),
    autoCompleted: boolean("auto_completed").notNull().default(false),
    dwellSessionId: varchar("dwell_session_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_route_progress_shift").on(table.shiftId),
  ]
);

export const insertRouteProgressSchema = createInsertSchema(routeProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRouteProgressSchema = createInsertSchema(routeProgress).omit({
  id: true,
  shiftId: true,
  routeStopId: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type InsertRouteProgress = z.infer<typeof insertRouteProgressSchema>;
export type UpdateRouteProgress = z.infer<typeof updateRouteProgressSchema>;
export type RouteProgress = typeof routeProgress.$inferSelect;

// ============ Geofence and GPS Tracking Tables ============

// Geofence type enum
export const geofenceTypeEnum = pgEnum("geofence_type", ["SCHOOL", "CUSTOM", "STOP"]);

// Event type enum for geofence transitions
export const geofenceEventTypeEnum = pgEnum("geofence_event_type", ["ENTRY", "EXIT"]);

// Geofences table - defines geographic boundaries for tracking
export const geofences = pgTable("geofences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  type: geofenceTypeEnum("type").notNull(),
  centerLat: decimal("center_lat", { precision: 10, scale: 7 }).notNull(),
  centerLng: decimal("center_lng", { precision: 10, scale: 7 }).notNull(),
  radiusMeters: integer("radius_meters").notNull(), // Radius in meters
  scheduleStartTime: varchar("schedule_start_time"), // Optional: HH:MM format
  scheduleEndTime: varchar("schedule_end_time"), // Optional: HH:MM format
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGeofenceSchema = createInsertSchema(geofences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGeofence = z.infer<typeof insertGeofenceSchema>;
export type Geofence = typeof geofences.$inferSelect;

// Vehicle geofence state - tracks current state for each vehicle/geofence pair
export const vehicleGeofenceState = pgTable(
  "vehicle_geofence_state",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    vehicleId: varchar("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    geofenceId: varchar("geofence_id")
      .notNull()
      .references(() => geofences.id, { onDelete: "cascade" }),
    isInside: boolean("is_inside").notNull().default(false),
    lastTransitionAt: timestamp("last_transition_at"),
    lastCheckedAt: timestamp("last_checked_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_vehicle_geofence_unique").on(table.vehicleId, table.geofenceId),
  ]
);

export type VehicleGeofenceState = typeof vehicleGeofenceState.$inferSelect;

// Geofence events table - logs all entry/exit events
export const geofenceEvents = pgTable(
  "geofence_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    vehicleId: varchar("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    geofenceId: varchar("geofence_id")
      .notNull()
      .references(() => geofences.id, { onDelete: "cascade" }),
    shiftId: varchar("shift_id").references(() => shifts.id, { onDelete: "set null" }),
    eventType: geofenceEventTypeEnum("event_type").notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
    occurredAt: timestamp("occurred_at").notNull().defaultNow(),
    payload: jsonb("payload"), // Additional metadata
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_geofence_events_occurred").on(table.occurredAt),
    index("idx_geofence_events_vehicle").on(table.vehicleId),
  ]
);

export const insertGeofenceEventSchema = createInsertSchema(geofenceEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertGeofenceEvent = z.infer<typeof insertGeofenceEventSchema>;
export type GeofenceEvent = typeof geofenceEvents.$inferSelect;

// Dwell session status enum
export const dwellSessionStatusEnum = pgEnum("dwell_session_status", ["ACTIVE", "COMPLETED", "ABANDONED"]);

// Vehicle dwell sessions - tracks when vehicles are stationary at stops
export const vehicleDwellSessions = pgTable(
  "vehicle_dwell_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    vehicleId: varchar("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    shiftId: varchar("shift_id").references(() => shifts.id, { onDelete: "cascade" }),
    routeStopId: varchar("route_stop_id").references(() => routeStops.id, { onDelete: "set null" }),
    routeProgressId: varchar("route_progress_id").references(() => routeProgress.id, { onDelete: "set null" }),
    status: dwellSessionStatusEnum("status").notNull().default("ACTIVE"),
    arrivalLat: decimal("arrival_lat", { precision: 10, scale: 7 }).notNull(),
    arrivalLng: decimal("arrival_lng", { precision: 10, scale: 7 }).notNull(),
    arrivalAt: timestamp("arrival_at").notNull().defaultNow(),
    departureLat: decimal("departure_lat", { precision: 10, scale: 7 }),
    departureLng: decimal("departure_lng", { precision: 10, scale: 7 }),
    departureAt: timestamp("departure_at"),
    dwellDurationSeconds: integer("dwell_duration_seconds"), // Total stationary time
    autoCompletedStop: boolean("auto_completed_stop").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_dwell_sessions_vehicle").on(table.vehicleId),
    index("idx_dwell_sessions_shift_stop").on(table.shiftId, table.routeStopId, table.status),
  ]
);

export const insertVehicleDwellSessionSchema = createInsertSchema(vehicleDwellSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVehicleDwellSession = z.infer<typeof insertVehicleDwellSessionSchema>;
export type VehicleDwellSession = typeof vehicleDwellSessions.$inferSelect;

// ============ Driver Utility Tables ============

// Supplies requests table - drivers can request supplies from admin
export const suppliesRequestStatusEnum = pgEnum("supplies_request_status", ["PENDING", "APPROVED", "ORDERED", "DELIVERED", "REJECTED"]);

export const suppliesRequests = pgTable("supplies_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  itemName: varchar("item_name").notNull(),
  quantity: integer("quantity").notNull(),
  urgency: varchar("urgency").notNull(), // LOW, MEDIUM, HIGH
  reason: text("reason"),
  status: suppliesRequestStatusEnum("status").notNull().default("PENDING"),
  adminNotes: text("admin_notes"),
  approvedBy: varchar("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSuppliesRequestSchema = createInsertSchema(suppliesRequests).omit({
  id: true,
  status: true,
  adminNotes: true,
  approvedBy: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSuppliesRequest = z.infer<typeof insertSuppliesRequestSchema>;
export type SuppliesRequest = typeof suppliesRequests.$inferSelect;

// Vehicle checklists table - pre/post-trip inspections
export const checklistTypeEnum = pgEnum("checklist_type", ["PRE_TRIP", "POST_TRIP"]);

export const vehicleChecklists = pgTable("vehicle_checklists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  vehicleId: varchar("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  shiftId: varchar("shift_id").references(() => shifts.id, { onDelete: "cascade" }),
  checklistType: checklistTypeEnum("checklist_type").notNull(),
  // Checklist items (true = OK, false = issue found)
  tiresOk: boolean("tires_ok").notNull(),
  lightsOk: boolean("lights_ok").notNull(),
  brakesOk: boolean("brakes_ok").notNull(),
  fluidLevelsOk: boolean("fluid_levels_ok").notNull(),
  interiorCleanOk: boolean("interior_clean_ok").notNull(),
  emergencyEquipmentOk: boolean("emergency_equipment_ok").notNull(),
  mirrorsOk: boolean("mirrors_ok").notNull(),
  seatsOk: boolean("seats_ok").notNull(),
  // Optional fields
  odometerReading: integer("odometer_reading"),
  fuelLevel: varchar("fuel_level"), // EMPTY, QUARTER, HALF, THREE_QUARTER, FULL
  issues: text("issues"), // Description of any issues found
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVehicleChecklistSchema = createInsertSchema(vehicleChecklists).omit({
  id: true,
  createdAt: true,
});

export type InsertVehicleChecklist = z.infer<typeof insertVehicleChecklistSchema>;
export type VehicleChecklist = typeof vehicleChecklists.$inferSelect;

// Driver feedback table - drivers can provide feedback and suggestions
export const feedbackCategoryEnum = pgEnum("feedback_category", ["UI_ISSUE", "FEATURE_REQUEST", "BUG_REPORT", "GENERAL"]);
export const feedbackStatusEnum = pgEnum("feedback_status", ["NEW", "REVIEWING", "PLANNED", "COMPLETED", "DISMISSED"]);

export const driverFeedback = pgTable("driver_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: feedbackCategoryEnum("category").notNull(),
  subject: varchar("subject").notNull(),
  description: text("description").notNull(),
  status: feedbackStatusEnum("status").notNull().default("NEW"),
  adminResponse: text("admin_response"),
  respondedBy: varchar("responded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDriverFeedbackSchema = createInsertSchema(driverFeedback).omit({
  id: true,
  status: true,
  adminResponse: true,
  respondedBy: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDriverFeedback = z.infer<typeof insertDriverFeedbackSchema>;
export type DriverFeedback = typeof driverFeedback.$inferSelect;

// ============ Time Tracking Tables ============

// Time entries table (clock in/out) - DEPRECATED in favor of shifts + clockEvents
export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  clockIn: timestamp("clock_in").notNull(),
  clockOut: timestamp("clock_out"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  createdAt: true,
});

export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;

// ============ Messaging Tables ============

// Messages table
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  recipientId: varchar("recipient_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  forwardedFromConversationId: varchar("forwarded_from_conversation_id"),
  forwardedByAdminId: varchar("forwarded_by_admin_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_messages_recipient_is_read").on(table.recipientId, table.isRead),
  index("idx_messages_sender").on(table.senderId),
]);

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Driver notifications table - alerts drivers when admin responds on their behalf
export const driverNotifications = pgTable("driver_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  conversationId: varchar("conversation_id").notNull(),
  messageId: varchar("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  parentId: varchar("parent_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isDismissed: boolean("is_dismissed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDriverNotificationSchema = createInsertSchema(driverNotifications).omit({
  id: true,
  createdAt: true,
});

export type InsertDriverNotification = z.infer<typeof insertDriverNotificationSchema>;
export type DriverNotification = typeof driverNotifications.$inferSelect;

// Announcements table - broadcast messages from admins
export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  targetRole: userRoleEnum("target_role").notNull(), // 'driver' or 'parent'
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
});

export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;

// Announcement reads table - tracks which users have read which announcements
export const announcementReads = pgTable("announcement_reads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  announcementId: varchar("announcement_id")
    .notNull()
    .references(() => announcements.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_announcement_reads_user").on(table.userId),
  index("idx_announcement_reads_announcement").on(table.announcementId),
]);

export const insertAnnouncementReadSchema = createInsertSchema(announcementReads).omit({
  id: true,
  createdAt: true,
});

export type InsertAnnouncementRead = z.infer<typeof insertAnnouncementReadSchema>;
export type AnnouncementRead = typeof announcementReads.$inferSelect;

// Announcement dismissals table - tracks which users have dismissed which announcements
export const announcementDismissals = pgTable("announcement_dismissals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  announcementId: varchar("announcement_id")
    .notNull()
    .references(() => announcements.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAnnouncementDismissalSchema = createInsertSchema(announcementDismissals).omit({
  id: true,
  createdAt: true,
});

export type InsertAnnouncementDismissal = z.infer<typeof insertAnnouncementDismissalSchema>;
export type AnnouncementDismissal = typeof announcementDismissals.$inferSelect;

// Route announcements table - announcements from drivers to parents on specific routes
export const routeAnnouncements = pgTable("route_announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  routeId: varchar("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRouteAnnouncementSchema = createInsertSchema(routeAnnouncements).omit({
  id: true,
  createdAt: true,
});

export type InsertRouteAnnouncement = z.infer<typeof insertRouteAnnouncementSchema>;
export type RouteAnnouncement = typeof routeAnnouncements.$inferSelect;

// Route announcement reads table - tracks which parents have read which route announcements
export const routeAnnouncementReads = pgTable("route_announcement_reads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  routeAnnouncementId: varchar("route_announcement_id")
    .notNull()
    .references(() => routeAnnouncements.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRouteAnnouncementReadSchema = createInsertSchema(routeAnnouncementReads).omit({
  id: true,
  createdAt: true,
});

export type InsertRouteAnnouncementRead = z.infer<typeof insertRouteAnnouncementReadSchema>;
export type RouteAnnouncementRead = typeof routeAnnouncementReads.$inferSelect;

// Route announcement dismissals table - tracks which parents have dismissed which route announcements
export const routeAnnouncementDismissals = pgTable("route_announcement_dismissals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  routeAnnouncementId: varchar("route_announcement_id")
    .notNull()
    .references(() => routeAnnouncements.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRouteAnnouncementDismissalSchema = createInsertSchema(routeAnnouncementDismissals).omit({
  id: true,
  createdAt: true,
});

export type InsertRouteAnnouncementDismissal = z.infer<typeof insertRouteAnnouncementDismissalSchema>;
export type RouteAnnouncementDismissal = typeof routeAnnouncementDismissals.$inferSelect;

// ============ Incident Management Tables ============

// Incident severity enum
export const incidentSeverityEnum = pgEnum("incident_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

// Incident status enum
export const incidentStatusEnum = pgEnum("incident_status", [
  "pending",
  "reviewed",
  "resolved",
]);

// Incidents table
export const incidents = pgTable("incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  vehicleId: varchar("vehicle_id").references(() => vehicles.id, {
    onDelete: "set null",
  }),
  routeId: varchar("route_id").references(() => routes.id, {
    onDelete: "set null",
  }),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  severity: incidentSeverityEnum("severity").notNull(),
  status: incidentStatusEnum("status").notNull().default("pending"),
  location: varchar("location"),
  photoUrl: varchar("photo_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertIncidentSchema = createInsertSchema(incidents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;

// ============ Audit Log Tables ============

// Audit log action enum - tracks types of actions logged
export const auditActionEnum = pgEnum("audit_action", [
  "created",
  "updated",
  "deleted",
  "marked_attendance",
  "reported_incident",
  "updated_profile",
  "changed_phone",
  "updated_student",
]);

// Audit log entity enum - tracks what type of entity was affected
export const auditEntityEnum = pgEnum("audit_entity", [
  "student",
  "attendance",
  "incident",
  "profile",
  "user",
]);

// Audit logs table - tracks all user changes for admin review
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  userRole: userRoleEnum("user_role").notNull(),
  action: auditActionEnum("action").notNull(),
  entityType: auditEntityEnum("entity_type").notNull(),
  entityId: varchar("entity_id"),
  description: text("description").notNull(),
  changes: jsonb("changes"), // Stores before/after values or additional details
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ============ Vehicle Inspection Tables ============

// Vehicle inspections table
export const vehicleInspections = pgTable("vehicle_inspections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  driverId: varchar("driver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tiresOk: boolean("tires_ok").notNull(),
  lightsOk: boolean("lights_ok").notNull(),
  brakesOk: boolean("brakes_ok").notNull(),
  fluidLevelsOk: boolean("fluid_levels_ok").notNull(),
  cleanlinessOk: boolean("cleanliness_ok").notNull(),
  notes: text("notes"),
  photoUrl: varchar("photo_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVehicleInspectionSchema = createInsertSchema(
  vehicleInspections
).omit({
  id: true,
  createdAt: true,
});

export type InsertVehicleInspection = z.infer<
  typeof insertVehicleInspectionSchema
>;
export type VehicleInspection = typeof vehicleInspections.$inferSelect;

// ============ Relations ============

export const usersRelations = relations(users, ({ many }) => ({
  studentsAsParent: many(students),
  driverAssignments: many(driverAssignments),
  shifts: many(shifts),
  clockEvents: many(clockEvents),
  sentMessages: many(messages, { relationName: "sentMessages" }),
  receivedMessages: many(messages, { relationName: "receivedMessages" }),
  incidents: many(incidents),
  timeEntries: many(timeEntries),
  vehicleInspections: many(vehicleInspections),
}));

export const vehiclesRelations = relations(vehicles, ({ many }) => ({
  driverAssignments: many(driverAssignments),
  shifts: many(shifts),
  incidents: many(incidents),
  inspections: many(vehicleInspections),
}));

export const routesRelations = relations(routes, ({ many }) => ({
  routeStops: many(routeStops),
  students: many(students),
  driverAssignments: many(driverAssignments),
  shifts: many(shifts),
  incidents: many(incidents),
}));

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  driver: one(users, {
    fields: [shifts.driverId],
    references: [users.id],
  }),
  route: one(routes, {
    fields: [shifts.routeId],
    references: [routes.id],
  }),
  vehicle: one(vehicles, {
    fields: [shifts.vehicleId],
    references: [vehicles.id],
  }),
  clockEvents: many(clockEvents),
}));

export const clockEventsRelations = relations(clockEvents, ({ one }) => ({
  driver: one(users, {
    fields: [clockEvents.driverId],
    references: [users.id],
  }),
  shift: one(shifts, {
    fields: [clockEvents.shiftId],
    references: [shifts.id],
  }),
}));

export const stopsRelations = relations(stops, ({ many }) => ({
  routeStops: many(routeStops),
  studentsPickup: many(students, { relationName: "pickupStop" }),
  studentsDropoff: many(students, { relationName: "dropoffStop" }),
}));

export const routeStopsRelations = relations(routeStops, ({ one }) => ({
  route: one(routes, {
    fields: [routeStops.routeId],
    references: [routes.id],
  }),
  stop: one(stops, {
    fields: [routeStops.stopId],
    references: [stops.id],
  }),
}));

export const studentsRelations = relations(students, ({ one }) => ({
  household: one(households, {
    fields: [students.householdId],
    references: [households.id],
  }),
  assignedRoute: one(routes, {
    fields: [students.assignedRouteId],
    references: [routes.id],
  }),
  pickupStop: one(stops, {
    fields: [students.pickupStopId],
    references: [stops.id],
    relationName: "pickupStop",
  }),
  dropoffStop: one(stops, {
    fields: [students.dropoffStopId],
    references: [stops.id],
    relationName: "dropoffStop",
  }),
}));

export const householdsRelations = relations(households, ({ many }) => ({
  members: many(householdMembers),
  students: many(students),
}));

export const householdMembersRelations = relations(householdMembers, ({ one }) => ({
  household: one(households, {
    fields: [householdMembers.householdId],
    references: [households.id],
  }),
  user: one(users, {
    fields: [householdMembers.userId],
    references: [users.id],
  }),
}));

export const driverAssignmentsRelations = relations(
  driverAssignments,
  ({ one }) => ({
    driver: one(users, {
      fields: [driverAssignments.driverId],
      references: [users.id],
    }),
    route: one(routes, {
      fields: [driverAssignments.routeId],
      references: [routes.id],
    }),
    vehicle: one(vehicles, {
      fields: [driverAssignments.vehicleId],
      references: [vehicles.id],
    }),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sentMessages",
  }),
  recipient: one(users, {
    fields: [messages.recipientId],
    references: [users.id],
    relationName: "receivedMessages",
  }),
}));

export const incidentsRelations = relations(incidents, ({ one }) => ({
  reporter: one(users, {
    fields: [incidents.reporterId],
    references: [users.id],
  }),
  vehicle: one(vehicles, {
    fields: [incidents.vehicleId],
    references: [vehicles.id],
  }),
  route: one(routes, {
    fields: [incidents.routeId],
    references: [routes.id],
  }),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  driver: one(users, {
    fields: [timeEntries.driverId],
    references: [users.id],
  }),
}));

export const vehicleInspectionsRelations = relations(
  vehicleInspections,
  ({ one }) => ({
    vehicle: one(vehicles, {
      fields: [vehicleInspections.vehicleId],
      references: [vehicles.id],
    }),
    driver: one(users, {
      fields: [vehicleInspections.driverId],
      references: [users.id],
    }),
  })
);
