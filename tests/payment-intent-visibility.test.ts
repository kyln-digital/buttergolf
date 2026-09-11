import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Source-guard for buttergolf#521 tip finding (KYL-1798 / KYL-1796):
 * create-payment-intent must refuse draft products and deleted sellers
 * at query time — same public visibility as listings.
 */
describe("create-payment-intent public visibility", () => {
  const source = readFileSync(
    resolve(__dirname, "../apps/web/src/app/api/checkout/create-payment-intent/route.ts"),
    "utf8"
  );

  it("scopes product lookup with findFirst (not findUnique by id alone)", () => {
    expect(source).toMatch(/prisma\.product\.findFirst\s*\(/);
    expect(source).not.toMatch(/prisma\.product\.findUnique\s*\(/);
  });

  it("requires isDraft: false on the product where clause", () => {
    expect(source).toMatch(/isDraft:\s*false/);
  });

  it("uses the shared public seller filter and excludes staff takedowns", () => {
    // The deleted-seller rule moved into PUBLIC_SELLER_FILTER (lib/listings.ts)
    // when suspension and hidden listings were added, so every public query
    // shares one definition. Guard both the use and the definition.
    expect(source).toMatch(/user:\s*PUBLIC_SELLER_FILTER/);
    expect(source).toMatch(/hiddenAt:\s*null/);

    const listings = readFileSync(resolve(__dirname, "../apps/web/src/lib/listings.ts"), "utf8");
    expect(listings).toMatch(
      /PUBLIC_SELLER_FILTER[^=]*=\s*\{\s*is:\s*\{\s*isDeleted:\s*false,\s*suspendedAt:\s*null\s*\}/
    );
  });
});
