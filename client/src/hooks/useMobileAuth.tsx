// Mobile authentication hook for Capacitor apps
import { useState, useEffect, useCallback, useRef } from "react";
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

interface UseMobileAuthResult {
  user: MobileUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: MobileUser) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export function useMobileAuth(): UseMobileAuthResult {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pushNotificationsRegisteredRef = useRef(false);
  
  const { register: registerPush, unregister: unregisterPush } = usePushNotifications({
    onNotificationReceived: (notification) => {
      console.log("[MobileAuth] Push notification received:", notification.title);
    },
    onNotificationAction: (action) => {
      console.log("[MobileAuth] Push notification action:", action.actionId);
    },
  });

  // Register for push notifications when user is authenticated
  useEffect(() => {
    if (user && isNative && !pushNotificationsRegisteredRef.current) {
      console.log("[MobileAuth] User authenticated, registering for push notifications");
      registerPush();
      pushNotificationsRegisteredRef.current = true;
    }
  }, [user, registerPush]);

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
