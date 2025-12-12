import { useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from "@capacitor/push-notifications";
import { isNative, getApiUrl } from "@/lib/config";
import { getAuthToken } from "@/lib/mobile-auth";

interface UsePushNotificationsOptions {
  onNotificationReceived?: (notification: PushNotificationSchema) => void;
  onNotificationAction?: (action: ActionPerformed) => void;
}

// Store pending token globally so it survives hook re-renders
let pendingDeviceToken: string | null = null;

export function usePushNotifications(options: UsePushNotificationsOptions = {}) {
  const listenersSetupRef = useRef(false);

  const registerTokenWithServer = useCallback(async (token: string): Promise<boolean> => {
    try {
      const authToken = await getAuthToken();
      if (!authToken) {
        console.log("[PushNotifications] No auth token yet, queuing device token");
        pendingDeviceToken = token;
        return false;
      }

      const platform = Capacitor.getPlatform();
      
      const response = await fetch(getApiUrl("/api/push-tokens"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token,
          platform,
          deviceInfo: {
            platform,
            isNative: true,
          },
        }),
      });

      if (response.ok) {
        console.log("[PushNotifications] Device token registered successfully");
        pendingDeviceToken = null;
        return true;
      } else {
        const error = await response.text();
        console.error("[PushNotifications] Failed to register token:", error);
        return false;
      }
    } catch (error) {
      console.error("[PushNotifications] Error registering token:", error);
      return false;
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      console.log("[PushNotifications] Not running on native platform");
      return false;
    }

    try {
      const permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === "prompt") {
        const result = await PushNotifications.requestPermissions();
        return result.receive === "granted";
      }

      return permStatus.receive === "granted";
    } catch (error) {
      console.error("[PushNotifications] Error checking permissions:", error);
      return false;
    }
  }, []);

  const setupListeners = useCallback(async () => {
    if (!isNative || listenersSetupRef.current) {
      return;
    }

    console.log("[PushNotifications] Setting up listeners");

    await PushNotifications.addListener("registration", (token: Token) => {
      console.log("[PushNotifications] Token received:", token.value.substring(0, 20) + "...");
      registerTokenWithServer(token.value);
    });

    await PushNotifications.addListener("registrationError", (error) => {
      console.error("[PushNotifications] Registration error:", error);
    });

    await PushNotifications.addListener("pushNotificationReceived", (notification: PushNotificationSchema) => {
      console.log("[PushNotifications] Notification received:", notification.title);
      options.onNotificationReceived?.(notification);
    });

    await PushNotifications.addListener("pushNotificationActionPerformed", (action: ActionPerformed) => {
      console.log("[PushNotifications] Notification action:", action.actionId);
      options.onNotificationAction?.(action);
    });

    listenersSetupRef.current = true;
  }, [registerTokenWithServer, options.onNotificationReceived, options.onNotificationAction]);

  const register = useCallback(async () => {
    if (!isNative) {
      return;
    }

    try {
      // Always setup listeners first
      await setupListeners();

      const hasPermission = await requestPermission();
      
      if (!hasPermission) {
        console.log("[PushNotifications] Permission not granted");
        return;
      }

      // If we have a pending token from before auth was ready, register it now
      if (pendingDeviceToken) {
        console.log("[PushNotifications] Registering pending device token");
        const success = await registerTokenWithServer(pendingDeviceToken);
        if (success) {
          console.log("[PushNotifications] Pending token registered successfully");
          return;
        }
      }

      // Request new registration (triggers "registration" event with new token)
      await PushNotifications.register();
      console.log("[PushNotifications] Registration initiated");
    } catch (error) {
      console.error("[PushNotifications] Error registering:", error);
    }
  }, [setupListeners, requestPermission, registerTokenWithServer]);

  const unregister = useCallback(async () => {
    if (!isNative) return;

    try {
      const authToken = await getAuthToken();
      
      if (authToken) {
        // Delete current token from server
        await fetch(getApiUrl("/api/push-tokens/current"), {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }).catch(() => {
          // Ignore errors during logout
        });
      }

      // Remove listeners and reset state for next login
      await PushNotifications.removeAllListeners();
      listenersSetupRef.current = false;
      pendingDeviceToken = null;
      
      console.log("[PushNotifications] Unregistered and cleaned up");
    } catch (error) {
      console.error("[PushNotifications] Error unregistering:", error);
    }
  }, []);

  // Setup listeners on mount for native platforms
  useEffect(() => {
    if (isNative && !listenersSetupRef.current) {
      setupListeners();
    }

    return () => {
      // Don't cleanup on unmount - let unregister handle it
    };
  }, [setupListeners]);

  return {
    register,
    unregister,
    requestPermission,
  };
}
