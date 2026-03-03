import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

/**
 * Extracts the Cloudinary public_id from a secure_url.
 * Handles optional transformation segments between /upload/ and the version/folder.
 * e.g. "https://res.cloudinary.com/x/image/upload/v123/products/abc.jpg"           → "products/abc"
 *      "https://res.cloudinary.com/x/image/upload/e_background_removal/v123/p/a.jpg" → "p/a"
 */
export function extractPublicId(url: string): string | null {
  try {
    // Strip everything up to and including /upload/, then remove transformation
    // segments (key:value or key_value comma-separated) before the version or folder.
    const afterUpload = url.split("/upload/")[1];
    if (!afterUpload) return null;

    const segments = afterUpload.split("/");

    // Drop leading segments that are transformations (contain commas, colons,
    // underscores with letters on both sides — e.g. e_background_removal,b_rgb:FFFAD2)
    // or version numbers (v followed by digits).
    let startIdx = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (/^v\d+$/.test(seg) || /[,:]/.test(seg) || /^[a-z]_/.test(seg)) {
        startIdx = i + 1;
      } else {
        break;
      }
    }

    const pathWithExt = segments.slice(startIdx).join("/");
    // Remove file extension
    const dotIdx = pathWithExt.lastIndexOf(".");
    return dotIdx > 0 ? pathWithExt.slice(0, dotIdx) : pathWithExt;
  } catch {
    return null;
  }
}

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

/** Validates that a URL is a Cloudinary image URL belonging to this cloud */
export function isValidCloudinaryUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "res.cloudinary.com" &&
      parsed.pathname.includes("/image/upload/") &&
      (CLOUD_NAME === "" || parsed.pathname.includes(`/${CLOUD_NAME}/`))
    );
  } catch {
    return false;
  }
}
