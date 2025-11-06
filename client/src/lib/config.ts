import { Capacitor } from '@capacitor/core';

/**
 * Configuration for API and WebSocket URLs
 * Handles both web and mobile (Capacitor) environments
 */

// Check if running in a Capacitor native app
export const isNative = Capacitor.isNativePlatform();

/**
 * Get the API base URL based on environment
 * - In web: uses relative URLs (proxied by Vite in dev, same origin in production)
 * - In native mobile: uses absolute URL to production backend
 */
export function getApiBaseUrl(): string {
  if (isNative) {
    // Mobile app: use production backend URL from environment variable
    const productionUrl = import.meta.env.VITE_API_URL;
    
    if (!productionUrl) {
      // CRITICAL ERROR: Mobile app cannot function without backend URL
      const errorMsg = '❌ VITE_API_URL is not configured! Mobile app cannot connect to backend. Please set VITE_API_URL in .env file and rebuild.';
      console.error(errorMsg);
      
      // Also alert the user so they know immediately
      alert('Configuration Error: Backend URL not set. The app cannot connect to the server. Please contact support.');
      
      throw new Error(errorMsg);
    }
    
    return productionUrl;
  }
  
  // Web app: use relative URLs
  return '';
}

/**
 * Get the WebSocket URL based on environment
 * - In web: constructs from window.location
 * - In native mobile: uses production WebSocket URL
 */
export function getWebSocketUrl(): string {
  if (isNative) {
    // Mobile app: use production WebSocket URL
    const apiUrl = getApiBaseUrl();
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
