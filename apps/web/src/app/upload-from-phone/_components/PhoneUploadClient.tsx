"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Column, Heading, Image, Row, Spinner, Text } from "@buttergolf/ui";
import { Camera, Check, Images } from "@tamagui/lucide-icons";
import { ImageCropModal } from "@/components/ImageCropModal";
import { useImageUpload, UploadError } from "@/hooks/useImageUpload";
import {
  isHeicFile,
  normaliseImageFile,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  MAX_UPLOAD_FILE_SIZE_LABEL,
} from "@/lib/image-file";
import {
  readPhoneUploadTokenFromHash,
  type PhoneUploadPhoto,
  type PhoneUploadSessionStatus,
} from "@/lib/phone-upload";

type Phase =
  /** Reading the token and asking the server about the session. */
  | "checking"
  /** No token in the URL: the page was opened by hand rather than by scanning. */
  | "invalid"
  /** The token was rejected, almost always because its 15 minutes are up. */
  | "expired"
  /** The desktop has finished with the listing (published, saved or discarded). */
  | "closed"
  /** The server couldn't be reached. */
  | "unreachable"
  | "ready";

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const THUMB_SIZE = 96;

/**
 * The phone half of the QR photo handoff. Takes or picks a photo, runs it
 * through the same HEIC-conversion and 4:3 crop steps as the desktop uploader,
 * and posts it with the QR token; the sell form on the computer picks it up.
 */
