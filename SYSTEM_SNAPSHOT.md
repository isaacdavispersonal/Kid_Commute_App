# Kid Commute — System Snapshot

> Paste this into a new AI session to continue development. Condensed, no explanations.

---

## 1. Project Overview

**Kid Commute** — Transportation service management: fleet, routes, drivers, students, real-time GPS, attendance, payroll. Single codebase: React/Vite frontend, Express API, PostgreSQL (Drizzle), Capacitor iOS/Android. Roles: **admin**, **driver**, **parent**. Auth: JWT (unified for web + mobile); web uses HTTP-only cookie, mobile uses Bearer token from Capacitor Preferences.

---

## 2. Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, Vite, Tailwind, shadcn/ui (Radix), TanStack Query, Wouter, Leaflet |
| Backend | Node, Express, TypeScript ESM |
| DB | PostgreSQL (Neon); Drizzle ORM |
| Auth | JWT (jsonwebtoken, bcrypt); cookie (web) + Bearer (native) |
| Real-time | Socket.IO (server: socket-server.ts; client: lib/socket.ts, hooks/use-socket.ts) |
| Mobile | Capacitor 7, iOS/Android; Firebase FCM push |
| Build | `npm run dev` | `npm run build`; `npm run build:native` for mobile; `npx cap sync ios` |

---

## 3. Folder Structure

```
client/
  src/
    App.tsx, main.tsx, index.css
    components/     # ui/* (shadcn), app-sidebar, error-boundary, etc.
    pages/          # landing, admin/*, driver/*, parent/*, profile, verify-email, etc.
    hooks/          # useUnifiedAuth, useAuth, use-socket, usePushNotifications, etc.
    lib/            # queryClient, config, mobile-auth, socket
    contexts/       # RefreshContext
server/
  index.ts          # Express entry, CORS, Socket.IO init
  routes.ts         # Single large file: all API routes (~100+ endpoints)
  routes/           # unified-auth.ts, admin-import.ts, mobile-auth.ts (legacy alias)
  storage.ts        # DB layer (Drizzle)
  db.ts             # Drizzle client
  config.ts         # Central config (env-based)
  utils/            # jwt-auth.ts, timeCalculations.ts
  middleware/       # rate-limit.ts
  services/         # email.ts, timesheet-derivation.ts, bamboohr-export.ts
  socket-server.ts  # Socket.IO auth + rooms
  push-notification-service.ts, gps-pipeline.ts, dwell-detection-service.ts, etc.
shared/
  schema.ts         # Drizzle tables, Zod schemas, types (~2900 lines)
ios/App, android/   # Capacitor native projects
migrations/         # Drizzle SQL
```

---

## 4. Database Schema (PostgreSQL, Drizzle)

**Core tables:** `users` (role: admin|driver|parent, isLeadDriver), `auth_credentials` (password hash, email/phone, emailVerified), `sessions` (Replit session store).

**Auth/security:** `password_reset_tokens`, `email_verification_tokens`, `device_tokens` (push).

**Fleet/routes:** `vehicles`, `routes`, `stops`, `route_stops` (routeId, stopId, stopOrder, scheduledTime), `route_groups`.

**People:** `households`, `household_members`, `students` (assignedRouteId legacy; primary link via student_routes), `student_routes` (routeId, studentId, pickupStopId, dropoffStopId → references stops.id).

**Driver/ops:** `driver_assignments` (driverId, routeId, vehicleId), `shifts` (driverId, routeId, date, shiftType MORNING|AFTERNOON|EXTRA, status, inspectionCompletedAt, routeStartedAt, routeCompletedAt), `clock_events` (driverId, shiftId, type IN|OUT, source, timestamp), `route_progress` (shiftId, routeStopId, status).

**Attendance/rides:** `student_attendance` (studentId, shiftId, date, status riding|absent), `student_ride_events` (BOARD/DEBOARD, shiftId, actualStopId), `attendance_change_logs`, `route_requests`, `stop_change_requests`.

