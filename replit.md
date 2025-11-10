# FleetTrack - Transportation Service Management System

## Overview
FleetTrack is a comprehensive transportation service management system designed to enhance efficiency, safety, and communication for fleet operations. It provides real-time vehicle tracking, efficient route management, and seamless communication for administrators, drivers, and parents. The system aims to improve overall transportation service management.

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
- **Key Features**:
    - **Reusable Stops System**: Stops are independently defined and assignable to multiple routes.
    - **Phone-Based Household System**: Links parents to students via phone numbers, supporting multi-guardian scenarios.
    - **Time Tracking**: Shift-based system with clock in/out, break tracking, and anomaly detection.
    - **Assignment-Based Scheduling**: Shifts generated from driver assignments with bulk editing capabilities.
    - **Messaging System**: Route-based messaging between drivers and parents, with admin direct messaging and intervention.
    - **Announcement System**: Dismissible announcements for users, route-specific broadcasts for drivers, and enhanced admin broadcasts.
    - **Incident Management**: Drivers report incidents, which admins review and resolve.
    - **Driver Assignment System**: Admins assign drivers to routes, vehicles, and times.
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
    - **Vehicle Management**: CRUD operations for vehicles with safety checks and uniqueness validation.
    - **Geofence Detection System**: Real-time monitoring of vehicles entering/exiting defined geofences (SCHOOL, CUSTOM) with automatic parent notifications.
    - **Automatic Stop Detection**: Dwell-based system that auto-completes route stops when vehicles remain stationary at stop locations.
    - **Optimized GPS Pipeline**: Enhanced `server/gps-pipeline.ts` with timezone-aware shift detection, query optimization, and sequential processing.
    - **Session Management**: PostgreSQL-backed sessions with 7-day TTL and secure cookies.

## External Dependencies

### Third-Party Services
- **Replit Auth**: OpenID Connect provider.
- **Neon Database**: Serverless PostgreSQL hosting.
- **Leaflet.js**: Mapping library.
- **Google Fonts**: Inter font family.

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