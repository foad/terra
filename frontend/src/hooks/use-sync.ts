import { useState, useEffect, useCallback } from "react";
import { syncEngine } from "../utils/sync-engine";
import type { ConnectivityState } from "./use-connectivity";

export interface QueueCounts {
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
}

const EMPTY_COUNTS: QueueCounts = { pending: 0, syncing: 0, synced: 0, failed: 0 };

export const useSync = (
  connectivity: ConnectivityState,
  onReconnect: (cb: () => void) => () => void,
) => {
  const [counts, setCounts] = useState<QueueCounts>(EMPTY_COUNTS);

  // Listen for queue status changes
  useEffect(() => {
    return syncEngine.onStatusChange(setCounts);
  }, []);

  // Process queue on reconnect
  useEffect(() => {
    return onReconnect(() => {
      syncEngine.processQueue();
    });
  }, [onReconnect]);

  // Process queue when connectivity is verified
  useEffect(() => {
    if (connectivity.isVerified) {
      syncEngine.processQueue();
    }
  }, [connectivity.isVerified]);

  // Periodic poll every 30s while online
  useEffect(() => {
    if (!connectivity.isOnline) return;
    const interval = setInterval(() => {
      syncEngine.processQueue();
    }, 30000);
    return () => clearInterval(interval);
  }, [connectivity.isOnline]);

  const manualSync = useCallback(() => {
    syncEngine.processQueue();
  }, []);

  return { counts, manualSync };
};
