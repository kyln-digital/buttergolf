/**
 * End-to-end transaction against a DEPLOYED environment.
 *
 * Differs from e2e-sandbox-transaction.ts in two ways, both so it needs no
 * secrets that aren't already deployed:
 *
 *  - Authenticates with a mobile-session Bearer token (MOBILE_SESSION_SECRET
 *    is already shared across environments) rather than a Clerk browser session.
 *  - Creates the order through GET /api/orders/by-payment-intent/[id], the
 *    app's own webhook-missed fallback, rather than posting a signed webhook.
 *    Preview deployments have no STRIPE_WEBHOOK_SECRET, and this path is real
 *    production code rather than a test-only shortcut.
 *
 * Usage:
 *   E2E_BASE_URL=https://<deployment>.vercel.app npx tsx scripts/e2e-deployed-transaction.ts
 *
 * DATABASE_URL must point at the same database the deployment uses.
 */
import Stripe from "stripe";
import { prisma } from "@buttergolf/db";
import { cleanupQuietly, E2E_RUN_TOKEN } from "./e2e-cleanup";
import { getShippingOption, getParcelPreset } from "@buttergolf/constants";
import { createMobileSessionToken } from "../apps/web/src/lib/mobile-session";

const BASE = process.env.E2E_BASE_URL;
if (!BASE) {
  console.error("Set E2E_BASE_URL to the deployment you want to test.");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-11-17.clover" as never,
});

/**
 * These scripts create users, charge a card and buy a shipping label against
 * whatever target they are given. Pointed at production with live keys that
 * is real money and real fixture data in front of customers, so refuse
 * anything that isn't clearly a test target unless explicitly overridden.
 *
 * Note the deployment buys labels with ITS OWN ShipEngine key, which this
 * cannot see. Checking the local one catches the common case; the target
 * check is what actually keeps this off production.
 */
function assertSafeTarget(baseUrl: string): void {
  if (process.env.E2E_ALLOW_UNSAFE_TARGET === "true") return;

  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
  if (!stripeKey.startsWith("sk_test_")) {
    console.error("Refusing to run: STRIPE_SECRET_KEY is not a test key.");
    console.error("Set E2E_ALLOW_UNSAFE_TARGET=true only if you really mean it.");
    process.exit(1);
  }

  const shipEngineKey = process.env.SHIPENGINE_API_KEY ?? "";
  if (shipEngineKey && !shipEngineKey.startsWith("TEST_")) {
    console.error("Refusing to run: SHIPENGINE_API_KEY is not a sandbox key.");
    console.error("Set E2E_ALLOW_UNSAFE_TARGET=true only if you really mean it.");
    process.exit(1);
  }

  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseUrl);
  const isPreview = baseUrl.includes(".vercel.app");
  if (!isLocal && !isPreview) {
    console.error(`Refusing to run against ${baseUrl}: not a localhost or preview target.`);
    console.error("Set E2E_ALLOW_UNSAFE_TARGET=true only if you really mean it.");
    process.exit(1);
  }
}

assertSafeTarget(BASE);

