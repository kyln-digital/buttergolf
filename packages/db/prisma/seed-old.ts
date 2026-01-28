import { PrismaClient, ProductCondition } from "../generated/client";
import { CATEGORIES } from "../src/constants/categories";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create three users with different rating profiles
  const user1 = await prisma.user.upsert({
    where: { email: "sarah.johnson@example.com" },
    update: {},
    create: {
      email: "sarah.johnson@example.com",
      name: "Sarah Johnson",
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
      name: "Mike Chen",
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
      name: "Emma Williams",
      clerkId: "user_emma_clerk_id",
      averageRating: 0,
      ratingCount: 0,
    },
  });

  console.log("✅ Created users:", [user1.name, user2.name, user3.name]);

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

  console.log(`✅ Created ${categories.length} categories`);

  // Create sample products with realistic golf equipment
  const driversCategory = categories.find((c) => c.slug === "drivers")!;
  const ironsCategory = categories.find((c) => c.slug === "irons")!;
  const puttersCategory = categories.find((c) => c.slug === "putters")!;
  const wedgesCategory = categories.find((c) => c.slug === "wedges")!;
  const bagsCategory = categories.find((c) => c.slug === "bags")!;
  const ballsCategory = categories.find((c) => c.slug === "balls")!;

  const products = await Promise.all([
    // DRIVERS (6 products)
    prisma.product.create({
      data: {
        title: "TaylorMade Stealth 2 Driver",
        description:
          "Barely used TaylorMade Stealth 2 driver with 10.5° loft. Includes headcover and adjustment tool. Carbon face technology provides incredible distance. Only used for half a season!",
        price: 349.99,
        condition: ProductCondition.EXCELLENT,
        brand: "TaylorMade",
        model: "Stealth 2",
        userId: user1.id,
        categoryId: driversCategory.id,
        images: {
          create: [
            {
              url: "https://sf84lb7mzwzvdsgj.public.blob.vercel-storage.com/products/cmhnfzibd000lr70gl6vchczu-main.jpg",
              sortOrder: 0,
            },
          ],
        },
      },
    }),
    prisma.product.create({
      data: {
        title: "Callaway Rogue ST Max Driver",
        description:
          "Callaway Rogue ST Max driver, 9° loft with stiff flex shaft. Very forgiving driver with AI-designed jailbreak system. Great for mid-handicappers looking to add distance.",
        price: 279.99,
        condition: ProductCondition.LIKE_NEW,
        brand: "Callaway",
        model: "Rogue ST Max",
        userId: user.id,
        categoryId: driversCategory.id,
        images: {
          create: [
            {
              url: "https://sf84lb7mzwzvdsgj.public.blob.vercel-storage.com/products/cmhnfzibd000vr70ggi0mn91p-main.jpg",
              sortOrder: 0,
            },
          ],
        },
      },
    }),

    // Irons
    prisma.product.create({
      data: {
        title: "Titleist T200 Iron Set 5-PW",
        description:
          "Complete set of Titleist T200 irons (5-PW, 6 clubs total). These player-distance irons offer great feel and workability. Regular flex graphite shafts. Grips in excellent condition.",
        price: 699.99,
        condition: ProductCondition.EXCELLENT,
        brand: "Titleist",
        model: "T200",
        userId: user.id,
        categoryId: ironsCategory.id,
        images: {
          create: [
            {
              url: "https://sf84lb7mzwzvdsgj.public.blob.vercel-storage.com/products/cmhnfzibd000hr70gmihwatcq-main.jpg",
              sortOrder: 0,
            },
          ],
        },
      },
    }),
    prisma.product.create({
      data: {
        title: "Callaway Apex Iron Set 4-PW",
        description:
          "Full Callaway Apex iron set including 4-PW (7 clubs). These forged irons provide tour-level performance with added forgiveness. Steel shafts with regular flex.",
        price: 799.99,
        condition: ProductCondition.LIKE_NEW,
        brand: "Callaway",
        model: "Apex",
        userId: user.id,
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
    prisma.product.create({
      data: {
        title: "Ping G425 Irons 5-GW",
        description:
          "Complete Ping G425 iron set with 5-iron through gap wedge (7 clubs). These game-improvement irons are incredibly forgiving. Graphite shafts, regular flex. Perfect for improving your game.",
        price: 649.99,
        condition: ProductCondition.GOOD,
        brand: "Ping",
        model: "G425",
        userId: user.id,
        categoryId: ironsCategory.id,
        images: {
          create: [
            {
              url: "https://sf84lb7mzwzvdsgj.public.blob.vercel-storage.com/products/cmhnfzibd000xr70gyn7w97cz-main.jpg",
              sortOrder: 0,
            },
          ],
        },
      },
    }),

    // Putters
    prisma.product.create({
      data: {
        title: "Scotty Cameron Newport 2 Putter",
        description:
          'Classic Scotty Cameron Newport 2 putter, 34" length. Milled from soft carbon steel with precision weight technology. Some cosmetic wear on sole, but face is pristine. Includes original headcover.',
        price: 279.99,
        condition: ProductCondition.GOOD,
        brand: "Titleist",
        model: "Scotty Cameron Newport 2",
        userId: user.id,
        categoryId: puttersCategory.id,
        images: {
          create: [
            {
              url: "https://sf84lb7mzwzvdsgj.public.blob.vercel-storage.com/products/cmhnfzibd000fr70goajqwv1c-main.jpg",
              sortOrder: 0,
            },
          ],
        },
      },
    }),
    prisma.product.create({
      data: {
        title: "Odyssey White Hot OG Putter",
        description:
          'Odyssey White Hot OG #7 putter with 35" length. The iconic white hot insert provides amazing feel and roll. Blade-style putter perfect for straight-back-straight-through stroke.',
        price: 129.99,
        condition: ProductCondition.EXCELLENT,
        brand: "Odyssey",
        model: "White Hot OG",
        userId: user.id,
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

    // Wedges
    prisma.product.create({
      data: {
        title: "Titleist Vokey SM9 Wedge Set",
        description:
          "Titleist Vokey SM9 wedge set - 52°, 56°, and 60° lofts. Tour-proven spin and control around the greens. F grind on all three. Grooves still sharp, plenty of life left.",
        price: 249.99,
        condition: ProductCondition.EXCELLENT,
        brand: "Titleist",
        model: "Vokey SM9",
        userId: user.id,
        categoryId: wedgesCategory.id,
        images: {
          create: [
            {
              url: "https://sf84lb7mzwzvdsgj.public.blob.vercel-storage.com/products/cmhnfzibd000wr70gtkvh3pul-main.jpg",
              sortOrder: 0,
            },
          ],
        },
      },
    }),
    prisma.product.create({
      data: {
        title: "Cleveland RTX ZipCore Wedge",
        description:
          "Cleveland RTX ZipCore 58° lob wedge with 10° bounce. Low-density core shifts CG for better control. UltiZip grooves for maximum spin. Great for flop shots and bunker play.",
        price: 89.99,
        condition: ProductCondition.LIKE_NEW,
        brand: "Cleveland",
        model: "RTX ZipCore",
        userId: user.id,
        categoryId: wedgesCategory.id,
        images: {
          create: [
            {
              url: "https://sf84lb7mzwzvdsgj.public.blob.vercel-storage.com/products/cmhnfzibd000jr70gg2kytzhw-main.jpg",
              sortOrder: 0,
            },
          ],
        },
      },
    }),

    // Bags
    prisma.product.create({
      data: {
        title: "Ping Hoofer Stand Bag",
        description:
          "Ping Hoofer 14-way stand bag in black. Ultra-lightweight at only 5.5 lbs. 7 pockets including insulated water bottle pocket. Dual auto-deploy legs. The best-selling stand bag in golf!",
        price: 149.99,
        condition: ProductCondition.EXCELLENT,
        brand: "Ping",
        model: "Hoofer",
        userId: user.id,
        categoryId: bagsCategory.id,
        images: {
          create: [
            {
              url: "https://sf84lb7mzwzvdsgj.public.blob.vercel-storage.com/products/cmhnfzibd0011r70gu83v00ug-main.jpg",
              sortOrder: 0,
            },
          ],
        },
      },
    }),
    prisma.product.create({
      data: {
        title: "TaylorMade Cart Bag",
        description:
          "TaylorMade Pro 8.0 cart bag with 14-way top. Tons of storage with 9 pockets. Includes rain hood and insulated cooler pocket. Perfect for riding or push cart use.",
        price: 189.99,
        condition: ProductCondition.LIKE_NEW,
        brand: "TaylorMade",
        model: "Pro 8.0",
        userId: user.id,
        categoryId: bagsCategory.id,
        images: {
          create: [
            {
              url: "https://sf84lb7mzwzvdsgj.public.blob.vercel-storage.com/products/cmhnfzigx001cr70glxkmwvdh-main.jpg",
              sortOrder: 0,
            },
          ],
        },
      },
    }),

    // Golf Balls
    prisma.product.create({
      data: {
        title: "Titleist Pro V1 Golf Balls (Dozen)",
        description:
          "Brand new, sealed dozen of Titleist Pro V1 golf balls. 2024 model with improved core for longer distance. The #1 ball in golf. Perfect for low-handicap players.",
        price: 54.99,
        condition: ProductCondition.NEW,
        brand: "Titleist",
        model: "Pro V1",
        userId: user.id,
        categoryId: ballsCategory.id,
        images: {
          create: [
            {
              url: "https://sf84lb7mzwzvdsgj.public.blob.vercel-storage.com/products/cmhnfzigl0016r70gs581g7th-main.jpg",
              sortOrder: 0,
            },
          ],
        },
      },
    }),
    prisma.product.create({
      data: {
        title: "Callaway Chrome Soft Balls (2 Dozen)",
        description:
          "Two dozen Callaway Chrome Soft golf balls, new in box. Soft feel with amazing greenside control. Great all-around ball for any skill level. White color.",
        price: 84.99,
        condition: ProductCondition.NEW,
        brand: "Callaway",
        model: "Chrome Soft",
        userId: user.id,
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
  ]);

  console.log(`✅ Created ${products.length} sample products`);
  console.log("🌱 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
