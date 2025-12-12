import { useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from "@capacitor/push-notifications";
import { isNative, getApiUrl } from "@/lib/config";
import { getAuthToken } from "@/lib/mobile-auth";

interface UsePushNotificationsOptions {
  onNotificationReceived?: (notification: PushNotificationSchema) => void;
  onNotificationAction?: (action: ActionPerformed) => void;
}

export function usePushNotifications(options: UsePushNotificationsOptions = {}) {
  const registeredRef = useRef(false);
  const listenersSetupRef = useRef(false);

  const registerToken = useCallback(async (token: string) => {
    try {
      const authToken = await getAuthToken();
      if (!authToken) {
        console.log("[PushNotifications] No auth token, skipping registration");
        return;
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
      } else {
        const error = await response.text();
        console.error("[PushNotifications] Failed to register token:", error);
      }
    } catch (error) {
      console.error("[PushNotifications] Error registering token:", error);
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

  const register = useCallback(async () => {
    if (!isNative || registeredRef.current) {
      return;
    }

    try {
      const hasPermission = await requestPermission();
      
      if (!hasPermission) {
        console.log("[PushNotifications] Permission not granted");
        return;
      }

      await PushNotifications.register();
      registeredRef.current = true;
      console.log("[PushNotifications] Registration initiated");
    } catch (error) {
      console.error("[PushNotifications] Error registering:", error);
    }
  }, [requestPermission]);

  const unregister = useCallback(async () => {
    if (!isNative) return;

    try {
      const authToken = await getAuthToken();
      
      if (authToken) {
        await fetch(getApiUrl("/api/push-tokens/current"), {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
      }

      await PushNotifications.removeAllListeners();
      registeredRef.current = false;
      listenersSetupRef.current = false;
      console.log("[PushNotifications] Unregistered");
    } catch (error) {
      console.error("[PushNotifications] Error unregistering:", error);
    }
  }, []);

  useEffect(() => {
    if (!isNative || listenersSetupRef.current) {
      return;
    }

    const setupListeners = async () => {
      await PushNotifications.addListener("registration", (token: Token) => {
        console.log("[PushNotifications] Token received:", token.value.substring(0, 20) + "...");
        registerToken(token.value);
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
    };

    setupListeners();

    return () => {
      if (isNative) {
        PushNotifications.removeAllListeners();
        listenersSetupRef.current = false;
      }
    };
  }, [registerToken, options.onNotificationReceived, options.onNotificationAction]);

  return {
    register,
    unregister,
    requestPermission,
  };
}
