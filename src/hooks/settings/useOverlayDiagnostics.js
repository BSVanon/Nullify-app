import { useMemo } from "react";
import { CONFIG } from "@/lib/config";
import { useMessageBoxHealth } from "@/hooks/settings/useMessageBoxHealth";

export function useOverlayDiagnostics({
  overlayStatus,
  walletConnected,
  walletType,
  network,
  version,
  remoteSyncStatus,
  peerPayActive,
  telemetry,
  helperCacheHealth,
}) {
  const messageBoxHealth = useMessageBoxHealth();

  return useMemo(() => {
    const normalizedOverlayStatus = String(overlayStatus || "").toLowerCase();

    let overlayLabel;
    let overlayTone;

    if (normalizedOverlayStatus === "online") {
      overlayLabel =
        "Live connection is on. Other devices can see your messages in real time.";
      overlayTone = "online";
    } else if (normalizedOverlayStatus === "offline-no-endpoint") {
      overlayLabel =
        "Live relay is not configured. Messages stay on this device only.";
      overlayTone = "local";
    } else if (
      normalizedOverlayStatus === "offline" ||
      normalizedOverlayStatus === "disconnected"
    ) {
      overlayLabel =
        "Live connection is down. New messages may not reach other devices until it's back.";
      overlayTone = "offline";
    } else if (normalizedOverlayStatus === "stub" || !normalizedOverlayStatus) {
      overlayLabel = "Using this device only. Messages stay on this browser.";
      overlayTone = "local";
    } else if (
      normalizedOverlayStatus === "connecting" ||
      normalizedOverlayStatus === "reconnecting"
    ) {
      const reconnects = telemetry?.reconnectCount || 0;

      if (!telemetry?.lastConnected && reconnects >= 3) {
        overlayLabel =
          "Having trouble reaching the live relay. Messages may only be visible on this device right now.";
        overlayTone = "offline";
      } else {
        overlayLabel = "Connecting to live message relay…";
        overlayTone = "connecting";
      }
    } else {
      overlayLabel = "Connecting to live message relay…";
      overlayTone = "info";
    }

    // When we have telemetry, compute a simple "last seen" description for the
    // live message connection and surface it directly in the summary tile.
    const overlayLastSeen = (() => {
      if (overlayStatus === "online" && telemetry?.lastConnected) {
        const date = new Date(telemetry.lastConnected);
        return `Connected at ${date.toLocaleTimeString()}`;
      }
      if (overlayStatus === "online") {
        return "Connected now";
      }
      if (telemetry?.lastDisconnected) {
        const date = new Date(telemetry.lastDisconnected);
        return `Disconnected at ${date.toLocaleTimeString()}`;
      }
      return "";
    })();

    const networkLabel = network || "wallet connection";

    // Helper cache status (offline delivery helper)
    let helperCacheLabel;
    let helperCacheTone;
    
    if (!helperCacheHealth) {
      helperCacheLabel = "Checking offline delivery helper…";
      helperCacheTone = "connecting";
    } else if (helperCacheHealth.available && helperCacheHealth.status === 'ok') {
      helperCacheLabel = `Can hold encrypted messages for friends who are offline (${helperCacheHealth.entries || 0} waiting).`;
      helperCacheTone = "ok";
    } else if (helperCacheHealth.status === 'not-configured') {
      helperCacheLabel = "Offline delivery helper not set up.";
      helperCacheTone = "off";
    } else {
      helperCacheLabel = "Offline delivery helper unavailable. Messages only deliver while both of you are online.";
      helperCacheTone = "off";
    }

    // Multi-device sync is a coming-soon feature; show a simple teaser.
    const remoteSyncLabel =
      "Coming soon: sync your conversations across multiple devices.";

    const remoteSyncTone = "info";

    const normalizedMessageBoxStatus = String(
      messageBoxHealth?.status || "unknown",
    ).toLowerCase();

    // Combined automatic payments + message queue indicator
    let combinedPaymentsLabel;
    let combinedPaymentsTone;

    const hasMessageBoxEnvConfig = Boolean(
      CONFIG.MESSAGE_BOX_WS_URL && CONFIG.MESSAGE_BOX_APP_ID,
    );

    let messageBoxLabel;
    let messageBoxTone;

    if (!walletConnected) {
      if (hasMessageBoxEnvConfig) {
        messageBoxLabel = `Configured at ${CONFIG.MESSAGE_BOX_WS_URL}`;
        messageBoxTone = "off";
      } else {
        messageBoxLabel = "Waiting for wallet connection";
        messageBoxTone = "off";
      }

      combinedPaymentsLabel =
        "Connect your wallet to turn on automatic payments and the background payment queue.";
      combinedPaymentsTone = "off";
    } else {
      if (normalizedMessageBoxStatus === "ok" && peerPayActive) {
        messageBoxLabel = "MessageBox connected via your wallet";
        messageBoxTone = "ok";
        combinedPaymentsLabel =
          "Incoming sats can be accepted automatically and queued for you if your wallet is briefly offline.";
        combinedPaymentsTone = "ok";
      } else if (
        peerPayActive &&
        (normalizedMessageBoxStatus === "degraded" ||
          normalizedMessageBoxStatus === "error")
      ) {
        messageBoxLabel =
          "Wallet connected, but MessageBox is not responding (see console logs)";
        messageBoxTone = "off";
        combinedPaymentsLabel =
          "Your wallet is connected, but the background payment queue is having problems. Automatic payments may be delayed.";
        combinedPaymentsTone = "off";
      } else if (peerPayActive && normalizedMessageBoxStatus === "connecting") {
        messageBoxLabel = "Checking MessageBox status via your wallet…";
        messageBoxTone = "connecting";
        combinedPaymentsLabel =
          "Setting up automatic payments and the background queue…";
        combinedPaymentsTone = "connecting";
      } else {
        messageBoxLabel = "Managed by your wallet";
        messageBoxTone = "info";
        combinedPaymentsLabel =
          "Your wallet is connected, but automatic payments and the background queue are off.";
        combinedPaymentsTone = "off";
      }
    }

    return {
      summary: [
        {
          id: "overlay-status",
          label: "Live message connection",
          value: overlayLastSeen
            ? `${overlayLabel} (${overlayLastSeen})`
            : overlayLabel,
          tone: overlayTone,
        },
        {
          id: "helper-cache",
          label: "Offline delivery helper",
          value: helperCacheLabel,
          tone: helperCacheTone,
        },
        {
          id: "remote-sync",
          label: "Multi-device sync (coming soon)",
          value: remoteSyncLabel,
          tone: remoteSyncTone,
        },
        {
          id: "payments-and-queue",
          label: "Automatic payments & queue",
          value: combinedPaymentsLabel,
          tone: combinedPaymentsTone,
        },
      ],
      // Relays box removed from UI; keep an empty list for now.
      relays: [],
      events: [
        {
          id: "evt-wallet",
          time: "—",
          scope: "wallet",
          message: walletConnected
            ? `Wallet connected (${walletType || "unknown type"} on ${networkLabel}).`
            : "No wallet connected.",
        },
        {
          id: "evt-remote-sync",
          time: "—",
          scope: "sync",
          message: remoteSyncLabel,
        },
        {
          id: "evt-payments-queue",
          time: "—",
          scope: "payments",
          message: combinedPaymentsLabel,
        },
        {
          id: "evt-messagebox",
          time: "—",
          scope: "messagebox",
          message: messageBoxLabel,
        },
      ],
    };
  }, [
    overlayStatus,
    walletConnected,
    walletType,
    network,
    version,
    remoteSyncStatus,
    peerPayActive,
    telemetry,
    helperCacheHealth,
    messageBoxHealth,
  ]);
}
