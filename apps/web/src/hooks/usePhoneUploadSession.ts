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
   * slot and offered again on the next poll. Called at most once per poll.
   */
  onPhotos: (urls: string[]) => string[];
  /** Slots the form has free. Baked into the token as the phone's allowance. */
  remainingSlots: number;
  /**
   * Identity of the seller and form record this session belongs to. When
   * given, the session, the ids of photos already placed and any replaced
   * sessions still being drained are kept in sessionStorage under it and
   * restored after a reload of the same record. Pass the form's own draft key
   * prefixed with the Clerk user id, and clear it with
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
  /** Photos the phone has sent to this form, placed or waiting, across codes. */
  receivedCount: number;
  /** Photos the phone has sent that the form had no room for yet, across codes. */
  pendingCount: number;
  /**
   * Whether `start` may safely mint a new code right now. False while photos
   * are still waiting for a slot, or while an expired session hasn't yet been
   * checked for late arrivals.
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
 * phone sent are readable by the desktop for as long as the server returns
 * them, which it stops doing an hour before the two-day sweep touches them.
 */
const RESTORE_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * How long after expiry the desktop keeps polling regardless of what it has
 * seen. An upload the phone started just before the token expired can finish
 * after it, and the desktop must still collect it.
 */
const POST_EXPIRY_DRAIN_MS = 60 * 1000;

/** A session replaced by `start()` that may still have photos to collect. */
interface DrainingSession {
  sessionId: string;
  /** Earliest moment it may be closed, if nothing is still waiting for a slot. */
  until: number;
}

interface StoredPhoneUploadSession extends PhoneUploadSessionSnapshot {
  /** Photos already placed in the form, so a restore never re-adds one the seller removed. */
  placedIds: string[];
  /** Replaced sessions still being drained, so a reload doesn't strand their late photos. */
  draining: DrainingSession[];
}

/** What a mounted hook currently holds for a scope, independent of storage. */
interface LiveScopeState {
  /** The active code and any replaced codes still draining. */
  sessionIds: Set<string>;
  /** Photos already placed, so a terminal collection never re-adds a removed one. */
  placedIds: Set<string>;
}

/**
 * Every session a mounted hook is currently responsible for, by scope. The
 * terminal helpers consult this as well as storage, so publish still closes
 * and drains the session even when sessionStorage is blocked and the snapshot
 * was never written.
 */
const liveStateByScope = new Map<string, LiveScopeState>();

