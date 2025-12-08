import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isNative, getApiUrl } from "@/lib/config";
import { 
  getAuthToken, 
  setAuthToken, 
  clearAuthData,
} from "@/lib/mobile-auth";
import type { User } from "@shared/schema";

interface UseUnifiedAuthResult {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useUnifiedAuth(): UseUnifiedAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

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
  }, [queryClient]);

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
