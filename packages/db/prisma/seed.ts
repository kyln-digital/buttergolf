import { PrismaClient, ProductCondition } from "../generated/client";
import { CATEGORIES } from "@buttergolf/constants";
import { BRANDS } from "../src/constants/brands";
import { seedClubModels } from "./seeders/clubModels";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create three users with different rating profiles
  const user1 = await prisma.user.upsert({
    where: { email: "sarah.johnson@example.com" },
    update: {},
    create: {
      email: "sarah.johnson@example.com",
      firstName: "Sarah",
      lastName: "Johnson",
      clerkId: "user_sarah_clerk_id",
      averageRating: 4.8,
      ratingCount: 47,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "mike.chen@example.com" },
    update: {},
    create: {
      email: "mike.chen@example.com",
      firstName: "Mike",
      lastName: "Chen",
      clerkId: "user_mike_clerk_id",
      averageRating: 4.2,
      ratingCount: 23,
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: "emma.williams@example.com" },
    update: {},
    create: {
      email: "emma.williams@example.com",
      firstName: "Emma",
      lastName: "Williams",
      clerkId: "user_emma_clerk_id",
      averageRating: 0,
      ratingCount: 0,
    },
  });

  console.log("Created users:", [
    `${user1.firstName} ${user1.lastName}`,
    `${user2.firstName} ${user2.lastName}`,
    `${user3.firstName} ${user3.lastName}`,
  ]);

  // Create categories from centralized constants
  const categories = await Promise.all(
    CATEGORIES.map((categoryDef) =>
      prisma.category.upsert({
        where: { slug: categoryDef.slug },
        update: {
          name: categoryDef.name,
          description: categoryDef.description,
          imageUrl: categoryDef.imageUrl,
          sortOrder: categoryDef.sortOrder,
        },
        create: categoryDef,
      })
    )
  );

  console.log(`Created ${categories.length} categories`);

  // Create brands from centralized constants
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

  console.log(`Created ${brands.length} brands`);

  // Seed club models for product upload dropdowns
  await seedClubModels(prisma);

  // Get category references
  const woodsCategory = categories.find((c) => c.slug === "woods")!;
  const ironsCategory = categories.find((c) => c.slug === "irons")!;
  const wedgesCategory = categories.find((c) => c.slug === "wedges")!;
  const puttersCategory = categories.find((c) => c.slug === "putters")!;
  const bagsCategory = categories.find((c) => c.slug === "bags")!;
  const ballsCategory = categories.find((c) => c.slug === "balls")!;
  const accessoriesCategory = categories.find((c) => c.slug === "accessories")!;
  const apparelCategory = categories.find((c) => c.slug === "apparel")!;

  // Get brand references
  const taylorMade = brands.find((b) => b.slug === "taylormade")!;
  const callaway = brands.find((b) => b.slug === "callaway")!;
  const titleist = brands.find((b) => b.slug === "titleist")!;
  const ping = brands.find((b) => b.slug === "ping")!;
  const cobra = brands.find((b) => b.slug === "cobra")!;
  const mizuno = brands.find((b) => b.slug === "mizuno")!;
  const srixon = brands.find((b) => b.slug === "srixon")!;
  const wilson = brands.find((b) => b.slug === "wilson")!;
  const cleveland = brands.find((b) => b.slug === "cleveland")!;
  const odyssey = brands.find((b) => b.slug === "odyssey")!;
  const footjoy = brands.find((b) => b.slug === "footjoy")!;
  const sunMountain = brands.find((b) => b.slug === "sun-mountain")!;
  const nike = brands.find((b) => b.slug === "nike")!;
  const adidas = brands.find((b) => b.slug === "adidas")!;

  // Create a few sample products for UI testing (users will create real marketplace inventory)
  const products = await Promise.all([
    // Driver - TaylorMade
    prisma.product.create({
      data: {
        title: "TaylorMade Stealth 2 Driver",
        description:
          "Barely used TaylorMade Stealth 2 driver with 10.5° loft. Includes headcover and adjustment tool. Regular flex shaft, great condition.",
        price: 349.99,
        condition: ProductCondition.EXCELLENT,
        brandId: taylorMade.id,
        model: "Stealth 2",
        loft: "10.5°",
        flex: "Regular",
        userId: user1.id,
        categoryId: woodsCategory.id,
        images: {
          create: [
            {
              url: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800",
              sortOrder: 0,
            },
          ],
        },
      },
    }),
    // Iron Set - Titleist
    prisma.product.create({
      data: {
        title: "Titleist T200 Irons (5-PW)",
        description:
          "Titleist T200 irons, 5-PW. Excellent distance and forgiveness for better players. Steel shafts.",
        price: 849.99,
        condition: ProductCondition.LIKE_NEW,
        brandId: titleist.id,
        model: "T200",
        flex: "Stiff",
        userId: user2.id,
        categoryId: ironsCategory.id,
        images: {
          create: [
            {
              url: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800",
              sortOrder: 0,
            },
          ],
        },
      },
    }),
    // Wedge - Titleist Vokey
    prisma.product.create({
      data: {
        title: "Titleist Vokey SM9 Wedge",
        description:
          "Titleist Vokey SM9 56° sand wedge with 10° bounce. F grind, perfect for versatile shots around the green.",
        price: 119.99,
        condition: ProductCondition.EXCELLENT,
        brandId: titleist.id,
        model: "Vokey SM9",
        loft: "56°",
        userId: user1.id,
        categoryId: wedgesCategory.id,
        images: {
          create: [
            {
              url: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800",
              sortOrder: 0,
            },
          ],
        },
      },
    }),
    // Putter - Odyssey
    prisma.product.create({
      data: {
        title: "Odyssey White Hot OG 2-Ball Putter",
        description:
          "Classic Odyssey 2-Ball putter with White Hot insert. 34 inch length, excellent feel and alignment.",
        price: 159.99,
        condition: ProductCondition.GOOD,
        brandId: odyssey.id,
        model: "White Hot OG 2-Ball",
        userId: user3.id,
        categoryId: puttersCategory.id,
        images: {
          create: [
            {
              url: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800",
              sortOrder: 0,
            },
          ],
        },
      },
    }),
    // Golf Balls - Titleist
    prisma.product.create({
      data: {
        title: "Titleist Pro V1 Golf Balls (Dozen)",
        description:
          "Brand new dozen of Titleist Pro V1 golf balls. 2024 model with improved aerodynamics.",
        price: 54.99,
        condition: ProductCondition.NEW,
        brandId: titleist.id,
        model: "Pro V1",
        userId: user2.id,
        categoryId: ballsCategory.id,
        images: {
          create: [
            {
              url: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800",
              sortOrder: 0,
            },
          ],
        },
      },
    }),
    // Golf Bag - Ping
    prisma.product.create({
      data: {
        title: "Ping Hoofer Stand Bag",
        description:
          "Ping Hoofer stand bag in black. 14-way top, 8 pockets, comfortable straps. Perfect for walking rounds.",
        price: 179.99,
        condition: ProductCondition.EXCELLENT,
        brandId: ping.id,
        model: "Hoofer",
        userId: user1.id,
        categoryId: bagsCategory.id,
        images: {
          create: [
            {
              url: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800",
              sortOrder: 0,
            },
          ],
        },
      },
    }),
    // Golf Glove - FootJoy
    prisma.product.create({
      data: {
        title: "FootJoy StaSof Glove (3-Pack)",
        description:
          "FootJoy StaSof cabretta leather gloves. Size: Medium-Large. Pack of 3, never opened.",
        price: 32.99,
        condition: ProductCondition.NEW,
        brandId: footjoy.id,
        model: "StaSof",
        userId: user2.id,
        categoryId: accessoriesCategory.id,
        images: {
          create: [
            {
              url: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800",
              sortOrder: 0,
            },
          ],
        },
      },
    }),
    // Golf Shoes - Adidas
    prisma.product.create({
      data: {
        title: "Adidas CodeChaos 22 Golf Shoes",
        description:
          "Adidas CodeChaos 22 spikeless golf shoes. Size 10.5, white/grey colorway. Lightly worn, excellent grip.",
        price: 129.99,
        condition: ProductCondition.LIKE_NEW,
        brandId: adidas.id,
        model: "CodeChaos 22",
        userId: user3.id,
        categoryId: apparelCategory.id,
        images: {
          create: [
            {
              url: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800",
              sortOrder: 0,
            },
          ],
        },
      },
    }),
  ]);

  console.log(`Created ${products.length} sample products`);
  console.log("🌱 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
