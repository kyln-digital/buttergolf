import { beforeEach, describe, expect, it, vi } from "vitest";

// The route builds its own Resend client, so the SDK is mocked at the module
// boundary: `verify` stands in for signature checking, `forward` for delivery.
const verify = vi.fn();
const forward = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    webhooks = { verify };
    emails = { receiving: { forward } };
  },
}));

import { POST } from "../apps/web/src/app/api/resend/webhook/route";

const SVIX_HEADERS = {
  "svix-id": "msg_1",
  "svix-timestamp": "1700000000",
  "svix-signature": "v1,abc",
};

const RECEIVED = {
  type: "email.received",
  created_at: "2026-09-11T12:00:00.000Z",
  data: { email_id: "em_123", from: "dnb@example.org", to: ["josh@buttergolf.com"] },
};

function post(body: unknown, headers: Record<string, string> = SVIX_HEADERS) {
  return POST(
    new Request("https://www.buttergolf.com/api/resend/webhook", {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  verify.mockReset().mockReturnValue(RECEIVED);
  forward.mockReset().mockResolvedValue({ data: { id: "fw_1" }, error: null });
  process.env.RESEND_API_KEY = "re_test";
  process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
  process.env.RESEND_INBOUND_FORWARD_TO = "josh@example.com";
  delete process.env.RESEND_INBOUND_FORWARD_FROM;
});

describe("configuration", () => {
  it("returns 500 without a webhook secret and never touches Resend", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const res = await post(RECEIVED);
    expect(res.status).toBe(500);
    expect(verify).not.toHaveBeenCalled();
    expect(forward).not.toHaveBeenCalled();
  });

  it.each([
    ["", "unset"],
    ["josh@buttergolf.com", "a receiving domain"],
    ["ButterGolf <josh@buttergolf.com>", "a formatted address on a receiving domain"],
    ["josh@notifications.buttergolf.com", "the notifications subdomain"],
    ["josh@mail.buttergolf.com", "any subdomain of a receiving domain"],
    ["a@example.com, b@example.com", "a list of addresses"],
    ["not-an-address", "a malformed value"],
  ])("returns 500 when the forward target is %s (%s)", async (target) => {
    process.env.RESEND_INBOUND_FORWARD_TO = target;
    const res = await post(RECEIVED);
    expect(res.status).toBe(500);
    expect(verify).not.toHaveBeenCalled();
    expect(forward).not.toHaveBeenCalled();
  });
});

describe("signature verification", () => {
  it("returns 400 when the Svix headers are missing", async () => {
    const res = await post(RECEIVED, { "svix-id": "msg_1" });
    expect(res.status).toBe(400);
    expect(verify).not.toHaveBeenCalled();
  });

  it("verifies the raw body bytes, not a re-serialised copy", async () => {
    const raw = '{ "type":"email.received",   "data": {"email_id":"em_123"} }';
    await post(raw);
    expect(verify).toHaveBeenCalledWith({
      payload: raw,
      headers: { id: "msg_1", timestamp: "1700000000", signature: "v1,abc" },
      webhookSecret: "whsec_test",
    });
  });

  it("returns 400 and does not forward when verification fails", async () => {
    verify.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = await post(RECEIVED);
    expect(res.status).toBe(400);
    expect(forward).not.toHaveBeenCalled();
  });
});

describe("forwarding", () => {
  it("ignores events other than email.received", async () => {
    verify.mockReturnValue({ type: "email.delivered", created_at: "", data: { email_id: "x" } });
    const res = await post({});
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, ignored: "email.delivered" });
    expect(forward).not.toHaveBeenCalled();
  });

  it("forwards a received email with an idempotency key derived from its id", async () => {
    const res = await post(RECEIVED);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, forwarded: "fw_1" });
    expect(forward).toHaveBeenCalledTimes(1);
    expect(forward).toHaveBeenCalledWith(
      {
        emailId: "em_123",
        to: "josh@example.com",
        from: "ButterGolf Inbox <notifications@notifications.buttergolf.com>",
      },
      { idempotencyKey: "inbound-forward-em_123" }
    );
  });

  it("strips a display name from the target and honours a custom sender", async () => {
    process.env.RESEND_INBOUND_FORWARD_TO = "Josh <Josh@Example.com>";
    process.env.RESEND_INBOUND_FORWARD_FROM = "inbox@buttergolf.com";
    await post(RECEIVED);
    expect(forward).toHaveBeenCalledWith(
      expect.objectContaining({ to: "josh@example.com", from: "inbox@buttergolf.com" }),
      expect.anything()
    );
  });

  it("returns 502 so Resend retries when the forward fails", async () => {
    forward.mockResolvedValue({
      data: null,
      error: { name: "application_error", message: "boom" },
    });
    const res = await post(RECEIVED);
    expect(res.status).toBe(502);
  });
});
