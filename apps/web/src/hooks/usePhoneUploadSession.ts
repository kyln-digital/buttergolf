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
   * Identity of the form record this session belongs to. When given, the
   * session and the ids of photos already placed are kept in sessionStorage
   * under it and restored after a reload of the same record. Pass the same key
   * the form uses for its own draft and clear it with
   * {@link clearStoredPhoneUploadSession} wherever the form clears that draft,
   * so a code minted for one listing can never be restored into another.
   * Without it the session lives in component state only.
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
  /**
   * Whether `start` may safely mint a new code right now. False while photos
   * from the current session are still waiting for a slot, or while an
   * expired session hasn't yet been checked for late arrivals.
   */
  canStart: boolean;
  isStarting: boolean;
  error: string | null;
  /** Mints a fresh session, replacing any existing one. Refuses while `canStart` is false. */
  start: () => Promise<void>;
  /** Forgets the session and stops polling. */
  stop: () => void;
}

const STORAGE_PREFIX = "buttergolf-phone-upload-session";

/**
 * How long after its token expires a session is still restored. Photos the
 * phone sent are readable by the desktop for as long as their rows exist,
 * and the server sweeps rows a day old.
 */
const RESTORE_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * How long after expiry the desktop keeps polling regardless of what it has
 * seen. An upload the phone started just before the token expired can finish
 * after it, and the desktop must still collect it.
 */
const POST_EXPIRY_DRAIN_MS = 60 * 1000;

interface StoredPhoneUploadSession extends PhoneUploadSessionSnapshot {
  /** Photos already placed in the form, so a restore never re-adds one the seller removed. */
  placedIds: string[];
}

function storageKeyFor(scope: string): string {
  return `${STORAGE_PREFIX}:${scope}`;
}