/** Session ids and placed ids for a scope, from the mounted hook and storage combined. */
function knownStateForScope(scope: string): {
  sessionIds: string[];
  placedIds: Set<string>;
  stored: StoredPhoneUploadSession | null;
} {
  const live = liveStateByScope.get(scope);
  const stored = readStoredSession(scope);
  const sessionIds = new Set<string>(live?.sessionIds ?? []);
  const placedIds = new Set<string>(live?.placedIds ?? []);
  if (stored) {
    sessionIds.add(stored.sessionId);
    for (const entry of stored.draining) sessionIds.add(entry.sessionId);
    for (const id of stored.placedIds) placedIds.add(id);
  }
  return { sessionIds: Array.from(sessionIds), placedIds, stored };
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
    const draining = Array.isArray(parsed.draining)
      ? parsed.draining.filter(
          (entry): entry is DrainingSession =>
            typeof entry === "object" &&
            entry !== null &&
            typeof entry.sessionId === "string" &&
            typeof entry.until === "number"
        )
      : [];
    return {
      sessionId: parsed.sessionId,
      url: parsed.url,
      expiresAt: parsed.expiresAt,
      maxPhotos: parsed.maxPhotos,
      placedIds,
      draining,
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
    // Storage blocked: the session still works for the life of this page, and
    // the live registry still lets the form close it.
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
 * Forgets everything stored for a form record and closes every session it
 * covers on the server: the current code, any replaced codes still draining,
 * and whatever a mounted hook holds even if storage was blocked. Call it
 * wherever the form discards that record's draft (publish, save, "start
 * fresh").
 */
export function clearStoredPhoneUploadSession(scope: string): void {
  for (const id of knownStateForScope(scope).sessionIds) closeSessionOnServer(id);
  writeStoredSession(scope, null);
  liveStateByScope.delete(scope);
}

/** Outcome of fetching one session's photo list. */
type FetchOutcome =
  | { kind: "ok"; photos: PhoneUploadPhoto[] }
  | { kind: "gone" }
  | { kind: "error" };

async function fetchSessionPhotos(sessionId: string): Promise<FetchOutcome> {
  try {
    const response = await fetch(`/api/upload/phone-session/${sessionId}`, { cache: "no-store" });
    if (!response.ok) {
      // Signed out, not ours, or closed: nothing more will arrive.
      return [400, 401, 410].includes(response.status) ? { kind: "gone" } : { kind: "error" };
    }
    const { photos } = (await response.json()) as { photos: PhoneUploadPhoto[] };
    return { kind: "ok", photos };
  } catch {
    return { kind: "error" };
  }
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
  // Mirrors drainingRef so polling decisions re-run when it changes.
  const [drainingCount, setDrainingCount] = useState(0);
  // True once a poll has run after the token expired, so a photo that landed
  // between the last live poll and expiry is fetched rather than stranded.
  const [expiredPollDone, setExpiredPollDone] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Ids of photos the form has taken, across every code this form has used.
  // Never reset while the form lives: a photo placed from an earlier code and
  // then removed by the seller must not be offered again by a later drain.
  const placedIdsRef = useRef<Set<string>>(new Set());
  // The session id polls may still act on. Set synchronously whenever the
  // session changes, so a poll that was in flight for the old session drops
  // its result even if it resolves before React has torn the effect down.
  const activeSessionIdRef = useRef<string | null>(null);
  // Sessions replaced by `start()` that may still have photos to collect: an
  // upload in flight at expiry, or photos that were waiting for a slot. A
  // regenerated code belongs to the same form, so those photos belong here.
  const drainingRef = useRef<DrainingSession[]>([]);
  // `isStarting` is React state and lands on the next render; two presses in
  // the same tick would otherwise mint two codes, one of which nothing closes.
  const startInFlightRef = useRef(false);
  const onPhotosRef = useRef(onPhotos);
  useEffect(() => {
    onPhotosRef.current = onPhotos;
  }, [onPhotos]);

  const registerLive = useCallback(
    (active: string | null) => {
      if (!storageScope) return;
      const sessionIds = new Set(drainingRef.current.map((entry) => entry.sessionId));
      if (active) sessionIds.add(active);
      liveStateByScope.set(storageScope, {
        sessionIds,
        placedIds: new Set(placedIdsRef.current),
      });
    },
    [storageScope]
  );

  const persist = useCallback(
    (current: PhoneUploadSessionSnapshot | null) => {
      registerLive(current?.sessionId ?? null);
      if (!storageScope) return;
      writeStoredSession(
        storageScope,
        current
          ? {
              ...current,
              placedIds: Array.from(placedIdsRef.current),
              draining: drainingRef.current,
            }
          : null
      );
    },
    [storageScope, registerLive]
  );

  const setDraining = useCallback((next: DrainingSession[]) => {
    drainingRef.current = next;
    setDrainingCount(next.length);
  }, []);

  // On a scope change, finish with whatever the previous scope was doing
  // before restoring the new one: close its sessions on the server (the form
  // stays mounted across a Clerk sign-out, and an unpolled session would
  // otherwise keep accepting uploads) and drop them locally. Then restore a
  // session left by a reload of the same record, expired or not: an expired
  // one may still have photos waiting to be placed.
  const previousScopeRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const previousScope = previousScopeRef.current;
    const scopeChanged = previousScope !== undefined && previousScope !== storageScope;
    previousScopeRef.current = storageScope;

    if (scopeChanged) {
      const toClose = new Set(drainingRef.current.map((entry) => entry.sessionId));
      if (activeSessionIdRef.current) toClose.add(activeSessionIdRef.current);
      for (const id of toClose) closeSessionOnServer(id);
      if (previousScope) liveStateByScope.delete(previousScope);

      activeSessionIdRef.current = null;
      setDraining([]);
      placedIdsRef.current = new Set();
      setSession(null);
      setReceivedCount(0);
      setPendingCount(0);
      setError(null);
    }

    if (!storageScope) return;
    const stored = readStoredSession(storageScope);
    if (stored) {
      const { placedIds, draining, ...snapshot } = stored;
      activeSessionIdRef.current = snapshot.sessionId;
      placedIdsRef.current = new Set(placedIds);
      setDraining(draining);
      setReceivedCount(placedIds.length);
      setExpiredPollDone(false);
      setSession(snapshot);
      registerLive(snapshot.sessionId);
    }
  }, [storageScope, setDraining, registerLive]);

  // The registry entry belongs to a mounted hook; storage keeps the snapshot.
  useEffect(() => {
    return () => {
      if (storageScope) liveStateByScope.delete(storageScope);
    };
  }, [storageScope]);

  const isExpired = session !== null && now >= session.expiresAt;
  const secondsLeft = session ? Math.max(0, Math.ceil((session.expiresAt - now) / 1000)) : 0;
  const inDrainWindow = session !== null && now < session.expiresAt + POST_EXPIRY_DRAIN_MS;

  // Photos still waiting, from this code or a replaced one, must not be
  // orphaned by minting a new code.
  const canStart =
    session === null || pendingCount === 0 ? (isExpired ? expiredPollDone : true) : false;

  const stop = useCallback(() => {
    activeSessionIdRef.current = null;
    setSession(null);
    setPendingCount(0);
    persist(null);
  }, [persist]);

  const start = useCallback(async () => {
    if (startInFlightRef.current) return;
    if (pendingCount > 0) {
      setError(
        pendingCount === 1
          ? "A photo from your phone is still waiting for a free slot. Remove a photo to add it before generating a new code."
          : `${pendingCount} photos from your phone are still waiting for a free slot. Remove a photo to add them before generating a new code.`
      );
      return;
    }

    startInFlightRef.current = true;
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

      // The code being replaced is finished with. If an upload could still be
      // in flight under it (its drain window hasn't closed), keep collecting
      // from it until then; otherwise close it now so a phone still on its
      // page is refused rather than uploading photos nobody collects.
      if (session) {
        const drainUntil = session.expiresAt + POST_EXPIRY_DRAIN_MS;
        if (Date.now() < drainUntil) {
          setDraining([
            ...drainingRef.current,
            { sessionId: session.sessionId, until: drainUntil },
          ]);
        } else {
          closeSessionOnServer(session.sessionId);
        }
      }

      activeSessionIdRef.current = next.sessionId;
      setPendingCount(0);
      setExpiredPollDone(false);
      setNow(Date.now());
      setSession(next);
      persist(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create a QR code.");
    } finally {
      setIsStarting(false);
      startInFlightRef.current = false;
    }
  }, [pendingCount, remainingSlots, persist, session, setDraining]);

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
  // expiry, while a replaced code is still inside its own window, and
  // otherwise only while photos are waiting and there is room for them.
  const canDrainPending = pendingCount > 0 && remainingSlots > 0;
  const replacedStillOpen = drainingCount > 0 && drainingRef.current.some((e) => e.until > now);
  const shouldPoll =
    session !== null && (inDrainWindow || !expiredPollDone || canDrainPending || replacedStillOpen);

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
        // Gather every photo not yet placed, from the active code and any
        // replaced ones, then offer them to the form in ONE call: the form
        // measures its free slots once per call, so several calls in a row
        // could each fill the same last slot.
        const active = await fetchSessionPhotos(session.sessionId);
        if (cancelled || activeSessionIdRef.current !== session.sessionId) return;
        if (active.kind === "gone") {
          stop();
          return;
        }

        const replacedPhotos = new Map<string, PhoneUploadPhoto[]>();
        const goneReplaced = new Set<string>();
        for (const entry of drainingRef.current) {
          const outcome = await fetchSessionPhotos(entry.sessionId);
          if (cancelled || activeSessionIdRef.current !== session.sessionId) return;
          if (outcome.kind === "gone") goneReplaced.add(entry.sessionId);
          if (outcome.kind === "ok") replacedPhotos.set(entry.sessionId, outcome.photos);
        }

        const isWaiting = (photo: PhoneUploadPhoto) => !placedIdsRef.current.has(photo.id);
        const waiting: PhoneUploadPhoto[] = [
          ...(active.kind === "ok" ? active.photos.filter(isWaiting) : []),
          ...Array.from(replacedPhotos.values()).flatMap((photos) => photos.filter(isWaiting)),
        ];

        let placedAny = false;
        if (waiting.length > 0) {
          const placed = new Set(onPhotosRef.current(waiting.map((photo) => photo.url)));
          for (const photo of waiting) {
            if (placed.has(photo.url)) {
              placedIdsRef.current.add(photo.id);
              placedAny = true;
            }
          }
        }
        const stillWaiting = waiting.filter((photo) => !placedIdsRef.current.has(photo.id));
        const stillWaitingBySession = new Map<string, number>();
        for (const [sessionId, photos] of replacedPhotos) {
          stillWaitingBySession.set(
            sessionId,
            photos.filter((photo) => !placedIdsRef.current.has(photo.id)).length
          );
        }

        // A replaced code is closed once its window has passed and nothing it
        // sent is still waiting for a slot; one the server already reports
        // gone is simply dropped.
        const nowMs = Date.now();
        const keep: DrainingSession[] = [];
        let drainingChanged = false;
        for (const entry of drainingRef.current) {
          const gone = goneReplaced.has(entry.sessionId);
          const settled =
            entry.until <= nowMs && (stillWaitingBySession.get(entry.sessionId) ?? 0) === 0;
          if (gone || settled) {
            if (!gone) closeSessionOnServer(entry.sessionId);
            drainingChanged = true;
          } else {
            keep.push(entry);
          }
        }
        if (drainingChanged) setDraining(keep);

        if (placedAny || drainingChanged) persist(session);
        setReceivedCount(placedIdsRef.current.size + stillWaiting.length);
        setPendingCount(stillWaiting.length);

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
  }, [session, shouldPoll, stop, persist, setDraining]);

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

