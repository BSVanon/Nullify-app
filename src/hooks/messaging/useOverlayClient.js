import { useEffect, useRef, useState } from "react";
import { CONFIG } from "@/lib/config";
import { getOverlayClient } from "@/lib/messaging/overlayClientSingleton";
import { walletBootstrap } from "@/lib/walletBootstrap";

/**
 * Manages the overlay client singleton lifecycle
 * 
 * Responsibilities:
 * - Creates and maintains overlay client singleton
 * - Tracks connection status
 * - Survives component remounts and React StrictMode
 * - Never closes the singleton (survives until tab close)
 * 
 * @returns {{ client: object|null, status: string, clientRef: object }}
 */
export function useOverlayClient() {
  const [overlayStatus, setOverlayStatus] = useState("stub");
  const overlayClientRef = useRef(null);
  const statusCallbackRef = useRef(null);

  // Update status callback ref on every render so it's never stale
  statusCallbackRef.current = (next) => {
    const status = typeof next === 'string' ? next : next?.status ?? next;
    console.log('[useOverlayClient] status update:', status);
    setOverlayStatus(status);
  };

  useEffect(() => {
    // If client already exists and is valid, don't recreate
    if (overlayClientRef.current && typeof overlayClientRef.current.subscribe === 'function') {
      return;
    }

    let cancelled = false;

    const handleStatus = (next) => {
      if (cancelled) return;
      statusCallbackRef.current?.(next);
    };

    const walletStatus =
      typeof walletBootstrap.getStatus === 'function'
        ? walletBootstrap.getStatus()
        : {};
    const hasWalletIdentity = Boolean(
      walletStatus?.wallet && walletStatus?.identityKey,
    );
    const messageBoxHost = CONFIG.MESSAGE_BOX_WS_URL || null;

    // Always use websocket mode for now - messagebox mode is not yet stable
    // Mode switching based on receipts was causing client recreation and connection churn
    const mode = 'websocket';
    
    const client = getOverlayClient({
      mode,
      messageBoxHost,
      walletClient: walletStatus.wallet,
      identityKey: walletStatus.identityKey,
      onStatus: handleStatus,
      logger: console,
    });

    overlayClientRef.current = client;

    return () => {
      cancelled = true;
      // Don't close singleton here - it survives remounts
    };
  }); // No deps - run on every render but early-exit if client exists

  return {
    client: overlayClientRef.current,
    status: overlayStatus,
    clientRef: overlayClientRef,
  };
}
