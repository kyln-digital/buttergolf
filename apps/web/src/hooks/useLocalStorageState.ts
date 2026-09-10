"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * A useState replacement that syncs state to localStorage.
 *
 * - SSR-safe (reads localStorage only after mount)
 * - Debounced writes to avoid thrashing
 * - Cross-tab sync via storage event (opt out with syncAcrossTabs: false)
 * - Versioned keys prevent stale hydration after schema changes
 */
export function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
  options?: {
    /** Debounce delay for writes in ms (default: 300) */
    debounceMs?: number;
    /** Max age in ms. Stored values older than this are discarded (default: Infinity) */
    maxAgeMs?: number;
    /** Schema version. Bumping this discards any stored data written with an older version */
    schemaVersion?: number;
    /**
     * Adopt values written by other tabs (default: true).
     *
     * Right for shared state like a cart. Wrong for a form being typed into:
     * another tab's save would replace the fields under the user, and whatever
     * arrived would then be saved as if they had entered it.
     */
    syncAcrossTabs?: boolean;
  }
): [T, (value: T | ((prev: T) => T)) => void, { isHydrated: boolean; clear: () => void }] {
  const debounceMs = options?.debounceMs ?? 300;
  const maxAgeMs = options?.maxAgeMs ?? Number.POSITIVE_INFINITY;
  const schemaVersion = options?.schemaVersion;
  const syncAcrossTabs = options?.syncAcrossTabs ?? true;

  const [isHydrated, setIsHydrated] = useState(false);
  const [state, setState] = useState<T>(defaultValue);
  // Captured once so the hydration effect can fall back to it without callers
  // having to memoise an inline default. The default is a constant for every
  // caller, so there is nothing to keep in sync.
  const defaultValueRef = useRef(defaultValue);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(key);
      const envelope: { value: T; _updatedAt: number; _version?: number } | null = raw
        ? JSON.parse(raw)
        : null;

      const usable =
        envelope !== null &&
        (schemaVersion === undefined || envelope._version === schemaVersion) &&
        Date.now() - envelope._updatedAt <= maxAgeMs;

      if (envelope !== null && !usable) {
        localStorage.removeItem(key);
      }

      // The key can change while mounted (the sell form switches records), so
      // anything unusable has to reset the in-memory value too — otherwise the
      // previous key's data stays on screen and gets saved under the new one.
      // Missing, expired, version-mismatched and corrupt all take this path,
      // not just missing.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: hydrating or resetting for the current key
      setState(usable ? envelope.value : defaultValueRef.current);
    } catch {
      // Corrupt data — discard, and don't leave the previous key's value up.
      localStorage.removeItem(key);
       
      setState(defaultValueRef.current);
    }

    setIsHydrated(true);
  }, [key, maxAgeMs, schemaVersion]);

  // Cross-tab sync
  useEffect(() => {
    if (typeof window === "undefined" || !syncAcrossTabs) return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== key) return;

      if (e.newValue === null) {
        setState(defaultValue);
        return;
      }

      try {
        const envelope: { value: T; _updatedAt: number; _version?: number } = JSON.parse(
          e.newValue
        );
        if (schemaVersion !== undefined && envelope._version !== schemaVersion) return;
        setState(envelope.value);
      } catch {
        // ignore
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key, defaultValue, schemaVersion, syncAcrossTabs]);

  // Debounced write to localStorage
  const writeToStorage = useCallback(
    (value: T) => {
      if (typeof window === "undefined") return;

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        try {
          const envelope = { value, _updatedAt: Date.now(), _version: schemaVersion };
          localStorage.setItem(key, JSON.stringify(envelope));
        } catch {
          // Storage full or blocked — silently degrade
        }
      }, debounceMs);
    },
    [key, debounceMs, schemaVersion]
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, []);

  // Wrapper that updates both React state and localStorage
  const setPersistedState = useCallback(
    (valueOrUpdater: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next =
          typeof valueOrUpdater === "function"
            ? (valueOrUpdater as (prev: T) => T)(prev)
            : valueOrUpdater;
        writeToStorage(next);
        return next;
      });
    },
    [writeToStorage]
  );

  const clear = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem(key);
    }
    setState(defaultValue);
  }, [key, defaultValue]);

  return [state, setPersistedState, { isHydrated, clear }];
}
