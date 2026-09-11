import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { PHONE_UPLOAD_SESSION_MAX_PHOTOS, PHONE_UPLOAD_SESSION_TTL_MS } from "./phone-upload";

/**
 * Server side of the phone-to-desktop photo handoff: minting and verifying the
 * token the QR code carries. Browser-safe helpers live in `phone-upload.ts`.
 *
 * The token is a narrow capability, not a login: it authorises uploading a
 * bounded number of photos into one session for a few minutes. It is signed
 * with the same secret as mobile session tokens but carries a distinct `type`,
 * so `verifyMobileSessionToken` rejects it and it cannot be replayed against
 * any other Bearer-authenticated route.
 */

const TOKEN_TYPE = "phone_upload_session";

export interface PhoneUploadSession {
  /** Random id shared by the token and every upload row it produces. */
  sessionId: string;
  /** Clerk user id of the seller who minted the session. */
  clerkId: string;
  /** Uploads accepted for this session before the phone is told to stop. */
  maxPhotos: number;
  /** Epoch milliseconds after which the token is rejected. */
  expiresAt: number;
}

function getSecret(): Uint8Array {
  const value = process.env.MOBILE_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "MOBILE_SESSION_SECRET must be set to a random string of at least 32 characters"
    );
  }
  return new TextEncoder().encode(value);
}

/** Clamps a requested photo allowance into the range a token may carry. */
export function clampPhoneUploadMax(requested: unknown): number {
  const asNumber = typeof requested === "number" ? Math.floor(requested) : NaN;
  if (!Number.isFinite(asNumber)) return PHONE_UPLOAD_SESSION_MAX_PHOTOS;
  return Math.max(1, Math.min(PHONE_UPLOAD_SESSION_MAX_PHOTOS, asNumber));
}

/** Mints a session token for `clerkId` allowing up to `maxPhotos` uploads. */
export async function createPhoneUploadSessionToken(
  clerkId: string,
  maxPhotos: number
): Promise<{ token: string; session: PhoneUploadSession }> {
  const sessionId = crypto.randomUUID();
  const cappedMax = clampPhoneUploadMax(maxPhotos);
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = issuedAtSeconds + Math.floor(PHONE_UPLOAD_SESSION_TTL_MS / 1000);

  const token = await new SignJWT({ type: TOKEN_TYPE, max: cappedMax } as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(clerkId)
    .setJti(sessionId)
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(expiresAtSeconds)
    .sign(getSecret());

  return {
    token,
    session: {
      sessionId,
      clerkId,
      maxPhotos: cappedMax,
      expiresAt: expiresAtSeconds * 1000,
    },
  };
}

/**
 * Verifies a session token. Returns null for anything that isn't a valid,
 * unexpired phone-upload token, including mobile session tokens.
 */
export async function verifyPhoneUploadSessionToken(
  token: string
): Promise<PhoneUploadSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());

    if (payload.type !== TOKEN_TYPE || !payload.sub || !payload.jti || !payload.exp) {
      return null;
    }

    const max = typeof payload.max === "number" ? payload.max : NaN;
    if (!Number.isInteger(max) || max < 1 || max > PHONE_UPLOAD_SESSION_MAX_PHOTOS) {
      return null;
    }

    return {
      sessionId: payload.jti,
      clerkId: payload.sub,
      maxPhotos: max,
      expiresAt: payload.exp * 1000,
    };
  } catch {
    return null;
  }
}

/** Extracts a Bearer credential from a request's Authorization header, if any. */
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}
