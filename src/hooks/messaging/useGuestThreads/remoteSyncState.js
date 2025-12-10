import { useEffect, useRef } from "react";

import { CONFIG } from "@/lib/config";

export function useRemoteSyncState({ remoteAllowed, load }) {
  const remoteSyncTimerRef = useRef(null);
  const remoteSyncBackoffRef = useRef(60_000);
  const remoteSyncInFlightRef = useRef(false);
  const loadRef = useRef(load);

  // Keep loadRef current without triggering effect re-runs
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    const BASE_INTERVAL = 60_000;
    const MAX_INTERVAL = 5 * 60_000;

    const clearTimer = () => {
      if (remoteSyncTimerRef.current) {
        clearTimeout(remoteSyncTimerRef.current);
        remoteSyncTimerRef.current = null;
      }
    };

    if (
      !remoteAllowed ||
      !CONFIG.REMOTE_MESSAGING_ENABLED ||
      !CONFIG.REMOTE_MESSAGING_API_URL
    ) {
      clearTimer();
      remoteSyncBackoffRef.current = BASE_INTERVAL;
      return undefined;
    }

    let cancelled = false;
    remoteSyncBackoffRef.current = BASE_INTERVAL;

    const schedule = (delay) => {
      if (cancelled) return;
      clearTimer();
      remoteSyncTimerRef.current = setTimeout(() => {
        remoteSyncTimerRef.current = null;
        runSync();
      }, delay);
    };

    const runSync = async () => {
      if (cancelled) return;
      if (remoteSyncInFlightRef.current) {
        schedule(remoteSyncBackoffRef.current);
        return;
      }

      remoteSyncInFlightRef.current = true;

      try {
        await loadRef.current({ background: true });
        remoteSyncBackoffRef.current = BASE_INTERVAL;
      } catch (error) {
        console.warn("[guestThreads] background remote sync failed", error);
        remoteSyncBackoffRef.current = Math.min(
          remoteSyncBackoffRef.current * 2,
          MAX_INTERVAL,
        );
      } finally {
        remoteSyncInFlightRef.current = false;
        if (!cancelled) {
          schedule(remoteSyncBackoffRef.current);
        }
      }
    };

    schedule(30_000);

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [remoteAllowed]);

  return {};
}
