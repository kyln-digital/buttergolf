/**
 * Helpers for accepting the image formats sellers actually have to hand.
 *
 * Photos taken on an iPhone and copied to a laptop arrive as HEIC. No browser
 * except Safari can decode HEIC, so the crop step (which renders the file in an
 * <img>) breaks on it. We convert HEIC to JPEG in the browser before anything
 * else touches the file, so the rest of the upload pipeline only ever sees
 * formats it already understands.
 */

/** JPEG quality used when transcoding HEIC. Matches the crop step's output. */
const HEIC_JPEG_QUALITY = 0.92;

/**
 * Largest file the upload pipeline accepts, matching the limit shown on the
 * upload area. Checked against the *picked* file before any decoding, so a
 * huge HEIC can't be handed to libheif and freeze the seller's tab.
 */
export const MAX_UPLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Human-readable form of {@link MAX_UPLOAD_FILE_SIZE_BYTES}. */
export const MAX_UPLOAD_FILE_SIZE_LABEL = "10MB";

/**
 * Every MIME type that counts as HEIC/HEIF. Declared once so the client-side
 * detection and the server-side allow-list can't disagree about, say, whether a
 * burst shot is supported.
 */
const HEIC_MIME_TYPES_LIST = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
] as const;

/**
 * MIME types accepted by the upload pipeline, shared by the client-side hook
 * and the `/api/upload` route so the two can't drift apart.
 *
 * HEIC is included because mobile posts the original file straight to the API;
 * Cloudinary decodes it server-side. The web flow converts to JPEG in the
 * browser first (see `normaliseImageFile`) so the cropper can display it.
 */
export const ALLOWED_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  // Kept in step with HEIC_MIME_TYPES below — the sequence type included, since
  // a burst shot is detected as HEIC client-side and would otherwise be
  // rejected by the API on the direct (mobile) upload path.
  ...HEIC_MIME_TYPES_LIST,
] as const;

/** True when `contentType` is an image format the upload pipeline accepts. */
export function isAllowedUploadType(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  // Strip any charset/boundary parameters before comparing.
  const mime = contentType.split(";")[0].trim().toLowerCase();
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(mime);
}

const HEIC_MIME_TYPES = new Set<string>(HEIC_MIME_TYPES_LIST);
const HEIC_EXTENSIONS = [".heic", ".heif"];

/**
 * True when a file is HEIC/HEIF.
 *
 * The extension check is not redundant: Windows and most Linux desktops have no
 * HEIC MIME mapping, so Chrome reports `type: ""` for a `.heic` file picked from
 * disk. Sniffing the name is the only reliable signal in that case.
 */
export function isHeicFile(file: File): boolean {
  if (HEIC_MIME_TYPES.has(file.type.toLowerCase())) {
    return true;
  }

  const name = file.name.toLowerCase();
  return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/** Swaps a filename's extension for `.jpg`. */
function toJpegFilename(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "") + ".jpg";
}

/**
 * Returns a file the browser can decode, converting HEIC to JPEG when needed.
 * Non-HEIC files are passed straight through untouched.
 *
 * heic2any bundles libheif and is well over a megabyte, so it is imported
 * dynamically — sellers uploading JPEGs never pay for it.
 *
 * @throws if the file is HEIC but cannot be decoded.
 */
export async function normaliseImageFile(file: File): Promise<File> {
  if (!isHeicFile(file)) {
    return file;
  }

  const { default: heic2any } = await import("heic2any");

  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: HEIC_JPEG_QUALITY,
  });

  // heic2any returns an array for multi-image HEICs (e.g. burst shots); the
  // first frame is the one the user saw in their photo library.
  const blob = Array.isArray(converted) ? converted[0] : converted;

  return new File([blob], toJpegFilename(file.name), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}
