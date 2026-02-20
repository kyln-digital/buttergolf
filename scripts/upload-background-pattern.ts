/**
 * One-time script to upload the Butter Golf branded background pattern to Cloudinary
 *
 * Usage: pnpm tsx scripts/upload-background-pattern.ts
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

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadBackgroundPattern() {
  try {
    console.log("📤 Uploading background pattern to Cloudinary...");

    const imagePath = join(
      process.cwd(),
      "packages/assets/images/image-backgrounds/Butter Golf_Brand identity creation_Bacground pattern 1_BI81_V1.png"
    );
    const imageBuffer = readFileSync(imagePath);
    const base64Image = `data:image/png;base64,${imageBuffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64Image, {
      folder: "backgrounds",
      public_id: "butter-pattern",
      resource_type: "image",
      overwrite: true, // Replace if exists
    });

    console.log("Background pattern uploaded successfully!");
    console.log("📍 Public ID:", result.public_id);
    console.log("🔗 URL:", result.secure_url);
    console.log("📐 Dimensions:", `${result.width}x${result.height}`);
    console.log("\nYou can now use this pattern in product image uploads!");
    console.log(
      "   The upload API will automatically apply it as background after removing the original background."
    );
  } catch (error) {
    console.error("Upload failed:", error);
    process.exit(1);
  }
}

uploadBackgroundPattern();
