# Kid Commute - Figma Design Handoff Document

## Overview

**Kid Commute** is a comprehensive transportation service management system designed for school bus and fleet operations. It provides real-time vehicle tracking, route management, and seamless communication between three user types: **Administrators**, **Drivers**, and **Parents**.

The app prioritizes safety, efficiency, and communication - helping administrators manage fleets, drivers navigate their routes, and parents track their children's transportation in real-time.

---

## Part 1: Design Tokens

### Color Palette

#### Light Mode Colors
| Token Name | HSL Value | Hex Approximation | Usage |
|------------|-----------|-------------------|-------|
| `--background` | `210 20% 98%` | #F8FAFC | Main app background |
| `--foreground` | `215 25% 15%` | #1E293B | Primary text |
| `--card` | `0 0% 100%` | #FFFFFF | Card/panel backgrounds |
| `--card-foreground` | `215 25% 15%` | #1E293B | Text on cards |
| `--primary` | `217 91% 60%` | #2563EB | Main actions, active states |
| `--primary-foreground` | `0 0% 100%` | #FFFFFF | Text on primary buttons |
| `--secondary` | `210 14% 90%` | #E2E8F0 | Secondary backgrounds |
| `--secondary-foreground` | `215 25% 20%` | #334155 | Text on secondary |
| `--muted` | `210 12% 92%` | #E5E7EB | Muted backgrounds |
| `--muted-foreground` | `215 15% 45%` | #64748B | Secondary text, captions |
| `--accent` | `210 16% 92%` | #E8EEF4 | Hover states, highlights |
| `--destructive` | `0 84% 60%` | #EF4444 | Error states, delete actions |
| `--success` | `158 64% 52%` | #10B981 | Success states, confirmations |
| `--warning` | `38 92% 50%` | #F59E0B | Warnings, pending states |
| `--border` | `214 15% 88%` | #E2E8F0 | General borders |
| `--sidebar` | `210 17% 96%` | #F1F5F9 | Sidebar background |
| `--popover` | `0 0% 100%` | #FFFFFF | Dropdown/popover backgrounds |

#### Dark Mode Colors
| Token Name | HSL Value | Hex Approximation |
|------------|-----------|-------------------|
| `--background` | `222 20% 10%` | #151A23 |
| `--foreground` | `210 40% 92%` | #E2E8F0 |
| `--card` | `220 18% 14%` | #1E2530 |
| `--card-foreground` | `210 40% 92%` | #E2E8F0 |
| `--primary` | `217 91% 60%` | #2563EB |
| `--secondary` | `220 16% 24%` | #334155 |
| `--muted` | `220 14% 20%` | #27303D |
| `--muted-foreground` | `215 15% 65%` | #94A3B8 |
| `--accent` | `220 16% 22%` | #2D3748 |
| `--sidebar` | `220 18% 16%` | #1E2530 |

#### Semantic Status Colors
| Status | Color | HSL |
|--------|-------|-----|
| Active/On Time | Green | `158 64% 52%` |
| Warning/Late | Amber | `38 92% 50%` |
| Error/Critical | Red | `0 84% 60%` |
| Info/Primary | Blue | `217 91% 60%` |
| Neutral/Inactive | Gray | `215 15% 45%` |

