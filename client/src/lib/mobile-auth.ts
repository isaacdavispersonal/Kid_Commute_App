// Mobile authentication utilities for Capacitor apps
import { Preferences } from "@capacitor/preferences";
import { isNative, getApiUrl } from "./config";

const TOKEN_KEY = "kid_commute_auth_token";
const USER_KEY = "kid_commute_user";

export interface MobileUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: "admin" | "driver" | "parent";
  phoneNumber: string | null;
  profileImageUrl: string | null;
}

/**
 * Store auth token securely
 */
export async function setAuthToken(token: string): Promise<void> {
  if (isNative) {
    await Preferences.set({ key: TOKEN_KEY, value: token });
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

/**
 * Get stored auth token
 */
export async function getAuthToken(): Promise<string | null> {
  if (isNative) {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    return value;
  } else {
    return localStorage.getItem(TOKEN_KEY);
  }
}

/**
 * Remove auth token (logout)
 */
export async function removeAuthToken(): Promise<void> {
  if (isNative) {
    await Preferences.remove({ key: TOKEN_KEY });
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Store user data
 */
export async function setStoredUser(user: MobileUser): Promise<void> {
  const userJson = JSON.stringify(user);
  if (isNative) {
    await Preferences.set({ key: USER_KEY, value: userJson });
  } else {
    localStorage.setItem(USER_KEY, userJson);
  }
}

/**
 * Get stored user data
 */
export async function getStoredUser(): Promise<MobileUser | null> {
  let userJson: string | null;
  if (isNative) {
    const { value } = await Preferences.get({ key: USER_KEY });
    userJson = value;
  } else {
    userJson = localStorage.getItem(USER_KEY);
  }
  
  if (!userJson) return null;
  
  try {
    return JSON.parse(userJson) as MobileUser;
  } catch {
    return null;
  }
}

/**
 * Remove stored user data (logout)
 */
export async function removeStoredUser(): Promise<void> {
  if (isNative) {
    await Preferences.remove({ key: USER_KEY });
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

/**
 * Clear all auth data (logout)
 */
export async function clearAuthData(): Promise<void> {
  await removeAuthToken();
  await removeStoredUser();
}

/**
 * Check if user is authenticated (has valid token)
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;
  
  // Verify token is still valid by calling unified auth endpoint
  try {
    const response = await fetch(getApiUrl("/api/auth/user"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Make authenticated API request with token
 */
export async function authenticatedFetch(
  path: string, 
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  return fetch(getApiUrl(path), {
    ...options,
    headers,
  });
}
