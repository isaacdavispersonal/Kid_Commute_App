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
    - **Admin Dashboard**: Desktop-optimized with sidebar, data tables, fleet maps, and a compact schedule calendar for high-volume scheduling, supporting all CRUD operations. Sidebar organized into three logical sections with separators: Core (Dashboard, Users, Students, Vehicles), Operations (Driver Assignments, Routes, Schedule), and Communication (Messages, Time Management, Incidents).
    - **Driver Interface**: Mobile-first with clock in/out and route cards.
    - **Parent Portal**: Real-time tracking and messaging.
- **Real-Time Features**: WebSocket integration for messaging, Leaflet.js for map visualization, polling for statistics.
- **Clutter Reduction Features**: Grouped/collapsible UI patterns reduce visual elements by 67% - incidents grouped by status, users tabbed by role, clock events grouped by driver, messages with Recent tab showing unread/read/archived sections, driver assignments grouped by driver with reassignment via edit dialog.
- **Navigation & Profile Access**: Profile settings removed from sidebar navigation for all roles and relocated to user dropdown menu in header (accessible via top-right user button) for cleaner navigation and improved UX.

### Backend Architecture
- **Server Framework**: Express.js on Node.js with TypeScript, ESM module system.
- **Authentication & Authorization**: Replit OpenID Connect (OIDC), Passport.js, role-based access control (admin, driver, parent), session-based authentication in PostgreSQL.
- **API Design**: RESTful APIs organized by user role, JSON format, structured error handling.
- **Real-Time Communication**: WebSocket server (`ws` library) for bidirectional messaging.

### Data Storage
- **Database**: PostgreSQL via Neon serverless with Drizzle ORM for type-safe queries.
- **Data Model**: Includes Users (multi-role), Households, HouseholdMembers, Vehicles, Routes, Stops, Students, Shifts, Clock Events, Messages, Incidents, and Vehicle Inspections.
- **Reusable Stops System**: Stops are independent entities (name and address only) that can be assigned to multiple routes. The `stops` table stores basic location data separately from routes. The `route_stops` junction table links routes to stops with sequencing (`stopOrder`) and optional `scheduledTime`. Admin UI includes inline stop creation/management through the "Manage Stops" dialog on each route for adding/removing/reordering stops. This design allows stop reuse across routes and simplifies route planning without needing GPS coordinates.
- **Phone-Based Household System**: Admins create students with guardian phone numbers, linking parents automatically upon registration via phone number matching. Supports multi-guardian scenarios. Parents can update their phone numbers through a dedicated workflow that automatically syncs changes to all children's guardian phone records, ensuring household access is never lost. The system prevents phone updates through the regular profile form for parents, directing them to use the "Change Phone" button which triggers the proper sync-and-relink flow.
- **Time Tracking & Payroll**: Shift-based system with clock in/out, multi-segment support, auto-clockout failsafe, detailed time calculations, and admin exception queue for payroll.
- **Assignment-Based Scheduling**: Simplified schedule creation where shifts are generated from existing driver assignments. Two scheduling methods:
  - **Single-Day Scheduling**: Admins can select entire drivers (all their assignments) or individual route assignments to add to the schedule for specific dates via the "Add from Assignments" dialog. Accessed by clicking the "+" icon on any calendar day.
  - **Interactive Bulk Edit**: Admins click "Bulk Edit" to enter selection mode, then click on multiple calendar days to select them. A floating action panel displays selected date count and driver checkboxes. Admins can add specific drivers to all selected dates or remove them in one operation. Days show visual feedback (blue border, checkbox) when selected. All shift details (route, vehicle, times, shift type) are inherited from driver assignments. Backend routes `/api/admin/shifts/bulk-add` and `/api/admin/shifts/bulk-delete` handle bulk operations efficiently.
- **Route-Based Messaging System**: Drivers message parents on their current routes; parents message drivers assigned to their children's routes. Messaging is strictly scoped by route assignments.
- **Admin Direct Messaging System**: Admins can message any driver, parent, or other admin directly. Drivers and parents can reply to admin messages without route restrictions. Admins can also intervene in parent-driver conversations: intervention messages are sent only to parents with a "Forwarded from Admin" badge, while drivers receive dismissible notifications indicating admin intervention. This preserves driver workflow while keeping parents informed.
- **Driver Notification System**: When admins intervene in parent-driver conversations, drivers receive notifications (not the message content). Notifications show which admin intervened and which parent's conversation was involved. Drivers can view the conversation or dismiss the notification. Unread notification counts appear in the sidebar badge.
- **Unread Notification System**: Real-time tracking of unread messages, announcements, and driver notifications with badges, automatic mark-as-read, and backend storage for read statuses.
- **Announcement Dismissal System**: Users can dismiss announcements separately from read status. Dismissed announcements are filtered from display for all user roles while maintaining read tracking for notification counts.
- **Route Announcement System**: Drivers can broadcast announcements to all parents whose children are on their assigned routes. Route announcements are scoped by route assignment with authorization checks to prevent cross-route access. Parents view route announcements from drivers assigned to their children's routes with dismiss and read tracking.
- **Incident Management System**: Drivers report incidents (severity, location, description); admins review, filter, and resolve incidents. Admin view groups incidents by Pending/Resolved status with collapsible sections.
- **Driver Assignment System**: Admins assign drivers to routes with vehicles and specify start/end times for each route. Each assignment defines which driver operates which route, with which vehicle, and at what times (e.g., "07:00 - 08:30"). Optional notes field for additional context. Admin view groups assignments by driver with collapsible sections showing route type tags and time ranges. Driver reassignment is done through the edit dialog.
- **Parent Student Management**: Parents can edit their children's information including names, demographics (height, race, gender), emergency contacts, medical notes, and guardian phone numbers. EditStudentDialog provides a comprehensive form with validation via updateStudentSchema. Parents can add/remove guardian phone numbers (minimum one required). Authorization is household-based via phone number matching.
- **Student Attendance Tracking**: Daily attendance tracking system with riding/absent status. Students are assumed to be riding by default until marked absent. The system supports both single-day and date range marking:
  - **Single-Day Marking**: Toggle between riding/absent for today with immediate feedback
  - **Date Range Marking**: When clicking "Absent", a dialog allows selecting an end date to mark multiple consecutive days at once, solving the multi-day absence problem
  - **Authorization**: Drivers mark attendance for students on their assigned routes via dedicated attendance page. Parents can mark their children's attendance from the children page. Admins have full access to mark any student's attendance
  - **Backend**: POST /api/attendance endpoint accepts optional `endDate` parameter and creates attendance records for all dates in the range with validation
- **Parent Dashboard Tutorial**: Dismissable tutorial banner on parent dashboard that introduces key features and navigation. Uses localStorage for persistence with dismiss functionality. Banner provides clear guidance on accessing children profiles, tracking routes, and using messaging features.
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