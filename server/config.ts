/**
 * Centralized configuration module
 * All magic numbers and hardcoded values are defined here with env var overrides
 */

function parseIntEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseFloatEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Time constants (in milliseconds)
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const config = {
  // GPS & Polling
  gps: {
    pollIntervalMs: parseIntEnv("GPS_POLL_INTERVAL_MS", 30 * SECOND),
    batchSize: parseIntEnv("GPS_BATCH_SIZE", 10),
  },

  // Geofence
  geofence: {
    defaultRadiusMeters: parseIntEnv("GEOFENCE_DEFAULT_RADIUS_METERS", 100),
    cacheTtlMs: parseIntEnv("GEOFENCE_CACHE_TTL_MS", MINUTE),
  },

  // WebSocket / Socket.IO
  socket: {
    pingIntervalMs: parseIntEnv("SOCKET_PING_INTERVAL_MS", 25 * SECOND),
    pingTimeoutMs: parseIntEnv("SOCKET_PING_TIMEOUT_MS", MINUTE),
  },

  // Session & Auth
  auth: {
    sessionDurationMs: parseIntEnv("SESSION_DURATION_MS", DAY),
    sessionDurationRememberMs: parseIntEnv("SESSION_DURATION_REMEMBER_MS", 30 * DAY),
    driverSessionDurationMs: parseIntEnv("DRIVER_SESSION_DURATION_MS", 7 * DAY), // Drivers get 7 days by default
    passwordResetExpiryMs: parseIntEnv("PASSWORD_RESET_EXPIRY_MS", HOUR),
    emailVerificationExpiryMs: parseIntEnv("EMAIL_VERIFICATION_EXPIRY_MS", DAY),
    replitSessionTtlMs: parseIntEnv("REPLIT_SESSION_TTL_MS", 7 * DAY),
  },

  // Data Retention (in days) - these are defaults, can be overridden via admin settings
  retention: {
    messagesDays: parseIntEnv("RETENTION_MESSAGES_DAYS", 90),
    geofenceEventsDays: parseIntEnv("RETENTION_GEOFENCE_EVENTS_DAYS", 30),
    auditLogsDays: parseIntEnv("RETENTION_AUDIT_LOGS_DAYS", 365),
    dismissedAnnouncementsDays: parseIntEnv("RETENTION_ANNOUNCEMENTS_DAYS", 90),
    deviceTokensDays: parseIntEnv("RETENTION_DEVICE_TOKENS_DAYS", 180),
    cleanupIntervalHours: parseIntEnv("RETENTION_CLEANUP_INTERVAL_HOURS", 24),
  },

  // Shift & Time Tracking
  shifts: {
    autoClockoutIntervalMs: parseIntEnv("AUTO_CLOCKOUT_INTERVAL_MS", HOUR),
    maxShiftHours: parseIntEnv("MAX_SHIFT_HOURS", 12), // Auto clock-out after 12 hours
    longBreakThresholdHours: parseIntEnv("LONG_BREAK_THRESHOLD_HOURS", 4),
    longShiftThresholdHours: parseIntEnv("LONG_SHIFT_THRESHOLD_HOURS", 12),
    defaultRouteWindowHours: parseIntEnv("DEFAULT_ROUTE_WINDOW_HOURS", 8),
  },

  // Notifications
  notifications: {
    pushRetryDelayMs: parseIntEnv("PUSH_RETRY_DELAY_MS", 5 * MINUTE),
  },

  // Caching
  cache: {
    unreadCountsTtlMs: parseIntEnv("UNREAD_COUNTS_CACHE_TTL_MS", 3 * SECOND),
  },

  // Timeouts for external services
  timeouts: {
    samsaraRequestMs: parseIntEnv("SAMSARA_REQUEST_TIMEOUT_MS", 30 * SECOND),
  },
} as const;

export type Config = typeof config;
