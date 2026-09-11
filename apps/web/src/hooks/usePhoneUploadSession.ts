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
   * Offered the URLs of photos the phone has sent that are not yet in the
   * form. Must return the subset that *is* now in the form (placed by this
   * call or already there). Anything else is treated as waiting for a free
   * slot and offered again on the next poll.
   */
  onPhotos: (urls: string[]) => string[];
  /** Slots the form has free. Baked into the token as the phone's allowance. */
  remainingSlots: number;
  /**
   * Identity of the form record this session belongs to. When given, a live
   * session is kept in sessionStorage under it and restored after a reload of
   * the same record. Pass the same key the form uses for its own draft and
   * clear it with {@link clearStoredPhoneUploadSession} wherever the form
   * clears that draft, so a code minted for one listing can never be restored
   * into another. Without it the session lives in component state only.
   */
  storageScope?: string;
}

export interface UsePhoneUploadSessionReturn {
  session: PhoneUploadSessionSnapshot | null;
  /** True once the session's token can no longer be used. */
  isExpired: boolean;
  /** Whole seconds until expiry; 0 when expired or when there is no session. */
  secondsLeft: number;
  /** Photos the phone has sent in this session, placed or waiting. */
  receivedCount: number;
  /** Photos the phone has sent that the form had no room for yet. */
  pendingCount: number;
  isStarting: boolean;
  error: string | null;
  /** Mints a fresh session, replacing any existing one. */
  start: () => Promise<void>;
  /** Forgets the session and stops polling. */
  stop: () => void;
}

const STORAGE_PREFIX = "buttergolf-phone-upload-session";

function storageKeyFor(scope: string): string {
  return `${STORAGE_PREFIX}:${scope}`;
}

function readStoredSession(scope: string): PhoneUploadSessionSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(storageKeyFor(scope));
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

function writeStoredSession(scope: string, session: PhoneUploadSessionSnapshot | null): void {
  try {
    if (session) {
      window.sessionStorage.setItem(storageKeyFor(scope), JSON.stringify(session));
    } else {
      window.sessionStorage.removeItem(storageKeyFor(scope));
    }
  } catch {
    // Storage blocked: the session still works for the life of this page.
  }
}

/**
 * Forgets any stored session for a form record. Call it wherever the form
 * discards that record's draft (publish, save, "start fresh").
 */
export function clearStoredPhoneUploadSession(scope: string): void {
  writeStoredSession(scope, null);
}

/**
 * Desktop side of the phone photo handoff. Mints a session, polls it while it
 * is live, and offers new photos to the caller.
 */
export function usePhoneUploadSession({
  onPhotos,
  remainingSlots,
  storageScope,
}: UsePhoneUploadSessionOptions): UsePhoneUploadSessionReturn {
  const [session, setSession] = useState<PhoneUploadSessionSnapshot | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receivedCount, setReceivedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Ids of photos the form has taken. Anything the server returns that isn't
  // in here is offered on every poll until the form accepts it. Not persisted:
  // after a restore every photo is offered again and the form keeps the ones
  // it doesn't already hold, which is the only source of truth for "placed".
  const placedIdsRef = useRef<Set<string>>(new Set());
  const onPhotosRef = useRef(onPhotos);
  useEffect(() => {
    onPhotosRef.current = onPhotos;
  }, [onPhotos]);

  // Restore a session left by a reload of the same record.
  useEffect(() => {
    if (!storageScope) return;
    const stored = readStoredSession(storageScope);
    if (stored) {
      setSession(stored);
    }
  }, [storageScope]);

  const isExpired = session !== null && now >= session.expiresAt;
  const secondsLeft = session ? Math.max(0, Math.ceil((session.expiresAt - now) / 1000)) : 0;

  const stop = useCallback(() => {
    setSession(null);
    setPendingCount(0);
    if (storageScope) writeStoredSession(storageScope, null);
  }, [storageScope]);

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

      placedIdsRef.current = new Set();
      setReceivedCount(0);
      setPendingCount(0);
      setNow(Date.now());
      setSession(next);
      if (storageScope) writeStoredSession(storageScope, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create a QR code.");
    } finally {
      setIsStarting(false);
    }
  }, [remainingSlots, storageScope]);

  // Tick once a second for the countdown while a session is live.
  useEffect(() => {
    if (!session || isExpired) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [session, isExpired]);

  // Poll while the session is live. Once the code has expired the desktop
  // endpoint is still readable (it only needs the Clerk session), so keep going
  // for as long as photos are waiting and there is room to place them: a photo
  // the phone sent while the grid was full must not be stranded just because
  // the seller made room after the fifteen minutes were up.
  const canDrainPending = pendingCount > 0 && remainingSlots > 0;
  const shouldPoll = session !== null && (!isExpired || canDrainPending);

  useEffect(() => {
    if (!session || !shouldPoll) return;

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

        // Everything not yet placed, including photos offered before and
        // turned away for lack of room: a slot may have freed up since.
        const waiting = photos.filter((photo) => !placedIdsRef.current.has(photo.id));
        if (waiting.length === 0) {
          setPendingCount(0);
          return;
        }

        const placed = new Set(onPhotosRef.current(waiting.map((photo) => photo.url)));
        let stillWaiting = 0;
        for (const photo of waiting) {
          if (placed.has(photo.url)) {
            placedIdsRef.current.add(photo.id);
          } else {
            stillWaiting += 1;
          }
        }

        setReceivedCount(placedIdsRef.current.size + stillWaiting);
        setPendingCount(stillWaiting);
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
  }, [session, shouldPoll, stop]);

  return {
    session,
    isExpired,
    secondsLeft,
    receivedCount,
    pendingCount,
    isStarting,
    error,
    start,
    stop,
  };
}
