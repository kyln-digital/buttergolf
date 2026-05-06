import crypto from "k6/crypto";
import encoding from "k6/encoding";

function base64UrlEncode(value) {
  return encoding
    .b64encode(value, "std")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64ToBase64Url(value) {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createMobileSessionToken(config, user, ttlSeconds = 15 * 60) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const payload = {
    sub: user.clerkId,
    type: "mobile_onboarding_session",
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    email: user.email || null,
    iat: now,
    exp: now + ttlSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.hmac("sha256", config.mobileSessionSecret, signingInput, "base64");

  return `${signingInput}.${base64ToBase64Url(signature)}`;
}

export function authHeaders(config, role = "buyer") {
  const user = config.users[role] || config.users.buyer;
  return {
    Authorization: `Bearer ${createMobileSessionToken(config, user)}`,
  };
}