const pass: string[] = [];
const fail: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  (ok ? pass : fail).push(label);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const stamp = Date.now();
  console.log(`target: ${BASE}\n`);

  // ---------- fixtures, in the deployment's own database ----------
  const seller = await prisma.user.create({
    data: {
      clerkId: `${E2E_RUN_TOKEN}dep-s-${stamp}`,
      email: `e2e-dep-s-${stamp}@example.com`,
      firstName: "Sandy",
      lastName: "Seller",
    },
  });
  await prisma.address.create({
    data: {
      userId: seller.id,
      name: "Sandy Seller",
      street1: "10 Downing Street",
      city: "London",
      state: "Greater London",
      zip: "SW1A 2AA",
      country: "GB",
      phone: "07700900123",
      isDefault: true,
    },
  });

  const buyer = await prisma.user.create({
    data: {
      clerkId: `${E2E_RUN_TOKEN}dep-b-${stamp}`,
      email: `e2e-dep-b-${stamp}@example.com`,
      firstName: "Barry",
      lastName: "Buyer",
    },
  });

  const category = await prisma.category.findFirstOrThrow({ where: { slug: "woods" } });
  const preset = getParcelPreset("club-long")!;
  const product = await prisma.product.create({
    data: {
      title: `E2E Driver ${stamp}`,
      description: "Deployed E2E fixture",
      price: 189.99,
      condition: "EXCELLENT",
      userId: seller.id,
      categoryId: category.id,
      parcelPresetId: preset.id,
      length: preset.length,
      width: preset.width,
      height: preset.height,
      weight: preset.weight,
      images: { create: [{ url: "https://example.com/driver.jpg", sortOrder: 0 }] },
    },
  });

  const buyerToken = await createMobileSessionToken(buyer.clerkId);
  const option = getShippingOption("express")!;

  // ---------- the deployment creates the PaymentIntent ----------
  // This is the assertion that matters most: it only succeeds if the Stripe
  // key deployed to this environment is valid.
  const piRes = await fetch(`${BASE}/api/checkout/create-payment-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyerToken}` },
    body: JSON.stringify({ productId: product.id, shippingOptionId: option.id }),
  });
  const piBody = (await piRes.json().catch(() => ({}))) as Record<string, unknown>;

  check(
    "deployment created a PaymentIntent (Stripe key valid in this env)",
    piRes.ok && typeof piBody.paymentIntentId === "string",
    piRes.ok ? String(piBody.paymentIntentId) : `HTTP ${piRes.status} ${JSON.stringify(piBody)}`
  );
  if (!piRes.ok) return finish();

  const paymentIntentId = piBody.paymentIntentId as string;

  check(
    "shipping charged on top of the item price",
    piBody.shippingAmount === option.priceInPence,
    `£${(Number(piBody.shippingAmount) / 100).toFixed(2)}`
  );

  // ---------- pay it, attaching the delivery address ----------
  const pm = await stripe.paymentMethods.create({ type: "card", card: { token: "tok_visa" } });
  const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: pm.id,
    return_url: `${BASE}/checkout/success`,
    shipping: {
      name: "Barry Buyer",
      phone: "07700900456",
      address: {
        line1: "1 Old Course Road",
        city: "St Andrews",
        state: "Fife",
        postal_code: "KY16 9SP",
        country: "GB",
      },
    },
  });
  check("payment succeeded", confirmed.status === "succeeded", confirmed.status);

  // ---------- the deployment creates the order ----------
  let orderCreated = false;
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${BASE}/api/orders/by-payment-intent/${paymentIntentId}`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    if (r.ok) {
      const b = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (b && b.id) {
        orderCreated = true;
        break;
      }
    }
    await new Promise((res) => setTimeout(res, 3000));
  }
  check("order created by the deployment", orderCreated);

  // Label purchase is fire-and-forget; wait for it to settle.
  for (let i = 0; i < 30; i++) {
    const o = await prisma.order.findFirst({ where: { stripePaymentId: paymentIntentId } });
    if (o && (o.labelUrl || o.labelError)) break;
    await new Promise((res) => setTimeout(res, 2000));
  }

  const order = await prisma.order.findFirst({
    where: { stripePaymentId: paymentIntentId },
    include: { toAddress: true },
  });
  check("order row present", !!order, order?.id);
  if (!order) return finish();

  check(
    "seller payout excludes shipping",
    order.stripeSellerPayout === product.price,
    `£${order.stripeSellerPayout}`
  );
  check(
    "chosen service persisted",
    order.shippingOptionId === option.id,
    `${order.shippingOptionId} / ${order.shippingServiceName}`
  );
  check("delivery address captured", order.toAddress.zip === "KY16 9SP", order.toAddress.city);

  check(
    "ShipEngine label purchased by the deployment",
    !!order.labelUrl,
    order.labelUrl ? `${order.carrier} / ${order.service}` : `labelError=${order.labelError}`
  );

  if (order.labelUrl) {
    check("tracking number assigned", !!order.trackingCode, order.trackingCode ?? "");
    check("carrier code stored", !!order.carrierCode, order.carrierCode ?? "");
    check("status advanced", order.status === "LABEL_GENERATED", order.status);
    const r = await fetch(order.labelUrl);
    check("label downloads", r.ok, `HTTP ${r.status}`);
  }

  finish();

  function finish() {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`PASSED ${pass.length}   FAILED ${fail.length}`);
    fail.forEach((f) => console.log("  - " + f));
    console.log("=".repeat(60));
    process.exitCode = fail.length ? 1 : 0;
  }
}

main()
  .catch((e) => {
    console.error("crashed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupQuietly();
    await prisma.$disconnect();
  });
