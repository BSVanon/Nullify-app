import { useCallback, useRef, useState } from "react";

const TYPING_PREFS_KEY = "nukenote:typing-indicator-preferences";
const DEFAULT_PREF_KEY = "__default__";

const hasWindow = typeof window !== "undefined";

function readPreferenceMap() {
  if (!hasWindow || !window?.localStorage) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(TYPING_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("[guestThreads] failed to read typing preference map", error);
    return {};
  }
}

function writePreferenceMap(map) {
  if (!hasWindow || !window?.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(TYPING_PREFS_KEY, JSON.stringify(map));
  } catch (error) {
    console.warn("[guestThreads] failed to persist typing preference map", error);
  }
}

function preferenceKey(identityKey) {
  return identityKey && identityKey.trim() !== "" ? identityKey : DEFAULT_PREF_KEY;
}

/**
 * Hook to manage per-identity typing indicator preferences
 * Stores preferences in localStorage keyed by public key
 */
export function useTypingPreference() {
  const preferenceMapRef = useRef(readPreferenceMap());
  const activeIdentityRef = useRef(null);

  const readStoredPreference = useCallback(
    (identityKey) => {
      const map = preferenceMapRef.current;
      const key = preferenceKey(identityKey);
      if (Object.prototype.hasOwnProperty.call(map, key)) {
        const value = map[key];
        return typeof value === "boolean" ? value : null;
      }
      return null;
    },
    [],
  );

  const [typingIndicatorEnabled, setTypingIndicatorEnabledState] = useState(() => {
    const map = preferenceMapRef.current;
    const defaultValue = map[DEFAULT_PREF_KEY];
    return typeof defaultValue === "boolean" ? defaultValue : true;
  });

  const typingEnabledRef = useRef(typingIndicatorEnabled);

  const persistPreference = useCallback((identityKey, enabled) => {
    const map = { ...preferenceMapRef.current };
    map[preferenceKey(identityKey)] = Boolean(enabled);
    preferenceMapRef.current = map;
    writePreferenceMap(map);
  }, []);

  const setTypingIndicatorEnabled = useCallback(
    (next) => {
      setTypingIndicatorEnabledState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        const normalized = Boolean(value);
        typingEnabledRef.current = normalized;
        persistPreference(activeIdentityRef.current, normalized);
        return normalized;
      });
    },
    [persistPreference],
  );

  const setTypingIdentityKey = useCallback(
    (identityKey) => {
      const normalizedKey = identityKey || null;
      if (activeIdentityRef.current === normalizedKey) return;

      const freshMap = readPreferenceMap();
      preferenceMapRef.current = freshMap;

      console.info("[typingPreference] setTypingIdentityKey", {
        incomingIdentity: identityKey,
        normalizedKey,
        activeIdentity: activeIdentityRef.current,
        storedKeys: Object.keys(freshMap),
      });

      if (normalizedKey) {
        const key = preferenceKey(normalizedKey);
        if (!Object.prototype.hasOwnProperty.call(freshMap, key)) {
          const defaultValue = freshMap[DEFAULT_PREF_KEY];
          console.info("[typingPreference] migrating default", {
            defaultValue,
          });
          if (typeof defaultValue === "boolean") {
            const nextMap = { ...freshMap, [key]: defaultValue };
            delete nextMap[DEFAULT_PREF_KEY];
            preferenceMapRef.current = nextMap;
            writePreferenceMap(nextMap);
            console.info("[typingPreference] migration complete", {
              migratedKey: key,
              mapKeys: Object.keys(nextMap),
            });
          }
        }
      }

      activeIdentityRef.current = normalizedKey;

      const stored = normalizedKey
        ? readStoredPreference(normalizedKey)
        : readStoredPreference(null);
      const nextValue = stored ?? true;

      console.info("[typingPreference] resolved preference", {
        normalizedKey,
        stored,
        nextValue,
      });

      typingEnabledRef.current = nextValue;
      setTypingIndicatorEnabledState(nextValue);
    },
    [readStoredPreference],
  );

  return {
    typingIndicatorEnabled,
    setTypingIndicatorEnabled,
    typingEnabledRef,
    setTypingIdentityKey,
  };
}
