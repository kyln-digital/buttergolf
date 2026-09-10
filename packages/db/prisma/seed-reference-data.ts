import path from "node:path";
import { config } from "dotenv";

// Load packages/db/.env before the client reads DATABASE_URL, matching prisma.config.ts.
// Point that file at the target environment first, e.g.
//   vercel env pull packages/db/.env --environment=production
config({ path: path.join(__dirname, "..", ".env") });

import { PrismaClient } from "../generated/client";
import { BRANDS } from "../src/constants/brands";
import { seedClubModels } from "./seeders/clubModels";

const prisma = new PrismaClient();

/**
 * Seed reference data only: brands and their club models.
 *
 * Unlike `db:seed`, this creates no users or sample products, so it is safe to
 * run against any environment. Every write is an upsert keyed on a natural key,
 * so re-running it adds new entries and refreshes existing ones without
 * duplicating anything.
 */
async function main() {
  console.info("Seeding reference data...");

  const brands = await Promise.all(
    BRANDS.map((brandDef) =>
      prisma.brand.upsert({
        where: { slug: brandDef.slug },
        update: {
          name: brandDef.name,
          logoUrl: brandDef.logoUrl,
          sortOrder: brandDef.sortOrder,
        },
        create: brandDef,
      })
    )
  );

  console.info(`Created/updated ${brands.length} brands`);

  const { skipped } = await seedClubModels(prisma);

  // Exit non-zero on a partial seed so a failed run against production is not
  // mistaken for a clean one; the per-model errors are logged above.
  if (skipped > 0) {
    throw new Error(`Reference seed incomplete: ${skipped} club model(s) could not be written`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
