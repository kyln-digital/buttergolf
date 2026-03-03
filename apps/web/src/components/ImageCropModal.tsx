"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Column, Row, Button, Text, Heading, Spinner, View } from "@buttergolf/ui";

// 4:3 aspect ratio to match ProductCard display
const CROP_ASPECT_RATIO = 4 / 3;

interface ImageCropModalProps {
  imageFile: File;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
  open: boolean;
}

async function getCroppedImg(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  // CRITICAL FIX: Scale crop coordinates from displayed size to natural size
  // The crop library gives us coordinates relative to the displayed image size,
  // but we need to draw from the natural (full resolution) image
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  // Calculate natural (source) coordinates
  const sourceX = crop.x * scaleX;
  const sourceY = crop.y * scaleY;
  const sourceWidth = crop.width * scaleX;
  const sourceHeight = crop.height * scaleY;

  // Debug logging to verify coordinate scaling
  console.info("Image Crop Debug:", {
    natural: { width: image.naturalWidth, height: image.naturalHeight },
    displayed: { width: image.width, height: image.height },
    scale: { x: scaleX, y: scaleY },
    cropDisplayed: { x: crop.x, y: crop.y, width: crop.width, height: crop.height },
    cropNatural: { x: sourceX, y: sourceY, width: sourceWidth, height: sourceHeight },
  });

  // Set canvas size to the cropped dimensions (in natural/source pixels)
  const canvasWidth = Math.round(sourceWidth);
  const canvasHeight = Math.round(sourceHeight);
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  console.info("📐 Canvas dimensions set to:", { canvasWidth, canvasHeight });

  // Draw the cropped portion of the image onto the canvas
  ctx.drawImage(
    image,
    sourceX, // Source X (where to start cutting from original)
    sourceY, // Source Y
    sourceWidth, // Source width (how much to cut)
    sourceHeight, // Source height
    0, // Destination X (always 0 - top-left of canvas)
    0, // Destination Y
    canvasWidth, // Destination width (fill entire canvas)
    canvasHeight // Destination height
  );

  // Convert canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        console.info("Cropped blob created:", {
          size: blob.size,
          sizeKB: Math.round(blob.size / 1024),
          type: blob.type,
          expectedDimensions: `${canvasWidth}x${canvasHeight}`,
        });
        resolve(blob);
      },
      "image/jpeg",
      0.95 // Quality (0.95 = high quality)
    );
  });
}

