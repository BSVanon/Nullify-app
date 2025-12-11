import GuestUpgradeSection from "@/components/settings/GuestUpgradeSection.jsx";
import OverlayDiagnosticsSection from "@/components/settings/OverlayDiagnosticsSection.jsx";
import PrivacySettingsSection from "@/components/settings/PrivacySettingsSection.jsx";
import ProfileSection from "@/components/settings/ProfileSection.jsx";
import SessionApprovalsSection from "@/components/settings/SessionApprovalsSection.jsx";
import DonateSection from "@/components/settings/DonateSection.jsx";
import WalletConnectionSection from "@/components/settings/WalletConnectionSection.jsx";
import ChatSettingsSection from "@/components/settings/ChatSettingsSection.jsx";
import AppearanceSettingsSection from "@/components/settings/AppearanceSettingsSection.jsx";
import BackupSection from '@/components/settings/BackupSection.jsx';

import { useMemo } from "react";
import { Button } from "@/components/ui/button";

import {
  Activity,
  Bell,
  Brush,
  Database,
  FolderDown,
  Heart,
  MessageCircle,
  Phone,
  Settings,
  Shield,
} from "lucide-react";

export function useSettingsSections({
  walletConnected,
  walletLoading,
  walletType,
  network,
  version,
  identityKey,
  connectionError,
  syncStatus,
  handleConnectWallet,
  handleConnectWalletBrc6,
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
}) {
  return useMemo(
    () => [
      {
        id: "general",
        label: "Account & identity",
        description: "Display name, upgrading guest threads to wallet-linked, and session approvals.",
        icon: Settings,
        render: () => (
          <>
            {!walletConnected && (
              <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-50">
                <div>
                  <p className="font-medium">Wallet required for profile & backup</p>
                  <p className="text-xs opacity-80">
                    Connect a wallet to edit your holder profile and enable cloud backup & recovery.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleConnectWallet}
                    disabled={walletLoading}
                  >
                    {walletLoading ? "Connecting5" : "Connect wallet"}
                  </Button>
                </div>
              </div>
            )}

            <ProfileSection
              walletConnected={walletConnected}
              hasGuestThreads={guestThreads.length > 0}
            />

            <BackupSection />

            <GuestUpgradeSection
              guestThreads={guestThreads}
              upgradingThreadId={upgradingThreadId}
              upgradeErrorByThread={upgradeErrorByThread}
              walletLoading={walletLoading}
              onUpgrade={handleUpgradeThread}
            />

            <SessionApprovalsSection />
          </>
        )
      },
      {
        id: "appearance",
        label: "Appearance",
        description: "Theme and text size on this device.",
        icon: Brush,
        render: () => <AppearanceSettingsSection />,
      },
      {
        id: "chats",
        label: "Threads & messaging",
        description: "Messaging shortcuts and thread behavior.",
        icon: MessageCircle,
        render: () => (
          <ChatSettingsSection
            sendOnEnter={sendOnEnter}
            setSendOnEnter={setSendOnEnter}
            typingIndicatorEnabled={typingIndicatorEnabled}
            setTypingIndicatorEnabled={setTypingIndicatorEnabled}
          />
        )
      },
      {
        id: "privacy",
        label: "Privacy & safety",
        description: "Cross-device sync and blocked inviters.",
        icon: Shield,
        render: () => (
          <PrivacySettingsSection
            remoteSyncPreference={remoteSyncPreference}
            remoteSyncStatus={remoteSyncStatus}
            setRemoteSyncEnabled={setRemoteSyncEnabled}
            blockedInviters={blockedInviters}
            unblockInviter={unblockInviter}
            syncStatus={syncStatus}
          />
        )
      },
      {
        id: "diagnostics",
        label: "Diagnostics",
        description: "Wallet connection, relay health, and offline delivery status.",
        icon: Activity,
        render: () => (
          <>
            <WalletConnectionSection
              walletConnected={walletConnected}
              walletLoading={walletLoading}
              walletType={walletType}
              network={network}
              version={version}
              identityKey={identityKey}
              connectionError={connectionError}
              syncStatus={syncStatus}
              onConnect={handleConnectWallet}
              onConnectBrc6={handleConnectWalletBrc6}
            />
            <OverlayDiagnosticsSection overlayDiagnostics={overlayDiagnostics} />
          </>
        )
      },
      {
        id: "donate",
        label: "Donate",
        description: "Support Nullify development with a Bitcoin donation.",
        icon: Heart,
        render: () => (
          <DonateSection walletConnected={walletConnected} />
        )
      }
    ],
    [
      blockedInviters,
      connectionError,
      guestThreads,
      handleConnectWallet,
      handleConnectWalletBrc6,
      handleUpgradeThread,
      identityKey,
      network,
      overlayDiagnostics,
      remoteSyncPreference,
      remoteSyncStatus,
      setRemoteSyncEnabled,
      setTypingIndicatorEnabled,
      syncStatus,
      typingIndicatorEnabled,
      unblockInviter,
      upgradeErrorByThread,
      upgradingThreadId,
      walletConnected,
      walletLoading,
      walletType,
      version,
      sendOnEnter,
      setSendOnEnter,
    ]
  );
}
