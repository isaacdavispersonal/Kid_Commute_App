// Schema for Transportation Service Management System
// Reference: Replit Auth blueprint and PostgreSQL database blueprint

import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  index,
  uniqueIndex,
  jsonb,
  pgTable,
  timestamp,
  date,
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
  phone: varchar("phone"), // Legacy column - use phoneNumber instead
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").notNull().default("parent"),
  phoneNumber: varchar("phone_number"),
  address: text("address"),
  isLeadDriver: boolean("is_lead_driver").notNull().default(false),
  bambooEmployeeId: varchar("bamboo_employee_id"),
  assignedVehicleId: varchar("assigned_vehicle_id"), // Default vehicle for drivers
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

// Device platform enum for push notifications
export const devicePlatformEnum = pgEnum("device_platform", ["ios", "android"]);

// Device tokens table for push notifications
export const deviceTokens = pgTable("device_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: devicePlatformEnum("platform").notNull(),
  token: text("token").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  deviceModel: varchar("device_model"),
  osVersion: varchar("os_version"),
  appVersion: varchar("app_version"),
  failureCount: integer("failure_count").notNull().default(0),
  lastFailureAt: timestamp("last_failure_at"),
  deactivatedAt: timestamp("deactivated_at"),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_device_tokens_user_active").on(table.userId, table.isActive),
]);

export const insertDeviceTokenSchema = createInsertSchema(deviceTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  failureCount: true,
  lastFailureAt: true,
  deactivatedAt: true,
  lastUsedAt: true,
}).extend({
  token: z.string().min(1, "Token is required"),
  platform: z.enum(["ios", "android"]),
});

export type InsertDeviceToken = z.infer<typeof insertDeviceTokenSchema>;
export type DeviceToken = typeof deviceTokens.$inferSelect;

// ============ Mobile Auth Credentials ============

// Auth credentials table for mobile app login (separate from Replit OIDC)
export const authCredentials = pgTable("auth_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  email: varchar("email").unique(), // Can login with email
  phone: varchar("phone").unique(), // Can login with phone (normalized, digits only)
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  emailVerified: boolean("email_verified").notNull().default(false), // Email verification status
  emailVerifiedAt: timestamp("email_verified_at"), // When email was verified
  lastLoginAt: timestamp("last_login_at"),
  passwordUpdatedAt: timestamp("password_updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_auth_credentials_email").on(table.email),
  index("idx_auth_credentials_phone").on(table.phone),
]);

export const insertAuthCredentialsSchema = createInsertSchema(authCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  passwordUpdatedAt: true,
}).extend({
  email: z.string().email("Invalid email format").optional(),
  phone: z.string().regex(/^\d{10}$/, "Phone must be 10 digits").optional(),
  passwordHash: z.string().min(1),
});

export type InsertAuthCredentials = z.infer<typeof insertAuthCredentialsSchema>;
export type AuthCredentials = typeof authCredentials.$inferSelect;

// Mobile login request schema
export const mobileLoginSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"), // email or phone
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type MobileLoginRequest = z.infer<typeof mobileLoginSchema>;

// Mobile registration request schema
export const mobileRegisterSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  phone: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

export type MobileRegisterRequest = z.infer<typeof mobileRegisterSchema>;

// ============ Password Reset Tokens ============

// Password reset tokens table for forgot password flow
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_password_reset_tokens_token").on(table.token),
  index("idx_password_reset_tokens_user").on(table.userId),
]);

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Forgot password request schema
export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
});

export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;

// Reset password request schema
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;

// ============ Email Verification Tokens ============

// Email verification tokens table for account activation
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email").notNull(), // The email being verified
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_email_verification_tokens_token").on(table.token),
  index("idx_email_verification_tokens_user").on(table.userId),
]);

export const insertEmailVerificationTokenSchema = createInsertSchema(emailVerificationTokens).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

export type InsertEmailVerificationToken = z.infer<typeof insertEmailVerificationTokenSchema>;
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;

// Resend verification email request schema
export const resendVerificationSchema = z.object({
  email: z.string().email("Valid email is required"),
});

export type ResendVerificationRequest = z.infer<typeof resendVerificationSchema>;

// ============ Billing Portal Configuration ============

// Payment portal provider enum
export const paymentProviderEnum = pgEnum("payment_provider", [
  "quickbooks",
  "classwallet",
]);

// Payment portals table - stores configured payment provider portals
export const paymentPortals = pgTable("payment_portals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: paymentProviderEnum("provider").notNull().unique(),
  portalUrl: text("portal_url").notNull(),
  displayName: varchar("display_name").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPaymentPortalSchema = createInsertSchema(paymentPortals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  provider: z.enum(["quickbooks", "classwallet"]),
  portalUrl: z.string().url("Portal URL must be a valid URL"),
  displayName: z.string().min(1, "Display name is required"),
});

export type InsertPaymentPortal = z.infer<typeof insertPaymentPortalSchema>;
export type PaymentPortal = typeof paymentPortals.$inferSelect;

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
  nickname: varchar("nickname"), // Optional friendly name displayed throughout the app
  plateNumber: varchar("plate_number").notNull().unique(),
  capacity: integer("capacity").notNull(),
  status: vehicleStatusEnum("status").notNull().default("active"),
  driverId: varchar("driver_id").references(() => users.id, { onDelete: "set null" }), // Optional driver assignment
  currentLat: decimal("current_lat", { precision: 10, scale: 7 }),
  currentLng: decimal("current_lng", { precision: 10, scale: 7 }),
  currentSpeedMph: decimal("current_speed_mph", { precision: 5, scale: 1 }),
  currentHeadingDeg: decimal("current_heading_deg", { precision: 5, scale: 1 }),
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

// Route color enum - for visual organization
export const routeColorEnum = pgEnum("route_color", [
  "tan",
  "red",
  "blue",
  "orange",
  "yellow",
  "purple",
  "green",
  "gray",
  "teal",
  "gold",
  "pink",
  "maroon",
]);