**Route runs (multi-driver):** `route_runs`, `route_run_participants`, `route_run_events`.

**Other:** `geofences`, `vehicle_geofence_state`, `geofence_events`, `vehicle_dwell_sessions`, `vehicle_checklists`, `vehicle_inspections`, `messages`, `announcements`, `announcement_reads`, `incidents`, `supplies_requests`, `driver_feedback`, `driver_notifications`, `audit_logs` (actions include marked_attendance, STOP_SKIPPED; entities include attendance, route_stop), `admin_settings`, `admin_acknowledgements`, `time_entries`, `timesheet_entries`, `timesheet_entry_edits`, `payroll_exports`, `pay_periods`, `bamboo_employee_map`, `payroll_export_jobs`, `payment_portals`, `student_service_days`, `student_service_day_overrides`.

**Relations:** users ↔ auth_credentials (1:1), users ↔ driver_assignments, shifts; routes ↔ route_stops ↔ stops; students ↔ student_routes; shifts ↔ clock_events, route_progress, student_attendance, student_ride_events.

---

## 5. Authentication Flow

- **Login:** `POST /api/auth/login` (or `/api/mobile/auth/login`). Body: `identifier` (email or phone), `password`, `rememberMe` (optional). Server: validate via auth_credentials, bcrypt compare; issue JWT via `generateToken(userId, role, rememberMe)`. Cookie: `auth_token` (web, httpOnly, sameSite lax, maxAge by rememberMe/driver 30d). Response: `{ token, user }`. Native: client stores token in Capacitor Preferences (`setAuthToken`), sends `Authorization: Bearer <token>`.
- **Token:** JWT payload `userId`, `role`; expiry: 1d default, 30d if rememberMe or role driver. Secret: `JWT_SECRET` or `SESSION_SECRET`.
- **Auth middleware:** `requireAuth`: extract token (Authorization Bearer or cookie `auth_token`), verify JWT, load user, set `req.user`. `requireRole("admin"|"driver"|"parent")`: after requireAuth, check `req.user.role`. `requireAdminOrLeadDriver`: admin or (driver && isLeadDriver).
- **Client (web):** cookie sent with `credentials: "include"`. **Client (native):** `getAuthToken()` from Preferences, attach to request headers in queryClient getFetchOptions.
- **Register:** `POST /api/auth/register`. Forgot/reset: `/api/auth/forgot-password`, `/api/auth/reset-password`. Verify email: `/api/auth/verify-email`, tokens in `email_verification_tokens`.

---

## 6. Role Permissions Logic

- **admin:** Full access; all admin routes, all data, force clock-out, payroll, settings, audit, route-requests, stop-change-requests, etc.
- **driver:** Own shifts, clock in/out, break, route context for own shift, route-students, attendance (mark riding/absent), ride events, messages, announcements, students list, inspection, incidents, supplies; lead driver: same + some admin routes (e.g. driver-assignments, routes, schedule, stops) via `requireAdminOrLeadDriver`.
- **parent:** Own profile, children (students), tracking (assigned route), messages, stop-change-requests; no driver/admin APIs.
- **Route-level:** Many routes use `requireAuth` then `requireRole("admin")` or `requireRole("driver")`; driver routes often validate shift ownership (shift.driverId === req.user.id) or assignment (storage.getDriverAssignmentsByDriver).

---

## 7. API Endpoints (Summary)

