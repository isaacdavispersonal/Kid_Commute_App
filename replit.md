# FleetTrack - Transportation Service Management System

## Overview
FleetTrack is a comprehensive transportation service management system for fleet operations, route scheduling, and real-time communication. It supports administrators, drivers, and parents, offering live vehicle tracking, efficient route management, and seamless communication. The system aims to enhance efficiency, safety, and communication within transportation services.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework & Build System**: React with TypeScript, Vite, Wouter for routing.
- **UI Component Library**: shadcn/ui (New York variant) with Radix UI, Tailwind CSS for styling.
- **State Management**: TanStack Query for server state, data fetching, and caching.
- **Role-Based Interface Design**:
    - **Admin Dashboard**: Desktop-optimized with sidebar, data tables, fleet maps, and a compact schedule calendar for high-volume scheduling, supporting all CRUD operations.
    - **Driver Interface**: Mobile-first with clock in/out and route cards.
    - **Parent Portal**: Real-time tracking and messaging.
- **Real-Time Features**: WebSocket integration for messaging, Leaflet.js for map visualization, polling for statistics.
- **Clutter Reduction Features**: Grouped/collapsible UI patterns reduce visual elements by 67% - incidents grouped by status, users tabbed by role, clock events grouped by driver, messages with Recent tab showing unread/read/archived sections, driver assignments grouped by driver with reassignment via edit dialog.

### Backend Architecture
- **Server Framework**: Express.js on Node.js with TypeScript, ESM module system.
- **Authentication & Authorization**: Replit OpenID Connect (OIDC), Passport.js, role-based access control (admin, driver, parent), session-based authentication in PostgreSQL.
- **API Design**: RESTful APIs organized by user role, JSON format, structured error handling.
- **Real-Time Communication**: WebSocket server (`ws` library) for bidirectional messaging.

### Data Storage
- **Database**: PostgreSQL via Neon serverless with Drizzle ORM for type-safe queries.
- **Data Model**: Includes Users (multi-role), Households, HouseholdMembers, Vehicles, Routes, Stops, Students, Shifts, Clock Events, Messages, Incidents, and Vehicle Inspections.
- **Phone-Based Household System**: Admins create students with guardian phone numbers, linking parents automatically upon registration via phone number matching. Supports multi-guardian scenarios.
- **Time Tracking & Payroll**: Shift-based system with clock in/out, multi-segment support, auto-clockout failsafe, detailed time calculations, and admin exception queue for payroll.
- **Route-Based Messaging System**: Drivers message parents on their current routes; parents message drivers assigned to their children's routes. Messaging is strictly scoped by route assignments.
- **Admin Direct Messaging System**: Admins can message any driver, parent, or other admin directly. Drivers and parents can reply to admin messages without route restrictions. Admins can also intervene in parent-driver conversations: intervention messages are sent only to parents with a "Forwarded from Admin" badge, while drivers receive dismissible notifications indicating admin intervention. This preserves driver workflow while keeping parents informed.
- **Driver Notification System**: When admins intervene in parent-driver conversations, drivers receive notifications (not the message content). Notifications show which admin intervened and which parent's conversation was involved. Drivers can view the conversation or dismiss the notification. Unread notification counts appear in the sidebar badge.
- **Unread Notification System**: Real-time tracking of unread messages, announcements, and driver notifications with badges, automatic mark-as-read, and backend storage for read statuses.
- **Announcement Dismissal System**: Users can dismiss announcements separately from read status. Dismissed announcements are filtered from display for all user roles while maintaining read tracking for notification counts.
- **Route Announcement System**: Drivers can broadcast announcements to all parents whose children are on their assigned routes. Route announcements are scoped by route assignment with authorization checks to prevent cross-route access. Parents view route announcements from drivers assigned to their children's routes with dismiss and read tracking.
- **Incident Management System**: Drivers report incidents (severity, location, description); admins review, filter, and resolve incidents. Admin view groups incidents by Pending/Resolved status with collapsible sections.
- **Driver Assignment System**: Admins assign drivers to routes with vehicles and schedules. Admin view groups assignments by driver with collapsible sections. Driver reassignment is done through the edit dialog to keep the list view clean and consolidate all editing actions.
- **Session Management**: PostgreSQL-backed sessions using `connect-pg-simple` with a 7-day TTL and secure cookies.

## External Dependencies

### Third-Party Services
- **Replit Auth**: OpenID Connect provider.
- **Neon Database**: Serverless PostgreSQL hosting.
- **Leaflet.js**: Open-source mapping library.
- **Google Fonts**: Inter font family.

### Key NPM Packages
- `drizzle-orm` and `drizzle-kit`: Database ORM and migration.
- `@neondatabase/serverless`: Neon-specific PostgreSQL client.
- `ws`: WebSocket server.
- `passport` and `openid-client`: Authentication middleware and OIDC client.
- `express-session` and `connect-pg-simple`: Session management.
- `@tanstack/react-query`: Client-side data fetching.
- `date-fns`: Date manipulation.
- `zod`: Runtime type validation.
- Radix UI component primitives.