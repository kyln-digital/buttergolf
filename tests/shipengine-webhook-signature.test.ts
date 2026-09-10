import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import {
  verifyShipEngineWebhook,
  __clearJwksCacheForTests,
  type JwksFetcher,
} from "../apps/web/src/lib/shipengine-webhook-signature";

// A stand-in for ShipEngine's signing key. Generated once so every case
// signs and verifies against the same material.
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = "webhook-signing-key-1";

const jwk = { ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" };
const fetcher: JwksFetcher = async () => ({ keys: [jwk] });

const BODY = JSON.stringify({
  resource_url: "https://api.shipengine.com/v1/tracking?x=1",
  resource_type: "API_TRACK",
  data: { tracking_number: "TRK123", status_code: "DE" },
});

const NOW = Date.parse("2026-09-10T12:00:00Z");
const TIMESTAMP = "2026-09-10T12:00:00Z";

function sign(body: string, timestamp: string, key = privateKey): string {
  return crypto.sign("sha256", Buffer.from(`${timestamp}.${body}`, "utf8"), key).toString("base64");
}

beforeEach(() => __clearJwksCacheForTests());

describe("verifyShipEngineWebhook", () => {
  it("accepts a correctly signed webhook", async () => {
    const result = await verifyShipEngineWebhook(
      BODY,
      { keyId: KID, signature: sign(BODY, TIMESTAMP), timestamp: TIMESTAMP },
      { fetcher, now: NOW }
    );
    expect(result).toEqual({ status: "verified" });
  });

  it("accepts a base64url-encoded signature", async () => {
    const sig = crypto
      .sign("sha256", Buffer.from(`${TIMESTAMP}.${BODY}`, "utf8"), privateKey)
      .toString("base64url");
    const result = await verifyShipEngineWebhook(
      BODY,
      { keyId: KID, signature: sig, timestamp: TIMESTAMP },
      { fetcher, now: NOW }
    );
    expect(result.status).toBe("verified");
  });

  it("rejects a tampered body", async () => {
    // The whole point: shipment state gates escrow release, so a modified
    // payload must never be trusted.
    const signature = sign(BODY, TIMESTAMP);
    const tampered = BODY.replace("TRK123", "TRK999");
    const result = await verifyShipEngineWebhook(
      tampered,
      { keyId: KID, signature, timestamp: TIMESTAMP },
      { fetcher, now: NOW }
    );
    expect(result).toEqual({ status: "rejected", reason: "BAD_SIGNATURE" });
  });

  it("rejects a signature that omits the timestamp prefix", async () => {
    // Signing the bare body is the obvious wrong implementation.
    const signature = crypto
      .sign("sha256", Buffer.from(BODY, "utf8"), privateKey)
      .toString("base64");
    const result = await verifyShipEngineWebhook(
      BODY,
      { keyId: KID, signature, timestamp: TIMESTAMP },
      { fetcher, now: NOW }
    );
    expect(result).toEqual({ status: "rejected", reason: "BAD_SIGNATURE" });
  });

  it("rejects a signature from a different key", async () => {
    const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const result = await verifyShipEngineWebhook(
      BODY,
      { keyId: KID, signature: sign(BODY, TIMESTAMP, other.privateKey), timestamp: TIMESTAMP },
      { fetcher, now: NOW }
    );
    expect(result).toEqual({ status: "rejected", reason: "BAD_SIGNATURE" });
  });

  it("rejects an unknown key id", async () => {
    const result = await verifyShipEngineWebhook(
      BODY,
      { keyId: "not-a-key", signature: sign(BODY, TIMESTAMP), timestamp: TIMESTAMP },
      { fetcher, now: NOW }
    );
    expect(result).toEqual({ status: "rejected", reason: "UNKNOWN_KEY" });
  });

  it.each([
    ["key id", { keyId: null }],
    ["signature", { signature: null }],
    ["timestamp", { timestamp: null }],
  ])("rejects a request missing the %s header", async (_label, override) => {
    const result = await verifyShipEngineWebhook(
      BODY,
      { keyId: KID, signature: sign(BODY, TIMESTAMP), timestamp: TIMESTAMP, ...override },
      { fetcher, now: NOW }
    );
    expect(result).toEqual({ status: "rejected", reason: "MISSING_HEADERS" });
  });

  it("rejects a replayed webhook signed too long ago", async () => {
    const result = await verifyShipEngineWebhook(
      BODY,
      { keyId: KID, signature: sign(BODY, TIMESTAMP), timestamp: TIMESTAMP },
      { fetcher, now: NOW + 10 * 60 * 1000 }
    );
    expect(result).toEqual({ status: "rejected", reason: "STALE_TIMESTAMP" });
  });

  it("rejects a timestamp far in the future", async () => {
    const result = await verifyShipEngineWebhook(
      BODY,
      { keyId: KID, signature: sign(BODY, TIMESTAMP), timestamp: TIMESTAMP },
      { fetcher, now: NOW - 10 * 60 * 1000 }
    );
    expect(result).toEqual({ status: "rejected", reason: "STALE_TIMESTAMP" });
  });

  it("rejects an unparseable timestamp", async () => {
    const result = await verifyShipEngineWebhook(
      BODY,
      { keyId: KID, signature: sign(BODY, TIMESTAMP), timestamp: "not-a-date" },
      { fetcher, now: NOW }
    );
    expect(result).toEqual({ status: "rejected", reason: "STALE_TIMESTAMP" });
  });

  it("fails closed when the JWKS cannot be fetched", async () => {
    // Distinguished from a bad signature so the route can answer 503 and let
    // ShipEngine retry, rather than 401 telling it never to bother again.
    const result = await verifyShipEngineWebhook(
      BODY,
      { keyId: KID, signature: sign(BODY, TIMESTAMP), timestamp: TIMESTAMP },
      {
        fetcher: async () => {
          throw new Error("network down");
        },
        now: NOW,
      }
    );
    expect(result).toEqual({ status: "rejected", reason: "JWKS_UNAVAILABLE" });
  });

  it("caches the key rather than refetching per request", async () => {
    let calls = 0;
    const counting: JwksFetcher = async () => {
      calls++;
      return { keys: [jwk] };
    };
    const headers = { keyId: KID, signature: sign(BODY, TIMESTAMP), timestamp: TIMESTAMP };
    await verifyShipEngineWebhook(BODY, headers, { fetcher: counting, now: NOW });
    await verifyShipEngineWebhook(BODY, headers, { fetcher: counting, now: NOW });
    expect(calls).toBe(1);
  });

  it("refetches when an unseen key id arrives, so rotation needs no redeploy", async () => {
    let calls = 0;
    const counting: JwksFetcher = async () => {
      calls++;
      return { keys: [jwk] };
    };
    await verifyShipEngineWebhook(
      BODY,
      { keyId: KID, signature: sign(BODY, TIMESTAMP), timestamp: TIMESTAMP },
      { fetcher: counting, now: NOW }
    );
    await verifyShipEngineWebhook(
      BODY,
      { keyId: "rotated-key-2", signature: sign(BODY, TIMESTAMP), timestamp: TIMESTAMP },
      { fetcher: counting, now: NOW }
    );
    expect(calls).toBe(2);
  });
});

describe("ShipEngine's real JWKS", () => {
  it("publishes an importable RSA signing key", async () => {
    // Guards against the live key set changing shape under us.
    const res = await fetch("https://api.shipengine.com/jwks");
    expect(res.ok).toBe(true);
    const { keys } = (await res.json()) as { keys: Array<Record<string, unknown>> };
    const rsa = keys.find((k) => k.kty === "RSA" && k.use === "sig");
    expect(rsa, "no RSA signing key in ShipEngine's JWKS").toBeDefined();
    expect(() =>
      crypto.createPublicKey({ key: rsa as crypto.JsonWebKey, format: "jwk" })
    ).not.toThrow();
  });
});