// Route groups table - for organizing related routes
export const routeGroups = pgTable("route_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  color: routeColorEnum("color"), // Optional visual color label
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRouteGroupSchema = createInsertSchema(routeGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRouteGroup = z.infer<typeof insertRouteGroupSchema>;
export type RouteGroup = typeof routeGroups.$inferSelect;

// Routes table
export const routes = pgTable("routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  routeType: routeTypeEnum("route_type"), // Morning, Afternoon, or Extra Route
  color: routeColorEnum("color"), // Visual color label (route color takes precedence over group color)
  groupId: varchar("group_id").references(() => routeGroups.id, { onDelete: "set null" }), // Optional group assignment
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_routes_group_id").on(table.groupId), // Index for group-based filtering
]);

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

// Enriched route stop type (Stop + route-stop junction metadata)
export type RouteStopWithMetadata = Stop & {
  stopId: string;
  routeStopId: string;
  stopOrder: number;
  scheduledTime: string | null;
};

// Shift route context type for unified driver route dashboard
export type ShiftRouteContext = {
  shift: {
    id: string;
    date: string;
    shiftType: string;
    plannedStart: string;
    plannedEnd: string;
    status: string;
    inspectionCompletedAt: Date | null;
    routeCompletedAt: Date | null;
    inspectionComplete: boolean;
  };
  route: {
    id: string;
    name: string;
    description: string | null;
  };
  vehicle: {
    id: string;
    name: string;
    plateNumber: string;
  } | null;
  students: Array<{
    id: string;
    firstName: string;
    lastName: string;
    attendance: "riding" | "absent" | null;
    plannedStopId: string | null;
    plannedStopName: string | null;
    plannedStopOrder: number | null;
    boardEvent: {
      stopId: string;
      stopName: string | null;
      recordedAt: Date;
    } | null;
    deboardEvent: {
      stopId: string;
      stopName: string | null;
      recordedAt: Date;
    } | null;
    notes: string | null;
    allergies: string | null;
    medicalNotes: string | null;
    specialNeeds: string | null;
  }>;
  stops: Array<RouteStopWithMetadata & {
    students: Array<{
      id: string;
      firstName: string;
      lastName: string;
      attendance: {
        status: string;
        markedByUserId: string;
        createdAt: string;
      } | null;
    }>;
    progress: {
      status: string;
      completedAt: Date | null;
      notes: string | null;
    };
    stopsAway: number;
  }>;
  progress: {
    completedStops: number;
    totalStops: number;
    activeStopId: string | null;
  };
  activeRouteRun?: {
    id: string;
    status: "SCHEDULED" | "ACTIVE" | "ENDED_PENDING_REVIEW" | "FINALIZED" | "CANCELLED";
    startedAt: string | null;
    endedAt: string | null;
  } | null;
};

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
  primaryPhone: varchar("primary_phone").unique(),
  isPlaceholder: boolean("is_placeholder").notNull().default(false),
  placeholderSource: text("placeholder_source"), // e.g., "bulk_import_2024-11-13"
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
  heightInches: integer("height_inches"),
  race: varchar("race"),
  gender: varchar("gender"),
  photoUrl: varchar("photo_url"),
  allergies: text("allergies"),
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

// Student-Route junction table for many-to-many relationships
export const studentRoutes = pgTable("student_routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  routeId: varchar("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  pickupStopId: varchar("pickup_stop_id").references(() => stops.id, {
    onDelete: "set null",
  }),
  dropoffStopId: varchar("dropoff_stop_id").references(() => stops.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudentRouteSchema = createInsertSchema(studentRoutes).omit({
  id: true,
  createdAt: true,
});

export type InsertStudentRoute = z.infer<typeof insertStudentRouteSchema>;
export type StudentRoute = typeof studentRoutes.$inferSelect;

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

// Bulk import schema for students - requires at least one guardian phone
export const bulkImportStudentSchema = createInsertSchema(students).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  guardianPhones: z.array(z.string()).min(1, "At least one guardian phone is required"),
  householdId: z.string().optional(), // Will be created if not provided
});

// Bulk import schema for stops - minimal fields required
export const bulkImportStopSchema = createInsertSchema(stops).omit({
  id: true,
  geofenceId: true,
  createdAt: true,
}).extend({
  latitude: z.string().nullable().optional(),
  longitude: z.string().nullable().optional(),
});

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type UpdateStudent = z.infer<typeof updateStudentSchema>;
export type AdminUpdateStudent = z.infer<typeof adminUpdateStudentSchema>;
export type BulkImportStudent = z.infer<typeof bulkImportStudentSchema>;
export type BulkImportStop = z.infer<typeof bulkImportStopSchema>;
export type Student = typeof students.$inferSelect;

// Bulk import input types for storage layer
export interface BulkImportStopInput {
  name: string;
  address: string;
  region?: string;
  latitude?: number;
  longitude?: number;
}

export interface BulkImportStudentInput {
  firstName: string;
  lastName: string;
  guardianPhones: string[];
  guardianNames?: string;
  notes?: string;
}

// Bulk import skip/error reasons
export type BulkImportStopSkipReason = {
  input: BulkImportStopInput;
  reason: "duplicate" | "invalid";
  message: string;
};

export type BulkImportStudentSkipReason = {
  input: BulkImportStudentInput;
  reason: "duplicate_in_batch" | "invalid";
  message: string;
};

// Bulk import results
export interface BulkImportStopResult {
  created: Stop[];
  skipped: BulkImportStopSkipReason[];
}

export interface BulkImportStudentResult {
  created: Student[];
  skipped: BulkImportStudentSkipReason[];
}

// Bulk import API request/response schemas
export const importPreviewRequestSchema = z.object({
  text: z.string().min(1, "Import text is required"),
  region: z.string().optional(), // For stops: "East Valley" or "West Valley"
});

export const importCommitRequestSchema = importPreviewRequestSchema.extend({
  source: z.string().optional(), // e.g., "manual:2024-11-13" - auto-generated if omitted
});

export type ImportPreviewRequest = z.infer<typeof importPreviewRequestSchema>;
export type ImportCommitRequest = z.infer<typeof importCommitRequestSchema>;

// Preview response types
export interface ImportStopsPreviewResponse {
  success: boolean;
  stops: BulkImportStopInput[];
  errors: string[];
}

export interface ImportStudentsPreviewResponse {
  success: boolean;
  students: BulkImportStudentInput[];
  errors: string[];
}

// Commit response types
export interface ImportStopsCommitResponse {
  success: boolean;
  created: Stop[];
  skipped: BulkImportStopSkipReason[];
  warnings: string[];
  source: string;
}

export interface ImportStudentsCommitResponse {
  success: boolean;
  created: Student[];
  skipped: BulkImportStudentSkipReason[];
  warnings: string[];
  source: string;
}

// Attendance status enum (for type safety only - stored as varchar in DB)
export const attendanceStatusEnum = pgEnum("attendance_status", ["PENDING", "riding", "absent"]);

// Student attendance table - Per-shift attendance tracking
// Keyed by studentId + date + shiftId to support AM/PM routes without overwrites
// routeRunId is optional for backward compatibility; new records should use it
export const studentAttendance = pgTable("student_attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  date: varchar("date").notNull(), // Format: YYYY-MM-DD
  shiftId: varchar("shift_id")
    .references(() => shifts.id, { onDelete: "cascade" }), // Links attendance to specific shift (AM/PM)
  routeRunId: varchar("route_run_id"), // FK to route_runs for multi-driver safety (added later in schema)
  status: varchar("status").notNull().default("PENDING"), // PENDING | riding | absent
  markedByUserId: varchar("marked_by_user_id")
    .references(() => users.id, { onDelete: "cascade" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_student_attendance_route_run").on(table.routeRunId),
]);

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

// ============ Student Ride Events Table ============

// Ride event type enum
export const rideEventTypeEnum = pgEnum("ride_event_type", ["BOARD", "DEBOARD"]);

// Student ride events table - Tracks actual board/deboard events during shifts
// routeRunId is optional for backward compatibility; new records should use it
export const studentRideEvents = pgTable("student_ride_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shiftId: varchar("shift_id")
    .notNull()
    .references(() => shifts.id, { onDelete: "cascade" }),
  routeRunId: varchar("route_run_id"), // FK to route_runs for multi-driver safety
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  plannedStopId: varchar("planned_stop_id").references(() => stops.id, {
    onDelete: "set null",
  }), // The stop student was expected at (can be null for ad-hoc students)
  actualStopId: varchar("actual_stop_id")
    .notNull()
    .references(() => stops.id, { onDelete: "cascade" }), // The stop where event actually occurred
  eventType: rideEventTypeEnum("event_type").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ride_events_shift").on(table.shiftId),
  index("idx_ride_events_student").on(table.studentId),
  index("idx_ride_events_route_run").on(table.routeRunId),
]);

export const insertStudentRideEventSchema = createInsertSchema(studentRideEvents).omit({
  id: true,
  recordedAt: true, // Server-managed
  createdAt: true,
  updatedAt: true,
}).extend({
  eventType: z.enum(["BOARD", "DEBOARD"]),
});

export type InsertStudentRideEvent = z.infer<typeof insertStudentRideEventSchema>;
export type StudentRideEvent = typeof studentRideEvents.$inferSelect;

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

// Driver assignments table - Assigns drivers to routes with optional vehicle
export const driverAssignments = pgTable("driver_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  routeId: varchar("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  vehicleId: varchar("vehicle_id").references(() => vehicles.id, {
    onDelete: "set null",
  }), // Optional vehicle assignment
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
    inspectionCompletedAt: timestamp("inspection_completed_at"), // Timestamp when vehicle inspection is completed
    routeStartedAt: timestamp("route_started_at"), // Timestamp when route operations were actually started
    routeCompletedAt: timestamp("route_completed_at"), // Timestamp when driver finished the route
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_shifts_driver_date").on(table.driverId, table.date),
  ]
);

