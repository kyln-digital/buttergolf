"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * A useState replacement that syncs state to localStorage.
 *
 * - SSR-safe (reads localStorage only after mount)
 * - Debounced writes to avoid thrashing
 * - Cross-tab sync via storage event
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
  }
): [T, (value: T | ((prev: T) => T)) => void, { isHydrated: boolean; clear: () => void }] {
  const debounceMs = options?.debounceMs ?? 300;
  const maxAgeMs = options?.maxAgeMs ?? Number.POSITIVE_INFINITY;

  const [isHydrated, setIsHydrated] = useState(false);
  const [state, setState] = useState<T>(defaultValue);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const envelope: { value: T; _updatedAt: number } = JSON.parse(raw);

        // Discard if too old
        if (Date.now() - envelope._updatedAt > maxAgeMs) {
          localStorage.removeItem(key);
        } else {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: hydrating from localStorage on mount
          setState(envelope.value);
        }
      }
    } catch {
      // Corrupt data — discard
      localStorage.removeItem(key);
    }

    setIsHydrated(true);
  }, [key, maxAgeMs]);

  // Cross-tab sync
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== key) return;

      if (e.newValue === null) {
        setState(defaultValue);
        return;
      }

      try {
        const envelope: { value: T; _updatedAt: number } = JSON.parse(e.newValue);
        setState(envelope.value);
      } catch {
        // ignore
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key, defaultValue]);

  // Debounced write to localStorage
  const writeToStorage = useCallback(
    (value: T) => {
      if (typeof window === "undefined") return;

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        try {
          const envelope = { value, _updatedAt: Date.now() };
          localStorage.setItem(key, JSON.stringify(envelope));
        } catch {
          // Storage full or blocked — silently degrade
        }
      }, debounceMs);
    },
    [key, debounceMs]
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
