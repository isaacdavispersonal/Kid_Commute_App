import { Capacitor } from '@capacitor/core';

/**
 * Configuration for API and WebSocket URLs
 * Handles both web and mobile (Capacitor) environments
 */

// Check if running in a Capacitor native app
export const isNative = Capacitor.isNativePlatform();

// Configuration state - allows checking if the app is properly configured
// null = not yet initialized, '' = failed/misconfigured, truthy string = configured
let _configError: string | null = null;
let _apiBaseUrl: string | null = null;

/**
 * Initialize configuration and detect any issues
 * Call this once at app startup
 */
function initializeConfig(): void {
  // Only skip reinit if we already have a real value (truthy URL)
  // _apiBaseUrl === '' means initialization failed previously, so allow retry
  if (_apiBaseUrl) return;
  
  if (isNative) {
    // Debug logging to verify what Vite injected into the build
    console.log("[Config] Running on native platform");
    console.log("[Config] Raw import.meta.env keys:", Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')));
    console.log("[Config] VITE_API_URL read from env:", import.meta.env.VITE_API_URL);
    
    const productionUrl = import.meta.env.VITE_API_URL;
    
    if (!productionUrl) {
      _configError = 'Backend URL not configured. The mobile app needs VITE_API_URL to be set during the build process.';
      _apiBaseUrl = '';
      console.error('[Config] VITE_API_URL is not configured! Mobile app cannot connect to backend.');
      console.error('[Config] To fix: Set VITE_API_URL=https://your-backend-url.replit.app in environment, rebuild with "npm run build", then run "npx cap sync"');
    } else {
      _configError = null; // Clear any previous error
      _apiBaseUrl = productionUrl;
      console.log('[Config] Mobile app configured with backend:', productionUrl);
    }
  } else {
    // Web app: use relative URLs
    _apiBaseUrl = '';
  }
}

/**
 * Reset configuration state to allow forced reinitialization
 * Useful for testing or recovery from configuration errors
 */
export function resetConfig(): void {
  _apiBaseUrl = null;
  _configError = null;
  console.log('[Config] Configuration reset, will reinitialize on next access');
}

// Initialize on module load
initializeConfig();

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
