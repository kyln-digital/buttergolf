import { type UploadApiOptions } from "cloudinary";
import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/middleware/rate-limit";
import { cloudinary } from "@/lib/cloudinary";
import {
  readBearerToken,
  verifyPhoneUploadSessionToken,
  type PhoneUploadSession,
} from "@/lib/phone-upload-session";
import {
  completePhoneUpload,
  isPhoneUploadSessionClosed,
  PHONE_SESSION_CLOSED_MESSAGE,
  phoneAllowanceUsedMessage,
  releasePhoneUploadSlot,
  reservePhoneUploadSlot,
} from "@/lib/phone-upload-store";
import { BodyTooLargeError, readBodyWithLimit } from "@/lib/read-body-with-limit";
import {
  isAllowedUploadType,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  MAX_UPLOAD_FILE_SIZE_LABEL,
} from "@/lib/image-file";
import {
  logError,
  UPLOAD_CLOUDINARY_CONFIG_MISSING,
  UPLOAD_FAILED,
  UPLOAD_BACKGROUND_REMOVAL_FAILED,
  UPLOAD_CONVERSION_FAILED,
} from "@buttergolf/constants";

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

// A 10MB body plus one Cloudinary call finishes well inside this. It also
// bounds how long a phone-session reservation can be in flight, which is what
// lets the store treat a five-minute-old reservation as provably dead.
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const corsHeaders = getCorsHeaders(request);
  let userId: string | null = null;
  // Set when the caller is a phone that scanned the sell form's QR code. Its
  // token is a narrow capability minted by /api/upload/phone-session, and each
  // upload it makes is recorded so the desktop can pick it up.
  let phoneSession: PhoneUploadSession | null = null;

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
    // A QR-code session token is checked first: it is not a Clerk token, so
    // handing it to auth() would only produce a noisy "unauthenticated". Any
    // other Bearer (Clerk session, mobile session) falls through as before.
    const bearer = readBearerToken(request);
    phoneSession = bearer ? await verifyPhoneUploadSessionToken(bearer) : null;

    // Authenticate user (supports web cookies, mobile Bearer token, phone QR token)
    userId = phoneSession ? phoneSession.clerkId : await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    // Each upload bills Cloudinary (storage + background removal), so throttle
    // per user to limit cost abuse.
    const { isLimited, resetAt } = await checkRateLimit(userId, {
      maxRequests: 60,
      windowMs: 60_000,
      keyFn: (id) => `upload:${id}`,
    });
    if (isLimited) {
      const response = rateLimitResponse(resetAt);
      Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
      return response;
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
  // Retained for logging only — it no longer changes how the image is stored.
  const isFirstImage = searchParams.get("isFirstImage") === "true";

  if (!filename) {
    return NextResponse.json(
      { error: "Filename is required" },
      { status: 400, headers: corsHeaders }
    );
  }

  // Validate file type (images only)
  const contentType = request.headers.get("content-type");

  if (!isAllowedUploadType(contentType)) {
    return NextResponse.json(
      { error: "Invalid file type. Only images are allowed." },
      { status: 400, headers: corsHeaders }
    );
  }

  // Enforce the size limit before buffering. The browser checks it too, but
  // mobile and any other authenticated client post here directly, and reading
  // an unbounded body into memory (then base64-encoding it, ~1.33x) is a cheap
  // way to exhaust the function. Content-Length is advisory, so the decoded
  // buffer is re-checked below.
  const declaredLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File size must be less than ${MAX_UPLOAD_FILE_SIZE_LABEL}` },
      { status: 413, headers: corsHeaders }
    );
  }

  // A phone session's allowance is taken *before* the body is read or
  // Cloudinary is called, so a leaked code can never drive more uploads than
  // it was signed for: concurrent requests queue on the reservation instead of
  // all slipping past a count. The slot is released on every failure below and
  // filled in once the asset exists.
  // Awaited on every failure path: a serverless invocation can be frozen the
  // moment the response goes out, so cleanup that isn't awaited may never run.
  let reservationId: string | null = null;
  const releaseReservation = async () => {
    if (reservationId) {
      const id = reservationId;
      reservationId = null;
      await releasePhoneUploadSlot(id);
    }
  };

  // The public id is generated here, never taken from the request. The
  // `filename` query is only ever used for logging: letting a caller choose
  // the id would let anyone with an upload credential (a leaked QR token
  // included) overwrite an existing `products/…` asset by naming it. It is
  // chosen before the reservation so the reservation can record it: if this
  // invocation dies after Cloudinary succeeds, the sweep still knows what to
  // destroy.
  const publicId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  if (phoneSession) {
    try {
      const reservation = await reservePhoneUploadSlot(phoneSession, publicId);
      if (reservation.kind === "closed") {
        return NextResponse.json(
          { error: PHONE_SESSION_CLOSED_MESSAGE },
          { status: 410, headers: corsHeaders }
        );
      }
      if (reservation.kind === "over-cap") {
        return NextResponse.json(
          { error: phoneAllowanceUsedMessage(phoneSession.maxPhotos) },
          { status: 409, headers: corsHeaders }
        );
      }
      reservationId = reservation.id;
    } catch (reserveError) {
      logError("Failed to reserve phone upload slot", reserveError, {
        errorId: UPLOAD_FAILED,
        userId,
        filename,
        phoneSessionId: phoneSession.sessionId,
      });

      return NextResponse.json(
        { error: "Couldn't reach your computer's session. Please try again." },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  try {
    // Convert request body to base64 for Cloudinary upload
    let buffer: Buffer;
    let base64Image: string;

    try {
      // Content-Length can be absent or wrong, so the real size decides — and
      // it is enforced as the stream arrives, not after it has all been held
      // in memory, so a forged header can't make the function buffer more
      // than the limit.
      buffer = await readBodyWithLimit(request, MAX_UPLOAD_FILE_SIZE_BYTES);
      base64Image = `data:${contentType};base64,${buffer.toString("base64")}`;
    } catch (conversionError) {
      if (conversionError instanceof BodyTooLargeError) {
        await releaseReservation();
        return NextResponse.json(
          { error: `File size must be less than ${MAX_UPLOAD_FILE_SIZE_LABEL}` },
          { status: 413, headers: corsHeaders }
        );
      }

      logError("Failed to convert request body to base64", conversionError, {
        errorId: UPLOAD_CONVERSION_FAILED,
        userId,
        filename,
        contentType,
      });

      await releaseReservation();
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
      public_id: publicId,
      overwrite: false,
      resource_type: "image",
    };

    // NOTE: the ButterGolf brand treatment (background removal + tiled pattern)
    // is deliberately NOT baked in here. It used to be applied to whichever
    // image happened to be uploaded first, which meant a seller who later
    // reordered their photos ended up with an unbranded cover and no way to fix
    // it. The stored asset is now always the raw cropped photo, and the
    // treatment is applied as a delivery-time transformation to whichever image
    // is currently the cover. See lib/product-images.ts.

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
      phoneSessionId: phoneSession?.sessionId,
    });

    // Hand the photo to the desktop by filling the slot reserved above.
    if (phoneSession && reservationId) {
      try {
        await completePhoneUpload(reservationId, result.secure_url);
        reservationId = null;
      } catch (completeError) {
        logError("Failed to record phone upload", completeError, {
          errorId: UPLOAD_FAILED,
          userId,
          filename,
          phoneSessionId: phoneSession.sessionId,
        });

        // The desktop will never see this asset, so don't keep paying for it.
        // Best-effort, as in the listing routes: an orphan is logged, never a
        // second error for the phone. Awaited so the function isn't frozen first.
        await cloudinary.uploader.destroy(result.public_id).catch((err) => {
          console.error("Failed to delete Cloudinary asset:", { publicId: result.public_id, err });
        });
        await releaseReservation();

        // The usual reason the slot can't be filled is that the desktop closed
        // the session while this upload was in flight. Say so, rather than
        // inviting a retry that will only be refused.
        const closedMeanwhile = await isPhoneUploadSessionClosed(
          phoneSession.sessionId,
          phoneSession.clerkId
        ).catch(() => false);
        if (closedMeanwhile) {
          return NextResponse.json(
            { error: PHONE_SESSION_CLOSED_MESSAGE },
            { status: 410, headers: corsHeaders }
          );
        }

        return NextResponse.json(
          {
            error: "Your photo uploaded but couldn't be sent to your computer. Please try again.",
          },
          { status: 500, headers: corsHeaders }
        );
      }
    }

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
    // Nothing reached the desktop, so the phone keeps its slot for a retry.
    await releaseReservation();

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
