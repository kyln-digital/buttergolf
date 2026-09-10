/**
 * Exercises the shipping-readiness gates on POST /api/products against the
 * running dev server, using the app's own mobile-session Bearer auth.
 *
 * These are the gates that stop a listing going live when it can't actually
 * be posted — the failure mode where a buyer pays and the label then fails.
 */
import { prisma } from "@buttergolf/db";
import { cleanupQuietly } from "./e2e-cleanup";
import { createMobileSessionToken } from "../apps/web/src/lib/mobile-session";
import { getParcelPreset, PARCEL_LIMITS } from "@buttergolf/constants";

const BASE = "http://localhost:3000";

const pass: string[] = [];
const fail: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  (ok ? pass : fail).push(label);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function post(token: string, body: unknown) {
  const res = await fetch(`${BASE}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    json: (await res.json().catch(() => ({}))) as Record<string, unknown>,
  };
}

/** Publishing an autosaved draft — the sell form's other publish path. */
async function publishDraft(token: string, productId: string, body: unknown) {
  const res = await fetch(`${BASE}/api/seller/products/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    json: (await res.json().catch(() => ({}))) as Record<string, unknown>,
  };
}

async function main() {
  const stamp = Date.now();
  const clerkId = `e2e-gate-${stamp}`;

  const user = await prisma.user.create({
    data: { clerkId, email: `${clerkId}@example.com`, firstName: "Gate", lastName: "Tester" },
  });
  const category = await prisma.category.findFirstOrThrow({ where: { slug: "woods" } });
  const token = await createMobileSessionToken(clerkId);

  const base = {
    title: "Callaway Paradym Driver",
    description: "Gate test fixture",
    price: 150,
    categoryId: category.id,
    images: ["https://example.com/a.jpg"],
    gripCondition: 8,
    headCondition: 8,
    shaftCondition: 8,
  };

  const club = getParcelPreset("club-long")!;

  // 1. No seller address -> blocked.
  let r = await post(token, { ...base, requestId: `${stamp}-1`, parcelPresetId: club.id });
  check(
    "listing blocked when seller has no postage address",
    r.status === 400 && r.json.code === "SELLER_ADDRESS_REQUIRED",
    `HTTP ${r.status} ${String(r.json.error ?? "")}`
  );

  // 2. Placeholder address -> still blocked. This is the exact row order
  //    creation used to invent, and it guarantees label failure.
  const address = await prisma.address.create({
    data: {
      userId: user.id,
      name: "Gate Tester",
      street1: "Address pending",
      city: "Pending",
      zip: "XX00 0XX",
      country: "GB",
      isDefault: true,
    },
  });
  r = await post(token, { ...base, requestId: `${stamp}-2`, parcelPresetId: club.id });
  check(
    'listing blocked on the "Address pending" placeholder',
    r.status === 400 && r.json.code === "SELLER_ADDRESS_REQUIRED",
    `HTTP ${r.status}`
  );

  await prisma.address.update({
    where: { id: address.id },
    data: {
      street1: "10 Downing Street",
      city: "London",
      state: "Greater London",
      zip: "SW1A 2AA",
      phone: "07700900123",
    },
  });

  // 3. Over-long parcel -> blocked before anyone can buy it.
  r = await post(token, {
    ...base,
    requestId: `${stamp}-3`,
    parcelPresetId: club.id,
    length: PARCEL_LIMITS.maxLengthCm + 30,
    width: 20,
    height: 15,
    weight: 900,
  });
  check(
    "listing blocked when the parcel exceeds the carrier length limit",
    r.status === 400 && r.json.code === "PARCEL_INVALID",
    `HTTP ${r.status} ${String(r.json.error ?? "")}`
  );

  // 4. Over-weight parcel -> blocked.
  r = await post(token, {
    ...base,
    requestId: `${stamp}-4`,
    parcelPresetId: club.id,
    length: 100,
    width: 20,
    height: 15,
    weight: PARCEL_LIMITS.maxWeightG + 5000,
  });
  check(
    "listing blocked when the parcel exceeds the carrier weight limit",
    r.status === 400 && r.json.code === "PARCEL_INVALID",
    `HTTP ${r.status}`
  );

  // 5. Valid preset, no explicit dimensions -> published with preset applied.
  r = await post(token, { ...base, requestId: `${stamp}-5`, parcelPresetId: club.id });
  check(
    "listing accepted with a valid address and parcel",
    r.status === 200 || r.status === 201,
    `HTTP ${r.status}`
  );

  const created = await prisma.product.findFirst({
    where: { userId: user.id, requestId: `${stamp}-5` },
  });
  check(
    "preset dimensions persisted on the listing",
    created?.length === club.length &&
      created?.width === club.width &&
      created?.height === club.height &&
      created?.weight === club.weight,
    created
      ? `${created.length}x${created.width}x${created.height}cm @ ${created.weight}g`
      : "not found"
  );
  check(
    "parcel preset recorded",
    created?.parcelPresetId === club.id,
    created?.parcelPresetId ?? ""
  );

  // 6. Drafts skip both gates — a half-finished listing isn't going anywhere.
  const draftUser = await prisma.user.create({
    data: {
      clerkId: `e2e-draft-${stamp}`,
      email: `e2e-draft-${stamp}@example.com`,
      firstName: "Draft",
      lastName: "Tester",
    },
  });
  const draftToken = await createMobileSessionToken(draftUser.clerkId);
  r = await post(draftToken, {
    ...base,
    requestId: `${stamp}-6`,
    isDraft: true,
    images: [],
  });
  check(
    "draft saves without an address or parcel",
    r.status === 200 || r.status === 201,
    `HTTP ${r.status}`
  );

  // 7. The other publish path. The sell form PATCHes an autosaved draft
  //    rather than POSTing, so the same gates have to hold there or a
  //    listing goes live unpostable.
  const draft = await prisma.product.create({
    data: {
      title: "Draft to publish",
      description: "Publish-path fixture",
      price: 120,
      condition: "GOOD",
      userId: user.id,
      categoryId: category.id,
      isDraft: true,
      images: { create: [{ url: "https://res.cloudinary.com/demo/image/upload/v1/a.jpg" }] },
    },
  });

  const publishBody = {
    title: "Draft to publish",
    description: "Publish-path fixture",
    price: 120,
    categoryId: category.id,
    isDraft: false,
  };

  r = await publishDraft(token, draft.id, publishBody);
  check(
    "publishing a draft is blocked when it has no parcel",
    r.status === 400 && r.json.code === "PARCEL_INVALID",
    `HTTP ${r.status} ${String(r.json.error ?? "")}`
  );

  r = await publishDraft(token, draft.id, { ...publishBody, parcelPresetId: club.id });
  check(
    "publishing a draft succeeds once a parcel is set",
    r.status === 200 || r.status === 201,
    `HTTP ${r.status} ${String(r.json.error ?? "")}`
  );

  const published = await prisma.product.findUnique({ where: { id: draft.id } });
  check("published draft is live", published?.isDraft === false, `isDraft=${published?.isDraft}`);
  check(
    "published draft carries the parcel preset",
    published?.parcelPresetId === club.id,
    published?.parcelPresetId ?? "none"
  );

  console.log(`\n${"=".repeat(60)}`);
  console.log(`PASSED ${pass.length}   FAILED ${fail.length}`);
  if (fail.length) fail.forEach((f) => console.log("  - " + f));
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