#### Chart Colors
| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--chart-1` | `217 91% 60%` | Primary data series (blue) |
| `--chart-2` | `158 64% 52%` | Success/positive (green) |
| `--chart-3` | `38 92% 50%` | Warning series (amber) |
| `--chart-4` | `271 81% 56%` | Additional series (purple) |
| `--chart-5` | `0 84% 60%` | Error/negative (red) |

---

### Typography

| Level | Tailwind Class | Font Size | Font Weight | Usage |
|-------|----------------|-----------|-------------|-------|
| Page Header | `text-2xl font-semibold` | 24px | 600 | Page titles |
| Section Title | `text-lg font-medium` | 18px | 500 | Card headers, sections |
| Card Title | `text-base font-medium` | 16px | 500 | Card titles |
| Body | `text-sm font-normal` | 14px | 400 | General content |
| Caption | `text-xs text-muted-foreground` | 12px | 400 | Timestamps, hints |
| Metrics | `text-3xl font-bold` | 30px | 700 | Large stat numbers |
| Buttons | `text-sm font-medium` | 14px | 500 | Button labels |

**Font Family:** Inter (primary), with system fallback stack:
```
Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
```

---

### Spacing System

Base unit: **4px** (0.25rem)

| Name | Value | Tailwind | Usage |
|------|-------|----------|-------|
| xs | 4px | `space-1` / `p-1` | Tight spacing |
| sm | 8px | `space-2` / `p-2` | Compact elements |
| md | 12px | `space-3` / `p-3` | Standard gaps |
| base | 16px | `space-4` / `p-4` | Default padding |
| lg | 20px | `space-5` / `p-5` | Card padding |
| xl | 24px | `space-6` / `p-6` | Section spacing |
| 2xl | 32px | `space-8` | Large gaps |

**Key Spacing Patterns:**
- Card padding: `p-5` or `p-6` (20-24px)
- Section gaps: `space-y-6` (24px)
- Element gaps: `gap-4` (16px)
- Tight groupings: `gap-2` (8px)

---

### Border Radius

| Name | Value | Tailwind | Usage |
|------|-------|----------|-------|
| Default | 8px | `rounded-md` | Cards, buttons, inputs |
| Small | 6px | `rounded-sm` | Badges, small elements |
| Full | 9999px | `rounded-full` | Avatars, circular icons |

---

### Shadows

| Name | CSS Value | Usage |
|------|-----------|-------|
| `--shadow-sm` | `0px 1px 3px 0px hsl(215 25% 15% / 0.08)` | Subtle elevation |
| `--shadow` | `0px 2px 4px -1px hsl(215 25% 15% / 0.06)` | Cards |
| `--shadow-md` | `0px 4px 6px -1px hsl(215 25% 15% / 0.08)` | Floating elements |
| `--shadow-lg` | `0px 10px 15px -3px hsl(215 25% 15% / 0.10)` | Modals, popovers |

---

## Part 2: Component Library

### Buttons

#### Variants
| Variant | Background | Text | Border | Usage |
|---------|------------|------|--------|-------|
| `default` | Primary | White | None | Main actions |
| `secondary` | Secondary | Dark | None | Secondary actions |
| `outline` | Transparent | Foreground | Border | Tertiary actions |
| `ghost` | Transparent | Foreground | None | Subtle actions |
| `destructive` | Red | White | None | Delete, cancel |

#### Sizes
| Size | Height | Padding | Usage |
|------|--------|---------|-------|
| `default` | 36px (min-h-9) | 16px horizontal | Standard desktop |
| `sm` | 32px (min-h-8) | 12px horizontal | Compact areas |
| `lg` | 40px (min-h-10) | 32px horizontal | Prominent actions |
| `touch` | 44px (min-h-11) | 16px horizontal | **Mobile (iOS 44pt)** |
| `icon` | 36px square | None | Icon-only buttons |
| `icon-touch` | 44px square | None | **Mobile icon buttons** |

### Badges / Status Pills

| Variant | Background | Text | Usage |
|---------|------------|------|-------|
| `default` | Primary | White | Active states |
| `secondary` | Secondary | Dark | Neutral info |
| `outline` | Transparent | Foreground | Subtle labels |
| `destructive` | Red | White | Errors, critical |

**Status Badge Examples:**
- "Active" - Green background, white text
- "Pending" - Amber/yellow background
- "Inactive" - Gray background
- "Complete" - Green with checkmark icon

### Cards

- Background: `--card` (white in light mode)
- Border: `--card-border` (subtle gray)
- Border radius: 8px (`rounded-md`)
- Padding: 20-24px (`p-5` or `p-6`)
- Shadow: `--shadow-sm`

**Card Anatomy:**
```
┌─────────────────────────────────────┐
│ CardHeader (pb-3)                   │
│   CardTitle (text-base font-medium) │
│   CardDescription (text-sm muted)   │
├─────────────────────────────────────┤
│ CardContent                         │
│   [Content goes here]               │
├─────────────────────────────────────┤
│ CardFooter (pt-4, flex gap-2)       │
│   [Actions go here]                 │
└─────────────────────────────────────┘
```

### Form Inputs

- Height: 40px (`h-10`)
- Font size: 16px (prevents iOS zoom)
- Border: 1px `--input` color
- Border radius: 8px
- Padding: 12px horizontal
- Focus: 2px ring in primary color

### Dialogs / Modals

- Max width: `max-w-md` to `max-w-2xl`
- Max height: `max-h-[90dvh]` (90% of dynamic viewport)
- Background: Card color
- Overlay: Black at 50% opacity
- Border radius: 12px (`rounded-lg`)
- Padding: 24px

### Navigation

**Desktop Admin Sidebar:**
- Width: 280px (collapsible to 64px icon mode)
- Background: `--sidebar`
- Active item: Primary color accent on left border

**Mobile Bottom Navigation:**
- Height: 56px + safe area
- Background: Card color
- Active icon: Primary color

---

## Part 3: Application Pages & Features

### User Roles

The app serves three distinct user types with role-specific interfaces:

| Role | Interface | Primary Device | Key Functions |
|------|-----------|----------------|---------------|
| **Admin** | Desktop Dashboard | Desktop/Tablet | Fleet management, oversight |
| **Driver** | Mobile-first App | Phone/Tablet | Route execution, attendance |
| **Parent** | Mobile Portal | Phone | Child tracking, messaging |

---

### Admin Pages

#### 1. Dashboard (`/admin`)
**Purpose:** Central command center for fleet operations

**Key Elements:**
- **Stats Grid (4 columns):** Active vehicles, drivers, routes, students
- **Attendance Overview:** Real-time counts (pending, riding, absent)
- **Timecard Anomalies Alert:** Yellow warning card for clock issues
- **Active Drivers List:** Currently clocked-in drivers with routes
- **Recent Incidents:** Latest 5 incidents with severity badges

#### 2. Fleet Map (`/admin/fleet-map`)
**Purpose:** Live GPS tracking of all vehicles

**Key Elements:**
- Full-width Leaflet.js map
- Vehicle markers (color-coded by status)
- Vehicle list panel (collapsible)
- Auto-refresh every 30 seconds

#### 3. Vehicles (`/admin/vehicles`)
**Purpose:** Fleet inventory management

**Key Elements:**
- Data table with columns: Name, Plate, Capacity, Status, Driver
- Add/Edit vehicle dialog
- Samsara ID integration field
- Delete confirmation modal

#### 4. Routes (`/admin/routes`)
**Purpose:** Route configuration and scheduling

**Key Elements:**
- Route cards with stop count, time range
- Route type badges (Morning/Afternoon/Extra)
- Route group assignments
- Stop ordering interface

#### 5. Stops (`/admin/stops`)
**Purpose:** Manage pickup/dropoff locations

**Key Elements:**
- Data table with name, address, coordinates
- Create/Edit stop dialog with map picker
- Automatic 100m geofence creation

#### 6. Students (`/admin/students`)
**Purpose:** Student records and route assignments

**Key Elements:**
- Student cards with photo placeholder, name, guardian info
- Multi-route assignment (morning, afternoon, extra)
- Attendance status override
- Medical notes, allergies, special needs fields

#### 7. Driver Assignments (`/admin/driver-assignments`)
**Purpose:** Assign drivers to routes

**Key Elements:**
- Grouped by driver (collapsible sections)
- Bulk assignment for multiple routes
- Vehicle assignment (optional)
- Notes field for special instructions

#### 8. Schedule (`/admin/schedule`)
**Purpose:** Weekly shift calendar view

**Key Elements:**
- Week view grid (7 days)
- Shift cards with driver, route, vehicle
- Drag-and-drop scheduling
- Time conflict warnings

#### 9. Time Management (`/admin/time-management`)
**Purpose:** Clock event oversight and corrections

**Key Elements:**
- Tabs: Overview, Exceptions
- Clock event timeline by driver
- Edit timestamps dialog
- Auto-clockout resolution tools

#### 10. Incidents (`/admin/incidents`)
**Purpose:** Review driver-reported incidents

**Key Elements:**
- Incident cards with severity badge
- Filter: All, Pending, Resolved
- Detail view with student/route context
- Resolve action button

#### 11. Users (`/admin/users`)
**Purpose:** User account management

**Key Elements:**
- Tabs: All, Admins, Drivers, Parents
- Role change dropdown with confirmation
- Lead Driver toggle switch
- User status badges

#### 12. Announcements (`/admin/announcements`)
**Purpose:** Broadcast messages to users

**Key Elements:**
- Target selector: All Drivers, All Parents, Specific Route
- Title and message fields
- Route dropdown (when route-specific)
- Send button with confirmation

#### 13. Geofences (`/admin/geofences`)
**Purpose:** Geographic boundary management

**Key Elements:**
- Geofence table with type, coordinates, radius
- Types: SCHOOL, STOP, CUSTOM
- Active/Inactive toggle
- Map preview in edit dialog

#### 14. Route Health (`/admin/route-health`)
**Purpose:** Real-time route status monitoring

**Key Elements:**
- Stats cards: Active routes, Issues, Incidents
- Route status list with driver status badges
- Badges: On Time, Late, Not Started, No Driver

#### 15. Activity & Operations (`/admin/activity-operations`)
**Purpose:** Consolidated operational tools

**Tabs:**
- Route Health (live status)
- Driver Utilities (supply requests, checklists)
- Audit Log (action history)
- Time Management (clock events)

#### 16. Settings (`/admin/settings`)
**Purpose:** System configuration

**Sections:**
- GPS Provider settings
- Payment portal configuration
- Notification preferences
- Data retention settings

#### 17. Payroll Exports (`/admin/payroll-exports`)
**Purpose:** BambooHR integration for payroll

**Key Elements:**
- Driver-to-employee mapping table
- Date range picker
- Preview calculated hours
- Export to BambooHR button

---

### Driver Pages

#### 1. Dashboard (`/driver`)
**Purpose:** Daily operations hub

**Key Elements:**
- **Clock Card:** Large clock in/out button, elapsed time display
- **Break Toggle:** Start/End break button
- **Today's Shifts:** Shift cards with route, vehicle, times
- **Quick Actions:** Navigate to routes, messages
- **Emergency Button:** Prominent red alert button

**Shift Card Anatomy:**
```
┌─────────────────────────────────────┐
│ Route Name              [AM Badge]  │
│ 6:30 AM - 8:00 AM                   │
│ Bus 12 (ABC-1234)                   │
├─────────────────────────────────────┤
│ [Inspect] [Start Route]             │
└─────────────────────────────────────┘
```

#### 2. Routes (`/driver/routes`)
**Purpose:** Today's route overview

**Key Elements:**
- Today's route card with all stops
- Stop timeline with scheduled times
- Student count per stop
- Route completion progress bar

#### 3. Route Detail (`/driver/route/:id`)
**Purpose:** Active route execution

**Key Elements:**
- **Route Header:** Name, vehicle, time range, progress counter
- **Inspection Gate:** Must complete before starting
- **Stop Cards (vertical list):**
  - Stop name, scheduled time
  - Student list with attendance buttons
  - Mark Complete / Skip buttons
- **Attendance Panel:** Quick riding/absent toggles
- **Complete Route Button:** Appears when all stops done

**Stop Card States:**
- Pending: Default card style
- Current: Primary border highlight
- Completed: Green background, checkmark
- Skipped: Muted/strikethrough

#### 4. Attendance (`/driver/attendance`)
**Purpose:** Dedicated attendance tracking

**Key Elements:**
- Student list grouped by stop
- Large touch targets for Riding/Absent
- Attendance summary counts
- Real-time sync indicator

#### 5. Inspection (`/driver/inspection`)
**Purpose:** Quick pre-trip checklist

**Key Elements:**
- Checklist items with checkboxes:
  - Tires, Lights, Brakes, Fluids, Cleanliness
- Notes text field
- Submit button (disabled until all checked)

#### 6. Checklist (`/driver/checklist`)
**Purpose:** Detailed vehicle inspection form

**Key Elements:**
- Pre-trip / Post-trip selector
- Vehicle dropdown
- Extended checklist items
- Odometer reading input
- Fuel level selector
- Issue description field
- Previous checklists history

#### 7. Messages (`/driver/messages`)
**Purpose:** Parent communication

**Key Elements:**
- **Contact List:** Parents with unread badges
- **Conversation View:** Chat bubbles, timestamps
- **Quick Replies:** Preset message buttons
- **Announcements Section:** Admin broadcasts
- **Route Announcement Form:** Broadcast to all parents

#### 8. Incident Report (`/driver/incident`)
**Purpose:** Report safety incidents

**Key Elements:**
- Title, description fields
- Severity selector: Low, Medium, High, Critical
- Location field
- Optional: Select involved student
- Optional: Select related route
- Submit button

#### 9. Time History (`/driver/time-history`)
**Purpose:** Personal time tracking

**Key Elements:**
- Shift list with calculated hours
- Planned vs. actual hours comparison
- Clock event timeline per shift
- Edit clock event dialog (for corrections)
- Summary stats: Total hours this week/month

#### 10. Supplies (`/driver/supplies`)
**Purpose:** Request vehicle supplies

**Key Elements:**
- Item name field
- Quantity input
- Urgency selector: Low, Medium, High
- Reason text field
- Previous requests list

#### 11. Announcements (`/driver/announcements`)
**Purpose:** View admin broadcasts

**Key Elements:**
- Announcement cards with title, content, date
- Dismiss button on each
- Unread indicator badge

#### 12. Feedback (`/driver/feedback`)
**Purpose:** Submit app feedback

**Key Elements:**
- Category selector: Bug, Feature, UI Issue
- Description field
- Status tracking for past submissions

---

### Parent Pages

#### 1. Dashboard (`/parent`)
**Purpose:** Children's transportation overview

**Key Elements per Child Card:**
- Student name and avatar
- Assigned route name with type badge
- **Pickup/Dropoff Info:** Stop name, scheduled time
- **Live ETA Countdown:** "Bus arriving in 12 minutes"
- **Route Progress Bar:** X of Y stops completed
- **Status Badge:** "En Route", "Picked Up", "Approaching"
- **Quick Actions:** Track Live, Message Driver, Call Driver

**Child Card Anatomy:**
```
┌─────────────────────────────────────┐
│ [Avatar] Emma Johnson               │
│ Morning Route - Bus 12              │
├─────────────────────────────────────┤
│ Pickup: Oak Street Stop @ 7:15 AM   │
│ Status: [En Route] 3 stops away     │
│ ████████████░░░░░░░ 4/6 stops       │
├─────────────────────────────────────┤
│ [Track Live] [Message] [Call]       │
└─────────────────────────────────────┘
```

#### 2. Tracking (`/parent/tracking`)
**Purpose:** Live vehicle map

**Key Elements:**
- Full-screen Leaflet map
- Vehicle marker with popup
- Vehicle name and route info card
- Auto-refresh every 10 seconds

#### 3. Children (`/parent/children`)
**Purpose:** Manage child information

**Key Elements:**
- **Phone Number Status Card:** Connection status
- **Child Cards (for each student):**
  - Edit student info button
  - Route assignment display
  - Pickup stop selector dropdown
  - Route progress section
  - Attendance status
  - Medical/special needs info

#### 4. Messages (`/parent/messages`)
**Purpose:** Driver and admin communication

**Key Elements:**
- **Announcements Section:** Admin broadcasts with dismiss
- **Contact List:** Assigned drivers + Admin Support
- **Conversation View:** Chat interface with message bubbles
- **Admin Messages:** Distinct styling (yellow background)
- **Message Input:** Text field with send button

---

## Part 4: Interaction Patterns

### Touch Targets (iOS Accessibility)
- All buttons: **44px minimum** touch target height
- Icon buttons: **44x44px** minimum
- Form inputs: 40px height with 16px font (prevents iOS zoom)

### Loading States
- **Skeleton screens:** Gray placeholder shapes during data load
- **Button spinners:** Inline spinner icon during mutations
- **Disabled state:** Reduced opacity, no pointer events

### Real-Time Updates
- WebSocket connections for live data
- Pull-to-refresh on mobile pages
- Subtle pulse animation on updating elements
- Toast notifications for completed actions

### Form Patterns
- Inline validation errors below fields
- Required fields marked with asterisk
- Submit button disabled until valid
- Loading state during submission

### Confirmations
- Destructive actions require confirmation dialog
- Clock-out requires explicit confirmation
- Delete operations show warning modal

### Mobile Gestures
- Pull-to-refresh on list pages
- Swipe to reveal actions (where applicable)
- Bottom sheet modals for mobile dialogs

---

## Part 5: Page Layout Templates

### Admin Desktop Layout
```
┌─────────┬────────────────────────────────────┐
│ Sidebar │ Header (breadcrumb, user menu)     │
│ (280px) ├────────────────────────────────────┤
│         │                                    │
│ Nav     │ Main Content Area                  │
│ Items   │ (scrollable)                       │
│         │                                    │
│         │ - Page Title                       │
│         │ - Stats Cards                      │
│         │ - Data Tables / Cards              │
│         │                                    │
└─────────┴────────────────────────────────────┘
```

### Driver Mobile Layout
```
┌────────────────────────────────────┐
│ Header (collapsed sidebar toggle)   │
├────────────────────────────────────┤
│                                    │
│ Main Content (scrollable)          │
│                                    │
│ - Clock Status Card                │
│ - Today's Shifts                   │
│ - Action Cards                     │
│                                    │
├────────────────────────────────────┤
│ Bottom Nav (if applicable)         │
└────────────────────────────────────┘
```

### Parent Mobile Layout
```
┌────────────────────────────────────┐
│ Header                             │
├────────────────────────────────────┤
│                                    │
│ Main Content (scrollable)          │
│                                    │
│ - Child Cards                      │
│ - Tracking / Messages              │
│                                    │
├────────────────────────────────────┤
│ Bottom Nav                         │
└────────────────────────────────────┘
```

---

## Part 6: Icon Usage

The app uses **Lucide React** icons. Key icons by feature:

| Feature | Icon | Usage |
|---------|------|-------|
| Dashboard | `LayoutDashboard` | Nav item |
| Vehicles | `Bus`, `Truck` | Fleet items |
| Routes | `Route`, `MapPin` | Navigation |
| Students | `Users`, `GraduationCap` | People |
| Clock | `Clock`, `Timer` | Time tracking |
| Messages | `MessageSquare`, `Send` | Communication |
| Settings | `Settings`, `Cog` | Configuration |
| Alert | `AlertTriangle`, `AlertCircle` | Warnings |
| Success | `CheckCircle`, `Check` | Confirmations |
| Add | `Plus` | Create actions |
| Edit | `Pencil`, `Edit` | Modify actions |
| Delete | `Trash2` | Remove actions |
| Search | `Search` | Filter/search |
| Navigation | `Navigation`, `Compass` | GPS/tracking |
| Phone | `Phone` | Contact |
| Bell | `Bell` | Notifications |

---

## Summary

Kid Commute is a multi-role transportation management system with:

- **3 User Types:** Admins (desktop), Drivers (mobile), Parents (mobile)
- **Core Features:** Fleet tracking, route management, attendance, messaging
- **Design System:** Clean, functional UI with blue primary color
- **Mobile-First:** 44px touch targets, iOS-optimized inputs
- **Real-Time:** WebSocket updates, live GPS tracking, ETA countdowns

The design prioritizes clarity, safety, and efficiency - making complex fleet operations manageable for administrators while keeping drivers focused on the road and parents informed about their children.