- **Auth:** `POST /api/auth/login`, `register`, `logout`; `GET /api/auth/me`; forgot-password, reset-password, verify-email; mounted also at `/api/mobile/auth/*`.
- **Profile:** `PATCH /api/profile`, `DELETE /api/profile/delete-account`.
- **Push:** `POST /api/push-tokens`, `DELETE /api/push-tokens/:token`; admin: `GET /api/admin/push-notifications/status`, `POST /api/admin/push-notifications/test`, `GET /api/admin/push-tokens/users`.
- **Driver:** `GET /api/driver/all-parents` (all parents for messaging), `GET /api/driver/messageable-parents` (parents on driver's routes); `GET /api/driver/clock-status`, `POST /api/driver/clock-in`, `POST /api/driver/clock-out`; `GET /api/driver/today-shifts`, `GET /api/driver/my-assignments`, `GET /api/driver/shifts`, `GET /api/driver/route/:shiftId` (returns context **before** route started—stops/students visible), `GET /api/driver/route-students/:routeId`; `POST /api/driver/shift/:shiftId/start-route`, `complete-inspection`, `finish-route`; `POST /api/attendance`; route progress (update-stop: COMPLETED/SKIPPED—skip creates audit_log STOP_SKIPPED), ride events; `GET /api/driver/students`, route-requests, break (start/end).
- **Admin:** Stats, routes, stops, vehicles, geofences, schedules, students, driver-assignments, shifts (CRUD, bulk create), clock-events (all, unresolved, resolve, edit), force-clock-out, auto-clockout, timesheet-entries, payroll, pay-periods, bamboo-mappings, audit-logs (filter by admin/driver/parent; quick filters: Time, Attendance, Route & Stops, Messages), geofence-events, incidents, supplies-requests, feedback, vehicle-checklists, announcements, messages, route-requests, stop-change-requests, settings, cleanup, maintenance fix-stuck-shifts, etc.
- **Parent:** Stop-change-requests; tracking (route/student); messages (only to assigned drivers + admin; contact list = assigned-drivers + admin-contacts).
- **Common:** `GET /api/health`; `GET /api/billing/portals`; messages mark-read, announcements mark-read; `GET /api/user/unread-counts`, unread-announcements.
- **Webhooks:** `/api/webhooks/*` (Samsara); `POST /api/vehicles/gps-update` (verifyWebhookToken).
- **Time/export:** `GET /api/admin/all-clock-events` (date filter); **Clock logs (JSON)** and **Geofence logs (JSON)** download buttons in Admin → Activity & Operations → Time (geofence via `GET /api/admin/geofence-events`).

---

## 8. Core Business Rules

- **Shifts:** Created from driver_assignments (admin or bulk). Driver must clock in before start-route. Start-route requires inspection complete (pre-trip). Finish-route uses post-trip inspection. Auto-clockout job runs on interval (config: autoClockoutIntervalMs, maxShiftHours).
- **Attendance:** Per shift, per student; status riding|absent|PENDING. **Never auto-default to absent**—only explicit driver/parent marks set absent; no record or PENDING displays as "Pending" in UI. Drivers (all) can mark; stored in student_attendance with shiftId. Route-students and getStudentsByRouteForDate return status "PENDING" when no record. POST /api/attendance accepts only riding|absent|PENDING. Route-students list returns students even before route started; attendance actions on route page require route started.
- **Stops/students:** route_stops define order; students linked via student_routes (pickupStopId, dropoffStopId = stops.id). Shift route context: getShiftRouteContext(shiftId) → stops with progress and students; **returned even before route started** (progress all PENDING until start-route). ShiftRouteContext.shift includes routeStartedAt.
- **Route runs:** Optional multi-driver run per route/date/shiftType; participants, events; used for route run summary and some flows.
- **Messaging:** Parents can only message the driver(s) currently assigned to their child's route(s) and admins they've chatted with. When a driver is no longer assigned to that route, that parent–driver thread is no longer accessible (contact list uses assigned-drivers only; GET messages returns 403). Drivers can message any parent and any admin (GET /api/driver/all-parents for contact list). Admin can message anyone. Message manager shows chat histories; parent contact list is only current assigned drivers + admin-contacts. Storage: getActiveDriversForParent and getMessageableParentsForDriver include student_routes (multi-route) as well as legacy assignedRouteId.
- **Announcements:** Admin sends app-wide announcements (ORG_ALL, ROLE_DRIVERS, ROLE_PARENTS) via announcements table; drivers send route_announcements to parents on their assigned route. Admin Messages page has an "Announcements" tab (recent list + link to full manage page).
- **JWT expiry:** 1d default; 30d for rememberMe or driver. Cookie maxAge aligned (SESSION_DURATION_MS, SESSION_DURATION_REMEMBER_MS, DRIVER_SESSION_DURATION_MS).
- **iOS layout:** No min-height 100dvh/100vh on root to avoid white bars; use height:100% and h-full; viewport-fit=cover in index.html.

---

## 9. Current Bugs / Unresolved Issues

- **Driver dashboard completed badge:** Resolved—completed shifts show "Completed" badge (green), not "Offline".
- **Routes/stops/students visibility:** GET /api/driver/route/:shiftId now returns context **before** route started (stops and students visible; progress all PENDING). If still empty, check data: route_stops, student_routes for that route/date.
- **Attendance display:** Resolved—students only show "Absent" when explicitly marked; no record or PENDING shows "Pending". getStudentsByRouteForDate returns status "PENDING" when no record; API accepts only riding|absent|PENDING.
- **Admin dashboard/exceptions stale:** Refetch/invalidation may be missing after some mutations; check queryClient.invalidateQueries for the relevant keys.
- **Refresh (pull-to-refresh):** Driver dashboard, attendance, students, route, routes, announcements register with RefreshContext; invalidate their queries on trigger.
- **Clock-out:** Single tap; dashboard invalidates clock-status, break/status, today-shifts, my-assignments on success.
- **Connectivity/WiFi:** No explicit offline/retry layer; 401 triggers redirect to /?expired=true.
- **Face ID / Apple password manager:** Login form has autocomplete and name attributes; no native Face ID flow yet (would need Capacitor Local Authentication).
- **Payroll/Timesheets/Bamboo:** Multiple entry points (payroll, timesheets, bamboohr-settings); some redirect to /admin/payroll; consolidate in progress.
- **Driver “request student info update”:** Implemented as "Request info update" link to /driver/messages on driver students page; no dedicated student-info-request table/API yet.

---

## 10. Environment Variables

| Var | Purpose |
|-----|---------|
| DATABASE_URL | PostgreSQL connection string |
| SESSION_SECRET | Session/JWT fallback secret |
| JWT_SECRET | JWT signing (preferred over SESSION_SECRET in prod) |
| VITE_API_URL | Backend URL for client (e.g. https://kid-commute.replit.app); set before `npm run build:native` |
| SAMSARA_API_TOKEN, SAMSARA_WEBHOOK_SECRET | Samsara GPS |
| GPS_WEBHOOK_SECRET | Generic GPS webhook auth |
| FIREBASE_SERVICE_ACCOUNT_JSON | FCM push; **full JSON string** of Firebase service account key (set in .env or host secrets). Server loads .env via dotenv at startup. |
| BAMBOOHR_API_TOKEN, BAMBOOHR_SUBDOMAIN | Payroll/BambooHR |
| QUICKBOOKS_PORTAL_URL, CLASSWALLET_PORTAL_URL | Parent billing links |

Optional overrides: SESSION_DURATION_MS, SESSION_DURATION_REMEMBER_MS, DRIVER_SESSION_DURATION_MS, AUTO_CLOCKOUT_INTERVAL_MS, MAX_SHIFT_HOURS, etc. (see server/config.ts).

---

## 11. Deployment Configuration

- **Env file:** Copy .env.example to .env; fill in secrets. **.env is in .gitignore**—do not commit. Server loads .env via `import "dotenv/config"` at top of server/index.ts.
- **Dev:** `npm run dev` (tsx server/index.ts; Vite dev server; dotenv loads .env).
- **Build:** `npm run build` (vite build + esbuild server bundle to dist/). `npm run build:native` uses VITE_API_URL for mobile.
- **Start:** `NODE_ENV=production node dist/index.js`.
- **DB:** `npm run db:push` (Drizzle push to DB).
- **Mobile:** After build:native, `npx cap sync ios` (or android); open ios/App/App.xcworkspace. CORS allows capacitor://localhost, ionic://localhost, and production origin.
- **Replit:** App URL typically https://kid-commute.replit.app; secrets in Replit Secrets.

---

## 12. Architectural Decisions

- **Single routes file:** Most API routes live in server/routes.ts; auth in unified-auth router mounted at /api/auth and /api/mobile/auth. No per-domain split.
- **Unified auth:** One login/register flow; JWT + cookie (web) or Bearer (native); no separate “mobile auth” backend, only path alias.
- **Client auth:** useUnifiedAuth (hooks/useUnifiedAuth.ts) for both web and native; reads token via getAuthToken (Capacitor Preferences or localStorage), validates with /api/auth/me.
- **Query client:** Central fetch in lib/queryClient.ts; auth via getFetchOptions (Bearer or credentials); 401 → redirect /?expired=true; base URL from getApiUrl (VITE_API_URL).
- **Real-time:** Socket.IO; auth by token; rooms by role (e.g. route_run:*), server in socket-server.ts.
- **Shared schema:** All table defs and shared types in shared/schema.ts; server and client import from @shared/schema.
- **Driver attendance:** All drivers can mark attendance (not only lead); my-assignments = today’s shifts in assignment shape; route-students returns list even before route started; shiftId for POST /api/attendance from currentShift.id.
- **Clock-out:** Single-tap clock-out from dashboard; success invalidates clock-status, break/status, today-shifts, my-assignments. Optional “Clock out with note” opens dialog.
- **Route context before start:** GET /api/driver/route/:shiftId returns full context (stops, students) even when route not started; progress all PENDING. Driver route page shows "Route not started" alert and disables stop completion/attendance until started.
- **Post-inspection:** After vehicle inspection complete, start-route is called and client navigates to /driver/route/:shiftId so route manager appears immediately.
- **Student page (driver):** Max-width layout (max-w-3xl); “Request info update” links to /driver/messages. Registers refresh.
- **Login form:** name, autoComplete (username, current-password), inputMode email for identifier to help password managers and keyboards.
- **Driver adjustments:** Student attendance on Attendance + Route pages (after route started); complete/skip stops; skip creates audit_log STOP_SKIPPED. Correct-attendance in route run summary creates audit entry.
- **Audit log:** marked_attendance, STOP_SKIPPED; entities include route_stop. Admin audit UI: role filter Admin, quick filter "Route & Stops"; Activity & Operations tabs scrollable (overflow-x-auto).
- **Admin logs download:** Time-management-section: "Clock logs (JSON)" and "Geofence logs (JSON)" (GET /api/admin/geofence-events). Migration 0001 adds audit STOP_SKIPPED and route_stop enum values.
- **Messaging rules:** Parent contact list = assigned-drivers (getActiveDriversForParent) + admin-contacts; when driver unassigned they drop off list and thread returns 403. Driver contact list = all parents (GET /api/driver/all-parents) + admin-contacts; driver can message any parent or admin without route/start-route check.
- **Push notifications:** Firebase Admin SDK (push-notification-service.ts); requires FIREBASE_SERVICE_ACCOUNT_JSON as full JSON string. GET /api/admin/push-notifications/status (admin) returns { available, message }. Test endpoint (POST .../test) checks isAvailable(), uses only active device tokens; 503 if Firebase not configured, 404 if no active tokens. APNs payload includes alert, sound, badge for iOS. Admin Settings shows push status banner and clearer test error messages. iOS: app should register FCM tokens (e.g. Firebase Messaging plugin) for backend to send successfully.
