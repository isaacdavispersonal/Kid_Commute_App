CREATE TYPE "public"."ack_entity_type" AS ENUM('AUDIT_LOG', 'FLAGGED_CHECKLIST', 'TIME_EXCEPTION', 'INCIDENT', 'SUPPLY_REQUEST', 'DRIVER_FEEDBACK');--> statement-breakpoint
CREATE TYPE "public"."announcement_audience_type" AS ENUM('ORG_ALL', 'ROLE_DRIVERS', 'ROLE_PARENTS', 'ROUTE_DRIVERS', 'ROUTE_PARENTS');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('PENDING', 'riding', 'absent');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('created', 'updated', 'deleted', 'marked_attendance', 'reported_incident', 'updated_profile', 'changed_phone', 'updated_student', 'ROUTE_REQUEST_CREATED', 'ROUTE_REQUEST_UPDATED', 'STOP_CHANGE_APPROVED', 'STOP_CHANGE_DENIED', 'STUDENT_REMOVED_FROM_ROUTE', 'FORCE_CLOCK_OUT');--> statement-breakpoint
CREATE TYPE "public"."audit_entity" AS ENUM('student', 'attendance', 'incident', 'profile', 'user', 'route_request', 'stop_change_request', 'student_route_assignment', 'clock_event');--> statement-breakpoint
CREATE TYPE "public"."checklist_type" AS ENUM('PRE_TRIP', 'POST_TRIP');--> statement-breakpoint
CREATE TYPE "public"."clock_event_source" AS ENUM('USER', 'AUTO', 'ADMIN_EDIT', 'AUTO_CLOCKOUT');--> statement-breakpoint
CREATE TYPE "public"."clock_event_type" AS ENUM('IN', 'OUT', 'BREAK_START', 'BREAK_END');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TYPE "public"."dwell_session_status" AS ENUM('ACTIVE', 'COMPLETED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."feedback_category" AS ENUM('UI_ISSUE', 'FEATURE_REQUEST', 'BUG_REPORT', 'GENERAL');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('NEW', 'REVIEWING', 'PLANNED', 'COMPLETED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."geofence_event_type" AS ENUM('ENTRY', 'EXIT');--> statement-breakpoint
CREATE TYPE "public"."geofence_type" AS ENUM('SCHOOL', 'CUSTOM', 'STOP');--> statement-breakpoint
CREATE TYPE "public"."household_role" AS ENUM('PRIMARY', 'SECONDARY');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('pending', 'reviewed', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."pay_period_status" AS ENUM('OPEN', 'LOCKED', 'APPROVED', 'EXPORTED');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('quickbooks', 'classwallet');--> statement-breakpoint
CREATE TYPE "public"."payroll_export_job_status" AS ENUM('QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."payroll_export_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ride_event_type" AS ENUM('BOARD', 'DEBOARD');--> statement-breakpoint
CREATE TYPE "public"."route_color" AS ENUM('tan', 'red', 'blue', 'orange', 'yellow', 'purple', 'green', 'gray', 'teal', 'gold', 'pink', 'maroon');--> statement-breakpoint
CREATE TYPE "public"."route_request_status" AS ENUM('OPEN', 'APPROVED', 'DENIED', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."route_request_type" AS ENUM('MISSING_STUDENT', 'UNEXPECTED_STUDENT', 'WRONG_STOP', 'ROSTER_CLARIFICATION');--> statement-breakpoint
CREATE TYPE "public"."route_run_event_type" AS ENUM('RUN_CREATED', 'RUN_STARTED', 'RUN_ENDED', 'RUN_FINALIZED', 'RUN_REOPENED', 'RUN_CANCELLED', 'PARTICIPANT_JOINED', 'PARTICIPANT_LEFT', 'PARTICIPANT_ROLE_CHANGED', 'STOP_ARRIVED', 'STOP_COMPLETED', 'STOP_SKIPPED', 'ATTENDANCE_UPDATED', 'STUDENT_BOARDED', 'STUDENT_DEBOARDED');--> statement-breakpoint
CREATE TYPE "public"."route_run_participant_role" AS ENUM('PRIMARY', 'AID', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."route_run_status" AS ENUM('SCHEDULED', 'ACTIVE', 'ENDED_PENDING_REVIEW', 'FINALIZED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."route_type" AS ENUM('MORNING', 'AFTERNOON', 'EXTRA');--> statement-breakpoint
CREATE TYPE "public"."schedule_pattern" AS ENUM('WEEKDAYS', 'DAILY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."service_day_override_type" AS ENUM('FORCE_RIDING', 'FORCE_NOT_RIDING');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('SCHEDULED', 'ACTIVE', 'COMPLETED', 'MISSED');--> statement-breakpoint
CREATE TYPE "public"."shift_type" AS ENUM('MORNING', 'AFTERNOON', 'EXTRA');--> statement-breakpoint
CREATE TYPE "public"."stop_change_request_status" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TYPE "public"."stop_change_request_type" AS ENUM('pickup', 'dropoff');--> statement-breakpoint
CREATE TYPE "public"."stop_status" AS ENUM('PENDING', 'COMPLETED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."supplies_request_status" AS ENUM('PENDING', 'APPROVED', 'ORDERED', 'DELIVERED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."time_entry_source" AS ENUM('CLOCK', 'ADMIN_EDIT', 'IMPORT');--> statement-breakpoint
CREATE TYPE "public"."time_entry_status" AS ENUM('DRAFT', 'READY', 'APPROVED', 'EXPORTED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'driver', 'parent');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('active', 'maintenance', 'offline');--> statement-breakpoint
CREATE TABLE "admin_acknowledgements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" varchar NOT NULL,
	"entity_type" "ack_entity_type" NOT NULL,
	"entity_id" varchar NOT NULL,
	"acknowledged_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setting_key" varchar NOT NULL,
	"setting_value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" varchar,
	CONSTRAINT "admin_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "announcement_dismissals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "announcement_reads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" varchar NOT NULL,
	"target_role" "user_role" NOT NULL,
	"audience_type" "announcement_audience_type" DEFAULT 'ROLE_DRIVERS',
	"route_id" varchar,
	"title" varchar NOT NULL,
	"content" text NOT NULL,
	"expires_at" timestamp,
	"target_count" integer DEFAULT 0,
	"push_attempted_at" timestamp,
	"push_success_count" integer DEFAULT 0,
	"push_failure_count" integer DEFAULT 0,
	"last_push_error" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attendance_change_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_run_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"actor_user_id" varchar NOT NULL,
	"old_value_json" jsonb NOT NULL,
	"new_value_json" jsonb NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"user_role" "user_role" NOT NULL,
	"action" "audit_action" NOT NULL,
	"entity_type" "audit_entity" NOT NULL,
	"entity_id" varchar,
	"description" text NOT NULL,
	"changes" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth_credentials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"email" varchar,
	"phone" varchar,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp,
	"last_login_at" timestamp,
	"password_updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "auth_credentials_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "auth_credentials_email_unique" UNIQUE("email"),
	CONSTRAINT "auth_credentials_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "bamboo_employee_map" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"bamboo_employee_id" varchar NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clock_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" varchar NOT NULL,
	"shift_id" varchar,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"type" "clock_event_type" NOT NULL,
	"source" "clock_event_source" DEFAULT 'USER' NOT NULL,
	"notes" text,
	"is_resolved" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"platform" "device_platform" NOT NULL,
	"token" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"device_model" varchar,
	"os_version" varchar,
	"app_version" varchar,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_failure_at" timestamp,
	"deactivated_at" timestamp,
	"last_used_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "device_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "driver_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" varchar NOT NULL,
	"route_id" varchar NOT NULL,
	"vehicle_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "driver_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" varchar NOT NULL,
	"category" "feedback_category" NOT NULL,
	"subject" varchar NOT NULL,
	"description" text NOT NULL,
	"status" "feedback_status" DEFAULT 'NEW' NOT NULL,
	"admin_response" text,
	"responded_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "driver_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" varchar NOT NULL,
	"conversation_id" varchar NOT NULL,
	"message_id" varchar NOT NULL,
	"parent_id" varchar NOT NULL,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"email" varchar NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "email_verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "geofence_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"geofence_id" varchar NOT NULL,
	"shift_id" varchar,
	"event_type" "geofence_event_type" NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "geofences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"type" "geofence_type" NOT NULL,
	"center_lat" numeric(10, 7) NOT NULL,
	"center_lng" numeric(10, 7) NOT NULL,
	"radius_meters" integer NOT NULL,
	"schedule_start_time" varchar,
	"schedule_end_time" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role_in_household" "household_role" DEFAULT 'PRIMARY' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primary_phone" varchar,
	"is_placeholder" boolean DEFAULT false NOT NULL,
	"placeholder_source" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "households_primary_phone_unique" UNIQUE("primary_phone")
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" varchar NOT NULL,
	"vehicle_id" varchar,
	"route_id" varchar,
	"student_id" varchar,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"severity" "incident_severity" NOT NULL,
	"status" "incident_status" DEFAULT 'pending' NOT NULL,
	"location" varchar,
	"photo_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" varchar NOT NULL,
	"recipient_id" varchar NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"forwarded_from_conversation_id" varchar,
	"forwarded_by_admin_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "pay_periods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "pay_period_status" DEFAULT 'OPEN' NOT NULL,
	"locked_at" timestamp,
	"locked_by" varchar,
	"approved_at" timestamp,
	"approved_by" varchar,
	"export_scheduled_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_portals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"portal_url" text NOT NULL,
	"display_name" varchar NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "payment_portals_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "payroll_export_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"export_id" varchar NOT NULL,
	"driver_id" varchar NOT NULL,
	"bamboo_employee_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"regular_hours" numeric(10, 2) NOT NULL,
	"overtime_hours" numeric(10, 2),
	"double_time_hours" numeric(10, 2),
	"total_hours" numeric(10, 2) NOT NULL,
	"shift_ids" text[],
	"notes" text,
	"bamboo_entry_id" varchar,
	"status" "payroll_export_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payroll_export_job_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"timesheet_entry_id" varchar,
	"driver_id" varchar NOT NULL,
	"bamboo_employee_id" varchar NOT NULL,
	"date" date NOT NULL,
	"regular_hours" numeric(10, 2) NOT NULL,
	"overtime_hours" numeric(10, 2) DEFAULT '0',
	"double_time_hours" numeric(10, 2) DEFAULT '0',
	"total_hours" numeric(10, 2) NOT NULL,
	"payload_json" jsonb,
	"bamboo_response_json" jsonb,
	"bamboo_entry_id" varchar,
	"idempotency_key" varchar NOT NULL,
	"status" "payroll_export_job_status" DEFAULT 'QUEUED' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payroll_export_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pay_period_id" varchar NOT NULL,
	"status" "payroll_export_job_status" DEFAULT 'QUEUED' NOT NULL,
	"mode" varchar DEFAULT 'MANUAL' NOT NULL,
	"requested_by_user_id" varchar,
	"scheduled_for" timestamp,
	"started_at" timestamp,
	"finished_at" timestamp,
	"total_entries" integer DEFAULT 0,
	"successful_entries" integer DEFAULT 0,
	"failed_entries" integer DEFAULT 0,
	"error_summary" text,
	"bamboo_response" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payroll_exports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exported_by" varchar NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" "payroll_export_status" DEFAULT 'pending' NOT NULL,
	"total_drivers" integer DEFAULT 0 NOT NULL,
	"total_hours" numeric(10, 2),
	"bamboo_response" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "route_announcement_dismissals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_announcement_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "route_announcement_reads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_announcement_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "route_announcements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" varchar NOT NULL,
	"route_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "route_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"color" "route_color",
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "route_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" varchar NOT NULL,
	"route_stop_id" varchar NOT NULL,
	"status" "stop_status" DEFAULT 'PENDING' NOT NULL,
	"completed_at" timestamp,
	"notes" text,
	"auto_completed" boolean DEFAULT false NOT NULL,
	"dwell_session_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "route_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_run_id" varchar NOT NULL,
	"route_id" varchar,
	"created_by_user_id" varchar NOT NULL,
	"request_type" "route_request_type" NOT NULL,
	"student_id" varchar,
	"student_name" varchar,
	"description" text,
	"status" "route_request_status" DEFAULT 'OPEN' NOT NULL,
	"priority" varchar DEFAULT 'normal',
	"admin_user_id" varchar,
	"resolution_note" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "route_run_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_run_id" varchar NOT NULL,
	"event_type" "route_run_event_type" NOT NULL,
	"actor_user_id" varchar,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "route_run_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_run_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" "route_run_participant_role" DEFAULT 'VIEWER' NOT NULL,
	"joined_at" timestamp DEFAULT now(),
	"left_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "route_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" varchar NOT NULL,
	"service_date" varchar NOT NULL,
	"shift_type" "shift_type" NOT NULL,
	"status" "route_run_status" DEFAULT 'SCHEDULED' NOT NULL,
	"primary_driver_id" varchar,
	"vehicle_id" varchar,
	"started_at" timestamp,
	"ended_at" timestamp,
	"finalized_at" timestamp,
	"start_mileage" integer,
	"end_mileage" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "route_stops" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" varchar NOT NULL,
	"stop_id" varchar NOT NULL,
	"stop_order" integer NOT NULL,
	"scheduled_time" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"route_type" "route_type",
	"color" "route_color",
	"group_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_assignment_id" varchar,
	"driver_id" varchar NOT NULL,
	"date" varchar NOT NULL,
	"shift_type" "shift_type" NOT NULL,
	"planned_start" varchar NOT NULL,
	"planned_end" varchar NOT NULL,
	"route_id" varchar,
	"vehicle_id" varchar,
	"status" "shift_status" DEFAULT 'SCHEDULED' NOT NULL,
	"notes" text,
	"inspection_completed_at" timestamp,
	"route_started_at" timestamp,
	"route_completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stop_change_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"route_id" varchar NOT NULL,
	"request_type" "stop_change_request_type" NOT NULL,
	"current_stop_id" varchar,
	"requested_stop_id" varchar NOT NULL,
	"effective_date" date NOT NULL,
	"reason" text,
	"status" "stop_change_request_status" DEFAULT 'pending' NOT NULL,
	"requested_by_user_id" varchar NOT NULL,
	"reviewed_by_user_id" varchar,
	"review_notes" text,
	"created_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "stops" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"address" text NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"geofence_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "student_attendance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"date" varchar NOT NULL,
	"shift_id" varchar,
	"route_run_id" varchar,
	"status" varchar DEFAULT 'PENDING' NOT NULL,
	"marked_by_user_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "student_ride_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" varchar NOT NULL,
	"route_run_id" varchar,
	"student_id" varchar NOT NULL,
	"planned_stop_id" varchar,
	"actual_stop_id" varchar NOT NULL,
	"event_type" "ride_event_type" NOT NULL,
	"recorded_at" timestamp DEFAULT now(),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "student_routes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"route_id" varchar NOT NULL,
	"pickup_stop_id" varchar,
	"dropoff_stop_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "student_service_day_overrides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"route_id" varchar NOT NULL,
	"shift_type" "shift_type" NOT NULL,
	"service_date" varchar NOT NULL,
	"override_type" "service_day_override_type" NOT NULL,
	"reason" text,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "student_service_days" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"route_id" varchar NOT NULL,
	"shift_type" "shift_type" NOT NULL,
	"service_days_bitmask" integer DEFAULT 31 NOT NULL,
	"effective_start_date" varchar,
	"effective_end_date" varchar,
	"updated_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" varchar,
	"guardian_phones" text[] NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"date_of_birth" varchar,
	"height_inches" integer,
	"race" varchar,
	"gender" varchar,
	"photo_url" varchar,
	"allergies" text,
	"medical_notes" text,
	"special_needs" text,
	"emergency_contact_name" varchar,
	"emergency_contact_phone" varchar,
	"emergency_contact_relation" varchar,
	"notes" text,
	"assigned_route_id" varchar,
	"pickup_stop_id" varchar,
	"dropoff_stop_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplies_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" varchar NOT NULL,
	"item_name" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"urgency" varchar NOT NULL,
	"reason" text,
	"status" "supplies_request_status" DEFAULT 'PENDING' NOT NULL,
	"admin_notes" text,
	"approved_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" varchar NOT NULL,
	"clock_in" timestamp NOT NULL,
	"clock_out" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "timesheet_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" varchar NOT NULL,
	"pay_period_id" varchar,
	"start_at_utc" timestamp NOT NULL,
	"end_at_utc" timestamp,
	"break_minutes" integer DEFAULT 0,
	"status" time_entry_status DEFAULT 'DRAFT' NOT NULL,
	"source" time_entry_source DEFAULT 'CLOCK' NOT NULL,
	"shift_id" varchar,
	"route_run_id" varchar,
	"notes" text,
	"regular_hours" numeric(10, 2),
	"overtime_hours" numeric(10, 2),
	"double_time_hours" numeric(10, 2),
	"total_hours" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "timesheet_entry_edits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timesheet_entry_id" varchar NOT NULL,
	"editor_user_id" varchar NOT NULL,
	"previous_values" jsonb NOT NULL,
	"new_values" jsonb NOT NULL,
	"reason" text NOT NULL,
	"edit_type" varchar DEFAULT 'UPDATE' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"phone" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" "user_role" DEFAULT 'parent' NOT NULL,
	"phone_number" varchar,
	"address" text,
	"is_lead_driver" boolean DEFAULT false NOT NULL,
	"bamboo_employee_id" varchar,
	"assigned_vehicle_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vehicle_checklists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" varchar NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"shift_id" varchar,
	"checklist_type" "checklist_type" NOT NULL,
	"head_tail_brake_lights_ok" boolean,
	"turn_signal_hazard_ok" boolean,
	"interior_lights_ok" boolean,
	"tires_ok" boolean,
	"undercarriage_leaks_ok" boolean,
	"windshield_wipers_fluid_ok" boolean,
	"windshield_condition_ok" boolean,
	"mirrors_ok" boolean,
	"new_body_damage" boolean,
	"doors_condition_ok" boolean,
	"driver_passenger_area_ok" boolean,
	"gauges_switches_controls_ok" boolean,
	"ac_performance_ok" boolean,
	"heat_performance_ok" boolean,
	"back_seat_condition_ok" boolean,
	"seatbelts_ok" boolean,
	"emergency_equipment_ok" boolean,
	"lights_ok" boolean,
	"brakes_ok" boolean,
	"fluid_levels_ok" boolean,
	"interior_clean_ok" boolean,
	"seats_ok" boolean,
	"camera_unplugged" boolean,
	"trash_removed" boolean,
	"new_damage_found" boolean,
	"headlights_powered_off" boolean,
	"doors_locked" boolean,
	"beginning_mileage" integer,
	"ending_mileage" integer,
	"odometer_reading" integer,
	"fuel_level" varchar,
	"issues" text,
	"item_comments" text,
	"has_issues" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vehicle_dwell_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"shift_id" varchar,
	"route_stop_id" varchar,
	"route_progress_id" varchar,
	"status" "dwell_session_status" DEFAULT 'ACTIVE' NOT NULL,
	"arrival_lat" numeric(10, 7) NOT NULL,
	"arrival_lng" numeric(10, 7) NOT NULL,
	"arrival_at" timestamp DEFAULT now() NOT NULL,
	"departure_lat" numeric(10, 7),
	"departure_lng" numeric(10, 7),
	"departure_at" timestamp,
	"dwell_duration_seconds" integer,
	"auto_completed_stop" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vehicle_geofence_state" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"geofence_id" varchar NOT NULL,
	"is_inside" boolean DEFAULT false NOT NULL,
	"last_transition_at" timestamp,
	"last_checked_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vehicle_inspections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"driver_id" varchar NOT NULL,
	"tires_ok" boolean NOT NULL,
	"lights_ok" boolean NOT NULL,
	"brakes_ok" boolean NOT NULL,
	"fluid_levels_ok" boolean NOT NULL,
	"cleanliness_ok" boolean NOT NULL,
	"notes" text,
	"photo_url" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"nickname" varchar,
	"plate_number" varchar NOT NULL,
	"capacity" integer NOT NULL,
	"status" "vehicle_status" DEFAULT 'active' NOT NULL,
	"driver_id" varchar,
	"current_lat" numeric(10, 7),
	"current_lng" numeric(10, 7),
	"current_speed_mph" numeric(5, 1),
	"current_heading_deg" numeric(5, 1),
	"last_location_update" timestamp,
	"samsara_vehicle_id" varchar,
	"samsara_last_sync" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "vehicles_plate_number_unique" UNIQUE("plate_number"),
	CONSTRAINT "vehicles_samsara_vehicle_id_unique" UNIQUE("samsara_vehicle_id")
);
--> statement-breakpoint
ALTER TABLE "admin_acknowledgements" ADD CONSTRAINT "admin_acknowledgements_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_settings" ADD CONSTRAINT "admin_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_dismissals" ADD CONSTRAINT "announcement_dismissals_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_dismissals" ADD CONSTRAINT "announcement_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_change_logs" ADD CONSTRAINT "attendance_change_logs_route_run_id_route_runs_id_fk" FOREIGN KEY ("route_run_id") REFERENCES "public"."route_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_change_logs" ADD CONSTRAINT "attendance_change_logs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_change_logs" ADD CONSTRAINT "attendance_change_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_credentials" ADD CONSTRAINT "auth_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bamboo_employee_map" ADD CONSTRAINT "bamboo_employee_map_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_feedback" ADD CONSTRAINT "driver_feedback_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_feedback" ADD CONSTRAINT "driver_feedback_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_notifications" ADD CONSTRAINT "driver_notifications_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_notifications" ADD CONSTRAINT "driver_notifications_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_notifications" ADD CONSTRAINT "driver_notifications_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofence_events" ADD CONSTRAINT "geofence_events_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofence_events" ADD CONSTRAINT "geofence_events_geofence_id_geofences_id_fk" FOREIGN KEY ("geofence_id") REFERENCES "public"."geofences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofence_events" ADD CONSTRAINT "geofence_events_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_forwarded_by_admin_id_users_id_fk" FOREIGN KEY ("forwarded_by_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_export_entries" ADD CONSTRAINT "payroll_export_entries_export_id_payroll_exports_id_fk" FOREIGN KEY ("export_id") REFERENCES "public"."payroll_exports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_export_entries" ADD CONSTRAINT "payroll_export_entries_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_export_job_entries" ADD CONSTRAINT "payroll_export_job_entries_job_id_payroll_export_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."payroll_export_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_export_job_entries" ADD CONSTRAINT "payroll_export_job_entries_timesheet_entry_id_timesheet_entries_id_fk" FOREIGN KEY ("timesheet_entry_id") REFERENCES "public"."timesheet_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_export_job_entries" ADD CONSTRAINT "payroll_export_job_entries_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_export_jobs" ADD CONSTRAINT "payroll_export_jobs_pay_period_id_pay_periods_id_fk" FOREIGN KEY ("pay_period_id") REFERENCES "public"."pay_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_export_jobs" ADD CONSTRAINT "payroll_export_jobs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_exports" ADD CONSTRAINT "payroll_exports_exported_by_users_id_fk" FOREIGN KEY ("exported_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_announcement_dismissals" ADD CONSTRAINT "route_announcement_dismissals_route_announcement_id_route_announcements_id_fk" FOREIGN KEY ("route_announcement_id") REFERENCES "public"."route_announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_announcement_dismissals" ADD CONSTRAINT "route_announcement_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_announcement_reads" ADD CONSTRAINT "route_announcement_reads_route_announcement_id_route_announcements_id_fk" FOREIGN KEY ("route_announcement_id") REFERENCES "public"."route_announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_announcement_reads" ADD CONSTRAINT "route_announcement_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_announcements" ADD CONSTRAINT "route_announcements_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_announcements" ADD CONSTRAINT "route_announcements_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_progress" ADD CONSTRAINT "route_progress_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_progress" ADD CONSTRAINT "route_progress_route_stop_id_route_stops_id_fk" FOREIGN KEY ("route_stop_id") REFERENCES "public"."route_stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_requests" ADD CONSTRAINT "route_requests_route_run_id_route_runs_id_fk" FOREIGN KEY ("route_run_id") REFERENCES "public"."route_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_requests" ADD CONSTRAINT "route_requests_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_requests" ADD CONSTRAINT "route_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_requests" ADD CONSTRAINT "route_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_requests" ADD CONSTRAINT "route_requests_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_run_events" ADD CONSTRAINT "route_run_events_route_run_id_route_runs_id_fk" FOREIGN KEY ("route_run_id") REFERENCES "public"."route_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_run_events" ADD CONSTRAINT "route_run_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_run_participants" ADD CONSTRAINT "route_run_participants_route_run_id_route_runs_id_fk" FOREIGN KEY ("route_run_id") REFERENCES "public"."route_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_run_participants" ADD CONSTRAINT "route_run_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_runs" ADD CONSTRAINT "route_runs_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_runs" ADD CONSTRAINT "route_runs_primary_driver_id_users_id_fk" FOREIGN KEY ("primary_driver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_runs" ADD CONSTRAINT "route_runs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_stop_id_stops_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_group_id_route_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."route_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_driver_assignment_id_driver_assignments_id_fk" FOREIGN KEY ("driver_assignment_id") REFERENCES "public"."driver_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stop_change_requests" ADD CONSTRAINT "stop_change_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stop_change_requests" ADD CONSTRAINT "stop_change_requests_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stop_change_requests" ADD CONSTRAINT "stop_change_requests_current_stop_id_stops_id_fk" FOREIGN KEY ("current_stop_id") REFERENCES "public"."stops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stop_change_requests" ADD CONSTRAINT "stop_change_requests_requested_stop_id_stops_id_fk" FOREIGN KEY ("requested_stop_id") REFERENCES "public"."stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stop_change_requests" ADD CONSTRAINT "stop_change_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stop_change_requests" ADD CONSTRAINT "stop_change_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_marked_by_user_id_users_id_fk" FOREIGN KEY ("marked_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_ride_events" ADD CONSTRAINT "student_ride_events_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_ride_events" ADD CONSTRAINT "student_ride_events_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_ride_events" ADD CONSTRAINT "student_ride_events_planned_stop_id_stops_id_fk" FOREIGN KEY ("planned_stop_id") REFERENCES "public"."stops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_ride_events" ADD CONSTRAINT "student_ride_events_actual_stop_id_stops_id_fk" FOREIGN KEY ("actual_stop_id") REFERENCES "public"."stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_routes" ADD CONSTRAINT "student_routes_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_routes" ADD CONSTRAINT "student_routes_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_routes" ADD CONSTRAINT "student_routes_pickup_stop_id_stops_id_fk" FOREIGN KEY ("pickup_stop_id") REFERENCES "public"."stops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_routes" ADD CONSTRAINT "student_routes_dropoff_stop_id_stops_id_fk" FOREIGN KEY ("dropoff_stop_id") REFERENCES "public"."stops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_service_day_overrides" ADD CONSTRAINT "student_service_day_overrides_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_service_day_overrides" ADD CONSTRAINT "student_service_day_overrides_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_service_day_overrides" ADD CONSTRAINT "student_service_day_overrides_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_service_days" ADD CONSTRAINT "student_service_days_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_service_days" ADD CONSTRAINT "student_service_days_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_service_days" ADD CONSTRAINT "student_service_days_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_assigned_route_id_routes_id_fk" FOREIGN KEY ("assigned_route_id") REFERENCES "public"."routes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_pickup_stop_id_stops_id_fk" FOREIGN KEY ("pickup_stop_id") REFERENCES "public"."stops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_dropoff_stop_id_stops_id_fk" FOREIGN KEY ("dropoff_stop_id") REFERENCES "public"."stops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplies_requests" ADD CONSTRAINT "supplies_requests_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplies_requests" ADD CONSTRAINT "supplies_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_pay_period_id_pay_periods_id_fk" FOREIGN KEY ("pay_period_id") REFERENCES "public"."pay_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entry_edits" ADD CONSTRAINT "timesheet_entry_edits_timesheet_entry_id_timesheet_entries_id_fk" FOREIGN KEY ("timesheet_entry_id") REFERENCES "public"."timesheet_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entry_edits" ADD CONSTRAINT "timesheet_entry_edits_editor_user_id_users_id_fk" FOREIGN KEY ("editor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_checklists" ADD CONSTRAINT "vehicle_checklists_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_checklists" ADD CONSTRAINT "vehicle_checklists_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_checklists" ADD CONSTRAINT "vehicle_checklists_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_dwell_sessions" ADD CONSTRAINT "vehicle_dwell_sessions_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_dwell_sessions" ADD CONSTRAINT "vehicle_dwell_sessions_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_dwell_sessions" ADD CONSTRAINT "vehicle_dwell_sessions_route_stop_id_route_stops_id_fk" FOREIGN KEY ("route_stop_id") REFERENCES "public"."route_stops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_dwell_sessions" ADD CONSTRAINT "vehicle_dwell_sessions_route_progress_id_route_progress_id_fk" FOREIGN KEY ("route_progress_id") REFERENCES "public"."route_progress"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_geofence_state" ADD CONSTRAINT "vehicle_geofence_state_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_geofence_state" ADD CONSTRAINT "vehicle_geofence_state_geofence_id_geofences_id_fk" FOREIGN KEY ("geofence_id") REFERENCES "public"."geofences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_inspections" ADD CONSTRAINT "vehicle_inspections_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_inspections" ADD CONSTRAINT "vehicle_inspections_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ack_admin_entity" ON "admin_acknowledgements" USING btree ("admin_user_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_ack_entity" ON "admin_acknowledgements" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_announcement_reads_user" ON "announcement_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_announcement_reads_announcement" ON "announcement_reads" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_change_logs_run" ON "attendance_change_logs" USING btree ("route_run_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_change_logs_student" ON "attendance_change_logs" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_change_logs_actor" ON "attendance_change_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "idx_auth_credentials_email" ON "auth_credentials" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_auth_credentials_phone" ON "auth_credentials" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_bamboo_employee_map_user" ON "bamboo_employee_map" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bamboo_employee_map_bamboo" ON "bamboo_employee_map" USING btree ("bamboo_employee_id");--> statement-breakpoint
CREATE INDEX "idx_bamboo_employee_map_active" ON "bamboo_employee_map" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_clock_events_driver_timestamp" ON "clock_events" USING btree ("driver_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_clock_events_shift" ON "clock_events" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "idx_clock_events_is_resolved" ON "clock_events" USING btree ("is_resolved");--> statement-breakpoint
CREATE INDEX "idx_device_tokens_user_active" ON "device_tokens" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_email_verification_tokens_token" ON "email_verification_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_email_verification_tokens_user" ON "email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_geofence_events_occurred" ON "geofence_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_geofence_events_vehicle" ON "geofence_events" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_messages_recipient_is_read" ON "messages" USING btree ("recipient_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_messages_sender" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_token" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_user" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pay_periods_date_range" ON "pay_periods" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_pay_periods_status" ON "pay_periods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payroll_export_job_entries_job" ON "payroll_export_job_entries" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_export_job_entries_idempotency" ON "payroll_export_job_entries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_payroll_export_job_entries_driver_date" ON "payroll_export_job_entries" USING btree ("driver_id","date");--> statement-breakpoint
CREATE INDEX "idx_payroll_export_jobs_period" ON "payroll_export_jobs" USING btree ("pay_period_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_export_jobs_status" ON "payroll_export_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payroll_export_jobs_scheduled" ON "payroll_export_jobs" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_route_progress_shift" ON "route_progress" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "idx_route_requests_run" ON "route_requests" USING btree ("route_run_id");--> statement-breakpoint
CREATE INDEX "idx_route_requests_route" ON "route_requests" USING btree ("route_id");--> statement-breakpoint
CREATE INDEX "idx_route_requests_status" ON "route_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_route_requests_created_by" ON "route_requests" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_route_run_events_run" ON "route_run_events" USING btree ("route_run_id");--> statement-breakpoint
CREATE INDEX "idx_route_run_events_type" ON "route_run_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_route_run_participants_run" ON "route_run_participants" USING btree ("route_run_id");--> statement-breakpoint
CREATE INDEX "idx_route_run_participants_user" ON "route_run_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_route_runs_route_date" ON "route_runs" USING btree ("route_id","service_date");--> statement-breakpoint
CREATE INDEX "idx_route_runs_primary_driver" ON "route_runs" USING btree ("primary_driver_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_route_runs_unique_context" ON "route_runs" USING btree ("route_id","service_date","shift_type");--> statement-breakpoint
CREATE INDEX "idx_routes_group_id" ON "routes" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_shifts_driver_date" ON "shifts" USING btree ("driver_id","date");--> statement-breakpoint
CREATE INDEX "idx_student_attendance_route_run" ON "student_attendance" USING btree ("route_run_id");--> statement-breakpoint
CREATE INDEX "idx_ride_events_shift" ON "student_ride_events" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "idx_ride_events_student" ON "student_ride_events" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_ride_events_route_run" ON "student_ride_events" USING btree ("route_run_id");--> statement-breakpoint
CREATE INDEX "idx_service_day_overrides_student" ON "student_service_day_overrides" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_service_day_overrides_date" ON "student_service_day_overrides" USING btree ("service_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_service_day_overrides_unique" ON "student_service_day_overrides" USING btree ("student_id","route_id","shift_type","service_date");--> statement-breakpoint
CREATE INDEX "idx_student_service_days_student" ON "student_service_days" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_student_service_days_route" ON "student_service_days" USING btree ("route_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_student_service_days_unique" ON "student_service_days" USING btree ("student_id","route_id","shift_type");--> statement-breakpoint
CREATE INDEX "idx_timesheet_entries_driver_period" ON "timesheet_entries" USING btree ("driver_id","pay_period_id");--> statement-breakpoint
CREATE INDEX "idx_timesheet_entries_start" ON "timesheet_entries" USING btree ("start_at_utc");--> statement-breakpoint
CREATE INDEX "idx_timesheet_entries_status" ON "timesheet_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_timesheet_entries_shift" ON "timesheet_entries" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "idx_dwell_sessions_vehicle" ON "vehicle_dwell_sessions" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_dwell_sessions_shift_stop" ON "vehicle_dwell_sessions" USING btree ("shift_id","route_stop_id","status");--> statement-breakpoint
CREATE INDEX "idx_vehicle_geofence_unique" ON "vehicle_geofence_state" USING btree ("vehicle_id","geofence_id");