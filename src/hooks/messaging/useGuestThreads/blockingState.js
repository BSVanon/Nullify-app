import { useCallback } from "react";

import { removeBlockedInviter } from "@/lib/messaging/storage";

export function useBlockingState({ blockedInviters, load }) {
  const unblockInviter = useCallback(
    async (inviterId) => {
      if (!inviterId) return;
      await removeBlockedInviter(inviterId);
      // Note: setBlockedInviters update is handled in the main hook
      await load();
    },
    [load],
  );

  const isInviterBlocked = useCallback(
    (inviterId) => blockedInviters.some((entry) => entry.id === inviterId),
    [blockedInviters],
  );

  return { unblockInviter, isInviterBlocked };
}
