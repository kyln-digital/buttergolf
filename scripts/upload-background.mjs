import { v2 as cloudinary } from "cloudinary";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from apps/web/.env.local
config({ path: resolve(process.cwd(), "apps/web/.env.local") });

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const imagePath =
  "./packages/assets/images/image-backgrounds/Butter Golf_Website brand tiles_BI81_V1_AW-01.jpg";

console.log("Uploading background image to Cloudinary...");
console.log("Image path:", imagePath);

try {
  const result = await cloudinary.uploader.upload(imagePath, {
    folder: "backgrounds",
    public_id: "butter-pattern-tiles",
    resource_type: "image",
    overwrite: true,
  });

  console.log("\nUpload successful!");
  console.log("Public ID:", result.public_id);
  console.log("Secure URL:", result.secure_url);
  console.log("Dimensions:", result.width + "x" + result.height);
  console.log("\nUse this in your code:");
  console.log('  underlay: "backgrounds:butter-pattern-tiles"');
} catch (error) {
  console.error("Upload failed:", error.message);
  process.exit(1);
}
