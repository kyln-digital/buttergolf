"use client";

import { useState, useRef, useCallback } from "react";
import { Text, Row, Column, Image, Spinner, Button } from "@buttergolf/ui";
import { Smartphone } from "@tamagui/lucide-icons";
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
import { usePhoneUploadSession } from "../hooks/usePhoneUploadSession";
import { ImageCropModal } from "./ImageCropModal";
import { PhoneUploadQrModal } from "./PhoneUploadQrModal";
import {
  isHeicFile,
  normaliseImageFile,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  MAX_UPLOAD_FILE_SIZE_LABEL,
} from "@/lib/image-file";

/** Renders a byte count as MB for error messages, e.g. "14.2MB". */
function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** "4:05" style countdown for the phone-session status line. */
function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  onRemoveImage?: (index: number) => void;
  onReorderImages?: (urls: string[]) => void;
  maxImages?: number;
  currentImages?: string[];
}

/** A single sortable image thumbnail with delete + set-as-cover controls */
function SortableImageItem({
  id,
  url,
  index,
  onRemove,
  onSetCover,
}: {
  id: string;
  url: string;
  index: number;
  onRemove: (index: number) => void;
  onSetCover: (index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
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
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read inside the phone-photo callback, which fires from a poll timer and
  // would otherwise see the images as they were when the session started.
  const currentImagesRef = useRef(currentImages);
  currentImagesRef.current = currentImages;

  const handlePhonePhotos = useCallback(
    (urls: string[]) => {
      const held = currentImagesRef.current;
      const already = new Set(held);
      const room = Math.max(0, maxImages - held.length);
      // After a desktop reload the whole session is reported again, so drop
      // anything already in the form before filling the remaining slots.
      const fresh = urls.filter((url) => !already.has(url)).slice(0, room);
      for (const url of fresh) onUploadComplete(url);
    },
    [maxImages, onUploadComplete]
  );

  const phone = usePhoneUploadSession({
    onPhotos: handlePhonePhotos,
    remainingSlots: maxImages - currentImages.length,
  });
  const phoneSessionLive = phone.session !== null && !phone.isExpired;

  const openPhoneModal = useCallback(() => {
    setPhoneModalOpen(true);
    if (!phoneSessionLive) void phone.start();
  }, [phone, phoneSessionLive]);

  const closePhoneModal = useCallback(() => setPhoneModalOpen(false), []);

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

  // Stable unique IDs for each image slot to avoid issues with duplicate URLs.
  // Uses index-based IDs so DnD kit can track items even if URLs repeat.
  const sortableIds = currentImages.map((_, i) => `img-${i}`);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !onReorderImages) return;

      const oldIndex = sortableIds.indexOf(active.id as string);
      const newIndex = sortableIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      onReorderImages(arrayMove(currentImages, oldIndex, newIndex));
    },
    [sortableIds, currentImages, onReorderImages]
  );

  /**
   * Hands a picked file to the crop step, converting HEIC to JPEG first so the
   * cropper (which renders the file in an <img>) can actually display it.
   */
  const openCropFor = useCallback(
    async (file: File) => {
      setConvertError(null);

      // Size is checked here, before the file is decoded or handed to the
      // cropper. Deferring it to the upload step would mean loading an
      // oversized HEIC into libheif first, which can hang the tab.
      if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
        setConvertError(
          `That photo is ${formatFileSize(file.size)}. Please choose one under ${MAX_UPLOAD_FILE_SIZE_LABEL}.`
        );
        return;
      }

      if (!isHeicFile(file)) {
        setFileToCrop(file);
        setCropModalOpen(true);
        return;
      }

      setConverting(true);
      try {
        const normalised = await normaliseImageFile(file);
        setFileToCrop(normalised);
        setCropModalOpen(true);
      } catch (err) {
        console.error("HEIC conversion failed:", err);
        setConvertError(
          "That iPhone photo couldn't be converted. Try exporting it as JPEG and uploading again."
        );
      } finally {
        setConverting(false);
      }
    },
    [setFileToCrop, setCropModalOpen]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    // Reset the input straight away so picking the same file twice re-fires
    // change, even if we bail out below.
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (!file) return;

    if (currentImages.length >= maxImages) {
      alert(`You can only upload up to ${maxImages} images`);
      return;
    }

    await openCropFor(file);
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

      await openCropFor(file);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const emptySlotCount = maxImages - currentImages.length;

  return (
    <>
      {/* pointerEvents fallback for browsers with incomplete inert support */}
      <Column gap="$md" width="100%" style={{ pointerEvents: cropModalOpen ? "none" : "auto" }}>
        {/* eslint-disable-next-line react/forbid-elements -- hidden file input, no DS equivalent */}
        <input
          ref={fileInputRef}
          type="file"
          // .heic/.heif are listed by extension as well as MIME because
          // Windows and Linux report an empty type for them.
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
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
          {converting ? (
            <Column gap="$md" alignItems="center">
              <Spinner size="md" color="$primary" />
              <Text size="$4" color="$textSecondary" textAlign="center">
                Converting iPhone photo...
              </Text>
            </Column>
          ) : uploading ? (
            <Column gap="$md" alignItems="center">
              <Spinner size="md" color="$primary" />
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
                <Text size="$6" fontWeight="600" textAlign="center" color="$text">
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
                0/{maxImages} photos • Max {MAX_UPLOAD_FILE_SIZE_LABEL} each
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
                <Text size="$4" fontWeight="600" color="$text">
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

        {/* Phone handoff: sits outside the drop zone so a press can't also open the file picker */}
        {currentImages.length < maxImages && (
          <Row gap="$sm" alignItems="center" justifyContent="center" flexWrap="wrap">
            <Button butterVariant="ghost" size="$3" icon={Smartphone} onPress={openPhoneModal}>
              {phoneSessionLive ? "Show phone code" : "Add photos from your phone"}
            </Button>
            {phoneSessionLive && (
              <Text size="$2" color={phone.receivedCount > 0 ? "$success" : "$textSecondary"}>
                {phone.receivedCount > 0
                  ? `${phone.receivedCount} received from your phone`
                  : "Waiting for your phone"}{" "}
                · {formatCountdown(phone.secondsLeft)} left
              </Text>
            )}
          </Row>
        )}

        {(error || convertError) && (
          <Text size="$3" color="$error" textAlign="center">
            {error || convertError}
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
              <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
                <Row gap="$md" flexWrap="wrap">
                  {currentImages.map((url, index) => (
                    <SortableImageItem
                      key={sortableIds[index]}
                      id={sortableIds[index]}
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
      </Column>

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

      <PhoneUploadQrModal
        open={phoneModalOpen}
        onClose={closePhoneModal}
        session={phone.session}
        isExpired={phone.isExpired}
        secondsLeft={phone.secondsLeft}
        receivedCount={phone.receivedCount}
        isStarting={phone.isStarting}
        error={phone.error}
        onRegenerate={() => void phone.start()}
      />
    </>
  );
}
