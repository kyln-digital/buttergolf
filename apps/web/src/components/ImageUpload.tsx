"use client";

import { useState, useRef, useCallback } from "react";
import { Text, Row, Column, Image, Spinner } from "@buttergolf/ui";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useImageUpload } from "../hooks/useImageUpload";
import { ImageCropModal } from "./ImageCropModal";

export interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  onRemoveImage?: (index: number) => void;
  onReorderImages?: (urls: string[]) => void;
  maxImages?: number;
  currentImages?: string[];
}

/** A single sortable image thumbnail with delete + set-as-cover controls */
function SortableImageItem({
  url,
  index,
  onRemove,
  onSetCover,
}: {
  url: string;
  index: number;
  onRemove: (index: number) => void;
  onSetCover: (index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: url,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Column
        position="relative"
        backgroundColor="$surface"
        borderRadius="$lg"
        overflow="hidden"
        borderWidth={2}
        borderColor={index === 0 ? "$primary" : "$border"}
        width={140}
        height={140}
        cursor="grab"
      >
        <Image
          source={{ uri: url }}
          width={140}
          height={140}
          objectFit="cover"
          alt={`Product image ${index + 1}`}
        />

        {/* Order number badge (top-left) */}
        <Column
          position="absolute"
          top={6}
          left={6}
          width={24}
          height={24}
          borderRadius="$full"
          backgroundColor={index === 0 ? "$primary" : "rgba(0, 0, 0, 0.6)"}
          alignItems="center"
          justifyContent="center"
        >
          <Text size="$1" color="$textInverse" fontWeight="700">
            {index + 1}
          </Text>
        </Column>

        {/* Delete button (top-right) */}
        <Column
          position="absolute"
          top={6}
          right={6}
          width={28}
          height={28}
          borderRadius="$full"
          backgroundColor="rgba(0, 0, 0, 0.6)"
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          hoverStyle={{ backgroundColor: "$error" }}
          onPress={(e: { stopPropagation: () => void }) => {
            e.stopPropagation();
            onRemove(index);
          }}
          accessibilityLabel={`Remove image ${index + 1}`}
        >
          <Text size="$3" color="$textInverse" fontWeight="700">
            ✕
          </Text>
        </Column>

        {/* Cover photo label OR set-as-cover button */}
        {index === 0 ? (
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
        ) : (
          <Column
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            backgroundColor="rgba(0, 0, 0, 0)"
            padding="$xs"
            hoverStyle={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
            cursor="pointer"
            onPress={(e: { stopPropagation: () => void }) => {
              e.stopPropagation();
              onSetCover(index);
            }}
            accessibilityLabel={`Set image ${index + 1} as cover`}
          >
            <Text
              size="$2"
              color="rgba(0,0,0,0)"
              hoverStyle={{ color: "$textInverse" }}
              textAlign="center"
              fontWeight="600"
            >
              Set as cover
            </Text>
          </Column>
        )}
      </Column>
    </div>
  );
}

export function ImageUpload({
  onUploadComplete,
  onRemoveImage,
  onReorderImages,
  maxImages = 5,
  currentImages = [],
}: Readonly<ImageUploadProps>) {
  const { upload, uploading, error, progress } = useImageUpload();
  const [dragActive, setDragActive] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [fileToCrop, setFileToCrop] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleRemove = useCallback(
    (index: number) => {
      if (index === 0 && currentImages.length > 1) {
        if (!confirm("This is your cover photo. The next image will become the cover. Continue?")) {
          return;
        }
      }
      onRemoveImage?.(index);
    },
    [currentImages.length, onRemoveImage]
  );

  const handleSetCover = useCallback(
    (index: number) => {
      if (!onReorderImages || index === 0) return;
      const reordered = [...currentImages];
      const [moved] = reordered.splice(index, 1);
      reordered.unshift(moved);
      onReorderImages(reordered);
    },
    [currentImages, onReorderImages]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !onReorderImages) return;

      const oldIndex = currentImages.indexOf(active.id as string);
      const newIndex = currentImages.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      onReorderImages(arrayMove(currentImages, oldIndex, newIndex));
    },
    [currentImages, onReorderImages]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (currentImages.length >= maxImages) {
      alert(`You can only upload up to ${maxImages} images`);
      return;
    }

    setFileToCrop(file);
    setCropModalOpen(true);

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

      setFileToCrop(file);
      setCropModalOpen(true);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const emptySlotCount = maxImages - currentImages.length;

  return (
    <Column gap="$md" width="100%">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {/* Upload Area — compact if images exist */}
      <Column
        backgroundColor={dragActive ? "$primaryLight" : "$surface"}
        borderWidth={2}
        borderColor={dragActive ? "$primary" : "$border"}
        borderStyle="dashed"
        borderRadius="$xl"
        padding={currentImages.length === 0 ? "$10" : "$6"}
        alignItems="center"
        justifyContent="center"
        minHeight={currentImages.length === 0 ? 280 : 100}
        cursor={currentImages.length < maxImages ? "pointer" : "default"}
        animation="quick"
        width="100%"
        hoverStyle={
          currentImages.length < maxImages
            ? { borderColor: "$primary", backgroundColor: "$primaryLight" }
            : {}
        }
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
        ) : currentImages.length === 0 ? (
          <Column gap="$md" alignItems="center" width="100%" maxWidth={500}>
            <Column
              width={64}
              height={64}
              borderRadius="$full"
              backgroundColor="$primaryLight"
              alignItems="center"
              justifyContent="center"
            >
              <Text size="$12">+</Text>
            </Column>
            <Column gap="$xs" alignItems="center">
              <Text size="$6" weight="semibold" textAlign="center" color="$text">
                Upload photos
              </Text>
              <Text size="$3" color="$textSecondary" textAlign="center" lineHeight={20}>
                or drag and drop
              </Text>
              <Text size="$2" color="$textMuted" textAlign="center" lineHeight={18}>
                Your first photo will be the cover image. We&apos;ll automatically remove the
                background and add our brand pattern.
              </Text>
            </Column>
            <Text size="$2" color="$primary" textAlign="center">
              0/{maxImages} photos • Max 10MB each
            </Text>
          </Column>
        ) : currentImages.length < maxImages ? (
          <Row gap="$sm" alignItems="center">
            <Column
              width={36}
              height={36}
              borderRadius="$full"
              backgroundColor="$primaryLight"
              alignItems="center"
              justifyContent="center"
            >
              <Text size="$7">+</Text>
            </Column>
            <Column gap="$xs">
              <Text size="$4" weight="semibold" color="$text">
                Add more photos
              </Text>
              <Text size="$2" color="$primary">
                {currentImages.length}/{maxImages} photos
              </Text>
            </Column>
          </Row>
        ) : (
          <Text size="$3" color="$textSecondary" textAlign="center">
            Maximum {maxImages} photos reached
          </Text>
        )}
      </Column>

      {error && (
        <Text size="$3" color="$error" textAlign="center">
          {error}
        </Text>
      )}

      {/* Image Grid — sortable */}
      {currentImages.length > 0 && (
        <Column gap="$sm">
          <Text size="$2" color="$textSecondary">
            Drag to reorder • First image is your cover photo
          </Text>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={currentImages} strategy={rectSortingStrategy}>
              <Row gap="$md" flexWrap="wrap">
                {currentImages.map((url, index) => (
                  <SortableImageItem
                    key={url}
                    url={url}
                    index={index}
                    onRemove={handleRemove}
                    onSetCover={handleSetCover}
                  />
                ))}

                {/* Empty placeholder slots */}
                {Array.from({ length: emptySlotCount }).map((_, i) => (
                  <Column
                    key={`empty-${i}`}
                    width={140}
                    height={140}
                    borderRadius="$lg"
                    borderWidth={2}
                    borderColor="$border"
                    borderStyle="dashed"
                    alignItems="center"
                    justifyContent="center"
                    opacity={0.4}
                    cursor="pointer"
                    onPress={handleButtonClick}
                  >
                    <Text size="$7" color="$textMuted">
                      +
                    </Text>
                    <Text size="$1" color="$textMuted">
                      {currentImages.length + i + 1}
                    </Text>
                  </Column>
                ))}
              </Row>
            </SortableContext>
          </DndContext>
        </Column>
      )}

      {/* Crop Modal */}
      {fileToCrop && (
        <ImageCropModal
          imageFile={fileToCrop}
          open={cropModalOpen}
          onCropComplete={async (croppedBlob) => {
            try {
              const isFirstImage = currentImages.length === 0;
              const croppedFile = new File([croppedBlob], fileToCrop.name, {
                type: croppedBlob.type,
              });

              const result = await upload(croppedFile, isFirstImage);
              onUploadComplete(result.url);

              setCropModalOpen(false);
              setFileToCrop(null);
            } catch (err) {
              console.error("Upload error:", err);
            }
          }}
          onCancel={() => {
            setCropModalOpen(false);
            setFileToCrop(null);
          }}
        />
      )}
    </Column>
  );
}