export function ImageCropModal({
  imageFile,
  onCropComplete,
  onCancel,
  open,
}: Readonly<ImageCropModalProps>) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [imageSrc, setImageSrc] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate a centered 4:3 aspect ratio crop when the image loads
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight, width, height } = e.currentTarget;

    // Create a 4:3 aspect ratio crop that takes up 90% of the available space
    const initialCrop = centerCrop(
      makeAspectCrop(
        {
          unit: "%",
          width: 90,
        },
        CROP_ASPECT_RATIO, // 4:3 aspect ratio
        naturalWidth,
        naturalHeight
      ),
      naturalWidth,
      naturalHeight
    );

    setCrop(initialCrop);

    // Also calculate and set the pixel crop so the Apply button is enabled immediately
    // Convert percentage crop to pixel crop based on displayed dimensions
    const pixelCrop: PixelCrop = {
      unit: "px",
      x: (initialCrop.x / 100) * width,
      y: (initialCrop.y / 100) * height,
      width: (initialCrop.width / 100) * width,
      height: (initialCrop.height / 100) * height,
    };
    setCompletedCrop(pixelCrop);
  }, []);

  // Load file into memory as blob URL
  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImageSrc(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);

  useEffect(() => {
    if (!open || !isMounted) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    const appRoot = document.getElementById("__next");
    const hadInert = appRoot?.hasAttribute("inert") ?? false;
    const originalAppPointerEvents = appRoot?.style.pointerEvents;

    document.body.style.overflow = "hidden";
    appRoot?.setAttribute("inert", "");
    if (appRoot) {
      appRoot.style.pointerEvents = "none";
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      if (appRoot && appRoot.isConnected) {
        if (!hadInert) {
          appRoot.removeAttribute("inert");
        }
        appRoot.style.pointerEvents = originalAppPointerEvents ?? "";
      }
    };
  }, [open, isMounted]);

  useEffect(() => {
    if (!open || !isMounted) {
      return;
    }

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [open, isMounted]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isProcessing) {
        onCancel();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const container = modalRef.current;
      if (!container) {
        return;
      }

      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeElement === firstElement || !container.contains(activeElement)) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (activeElement === lastElement || !container.contains(activeElement)) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isProcessing, onCancel]);

  const handleApplyCrop = async () => {
    if (!completedCrop || !imgRef.current) {
      return;
    }

    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
      onCropComplete(croppedBlob);
    } catch (error) {
      console.error("Error cropping image:", error);
      alert("Failed to crop image. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!open || !isMounted) return null;

  const modalContent = (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image crop modal"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Must sit above Clerk modals (~99999) and navigation dropdowns
        zIndex: 100000,
        padding: "16px",
      }}
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget && !isProcessing) {
          onCancel();
        }
      }}
    >
      {/* Modal Content */}
      <Column
        backgroundColor="$surface"
        borderRadius="$xl"
        overflow="hidden"
        maxWidth={600}
        maxHeight="90vh"
        width="100%"
        style={{
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Header */}
        <Column
          paddingHorizontal="$xl"
          paddingVertical="$lg"
          borderBottomWidth={1}
          borderColor="$border"
          backgroundColor="$surface"
        >
          <Row alignItems="center" justifyContent="space-between">
            <Column gap="$xs">
              <Heading level={3} size="$7" color="$text">
                Crop your photo
              </Heading>
              <Text size="$4" color="$textSecondary">
                Drag to reposition • Images display at 4:3 ratio
              </Text>
            </Column>
            {/* Close button */}
            <Button
              ref={closeButtonRef}
              size="$3"
              chromeless
              onPress={onCancel}
              disabled={isProcessing}
              aria-label="Close"
              paddingHorizontal="$2"
            >
              <Text size="$8" color="$textSecondary">
                ×
              </Text>
            </Button>
          </Row>
        </Column>

        {/* Crop Area - Dark background for contrast */}
        <View
          backgroundColor="#1a1a1a"
          padding="$lg"
          flex={1}
          alignItems="center"
          justifyContent="center"
          minHeight={300}
        >
          {imageSrc && (
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={CROP_ASPECT_RATIO}
              style={{
                maxWidth: "100%",
                maxHeight: "50vh",
              }}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "50vh",
                  display: "block",
                }}
                onLoad={onImageLoad}
              />
            </ReactCrop>
          )}
        </View>

        {/* Footer */}
        <Row
          paddingHorizontal="$xl"
          paddingVertical="$lg"
          gap="$md"
          justifyContent="flex-end"
          borderTopWidth={1}
          borderColor="$border"
          backgroundColor="$surface"
        >
          <Button
            size="$4"
            backgroundColor="transparent"
            color="$text"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$full"
            paddingHorizontal="$5"
            onPress={onCancel}
            disabled={isProcessing}
            hoverStyle={{ backgroundColor: "$backgroundHover" }}
          >
            Cancel
          </Button>
          <Button
            butterVariant="primary"
            size="$4"
            borderRadius="$full"
            paddingHorizontal="$6"
            onPress={handleApplyCrop}
            disabled={!completedCrop || isProcessing}
            hoverStyle={{ opacity: 0.9 }}
          >
            {isProcessing ? (
              <Row gap="$sm" alignItems="center">
                <Spinner size="sm" color="$textInverse" />
                <Text color="$textInverse" size="$4">
                  Cropping...
                </Text>
              </Row>
            ) : (
              "Apply"
            )}
          </Button>
        </Row>
      </Column>
    </div>
  );

  return createPortal(modalContent, document.body);
}
