import { useState, useEffect, useCallback, useRef } from "react";

const HEALTH_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "") + "/health";
const VERIFY_TIMEOUT = 5000;
const POLL_INTERVAL = 30000;

export interface ConnectivityState {
  isOnline: boolean;
  isVerified: boolean;
}

type ReconnectCallback = () => void;

export const useConnectivity = () => {
  const [state, setState] = useState<ConnectivityState>({
    isOnline: navigator.onLine,
    isVerified: false,
  });

  const reconnectCallbacksRef = useRef<ReconnectCallback[]>([]);
  const wasOfflineRef = useRef(!navigator.onLine);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const verify = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT);
      const res = await fetch(HEALTH_URL, {
        method: "HEAD",
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const handleOnline = useCallback(async () => {
    setState((prev) => ({ ...prev, isOnline: true }));
    const verified = await verify();
    setState({ isOnline: true, isVerified: verified });

    if (verified && wasOfflineRef.current) {
      for (const cb of reconnectCallbacksRef.current) {
        cb();
      }
    }
    wasOfflineRef.current = false;
  }, [verify]);

  const handleOffline = useCallback(() => {
    wasOfflineRef.current = true;
    setState({ isOnline: false, isVerified: false });
  }, []);

  const onReconnect = useCallback((cb: ReconnectCallback) => {
    reconnectCallbacksRef.current.push(cb);
    return () => {
      reconnectCallbacksRef.current = reconnectCallbacksRef.current.filter(
        (c) => c !== cb,
      );
    };
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial verification
    if (navigator.onLine) {
      verify().then((verified) => {
        setState({ isOnline: true, isVerified: verified });
      });
    }

    // Periodic polling when online to detect silent connectivity loss
    pollRef.current = setInterval(async () => {
      if (navigator.onLine) {
        const verified = await verify();
        setState((prev) => ({ ...prev, isVerified: verified }));
        if (!verified) {
          wasOfflineRef.current = true;
        }
      }
    }, POLL_INTERVAL);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [handleOnline, handleOffline, verify]);

  return { ...state, onReconnect };
};
