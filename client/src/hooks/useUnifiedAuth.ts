import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { isNative, getApiUrl } from "@/lib/config";
import { 
  getAuthToken, 
  setAuthToken, 
  clearAuthData,
} from "@/lib/mobile-auth";
import { usePushNotifications } from "./usePushNotifications";
import type { ActionPerformed } from "@capacitor/push-notifications";
import type { User } from "@shared/schema";

interface UseUnifiedAuthResult {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

interface NotificationData {
  type?: string;
  deeplink?: string;
  thread_id?: string;
  senderId?: string;
  announcementId?: string;
  routeId?: string;
  messageId?: string;
}

function getRouteForNotification(data: NotificationData, userRole?: string): string {
  const type = data.type;
  
  switch (type) {
    case "new_message":
    case "message":
      if (userRole === "driver") return "/driver/messages";
      if (userRole === "parent") return "/parent/messages";
      if (userRole === "admin") return "/admin/messages";
      break;
    
    case "announcement":
      if (userRole === "driver") return "/driver/announcements";
      if (userRole === "parent") return "/parent/messages";
      if (userRole === "admin") return "/admin/announcements";
      break;
    
    case "route_started":
    case "route_run":
      if (userRole === "driver") return "/driver/routes";
      if (userRole === "parent") return "/parent/tracking";
      if (userRole === "admin") return "/admin";
      break;
      
    case "bus_approaching":
    case "student_pickup":
    case "route_delay":
      if (userRole === "parent") return "/parent/tracking";
      if (userRole === "driver") return "/driver/routes";
      if (userRole === "admin") return "/admin";
      break;
    
    case "student_not_at_stop":
      if (userRole === "parent") return "/parent/messages";
      break;

    case "test":
      break;
  }
  
  if (userRole === "driver") return "/driver";
  if (userRole === "parent") return "/parent";
  return "/admin";
}

export function useUnifiedAuth(): UseUnifiedAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const pushNotificationsRegisteredRef = useRef(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const userRef = useRef<User | null>(null);
  const [, setLocation] = useLocation();

  userRef.current = user;

  const handleNotificationAction = useCallback((action: ActionPerformed) => {
    console.log("[UnifiedAuth] Notification tapped:", action.actionId);
    const data = action.notification.data as NotificationData;
    console.log("[UnifiedAuth] Notification data:", JSON.stringify(data));
    
    if (!data) return;
    
    const currentUser = userRef.current;
    const route = getRouteForNotification(data, currentUser?.role);
    
    if (!currentUser) {
      console.log("[UnifiedAuth] Auth not ready, queuing navigation to:", route);
      pendingNavigationRef.current = route;
      return;
    }
    
    console.log("[UnifiedAuth] Navigating to:", route);
    setLocation(route);
  }, [setLocation]);

  const { register: registerPush, unregister: unregisterPush } = usePushNotifications({
    onNotificationReceived: (notification) => {
      console.log("[UnifiedAuth] Push notification received:", notification.title);
    },
    onNotificationAction: handleNotificationAction,
  });

  useEffect(() => {
    if (user && isNative && !pushNotificationsRegisteredRef.current) {
      console.log("[UnifiedAuth] User authenticated on native, registering for push notifications");
      registerPush();
      pushNotificationsRegisteredRef.current = true;
    }
  }, [user, registerPush]);

  useEffect(() => {
    if (user && pendingNavigationRef.current) {
      console.log("[UnifiedAuth] Auth ready, executing pending navigation to:", pendingNavigationRef.current);
      setLocation(pendingNavigationRef.current);
      pendingNavigationRef.current = null;
    }
  }, [user, setLocation]);

  const fetchUser = useCallback(async (): Promise<User | null> => {
    try {
      let response: Response;

      if (isNative) {
        const token = await getAuthToken();
        if (!token) {
          return null;
        }
        response = await fetch(getApiUrl("/api/auth/user"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } else {
        response = await fetch("/api/auth/user", {
          credentials: "include",
        });
      }

      if (response.ok) {
        return await response.json();
      } else {
        if (isNative) {
          await clearAuthData();
        }
        return null;
      }
    } catch (error) {
      console.error("[UnifiedAuth] Error fetching user:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    async function checkAuth() {
      setIsLoading(true);
      const userData = await fetchUser();
      setUser(userData);
      setIsLoading(false);
    }
    checkAuth();
  }, [fetchUser]);

  const login = useCallback(async (token: string, userData: User) => {
    if (isNative) {
      await setAuthToken(token);
    }
    setUser(userData);
    queryClient.clear();
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      if (isNative) {
        await unregisterPush();
        pushNotificationsRegisteredRef.current = false;
        await clearAuthData();
      } else {
        await fetch("/api/auth/logout", { 
          method: "POST", 
          credentials: "include" 
        });
      }
    } catch (error) {
      console.error("[UnifiedAuth] Logout error:", error);
    }
    setUser(null);
    queryClient.clear();
  }, [queryClient, unregisterPush]);

  const refetch = useCallback(async () => {
    const userData = await fetchUser();
    setUser(userData);
  }, [fetchUser]);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refetch,
  };
}
