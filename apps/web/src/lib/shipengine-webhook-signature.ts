import crypto from "node:crypto";

/**
 * ShipEngine webhook signature verification.
 *
 * ShipEngine signs outgoing webhooks with RSA-SHA256 against a rotating key
 * published as a JWKS — there is no shared secret. The previous
 * implementation computed an HMAC-SHA256 of the body against
 * SHIPENGINE_WEBHOOK_SECRET and compared it to an `x-shipengine-signature`
 * header. ShipEngine sends no such header and no such secret exists, so every
 * genuine webhook would have been rejected with a 401.
 *
 * Contract (https://docs.shipstation.com/apis/shipengine/docs/guides/webhooks):
 *   x-shipengine-rsa-sha256-key-id      which JWKS key signed this
 *   x-shipengine-rsa-sha256-signature   base64 RSA-SHA256 signature
 *   x-shipengine-timestamp              when it was signed
 *
 * The signed payload is `${timestamp}.${rawBody}` — the raw body exactly as
 * received. Re-serialising parsed JSON changes whitespace and key order and
 * will not verify.
 */

export const SHIPENGINE_JWKS_URL = "https://api.shipengine.com/jwks";

export const SHIPENGINE_SIGNATURE_HEADERS = {
  keyId: "x-shipengine-rsa-sha256-key-id",
  signature: "x-shipengine-rsa-sha256-signature",
  timestamp: "x-shipengine-timestamp",
} as const;

/** Reject anything signed longer ago than this, to bound replay. */
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

/** How long a fetched key stays usable before we re-fetch. */
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;

export type VerificationFailure =
  | "MISSING_HEADERS"
  | "STALE_TIMESTAMP"
  | "UNKNOWN_KEY"
  | "JWKS_UNAVAILABLE"
  | "BAD_SIGNATURE";

// String discriminant: apps/web compiles with `strict: false`, where
// boolean-literal discriminants don't narrow.
export type VerificationResult =
  | { status: "verified" }
  | { status: "rejected"; reason: VerificationFailure };

interface Jwk {
  kid?: string;
  kty?: string;
  use?: string;
  alg?: string;
  [key: string]: unknown;
}

const keyCache = new Map<string, { key: crypto.KeyObject; expiresAt: number }>();

/** Injectable so tests can supply their own key set. */
export type JwksFetcher = () => Promise<{ keys: Jwk[] }>;

const defaultFetcher: JwksFetcher = async () => {
  const res = await fetch(SHIPENGINE_JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: HTTP ${res.status}`);
  return (await res.json()) as { keys: Jwk[] };
};

/**
 * Resolve a signing key by id, re-fetching on a cache miss so a rotated key
 * is picked up without a redeploy.
 */
async function getSigningKey(
  keyId: string,
  fetcher: JwksFetcher
): Promise<crypto.KeyObject | null> {
  const cached = keyCache.get(keyId);
  if (cached && cached.expiresAt > Date.now()) return cached.key;

  const jwks = await fetcher();
  const jwk = jwks.keys?.find((k) => k.kid === keyId);
  if (!jwk) return null;

  // Node imports a JWK directly; no need to hand-assemble the SPKI.
  const key = crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: "jwk" });
  keyCache.set(keyId, { key, expiresAt: Date.now() + JWKS_CACHE_TTL_MS });
  return key;
}

/** Test seam — the key cache is module-level and would leak between cases. */
export function __clearJwksCacheForTests(): void {
  keyCache.clear();
}

/**
 * Verify a ShipEngine webhook.
 *
 * `rawBody` must be the exact bytes received. Fails closed on every error
 * path: this webhook drives shipment state, which gates escrow release.
 */
export async function verifyShipEngineWebhook(
  rawBody: string,
  headers: {
    keyId: string | null;
    signature: string | null;
    timestamp: string | null;
  },
  options: { fetcher?: JwksFetcher; now?: number; maxAgeMs?: number } = {}
): Promise<VerificationResult> {
  const { keyId, signature, timestamp } = headers;
  if (!keyId || !signature || !timestamp) return { status: "rejected", reason: "MISSING_HEADERS" };

  const signedAt = Date.parse(timestamp);
  const now = options.now ?? Date.now();
  const maxAge = options.maxAgeMs ?? MAX_SIGNATURE_AGE_MS;
  // Guard both directions: a far-future timestamp is as suspect as a stale one.
  if (!Number.isFinite(signedAt) || Math.abs(now - signedAt) > maxAge) {
    return { status: "rejected", reason: "STALE_TIMESTAMP" };
  }

  let key: crypto.KeyObject | null;
  try {
    key = await getSigningKey(keyId, options.fetcher ?? defaultFetcher);
  } catch (error) {
    console.error("[shipengine] Could not fetch JWKS", error);
    return { status: "rejected", reason: "JWKS_UNAVAILABLE" };
  }
  if (!key) return { status: "rejected", reason: "UNKNOWN_KEY" };

  const signedPayload = Buffer.from(`${timestamp}.${rawBody}`, "utf8");

  // The docs specify base64; accept base64url too rather than reject a valid
  // signature over an encoding detail.
  for (const encoding of ["base64", "base64url"] as const) {
    try {
      if (crypto.verify("sha256", signedPayload, key, Buffer.from(signature, encoding))) {
        return { status: "verified" };
      }
    } catch {
      // Malformed for this encoding — try the next.
    }
  }

  return { status: "rejected", reason: "BAD_SIGNATURE" };
}