export const insertShiftSchema = createInsertSchema(shifts).omit({
  id: true,
  inspectionCompletedAt: true, // Server-managed
  routeStartedAt: true, // Server-managed
  routeCompletedAt: true, // Server-managed
  createdAt: true,
  updatedAt: true,
}).extend({
  plannedStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format"),
  plannedEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

export const updateShiftSchema = createInsertSchema(shifts).omit({
  id: true,
  inspectionCompletedAt: true, // Server-managed
  routeStartedAt: true, // Server-managed
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

// ============ Student Service Days Tables ============

// Service day override type enum
export const serviceDayOverrideTypeEnum = pgEnum("service_day_override_type", [
  "FORCE_RIDING",      // Student rides even though not scheduled
  "FORCE_NOT_RIDING",  // Student doesn't ride even though scheduled
]);

// Student service days table - Stores which days of the week a student rides for each route/shift
// Uses bitmask: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64
// Example: Mon+Wed+Fri = 1+4+16 = 21
export const studentServiceDays = pgTable("student_service_days", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  routeId: varchar("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  shiftType: shiftTypeEnum("shift_type").notNull(), // MORNING, AFTERNOON, EXTRA
  serviceDaysBitmask: integer("service_days_bitmask").notNull().default(31), // Default: Mon-Fri (1+2+4+8+16=31)
  effectiveStartDate: varchar("effective_start_date"), // YYYY-MM-DD, optional
  effectiveEndDate: varchar("effective_end_date"), // YYYY-MM-DD, optional
  updatedByUserId: varchar("updated_by_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_student_service_days_student").on(table.studentId),
  index("idx_student_service_days_route").on(table.routeId),
  uniqueIndex("idx_student_service_days_unique").on(table.studentId, table.routeId, table.shiftType),
]);

export const insertStudentServiceDaysSchema = createInsertSchema(studentServiceDays).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  shiftType: z.enum(["MORNING", "AFTERNOON", "EXTRA"]),
  serviceDaysBitmask: z.number().int().min(0).max(127), // 0-127 (7 bits for 7 days)
});

export const updateStudentServiceDaysSchema = createInsertSchema(studentServiceDays).omit({
  id: true,
  studentId: true,
  routeId: true,
  shiftType: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  serviceDaysBitmask: z.number().int().min(0).max(127).optional(),
}).partial();

export type InsertStudentServiceDays = z.infer<typeof insertStudentServiceDaysSchema>;
export type UpdateStudentServiceDays = z.infer<typeof updateStudentServiceDaysSchema>;
export type StudentServiceDays = typeof studentServiceDays.$inferSelect;

// Student service day overrides table - One-off date-specific overrides
export const studentServiceDayOverrides = pgTable("student_service_day_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  routeId: varchar("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  shiftType: shiftTypeEnum("shift_type").notNull(),
  serviceDate: varchar("service_date").notNull(), // YYYY-MM-DD
  overrideType: serviceDayOverrideTypeEnum("override_type").notNull(),
  reason: text("reason"),
  createdByUserId: varchar("created_by_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_service_day_overrides_student").on(table.studentId),
  index("idx_service_day_overrides_date").on(table.serviceDate),
  uniqueIndex("idx_service_day_overrides_unique").on(table.studentId, table.routeId, table.shiftType, table.serviceDate),
]);

export const insertStudentServiceDayOverrideSchema = createInsertSchema(studentServiceDayOverrides).omit({
  id: true,
  createdAt: true,
}).extend({
  shiftType: z.enum(["MORNING", "AFTERNOON", "EXTRA"]),
  overrideType: z.enum(["FORCE_RIDING", "FORCE_NOT_RIDING"]),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
});

export type InsertStudentServiceDayOverride = z.infer<typeof insertStudentServiceDayOverrideSchema>;
export type StudentServiceDayOverride = typeof studentServiceDayOverrides.$inferSelect;

// Helper constants for service day bitmask
export const SERVICE_DAY_BITS = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 4,
  THURSDAY: 8,
  FRIDAY: 16,
  SATURDAY: 32,
  SUNDAY: 64,
} as const;

// Weekdays only (Mon-Fri) = 31
export const WEEKDAYS_BITMASK = 31;
// All days (Mon-Sun) = 127
export const ALL_DAYS_BITMASK = 127;

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

// ============ RouteRun Tables (Multi-Driver Safety) ============

// RouteRun status enum - lifecycle states for a live route execution
export const routeRunStatusEnum = pgEnum("route_run_status", [
  "SCHEDULED",           // Created but not started
  "ACTIVE",              // Route is in progress
  "ENDED_PENDING_REVIEW", // Driver finished, awaiting review/corrections
  "FINALIZED",           // Locked, no more changes allowed
  "CANCELLED",           // Route was cancelled
]);

