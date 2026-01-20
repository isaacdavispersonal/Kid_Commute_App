import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

interface RefreshContextType {
  registerRefresh: (key: string, callback: () => Promise<void>) => void;
  unregisterRefresh: (key: string) => void;
  triggerRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

const RefreshContext = createContext<RefreshContextType | null>(null);

export function useRefresh() {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error("useRefresh must be used within a RefreshProvider");
  }
  return context;
}

export function useRegisterRefresh(key: string, callback: () => Promise<void>) {
  const { registerRefresh, unregisterRefresh } = useRefresh();
  
  useEffect(() => {
    registerRefresh(key, callback);
    return () => unregisterRefresh(key);
  }, [key, callback, registerRefresh, unregisterRefresh]);
}

interface RefreshProviderProps {
  children: React.ReactNode;
}

export function RefreshProvider({ children }: RefreshProviderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const callbacksRef = useRef<Map<string, () => Promise<void>>>(new Map());

  const registerRefresh = useCallback((key: string, callback: () => Promise<void>) => {
    callbacksRef.current.set(key, callback);
  }, []);

  const unregisterRefresh = useCallback((key: string) => {
    callbacksRef.current.delete(key);
  }, []);

  const triggerRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const callbacks = Array.from(callbacksRef.current.values());
      await Promise.all(callbacks.map(cb => cb().catch(console.error)));
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  return (
    <RefreshContext.Provider value={{ registerRefresh, unregisterRefresh, triggerRefresh, isRefreshing }}>
      {children}
    </RefreshContext.Provider>
  );
}
