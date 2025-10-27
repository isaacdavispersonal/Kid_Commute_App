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
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").notNull().default("parent"),
  phoneNumber: varchar("phone_number"),
  address: text("address"),
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
});

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

// ============ Route Management Tables ============

// Routes table
export const routes = pgTable("routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
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

// Route stops table
export const stops = pgTable("stops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  routeId: varchar("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  stopOrder: integer("stop_order").notNull(),
  scheduledTime: varchar("scheduled_time").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStopSchema = createInsertSchema(stops).omit({
  id: true,
  createdAt: true,
});

export type InsertStop = z.infer<typeof insertStopSchema>;
export type Stop = typeof stops.$inferSelect;

// ============ Student Management Tables ============

// Students table - Enhanced child profiles
export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentId: varchar("parent_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
});

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;

// ============ Schedule Management Tables ============

// Driver assignments table
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
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: varchar("start_time").notNull(),
  endTime: varchar("end_time").notNull(),
  isActive: boolean("is_active").notNull().default(true),
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

// ============ Time Tracking Tables ============

// Time entries table (clock in/out)
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

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
  sentMessages: many(messages, { relationName: "sentMessages" }),
  receivedMessages: many(messages, { relationName: "receivedMessages" }),
  incidents: many(incidents),
  timeEntries: many(timeEntries),
  vehicleInspections: many(vehicleInspections),
}));

export const vehiclesRelations = relations(vehicles, ({ many }) => ({
  driverAssignments: many(driverAssignments),
  incidents: many(incidents),
  inspections: many(vehicleInspections),
}));

export const routesRelations = relations(routes, ({ many }) => ({
  stops: many(stops),
  students: many(students),
  driverAssignments: many(driverAssignments),
  incidents: many(incidents),
}));

export const stopsRelations = relations(stops, ({ one, many }) => ({
  route: one(routes, {
    fields: [stops.routeId],
    references: [routes.id],
  }),
  studentsPickup: many(students, { relationName: "pickupStop" }),
  studentsDropoff: many(students, { relationName: "dropoffStop" }),
}));

export const studentsRelations = relations(students, ({ one }) => ({
  parent: one(users, {
    fields: [students.parentId],
    references: [users.id],
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