// RouteRun participant role enum
export const routeRunParticipantRoleEnum = pgEnum("route_run_participant_role", [
  "PRIMARY",  // Can start, stop, mark attendance, complete route
  "AID",      // Default view-only, optional attendance if enabled
  "VIEWER",   // View-only
]);

// RouteRun event types for audit log
export const routeRunEventTypeEnum = pgEnum("route_run_event_type", [
  "RUN_CREATED",
  "RUN_STARTED",
  "RUN_ENDED",
  "RUN_FINALIZED",
  "RUN_REOPENED",
  "RUN_CANCELLED",
  "PARTICIPANT_JOINED",
  "PARTICIPANT_LEFT",
  "PARTICIPANT_ROLE_CHANGED",
  "STOP_ARRIVED",
  "STOP_COMPLETED",
  "STOP_SKIPPED",
  "ATTENDANCE_UPDATED",
  "STUDENT_BOARDED",
  "STUDENT_DEBOARDED",
]);

// RouteRuns table - Live instance of a route for a specific date + shift
// This is separate from shifts (which handle scheduling/payroll)
export const routeRuns = pgTable(
  "route_runs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    routeId: varchar("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    serviceDate: varchar("service_date").notNull(), // Format: YYYY-MM-DD
    shiftType: shiftTypeEnum("shift_type").notNull(), // AM/PM/EXTRA
    status: routeRunStatusEnum("status").notNull().default("SCHEDULED"),
    primaryDriverId: varchar("primary_driver_id")
      .references(() => users.id, { onDelete: "set null" }), // Set when started
    vehicleId: varchar("vehicle_id")
      .references(() => vehicles.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    finalizedAt: timestamp("finalized_at"),
    startMileage: integer("start_mileage"), // Odometer reading at start
    endMileage: integer("end_mileage"), // Odometer reading at end
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_route_runs_route_date").on(table.routeId, table.serviceDate),
    index("idx_route_runs_primary_driver").on(table.primaryDriverId),
    uniqueIndex("idx_route_runs_unique_context").on(table.routeId, table.serviceDate, table.shiftType),
  ]
);

