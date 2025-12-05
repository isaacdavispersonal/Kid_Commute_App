import { Capacitor } from '@capacitor/core';

/**
 * Configuration for API and WebSocket URLs
 * Handles both web and mobile (Capacitor) environments
 */

// Detect native environment
export const isNative = Capacitor.isNativePlatform();

let _apiBaseUrl: string | null = null;
let _configError: string | null = null;

export function initializeConfig(): void {
  // Allow reinitialization if previous attempt failed
  if (_apiBaseUrl) return; // Only skip if we already have a REAL working value

  if (isNative) {
    console.log("[Config] Raw import.meta.env:", import.meta.env);
    console.log("[Config] VITE_API_URL read from env:", import.meta.env.VITE_API_URL);

    const productionUrl = import.meta.env.VITE_API_URL as string | undefined;

    if (!productionUrl) {
      _configError = "Backend URL not configured. The mobile app needs VITE_API_URL set during the build process.";
      _apiBaseUrl = "";  // FAILED STATE, allows retry after rebuild
      console.error("[Config] VITE_API_URL is not configured! Mobile app cannot connect to backend.");
      return;
    }

    // Normalize trailing slash
    _apiBaseUrl = productionUrl.replace(/\/$/, "");
    _configError = null; // Clear any previous error
    console.log("[Config] Mobile app configured with backend:", _apiBaseUrl);
  } else {
    // Web version uses relative URLs
    _apiBaseUrl = "";
  }
}

initializeConfig();

/**
 * Reset configuration state to allow forced reinitialization
 * Useful for testing or recovery from configuration errors
 */
export function resetConfig(): void {
  _apiBaseUrl = null;
  _configError = null;
  console.log('[Config] Configuration reset, will reinitialize on next access');
}

/**
 * Check if the app has a configuration error
 * @returns Error message if misconfigured, null if OK
 */
export function getConfigError(): string | null {
  return _configError;
}

/**
 * Check if the app is properly configured
 * @returns true if the app can connect to the backend
 */
export function isConfigured(): boolean {
  return _configError === null;
}

/**
 * Get the API base URL based on environment
 * - In web: uses relative URLs (proxied by Vite in dev, same origin in production)
 * - In native mobile: uses absolute URL to production backend
 * 
 * Note: Returns empty string if misconfigured - use isConfigured() to check first
 */
export function getApiBaseUrl(): string {
  return _apiBaseUrl ?? '';
}

/**
 * Get the WebSocket URL based on environment
 * - In web: constructs from window.location
 * - In native mobile: uses production WebSocket URL
 * 
 * Note: Returns empty string if misconfigured - use isConfigured() to check first
 */
export function getWebSocketUrl(): string {
  if (!isConfigured()) {
    return '';
  }
  
  if (isNative) {
    // Mobile app: use production WebSocket URL
    const apiUrl = getApiBaseUrl();
    if (!apiUrl) return '';
    const wsUrl = apiUrl.replace(/^https?:/, 'wss:');
    return `${wsUrl}/ws`;
  }
  
  // Web app: construct from window.location
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

/**
 * Construct a full API URL from a path
 * @param path - API path (e.g., "/api/users")
 * @returns Full URL or relative path depending on environment
 */
export function getApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return baseUrl + normalizedPath;
}
