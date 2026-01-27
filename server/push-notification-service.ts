import { db } from "./db";
import { deviceTokens, users } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { log } from "./vite";
import admin from "firebase-admin";

interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

/**
 * Helper to build standard deep link paths
 */
function buildDeepLink(type: string, params: Record<string, string> = {}): string {
  switch (type) {
    case "message":
    case "new_message":
      return params.threadId ? `/messages/${params.threadId}` : "/messages";
    case "announcement":
      return params.announcementId ? `/announcements/${params.announcementId}` : "/announcements";
    case "route_run":
    case "route_started":
      return params.routeId ? `/routes/${params.routeId}` : "/routes";
    case "bus_approaching":
    case "student_pickup":
      return "/tracking";
    case "route_delay":
      return "/tracking";
    default:
      return "/";
  }
}

class PushNotificationService {
  private initialized = false;

  /**
   * Initialize Firebase Admin SDK
   * Expects FIREBASE_SERVICE_ACCOUNT_JSON environment variable with service account JSON
   */
  initialize() {
    if (this.initialized) return;

    try {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      
      if (!serviceAccountJson) {
        log("[push] WARNING: FIREBASE_SERVICE_ACCOUNT_JSON not configured - push notifications disabled", "warn");
        log("[push] To enable: Set FIREBASE_SERVICE_ACCOUNT_JSON environment variable with your Firebase service account JSON", "info");
        return;
      }

      const serviceAccount = JSON.parse(serviceAccountJson);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      this.initialized = true;
      log("[push] Push notification service initialized with Firebase Admin SDK", "info");
    } catch (error) {
      log(`[push] Failed to initialize Firebase Admin SDK: ${error}`, "error");
      log("[push] Push notifications will be disabled", "warn");
    }
  }

  /**
   * Check if push notifications are available
   */
  isAvailable(): boolean {
    return this.initialized;
  }

  /**
   * Get active device tokens for specific user IDs
   */
  private async getActiveTokensForUsers(userIds: string[]): Promise<Map<string, string[]>> {
    if (userIds.length === 0) return new Map();

    const tokens = await db
      .select()
      .from(deviceTokens)
      .where(
        and(
          inArray(deviceTokens.userId, userIds),
          eq(deviceTokens.isActive, true)
        )
      );

    // Group tokens by user ID
    const tokensByUser = new Map<string, string[]>();
    for (const token of tokens) {
      const existing = tokensByUser.get(token.userId) || [];
      existing.push(token.token);
      tokensByUser.set(token.userId, existing);
    }

    return tokensByUser;
  }

  /**
   * Send push notification via Firebase Admin SDK
   */
  private async sendToFCM(tokens: string[], notification: PushNotification): Promise<{
    success: string[];
    failed: string[];
  }> {
    if (!this.initialized) {
      log("[push] Firebase Admin SDK not initialized - skipping notification send", "warn");
      return { success: [], failed: tokens };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: tokens,
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
        },
        ...(notification.data && { data: notification.data }),
        apns: {
          payload: {
            aps: {
              contentAvailable: true,
            },
          },
        },
        android: {
          priority: "high" as const,
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      // Parse Firebase Admin SDK response to identify failed tokens
      const success: string[] = [];
      const failed: string[] = [];

      response.responses.forEach((resp, index) => {
        if (resp.success) {
          success.push(tokens[index]);
        } else {
          failed.push(tokens[index]);
          log(`[push] Token failed: ${tokens[index]} - ${resp.error?.code}: ${resp.error?.message}`, "warn");
        }
      });

      log(`[push] Sent to ${success.length} devices, ${failed.length} failed`, "info");
      return { success, failed };
    } catch (error) {
      log(`[push] Error sending via Firebase Admin SDK: ${error}`, "error");
      return { success: [], failed: tokens };
    }
  }

  /**
   * Update token failure count and deactivate if needed
   * Enhanced logging for troubleshooting (C5 requirement)
   */
  private async handleFailedTokens(failedTokens: string[]) {
    if (failedTokens.length === 0) return;

    const MAX_FAILURES = 3;
    const now = new Date();

    for (const token of failedTokens) {
      try {
        // Get current failure count
        const [existingToken] = await db
          .select()
          .from(deviceTokens)
          .where(eq(deviceTokens.token, token))
          .limit(1);

        if (!existingToken) {
          log(`[push] Failed token not found in database: ${token.substring(0, 20)}...`, "warn");
          continue;
        }

        const newFailureCount = existingToken.failureCount + 1;
        const shouldDeactivate = newFailureCount >= MAX_FAILURES;

        log(`[push] Token ${token.substring(0, 20)}... failure count: ${newFailureCount}/${MAX_FAILURES} (user: ${existingToken.userId})`, "warn");

        await db
          .update(deviceTokens)
          .set({
            failureCount: newFailureCount,
            lastFailureAt: now,
            ...(shouldDeactivate && {
              isActive: false,
              deactivatedAt: now,
            }),
            updatedAt: now,
          })
          .where(eq(deviceTokens.token, token));

        if (shouldDeactivate) {
          log(`[push] TOKEN REVOKED: Deactivated token for user ${existingToken.userId} after ${MAX_FAILURES} consecutive failures - token will no longer be used`, "warn");
        }
      } catch (error) {
        log(`[push] Error updating failed token: ${error}`, "error");
      }
    }
  }

