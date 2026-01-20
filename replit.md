# Kid Commute - Transportation Service Management System

## Overview
Kid Commute is a comprehensive transportation service management system designed to enhance efficiency, safety, and communication for fleet operations. It provides real-time vehicle tracking, efficient route management, and seamless communication for administrators, drivers, and parents, aiming to improve overall transportation service management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend**: React with TypeScript, Vite, Wouter, utilizing `shadcn/ui` (New York variant) based on Radix UI and Tailwind CSS.
- **Role-Based Interfaces**: Desktop-optimized Admin Dashboard, mobile-first Driver Interface, and a Parent Portal with real-time tracking.
- **Real-time Features**: WebSockets for messaging, Leaflet.js for map visualization, and polling for statistics.
- **Admin Page Consolidation**: Activity & Operations page combines Route Health, Driver Utilities, Audit Log, and Time Management into a single tabbed interface.

### Technical Implementations
- **Backend**: Express.js on Node.js with TypeScript and ESM.
- **Authentication**: Unified JWT-based authentication for all platforms (web and mobile).
  - **Web**: Email/phone + password login, JWT stored in HTTP-only Secure cookies (SameSite=Lax, 7-day expiry).
  - **Mobile**: Same credentials, JWT stored via Capacitor Preferences.
  - **Endpoints**: `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, `/api/auth/user`.
  - **Email Verification**: New accounts with email addresses receive verification emails. Tokens expire after 24 hours.
    - `POST /api/auth/verify-email` - Verify email with token
    - `GET /api/auth/verify-email` - Redirects from email link to verification page
    - `POST /api/auth/resend-verification` - Resend verification email (supports both authenticated and unauthenticated users)
    - `GET /api/auth/verification-status` - Check verification status (requires auth)
  - **Password Reset**: Email-based password reset flow with 1-hour token expiry.
    - `POST /api/auth/forgot-password` - Request password reset email
    - `POST /api/auth/reset-password` - Reset password with token
    - `GET /api/auth/validate-reset-token` - Check if reset token is valid
  - **Security**: bcrypt password hashing, JWT_SECRET for token signing, role-based middleware (`requireAuth`, `requireRole`).
  - **Testing Bypass (Development Only)**: 
    - `GET /api/auth/test-users` - Returns sample users for each role (admin, driver, parent).
    - `POST /api/auth/test-login` with `{"role": "admin"|"driver"|"parent"}` - Logs in as any role without password, sets auth cookie. Optional: `{"role": "admin", "userId": "specific-id"}` for specific user.
- **API**: RESTful APIs in JSON format with structured error handling.
- **Real-Time Communication**: `ws` WebSocket server.
- **Data Storage**: PostgreSQL via Neon serverless with Drizzle ORM.
- **Core Data Model**: Includes Users (multi-role), AuthCredentials (password management), Households, Vehicles, Routes, Stops, Students, Shifts, Clock Events, Messages, Incidents, and Vehicle Inspections.
- **Key Features**:
    - **Reusable Stops System**: Independently defined and assignable stops.
    - **Phone-Based Household System**: Links parents to students via phone numbers.
    - **Time Tracking**: Drivers clock in/out for general timekeeping, separate from route operations which require active clock-in, vehicle inspection, and route start timestamp.
    - **Flexible Shift Scheduling**: Shifts require explicit start/end times and vehicle selection.
    - **Messaging System**: Route-based messaging between drivers and parents, with admin intervention.
    - **Announcement System**: Dismissible announcements for users, route-specific broadcasts, and enhanced admin broadcasts.
    - **Incident Management**: Drivers report incidents, admins review.
    - **Driver Assignment System**: Admins assign drivers to routes with optional vehicle assignment.
    - **Parent Student Management**: Parents can edit children's information.
    - **Multi-Route Student Assignment**: Students can be assigned to multiple routes (e.g., morning, afternoon) via a junction table, with admin dialog management and visual route type indicators.
    - **Student Attendance Tracking**: Per-shift attendance system (PENDING, riding, absent) with `shiftId` column to prevent AM/PM route overwrites. Live admin overview included.
    - **Parent Dashboard Enhancements**: Live ETA countdown, quick contact actions, driver info, and account management.
    - **Payment Portal Configuration**: Environment-driven billing portal system (QuickBooks, ClassWallet) for parent payments.
    - **Admin Audit Log**: Tracks driver and parent actions.
    - **Route Progress Tracking**: Real-time driver route progress with parent visibility, including ETA countdowns and pickup confirmation.
    - **Real-Time Navigation Tracking**: GPS-based system for live ETA calculations, supporting Samsara and generic GPS providers via webhooks.
    - **Lead Driver Permissions**: `isLeadDriver` flag for enhanced permissions.
    - **Driver Utilities System**: Drivers request supplies, submit checklists, provide feedback.
    - **Route Health Monitoring**: Admin dashboard for active route status, driver availability, and student counts.
    - **Live Fleet Map**: Admin page displaying real-time vehicle locations with auto-refresh. Includes CRUD for vehicle management with vehicle nickname support.
    - **Vehicle Nicknames**: Optional friendly names for vehicles displayed throughout the app (fleet map, vehicle list, popups), with unit number shown as secondary detail when nickname exists.
    - **Route Groups System**: Organizational system for managing multiple routes under shared groups, with integrated admin UI.
    - **Geofence Detection System**: Real-time monitoring of vehicles entering/exiting defined geofences (SCHOOL, STOP, CUSTOM) with automatic parent notifications.
    - **Automatic Stop Geofence Provisioning**: Stops automatically provision 100m STOP-type geofences.
    - **Automatic Stop Detection**: Dwell-based system for auto-completing route stops.
    - **Optimized GPS Pipeline**: Enhanced `server/gps-pipeline.ts` with timezone-aware shift detection.
    - **Unified Driver Route Dashboard**: Consolidated interface for route management, attendance, and stop completion, enforcing inspection and stop completion gates.
    - **Session Management**: PostgreSQL-backed sessions with 7-day TTL.
    - **Push Notifications**: Mobile app support for iOS/Android via Firebase Cloud Messaging, with device token management.
    - **Automated Data Retention**: Scheduled cleanup service for old data (Messages, GPS/geofence events, audit logs, announcements, device tokens) with configurable retention periods.
    - **BambooHR Payroll Integration**: Automated driver clock-in/out data export with federal/Arizona overtime rules, including employee mapping, pay period selection, preview, batch submission, and audit trail.

## Backlog / Future Features

### Driver-Side Tools (Planned)
- **Stop Timeline**: Show drivers a visual timeline of when they need to be at each stop and when they must leave for the next stop.
- **Route Map Visualization**: Interactive map for drivers showing their assigned routes with stop markers and navigation guidance.
- **Emergency Button**: Quick emergency alert button on driver dashboard that notifies admins and relevant parties immediately.
- **Enhanced Lead Driver Role**: Expand lead driver privileges to include route editing, driver assignment, and schedule management capabilities.

## External Dependencies

### Third-Party Services
- **Neon Database**: Serverless PostgreSQL hosting.
- **Leaflet.js**: Mapping library.
- **Google Fonts**: Inter font family.
- **Firebase Cloud Messaging**: Push notification service.
- **Samsara**: GPS provider integration.
- **QuickBooks/ClassWallet**: Payment portal integrations.
- **BambooHR**: Payroll integration.
- **Resend**: Email service for password reset emails (requires `RESEND_API_KEY` secret).

### Key NPM Packages
- `drizzle-orm`, `drizzle-kit`: ORM and migrations.
- `@neondatabase/serverless`: PostgreSQL client.
- `ws`: WebSocket server.
- `bcryptjs`: Password hashing.
- `jsonwebtoken`: JWT token generation/verification.
- `cookie-parser`: Cookie handling for JWT auth.
- `@tanstack/react-query`: Client-side data fetching.
- `date-fns`: Date utility library.
- `zod`: Runtime schema validation.
- `resend`: Email delivery service.
- Radix UI component primitives.