# FleetTrack - Transportation Service Management System

## Overview
FleetTrack is a comprehensive transportation service management system designed for fleet operations, route scheduling, and real-time communication. It serves administrators, drivers, and parents by offering live vehicle tracking, efficient route management, and seamless communication. The system's primary goal is to enhance efficiency, safety, and communication within transportation services.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend Framework**: React with TypeScript, Vite, Wouter.
- **Component Library**: shadcn/ui (New York variant) with Radix UI and Tailwind CSS.
- **Role-Based Interfaces**:
    - **Admin Dashboard**: Desktop-optimized with sidebar navigation for CRUD operations across users, students, vehicles, routes, schedules, and communication. Features data tables, fleet maps, and compact schedule calendar.
    - **Driver Interface**: Mobile-first design for clock in/out and route management.
    - **Parent Portal**: Real-time tracking and messaging capabilities.
- **Real-time Features**: WebSocket integration for messaging, Leaflet.js for map visualization, and polling for statistics.
- **Clutter Reduction**: Grouped and collapsible UI elements (e.g., incidents by status, users by role, messages with read/unread/archived sections) to improve visual clarity.
- **Navigation**: Profile settings are moved to a header dropdown for all roles for cleaner sidebar navigation.

### Technical Implementations
- **Backend Framework**: Express.js on Node.js with TypeScript and ESM.
- **Authentication**: Replit OpenID Connect (OIDC), Passport.js, and PostgreSQL-backed session management with role-based access control (admin, driver, parent).
- **API**: RESTful APIs organized by user role, using JSON format with structured error handling.
- **Real-Time Communication**: Utilizes a `ws` WebSocket server for bidirectional messaging.
- **Data Storage**: PostgreSQL via Neon serverless with Drizzle ORM for type-safe queries.
- **Core Data Model**: Includes entities for Users (multi-role), Households, Vehicles, Routes, Stops, Students, Shifts, Clock Events, Messages, Incidents, and Vehicle Inspections.
- **Reusable Stops System**: Stops are defined independently and can be assigned to multiple routes, facilitating route planning and reusability.
- **Phone-Based Household System**: Automatically links parents to students via phone number matching, supporting multi-guardian scenarios and ensuring data consistency upon phone number updates.
- **Time Tracking**: Shift-based system with detailed clock in/out, break tracking, automatic clock-out, multi-segment support, and anomaly detection for payroll accuracy. Includes an admin exception queue and configurable settings.
- **Assignment-Based Scheduling**: Shifts are generated from driver assignments. Supports single-day scheduling and interactive bulk editing of shifts for multiple days and drivers.
- **Messaging System**:
    - **Route-Based**: Drivers message parents on their current routes; parents message drivers assigned to their children's routes.
    - **Admin Direct Messaging**: Admins can message any user. Admins can intervene in parent-driver conversations, with drivers receiving notifications of intervention and parents receiving messages with an "Admin Forwarded" badge.
- **Notification System**: Real-time tracking of unread messages and notifications with badges.
- **Announcement System**: 
    - Users can dismiss announcements
    - Drivers can broadcast route-specific announcements to parents
    - **Enhanced Admin Broadcasts**: Admins can send announcements to all drivers, all parents, or to all parents on a specific route via the admin announcements page
- **Incident Management**: Drivers report incidents, which admins can review, filter, and resolve.
- **Driver Assignment System**: Admins assign drivers to routes with specific vehicles and times. Updates to assignments cascade to future shifts.
- **Parent Student Management**: Parents can edit children's information, including demographics, emergency contacts, medical notes, and guardian phone numbers.
- **Student Attendance Tracking**: Comprehensive attendance system with three states (PENDING, riding, absent) for single days or date ranges. Features include:
  - **Live Admin Overview**: Real-time dashboard widget showing pending, riding, and absent counts with percentages
  - **Pending State**: Default state for students before driver marks attendance, ensuring visibility of unmarked students
  - **Real-Time Notifications**: WebSocket notifications alert drivers when parents update attendance while en route
  - **Attendance Analytics**: Monthly statistics and absence reports per student for payroll verification and route timing analysis
  - **Phone-Based Authorization**: All attendance operations respect household linking via guardian phone numbers
  - **Multi-Role Access**: Accessible by drivers (for assigned routes), parents (for their children), and admins (full system view)
