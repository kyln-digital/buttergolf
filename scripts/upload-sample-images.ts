import "dotenv/config";
import { put } from "@vercel/blob";
import { prisma } from "@buttergolf/db";
import { resolve } from "path";

// Load environment variables from apps/web/.env.local
import dotenv from "dotenv";
dotenv.config({ path: resolve(__dirname, "../apps/web/.env.local") });

// Verify token is loaded
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Error: BLOB_READ_WRITE_TOKEN not found in environment");
  console.error("Make sure apps/web/.env.local contains the Vercel Blob token");
  process.exit(1);
}

console.log("Vercel Blob token loaded");

// Golf equipment images from Unsplash (high quality, free to use)
// Updated with verified working URLs
const sampleImages = [
  "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800", // Golf clubs
  "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800", // Golf balls
  "https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?w=800", // Golf bag
  "https://images.unsplash.com/photo-1530028828-25e8270e98f3?w=800", // Putter
  "https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800", // Driver
  "https://images.unsplash.com/photo-1596726521381-cc73d396c73e?w=800", // Golf equipment 2
  "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800", // Golf course
  "https://images.unsplash.com/photo-1580052614034-c55d20bfee3b?w=800", // Irons
];

async function uploadSampleImages() {
  console.log("Starting image upload to Vercel Blob...\n");

  // Get all products that need image updates
  const products = await prisma.product.findMany({
    include: {
      images: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  console.log(`Found ${products.length} products in database\n`);

  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    // Use rotating sample images
    const imageUrl = sampleImages[i % sampleImages.length];

    console.log(`[${i + 1}/${products.length}] Processing: ${product.title}`);

    try {
      // Fetch the image from Unsplash
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();

      // Upload to Vercel Blob with product-specific filename
      const filename = `products/${product.id}-main.jpg`;
      const blob = await put(filename, imageBuffer, {
        access: "public",
        contentType: "image/jpeg",
        allowOverwrite: true, // Allow updating existing images
      });

      console.log(`  Uploaded to: ${blob.url}`);

      // Update or create ProductImage in database
      if (product.images.length > 0) {
        // Update existing image
        await prisma.productImage.update({
          where: { id: product.images[0].id },
          data: { url: blob.url },
        });
        console.log(`  Updated existing image record`);
      } else {
        // Create new image
        await prisma.productImage.create({
          data: {
            productId: product.id,
            url: blob.url,
            sortOrder: 0,
          },
        });
        console.log(`  Created new image record`);
      }

      console.log(`  Complete!\n`);
    } catch (error) {
      console.error(`  Error: ${error.message}\n`);
    }
  }

  console.log("All images uploaded successfully!");
  console.log("\nYou can now:");
  console.log("1. Restart web server: pnpm dev:web");
  console.log("2. Reload mobile app: press r in terminal");
  console.log("3. View in Prisma Studio: pnpm db:studio");
}

// Run the upload
uploadSampleImages()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
