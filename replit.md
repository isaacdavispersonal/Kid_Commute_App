# Kid Commute - Transportation Service Management System

## Overview
Kid Commute is a comprehensive transportation service management system designed to enhance efficiency, safety, and communication for fleet operations. It provides real-time vehicle tracking, efficient route management, and seamless communication for administrators, drivers, and parents. The system aims to improve overall transportation service management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend**: React with TypeScript, Vite, Wouter, utilizing `shadcn/ui` (New York variant) based on Radix UI and Tailwind CSS for a consistent design.
- **Role-Based Interfaces**: Desktop-optimized Admin Dashboard (with sidebar navigation, data tables, fleet maps, compact schedule calendar), mobile-first Driver Interface, and a Parent Portal with real-time tracking.
- **Real-time Features**: WebSockets for messaging, Leaflet.js for map visualization, and polling for statistics.
- **Navigation**: Profile settings are in a header dropdown to maintain clean sidebar navigation across all roles.

### Technical Implementations
- **Backend**: Express.js on Node.js with TypeScript and ESM.
- **Authentication**: Replit OpenID Connect (OIDC), Passport.js, and PostgreSQL-backed session management with role-based access control.
- **API**: RESTful APIs in JSON format with structured error handling.
- **Real-Time Communication**: `ws` WebSocket server for bidirectional messaging and notifications.
- **Data Storage**: PostgreSQL via Neon serverless with Drizzle ORM for type-safe queries.
- **Core Data Model**: Includes Users (multi-role), Households, Vehicles, Routes, Stops, Students, Shifts, Clock Events, Messages, Incidents, and Vehicle Inspections.
- **Type System Enhancements**: `RouteStopWithMetadata` type enriches Stop data with route-stop junction metadata (stopId, routeStopId, stopOrder, scheduledTime), enabling proper frontend access to route ordering information and preventing duplicate stop assignments in route management.
- **Vehicle Inspection Tracking**: Shifts table includes `inspectionCompletedAt` timestamp field (server-managed, omitted from insert/update schemas) to enforce pre-route vehicle inspection requirements.
- **Key Features**:
    - **Reusable Stops System**: Stops are independently defined and assignable to multiple routes.
    - **Phone-Based Household System**: Links parents to students via phone numbers, supporting multi-guardian scenarios.
    - **Time Tracking**: Shift-based system with clock in/out, break tracking, and anomaly detection.
    - **Flexible Shift Scheduling**: Shifts require explicit start/end times and vehicle selection during creation, allowing for dynamic schedule variations (regular days, half-days, etc.) without requiring duplicate driver assignments. Shift times are independent of driver assignments, enabling the same driver-route combination to operate at different times on different days.
    - **Messaging System**: Route-based messaging between drivers and parents, with admin direct messaging and intervention.
    - **Announcement System**: Dismissible announcements for users, route-specific broadcasts for drivers, and enhanced admin broadcasts.
    - **Incident Management**: Drivers report incidents, which admins review and resolve.
    - **Driver Assignment System**: Simplified system where admins assign drivers to routes. Vehicle assignments are managed separately in the Vehicles tab, and shift times are specified explicitly during shift creation rather than being copied from assignments.
    - **Parent Student Management**: Parents can edit children's information.
    - **Student Attendance Tracking**: Comprehensive system (PENDING, riding, absent) with live admin overview, real-time notifications, and analytics.
    - **Parent Dashboard Enhancements**: Live ETA countdown, quick contact actions, driver information display, payment/billing section, and account management (including deletion).
    - **Admin Audit Log**: Tracks all driver and parent actions with filtering capabilities.
    - **Route Progress Tracking**: Comprehensive system showing real-time driver route progress with parent visibility. Backend API enriches `/api/parent/students` with active shift status, stops remaining counter (pending stops before pickup), total/completed stops, route completion percentage, and pickup confirmation flags. Parent dashboard displays live progress bars, "X stops away" counter, and "Picked up at HH:MM" status. Includes shift progress caching to optimize queries when multiple children share routes, and graceful handling of inactive routes and edge cases.
    - **Real-Time Navigation Tracking**: GPS-based system for live ETA calculations, supporting Samsara and generic GPS providers via a webhook-first architecture. Features source-agnostic GPS pipeline, Haversine formula for distance, and parent pickup stop selection.
    - **Lead Driver Permissions**: `isLeadDriver` flag for enhanced senior driver permissions.
    - **Driver Utilities System**: Drivers can request supplies, submit vehicle inspection checklists, and provide feedback, with admin management.
    - **Route Health Monitoring**: Admin dashboard for active route status, driver availability, and student counts.
    - **Live Fleet Map**: Admin page displaying real-time vehicle locations with auto-refresh and metrics.
        - **Vehicle Management**: CRUD operations for vehicles with safety checks, uniqueness validation, and driver assignment capability. Vehicles can be assigned to specific drivers through the Vehicles tab.
    - **Route Color Labeling and Grouping System**: Visual organization of routes with 12 color options (Tan, Red, Blue, Orange, Yellow, Purple, Green, Gray, Teal, Gold, Pink, Maroon). Features include: optional per-route color assignment with gray default, route_color enum type in database, RouteColorBadge component displaying thin vertical colored bar indicator (4px tall, 1px wide) next to route names throughout admin and driver interfaces, color selection dropdowns in create/edit route forms with dark mode support, and full route groups management. Route Groups allow organizing multiple routes under shared color/name for fleet organization via route_groups table and groupId foreign key. Admin UI provides integrated group management directly within the Routes tab using collapsible group sections, with inline controls for creating, editing, and deleting groups. Routes are automatically displayed grouped by their assigned route group, with ungrouped routes shown separately. Each group section displays name, description, route count, and inline edit/delete buttons. Color badges use design-compliant vertical bar indicators (no rounded corners, no borders) with proper bgColor properties in ROUTE_COLORS schema for consistent styling across light/dark themes. Badge design follows universal_design_guidelines principle prohibiting single-sided borders on rounded elements.
    - **Geofence Detection System**: Real-time monitoring of vehicles entering/exiting defined geofences (SCHOOL, STOP, CUSTOM) with automatic parent notifications.
    - **Automatic Stop Geofence Provisioning**: Stops automatically provision 100m STOP-type geofences when created/updated with coordinates. Storage-layer transactions ensure atomic creation, sync on updates (name/coordinate changes), and cleanup on deletion. FK constraint (SET NULL) prevents orphan records.
    - **Automatic Stop Detection**: Dwell-based system that auto-completes route stops when vehicles remain stationary at stop locations.
    - **Optimized GPS Pipeline**: Enhanced `server/gps-pipeline.ts` with timezone-aware shift detection, query optimization, and sequential processing.
    - **Unified Driver Route Dashboard**: Consolidated interface combining route management, attendance tracking, and stop completion. Features include: inspection gate enforcement before route start, stop-by-stop display with student lists, individual student attendance controls (riding/absent), stop completion gating (requires all students marked + inspection complete), auto-advance to next stop via query invalidation, and canonical shift date handling for overnight routes. Backed by typed `ShiftRouteContext` API response with comprehensive route, stop, student, and progress data.
    - **Session Management**: PostgreSQL-backed sessions with 7-day TTL and secure cookies.
    - **Push Notifications**: Mobile app support for iOS/Android via Firebase Cloud Messaging. Device token management with platform detection (ios/android), automatic upsert/delete handling, and failure tracking. Backend service (`push-notification-service.ts`) integrates Firebase Admin SDK for cross-platform notification delivery. API endpoints: POST /api/push-tokens (register device), DELETE /api/push-tokens/:token (unregister). Requires FIREBASE_SERVICE_ACCOUNT_JSON environment variable for production use.
    - **Automated Data Retention**: Scheduled cleanup service (`data-retention-service.ts`) automatically deletes old data per privacy policy commitments. Runs daily with configurable retention periods: Messages (90 days), GPS/geofence events (30 days), audit logs (365 days), dismissed announcements (90 days), inactive device tokens (180 days). Admin-configurable via settings: `retention_messages_days`, `retention_geofence_events_days`, `retention_audit_logs_days`, `retention_announcements_days`, `retention_device_tokens_days`.
    - **BambooHR Payroll Integration**: Automated driver clock-in/out data export with federal/Arizona overtime rules (weekly >40h OT at 1.5x). Features include: employee BambooHR ID mapping, pay period selection with duplicate detection, per-shift hour calculation preventing averaging errors, comprehensive preview before export, batch submission with rate limiting (100ms delay), complete audit trail (payrollExports, payrollExportEntries tables), zero-hour field preservation for compliance, and export history with filtering. Backend services: `server/storage.ts` for federal overtime logic with clock event state machine, `server/bamboohr-service.ts` for BambooHR API integration with authentication and time entry submission. API routes: POST /api/admin/payroll/calculate-preview (calculation with validation), POST /api/admin/payroll/exports (execute export), GET /api/admin/payroll/exports (history list), GET /api/admin/payroll/exports/:id (details with entries). Admin UI provides comprehensive UX safeguards: date range validation, BambooHR ID format validation (/^[a-zA-Z0-9_-]+$/), enhanced confirmation dialog with payload summary, and three-tab interface (mapping, preview, history).

## External Dependencies

### Third-Party Services
- **Replit Auth**: OpenID Connect provider.
- **Neon Database**: Serverless PostgreSQL hosting.
- **Leaflet.js**: Mapping library.
- **Google Fonts**: Inter font family.
- **Firebase Cloud Messaging**: Push notification service for iOS and Android mobile apps.

### Key NPM Packages
- `drizzle-orm`, `drizzle-kit`: ORM and migrations.
- `@neondatabase/serverless`: PostgreSQL client.
- `ws`: WebSocket server.
- `passport`, `openid-client`: Authentication.
- `express-session`, `connect-pg-simple`: Session management.
- `@tanstack/react-query`: Client-side data fetching.
- `date-fns`: Date utility library.
- `zod`: Runtime schema validation.
- Radix UI component primitives.