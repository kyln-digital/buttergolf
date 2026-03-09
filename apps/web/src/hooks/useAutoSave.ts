"use client";

import { useRef, useEffect, useCallback, useState } from "react";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";
export type AutoSaveResult = "saved" | "skipped" | "error";

interface UseAutoSaveOptions<T> {
  /** The data to autosave */
  data: T;
  /**
   * Async function that performs the save.
   *
   * Return values:
   * - "saved" (or true): persisted successfully
   * - "skipped": intentionally not persisted (for example, no meaningful data yet)
   * - "error" (or false): persistence failed
   */
  onSave: (data: T) => Promise<AutoSaveResult | boolean>;
  /** Debounce delay in ms (default: 10000 — 10 seconds of inactivity) */
  debounceMs?: number;
  /** Whether autosave is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook that autosaves data to a backend after a debounce period.
 *
 * - Only fires when data actually changes (deep JSON comparison)
 * - Returns visual status for save indicators
 * - Does not block the UI — fire-and-forget with error tracking
 */
export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 10_000,
  enabled = true,
}: UseAutoSaveOptions<T>): {
  status: AutoSaveStatus;
  /** Force an immediate save */
  saveNow: () => Promise<void>;
} {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJson = useRef<string>("");
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Guard against setting state after unmount
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  const dataJson = JSON.stringify(data);

  const doSave = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    // Skip if nothing changed since last save
    if (dataJson === lastSavedJson.current) return;

    setStatus("saving");
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        onSaveRef.current(JSON.parse(dataJson) as T),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Save timeout")), 30_000);
        }),
      ]);

      if (!mountedRef.current) return;

      if (result === true || result === "saved") {
        lastSavedJson.current = dataJson;
        setStatus("saved");
      } else if (result === "skipped") {
        setStatus("idle");
      } else {
        setStatus("error");
      }
    } catch {
      if (mountedRef.current) setStatus("error");
    } finally {
      clearTimeout(timeoutId);
    }
  }, [dataJson]);

  // Schedule save on data change
  useEffect(() => {
    if (!enabled) return;

    // Skip until there's a meaningful first save reference
    if (lastSavedJson.current === "") {
      lastSavedJson.current = dataJson;
      return;
    }

    // Data unchanged — nothing to do
    if (dataJson === lastSavedJson.current) return;

    if (timer.current) {
      clearTimeout(timer.current);
    }

    timer.current = setTimeout(() => {
      void doSave();
    }, debounceMs);

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [dataJson, debounceMs, enabled, doSave]);

  return { status, saveNow: doSave };
}
