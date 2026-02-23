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
 */
export async function seedClubModels(prisma: PrismaClient) {
  console.log("Seeding club models...");

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

    console.log(`\n  Processing ${category}...`);

    for (const fixture of fixtures) {
      const brand = brandMap.get(fixture.brand);
      if (!brand) {
        console.warn(`     Brand not found: ${fixture.brand}`);
        continue;
      }

      // Process each model for this brand
      for (const modelName of fixture.models) {
        try {
          // Calculate usage count based on popularity heuristics
          const usageCount = calculateUsageCount(modelName);

          await prisma.clubModel.upsert({
            where: {
              brandId_name_kind: {
                brandId: brand.id,
                name: modelName,
                kind: clubKind,
              },
            },
            update: {
              isVerified: true,
              usageCount,
            },
            create: {
              brandId: brand.id,
              name: modelName,
              kind: clubKind,
              isVerified: true,
              usageCount,
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

  console.log(
    `\nClub models seeding complete: ${totalCreated} created/updated, ${totalSkipped} skipped`
  );
}

/**
 * Calculate realistic usage count for autocomplete ranking
 *
 * Popular/current models get higher counts, older/discontinued models get lower counts.
 * This affects the order of suggestions in autocomplete dropdowns.
 */
function calculateUsageCount(modelName: string): number {
  const name = modelName.toLowerCase();

  // Current generation models (high usage)
  if (
    name.includes("2024") ||
    name.includes("2025") ||
    name.includes("2026") ||
    name.includes("qi10") ||
    name.includes("gt") ||
    name.includes("paradym") ||
    name.includes("g430") ||
    name.includes("ai smoke") ||
    name.includes("darkspeed") ||
    name.includes("sm10") ||
    name.includes("sm9")
  ) {
    return Math.floor(Math.random() * 50) + 150; // 150-200 uses
  }

  // Recent generation (medium-high usage)
  if (
    name.includes("2023") ||
    name.includes("stealth") ||
    name.includes("tsr") ||
    name.includes("g425") ||
    name.includes("rogue st") ||
    name.includes("ltdx") ||
    name.includes("sm8") ||
    name.includes("zx")
  ) {
    return Math.floor(Math.random() * 50) + 100; // 100-150 uses
  }

  // Previous generation (medium usage)
  if (
    name.includes("2022") ||
    name.includes("2021") ||
    name.includes("sim") ||
    name.includes("tsi") ||
    name.includes("epic") ||
    name.includes("mavrik") ||
    name.includes("g410") ||
    name.includes("sm7") ||
    name.includes("t100") ||
    name.includes("t200")
  ) {
    return Math.floor(Math.random() * 40) + 60; // 60-100 uses
  }

  // Older but popular models (medium-low usage)
  if (
    name.includes("2020") ||
    name.includes("2019") ||
    name.includes("m") ||
    name.includes("ts") ||
    name.includes("917") ||
    name.includes("g400") ||
    name.includes("sm6") ||
    name.includes("pro v1")
  ) {
    return Math.floor(Math.random() * 30) + 30; // 30-60 uses
  }

  // Legacy/discontinued (low usage)
  if (
    name.includes("2018") ||
    name.includes("2017") ||
    name.includes("2016") ||
    name.includes("2015")
  ) {
    return Math.floor(Math.random() * 20) + 10; // 10-30 uses
  }

  // Historic models (very low usage)
  return Math.floor(Math.random() * 10) + 1; // 1-10 uses
}
