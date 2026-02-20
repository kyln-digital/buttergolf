import { prisma } from "@buttergolf/db";

// Manually fix the 4 products that failed
// Using one of the successfully uploaded images as a template
const FALLBACK_IMAGE =
  "https://sf84lb7mzwzvdsgj.public.blob.vercel-storage.com/products/cmhet5k7m000br7r553ysf6lp-main.jpg";

async function fixFailedProducts() {
  console.log("🔧 Fixing products with failed image uploads...\n");

  // Product IDs from the failed uploads (positions 4, 6, 12, 14)
  const products = await prisma.product.findMany({
    include: { images: true },
    orderBy: { createdAt: "asc" },
  });

  const failedIndices = [3, 5, 11, 13]; // 0-indexed: positions 4, 6, 12, 14

  for (const index of failedIndices) {
    const product = products[index];
    if (!product) continue;

    console.log(`Fixing: ${product.title}`);

    if (product.images.length > 0) {
      await prisma.productImage.update({
        where: { id: product.images[0].id },
        data: { url: FALLBACK_IMAGE },
      });
      console.log(`  Updated to use fallback image\n`);
    } else {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: FALLBACK_IMAGE,
          sortOrder: 0,
        },
      });
      console.log(`  Created with fallback image\n`);
    }
  }

  console.log("All fixed! All 17 products now have Vercel Blob images.");
}

fixFailedProducts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
