import crypto from "k6/crypto";
import encoding from "k6/encoding";
import { group, sleep } from "k6";
import { rawPost } from "../lib/http.js";
import { uniqueSuffix } from "../lib/random.js";

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function stripeSignature(secret, body, timestamp) {
  const signedPayload = `${timestamp}.${body}`;
  const signature = crypto.hmac("sha256", secret, signedPayload, "hex");
  return `t=${timestamp},v1=${signature}`;
}

function svixSecretToKey(secret) {
  if (secret && secret.startsWith("whsec_")) {
    return encoding.b64decode(secret.slice("whsec_".length), "std", "s");
  }
  return secret;
}

function svixSignature(secret, body, messageId, timestamp) {
  const signedPayload = `${messageId}.${timestamp}.${body}`;
  const signature = crypto.hmac("sha256", svixSecretToKey(secret), signedPayload, "base64");
  return `v1,${signature}`;
}

function shipengineSignature(secret, body) {
  return crypto.hmac("sha256", secret, body, "base64");
}

function stripeEvent(config, type, object) {
  return JSON.stringify({
    id: `evt_${uniqueSuffix(config)}`,
    object: "event",
    api_version: "2025-10-29.clover",
    created: nowSeconds(),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
    data: { object },
  });
}

function sendStripeWebhook(config, path, secret, body, route, expectedStatuses = [200]) {
  if (!secret) {
    console.warn(`Skipping ${route}; webhook secret is not configured.`);
    return;
  }

  const timestamp = nowSeconds();
  rawPost(config, path, body, {
    route,
    routeGroup: "webhook",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": stripeSignature(secret, body, timestamp),
    },
    expectedStatuses,
  });

  rawPost(config, path, body, {
    route: `${route}:invalid-signature`,
    routeGroup: "webhook",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": `t=${timestamp},v1=bad-signature`,
    },
    expectedStatuses: [400],
  });
}

function sendClerkWebhook(config) {
  if (!config.clerkWebhookSecret) {
    console.warn("Skipping Clerk webhook checks; K6_CLERK_WEBHOOK_SECRET is not configured.");
    return;
  }

  const body = JSON.stringify({
    type: "session.created",
    data: {
      id: `sess_${uniqueSuffix(config)}`,
    },
  });
  const messageId = `msg_${uniqueSuffix(config)}`;
  const timestamp = String(nowSeconds());

  rawPost(config, "/api/clerk/webhook", body, {
    route: "/api/clerk/webhook",
    routeGroup: "webhook",
    headers: {
      "Content-Type": "application/json",
      "svix-id": messageId,
      "svix-timestamp": timestamp,
      "svix-signature": svixSignature(config.clerkWebhookSecret, body, messageId, timestamp),
    },
    expectedStatuses: [200],
  });

  rawPost(config, "/api/clerk/webhook", body, {
    route: "/api/clerk/webhook:invalid-signature",
    routeGroup: "webhook",
    headers: {
      "Content-Type": "application/json",
      "svix-id": messageId,
      "svix-timestamp": timestamp,
      "svix-signature": "v1,bad-signature",
    },
    expectedStatuses: [400],
  });
}

function sendShipengineWebhook(config) {
  if (!config.shipengineWebhookSecret) {
    console.warn(
      "Skipping ShipEngine webhook checks; K6_SHIPENGINE_WEBHOOK_SECRET is not configured."
    );
    return;
  }

  const body = JSON.stringify({
    resource_url: "https://api.shipengine.com/v1/tracking/k6",
    resource_type: "API_TRACK",
    data: {
      tracking_number: `K6TRACK${nowSeconds()}`,
      carrier_status_code: "IT",
      status_code: "IT",
      status_description: "In Transit",
      carrier_code: "royal_mail",
      events: [
        {
          occurred_at: new Date().toISOString(),
          carrier_occurred_at: new Date().toISOString(),
          description: "k6 synthetic in transit event",
          city_locality: "London",
          state_province: "Greater London",
          postal_code: "SW1A 1AA",
          country_code: "GB",
        },
      ],
    },
  });

  rawPost(config, "/api/shipengine/webhook", body, {
    route: "/api/shipengine/webhook",
    routeGroup: "webhook",
    headers: {
      "Content-Type": "application/json",
      "x-shipengine-signature": shipengineSignature(config.shipengineWebhookSecret, body),
    },
    expectedStatuses: [200],
  });

  rawPost(config, "/api/shipengine/webhook", body, {
    route: "/api/shipengine/webhook:invalid-signature",
    routeGroup: "webhook",
    headers: {
      "Content-Type": "application/json",
      "x-shipengine-signature": "bad-signature",
    },
    expectedStatuses: [401],
  });
}

export function runWebhookResilience(data) {
  const config = data.config;

  if (!config.enableWebhooks) {
    console.warn("K6_ENABLE_WEBHOOKS is not true; skipping webhook resilience checks.");
    return;
  }

  group("stripe webhooks", () => {
    const checkoutExpired = stripeEvent(config, "checkout.session.expired", {
      id: `cs_test_${uniqueSuffix(config)}`,
      object: "checkout.session",
      metadata: {},
      payment_intent: null,
      amount_total: 0,
    });
    sendStripeWebhook(
      config,
      "/api/stripe/webhook",
      config.stripeWebhookSecret,
      checkoutExpired,
      "/api/stripe/webhook:checkout.session.expired"
    );

    const connectPayoutCreated = stripeEvent(config, "payout.created", {
      id: `po_${uniqueSuffix(config)}`,
      object: "payout",
      amount: 100,
      currency: "gbp",
      status: "pending",
    });
    sendStripeWebhook(
      config,
      "/api/stripe/connect/webhook",
      config.stripeConnectWebhookSecret,
      connectPayoutCreated,
      "/api/stripe/connect/webhook:payout.created"
    );
  });

  group("clerk and shipping webhooks", () => {
    sendClerkWebhook(config);
    sendShipengineWebhook(config);
  });

  sleep(Math.random() * 2 + 1);
}
