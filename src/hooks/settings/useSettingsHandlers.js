import { useCallback, useState } from "react";

export function useSettingsHandlers({ connectWallet, addNotification, upgradeThreadToHolder, walletConnected }) {
  const [connectionError, setConnectionError] = useState(null);
  const [upgradeErrorByThread, setUpgradeErrorByThread] = useState({});
  const [upgradingThreadId, setUpgradingThreadId] = useState(null);

  const connectWithType = useCallback(
    async (type) => {
      setConnectionError(null);
      try {
        await connectWallet(type);
        addNotification({
          type: "success",
          message: "Wallet connected",
          duration: 3500
        });
      } catch (error) {
        const message = error?.message || "Wallet connection failed";
        setConnectionError(message);
        addNotification({
          type: "error",
          message,
          duration: 6000
        });
        // Do not rethrow here; callers (settings buttons) rely on local error state + notification
        // to show feedback, and React would treat a rejected onClick handler as an uncaught promise.
      }
    },
    [connectWallet, addNotification]
  );

  const handleConnectWallet = useCallback(async () => {
    return connectWithType();
  }, [connectWithType]);

  const handleConnectWalletBrc6 = useCallback(async () => {
    return connectWithType('brc6');
  }, [connectWithType]);

  const handleUpgradeThread = useCallback(
    async (threadId) => {
      if (!threadId || upgradingThreadId) return;
      setUpgradeErrorByThread((prev) => ({ ...prev, [threadId]: null }));
      setUpgradingThreadId(threadId);

      try {
        if (!walletConnected) {
          await handleConnectWallet();
        }

        await upgradeThreadToHolder(threadId);
        addNotification({
          type: "success",
          message: "Thread upgraded. Wallet-linked session ready.",
          duration: 4500
        });
      } catch (error) {
        const message = error?.message || "Failed to upgrade thread";
        setUpgradeErrorByThread((prev) => ({ ...prev, [threadId]: message }));
        addNotification({
          type: "error",
          message,
          duration: 7000
        });
      } finally {
        setUpgradingThreadId(null);
      }
    },
    [
      addNotification,
      handleConnectWallet,
      upgradeThreadToHolder,
      upgradingThreadId,
      walletConnected
    ]
  );

  return {
    connectionError,
    upgradeErrorByThread,
    upgradingThreadId,
    handleConnectWallet,
    handleConnectWalletBrc6,
    handleUpgradeThread,
  };
}
