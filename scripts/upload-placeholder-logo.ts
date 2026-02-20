/**
 * One-time script to upload the Butter Golf placeholder logo to Cloudinary
 * This logo is used as a fallback when product images are not available
 *
 * Usage: pnpm tsx scripts/upload-placeholder-logo.ts
 */

/* eslint-disable unicorn/prefer-top-level-await */

import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Load environment variables from apps/web/.env.local
dotenv.config({ path: resolve(__dirname, "../apps/web/.env.local") });

// Verify Cloudinary credentials are loaded
if (
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET ||
  !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
) {
  console.error("Error: Cloudinary credentials not found in environment");
  console.error("Make sure apps/web/.env.local contains:");
  console.error("  - NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
  console.error("  - CLOUDINARY_API_KEY");
  console.error("  - CLOUDINARY_API_SECRET");
  process.exit(1);
}

console.log("Cloudinary credentials loaded");
console.log(`  Cloud name: ${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}`);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadPlaceholderLogo() {
  try {
    console.log("📤 Uploading placeholder logo to Cloudinary...");

    const imagePath = join(
      process.cwd(),
      "packages/assets/Butter Golf Logos/PNGs/Butter golf logos-01.png"
    );

    console.log(`  Reading from: ${imagePath}`);

    const imageBuffer = readFileSync(imagePath);
    const base64Image = `data:image/png;base64,${imageBuffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64Image, {
      folder: "placeholders",
      public_id: "product-placeholder",
      resource_type: "image",
      overwrite: true, // Replace if exists
    });

    console.log("\nPlaceholder logo uploaded successfully!");
    console.log("📍 Public ID:", result.public_id);
    console.log("🔗 URL:", result.secure_url);
    console.log("📐 Dimensions:", `${result.width}x${result.height}`);
    console.log("\nAdd this URL to packages/constants/src/images.ts as PLACEHOLDER_IMAGE_URL");
    console.log(`   export const PLACEHOLDER_IMAGE_URL = "${result.secure_url}";`);
  } catch (error) {
    console.error("Upload failed:", error);
    process.exit(1);
  }
}

uploadPlaceholderLogo();
