"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildPhoneUploadUrl,
  PHONE_UPLOAD_POLL_INTERVAL_MS,
  type PhoneUploadPhoto,
  type PhoneUploadSessionCreated,
} from "@/lib/phone-upload";

/** A live QR-code session as the desktop sees it. */
export interface PhoneUploadSessionSnapshot {
  sessionId: string;
  /** The full URL the QR code encodes, token included. */
  url: string;
  expiresAt: number;
  maxPhotos: number;
}

export interface UsePhoneUploadSessionOptions {
  /**
   * Called with the URLs of photos the phone has sent that this hook hasn't
   * reported before. After a reload the whole session is reported again, so
   * callers should ignore URLs they already hold.
   */
  onPhotos: (urls: string[]) => void;
  /** Slots the form has free. Baked into the token as the phone's allowance. */
  remainingSlots: number;
}

export interface UsePhoneUploadSessionReturn {
  session: PhoneUploadSessionSnapshot | null;
  /** True once the session's token can no longer be used. */
  isExpired: boolean;
  /** Whole seconds until expiry; 0 when expired or when there is no session. */
  secondsLeft: number;
  /** Photos received in this session so far. */
  receivedCount: number;
  isStarting: boolean;
  error: string | null;
  /** Mints a fresh session, replacing any existing one. */
  start: () => Promise<void>;
  /** Forgets the session and stops polling. */
  stop: () => void;
}

const STORAGE_PREFIX = "buttergolf-phone-upload-session";

/**
 * One key per sell-form record, so a session restored after a reload can only
 * feed the record it was started for. The sell form's URL identifies the
 * record (/sell, /sell?draftId=…, /sell/[id]/edit) and does not change while
 * it is open.
 */
function storageKey(): string {
  return `${STORAGE_PREFIX}:${window.location.pathname}${window.location.search}`;
}

function readStoredSession(): PhoneUploadSessionSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PhoneUploadSessionSnapshot>;
    if (
      typeof parsed.sessionId !== "string" ||
      typeof parsed.url !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.maxPhotos !== "number"
    ) {
      return null;
    }
    if (parsed.expiresAt <= Date.now()) return null;
    return parsed as PhoneUploadSessionSnapshot;
  } catch {
    return null;
  }
}

function writeStoredSession(session: PhoneUploadSessionSnapshot | null): void {
  try {
    if (session) {
      window.sessionStorage.setItem(storageKey(), JSON.stringify(session));
    } else {
      window.sessionStorage.removeItem(storageKey());
    }
  } catch {
    // Storage blocked: the session still works for the life of this page.
  }
}

/**
 * Desktop side of the phone photo handoff. Mints a session, polls it while it
 * is live, and reports new photos to the caller. The session survives a reload
 * of the same sell-form URL via sessionStorage.
 */
export function usePhoneUploadSession({
  onPhotos,
  remainingSlots,
}: UsePhoneUploadSessionOptions): UsePhoneUploadSessionReturn {
  const [session, setSession] = useState<PhoneUploadSessionSnapshot | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receivedCount, setReceivedCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Ids already handed to the caller. Deliberately not persisted: after a
  // reload every photo is reported again and the caller filters against what
  // it still holds, which is the only source of truth for "already added".
  const seenIdsRef = useRef<Set<string>>(new Set());
  const onPhotosRef = useRef(onPhotos);
  useEffect(() => {
    onPhotosRef.current = onPhotos;
  }, [onPhotos]);

  // Restore a session left by a reload.
  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      setSession(stored);
    }
  }, []);

  const isExpired = session !== null && now >= session.expiresAt;
  const secondsLeft = session ? Math.max(0, Math.ceil((session.expiresAt - now) / 1000)) : 0;

  const stop = useCallback(() => {
    setSession(null);
    writeStoredSession(null);
  }, []);

  const start = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/upload/phone-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPhotos: remainingSlots }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Couldn't create a QR code. Please try again.");
      }

      const created = (await response.json()) as PhoneUploadSessionCreated;
      const next: PhoneUploadSessionSnapshot = {
        sessionId: created.sessionId,
        url: buildPhoneUploadUrl(window.location.origin, created.token),
        expiresAt: created.expiresAt,
        maxPhotos: created.maxPhotos,
      };

      seenIdsRef.current = new Set();
      setReceivedCount(0);
      setNow(Date.now());
      setSession(next);
      writeStoredSession(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create a QR code.");
    } finally {
      setIsStarting(false);
    }
  }, [remainingSlots]);

  // Tick once a second for the countdown while a session is live.
  useEffect(() => {
    if (!session || isExpired) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [session, isExpired]);

  // Poll for photos while the session is live.
  useEffect(() => {
    if (!session || isExpired) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(`/api/upload/phone-session/${session.sessionId}`, {
          cache: "no-store",
        });

        if (cancelled) return;

        if (!response.ok) {
          // Signed out, or a session that isn't ours: nothing more will arrive.
          if (response.status === 401 || response.status === 400) stop();
          return;
        }

        const { photos } = (await response.json()) as { photos: PhoneUploadPhoto[] };
        if (cancelled) return;

        const fresh = photos.filter((photo) => !seenIdsRef.current.has(photo.id));
        if (fresh.length === 0) return;

        for (const photo of fresh) seenIdsRef.current.add(photo.id);
        setReceivedCount(seenIdsRef.current.size);
        onPhotosRef.current(fresh.map((photo) => photo.url));
      } catch {
        // Transient network error; the next tick retries.
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), PHONE_UPLOAD_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [session, isExpired, stop]);

  return {
    session,
    isExpired,
    secondsLeft,
    receivedCount,
    isStarting,
    error,
    start,
    stop,
  };
}
