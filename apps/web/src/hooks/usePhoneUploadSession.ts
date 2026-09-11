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

/**
 * Desktop side of the phone photo handoff. Mints a session, polls it while it
 * is live, and offers new photos to the caller.
 *
 * The session lives only in component state, on purpose: persisting it would
 * let a code minted for one listing keep feeding photos into whatever listing
 * the same tab opens next. Losing the link on a reload costs two clicks to
 * regenerate; crossing listings costs a seller's trust.
 */
export function usePhoneUploadSession({
  onPhotos,
  remainingSlots,
}: UsePhoneUploadSessionOptions): UsePhoneUploadSessionReturn {
  const [session, setSession] = useState<PhoneUploadSessionSnapshot | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receivedCount, setReceivedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Ids of photos the form has taken. Anything the server returns that isn't
  // in here is offered on every poll until the form accepts it.
  const placedIdsRef = useRef<Set<string>>(new Set());
  const onPhotosRef = useRef(onPhotos);
  useEffect(() => {
    onPhotosRef.current = onPhotos;
  }, [onPhotos]);

  const isExpired = session !== null && now >= session.expiresAt;
  const secondsLeft = session ? Math.max(0, Math.ceil((session.expiresAt - now) / 1000)) : 0;

  const stop = useCallback(() => {
    setSession(null);
    setPendingCount(0);
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

      placedIdsRef.current = new Set();
      setReceivedCount(0);
      setPendingCount(0);
      setNow(Date.now());
      setSession(next);
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
  }, [session, isExpired, stop]);

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