export function PhoneUploadClient() {
  const [token, setToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("checking");
  const [maxPhotos, setMaxPhotos] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const [sent, setSent] = useState<PhoneUploadPhoto[]>([]);

  const [fileToCrop, setFileToCrop] = useState<File | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const { upload, uploading, error: uploadError, progress } = useImageUpload({ authToken: token });

  // Scanning a second code while this page is already open only changes the
  // fragment, which would leave everything below bound to the first token and
  // send photos to the wrong listing. A reload re-runs the whole handshake
  // for the new token; nothing here is worth carrying across.
  useEffect(() => {
    const handleHashChange = () => window.location.reload();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Read the token from the fragment and confirm the session with the server.
  useEffect(() => {
    const found = readPhoneUploadTokenFromHash(window.location.hash);
    if (!found) {
      setPhase("invalid");
      return;
    }
    setToken(found);

    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/upload/phone-session", {
          headers: { Authorization: `Bearer ${found}` },
          cache: "no-store",
        });
        if (cancelled) return;

        if (response.status === 401) {
          setPhase("expired");
          return;
        }
        if (response.status === 410) {
          setPhase("closed");
          return;
        }
        if (!response.ok) {
          setPhase("unreachable");
          return;
        }

        const status = (await response.json()) as PhoneUploadSessionStatus;
        if (cancelled) return;
        setMaxPhotos(status.maxPhotos);
        setExpiresAt(status.expiresAt);
        setSent(status.photos);
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("unreachable");
      }
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const remaining = Math.max(0, maxPhotos - sent.length);
  const allSent = phase === "ready" && remaining === 0;
  const busy = converting || uploading;

  // Flip to expired once the token stops being accepted, but not while a
  // photo is still being converted or sent: the server judges the token when
  // the upload *arrives*, so an upload started before expiry can still land,
  // and the seller should see it finish rather than have the page vanish
  // under it. Re-armed when `busy` clears, so a late flip still happens.
  useEffect(() => {
    if (phase !== "ready" || expiresAt === 0 || busy) return;
    const remainingMs = expiresAt - Date.now();
    const id = window.setTimeout(() => setPhase("expired"), Math.max(0, remainingMs));
    return () => window.clearTimeout(id);
  }, [phase, expiresAt, busy]);

  /** Same gate as the desktop uploader: size first, then HEIC to JPEG, then crop. */
  const openCropFor = useCallback(async (file: File) => {
    setLocalError(null);

    if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
      setLocalError(
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
      setLocalError("That photo couldn't be converted. Try taking it again with the camera.");
    } finally {
      setConverting(false);
    }
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the same photo twice re-fires change.
    event.target.value = "";
    if (!file) return;
    await openCropFor(file);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!fileToCrop) return;
    const croppedFile = new File([croppedBlob], fileToCrop.name, { type: croppedBlob.type });

    // Close the cropper before the upload starts. On a slow connection an open
    // cropper invites a second tap on Apply (and a second upload); the page
    // shows "Sending…" in its place, with the pick buttons hidden meanwhile.
    setCropModalOpen(false);
    setFileToCrop(null);

    try {
      const result = await upload(croppedFile, sent.length === 0);
      setSent((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, url: result.url }]);
    } catch (err) {
      // The hook surfaces the message via `uploadError`.
      console.error("Phone upload failed:", err);
      // A refusal that means the whole session is over deserves the full-page
      // notice, not an error line under controls that can no longer work.
      if (err instanceof UploadError) {
        if (err.status === 410) setPhase("closed");
        if (err.status === 401) setPhase("expired");
      }
    }
  };

  const errorMessage = localError ?? uploadError;

  return (
    <Column
      minHeight="100dvh"
      backgroundColor="$background"
      alignItems="center"
      paddingHorizontal="$lg"
      paddingTop="$2xl"
      paddingBottom="$3xl"
      width="100%"
    >
      <Column gap="$xl" width="100%" maxWidth={480}>
        <Column gap="$xs">
          <Text size="$3" color="$primary" fontWeight="700" letterSpacing={1}>
            BUTTERGOLF
          </Text>
          <Heading level={1} size="$9" color="$text">
            Send photos to your listing
          </Heading>
          <Text size="$4" color="$textSecondary">
            They&apos;ll appear on your computer as soon as they upload.
          </Text>
        </Column>

        {phase === "checking" && (
          <Row gap="$md" alignItems="center" paddingVertical="$xl" justifyContent="center">
            <Spinner size="md" color="$primary" />
            <Text size="$4" color="$textSecondary">
              Connecting to your computer…
            </Text>
          </Row>
        )}

        {phase === "invalid" && (
          <Notice
            title="This link isn't complete"
            body="Open the sell page on your computer, choose “Add photos from your phone”, and scan the code it shows."
          />
        )}

        {phase === "expired" && (
          <Notice
            title="This code has expired"
            body="Codes last 15 minutes. Generate a new one on your computer and scan it again."
          />
        )}

        {phase === "closed" && (
          <Notice
            title="This listing has been finished on your computer"
            body="Nothing more can be sent to it. To add photos to another listing, generate a new code from that listing's form."
          />
        )}

        {phase === "unreachable" && (
          <Notice
            title="Couldn't connect"
            body="Check your phone has signal, then scan the code again."
          />
        )}

        {phase === "ready" && (
          <>
            <Row alignItems="center" justifyContent="space-between">
              <Text size="$4" fontWeight="600" color="$text">
                {sent.length} of {maxPhotos} sent
              </Text>
              {remaining > 0 && (
                <Text size="$3" color="$textSecondary">
                  {remaining} more {remaining === 1 ? "slot" : "slots"} free
                </Text>
              )}
            </Row>

            {allSent ? (
              <Column
                gap="$sm"
                alignItems="center"
                padding="$xl"
                backgroundColor="$primaryLight"
                borderRadius="$xl"
              >
                <Column
                  width={48}
                  height={48}
                  borderRadius="$full"
                  backgroundColor="$success"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Check size={26} color="$textInverse" />
                </Column>
                <Text size="$6" fontWeight="600" color="$text" textAlign="center">
                  All photos sent
                </Text>
                <Text size="$4" color="$textSecondary" textAlign="center">
                  Head back to your computer to carry on with your listing.
                </Text>
              </Column>
            ) : busy ? (
              <Column
                gap="$md"
                alignItems="center"
                padding="$xl"
                backgroundColor="$surface"
                borderRadius="$xl"
                borderWidth={1}
                borderColor="$border"
              >
                <Spinner size="md" color="$primary" />
                <Text size="$4" color="$textSecondary">
                  {converting ? "Converting photo…" : `Sending… ${progress}%`}
                </Text>
              </Column>
            ) : (
              <Column gap="$md">
                <Button
                  butterVariant="primary"
                  size="$6"
                  icon={Camera}
                  onPress={() => cameraInputRef.current?.click()}
                >
                  Take a photo
                </Button>
                <Button
                  butterVariant="secondary"
                  size="$5"
                  icon={Images}
                  onPress={() => libraryInputRef.current?.click()}
                >
                  Choose from library
                </Button>
              </Column>
            )}

            {errorMessage && (
              <Text size="$3" color="$error" textAlign="center">
                {errorMessage}
              </Text>
            )}

            {sent.length > 0 && (
              <Column gap="$sm">
                <Text size="$2" color="$textSecondary">
                  Sent to your computer
                </Text>
                <Row gap="$sm" flexWrap="wrap">
                  {sent.map((photo, index) => (
                    <Column
                      key={photo.id}
                      position="relative"
                      width={THUMB_SIZE}
                      height={THUMB_SIZE}
                      borderRadius="$lg"
                      overflow="hidden"
                      borderWidth={1}
                      borderColor="$border"
                    >
                      <Image
                        source={{ uri: photo.url }}
                        width={THUMB_SIZE}
                        height={THUMB_SIZE}
                        objectFit="cover"
                        alt={`Sent photo ${index + 1}`}
                      />
                      <Column
                        position="absolute"
                        top={4}
                        right={4}
                        width={22}
                        height={22}
                        borderRadius="$full"
                        backgroundColor="$success"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Check size={14} color="$textInverse" />
                      </Column>
                    </Column>
                  ))}
                </Row>
              </Column>
            )}
          </>
        )}
      </Column>

      {/* eslint-disable-next-line react/forbid-elements -- hidden file input, no DS equivalent */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        // Opens the rear camera directly on iOS and Android.
        capture="environment"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      {/* eslint-disable-next-line react/forbid-elements -- hidden file input, no DS equivalent */}
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {fileToCrop && (
        <ImageCropModal
          imageFile={fileToCrop}
          open={cropModalOpen}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setCropModalOpen(false);
            setFileToCrop(null);
          }}
        />
      )}
    </Column>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Column
      gap="$xs"
      padding="$lg"
      backgroundColor="$surface"
      borderRadius="$xl"
      borderWidth={1}
      borderColor="$border"
    >
      <Text size="$5" fontWeight="600" color="$text">
        {title}
      </Text>
      <Text size="$4" color="$textSecondary">
        {body}
      </Text>
    </Column>
  );
}
