import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT } from "jose";

/**
 * The QR code the sell form shows is a bearer credential: whoever scans it can
 * upload photos into that seller's session. These tests pin down what the
 * token does and does not grant — it is scoped to one session, capped in how
 * many photos it accepts, and rejected everywhere a mobile session token is
 * accepted (and vice versa), because both are signed with the same secret.
 */

const SECRET = "test-secret-that-is-definitely-longer-than-32-chars";

type SessionModule = typeof import("../apps/web/src/lib/phone-upload-session");
type SharedModule = typeof import("../apps/web/src/lib/phone-upload");
type MobileModule = typeof import("../apps/web/src/lib/mobile-session");

let session: SessionModule;
let shared: SharedModule;
let mobile: MobileModule;

beforeAll(async () => {
  process.env.MOBILE_SESSION_SECRET = SECRET;
  session = await import("../apps/web/src/lib/phone-upload-session");
  shared = await import("../apps/web/src/lib/phone-upload");
  mobile = await import("../apps/web/src/lib/mobile-session");
});

describe("phone upload session token", () => {
  it("round-trips the seller, session id and photo allowance", async () => {
    const { token, session: minted } = await session.createPhoneUploadSessionToken("user_abc", 3);

    const verified = await session.verifyPhoneUploadSessionToken(token);

    expect(verified).not.toBeNull();
    expect(verified?.clerkId).toBe("user_abc");
    expect(verified?.sessionId).toBe(minted.sessionId);
    expect(verified?.maxPhotos).toBe(3);
    expect(verified?.expiresAt).toBe(minted.expiresAt);
  });

  it("expires fifteen minutes after minting", async () => {
    const before = Date.now();
    const { session: minted } = await session.createPhoneUploadSessionToken("user_abc", 3);

    const ttl = minted.expiresAt - before;
    expect(ttl).toBeGreaterThan(shared.PHONE_UPLOAD_SESSION_TTL_MS - 2000);
    expect(ttl).toBeLessThanOrEqual(shared.PHONE_UPLOAD_SESSION_TTL_MS + 1000);
  });

  it("clamps the photo allowance into [1, ceiling]", async () => {
    const ceiling = shared.PHONE_UPLOAD_SESSION_MAX_PHOTOS;

    expect(session.clampPhoneUploadMax(0)).toBe(1);
    expect(session.clampPhoneUploadMax(-5)).toBe(1);
    expect(session.clampPhoneUploadMax(2.9)).toBe(2);
    expect(session.clampPhoneUploadMax(ceiling + 50)).toBe(ceiling);
    expect(session.clampPhoneUploadMax("7")).toBe(ceiling);
    expect(session.clampPhoneUploadMax(undefined)).toBe(ceiling);

    const { session: minted } = await session.createPhoneUploadSessionToken("user_abc", 999);
    expect(minted.maxPhotos).toBe(ceiling);
  });

  it("mints a distinct session id every time", async () => {
    const a = await session.createPhoneUploadSessionToken("user_abc", 5);
    const b = await session.createPhoneUploadSessionToken("user_abc", 5);
    expect(a.session.sessionId).not.toBe(b.session.sessionId);
  });

  it("is not accepted as a mobile session token", async () => {
    const { token } = await session.createPhoneUploadSessionToken("user_abc", 3);
    expect(await mobile.verifyMobileSessionToken(token)).toBeNull();
    expect(await mobile.getMobileSessionUserData(token)).toBeNull();
  });

  it("does not accept a mobile session token", async () => {
    const mobileToken = await mobile.createMobileSessionToken("user_abc");
    expect(await session.verifyPhoneUploadSessionToken(mobileToken)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const forged = await new SignJWT({ type: "phone_upload_session", max: 3 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_abc")
      .setJti("00000000-0000-4000-8000-000000000000")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("another-secret-that-is-also-long-enough-to-pass"));

    expect(await session.verifyPhoneUploadSessionToken(forged)).toBeNull();
  });

  it("rejects a correctly signed token whose allowance is out of range", async () => {
    const overCap = await new SignJWT({
      type: "phone_upload_session",
      max: shared.PHONE_UPLOAD_SESSION_MAX_PHOTOS + 1,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_abc")
      .setJti("00000000-0000-4000-8000-000000000000")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(SECRET));

    expect(await session.verifyPhoneUploadSessionToken(overCap)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ type: "phone_upload_session", max: 3 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_abc")
      .setJti("00000000-0000-4000-8000-000000000000")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(SECRET));

    expect(await session.verifyPhoneUploadSessionToken(expired)).toBeNull();
  });
});

describe("readBearerToken", () => {
  it("extracts a Bearer credential and ignores anything else", () => {
    const withBearer = new Request("https://example.test", {
      headers: { Authorization: "Bearer abc.def.ghi" },
    });
    expect(session.readBearerToken(withBearer)).toBe("abc.def.ghi");

    const basic = new Request("https://example.test", {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });
    expect(session.readBearerToken(basic)).toBeNull();

    const empty = new Request("https://example.test", { headers: { Authorization: "Bearer " } });
    expect(session.readBearerToken(empty)).toBeNull();

    expect(session.readBearerToken(new Request("https://example.test"))).toBeNull();
  });
});

describe("QR url", () => {
  it("carries the token in the fragment and reads it back", () => {
    const token = "eyJ.header+payload/sig=";
    const url = shared.buildPhoneUploadUrl("https://www.buttergolf.com", token);

    expect(url.startsWith(`https://www.buttergolf.com${shared.PHONE_UPLOAD_PAGE_PATH}#`)).toBe(
      true
    );
    // Fragments never reach the server, so the token stays out of request logs.
    expect(new URL(url).search).toBe("");
    expect(shared.readPhoneUploadTokenFromHash(new URL(url).hash)).toBe(token);
  });

  it("returns null when the fragment has no token", () => {
    expect(shared.readPhoneUploadTokenFromHash("")).toBeNull();
    expect(shared.readPhoneUploadTokenFromHash("#")).toBeNull();
    expect(shared.readPhoneUploadTokenFromHash("#t=")).toBeNull();
    expect(shared.readPhoneUploadTokenFromHash("#other=1")).toBeNull();
  });
});
