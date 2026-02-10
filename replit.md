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
- **Operations Live Panel**: Time Management section features an Operations Live tab showing real-time driver clock-in/out status with force clock-out capability for admins and lead drivers.

### Technical Implementations
- **Backend**: Express.js on Node.js with TypeScript and ESM.
- **Authentication**: Unified JWT-based authentication for all platforms (web and mobile) with email/phone + password login, email verification, and password reset flows. Security measures include bcrypt hashing, JWT_SECRET, role-based middleware, and rate limiting.
- **API**: RESTful APIs in JSON format with structured error handling.
- **Real-Time Communication**: Dual WebSocket system with `ws` library and Socket.IO for real-time updates and notifications across users and routes.
- **Data Storage**: PostgreSQL via Neon serverless with Drizzle ORM, utilizing connection pooling.
- **Core Data Model**: Includes Users (multi-role), Households, Vehicles, Routes, Stops, Students, Shifts, Clock Events, Messages, Incidents, and Vehicle Inspections.
- **Key Features**:
    - **Reusable Stops System**: Independently defined and assignable stops.
    - **Phone-Based Household System**: Links parents to students via phone numbers.
    - **Time Tracking**: Drivers clock in/out, separate from route operations.
    - **Flexible Shift Scheduling**: Shifts require explicit start/end times and vehicle selection.
    - **Messaging System**: Route-based messaging between drivers and parents, with admin intervention.
    - **Announcement System**: Dismissible announcements for various audiences, with detailed delivery diagnostics for admins.
    - **Incident Management**: Drivers report incidents, admins review.
    - **Route Request System**: Drivers report route issues during active routes, with real-time admin review.
    - **Driver Assignment System**: Admins assign drivers to routes with optional vehicle assignment.
    - **Parent Student Management**: Parents can edit children's information.
    - **Multi-Route Student Assignment**: Students can be assigned to multiple routes (e.g., morning, afternoon).
    - **Student Attendance Tracking**: Per-shift attendance system with live admin overview.
    - **Parent Dashboard Enhancements**: Live ETA countdown, quick contact actions, driver info, and account management.
    - **Payment Portal Configuration**: Environment-driven billing portal system.
    - **Admin Audit Log**: Tracks driver and parent actions.
    - **Route Progress Tracking**: Real-time driver route progress with parent visibility, including ETA countdowns and pickup confirmation.
    - **Real-Time Navigation Tracking**: GPS-based system for live ETA calculations, supporting Samsara and generic GPS providers.
    - **Lead Driver Permissions**: `isLeadDriver` flag for enhanced permissions.
    - **Driver Utilities System**: Drivers request supplies, submit checklists, provide feedback.
    - **Route Health Monitoring**: Admin dashboard for active route status, driver availability, and student counts.
    - **Live Fleet Map**: Admin page displaying real-time vehicle locations with CRUD for vehicle management and nickname support.
    - **Route Groups System**: Organizational system for managing multiple routes under shared groups.
    - **Geofence Detection System**: Real-time monitoring of vehicles entering/exiting defined geofences with automatic parent notifications.
    - **Automatic Stop Geofence Provisioning**: Stops automatically provision 100m STOP-type geofences.
    - **Automated Stop Detection**: Dwell-based system for auto-completing route stops.
    - **Optimized GPS Pipeline**: Enhanced GPS processing with timezone-aware shift detection.
    - **Unified Driver Route Dashboard**: Consolidated interface for route management, attendance, and stop completion, enforcing inspection and stop completion gates.
    - **Session Management**: PostgreSQL-backed sessions with 7-day TTL.
    - **Push Notifications**: Mobile app support for iOS/Android via Firebase Cloud Messaging with device token management, deep link support, and various notification types.
    - **Automated Data Retention**: Scheduled cleanup service for old data with configurable retention periods.
    - **BambooHR Payroll Integration**: Comprehensive timesheet-based payroll system with:
        - **Pay Periods**: Biweekly periods with OPEN/LOCKED/APPROVED/EXPORTED status workflow
        - **Timesheet Entries**: Durable time records derived from clock events with DRAFT/READY/APPROVED/EXPORTED status
        - **Audit Trail**: All timesheet edits logged with reason, editor, previous/new values
        - **Export Job Pipeline**: Idempotent BambooHR exports with QUEUED/RUNNING/SUCCESS/PARTIAL/FAILED status
        - **Export Preview**: Pre-export validation showing warnings (missing clock-outs, unmapped drivers, etc.)
        - **Bulk Actions**: Auto-resolve missing clock-outs with required reason
        - **BambooHR Settings**: Connection test, employee ID mapping, configuration page
    - **Pull-to-Refresh**: Mobile-optimized gesture for manual data refresh on driver and parent pages.
    - **iOS Post-Auth Layout Fix**: Addresses WKWebView layout issues after login/signup.
    - **iOS Debug Overlay**: Toggleable overlay for debugging layout and platform information.
    - **RouteRun System**: Multi-driver route execution tracking with real-time coordination, supporting multiple participant roles and a defined status flow.
    - **Student Not At Stop Notification**: Drivers can notify parents when students are not at their pickup stop, with in-app messaging and push notifications with deep link to chat.
    - **Expandable Student Cards**: Driver route page shows expandable student cards with color-coded icons for allergies, medical notes, special needs, and general notes.
    - **Parent Stop Change Requests**: Parents can request pickup/dropoff stop changes with admin approval workflow, status tracking, and history view.
    - **Student Riding Schedule**: Bitmask-based system for defining which days of the week students ride on specific routes/shifts (Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64, weekdays default=31). Supports date-specific overrides (FORCE_RIDING/FORCE_NOT_RIDING) for holidays or special occasions. UI integration in admin student management with day chips (M T W T F S S).

## External Dependencies

### Third-Party Services
- **Neon Database**: Serverless PostgreSQL hosting.
- **Leaflet.js**: Mapping library.
- **Google Fonts**: Inter font family.
- **Firebase Cloud Messaging**: Push notification service.
- **Samsara**: GPS provider integration.
- **QuickBooks/ClassWallet**: Payment portal integrations.
- **BambooHR**: Payroll integration.
- **Resend**: Email service.

### Key NPM Packages
- `drizzle-orm`, `drizzle-kit`: ORM and migrations.
- `@neondatabase/serverless`: PostgreSQL client.
- `ws`: WebSocket server.
- `bcryptjs`: Password hashing.
- `jsonwebtoken`: JWT token generation/verification.
- `cookie-parser`: Cookie handling for JWT auth.
- `@tanstack/react-query`: Client-side data fetching.
- `date-fns`, `date-fns-tz`: Date utility library with timezone support.
- `zod`: Runtime schema validation.
- `resend`: Email delivery service.
- Radix UI component primitives.