  /**
   * Update successful token's last used timestamp
   */
  private async handleSuccessfulTokens(successTokens: string[]) {
    if (successTokens.length === 0) return;

    const now = new Date();

    try {
      await db
        .update(deviceTokens)
        .set({
          lastUsedAt: now,
          failureCount: 0, // Reset failure count on success
          updatedAt: now,
        })
        .where(inArray(deviceTokens.token, successTokens));
    } catch (error) {
      log(`[push] Error updating successful tokens: ${error}`, "error");
    }
  }

  /**
   * Send notification to specific user IDs
   * Enhanced logging for troubleshooting (C5 requirement)
   */
  async sendToUsers(userIds: string[], notification: PushNotification): Promise<void> {
    if (!this.initialized) {
      log("[push] Firebase Admin SDK not initialized - skipping notification", "warn");
      return;
    }

    // Enhanced logging: Log target user IDs
    log(`[push] Attempting to send notification to ${userIds.length} user(s)`, "info");
    log(`[push] Target user IDs: ${userIds.join(", ")}`, "info");
    log(`[push] Notification title: "${notification.title}"`, "info");
    
    const tokensByUser = await this.getActiveTokensForUsers(userIds);
    
    // Enhanced logging: Log token count per user
    tokensByUser.forEach((tokens, userId) => {
      log(`[push] User ${userId}: ${tokens.length} active device token(s)`, "info");
    });
    
    const allTokens = Array.from(tokensByUser.values()).flat();

    if (allTokens.length === 0) {
      log(`[push] No active tokens found for ${userIds.length} user(s) - notification not sent`, "warn");
      log(`[push] Users without tokens: ${userIds.join(", ")} - they may not have registered devices`, "debug");
      return;
    }

    log(`[push] Sending "${notification.title}" to ${allTokens.length} device(s)`, "info");
    if (notification.data) {
      log(`[push] Notification data: ${JSON.stringify(notification.data)}`, "info");
    }

    const { success, failed } = await this.sendToFCM(allTokens, notification);

    // Enhanced logging: Summary
    log(`[push] Send complete - Success: ${success.length}, Failed: ${failed.length}`, "info");

    // Update token statuses
    await this.handleSuccessfulTokens(success);
    await this.handleFailedTokens(failed);
  }

  /**
   * Send notification to all users with a specific role
   */
  async sendToRole(role: "parent" | "driver" | "admin", notification: PushNotification): Promise<void> {
    const roleUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, role));

    const userIds = roleUsers.map((u) => u.id);
    await this.sendToUsers(userIds, notification);
  }

  /**
   * Send notification about bus approaching stop (for parents)
   */
  async notifyBusApproaching(parentUserIds: string[], routeName: string, stopName: string, eta: number): Promise<void> {
    const etaMinutes = Math.round(eta / 60);
    const data = {
      type: "bus_approaching",
      routeName,
      stopName,
      eta: eta.toString(),
      deeplink: buildDeepLink("bus_approaching"),
    };
    await this.sendToUsers(parentUserIds, {
      title: "Bus Approaching",
      body: `${routeName} will arrive at ${stopName} in ${etaMinutes} minute${etaMinutes !== 1 ? 's' : ''}`,
      data,
    });
  }

  /**
   * Send notification about route delay
   */
  async notifyRouteDelay(parentUserIds: string[], routeName: string, delayMinutes: number): Promise<void> {
    const data = {
      type: "route_delay",
      routeName,
      delayMinutes: delayMinutes.toString(),
      deeplink: buildDeepLink("route_delay"),
    };
    await this.sendToUsers(parentUserIds, {
      title: "Route Delayed",
      body: `${routeName} is running approximately ${delayMinutes} minute${delayMinutes !== 1 ? 's' : ''} behind schedule`,
      data,
    });
  }

  /**
   * Send notification about student pickup confirmation
   */
  async notifyStudentPickup(parentUserIds: string[], studentName: string, stopName: string): Promise<void> {
    const data = {
      type: "student_pickup",
      studentName,
      stopName,
      deeplink: buildDeepLink("student_pickup"),
    };
    await this.sendToUsers(parentUserIds, {
      title: "Student Picked Up",
      body: `${studentName} has been picked up at ${stopName}`,
      data,
    });
  }

  /**
   * Send notification about important announcement
   */
  async notifyAnnouncement(userIds: string[], title: string, message: string, announcementId?: string): Promise<void> {
    const data: Record<string, string> = {
      type: "announcement",
      deeplink: buildDeepLink("announcement", { announcementId: announcementId || "" }),
    };
    if (announcementId) {
      data.announcementId = announcementId;
    }
    await this.sendToUsers(userIds, {
      title: title,
      body: message,
      data,
    });
  }

  /**
   * Send notification about new message
   */
  async notifyNewMessage(recipientId: string, senderName: string, content: string, messageId: string, senderId: string): Promise<void> {
    const data = {
      type: "new_message",
      senderId,
      messageId,
      thread_id: senderId,
      deeplink: buildDeepLink("new_message", { threadId: senderId }),
    };
    await this.sendToUsers([recipientId], {
      title: `Message from ${senderName}`,
      body: content.length > 100 ? content.substring(0, 100) + "..." : content,
      data,
    });
  }

  /**
   * Cleanup inactive tokens older than 90 days
   */
  async cleanupOldTokens(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    try {
      const result = await db
        .delete(deviceTokens)
        .where(
          and(
            eq(deviceTokens.isActive, false),
            eq(deviceTokens.deactivatedAt, cutoffDate)
          )
        );

      log(`[push] Cleaned up old inactive tokens`, "info");
    } catch (error) {
      log(`[push] Error cleaning up old tokens: ${error}`, "error");
    }
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
