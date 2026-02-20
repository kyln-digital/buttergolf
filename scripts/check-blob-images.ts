#!/usr/bin/env tsx
/**
 * Check Vercel Blob storage for existing images
 * Run: npx tsx scripts/check-blob-images.ts
 */

import { list } from "@vercel/blob";

async function checkBlobImages() {
  try {
    console.log("🔍 Checking Vercel Blob storage...\n");

    const { blobs } = await list();

    if (blobs.length === 0) {
      console.log("No images found in Vercel Blob storage");
      console.log("\n📝 Next steps:");
      console.log("1. Upload product images to Vercel Blob");
      console.log("2. Update the seed file with real Vercel Blob URLs");
      console.log("3. Re-run pnpm db:seed\n");
      return;
    }

    console.log(`Found ${blobs.length} blobs in storage:\n`);

    blobs.forEach((blob, index) => {
      console.log(`${index + 1}. ${blob.pathname}`);
      console.log(`   URL: ${blob.url}`);
      console.log(`   Size: ${(blob.size / 1024).toFixed(2)} KB`);
      console.log(`   Uploaded: ${new Date(blob.uploadedAt).toLocaleString()}\n`);
    });

    console.log("\nCopy these URLs to update your seed file!");
  } catch (error) {
    console.error("Error:", error);
    console.log("\nMake sure BLOB_READ_WRITE_TOKEN is set in .env.local");
  }
}

checkBlobImages();
