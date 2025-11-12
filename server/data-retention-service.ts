import { storage } from "./storage";

const log = (msg: string) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} [info] [data-retention] ${msg}`);
};

const logError = (msg: string, error?: any) => {
  const timestamp = new Date().toLocaleTimeString();
  console.error(`${timestamp} [error] [data-retention] ${msg}`, error);
};

// Default retention periods (in days) based on privacy policy
const DEFAULT_RETENTION_PERIODS = {
  messages: 90, // Messages retained for 90 days
  geofenceEvents: 30, // GPS/location data retained for 30 days
  auditLogs: 365, // Audit logs retained for 1 year
  dismissedAnnouncements: 90, // Old dismissed announcements retained for 90 days
  deviceTokens: 180, // Inactive device tokens retained for 6 months
};

export interface RetentionStats {
  messagesDeleted: number;
  geofenceEventsDeleted: number;
  auditLogsDeleted: number;
  dismissedAnnouncementsDeleted: number;
  deviceTokensDeleted: number;
  totalDeleted: number;
  executionTime: number;
}

/**
 * Run data retention cleanup based on configured retention periods
 */
export async function runDataRetention(): Promise<RetentionStats> {
  const startTime = Date.now();
  
  log("Starting data retention cleanup...");

  try {
    // Get retention periods from admin settings, use defaults if not set
    const [
      messagesRetention,
      geofenceRetention,
      auditRetention,
      announcementsRetention,
      tokensRetention,
    ] = await Promise.all([
      storage.getAdminSetting("retention_messages_days"),
      storage.getAdminSetting("retention_geofence_events_days"),
      storage.getAdminSetting("retention_audit_logs_days"),
      storage.getAdminSetting("retention_announcements_days"),
      storage.getAdminSetting("retention_device_tokens_days"),
    ]);

    const retentionPeriods = {
      messages: messagesRetention
        ? parseInt(messagesRetention.settingValue)
        : DEFAULT_RETENTION_PERIODS.messages,
      geofenceEvents: geofenceRetention
        ? parseInt(geofenceRetention.settingValue)
        : DEFAULT_RETENTION_PERIODS.geofenceEvents,
      auditLogs: auditRetention
        ? parseInt(auditRetention.settingValue)
        : DEFAULT_RETENTION_PERIODS.auditLogs,
      dismissedAnnouncements: announcementsRetention
        ? parseInt(announcementsRetention.settingValue)
        : DEFAULT_RETENTION_PERIODS.dismissedAnnouncements,
      deviceTokens: tokensRetention
        ? parseInt(tokensRetention.settingValue)
        : DEFAULT_RETENTION_PERIODS.deviceTokens,
    };

    log(`Using retention periods: ${JSON.stringify(retentionPeriods)}`);

    // Run all cleanup operations in parallel
    const [
      messagesDeleted,
      geofenceEventsDeleted,
      auditLogsDeleted,
      dismissedAnnouncementsDeleted,
      deviceTokensDeleted,
    ] = await Promise.all([
      storage.cleanupOldMessages(retentionPeriods.messages),
      storage.cleanupOldGeofenceEvents(retentionPeriods.geofenceEvents),
      storage.cleanupOldAuditLogs(retentionPeriods.auditLogs),
      storage.cleanupOldDismissedAnnouncements(retentionPeriods.dismissedAnnouncements),
      storage.cleanupInactiveDeviceTokens(retentionPeriods.deviceTokens),
    ]);

    const totalDeleted =
      messagesDeleted +
      geofenceEventsDeleted +
      auditLogsDeleted +
      dismissedAnnouncementsDeleted +
      deviceTokensDeleted;

    const executionTime = Date.now() - startTime;

    const stats: RetentionStats = {
      messagesDeleted,
      geofenceEventsDeleted,
      auditLogsDeleted,
      dismissedAnnouncementsDeleted,
      deviceTokensDeleted,
      totalDeleted,
      executionTime,
    };

    if (totalDeleted > 0) {
      log(
        `Cleanup completed: ${messagesDeleted} messages, ${geofenceEventsDeleted} geofence events, ` +
        `${auditLogsDeleted} audit logs, ${dismissedAnnouncementsDeleted} announcements, ` +
        `${deviceTokensDeleted} device tokens (${totalDeleted} total records deleted in ${executionTime}ms)`
      );
    } else {
      log(`Cleanup completed: No old data to delete (${executionTime}ms)`);
    }

    return stats;
  } catch (error) {
    logError("Error during data retention cleanup", error);
    throw error;
  }
}

/**
 * Initialize data retention service with scheduled cleanup
 * @param intervalHours How often to run cleanup (default: 24 hours)
 */
export function initializeDataRetention(intervalHours: number = 24): void {
  const intervalMs = intervalHours * 60 * 60 * 1000;

  log(`Initializing data retention service (runs every ${intervalHours} hours)`);

  // Run immediately on startup
  runDataRetention().catch((error) => {
    logError("Initial data retention cleanup failed", error);
  });

  // Then run on schedule
  setInterval(() => {
    runDataRetention().catch((error) => {
      logError("Scheduled data retention cleanup failed", error);
    });
  }, intervalMs);

  log(`Data retention scheduled to run every ${intervalHours} hours`);
}
