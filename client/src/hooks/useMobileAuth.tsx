// Mobile authentication hook for Capacitor apps
import { useState, useEffect, useCallback } from "react";
import { isNative, getApiUrl } from "@/lib/config";
import { 
  getAuthToken, 
  setAuthToken, 
  getStoredUser, 
  setStoredUser, 
  clearAuthData,
  type MobileUser 
} from "@/lib/mobile-auth";

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
        const response = await fetch(getApiUrl("/api/mobile/auth/me"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          await setStoredUser(data.user);
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
    await clearAuthData();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = await getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(getApiUrl("/api/mobile/auth/me"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        await setStoredUser(data.user);
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
