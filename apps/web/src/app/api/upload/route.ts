import { v2 as cloudinary, UploadApiOptions } from "cloudinary";
import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  logError,
  logWarning,
  UPLOAD_CLOUDINARY_CONFIG_MISSING,
  UPLOAD_FAILED,
  UPLOAD_BACKGROUND_REMOVAL_FAILED,
  UPLOAD_CONVERSION_FAILED,
  PRODUCT_IMAGE_ASPECT_RATIO,
} from "@buttergolf/constants";

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

function getAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");

  // React Native requests generally don't send Origin, and same-origin requests don't need CORS.
  if (!origin) return null;

  if (ALLOWED_ORIGINS.length === 0) {
    return null;
  }

  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

function getCorsHeaders(request: Request): Record<string, string> {
  const allowedOrigin = getAllowedOrigin(request);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

export async function POST(request: Request): Promise<NextResponse> {
  const corsHeaders = getCorsHeaders(request);
  let userId: string | null = null;

  // Check if Cloudinary is configured
  if (
    !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    logError(
      "Cloudinary configuration missing",
      new Error("Missing required environment variables"),
      {
        errorId: UPLOAD_CLOUDINARY_CONFIG_MISSING,
        missingVars: {
          cloudName: !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
          apiKey: !process.env.CLOUDINARY_API_KEY,
          apiSecret: !process.env.CLOUDINARY_API_SECRET,
        },
      }
    );

    return NextResponse.json(
      {
        error:
          "Image upload is not configured. Please add Cloudinary credentials to your environment variables.",
        details:
          "Required: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET",
      },
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    // Authenticate user (supports both web cookies and mobile Bearer token)
    userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }
  } catch (authError) {
    // Authentication system failure (not just "unauthorized")
    logError("Authentication failed during upload", authError, {
      errorId: UPLOAD_FAILED,
      stage: "authentication",
    });

    return NextResponse.json(
      {
        error: "Authentication error",
        message: "Unable to verify your identity. Please try again later.",
      },
      { status: 500, headers: corsHeaders }
    );
  }

  // Get the file from the request
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  const isFirstImage = searchParams.get("isFirstImage") === "true";

  if (!filename) {
    return NextResponse.json(
      { error: "Filename is required" },
      { status: 400, headers: corsHeaders }
    );
  }

  // Validate file type (images only)
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  const contentType = request.headers.get("content-type");

  if (!contentType || !allowedTypes.includes(contentType)) {
    return NextResponse.json(
      { error: "Invalid file type. Only images are allowed." },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    // Convert request body to base64 for Cloudinary upload
    let arrayBuffer: ArrayBuffer;
    let buffer: Buffer;
    let base64Image: string;

    try {
      arrayBuffer = await request.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      base64Image = `data:${contentType};base64,${buffer.toString("base64")}`;
    } catch (conversionError) {
      logError("Failed to convert request body to base64", conversionError, {
        errorId: UPLOAD_CONVERSION_FAILED,
        userId,
        filename,
        contentType,
      });

      return NextResponse.json(
        {
          error: "Failed to process image",
          message: "Unable to read image data. Please try again.",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Debug logging
    console.info("📤 Cloudinary Upload:", {
      filename,
      contentType,
      sizeBytes: buffer.length,
      sizeMB: (buffer.length / (1024 * 1024)).toFixed(2),
      isFirstImage,
      userId,
    });

    // Build upload options
    const uploadOptions: UploadApiOptions = {
      folder: "products",
      public_id: filename.replace(/\.[^/.]+$/, ""), // Remove file extension
      resource_type: "image",
    };

    // Apply background removal transformation ONLY to first image
    // This transformation is applied to the ALREADY CROPPED image blob from ImageCropModal
    if (isFirstImage) {
      uploadOptions.transformation = [
        {
          effect: "background_removal",
        },
        {
          // Use the ButterGolf brand tiles background pattern
          // Uploaded from: packages/assets/images/image-backgrounds/Butter Golf_Website brand tiles_BI81_V1_AW-01.jpg
          underlay: "backgrounds:butter-pattern-tiles",
          flags: "tiled",
        },
        {
          flags: "layer_apply",
        },
        {
          // Preserve the canonical product frame without additional tight cropping.
          // This avoids a "zoomed/clipped" look after background removal.
          // Anchor to original width so Cloudinary always materializes a 4:3 frame.
          crop: "pad",
          width: "iw",
          aspect_ratio: `${PRODUCT_IMAGE_ASPECT_RATIO}`,
          gravity: "center",
          background: "rgb:FFFAD2",
        },
      ];
    }

    // Debug: Log the image dimensions being uploaded
    console.info("📐 Uploading image data:", {
      base64Length: base64Image.length,
      estimatedSizeKB: Math.round((base64Image.length * 0.75) / 1024),
      isFirstImage,
    });

    // Upload the CROPPED image to Cloudinary with transformation
    // The blob is already cropped by ImageCropModal, SDK applies background transformation to it
    const result = await cloudinary.uploader.upload(base64Image, uploadOptions);

    console.info("Cloudinary Upload Success:", {
      publicId: result.public_id,
      url: result.secure_url,
      dimensions: `${result.width}x${result.height}`,
      format: result.format,
      bytes: result.bytes,
    });

    return NextResponse.json(
      {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Upload failed";

    // If background removal fails, provide helpful error
    if (errorMessage.includes("background_removal")) {
      logError("Background removal failed during upload", error, {
        errorId: UPLOAD_BACKGROUND_REMOVAL_FAILED,
        userId,
        filename,
        isFirstImage,
      });

      return NextResponse.json(
        {
          error: "Background removal failed",
          message:
            "The image may not be suitable for automatic background removal. Please try a different image.",
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // Check for Cloudinary-specific errors
    const isCloudinaryError =
      errorMessage.includes("quota") ||
      errorMessage.includes("rate limit") ||
      errorMessage.includes("Invalid");

    if (isCloudinaryError) {
      logError("Cloudinary service error during upload", error, {
        errorId: UPLOAD_FAILED,
        userId,
        filename,
        errorType: "cloudinary_service",
      });

      return NextResponse.json(
        {
          error: "Upload service error",
          message: "The image upload service is experiencing issues. Please try again later.",
        },
        { status: 503, headers: corsHeaders }
      );
    }

    // Generic upload failure
    logError("Failed to upload image to Cloudinary", error, {
      errorId: UPLOAD_FAILED,
      userId,
      filename,
      contentType,
      isFirstImage,
    });

    return NextResponse.json(
      {
        error: "Failed to upload image",
        message: "Unable to upload your image. Please try again.",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle CORS preflight requests
export async function OPTIONS(request: Request): Promise<NextResponse> {
  const allowedOrigin = getAllowedOrigin(request);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };

  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
    headers["Vary"] = "Origin";
  }

  return new NextResponse(null, {
    status: 200,
    headers,
  });
}
