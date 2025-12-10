import { useEffect, useMemo, useState } from "react";

export function useSettingsState({ conversations }) {
  const [sidebarSearch, setSidebarSearch] = useState("");

  const guestThreads = useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          conversation.guestMode &&
          conversation.status !== "burned" &&
          conversation.status !== "blocked"
      ),
    [conversations]
  );

  return {
    sidebarSearch,
    setSidebarSearch,
    guestThreads,
  };
}
