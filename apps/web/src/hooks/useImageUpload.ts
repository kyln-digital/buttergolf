"use client";

import { useState } from "react";

export interface UploadResult {
  url: string;
  pathname: string;
  contentType: string;
}

export interface UseImageUploadReturn {
  upload: (file: File, isFirstImage?: boolean) => Promise<UploadResult>;
  uploading: boolean;
  error: string | null;
  progress: number;
}

export function useImageUpload(): UseImageUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const upload = async (file: File, isFirstImage = false): Promise<UploadResult> => {
    setUploading(true);
    setError(null);
    setProgress(0);

    // Validate file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      const errorMsg = "File size must be less than 10MB";
      setError(errorMsg);
      setUploading(false);
      throw new Error(errorMsg);
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      const errorMsg = "Only image files (JPEG, PNG, WebP, GIF) are allowed";
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

      console.log("🚀 useImageUpload: Sending file to server:", {
        filename,
        originalName: file.name,
        size: file.size,
        sizeKB: Math.round(file.size / 1024),
        type: file.type,
        isFirstImage,
      });

      setProgress(30);

      // Upload to API route with isFirstImage flag for background removal
      const response = await fetch(
        `/api/upload?filename=${encodeURIComponent(filename)}&isFirstImage=${isFirstImage}`,
        {
          method: "POST",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        }
      );

      setProgress(70);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const result: UploadResult = await response.json();

      console.log("✅ useImageUpload: Server response:", result);

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