- **Parent Dashboard Tutorial**: A dismissible tutorial banner introduces key features for new parent users.
- **Parent Dashboard Enhancements**: 
  - **Live ETA Countdown**: Displays estimated time until bus arrival when pickup is within 15-minute window, helping parents prepare children for pickup
  - **Quick Contact Actions**: Direct access to message driver, call driver (with phone number), and track vehicle from dashboard student cards
  - **Driver Information Display**: Shows assigned driver name and phone number for each student's route on current day
  - **Payment & Billing Section**: Profile section for billing inquiries and payment support with contact information for billing questions
  - **Account Management**: Self-service account deletion with confirmation dialog, household management tools, and family account oversight
- **Admin Audit Log**: Tracks all driver and parent actions (create, update, delete) with user context, entity type, description, and JSON change details, accessible via an admin UI with filtering and quick filters for Time Exceptions, Attendance Updates, and Route Messages.
- **Route Progress Tracking**: Real-time tracking of driver route progress with parent visibility, showing completed/skipped stops and estimated arrival times.
- **Real-Time Navigation Tracking**: Comprehensive GPS-based vehicle tracking system enabling live ETA calculations for parents:
  - **GPS Webhook Integration**: POST `/api/vehicles/gps-update` endpoint receives real-time location updates from external navigation software (e.g., Google Maps, Waze) with vehicle ID/plate number, latitude/longitude coordinates, and timestamps
  - **Distance Calculation**: Haversine formula implementation in `server/gps-utils.ts` calculates accurate distances between GPS coordinates accounting for Earth's curvature
  - **ETA Calculation**: Estimates arrival time based on current vehicle location, pickup stop coordinates, distance, and average speed (default 25 mph in urban areas)
  - **Parent Pickup Stop Selection**: Parents can view and select their preferred pickup stop from their child's assigned route via dropdown selector with real-time stop availability
  - **Live ETA Banner**: Auto-refreshing dashboard banner (30-second intervals) displays "Your child will be picked up in X minutes" with distance, stop name, and vehicle information when routes are active
  - **Security**: All parent endpoints enforce household ownership verification ensuring parents only access their own children's data
  - **Data Format**: GPS webhook accepts JSON with `vehicle_id` or `plate_number`, `latitude`/`longitude` (decimal degrees), and `timestamp` (ISO 8601)
- **Lead Driver Permissions**: `isLeadDriver` flag provides enhanced permissions for senior drivers, managed via the admin UI. Lead drivers are visually identified with a badge on their dashboard.
- **Driver Utilities System**: Comprehensive system for drivers to request supplies, submit vehicle inspection checklists, and provide feedback, with full admin management capabilities:
  - **Supplies Requests**: Drivers can request supplies with urgency levels, admins can approve/reject and track delivery status
  - **Vehicle Checklists**: Pre/post-trip inspection checklists for vehicle safety and maintenance tracking
  - **Driver Feedback**: System for drivers to submit improvement suggestions, bug reports, and feedback with admin response workflow
  - **Admin Management**: Centralized admin page for viewing and managing all driver utilities with status updates and notes
  - **Quick Feedback**: Floating action button on driver dashboard for easy access to feedback submission
- **Route Health Monitoring**: Real-time admin dashboard page showing active route status, driver availability (on-time, late, not started, no driver), student counts per route, and unresolved incidents with at-a-glance metrics for operational oversight.
- **Session Management**: PostgreSQL-backed sessions with a 7-day TTL and secure cookies.

## External Dependencies

### Third-Party Services
- **Replit Auth**: OpenID Connect provider for user authentication.
- **Neon Database**: Serverless PostgreSQL hosting.
- **Leaflet.js**: Mapping library for geographic visualizations.
- **Google Fonts**: Provides the Inter font family.

### Key NPM Packages
- `drizzle-orm`, `drizzle-kit`: ORM for database interaction and migrations.
- `@neondatabase/serverless`: PostgreSQL client for Neon.
- `ws`: WebSocket server implementation.
- `passport`, `openid-client`: Authentication middleware and OIDC client.
- `express-session`, `connect-pg-simple`: Session management.
- `@tanstack/react-query`: Client-side data fetching and caching.
- `date-fns`: Date utility library.
- `zod`: Runtime schema validation.
- Radix UI component primitives.