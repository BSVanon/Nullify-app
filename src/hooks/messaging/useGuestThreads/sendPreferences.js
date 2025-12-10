import { useCallback, useState } from "react";

const SEND_ON_ENTER_KEY = "nukenote:send-on-enter";
const hasWindow = typeof window !== "undefined";

function readSendPreference() {
  if (!hasWindow || !window?.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SEND_ON_ENTER_KEY);
    if (raw === null || raw === "") return null;
    return raw === "true";
  } catch (error) {
    console.warn("[sendPreference] failed to read send-on-enter preference", error);
    return null;
  }
}

function writeSendPreference(value) {
  if (!hasWindow || !window?.localStorage) {
    return;
  }

  try {
    if (value === null) {
      window.localStorage.removeItem(SEND_ON_ENTER_KEY);
    } else {
      window.localStorage.setItem(SEND_ON_ENTER_KEY, value ? "true" : "false");
    }
  } catch (error) {
    console.warn("[sendPreference] failed to persist send-on-enter preference", error);
  }
}

export function useSendPreference() {
  const [sendOnEnter, setSendOnEnterState] = useState(() => {
    const stored = readSendPreference();
    return stored ?? false;
  });

  const setSendOnEnter = useCallback((next) => {
    setSendOnEnterState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      const normalized = Boolean(value);
      writeSendPreference(normalized);
      return normalized;
    });
  }, []);

  return {
    sendOnEnter,
    setSendOnEnter,
  };
}
