// Mobile authentication hook for Capacitor apps
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { isNative, getApiUrl } from "@/lib/config";
import { 
  getAuthToken, 
  setAuthToken, 
  getStoredUser, 
  setStoredUser, 
  clearAuthData,
  type MobileUser 
} from "@/lib/mobile-auth";
import { usePushNotifications } from "./usePushNotifications";
import { ActionPerformed } from "@capacitor/push-notifications";

interface UseMobileAuthResult {
  user: MobileUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: MobileUser) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
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
    
    case "test":
      break;
  }
  
  if (userRole === "driver") return "/driver";
  if (userRole === "parent") return "/parent";
  return "/admin";
}

export function useMobileAuth(): UseMobileAuthResult {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pushNotificationsRegisteredRef = useRef(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const userRef = useRef<MobileUser | null>(null);
  const [, setLocation] = useLocation();
  
  userRef.current = user;
  
  const handleNotificationAction = useCallback((action: ActionPerformed) => {
    console.log("[MobileAuth] Notification tapped:", action.actionId);
    const data = action.notification.data as NotificationData;
    console.log("[MobileAuth] Notification data:", JSON.stringify(data));
    
    if (!data) return;
    
    const currentUser = userRef.current;
    const route = getRouteForNotification(data, currentUser?.role);
    
    if (!currentUser) {
      console.log("[MobileAuth] Auth not ready, queuing navigation to:", route);
      pendingNavigationRef.current = route;
      return;
    }
    
    console.log("[MobileAuth] Navigating to:", route);
    setLocation(route);
  }, [setLocation]);
  
  const { register: registerPush, unregister: unregisterPush } = usePushNotifications({
    onNotificationReceived: (notification) => {
      console.log("[MobileAuth] Push notification received:", notification.title);
    },
    onNotificationAction: handleNotificationAction,
  });

  // Register for push notifications when user is authenticated
  useEffect(() => {
    if (user && isNative && !pushNotificationsRegisteredRef.current) {
      console.log("[MobileAuth] User authenticated, registering for push notifications");
      registerPush();
      pushNotificationsRegisteredRef.current = true;
    }
  }, [user, registerPush]);

  // Handle pending navigation from notification tap when auth becomes ready
  useEffect(() => {
    if (user && pendingNavigationRef.current) {
      console.log("[MobileAuth] Auth ready, executing pending navigation to:", pendingNavigationRef.current);
      setLocation(pendingNavigationRef.current);
      pendingNavigationRef.current = null;
    }
  }, [user, setLocation]);

  // Check for existing auth on mount
  useEffect(() => {
    async function checkAuth() {
      if (!isNative) {
        setIsLoading(false);
        return;
      }

      try {
        const token = await getAuthToken();
        if (!token) {
          setIsLoading(false);
          return;
        }

        // Try to get stored user first (faster)
        const storedUser = await getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }

        // Verify token is still valid and refresh user data
        const response = await fetch(getApiUrl("/api/auth/user"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          await setStoredUser(userData);
        } else {
          // Token is invalid, clear auth data
          await clearAuthData();
          setUser(null);
        }
      } catch (error) {
        console.error("[MobileAuth] Error checking auth:", error);
        // On error, keep stored user if available
        const storedUser = await getStoredUser();
        if (!storedUser) {
          await clearAuthData();
        }
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = useCallback(async (token: string, userData: MobileUser) => {
    await setAuthToken(token);
    await setStoredUser(userData);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    // Unregister from push notifications before clearing auth
    if (isNative) {
      await unregisterPush();
      pushNotificationsRegisteredRef.current = false;
    }
    await clearAuthData();
    setUser(null);
  }, [unregisterPush]);

  const refreshUser = useCallback(async () => {
    const token = await getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(getApiUrl("/api/auth/user"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        await setStoredUser(userData);
      }
    } catch (error) {
      console.error("[MobileAuth] Error refreshing user:", error);
    }
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshUser,
  };
}