function readStoredSession(scope: string): StoredPhoneUploadSession | null {
  try {
    const raw = window.sessionStorage.getItem(storageKeyFor(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPhoneUploadSession>;
    if (
      typeof parsed.sessionId !== "string" ||
      typeof parsed.url !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.maxPhotos !== "number"
    ) {
      return null;
    }
    if (parsed.expiresAt + RESTORE_GRACE_MS <= Date.now()) return null;
    const placedIds = Array.isArray(parsed.placedIds)
      ? parsed.placedIds.filter((id): id is string => typeof id === "string")
      : [];
    return {
      sessionId: parsed.sessionId,
      url: parsed.url,
      expiresAt: parsed.expiresAt,
      maxPhotos: parsed.maxPhotos,
      placedIds,
    };
  } catch {
    return null;
  }
}

function writeStoredSession(scope: string, stored: StoredPhoneUploadSession | null): void {
  try {
    if (stored) {
      window.sessionStorage.setItem(storageKeyFor(scope), JSON.stringify(stored));
    } else {
      window.sessionStorage.removeItem(storageKeyFor(scope));
    }
  } catch {
    // Storage blocked: the session still works for the life of this page.
  }
}

/**
 * Tells the server the desktop has finished with a session, so a phone still
 * on the page is refused rather than left uploading photos nobody collects.
 * `keepalive` lets the request outlive a navigation away from the form.
 */
function closeSessionOnServer(sessionId: string): void {
  try {
    void fetch(`/api/upload/phone-session/${sessionId}`, {
      method: "DELETE",
      keepalive: true,
    }).catch(() => {
      // Best effort: an unclosed session still expires on its own.
    });
  } catch {
    // fetch itself can throw when called during unload in some browsers.
  }
}

/**
 * Forgets any stored session for a form record and closes it on the server.
 * Call it wherever the form discards that record's draft (publish, save,
 * "start fresh").
 */
export function clearStoredPhoneUploadSession(scope: string): void {
  const stored = readStoredSession(scope);
  if (stored) closeSessionOnServer(stored.sessionId);
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
  // True once a poll has run after the token expired, so a photo that landed
  // between the last live poll and expiry is fetched rather than stranded.
  const [expiredPollDone, setExpiredPollDone] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Ids of photos the form has taken. Anything the server returns that isn't
  // in here is offered on every poll until the form accepts it. Persisted with
  // the session so a restore doesn't re-offer a photo the seller had removed.
  const placedIdsRef = useRef<Set<string>>(new Set());
  // The session id polls may still act on. Set synchronously whenever the
  // session changes, so a poll that was in flight for the old session drops
  // its result even if it resolves before React has torn the effect down.
  const activeSessionIdRef = useRef<string | null>(null);
  const onPhotosRef = useRef(onPhotos);
  useEffect(() => {
    onPhotosRef.current = onPhotos;
  }, [onPhotos]);

  const persist = useCallback(
    (current: PhoneUploadSessionSnapshot | null) => {
      if (!storageScope) return;
      writeStoredSession(
        storageScope,
        current ? { ...current, placedIds: Array.from(placedIdsRef.current) } : null
      );
    },
    [storageScope]
  );

  // Restore a session left by a reload of the same record, expired or not:
  // an expired one may still have photos waiting to be placed.
  useEffect(() => {
    if (!storageScope) return;
    const stored = readStoredSession(storageScope);
    if (stored) {
      const { placedIds, ...snapshot } = stored;
      activeSessionIdRef.current = snapshot.sessionId;
      placedIdsRef.current = new Set(placedIds);
      setReceivedCount(placedIds.length);
      setExpiredPollDone(false);
      setSession(snapshot);
    }
  }, [storageScope]);

  const isExpired = session !== null && now >= session.expiresAt;
  const secondsLeft = session ? Math.max(0, Math.ceil((session.expiresAt - now) / 1000)) : 0;
  const inDrainWindow = session !== null && now < session.expiresAt + POST_EXPIRY_DRAIN_MS;

  // Photos still waiting must not be orphaned by minting a new code: a new
  // session polls a different id, and the old rows would never be offered.
  const canStart =
    session === null || pendingCount === 0 ? (isExpired ? expiredPollDone : true) : false;

  const stop = useCallback(() => {
    activeSessionIdRef.current = null;
    setSession(null);
    setPendingCount(0);
    persist(null);
  }, [persist]);

  const start = useCallback(async () => {
    if (pendingCount > 0) {
      setError(
        pendingCount === 1
          ? "A photo from your phone is still waiting for a free slot. Remove a photo to add it before generating a new code."
          : `${pendingCount} photos from your phone are still waiting for a free slot. Remove a photo to add them before generating a new code.`
      );
      return;
    }

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

      // The code being replaced is finished with: refuse anything a phone
      // still on its page tries to send, rather than collecting it nowhere.
      if (session) closeSessionOnServer(session.sessionId);

      activeSessionIdRef.current = next.sessionId;
      placedIdsRef.current = new Set();
      setReceivedCount(0);
      setPendingCount(0);
      setExpiredPollDone(false);
      setNow(Date.now());
      setSession(next);
      persist(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create a QR code.");
    } finally {
      setIsStarting(false);
    }
  }, [pendingCount, remainingSlots, persist, session]);

  // Tick once a second for the countdown while a session is live, and on
  // through the post-expiry drain window so it can end.
  useEffect(() => {
    if (!session || !inDrainWindow) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [session, inDrainWindow]);

  // Poll while the session is live. The desktop endpoint stays readable after
  // the token expires (it only needs the Clerk session), so keep polling
  // through the drain window to collect an upload that was in flight at
  // expiry, then only while photos are waiting and there is room for them.
  const canDrainPending = pendingCount > 0 && remainingSlots > 0;
  const shouldPoll = session !== null && (inDrainWindow || !expiredPollDone || canDrainPending);

  useEffect(() => {
    if (!session || !shouldPoll) return;

    let cancelled = false;
    // Never overlap polls: two in flight would both read the same free slots
    // and could each fill them.
    let inFlight = false;

    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      const afterExpiry = Date.now() >= session.expiresAt;

      try {
        const response = await fetch(`/api/upload/phone-session/${session.sessionId}`, {
          cache: "no-store",
        });

        if (cancelled || activeSessionIdRef.current !== session.sessionId) return;

        if (!response.ok) {
          // Signed out, not ours, or closed: nothing more will arrive.
          if ([400, 401, 410].includes(response.status)) stop();
          return;
        }

        const { photos } = (await response.json()) as { photos: PhoneUploadPhoto[] };
        if (cancelled || activeSessionIdRef.current !== session.sessionId) return;

        // Everything not yet placed, including photos offered before and
        // turned away for lack of room: a slot may have freed up since.
        const waiting = photos.filter((photo) => !placedIdsRef.current.has(photo.id));

        if (waiting.length > 0) {
          const placed = new Set(onPhotosRef.current(waiting.map((photo) => photo.url)));
          let stillWaiting = 0;
          let placedAny = false;
          for (const photo of waiting) {
            if (placed.has(photo.url)) {
              placedIdsRef.current.add(photo.id);
              placedAny = true;
            } else {
              stillWaiting += 1;
            }
          }
          if (placedAny) persist(session);
          setReceivedCount(placedIdsRef.current.size + stillWaiting);
          setPendingCount(stillWaiting);
        } else {
          setPendingCount(0);
        }

        if (afterExpiry) setExpiredPollDone(true);
      } catch {
        // Transient network error; the next tick retries.
      } finally {
        inFlight = false;
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), PHONE_UPLOAD_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [session, shouldPoll, stop, persist]);

  return {
    session,
    isExpired,
    secondsLeft,
    receivedCount,
    pendingCount,
    canStart,
    isStarting,
    error,
    start,
    stop,
  };
}