export const insertRouteRunSchema = createInsertSchema(routeRuns).omit({
  id: true,
  startedAt: true,
  endedAt: true,
  finalizedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

export const updateRouteRunSchema = createInsertSchema(routeRuns).omit({
  id: true,
  routeId: true,
  serviceDate: true,
  shiftType: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type InsertRouteRun = z.infer<typeof insertRouteRunSchema>;
export type UpdateRouteRun = z.infer<typeof updateRouteRunSchema>;
export type RouteRun = typeof routeRuns.$inferSelect;

// RouteRun participants table - tracks who is viewing/participating in a route run
export const routeRunParticipants = pgTable(
  "route_run_participants",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    routeRunId: varchar("route_run_id")
      .notNull()
      .references(() => routeRuns.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: routeRunParticipantRoleEnum("role").notNull().default("VIEWER"),
    joinedAt: timestamp("joined_at").defaultNow(),
    leftAt: timestamp("left_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_route_run_participants_run").on(table.routeRunId),
    index("idx_route_run_participants_user").on(table.userId),
  ]
);

export const insertRouteRunParticipantSchema = createInsertSchema(routeRunParticipants).omit({
  id: true,
  joinedAt: true,
  leftAt: true,
  createdAt: true,
});

export type InsertRouteRunParticipant = z.infer<typeof insertRouteRunParticipantSchema>;
export type RouteRunParticipant = typeof routeRunParticipants.$inferSelect;

// RouteRun events table - audit log for all actions during a route run
export const routeRunEvents = pgTable(
  "route_run_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    routeRunId: varchar("route_run_id")
      .notNull()
      .references(() => routeRuns.id, { onDelete: "cascade" }),
    eventType: routeRunEventTypeEnum("event_type").notNull(),
    actorUserId: varchar("actor_user_id")
      .references(() => users.id, { onDelete: "set null" }),
    payload: jsonb("payload"), // Flexible JSON for event-specific data
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_route_run_events_run").on(table.routeRunId),
    index("idx_route_run_events_type").on(table.eventType),
  ]
);

export const insertRouteRunEventSchema = createInsertSchema(routeRunEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertRouteRunEvent = z.infer<typeof insertRouteRunEventSchema>;
export type RouteRunEvent = typeof routeRunEvents.$inferSelect;

// Attendance change log table - audit trail for attendance corrections
export const attendanceChangeLogs = pgTable(
  "attendance_change_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    routeRunId: varchar("route_run_id")
      .notNull()
      .references(() => routeRuns.id, { onDelete: "cascade" }),
    studentId: varchar("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    actorUserId: varchar("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    oldValueJson: jsonb("old_value_json").notNull(), // Previous attendance state
    newValueJson: jsonb("new_value_json").notNull(), // New attendance state
    reason: text("reason"), // Optional reason for the change
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_attendance_change_logs_run").on(table.routeRunId),
    index("idx_attendance_change_logs_student").on(table.studentId),
    index("idx_attendance_change_logs_actor").on(table.actorUserId),
  ]
);

export const insertAttendanceChangeLogSchema = createInsertSchema(attendanceChangeLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAttendanceChangeLog = z.infer<typeof insertAttendanceChangeLogSchema>;
export type AttendanceChangeLog = typeof attendanceChangeLogs.$inferSelect;

// Route Requests table - structured requests from drivers for route/roster issues
export const routeRequestTypeEnum = pgEnum("route_request_type", [
  "MISSING_STUDENT",
  "UNEXPECTED_STUDENT",
  "WRONG_STOP",
  "ROSTER_CLARIFICATION",
]);

export const routeRequestStatusEnum = pgEnum("route_request_status", [
  "OPEN",
  "APPROVED",
  "DENIED",
  "RESOLVED",
]);

export const routeRequests = pgTable(
  "route_requests",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    routeRunId: varchar("route_run_id")
      .notNull()
      .references(() => routeRuns.id, { onDelete: "cascade" }),
    routeId: varchar("route_id")
      .references(() => routes.id, { onDelete: "set null" }),
    createdByUserId: varchar("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestType: routeRequestTypeEnum("request_type").notNull(),
    studentId: varchar("student_id")
      .references(() => students.id, { onDelete: "set null" }),
    studentName: varchar("student_name"), // For unknown/unlisted students
    description: text("description"),
    status: routeRequestStatusEnum("status").notNull().default("OPEN"),
    priority: varchar("priority").default("normal"), // normal, urgent
    adminUserId: varchar("admin_user_id")
      .references(() => users.id, { onDelete: "set null" }),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_route_requests_run").on(table.routeRunId),
    index("idx_route_requests_route").on(table.routeId),
    index("idx_route_requests_status").on(table.status),
    index("idx_route_requests_created_by").on(table.createdByUserId),
  ]
);

export const insertRouteRequestSchema = createInsertSchema(routeRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRouteRequest = z.infer<typeof insertRouteRequestSchema>;
export type RouteRequest = typeof routeRequests.$inferSelect;

// ============ Stop Change Requests (Parent Pickup/Dropoff Changes) ============

export const stopChangeRequestStatusEnum = pgEnum("stop_change_request_status", [
  "pending",
  "approved", 
  "denied"
]);

export const stopChangeRequestTypeEnum = pgEnum("stop_change_request_type", [
  "pickup",
  "dropoff"
]);

export const stopChangeRequests = pgTable("stop_change_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  routeId: varchar("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  requestType: stopChangeRequestTypeEnum("request_type").notNull(),
  currentStopId: varchar("current_stop_id")
    .references(() => stops.id, { onDelete: "set null" }),
  requestedStopId: varchar("requested_stop_id")
    .notNull()
    .references(() => stops.id, { onDelete: "cascade" }),
  effectiveDate: date("effective_date").notNull(),
  reason: text("reason"),
  status: stopChangeRequestStatusEnum("status").notNull().default("pending"),
  requestedByUserId: varchar("requested_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reviewedByUserId: varchar("reviewed_by_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const insertStopChangeRequestSchema = createInsertSchema(stopChangeRequests).omit({
  id: true,
  status: true,
  reviewedByUserId: true,
  reviewNotes: true,
  createdAt: true,
  reviewedAt: true,
});

export type InsertStopChangeRequest = z.infer<typeof insertStopChangeRequestSchema>;
export type StopChangeRequest = typeof stopChangeRequests.$inferSelect;

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
  
  // ===== PRE-TRIP INSPECTION ITEMS (true = OK/verified, false = issue found) =====
  // Lights
  headTailBrakeLightsOk: boolean("head_tail_brake_lights_ok"),
  turnSignalHazardOk: boolean("turn_signal_hazard_ok"),
  interiorLightsOk: boolean("interior_lights_ok"),
  // Tires & Undercarriage
  tiresOk: boolean("tires_ok"),
  undercarriageLeaksOk: boolean("undercarriage_leaks_ok"),
  // Windshield & Windows
  windshieldWipersFluidOk: boolean("windshield_wipers_fluid_ok"),
  windshieldConditionOk: boolean("windshield_condition_ok"),
  // Mirrors & Exterior
  mirrorsOk: boolean("mirrors_ok"),
  newBodyDamage: boolean("new_body_damage"), // true = damage found
  doorsConditionOk: boolean("doors_condition_ok"),
  // Interior
  driverPassengerAreaOk: boolean("driver_passenger_area_ok"),
  gaugesSwitchesControlsOk: boolean("gauges_switches_controls_ok"),
  acPerformanceOk: boolean("ac_performance_ok"),
  heatPerformanceOk: boolean("heat_performance_ok"),
  backSeatConditionOk: boolean("back_seat_condition_ok"),
  seatbeltsOk: boolean("seatbelts_ok"),
  // Safety Equipment
  emergencyEquipmentOk: boolean("emergency_equipment_ok"), // fire extinguisher, triangles, first aid, seatbelt cutter
  
  // Legacy fields (kept for backward compatibility)
  lightsOk: boolean("lights_ok"),
  brakesOk: boolean("brakes_ok"),
  fluidLevelsOk: boolean("fluid_levels_ok"),
  interiorCleanOk: boolean("interior_clean_ok"),
  seatsOk: boolean("seats_ok"),
  
  // ===== POST-TRIP INSPECTION ITEMS =====
  cameraUnplugged: boolean("camera_unplugged"),
  trashRemoved: boolean("trash_removed"),
  newDamageFound: boolean("new_damage_found"), // true = new damage discovered
  headlightsPoweredOff: boolean("headlights_powered_off"),
  doorsLocked: boolean("doors_locked"),
  
  // ===== MILEAGE (required for both pre and post trip) =====
  beginningMileage: integer("beginning_mileage"),
  endingMileage: integer("ending_mileage"),
  odometerReading: integer("odometer_reading"), // Legacy field
  
  // ===== OPTIONAL FIELDS =====
  fuelLevel: varchar("fuel_level"), // EMPTY, QUARTER, HALF, THREE_QUARTER, FULL
  issues: text("issues"), // Description of any issues found
  itemComments: text("item_comments"), // JSON string for per-item comments
  
  // ===== FLAGS =====
  hasIssues: boolean("has_issues").default(false), // Quick flag for admin alerting
  
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

// Audience type for announcements
export const announcementAudienceTypeEnum = pgEnum("announcement_audience_type", [
  "ORG_ALL",
  "ROLE_DRIVERS", 
  "ROLE_PARENTS",
  "ROUTE_DRIVERS",
  "ROUTE_PARENTS",
]);

// Announcements table - broadcast messages from admins
export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  targetRole: userRoleEnum("target_role").notNull(), // 'driver' or 'parent' - kept for backwards compatibility
  audienceType: announcementAudienceTypeEnum("audience_type").default("ROLE_DRIVERS"),
  routeId: varchar("route_id").references(() => routes.id, { onDelete: "set null" }),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  expiresAt: timestamp("expires_at"),
  targetCount: integer("target_count").default(0),
  pushAttemptedAt: timestamp("push_attempted_at"),
  pushSuccessCount: integer("push_success_count").default(0),
  pushFailureCount: integer("push_failure_count").default(0),
  lastPushError: text("last_push_error"),
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
  studentId: varchar("student_id").references(() => students.id, {
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
  "ROUTE_REQUEST_CREATED",
  "ROUTE_REQUEST_UPDATED",
  "STOP_CHANGE_APPROVED",
  "STOP_CHANGE_DENIED",
  "STUDENT_REMOVED_FROM_ROUTE",
  "FORCE_CLOCK_OUT",
]);

// Audit log entity enum - tracks what type of entity was affected
export const auditEntityEnum = pgEnum("audit_entity", [
  "student",
  "attendance",
  "incident",
  "profile",
  "user",
  "route_request",
  "stop_change_request",
  "student_route_assignment",
  "clock_event",
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

// ============ Admin Acknowledgements Table ============
// Tracks which items admins have reviewed/acknowledged for badge clearing
export const adminAcknowledgementEntityTypeEnum = pgEnum("ack_entity_type", [
  "AUDIT_LOG",
  "FLAGGED_CHECKLIST",
  "TIME_EXCEPTION",
  "INCIDENT",
  "SUPPLY_REQUEST",
  "DRIVER_FEEDBACK",
]);

export const adminAcknowledgements = pgTable("admin_acknowledgements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  entityType: adminAcknowledgementEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  acknowledgedAt: timestamp("acknowledged_at").defaultNow(),
}, (table) => [
  index("idx_ack_admin_entity").on(table.adminUserId, table.entityType, table.entityId),
  index("idx_ack_entity").on(table.entityType, table.entityId),
]);

export const insertAdminAcknowledgementSchema = createInsertSchema(adminAcknowledgements).omit({
  id: true,
  acknowledgedAt: true,
});

export type InsertAdminAcknowledgement = z.infer<typeof insertAdminAcknowledgementSchema>;
export type AdminAcknowledgement = typeof adminAcknowledgements.$inferSelect;

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

// ============ Payroll Export Tables (BambooHR Integration) ============

// Payroll export status enum
export const payrollExportStatusEnum = pgEnum("payroll_export_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

// Payroll exports table - tracks each export run to BambooHR
export const payrollExports = pgTable("payroll_exports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  exportedBy: varchar("exported_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: payrollExportStatusEnum("status").notNull().default("pending"),
  totalDrivers: integer("total_drivers").notNull().default(0),
  totalHours: decimal("total_hours", { precision: 10, scale: 2 }),
  bambooResponse: jsonb("bamboo_response"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertPayrollExportSchema = createInsertSchema(payrollExports).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertPayrollExport = z.infer<typeof insertPayrollExportSchema>;
export type PayrollExport = typeof payrollExports.$inferSelect;

// Payroll export entries table - individual time entries per driver
export const payrollExportEntries = pgTable("payroll_export_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  exportId: varchar("export_id")
    .notNull()
    .references(() => payrollExports.id, { onDelete: "cascade" }),
  driverId: varchar("driver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bambooEmployeeId: varchar("bamboo_employee_id").notNull(),
  date: timestamp("date").notNull(),
  regularHours: decimal("regular_hours", { precision: 10, scale: 2 }).notNull(),
  overtimeHours: decimal("overtime_hours", { precision: 10, scale: 2 }),
  doubleTimeHours: decimal("double_time_hours", { precision: 10, scale: 2 }),
  totalHours: decimal("total_hours", { precision: 10, scale: 2 }).notNull(),
  shiftIds: text("shift_ids").array(),
  notes: text("notes"),
  bambooEntryId: varchar("bamboo_entry_id"),
  status: payrollExportStatusEnum("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPayrollExportEntrySchema = createInsertSchema(
  payrollExportEntries
).omit({
  id: true,
  createdAt: true,
});

export type InsertPayrollExportEntry = z.infer<
  typeof insertPayrollExportEntrySchema
>;
export type PayrollExportEntry = typeof payrollExportEntries.$inferSelect;

// Payroll calculation result type
export interface PayrollCalculationResult {
  driverId: string;
  driverName: string;
  bambooEmployeeId: string | null;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  totalHours: number;
  breakMinutes: number;
  shiftIds: string[];
  shiftsCount: number;
  dateRange: {
    start: string;
    end: string;
  };
}

// ============ Timesheet System (BambooHR Payroll Integration) ============

// Pay period status enum
export const payPeriodStatusEnum = pgEnum("pay_period_status", [
  "OPEN",      // Period is open for clock events
  "LOCKED",    // Period is locked for review (no more clock events)
  "APPROVED",  // Entries approved by admin
  "EXPORTED",  // Successfully exported to BambooHR
]);

// Time entry status enum  
export const timeEntryStatusEnum = pgEnum("time_entry_status", [
  "DRAFT",     // Missing clock-out or needs review
  "READY",     // Complete and ready for approval
  "APPROVED",  // Approved by admin
  "EXPORTED",  // Exported to BambooHR
]);

// Time entry source enum
export const timeEntrySourceEnum = pgEnum("time_entry_source", [
  "CLOCK",       // Derived from clock events
  "ADMIN_EDIT",  // Created/edited by admin
  "IMPORT",      // Imported from external source
]);

// Pay periods table - tracks biweekly pay periods
export const payPeriods = pgTable("pay_periods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: payPeriodStatusEnum("status").notNull().default("OPEN"),
  lockedAt: timestamp("locked_at"),
  lockedBy: varchar("locked_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  exportScheduledAt: timestamp("export_scheduled_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  dateRangeIdx: index("idx_pay_periods_date_range").on(table.startDate, table.endDate),
  statusIdx: index("idx_pay_periods_status").on(table.status),
}));

export const insertPayPeriodSchema = createInsertSchema(payPeriods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPayPeriod = z.infer<typeof insertPayPeriodSchema>;
export type PayPeriod = typeof payPeriods.$inferSelect;

// Timesheet entries table - durable time records derived from clock events
export const timesheetEntries = pgTable("timesheet_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  payPeriodId: varchar("pay_period_id")
    .references(() => payPeriods.id, { onDelete: "set null" }),
  startAtUtc: timestamp("start_at_utc").notNull(),
  endAtUtc: timestamp("end_at_utc"),  // Nullable while clock-out is missing
  breakMinutes: integer("break_minutes").default(0),
  status: timeEntryStatusEnum("status").notNull().default("DRAFT"),
  source: timeEntrySourceEnum("source").notNull().default("CLOCK"),
  shiftId: varchar("shift_id").references(() => shifts.id, { onDelete: "set null" }),
  routeRunId: varchar("route_run_id"),  // Optional link to route run
  notes: text("notes"),
  // Calculated fields for quick access
  regularHours: decimal("regular_hours", { precision: 10, scale: 2 }),
  overtimeHours: decimal("overtime_hours", { precision: 10, scale: 2 }),
  doubleTimeHours: decimal("double_time_hours", { precision: 10, scale: 2 }),
  totalHours: decimal("total_hours", { precision: 10, scale: 2 }),
  // Tracking
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  driverPayPeriodIdx: index("idx_timesheet_entries_driver_period").on(table.driverId, table.payPeriodId),
  startAtIdx: index("idx_timesheet_entries_start").on(table.startAtUtc),
  statusIdx: index("idx_timesheet_entries_status").on(table.status),
  shiftIdx: index("idx_timesheet_entries_shift").on(table.shiftId),
}));

export const insertTimesheetEntrySchema = createInsertSchema(timesheetEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTimesheetEntry = z.infer<typeof insertTimesheetEntrySchema>;
export type TimesheetEntry = typeof timesheetEntries.$inferSelect;

// Timesheet entry edits - audit trail for all changes
export const timesheetEntryEdits = pgTable("timesheet_entry_edits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timesheetEntryId: varchar("timesheet_entry_id")
    .notNull()
    .references(() => timesheetEntries.id, { onDelete: "cascade" }),
  editorUserId: varchar("editor_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  previousValues: jsonb("previous_values").notNull(),  // Snapshot of fields before edit
  newValues: jsonb("new_values").notNull(),  // Snapshot of fields after edit
  reason: text("reason").notNull(),  // Required explanation for the edit
  editType: varchar("edit_type").notNull().default("UPDATE"),  // UPDATE, CREATE, APPROVE, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTimesheetEntryEditSchema = createInsertSchema(timesheetEntryEdits).omit({
  id: true,
  createdAt: true,
});

export type InsertTimesheetEntryEdit = z.infer<typeof insertTimesheetEntryEditSchema>;
export type TimesheetEntryEdit = typeof timesheetEntryEdits.$inferSelect;

// BambooHR employee mapping - maps internal users to Bamboo employee IDs
export const bambooEmployeeMap = pgTable("bamboo_employee_map", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bambooEmployeeId: varchar("bamboo_employee_id").notNull(),
  effectiveFrom: date("effective_from"),  // When this mapping became active
  effectiveTo: date("effective_to"),  // When this mapping ended (null = current)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_bamboo_employee_map_user").on(table.userId),
  bambooIdIdx: index("idx_bamboo_employee_map_bamboo").on(table.bambooEmployeeId),
  activeIdx: index("idx_bamboo_employee_map_active").on(table.isActive),
}));

export const insertBambooEmployeeMapSchema = createInsertSchema(bambooEmployeeMap).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBambooEmployeeMap = z.infer<typeof insertBambooEmployeeMapSchema>;
export type BambooEmployeeMap = typeof bambooEmployeeMap.$inferSelect;

// Payroll export job status enum
export const payrollExportJobStatusEnum = pgEnum("payroll_export_job_status", [
  "QUEUED",     // Job created, waiting to run
  "RUNNING",    // Currently processing
  "SUCCESS",    // All entries exported successfully
  "PARTIAL",    // Some entries failed
  "FAILED",     // Export failed completely
]);

// Payroll export jobs table - tracks each export attempt
export const payrollExportJobs = pgTable("payroll_export_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  payPeriodId: varchar("pay_period_id")
    .notNull()
    .references(() => payPeriods.id, { onDelete: "cascade" }),
  status: payrollExportJobStatusEnum("status").notNull().default("QUEUED"),
  mode: varchar("mode").notNull().default("MANUAL"),  // MANUAL or SCHEDULED
  requestedByUserId: varchar("requested_by_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  scheduledFor: timestamp("scheduled_for"),  // For scheduled exports
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  totalEntries: integer("total_entries").default(0),
  successfulEntries: integer("successful_entries").default(0),
  failedEntries: integer("failed_entries").default(0),
  errorSummary: text("error_summary"),
  bambooResponse: jsonb("bamboo_response"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  payPeriodIdx: index("idx_payroll_export_jobs_period").on(table.payPeriodId),
  statusIdx: index("idx_payroll_export_jobs_status").on(table.status),
  scheduledIdx: index("idx_payroll_export_jobs_scheduled").on(table.scheduledFor),
}));

export const insertPayrollExportJobSchema = createInsertSchema(payrollExportJobs).omit({
  id: true,
  createdAt: true,
});

export type InsertPayrollExportJob = z.infer<typeof insertPayrollExportJobSchema>;
export type PayrollExportJob = typeof payrollExportJobs.$inferSelect;

// Payroll export job entries - individual entries per employee/date
export const payrollExportJobEntries = pgTable("payroll_export_job_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id")
    .notNull()
    .references(() => payrollExportJobs.id, { onDelete: "cascade" }),
  timesheetEntryId: varchar("timesheet_entry_id")
    .references(() => timesheetEntries.id, { onDelete: "set null" }),
  driverId: varchar("driver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bambooEmployeeId: varchar("bamboo_employee_id").notNull(),
  date: date("date").notNull(),
  regularHours: decimal("regular_hours", { precision: 10, scale: 2 }).notNull(),
  overtimeHours: decimal("overtime_hours", { precision: 10, scale: 2 }).default("0"),
  doubleTimeHours: decimal("double_time_hours", { precision: 10, scale: 2 }).default("0"),
  totalHours: decimal("total_hours", { precision: 10, scale: 2 }).notNull(),
  payloadJson: jsonb("payload_json"),  // What was sent to Bamboo
  bambooResponseJson: jsonb("bamboo_response_json"),  // Response from Bamboo
  bambooEntryId: varchar("bamboo_entry_id"),  // ID returned by Bamboo
  idempotencyKey: varchar("idempotency_key").notNull(),  // Prevent duplicate exports
  status: payrollExportJobStatusEnum("status").notNull().default("QUEUED"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  jobIdx: index("idx_payroll_export_job_entries_job").on(table.jobId),
  idempotencyIdx: index("idx_payroll_export_job_entries_idempotency").on(table.idempotencyKey),
  driverDateIdx: index("idx_payroll_export_job_entries_driver_date").on(table.driverId, table.date),
}));

export const insertPayrollExportJobEntrySchema = createInsertSchema(payrollExportJobEntries).omit({
  id: true,
  createdAt: true,
});

export type InsertPayrollExportJobEntry = z.infer<typeof insertPayrollExportJobEntrySchema>;
export type PayrollExportJobEntry = typeof payrollExportJobEntries.$inferSelect;

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
  timesheetEntries: many(timesheetEntries),
  vehicleInspections: many(vehicleInspections),
  deviceTokens: many(deviceTokens),
  bambooMappings: many(bambooEmployeeMap),
}));

// Timesheet system relations
export const payPeriodsRelations = relations(payPeriods, ({ one, many }) => ({
  lockedByUser: one(users, {
    fields: [payPeriods.lockedBy],
    references: [users.id],
    relationName: "payPeriodLockedBy",
  }),
  approvedByUser: one(users, {
    fields: [payPeriods.approvedBy],
    references: [users.id],
    relationName: "payPeriodApprovedBy",
  }),
  timesheetEntries: many(timesheetEntries),
  exportJobs: many(payrollExportJobs),
}));

export const timesheetEntriesRelations = relations(timesheetEntries, ({ one, many }) => ({
  driver: one(users, {
    fields: [timesheetEntries.driverId],
    references: [users.id],
  }),
  payPeriod: one(payPeriods, {
    fields: [timesheetEntries.payPeriodId],
    references: [payPeriods.id],
  }),
  shift: one(shifts, {
    fields: [timesheetEntries.shiftId],
    references: [shifts.id],
  }),
  edits: many(timesheetEntryEdits),
  exportEntries: many(payrollExportJobEntries),
}));

export const timesheetEntryEditsRelations = relations(timesheetEntryEdits, ({ one }) => ({
  timesheetEntry: one(timesheetEntries, {
    fields: [timesheetEntryEdits.timesheetEntryId],
    references: [timesheetEntries.id],
  }),
  editor: one(users, {
    fields: [timesheetEntryEdits.editorUserId],
    references: [users.id],
  }),
}));

export const bambooEmployeeMapRelations = relations(bambooEmployeeMap, ({ one }) => ({
  user: one(users, {
    fields: [bambooEmployeeMap.userId],
    references: [users.id],
  }),
}));

export const payrollExportJobsRelations = relations(payrollExportJobs, ({ one, many }) => ({
  payPeriod: one(payPeriods, {
    fields: [payrollExportJobs.payPeriodId],
    references: [payPeriods.id],
  }),
  requestedBy: one(users, {
    fields: [payrollExportJobs.requestedByUserId],
    references: [users.id],
  }),
  entries: many(payrollExportJobEntries),
}));

export const payrollExportJobEntriesRelations = relations(payrollExportJobEntries, ({ one }) => ({
  job: one(payrollExportJobs, {
    fields: [payrollExportJobEntries.jobId],
    references: [payrollExportJobs.id],
  }),
  timesheetEntry: one(timesheetEntries, {
    fields: [payrollExportJobEntries.timesheetEntryId],
    references: [timesheetEntries.id],
  }),
  driver: one(users, {
    fields: [payrollExportJobEntries.driverId],
    references: [users.id],
  }),
}));

export const deviceTokensRelations = relations(deviceTokens, ({ one }) => ({
  user: one(users, {
    fields: [deviceTokens.userId],
    references: [users.id],
  }),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  driver: one(users, {
    fields: [vehicles.driverId],
    references: [users.id],
  }),
  shifts: many(shifts),
  incidents: many(incidents),
  inspections: many(vehicleInspections),
}));

export const routeGroupsRelations = relations(routeGroups, ({ many }) => ({
  routes: many(routes),
}));

export const routesRelations = relations(routes, ({ one, many }) => ({
  group: one(routeGroups, {
    fields: [routes.groupId],
    references: [routeGroups.id],
  }),
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

// ============ RouteRun Relations ============

export const routeRunsRelations = relations(routeRuns, ({ one, many }) => ({
  route: one(routes, {
    fields: [routeRuns.routeId],
    references: [routes.id],
  }),
  primaryDriver: one(users, {
    fields: [routeRuns.primaryDriverId],
    references: [users.id],
  }),
  vehicle: one(vehicles, {
    fields: [routeRuns.vehicleId],
    references: [vehicles.id],
  }),
  participants: many(routeRunParticipants),
  events: many(routeRunEvents),
}));

export const routeRunParticipantsRelations = relations(routeRunParticipants, ({ one }) => ({
  routeRun: one(routeRuns, {
    fields: [routeRunParticipants.routeRunId],
    references: [routeRuns.id],
  }),
  user: one(users, {
    fields: [routeRunParticipants.userId],
    references: [users.id],
  }),
}));

export const routeRunEventsRelations = relations(routeRunEvents, ({ one }) => ({
  routeRun: one(routeRuns, {
    fields: [routeRunEvents.routeRunId],
    references: [routeRuns.id],
  }),
  actor: one(users, {
    fields: [routeRunEvents.actorUserId],
    references: [users.id],
  }),
}));

export const attendanceChangeLogsRelations = relations(attendanceChangeLogs, ({ one }) => ({
  routeRun: one(routeRuns, {
    fields: [attendanceChangeLogs.routeRunId],
    references: [routeRuns.id],
  }),
  student: one(students, {
    fields: [attendanceChangeLogs.studentId],
    references: [students.id],
  }),
  actor: one(users, {
    fields: [attendanceChangeLogs.actorUserId],
    references: [users.id],
  }),
}));

export const stopChangeRequestsRelations = relations(stopChangeRequests, ({ one }) => ({
  student: one(students, {
    fields: [stopChangeRequests.studentId],
    references: [students.id],
  }),
  route: one(routes, {
    fields: [stopChangeRequests.routeId],
    references: [routes.id],
  }),
  currentStop: one(stops, {
    fields: [stopChangeRequests.currentStopId],
    references: [stops.id],
    relationName: "currentStop",
  }),
  requestedStop: one(stops, {
    fields: [stopChangeRequests.requestedStopId],
    references: [stops.id],
    relationName: "requestedStop",
  }),
  requestedBy: one(users, {
    fields: [stopChangeRequests.requestedByUserId],
    references: [users.id],
    relationName: "stopChangeRequester",
  }),
  reviewedBy: one(users, {
    fields: [stopChangeRequests.reviewedByUserId],
    references: [users.id],
    relationName: "stopChangeReviewer",
  }),
}));

export const routeRequestsRelations = relations(routeRequests, ({ one }) => ({
  routeRun: one(routeRuns, {
    fields: [routeRequests.routeRunId],
    references: [routeRuns.id],
  }),
  route: one(routes, {
    fields: [routeRequests.routeId],
    references: [routes.id],
  }),
  createdBy: one(users, {
    fields: [routeRequests.createdByUserId],
    references: [users.id],
    relationName: "requestCreator",
  }),
  student: one(students, {
    fields: [routeRequests.studentId],
    references: [students.id],
  }),
  admin: one(users, {
    fields: [routeRequests.adminUserId],
    references: [users.id],
    relationName: "requestAdmin",
  }),
}));

// ============ Color Mapping System ============

// Route color configuration for consistent styling across admin and driver interfaces
// Color fallback strategy: Route's own color takes precedence; if null, inherit from group color
export const ROUTE_COLORS = {
  tan: {
    borderColor: "border-l-amber-600",
    bgColor: "bg-amber-600",
    hex: "#D2B48C",
  },
  red: {
    borderColor: "border-l-red-600",
    bgColor: "bg-red-600",
    hex: "#EF4444",
  },
  blue: {
    borderColor: "border-l-blue-600",
    bgColor: "bg-blue-600",
    hex: "#3B82F6",
  },
  orange: {
    borderColor: "border-l-orange-600",
    bgColor: "bg-orange-600",
    hex: "#F97316",
  },
  yellow: {
    borderColor: "border-l-yellow-600",
    bgColor: "bg-yellow-600",
    hex: "#EAB308",
  },
  purple: {
    borderColor: "border-l-purple-600",
    bgColor: "bg-purple-600",
    hex: "#A855F7",
  },
  green: {
    borderColor: "border-l-green-600",
    bgColor: "bg-green-600",
    hex: "#22C55E",
  },
  gray: {
    borderColor: "border-l-gray-400",
    bgColor: "bg-gray-400",
    hex: "#6B7280",
  },
  teal: {
    borderColor: "border-l-teal-600",
    bgColor: "bg-teal-600",
    hex: "#14B8A6",
  },
  gold: {
    borderColor: "border-l-yellow-500",
    bgColor: "bg-yellow-500",
    hex: "#FFD700",
  },
  pink: {
    borderColor: "border-l-pink-600",
    bgColor: "bg-pink-600",
    hex: "#EC4899",
  },
  maroon: {
    borderColor: "border-l-red-900",
    bgColor: "bg-red-900",
    hex: "#800000",
  },
} as const;

export type RouteColor = keyof typeof ROUTE_COLORS;
