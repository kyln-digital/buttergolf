/**
 * Phone-to-desktop photo handoff: the parts safe to import from the browser.
 *
 * The sell form on a desktop mints a short-lived token (see
 * `phone-upload-session.ts`, server only), encodes it in a QR code, and the
 * seller scans it with their phone. The phone page posts photos to
 * `/api/upload` with the token as a Bearer credential; each upload is recorded
 * against the session id inside it, and the desktop polls for new rows.
 */

/** How long a QR code stays scannable and its uploads accepted. */
export const PHONE_UPLOAD_SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * Hard ceiling on photos per session, whatever the desktop asked for. Bounds
 * the Cloudinary spend a leaked QR code could cause.
 */
export const PHONE_UPLOAD_SESSION_MAX_PHOTOS = 10;

/** Path of the page the QR code opens. Outside `/sell` so Clerk doesn't gate it. */
export const PHONE_UPLOAD_PAGE_PATH = "/upload-from-phone";

/** How often the desktop asks for new photos while a session is live. */
export const PHONE_UPLOAD_POLL_INTERVAL_MS = 2000;

/** What `POST /api/upload/phone-session` hands the desktop. */
export interface PhoneUploadSessionCreated {
  sessionId: string;
  /** The Bearer credential the phone uses. Only ever shown inside the QR code. */
  token: string;
  /** Epoch milliseconds after which the token is rejected. */
  expiresAt: number;
  maxPhotos: number;
}

/** One photo the phone has sent, as returned by the polling and status routes. */
export interface PhoneUploadPhoto {
  id: string;
  url: string;
}

/** What `GET /api/upload/phone-session` (Bearer) tells the phone about its session. */
export interface PhoneUploadSessionStatus {
  sessionId: string;
  maxPhotos: number;
  expiresAt: number;
  photos: PhoneUploadPhoto[];
}

/**
 * Builds the URL the QR code encodes. The token rides in the fragment, which
 * browsers never send to the server, so it stays out of request logs.
 */
export function buildPhoneUploadUrl(origin: string, token: string): string {
  return `${origin}${PHONE_UPLOAD_PAGE_PATH}#t=${encodeURIComponent(token)}`;
}

/** Reads the token back out of a URL fragment as produced by {@link buildPhoneUploadUrl}. */
export function readPhoneUploadTokenFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const token = params.get("t");
  return token && token.length > 0 ? token : null;
}
