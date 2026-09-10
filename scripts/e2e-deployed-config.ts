/**
 * Verifies that a DEPLOYED environment is correctly configured for payments
 * and shipping, by making it do real work against Stripe and ShipEngine.
 *
 * This exists because both failures it catches were silent in production:
 *   - a revoked Stripe secret key only shows up when something tries to
 *     create a PaymentIntent;
 *   - a missing or wrong SHIPENGINE_CARRIER_IDS is hidden by the rate
 *     endpoint's fallback to hardcoded prices, which looks like success.
 *
 * Unlike e2e-deployed-transaction.ts this does not create an order, so it
 * can't race the Stripe webhook that fires at whichever environment the
 * dashboard points to.
 *
 * Usage:
 *   E2E_BASE_URL=https://<deployment> npx tsx scripts/e2e-deployed-config.ts
 *
 * DATABASE_URL must point at the database that deployment uses.
 */
import { prisma } from "@buttergolf/db";
import { cleanupQuietly } from "./e2e-cleanup";
import { getShippingOption, getParcelPreset } from "@buttergolf/constants";
import { createMobileSessionToken } from "../apps/web/src/lib/mobile-session";

const BASE = process.env.E2E_BASE_URL;
if (!BASE) {
  console.error("Set E2E_BASE_URL to the deployment you want to check.");
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
      clerkId: `e2e-cfg-s-${stamp}`,
      email: `e2e-cfg-s-${stamp}@example.com`,
      firstName: "Cfg",
      lastName: "Seller",
    },
  });
  await prisma.address.create({
    data: {
      userId: seller.id,
      name: "Cfg Seller",
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
      clerkId: `e2e-cfg-b-${stamp}`,
      email: `e2e-cfg-b-${stamp}@example.com`,
      firstName: "Cfg",
      lastName: "Buyer",
    },
  });

  const category = await prisma.category.findFirstOrThrow({ where: { slug: "woods" } });
  const preset = getParcelPreset("club-long")!;
  const product = await prisma.product.create({
    data: {
      title: `Config check driver ${stamp}`,
      description: "Config check fixture",
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

  // ---------- Stripe ----------
  const buyerToken = await createMobileSessionToken(buyer.clerkId);
  const option = getShippingOption("express")!;

  const piRes = await fetch(`${BASE}/api/checkout/create-payment-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyerToken}` },
    body: JSON.stringify({ productId: product.id, shippingOptionId: option.id }),
  });
  const pi = (await piRes.json().catch(() => ({}))) as Record<string, unknown>;

  check(
    "Stripe key valid in this environment",
    piRes.ok && typeof pi.paymentIntentId === "string",
    piRes.ok ? String(pi.paymentIntentId) : `HTTP ${piRes.status} ${JSON.stringify(pi)}`
  );

  if (piRes.ok) {
    const expectedPayout = Math.round(product.price * 100);
    check(
      "seller payout excludes shipping (new pricing deployed)",
      pi.productPriceInPence === expectedPayout && pi.shippingAmount === option.priceInPence,
      `item ${pi.productPriceInPence}p + shipping ${pi.shippingAmount}p`
    );
  }

  // ---------- ShipEngine ----------
  const rateRes = await fetch(`${BASE}/api/shipping/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: product.id,
      toAddress: {
        street1: "1 Old Course Road",
        city: "St Andrews",
        state: "Fife",
        zip: "KY16 9SP",
        country: "GB",
      },
    }),
  });
  const rates = (await rateRes.json().catch(() => ({}))) as Record<string, unknown>;

  check("rate endpoint responded", rateRes.ok, `HTTP ${rateRes.status}`);

  if (rateRes.ok) {
    // `fallback: true` means ShipEngine was unreachable, unauthenticated, or
    // returned nothing, and the hardcoded prices were substituted. That looks
    // like success to a buyer, which is exactly why it went unnoticed.
    check(
      "rates came from ShipEngine, not the hardcoded fallback",
      rates.fallback !== true,
      rates.fallback === true
        ? "FELL BACK — carrier IDs or API key wrong in this env"
        : "live rates"
    );

    const list = (rates.rates as Array<Record<string, unknown>>) ?? [];
    check("at least one live rate returned", list.length > 0, `${list.length} rate(s)`);
    for (const r of list.slice(0, 5)) {
      console.log(`        ${r.carrier} | ${r.service} | ${r.rateDisplay} | ${r.estimatedDays}d`);
    }

    const dims = rates.dimensions as Record<string, number> | undefined;
    check(
      "quoted against the real parcel, not the old 30x20x10 default",
      dims?.length === preset.length && dims?.weight === preset.weight,
      dims ? `${dims.length}x${dims.width}x${dims.height}cm @ ${dims.weight}g` : "none"
    );
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`PASSED ${pass.length}   FAILED ${fail.length}`);
  fail.forEach((f) => console.log("  - " + f));
  console.log("=".repeat(60));
  process.exitCode = fail.length ? 1 : 0;
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
