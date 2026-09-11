"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Button, Column, Heading, Row, Spinner, Text } from "@buttergolf/ui";
import { brandColors } from "@buttergolf/config";
import type { PhoneUploadSessionSnapshot } from "@/hooks/usePhoneUploadSession";

interface PhoneUploadQrModalProps {
  open: boolean;
  onClose: () => void;
  session: PhoneUploadSessionSnapshot | null;
  isExpired: boolean;
  secondsLeft: number;
  receivedCount: number;
  isStarting: boolean;
  error: string | null;
  /** Mints a fresh code (used when the current one has expired or failed). */
  onRegenerate: () => void;
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Shows the QR code a seller scans to send photos from their phone. Photos
 * land in the upload grid behind the modal as they arrive; this only reports
 * progress. Follows ImageCropModal's portal pattern so it sits above the
 * sell form and any Clerk overlays.
 */
export function PhoneUploadQrModal({
  open,
  onClose,
  session,
  isExpired,
  secondsLeft,
  receivedCount,
  isStarting,
  error,
  onRegenerate,
}: Readonly<PhoneUploadQrModalProps>) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  // `open` only ever becomes true from a click, so this never renders during
  // SSR and the portal target is guaranteed to exist.
  if (!open) return null;

  const showCode = session !== null && !isExpired && !isStarting;
  const photosLabel = receivedCount === 1 ? "1 photo received" : `${receivedCount} photos received`;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="phone-upload-qr-heading"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Must sit above Clerk modals (~99999) and navigation dropdowns
        zIndex: 100000,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Column
        backgroundColor="$surface"
        borderRadius="$xl"
        overflow="hidden"
        maxWidth={440}
        width="100%"
        style={{ boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)" }}
      >
        <Row
          paddingHorizontal="$xl"
          paddingVertical="$lg"
          alignItems="flex-start"
          justifyContent="space-between"
          gap="$md"
          borderBottomWidth={1}
          borderColor="$border"
        >
          <Column gap="$xs" flex={1}>
            <Heading level={3} size="$7" color="$text" id="phone-upload-qr-heading">
              Add photos from your phone
            </Heading>
            <Text size="$4" color="$textSecondary">
              Scan the code with your phone&apos;s camera. Photos you take there appear here as soon
              as they upload.
            </Text>
          </Column>
          <Button
            ref={closeButtonRef}
            size="$3"
            chromeless
            onPress={onClose}
            aria-label="Close"
            paddingHorizontal="$2"
          >
            <Text size="$8" color="$textSecondary">
              ×
            </Text>
          </Button>
        </Row>

        <Column paddingHorizontal="$xl" paddingVertical="$xl" gap="$lg" alignItems="center">
          {showCode ? (
            <Column
              // Always white behind the code, whatever the theme: phone
              // cameras need dark modules on a light ground to lock on.
              backgroundColor={brandColors.pureWhite}
              padding="$md"
              borderRadius="$lg"
              borderWidth={1}
              borderColor="$border"
            >
              <QRCodeSVG
                value={session.url}
                size={220}
                level="M"
                marginSize={1}
                bgColor={brandColors.pureWhite}
                fgColor={brandColors.ironstone}
                title="QR code linking your phone to this listing"
              />
            </Column>
          ) : (
            <Column
              width={252}
              height={252}
              alignItems="center"
              justifyContent="center"
              gap="$md"
              backgroundColor="$background"
              borderRadius="$lg"
              borderWidth={1}
              borderColor="$border"
              borderStyle="dashed"
            >
              {isStarting ? (
                <>
                  <Spinner size="md" color="$primary" />
                  <Text size="$3" color="$textSecondary">
                    Creating your code…
                  </Text>
                </>
              ) : isExpired ? (
                <>
                  <Text size="$4" fontWeight="600" color="$text">
                    This code has expired
                  </Text>
                  <Text size="$3" color="$textSecondary" textAlign="center" paddingHorizontal="$md">
                    Codes last 15 minutes. Generate a new one to keep going.
                  </Text>
                </>
              ) : (
                <Text size="$3" color="$textSecondary" textAlign="center" paddingHorizontal="$md">
                  {error ?? "No code yet."}
                </Text>
              )}
            </Column>
          )}

          {error && showCode && (
            <Text size="$3" color="$error" textAlign="center">
              {error}
            </Text>
          )}

          {showCode && (
            <Column gap="$xs" alignItems="center">
              <Row gap="$sm" alignItems="center">
                {receivedCount === 0 && <Spinner size="sm" color="$primary" />}
                <Text size="$4" color={receivedCount > 0 ? "$success" : "$textSecondary"}>
                  {receivedCount > 0 ? photosLabel : "Waiting for your phone…"}
                </Text>
              </Row>
              <Text size="$2" color="$textMuted">
                Code expires in {formatCountdown(secondsLeft)}
              </Text>
            </Column>
          )}

          <Row gap="$md" justifyContent="center" flexWrap="wrap">
            {(isExpired || (!session && !isStarting)) && (
              <Button
                butterVariant="primary"
                size="$4"
                onPress={onRegenerate}
                disabled={isStarting}
              >
                Generate a new code
              </Button>
            )}
            <Button butterVariant="secondary" size="$4" onPress={onClose}>
              {receivedCount > 0 ? "Done" : "Close"}
            </Button>
          </Row>
        </Column>
      </Column>
    </div>
  );

  return createPortal(modalContent, document.body);
}
