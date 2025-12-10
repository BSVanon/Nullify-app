import React, {
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import SettingsSidebar from "@/components/settings/SettingsSidebar.jsx";
import { RailContext } from "@/contexts/RailContext";
import { useWallet } from "@/contexts/WalletContext.jsx";
import { useNotification } from "@/contexts/NotificationContext.jsx";
import useGuestThreads from "@/hooks/messaging/useGuestThreads.js";
import { useSettingsSections } from "@/hooks/settings/useSettingsSections.jsx";
import { useOverlayDiagnostics } from "@/hooks/settings/useOverlayDiagnostics";
import { useOverlayTelemetry } from "@/hooks/settings/useOverlayTelemetry";
import { useHelperCacheHealth } from "@/hooks/settings/useHelperCacheHealth";
import { useSettingsHandlers } from "@/hooks/settings/useSettingsHandlers";
import { useSettingsState } from "@/hooks/settings/useSettingsState";
import { cn } from "@/lib/utils";

export default function SettingsPageClone() {
  const { railCollapsed } = useContext(RailContext);
  const {
    conversations,
    blockedInviters,
    unblockInviter,
    overlayStatus,
    typingIndicatorEnabled,
    setTypingIndicatorEnabled,
    remoteSyncPreference,
    remoteSyncStatus,
    setRemoteSyncEnabled,
    upgradeThreadToHolder,
    sendOnEnter,
    setSendOnEnter,
  } = useGuestThreads();
  const {
    isConnected: walletConnected,
    isLoading: walletLoading,
    walletType,
    identityKey,
    network,
    version,
    peerPayActive,
    connectWallet
  } = useWallet();
  const { addNotification } = useNotification();

  const { sidebarSearch, setSidebarSearch, guestThreads } = useSettingsState({ conversations });

  const syncStatus = useMemo(() => {
    if (!overlayStatus || overlayStatus === "stub") return "Local only";
    if (overlayStatus === "online") return "Synced via overlay";
    return `Overlay: ${overlayStatus}`;
  }, [overlayStatus]);

  const telemetry = useOverlayTelemetry();
  const helperCacheHealth = useHelperCacheHealth();

  const overlayDiagnostics = useOverlayDiagnostics({
    overlayStatus,
    walletConnected,
    walletType,
    network,
    version,
    remoteSyncStatus,
    peerPayActive,
    telemetry,
    helperCacheHealth,
  });

  const {
    connectionError,
    upgradeErrorByThread,
    upgradingThreadId,
    handleConnectWallet,
    handleUpgradeThread,
  } = useSettingsHandlers({ connectWallet, addNotification, upgradeThreadToHolder, walletConnected });

  const handleUpgradeViaBsvDesktop = React.useCallback(() => {
    if (!guestThreads || guestThreads.length === 0) {
      addNotification({
        type: "error",
        message: "No guest threads available to upgrade.",
        duration: 5000,
      });
      return;
    }

    const target = guestThreads[0];
    handleUpgradeThread(target.id);
  }, [addNotification, guestThreads, handleUpgradeThread]);

  const sections = useSettingsSections({
    walletConnected,
    walletLoading,
    walletType,
    network,
    version,
    identityKey,
    connectionError,
    syncStatus,
    handleConnectWallet,
    handleConnectWalletBrc6: handleUpgradeViaBsvDesktop,
    guestThreads,
    upgradingThreadId,
    upgradeErrorByThread,
    handleUpgradeThread,
    remoteSyncPreference,
    remoteSyncStatus,
    setRemoteSyncEnabled,
    typingIndicatorEnabled,
    setTypingIndicatorEnabled,
    blockedInviters,
    unblockInviter,
    overlayDiagnostics,
    sendOnEnter,
    setSendOnEnter,
  });

  const [activeSectionId, setActiveSectionId] = useState(
    () => sections[0]?.id ?? null
  );

  useEffect(() => {
    if (sections.length === 0) {
      setActiveSectionId(null);
      return;
    }
    setActiveSectionId((prev) => prev ?? sections[0].id);
  }, [sections]);

  const filteredSections = useMemo(() => {
    if (!sidebarSearch.trim()) return sections;
    const term = sidebarSearch.trim().toLowerCase();
    return sections.filter((section) =>
      section.label.toLowerCase().includes(term)
    );
  }, [sections, sidebarSearch]);

  useEffect(() => {
    if (filteredSections.length === 0) {
      setActiveSectionId(null);
      return;
    }
    if (!filteredSections.some((section) => section.id === activeSectionId)) {
      setActiveSectionId(filteredSections[0].id);
    }
  }, [filteredSections, activeSectionId]);

  const activeSectionConfig = useMemo(
    () => sections.find((section) => section.id === activeSectionId) ?? sections[0] ?? null,
    [sections, activeSectionId]
  );

  return (
    <div className="flex h-full min-h-[640px] flex-1 overflow-hidden bg-background">
      <SettingsSidebar
        sections={filteredSections}
        activeSectionId={activeSectionId}
        onSelectSection={setActiveSectionId}
        searchValue={sidebarSearch}
        onSearchChange={setSidebarSearch}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header
          className={cn(
            "border-b border-border/60 bg-background px-6 py-5 transition-all",
            railCollapsed ? "md:pl-16 md:pr-6" : "md:px-6"
          )}
        >
          <h2 className="text-2xl font-semibold tracking-tight">
            {activeSectionConfig?.label ?? "Settings"}
          </h2>
          {activeSectionConfig?.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {activeSectionConfig.description}
            </p>
          )}
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            {activeSectionConfig?.render?.() || (
              <SettingsPlaceholderCard
                title="Nothing to show"
                description="No settings match your search."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
