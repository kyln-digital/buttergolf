"use client";

import { useState } from "react";
import {
  isAllowedUploadType,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  MAX_UPLOAD_FILE_SIZE_LABEL,
} from "@/lib/image-file";

export interface UploadResult {
  url: string;
  pathname: string;
  contentType: string;
}

/**
 * Thrown when the upload route answers with an error. Carries the HTTP status
 * so callers can react to specific outcomes (the phone page turns a 410 into
 * its "finished on your computer" state) instead of matching message text.
 */
export class UploadError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "UploadError";
  }
}

export interface UseImageUploadReturn {
  upload: (file: File, isFirstImage?: boolean) => Promise<UploadResult>;
  uploading: boolean;
  error: string | null;
  progress: number;
}

export interface UseImageUploadOptions {
  /**
   * Sent as a Bearer credential instead of relying on the Clerk cookie. Used
   * by the phone upload page, whose visitor scanned a QR code and is not
   * signed in on that device.
   */
  authToken?: string | null;
}

export function useImageUpload({ authToken }: UseImageUploadOptions = {}): UseImageUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const upload = async (file: File, isFirstImage = false): Promise<UploadResult> => {
    setUploading(true);
    setError(null);
    setProgress(0);

    // Validate file size. ImageUpload also checks the picked file before
    // decoding it; this catches the cropped result and non-UI callers.
    if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
      const errorMsg = `File size must be less than ${MAX_UPLOAD_FILE_SIZE_LABEL}`;
      setError(errorMsg);
      setUploading(false);
      throw new Error(errorMsg);
    }

    // Validate file type. HEIC is accepted here because mobile uploads post the
    // original file; the web flow converts to JPEG before reaching this point.
    if (!isAllowedUploadType(file.type)) {
      const errorMsg = "Only image files (JPEG, PNG, WebP, GIF, HEIC) are allowed";
      setError(errorMsg);
      setUploading(false);
      throw new Error(errorMsg);
    }

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const extension = file.name.split(".").pop();
      const filename = `${timestamp}-${randomStr}.${extension}`;

      console.info("useImageUpload: Sending file to server:", {
        filename,
        originalName: file.name,
        size: file.size,
        sizeKB: Math.round(file.size / 1024),
        type: file.type,
        isFirstImage,
      });

      setProgress(30);

      const headers: Record<string, string> = { "Content-Type": file.type };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      // Upload to API route with isFirstImage flag for background removal
      const response = await fetch(
        `/api/upload?filename=${encodeURIComponent(filename)}&isFirstImage=${isFirstImage}`,
        {
          method: "POST",
          headers,
          body: file,
        }
      );

      setProgress(70);

      if (!response.ok) {
        const errorData = await response.json();
        throw new UploadError(errorData.error || "Upload failed", response.status);
      }

      const result: UploadResult = await response.json();

      console.info("useImageUpload: Server response:", result);

      setProgress(100);
      setUploading(false);

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Upload failed";
      setError(errorMsg);
      setUploading(false);
      throw err;
    }
  };

  return {
    upload,
    uploading,
    error,
    progress,
  };
}
