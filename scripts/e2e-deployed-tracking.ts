/**
 * Closes the shipping loop against a deployed environment:
 *
 *   order -> deployment buys a real ShipEngine label
 *         -> ShipEngine tracking is started for it
 *         -> ShipEngine POSTs a signed `track` webhook to the deployment
 *         -> the deployment verifies the RSA signature and advances the order
 *
 * The signature cannot be forged locally, so this is the only way to prove
 * verification actually accepts genuine ShipEngine traffic.
 *
 * Requires a `track` webhook registered in ShipEngine pointing at E2E_BASE_URL.
 *
 * Usage:
 *   E2E_BASE_URL=https://<deployment> npx tsx scripts/e2e-deployed-tracking.ts
 */
import { prisma } from "@buttergolf/db";
import { getShippingOption, getParcelPreset } from "@buttergolf/constants";
import { createMobileSessionToken } from "../apps/web/src/lib/mobile-session";

const BASE = process.env.E2E_BASE_URL;
const SHIPENGINE_API_KEY = process.env.SHIPENGINE_API_KEY;
if (!BASE || !SHIPENGINE_API_KEY) {
  console.error("Set E2E_BASE_URL and SHIPENGINE_API_KEY.");
  process.exit(1);
}

const pass: string[] = [];
const fail: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  (ok ? pass : fail).push(label);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const stamp = Date.now();
  console.log(`target: ${BASE}\n`);

  const seller = await prisma.user.create({
    data: {
      clerkId: `e2e-trk-s-${stamp}`,
      email: `e2e-trk-s-${stamp}@example.com`,
      firstName: "Trk",
      lastName: "Seller",
    },
  });
  const from = await prisma.address.create({
    data: {
      userId: seller.id,
      name: "Trk Seller",
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
      clerkId: `e2e-trk-b-${stamp}`,
      email: `e2e-trk-b-${stamp}@example.com`,
      firstName: "Trk",
      lastName: "Buyer",
    },
  });
  const to = await prisma.address.create({
    data: {
      userId: buyer.id,
      name: "Trk Buyer",
      street1: "1 Old Course Road",
      city: "St Andrews",
      state: "Fife",
      zip: "KY16 9SP",
      country: "GB",
      phone: "07700900456",
    },
  });

  const category = await prisma.category.findFirstOrThrow({ where: { slug: "woods" } });
  const preset = getParcelPreset("club-long")!;
  const option = getShippingOption("express")!;
  const product = await prisma.product.create({
    data: {
      title: `Tracking check driver ${stamp}`,
      description: "Tracking check fixture",
      price: 189.99,
      condition: "EXCELLENT",
      userId: seller.id,
      categoryId: category.id,
      parcelPresetId: preset.id,
      length: preset.length,
      width: preset.width,
      height: preset.height,
      weight: preset.weight,
      isSold: true,
      images: { create: [{ url: "https://example.com/driver.jpg", sortOrder: 0 }] },
    },
  });

  const order = await prisma.order.create({
    data: {
      stripePaymentId: `pi_e2e_trk_${stamp}`,
      amountTotal: 207.18,
      shippingCost: option.priceInPence / 100,
      shippingOptionId: option.id,
      shippingServiceName: option.name,
      stripeSellerPayout: product.price,
      paymentHoldStatus: "HELD",
      paymentHeldAt: new Date(),
      sellerId: seller.id,
      buyerId: buyer.id,
      productId: product.id,
      fromAddressId: from.id,
      toAddressId: to.id,
    },
  });

  // ---------- the deployment buys the label ----------
  const sellerToken = await createMobileSessionToken(seller.clerkId);
  const labelRes = await fetch(`${BASE}/api/orders/${order.id}/label`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  const labelBody = (await labelRes.json().catch(() => ({}))) as Record<string, unknown>;
  check(
    "deployment purchased a ShipEngine label",
    labelRes.ok,
    labelRes.ok
      ? String(labelBody.trackingNumber)
      : `HTTP ${labelRes.status} ${JSON.stringify(labelBody)}`
  );
  if (!labelRes.ok) return finish();

  const withLabel = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  check("tracking number stored", !!withLabel.trackingCode, withLabel.trackingCode ?? "");
  check("carrier code stored", !!withLabel.carrierCode, withLabel.carrierCode ?? "");
  check(
    "shipment set to PRE_TRANSIT",
    withLabel.shipmentStatus === "PRE_TRANSIT",
    withLabel.shipmentStatus
  );

  // ---------- ask ShipEngine to start tracking, which triggers the webhook ----------
  const startRes = await fetch(
    `https://api.shipengine.com/v1/tracking/start?carrier_code=${withLabel.carrierCode}&tracking_number=${encodeURIComponent(withLabel.trackingCode!)}`,
    { method: "POST", headers: { "API-Key": SHIPENGINE_API_KEY! } }
  );
  check("ShipEngine accepted tracking subscription", startRes.ok, `HTTP ${startRes.status}`);

  // ---------- wait for the signed webhook to land and move the order ----------
  console.log("\nwaiting for a signed track webhook (up to 3 min)...");
  const before = withLabel.updatedAt.getTime();
  let advanced = false;
  let latest = withLabel;
  for (let i = 0; i < 36; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    latest = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    if (latest.updatedAt.getTime() > before || latest.shipmentStatus !== "PRE_TRANSIT") {
      advanced = true;
      break;
    }
  }

  check(
    "deployment accepted a signed webhook and updated the order",
    advanced,
    advanced
      ? `shipmentStatus=${latest.shipmentStatus} status=${latest.status}`
      : "no webhook observed — ShipEngine sandbox may not emit tracking events for the dummy carrier"
  );

  console.log(
    `\norderId=${order.id}  tracking=${withLabel.trackingCode}  carrier=${withLabel.carrierCode}`
  );
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
  .finally(() => prisma.$disconnect());
