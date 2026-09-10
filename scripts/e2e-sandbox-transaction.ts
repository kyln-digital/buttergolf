/**
 * End-to-end sandbox transaction:
 *   Stripe test payment -> signed webhook -> our order creation
 *   -> ShipEngine sandbox rate + label -> tracking.
 *
 * Drives the real running dev server and the real API routes. Nothing here
 * reimplements application logic; it only sets up fixtures and asserts.
 */
import Stripe from "stripe";
import crypto from "node:crypto";
import { prisma } from "@buttergolf/db";
import { cleanupQuietly, E2E_RUN_TOKEN } from "./e2e-cleanup";
import {
  calculateBuyerProtectionFeeInPence,
  getShippingOption,
  getParcelPreset,
} from "@buttergolf/constants";

const BASE = "http://localhost:3000";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-11-17.clover" as never,
});

const pass: string[] = [];
const fail: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  (ok ? pass : fail).push(`${label}${detail ? ` — ${detail}` : ""}`);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const stamp = Date.now();

  // ---------- fixtures ----------
  const seller = await prisma.user.create({
    data: {
      clerkId: `${E2E_RUN_TOKEN}seller-${stamp}`,
      email: `e2e-seller-${stamp}@example.com`,
      firstName: "Sandy",
      lastName: "Seller",
      stripeOnboardingComplete: false,
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
      clerkId: `${E2E_RUN_TOKEN}buyer-${stamp}`,
      email: `e2e-buyer-${stamp}@example.com`,
      firstName: "Barry",
      lastName: "Buyer",
    },
  });

  const category = await prisma.category.findFirstOrThrow({ where: { slug: "woods" } });

  // A driver: the exact case the old 30x20x10cm @ 500g default got wrong.
  const preset = getParcelPreset("club-long")!;
  const product = await prisma.product.create({
    data: {
      title: "TaylorMade Stealth 2 Driver",
      description: "E2E sandbox fixture",
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

  console.log(`\nseller=${seller.id}\nbuyer=${buyer.id}\nproduct=${product.id}`);
  console.log(`parcel: ${preset.length}x${preset.width}x${preset.height}cm @ ${preset.weight}g\n`);

  // ---------- Stripe test payment ----------
  const option = getShippingOption("express")!; // Royal Mail Tracked 24, £6.99
  const productPence = Math.round(product.price * 100);
  const feePence = calculateBuyerProtectionFeeInPence(productPence);
  const totalPence = productPence + option.priceInPence + feePence;

  const pm = await stripe.paymentMethods.create({
    type: "card",
    card: { token: "tok_visa" },
  });

  let pi = await stripe.paymentIntents.create({
    amount: totalPence,
    currency: "gbp",
    payment_method: pm.id,
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
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
    metadata: {
      productId: product.id,
      sellerId: seller.id,
      buyerId: buyer.id,
      productPriceInPence: String(productPence),
      shippingAmountInPence: String(option.priceInPence),
      buyerProtectionFeeInPence: String(feePence),
      // Seller is paid the item price only; shipping funds the label.
      sellerPayoutInPence: String(productPence),
      shippingOptionId: option.id,
      shippingOptionName: option.name,
      source: "payment_element",
    },
  });

  check("Stripe test payment succeeded", pi.status === "succeeded", `${pi.id} status=${pi.status}`);
  check(
    "charged the expected total",
    pi.amount === totalPence,
    `£${(pi.amount / 100).toFixed(2)} (item £${(productPence / 100).toFixed(2)} + ship £${(option.priceInPence / 100).toFixed(2)} + fee £${(feePence / 100).toFixed(2)})`
  );

  pi = await stripe.paymentIntents.retrieve(pi.id);

  // ---------- signed webhook into the running app ----------
  const payload = JSON.stringify({
    id: `evt_e2e_${stamp}`,
    object: "event",
    type: "payment_intent.succeeded",
    api_version: "2025-11-17.clover",
    created: Math.floor(Date.now() / 1000),
    data: { object: pi },
  });

  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", WEBHOOK_SECRET).update(`${ts}.${payload}`).digest("hex");

  const res = await fetch(`${BASE}/api/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": `t=${ts},v1=${sig}` },
    body: payload,
  });
  const body = await res.text();
  check("webhook accepted", res.ok, `HTTP ${res.status} ${body.slice(0, 160)}`);

  // Label purchase is fire-and-forget; give it room to land.
  for (let i = 0; i < 30; i++) {
    const o = await prisma.order.findFirst({ where: { stripePaymentId: pi.id } });
    if (o && (o.labelUrl || o.labelError)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  // ---------- assertions ----------
  const order = await prisma.order.findFirst({
    where: { stripePaymentId: pi.id },
    include: { toAddress: true, fromAddress: true },
  });

  check("order created", !!order, order?.id);
  if (!order) return finish();

  check(
    "product marked sold",
    (await prisma.product.findUnique({ where: { id: product.id } }))!.isSold
  );
  check(
    "buyer delivery address captured",
    order.toAddress.zip === "KY16 9SP",
    `${order.toAddress.city} ${order.toAddress.zip}`
  );
  check(
    "seller payout excludes shipping",
    order.stripeSellerPayout === product.price,
    `payout £${order.stripeSellerPayout} vs item £${product.price} (shipping £${order.shippingCost} retained)`
  );
  check(
    "chosen shipping service persisted",
    order.shippingOptionId === option.id && order.shippingServiceName === option.name,
    `${order.shippingOptionId} / ${order.shippingServiceName}`
  );
  check("payment held in escrow", order.paymentHoldStatus === "HELD");

  // ---------- ShipEngine sandbox ----------
  check(
    "ShipEngine label purchased",
    !!order.labelUrl,
    order.labelUrl ? `${order.carrier} ${order.service}` : `labelError=${order.labelError}`
  );

  if (order.labelUrl) {
    check("tracking number assigned", !!order.trackingCode, order.trackingCode ?? "");
    check("carrier code stored for tracking", !!order.carrierCode, order.carrierCode ?? "");
    check("order advanced to LABEL_GENERATED", order.status === "LABEL_GENERATED", order.status);
    check(
      "shipment set to PRE_TRANSIT",
      order.shipmentStatus === "PRE_TRANSIT",
      order.shipmentStatus
    );
    check("no label error recorded", !order.labelError, order.labelError ?? "");

    for (const [name, url] of [
      ["PDF", order.labelUrl],
      ["PNG", order.labelPngUrl],
      ["ZPL", order.labelZplUrl],
    ] as const) {
      if (!url) {
        check(`${name} label available`, false, "missing");
        continue;
      }
      const r = await fetch(url);
      const len = Number(r.headers.get("content-length") ?? 0);
      check(`${name} label downloads`, r.ok && len > 0, `HTTP ${r.status}, ${len} bytes`);
    }

    const track = await fetch(
      `https://api.shipengine.com/v1/tracking?carrier_code=${order.carrierCode}&tracking_number=${order.trackingCode}`,
      { headers: { "API-Key": process.env.SHIPENGINE_API_KEY! } }
    );
    check("ShipEngine tracking reachable", track.ok, `HTTP ${track.status}`);
  }

  finish();

  function finish() {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`PASSED ${pass.length}   FAILED ${fail.length}`);
    if (fail.length) {
      console.log("\nFailures:");
      fail.forEach((f) => console.log("  - " + f));
    }
    console.log("=".repeat(60));
    console.log(`\norderId=${order?.id ?? "none"}`);
    process.exitCode = fail.length ? 1 : 0;
  }
}

main()
  .catch((e) => {
    console.error("E2E crashed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupQuietly();
    await prisma.$disconnect();
  });