/**
 * Photos the phone has finished sending that the form doesn't hold yet, for
 * the form's terminal actions. Publish and save build their payloads from
 * form state, and a photo can be complete on the server while still waiting
 * for the next two-second poll; without this it would be missing from the
 * listing and destroyed by the sweep. Looks at the current code and any
 * replaced ones still draining, from storage and from the mounted hook (so a
 * blocked sessionStorage doesn't skip it). Returns at most `room` URLs,
 * skipping anything already placed (including photos the seller placed and
 * removed). Never throws: on any failure the caller proceeds with what it has.
 */
export async function collectLatePhoneUploads(
  scope: string,
  heldUrls: readonly string[],
  room: number
): Promise<string[]> {
  if (room <= 0) return [];
  const { sessionIds, placedIds, stored } = knownStateForScope(scope);
  if (sessionIds.length === 0) return [];

  const held = new Set(heldUrls);
  const late: PhoneUploadPhoto[] = [];

  for (const sessionId of sessionIds) {
    if (late.length >= room) break;
    const outcome = await fetchSessionPhotos(sessionId);
    if (outcome.kind !== "ok") continue;
    for (const photo of outcome.photos) {
      if (late.length >= room) break;
      if (placedIds.has(photo.id) || held.has(photo.url)) continue;
      if (late.some((existing) => existing.url === photo.url)) continue;
      late.push(photo);
    }
  }

  // Record them as placed everywhere a later restore or collection looks, so
  // none is offered twice.
  if (late.length > 0) {
    const lateIds = late.map((photo) => photo.id);
    const live = liveStateByScope.get(scope);
    if (live) for (const id of lateIds) live.placedIds.add(id);
    if (stored) {
      writeStoredSession(scope, { ...stored, placedIds: [...stored.placedIds, ...lateIds] });
    }
  }
  return late.map((photo) => photo.url);
}

/**
 * Closes every session a form record is responsible for and waits for the
 * server to confirm, unlike {@link clearStoredPhoneUploadSession} which is
 * fire-and-forget for use during navigation. Publish and save call this
 * *before* their final collection, so the server is already refusing new
 * uploads (and failing in-flight completions with a 410 to the phone) when
 * the collection runs; nothing can complete in the gap between the read and
 * the write. Leaves storage in place, since the write may still fail and the
 * form stay open.
 */
export async function closePhoneUploadSessionsForScope(scope: string): Promise<void> {
  await Promise.all(
    knownStateForScope(scope).sessionIds.map((id) =>
      fetch(`/api/upload/phone-session/${id}`, { method: "DELETE" }).catch(() => undefined)
    )
  );
}
