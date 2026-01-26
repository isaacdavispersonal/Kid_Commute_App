import { Capacitor } from '@capacitor/core';

/**
 * Configuration for API and WebSocket URLs
 * Handles both web and mobile (Capacitor) environments
 */

// Production backend URL - ALWAYS use this for native apps
const PRODUCTION_API_URL = "https://kid-commute.replit.app";

// Detect native environment - check multiple ways for robustness
function detectNativePlatform(): boolean {
  try {
    // Primary check: Capacitor's official method
    const capacitorNative = Capacitor.isNativePlatform();
    
    // Secondary check: Check if we're NOT in a standard browser environment
    const isCapacitorProtocol = typeof window !== 'undefined' && 
      (window.location?.protocol === 'capacitor:' || 
       window.location?.protocol === 'ionic:' ||
       window.location?.hostname === 'localhost' && window.location?.port === '');
    
    const result = capacitorNative || isCapacitorProtocol;
    
    // Debug logging
    console.log('[Config] Platform detection:', {
      capacitorNative,
      isCapacitorProtocol,
      result,
      platform: Capacitor.getPlatform(),
      protocol: typeof window !== 'undefined' ? window.location?.protocol : 'N/A',
      hostname: typeof window !== 'undefined' ? window.location?.hostname : 'N/A',
    });
    
    return result;
  } catch (error) {
    console.log('[Config] Error detecting platform:', error);
    return false;
  }
}

export const isNative = detectNativePlatform();

let _apiBaseUrl: string | null = null;
let _configError: string | null = null;
let _initialized = false;

export function initializeConfig(): void {
  // Allow reinitialization if previous attempt failed
  if (_initialized && _apiBaseUrl !== null) return;

  if (isNative) {
    // Mobile app: Use production URL
    const envUrl = import.meta.env.VITE_API_URL as string | undefined;
    _apiBaseUrl = (envUrl || PRODUCTION_API_URL).replace(/\/$/, "");
    _configError = null;
  } else {
    // Web version uses relative URLs (same origin)
    _apiBaseUrl = "";
  }
  
  _initialized = true;
}

// Run initialization immediately
initializeConfig();

/**
 * Reset configuration state to allow forced reinitialization
 * Useful for testing or recovery from configuration errors
 */
export function resetConfig(): void {
  _apiBaseUrl = null;
  _configError = null;
  _initialized = false;
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

/**
 * Get the login URL for authentication
 * On mobile, returns full URL to backend; on web, returns relative path
 * This is critical because mobile apps run at capacitor://localhost
 * and need to redirect to the actual backend URL
 */
export function getLoginUrl(): string {
  return getApiUrl('/api/login');
}

/**
 * Get the logout URL for authentication
 * On mobile, returns full URL to backend; on web, returns relative path
 */
export function getLogoutUrl(): string {
  return getApiUrl('/api/logout');
}

// Time constants (milliseconds)
const SECOND = 1000;
const MINUTE = 60 * SECOND;

/**
 * Client-side configuration for polling/refetch intervals
 * These control how often data is refreshed from the server
 */
export const clientConfig = {
  // Real-time data polling intervals
  polling: {
    fast: 3 * SECOND,         // 3s - active message threads
    medium: 5 * SECOND,       // 5s - message lists, driver dashboard
    standard: 10 * SECOND,    // 10s - parent tracking, conversations
    slow: 15 * SECOND,        // 15s - sidebar badges, route requests
    slower: 30 * SECOND,      // 30s - children list, assignments
    background: 2 * MINUTE,   // 2min - fallback with WebSocket
  },
} as const;
