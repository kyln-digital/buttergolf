"use client";

import { useState, useRef } from "react";
import { Text, Row, Column, Image, Spinner } from "@buttergolf/ui";
import { useImageUpload } from "../hooks/useImageUpload";
import { ImageCropModal } from "./ImageCropModal";

export interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  maxImages?: number;
  currentImages?: string[];
}

export function ImageUpload({
  onUploadComplete,
  maxImages = 5,
  currentImages = [],
}: Readonly<ImageUploadProps>) {
  const { upload, uploading, error, progress } = useImageUpload();
  const [dragActive, setDragActive] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [fileToCrop, setFileToCrop] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check max images limit
    if (currentImages.length >= maxImages) {
      alert(`You can only upload up to ${maxImages} images`);
      return;
    }

    // Show crop modal BEFORE uploading
    setFileToCrop(file);
    setCropModalOpen(true);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];

      if (currentImages.length >= maxImages) {
        alert(`You can only upload up to ${maxImages} images`);
        return;
      }

      // Show crop modal BEFORE uploading
      setFileToCrop(file);
      setCropModalOpen(true);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Column gap="$md" width="100%">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {/* Large Upload Area */}
      <Column
        backgroundColor={dragActive ? "$primaryLight" : "$surface"}
        borderWidth={2}
        borderColor={dragActive ? "$primary" : "$border"}
        borderStyle="dashed"
        borderRadius="$xl"
        padding="$10"
        alignItems="center"
        justifyContent="center"
        minHeight={currentImages.length === 0 ? 280 : 180}
        cursor="pointer"
        animation="quick"
        width="100%"
        hoverStyle={{
          borderColor: "$primary",
          backgroundColor: "$primaryLight",
        }}
        onPress={currentImages.length < maxImages ? handleButtonClick : undefined}
        {...{
          onDragEnter: handleDrag,
          onDragLeave: handleDrag,
          onDragOver: handleDrag,
          onDrop: handleDrop,
        }}
      >
        {uploading ? (
          <Column gap="$md" alignItems="center">
            <Spinner size="lg" color="$primary" />
            <Text size="$4" color="$textSecondary" textAlign="center">
              Uploading... {progress.toString()}%
            </Text>
          </Column>
        ) : (
          <Column gap="$md" alignItems="center" width="100%" maxWidth={500}>
            <Column
              width={64}
              height={64}
              borderRadius="$full"
              backgroundColor="$primaryLight"
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize={32}>+</Text>
            </Column>
            <Column gap="$xs" alignItems="center">
              <Text size="$6" weight="semibold" textAlign="center" color="$text">
                {currentImages.length === 0 ? "Upload photos" : "Add more photos"}
              </Text>
              <Text size="$3" color="$textSecondary" textAlign="center" lineHeight={20}>
                or drag and drop
              </Text>
            </Column>
            <Text size="$2" color="$primary" textAlign="center">
              {currentImages.length}/{maxImages} photos • Max 10MB each
            </Text>
          </Column>
        )}
      </Column>

      {error && (
        <Text size="$3" color="$error" textAlign="center">
          {error}
        </Text>
      )}

      {/* Image Grid */}
      {currentImages.length > 0 && (
        <Column gap="$sm">
          <Row gap="$md" flexWrap="wrap">
            {currentImages.map((url, index) => (
              <Column
                key={url}
                position="relative"
                backgroundColor="$surface"
                borderRadius="$lg"
                overflow="hidden"
                borderWidth={1}
                borderColor="$border"
                width={140}
                height={140}
                hoverStyle={{
                  borderColor: "$primary",
                }}
              >
                <Image
                  source={{ uri: url }}
                  width={140}
                  height={140}
                  objectFit="cover"
                  alt="Uploaded product image"
                />
                {index === 0 && (
                  <Column
                    position="absolute"
                    bottom={0}
                    left={0}
                    right={0}
                    backgroundColor="rgba(0, 0, 0, 0.7)"
                    padding="$xs"
                  >
                    <Text size="$2" color="$textInverse" textAlign="center" fontWeight="600">
                      Cover photo
                    </Text>
                  </Column>
                )}
              </Column>
            ))}
          </Row>
        </Column>
      )}

      {/* Crop Modal */}
      {fileToCrop && (
        <ImageCropModal
          imageFile={fileToCrop}
          open={cropModalOpen}
          onCropComplete={async (croppedBlob) => {
            try {
              // Debug: Log the received blob
              console.log("📦 ImageUpload received cropped blob:", {
                size: croppedBlob.size,
                sizeKB: Math.round(croppedBlob.size / 1024),
                type: croppedBlob.type,
              });

              // Convert blob to File for upload
              const isFirstImage = currentImages.length === 0;
              const croppedFile = new File([croppedBlob], fileToCrop.name, {
                type: croppedBlob.type,
              });

              console.log("📁 Created File object:", {
                name: croppedFile.name,
                size: croppedFile.size,
                sizeKB: Math.round(croppedFile.size / 1024),
                type: croppedFile.type,
                isFirstImage,
              });

              // Upload cropped image
              const result = await upload(croppedFile, isFirstImage);
              onUploadComplete(result.url);

              // Close modal
              setCropModalOpen(false);
              setFileToCrop(null);
            } catch (err) {
              console.error("Upload error:", err);
              // Keep modal open to show error
            }
          }}
          onCancel={() => {
            // Discard image, close modal
            setCropModalOpen(false);
            setFileToCrop(null);
          }}
        />
      )}
    </Column>
  );
}
