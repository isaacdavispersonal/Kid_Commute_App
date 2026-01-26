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
  - **Web**: Email/phone + password login, JWT stored in HTTP-only Secure cookies (SameSite=Lax).
  - **Mobile**: Same credentials, JWT stored via Capacitor Preferences.
  - **Remember Me**: "Keep me logged in" checkbox on login extends session from 1 day to 30 days.
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
- **Real-Time Communication**: Dual WebSocket system with `ws` library (legacy) and Socket.IO.
  - **Socket.IO Server**: `server/socket-server.ts` - JWT-authenticated with automatic room management
  - **Rooms**: `user:{userId}` (direct updates), `org:default` (org-wide broadcasts), `route_run:{routeRunId}` (live route operations)
  - **Events**: `route_run.started`, `route_run.ended_pending_review`, `route_run.finalized`, `stop.arrived`, `stop.completed`, `attendance.updated`, `announcement.created`, `participant.joined`, `participant.left`
  - **Frontend Hooks**: `useSocket()` for connection state, `useRouteRunSocket(routeRunId)` for route subscriptions, `useAnnouncementSocket()` for org-wide announcements
  - **Reconnection**: Automatic reconnection with exponential backoff, "Reconnecting..." UI indicator in header
  - **Path**: `/socket.io` with WebSocket and polling fallback transports
- **Data Storage**: PostgreSQL via Neon serverless with Drizzle ORM.
- **Core Data Model**: Includes Users (multi-role), AuthCredentials (password management), Households, Vehicles, Routes, Stops, Students, Shifts, Clock Events, Messages, Incidents, and Vehicle Inspections.
- **Key Features**:
    - **Reusable Stops System**: Independently defined and assignable stops.
    - **Phone-Based Household System**: Links parents to students via phone numbers.
    - **Time Tracking**: Drivers clock in/out for general timekeeping, separate from route operations which require active clock-in, vehicle inspection, and route start timestamp.
    - **Flexible Shift Scheduling**: Shifts require explicit start/end times and vehicle selection.
    - **Messaging System**: Route-based messaging between drivers and parents, with admin intervention.
    - **Announcement System**: Dismissible announcements for users, route-specific broadcasts, enhanced admin broadcasts, and announcement history with delivery diagnostics.
      - **Admin Announcement History**: Tabbed interface (Create/History) at `/admin/announcements` with filters (search, audience type), pagination, and detailed delivery diagnostics (target count, success/failure counts, push timing, error messages).
      - **Audience Types**: ORG_ALL (all drivers + parents), ROLE_DRIVERS, ROLE_PARENTS, ROUTE_DRIVERS (drivers on specific route), ROUTE_PARENTS (parents with students on route).
      - **Route-Scoped Targeting**: Route-scoped announcements (ROUTE_DRIVERS, ROUTE_PARENTS) require route_id and only target users assigned to that route.
      - **Socket.IO Rooms**: Users join `route:{routeId}` rooms on connection for real-time route-scoped announcement delivery.
      - **Client Badge Updates**: Announcement socket events trigger badge/unread count refreshes automatically.
    - **Incident Management**: Drivers report incidents, admins review.
    - **Route Request System**: Drivers can report route issues during active routes (missing students, unexpected students, wrong stops, roster clarifications). Admins review and resolve requests via Activity & Operations page. Real-time Socket.IO events for created/updated requests. Badge count for open requests.
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
    - **Push Notifications**: Mobile app support for iOS/Android via Firebase Cloud Messaging.
      - **Device Token Management**: Registration via `POST /api/push-tokens`, removal via `DELETE /api/push-tokens/:token`. Tokens tracked with `failureCount`, `isActive`, `deactivatedAt` fields.
      - **Token Failure Handling**: Automatic revocation after 3 consecutive delivery failures.
      - **Deep Link Support**: All push payloads include `type` and `deeplink` fields for navigation. Type-based routing maps notifications to role-specific pages.
      - **Notification Types**: `new_message`, `announcement`, `route_started`, `bus_approaching`, `student_pickup`, `route_delay`, `test`.
      - **Route Mapping**: Driver → /driver/*, Parent → /parent/*, Admin → /admin/*. Parent announcements route to /parent/messages (no separate announcements page).
      - **Pending Navigation Queue**: If notification tapped before auth ready, navigation is queued and executed after user is authenticated.
      - **Enhanced Logging**: `[push]` prefix for push service logs, `[push-token]` prefix for registration. Logs include user IDs, token counts per user, FCM response status, and failure tracking.
    - **Automated Data Retention**: Scheduled cleanup service for old data (Messages, GPS/geofence events, audit logs, announcements, device tokens) with configurable retention periods.
    - **BambooHR Payroll Integration**: Automated driver clock-in/out data export with federal/Arizona overtime rules, including employee mapping, pay period selection, preview, batch submission, and audit trail.
    - **Pull-to-Refresh**: Mobile-optimized gesture for manual data refresh on driver and parent pages. Uses single scroll container architecture with RefreshContext for callback management. Integrated pages: driver dashboard/routes/announcements, parent dashboard/tracking/messages.
    - **iOS Post-Auth Layout Fix**: Addresses WKWebView white bar issue after login/signup by re-applying StatusBar overlay settings and forcing viewport recalculation with double RAF + resize event. Ionic CSS backgrounds are overridden to match app theme.
    - **iOS Debug Overlay**: Toggle with three-finger tap gesture. Shows platform info, current layout state (Auth/App/Loading), computed padding-top on root container, safe-area insets, viewport dimensions, and event log. Detects potentially doubled padding that causes white bar issues. Includes manual layout fix button to re-apply StatusBar settings.
    - **RouteRun System**: Multi-driver route execution tracking with real-time coordination.
      - **Data Model**: route_runs (execution instances), route_run_participants (multi-driver roles), route_run_events (audit trail)
      - **Status Flow**: SCHEDULED → ACTIVE → ENDED_PENDING_REVIEW → FINALIZED (or CANCELLED)
      - **Participant Roles**: PRIMARY (can start/end, mark attendance), AID (helper driver), VIEWER (read-only)
      - **API Endpoints**: `/api/route-runs` CRUD, `/api/route-runs/:id/start|end|finalize|join|leave`, `/api/route-runs/:id/events`
      - **Socket.IO Rooms**: Clients subscribe via `socket.emit("subscribe_route_run", routeRunId)` for real-time updates
      - **Socket.IO Events**: `route_run.started`, `route_run.ended_pending_review`, `route_run.finalized`, `participant.joined`, `participant.left`

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