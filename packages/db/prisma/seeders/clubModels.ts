import { PrismaClient } from "../../generated/client";
import { ClubKind } from "../../generated/client";
import { readFileSync } from "fs";
import { join } from "path";

interface ClubModelFixture {
  brand: string;
  models: string[];
}

interface ClubModelsData {
  drivers: ClubModelFixture[];
  fairwayWoods: ClubModelFixture[];
  hybrids: ClubModelFixture[];
  ironSets: ClubModelFixture[];
  wedges: ClubModelFixture[];
  putters: ClubModelFixture[];
  balls: ClubModelFixture[];
  bags: ClubModelFixture[];
  apparel: ClubModelFixture[];
  accessories: ClubModelFixture[];
}

const categoryToClubKind: Record<keyof ClubModelsData, ClubKind> = {
  drivers: ClubKind.DRIVER,
  fairwayWoods: ClubKind.FAIRWAY_WOOD,
  hybrids: ClubKind.HYBRID,
  ironSets: ClubKind.IRON_SET,
  wedges: ClubKind.WEDGE,
  putters: ClubKind.PUTTER,
  balls: ClubKind.BALL,
  bags: ClubKind.BAG,
  apparel: ClubKind.APPAREL,
  accessories: ClubKind.ACCESSORY,
};

/**
 * Seed ClubModel reference data for product upload dropdowns
 *
 * This populates the ClubModel table with verified equipment models that users
 * can select when listing their products. Includes historic and current models
 * across all major brands and categories.
 *
 * usageCount is never written here beyond the initial zero: it is listing-derived
 * (POST /api/products increments it) and ranks autocomplete suggestions, so
 * seeding a value would present models nobody has listed as popular.
 */
export async function seedClubModels(
  prisma: PrismaClient
): Promise<{ seeded: number; skipped: number }> {
  console.info("Seeding club models...");

  // Load fixture data
  const fixturesPath = join(__dirname, "../fixtures/clubModels.json");
  const fixtureData = JSON.parse(readFileSync(fixturesPath, "utf-8")) as ClubModelsData;

  // Get all brands from database for slug lookup
  const brands = await prisma.brand.findMany();
  const brandMap = new Map(brands.map((b) => [b.slug, b]));

  let totalCreated = 0;
  let totalSkipped = 0;

  // Process each category
  for (const [category, clubKind] of Object.entries(categoryToClubKind)) {
    const fixtures = fixtureData[category as keyof ClubModelsData];
    if (!fixtures) continue;

    console.info(`\n  Processing ${category}...`);

    for (const fixture of fixtures) {
      const brand = brandMap.get(fixture.brand);
      if (!brand) {
        console.warn(`     Brand not found: ${fixture.brand}`);
        totalSkipped += fixture.models.length;
        continue;
      }

      // Process each model for this brand
      for (const modelName of fixture.models) {
        try {
          await prisma.clubModel.upsert({
            where: {
              brandId_name_kind: {
                brandId: brand.id,
                name: modelName,
                kind: clubKind,
              },
            },
            // usageCount is deliberately absent here. It is live data: creating a
            // listing increments it (see POST /api/products), and it both ranks
            // autocomplete suggestions and auto-verifies a model at 3+ uses.
            // Writing the seed heuristic on update would erase real counts every
            // time this runs against an existing database.
            update: {
              isVerified: true,
            },
            create: {
              brandId: brand.id,
              name: modelName,
              kind: clubKind,
              isVerified: true,
              // Starts at zero: nobody has listed this model yet, and usageCount
              // means exactly one thing — how many listings reference it.
              usageCount: 0,
            },
          });

          totalCreated++;
        } catch (error) {
          console.error(`    Error creating ${brand.name} ${modelName}: ${error}`);
          totalSkipped++;
        }
      }
    }
  }

  console.info(
    `\nClub models seeding complete: ${totalCreated} created/updated, ${totalSkipped} skipped`
  );

  return { seeded: totalCreated, skipped: totalSkipped };
}
