# FleetTrack - Transportation Service Management System

## Overview

FleetTrack is a comprehensive transportation service management system designed for fleet operations, route scheduling, and real-time communication. The platform serves three distinct user roles: administrators who manage the entire fleet and scheduling, drivers who handle daily operations and route assignments, and parents who track student transportation in real-time. The system emphasizes live vehicle tracking, efficient route management, and seamless communication between all stakeholders.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React with TypeScript for type-safe component development
- Vite as the build tool and development server, providing fast HMR and optimized production builds
- Wouter for lightweight client-side routing instead of React Router

**UI Component Library**
- shadcn/ui component system (New York variant) with Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- Design system inspired by fleet management platforms (Samsara) and school management systems (PowerSchool)

**State Management**
- TanStack Query (React Query) for server state management, data fetching, and caching
- No global state library - relying on React Query's built-in caching and React context where needed

**Role-Based Interface Design**
- Three distinct user experiences optimized for different workflows:
  - **Admin Dashboard**: Desktop-optimized with sidebar navigation, data tables, fleet maps, and statistics cards
  - **Driver Interface**: Mobile-first design with larger touch targets, clock in/out functionality, and route cards
  - **Parent Portal**: Real-time tracking interface with messaging capabilities

**Real-Time Features**
- WebSocket integration for live messaging between drivers and parents
- Leaflet.js for interactive map visualization and vehicle tracking
- Polling-based data refresh for statistics and fleet status updates

### Backend Architecture

**Server Framework**
- Express.js running on Node.js with TypeScript
- ESM module system throughout the codebase
- Modular route structure separating auth, admin, driver, and parent endpoints

**Authentication & Authorization**
- Replit OpenID Connect (OIDC) authentication integration
- Passport.js strategy for auth middleware
- Role-based access control with three user roles: admin, driver, parent
- Session-based authentication stored in PostgreSQL

**API Design**
- RESTful API endpoints organized by user role (`/api/admin/*`, `/api/driver/*`, `/api/parent/*`)
- Express middleware for authentication verification and role enforcement
- JSON request/response format with structured error handling

**Real-Time Communication**
- WebSocket server (ws library) for bidirectional messaging
- WebSocket endpoint at `/ws` for live updates
- Message broadcasting between connected clients

### Data Storage

**Database**
- PostgreSQL via Neon serverless with connection pooling
- Drizzle ORM for type-safe database queries and schema management
- Schema-first design with TypeScript types generated from database schema

**Data Model**
The system manages multiple interconnected entities:
- **Users**: Multi-role system (admin/driver/parent) with profile information and phone number for household linking
- **Households**: Family groups identified by primary phone number, linking parents to their students
- **HouseholdMembers**: Junction table linking users to households with role specification (PRIMARY/SECONDARY)
- **Vehicles**: Fleet management with status tracking and location data
- **Routes**: Scheduled transportation paths with associated stops
- **Stops**: Individual pickup/dropoff locations on routes
- **Students**: Passenger management with guardian phone numbers (array) and household linkage - admin-created only
- **Shifts**: Shift-based scheduling system supporting multiple shifts per day (MORNING, AFTERNOON, EXTRA) with planned start/end times and status tracking (SCHEDULED, ACTIVE, COMPLETED, MISSED)
- **Clock Events**: Detailed time tracking with clock IN/OUT events per shift, supporting multiple punch segments, auto-clockout failsafe, and resolution tracking for data quality issues
- **Messages**: Communication threads between drivers and parents
- **Incidents**: Safety and operational issue reporting
- **Vehicle Inspections**: Pre-trip inspection records and maintenance tracking

**Phone-Based Household System**
- **Admin-Driven Student Creation**: Admins add students with guardian phone numbers; system auto-creates/links households
- **Automatic Parent Linking**: When parents register with a phone matching a student's guardian phone, they're automatically linked to that household
- **Security**: Parents cannot manually add students or claim children that aren't theirs - all linking happens via phone number matching
- **Multi-Guardian Support**: Students can have multiple guardian phone numbers for shared custody scenarios
- **Empty State Handling**: If a parent's phone doesn't match any students, they see a "no students found" message

**Time Tracking & Payroll**
- **Shift-Based System**: Drivers work in discrete shifts (morning/afternoon/extra) with separate time tracking per shift
- **Clock In/Out**: Drivers clock in/out via mobile-optimized interface with real-time elapsed time display
- **Multi-Segment Support**: System handles multiple clock-in/out pairs per shift (e.g., lunch breaks, interruptions)
- **Auto-Clockout Failsafe**: Automatically closes orphaned clock-in events after configurable grace period (default 2 hours) to prevent runaway hours
- **Time Calculations**: `calculateShiftHours` utility computes accurate hours from punch segments, handles duplicate clock-ins by closing at new IN timestamp, caps orphaned spans at shift end + grace period
- **Driver Time History**: Comprehensive view of all past shifts with calculated hours, punch segments, and daily/weekly summaries
- **Admin Time Exceptions Queue**: Review and resolve unresolved clock events with shift context enrichment and manual resolution workflow
- **Reporting Endpoints**: Backend API provides driver hours summaries, payroll aggregates, and shift-specific time details for compliance and reporting

**Session Management**
- PostgreSQL-backed sessions using connect-pg-simple
- Session table for persistent authentication across server restarts
- 7-day session TTL with secure, HTTP-only cookies

### External Dependencies

**Third-Party Services**
- **Replit Auth**: OpenID Connect authentication provider for user identity management
- **Neon Database**: Serverless PostgreSQL hosting with automatic connection pooling
- **Leaflet.js**: Open-source mapping library for real-time vehicle visualization (CDN-loaded)
- **Google Fonts**: Inter font family for consistent typography

**Key NPM Packages**
- `drizzle-orm` and `drizzle-kit`: Database ORM and migration tooling
- `@neondatabase/serverless`: Neon-specific PostgreSQL client with WebSocket support
- `ws`: WebSocket server implementation
- `passport` and `openid-client`: Authentication middleware and OIDC client
- `express-session` and `connect-pg-simple`: Session management
- `@tanstack/react-query`: Client-side data fetching and caching
- `date-fns`: Date manipulation and formatting
- `zod`: Runtime type validation and schema definition
- Comprehensive Radix UI component primitives for accessible UI components

**Development Tools**
- `tsx`: TypeScript execution for development server
- `esbuild`: Fast bundling for production server code
- Replit-specific plugins for development experience (cartographer, dev banner, runtime error overlay)