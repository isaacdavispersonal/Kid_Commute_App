# Transportation Service Management System - Design Guidelines

## Design Approach
**Reference-Based**: Drawing from fleet management platforms (Samsara) and school management systems (PowerSchool), prioritizing functional clarity, data visualization, and role-specific interfaces.

## Core Design Principles
1. **Role-Specific Optimization**: Each user type (Admin, Driver, Parent) gets tailored interfaces optimized for their workflows
2. **Information Hierarchy**: Critical data always visible, secondary information accessible within 1-2 clicks
3. **Real-time Clarity**: Live data updates presented clearly without overwhelming users
4. **Mobile-First for Field Users**: Drivers and parents get fully optimized mobile experiences

## Typography
- **Font Family**: Inter (primary), system fallback stack
- **Admin Dashboard**: 
  - Page Headers: text-2xl/font-semibold
  - Section Titles: text-lg/font-medium
  - Body/Data: text-sm/font-normal
  - Metrics/Stats: text-3xl/font-bold
- **Driver Interface**: Slightly larger for mobile readability (text-base minimum)
- **Parent Portal**: Standard sizing with clear labels

## Layout System
- **Spacing Units**: Use Tailwind units of 2, 4, 5, 6, 8, 10, 12, 16, 20
- **Container Max Width**: max-w-7xl for admin dashboard, max-w-4xl for driver/parent interfaces
- **Grid System**: 12-column grid with responsive breakpoints
- **Card Padding**: p-5 or p-6 consistently across all interfaces

## Color Application
- **Primary (#2563EB)**: Main actions, active states, key navigation
- **Secondary (#10B981)**: Success states, availability indicators, positive confirmations
- **Warning (#F59E0B)**: Alerts, pending states, attention needed
- **Danger (#EF4444)**: Critical alerts, vehicle issues, emergency indicators
- **Background (#F8FAFC)**: Main app background
- **Cards (#FFFFFF)**: All card/panel backgrounds with subtle shadow
- **Text (#1E293B)**: Primary text, headers, labels

## Component Library

### Admin Dashboard Components
- **Sidebar Navigation**: Fixed left sidebar (280px) with collapsible sections, active states with primary color accent
- **Top Bar**: Search, notifications, user profile, live status indicators
- **Data Tables**: Sortable columns, pagination, quick filters, row actions menu
- **Live Fleet Map**: Full-width map container with overlay controls and vehicle markers
- **Statistics Cards**: 4-column grid on desktop, metric value + label + trend indicator
- **Route Builder**: Interactive drag-drop interface with timeline visualization
- **Schedule Grid**: Calendar-style weekly view with color-coded routes

### Driver Interface Components
- **Clock In/Out Card**: Prominent card at top with large button and current status
- **Route Card**: Expandable accordion showing stops, times, student names
- **Quick Message Templates**: Grid of 6-8 common responses for parent communication
- **Vehicle Checklist**: Step-by-step form with checkboxes and photo upload
- **Incident Report Form**: Multi-step form with severity levels and media uploads

### Parent Portal Components
- **Student Cards**: Photo, name, assigned route, pickup/dropoff times
- **Live Tracking View**: Full-screen map with vehicle location and ETA
- **Message Thread**: Chat-style interface with driver, timestamps
- **Notification Feed**: Chronological list with type indicators (pickup, delay, message)

### Shared Components
- **Status Badges**: Rounded pills with text-xs, colored backgrounds matching state (active/inactive/delayed/completed)
- **Action Buttons**: Primary (filled with primary color), Secondary (outlined), Danger (filled with danger color)
- **Modal Dialogs**: Centered overlay with white card, max-w-md to max-w-2xl depending on content
- **Toast Notifications**: Top-right positioned, auto-dismiss with success/error/warning variants

## Responsive Breakpoints
- **Mobile** (< 768px): Single column, bottom navigation for drivers/parents, collapsible sidebar for admin
- **Tablet** (768px - 1024px): 2-column layouts, visible sidebar
- **Desktop** (> 1024px): Full multi-column layouts, permanent sidebar

## Data Visualization
- **Vehicle Markers**: Color-coded by status (active green, idle amber, offline red)
- **Route Lines**: Dashed lines on map with directional arrows
- **Progress Indicators**: Linear progress bars for route completion
- **Time-based Charts**: Line graphs for historical data (incidents, on-time rates)

## Interaction Patterns
- **Navigation**: Persistent sidebar for admin, bottom nav bar for mobile driver/parent
- **Real-time Updates**: Subtle pulse animation on live data elements
- **Form Validation**: Inline error messages below fields, success checkmarks
- **Loading States**: Skeleton screens for data-heavy views, spinners for actions
- **Confirmations**: Modal dialogs for destructive actions (delete, clock-out)

## Mobile Optimization
- **Touch Targets**: Minimum 44px height for all interactive elements
- **Swipe Actions**: Swipe-to-reveal secondary actions on message threads
- **Pull-to-Refresh**: Standard gesture for live data updates
- **Bottom Sheet Modals**: Mobile-optimized overlays that slide up from bottom

## Accessibility
- Consistent ARIA labels on all interactive elements
- Color never the sole indicator of state (pair with icons/text)
- Keyboard navigation support for all admin dashboard functions
- Focus indicators on all interactive elements (ring-2 ring-primary)

## Performance Considerations
- Lazy load map markers for large fleets (>50 vehicles)
- Paginate data tables (25 rows default)
- Debounce search inputs (300ms)
- Optimize real-time updates to prevent excessive re-renders