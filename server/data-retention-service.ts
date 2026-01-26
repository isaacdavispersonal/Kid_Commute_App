import { storage } from "./storage";
import { createLogger } from "./logger";
import { config } from "./config";

const logger = createLogger("data-retention");

// Default retention periods from config (can be overridden via admin settings)
const DEFAULT_RETENTION_PERIODS = {
  messages: config.retention.messagesDays,
  geofenceEvents: config.retention.geofenceEventsDays,
  auditLogs: config.retention.auditLogsDays,
  dismissedAnnouncements: config.retention.dismissedAnnouncementsDays,
  deviceTokens: config.retention.deviceTokensDays,
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
  
  logger.info("Starting data retention cleanup...");

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

    // Helper function to safely parse retention period with validation
    const parseRetentionPeriod = (
      setting: any,
      defaultValue: number,
      settingName: string
    ): number => {
      if (!setting) {
        return defaultValue;
      }

      const parsed = parseInt(setting.settingValue, 10);
      
      // Validate: must be a positive integer
      if (isNaN(parsed) || parsed <= 0 || !Number.isFinite(parsed)) {
        logger.error(
          `Invalid retention setting "${settingName}": "${setting.settingValue}" - ` +
          `must be a positive integer. Using default: ${defaultValue} days`
        );
        return defaultValue;
      }

      return parsed;
    };

    const retentionPeriods = {
      messages: parseRetentionPeriod(
        messagesRetention,
        DEFAULT_RETENTION_PERIODS.messages,
        "retention_messages_days"
      ),
      geofenceEvents: parseRetentionPeriod(
        geofenceRetention,
        DEFAULT_RETENTION_PERIODS.geofenceEvents,
        "retention_geofence_events_days"
      ),
      auditLogs: parseRetentionPeriod(
        auditRetention,
        DEFAULT_RETENTION_PERIODS.auditLogs,
        "retention_audit_logs_days"
      ),
      dismissedAnnouncements: parseRetentionPeriod(
        announcementsRetention,
        DEFAULT_RETENTION_PERIODS.dismissedAnnouncements,
        "retention_announcements_days"
      ),
      deviceTokens: parseRetentionPeriod(
        tokensRetention,
        DEFAULT_RETENTION_PERIODS.deviceTokens,
        "retention_device_tokens_days"
      ),
    };

    logger.debug(`Using retention periods: ${JSON.stringify(retentionPeriods)}`);

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
      logger.info(
        `Cleanup completed: ${messagesDeleted} messages, ${geofenceEventsDeleted} geofence events, ` +
        `${auditLogsDeleted} audit logs, ${dismissedAnnouncementsDeleted} announcements, ` +
        `${deviceTokensDeleted} device tokens (${totalDeleted} total records deleted in ${executionTime}ms)`
      );
    } else {
      logger.info(`Cleanup completed: No old data to delete (${executionTime}ms)`);
    }

    return stats;
  } catch (error) {
    logger.error("Error during data retention cleanup", error);
    throw error;
  }
}

/**
 * Initialize data retention service with scheduled cleanup
 * @param intervalHours How often to run cleanup (default: 24 hours)
 */
export function initializeDataRetention(intervalHours: number = 24): void {
  const intervalMs = intervalHours * 60 * 60 * 1000;

  logger.info(`Initializing data retention service (runs every ${intervalHours} hours)`);

  // Run immediately on startup
  runDataRetention().catch((error) => {
    logger.error("Initial data retention cleanup failed", error);
  });

  // Then run on schedule
  setInterval(() => {
    runDataRetention().catch((error) => {
      logger.error("Scheduled data retention cleanup failed", error);
    });
  }, intervalMs);

  logger.info(`Data retention scheduled to run every ${intervalHours} hours`);
}
