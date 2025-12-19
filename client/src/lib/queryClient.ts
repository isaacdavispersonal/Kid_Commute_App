import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiUrl, isNative } from "./config";
import { getAuthToken } from "./mobile-auth";

// Debug logging for API calls
const DEBUG_API = true;
function debugLog(message: string, data?: any) {
  if (DEBUG_API) {
    console.log(`[QueryClient] ${message}`, data !== undefined ? data : '');
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // Try to parse JSON and extract message for better error display
    let errorMessage = `${res.status}: ${text}`;
    try {
      const json = JSON.parse(text);
      if (json.message) {
        errorMessage = json.message;
      }
    } catch (e) {
      // If JSON parsing fails, use the raw text with status code
    }
    throw new Error(errorMessage);
  }
}

/**
 * Get fetch options based on platform (native vs web)
 * - Native: Use Bearer token from Capacitor Preferences
 * - Web: Use credentials: "include" for cookies
 */
async function getFetchOptions(extraHeaders?: Record<string, string>): Promise<RequestInit> {
  const headers: Record<string, string> = { ...extraHeaders };
  
  debugLog(`getFetchOptions called, isNative: ${isNative}`);
  
  if (isNative) {
    const token = await getAuthToken();
    debugLog(`Native mode - token retrieved: ${!!token}, length: ${token?.length || 0}`);
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      debugLog('Authorization header set');
    } else {
      debugLog('WARNING: No token available for native request!');
    }
    return { headers };
  } else {
    debugLog('Web mode - using credentials: include');
    return { 
      headers,
      credentials: "include" as RequestCredentials,
    };
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const fullUrl = getApiUrl(url);
  const baseHeaders: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  const fetchOptions = await getFetchOptions(baseHeaders);
  
  const res = await fetch(fullUrl, {
    method,
    ...fetchOptions,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey.join("/") as string;
    const fullUrl = getApiUrl(path);
    const fetchOptions = await getFetchOptions();
    
    const res = await fetch(fullUrl, fetchOptions);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
