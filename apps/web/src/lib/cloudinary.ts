import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

/**
 * Extracts the Cloudinary public_id from a secure_url.
 * e.g. "https://res.cloudinary.com/x/image/upload/v123/products/abc.jpg"
 *   → "products/abc"
 */
export function extractPublicId(url: string): string | null {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Validates that a URL is a Cloudinary image URL for this cloud */
export function isValidCloudinaryUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "res.cloudinary.com" && parsed.pathname.includes("/image/upload/");
  } catch {
    return false;
  }
}
