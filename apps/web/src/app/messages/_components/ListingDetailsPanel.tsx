"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, Column, Row, Text, Image, Badge, View } from "@buttergolf/ui";
import { Package, ExternalLink } from "@tamagui/lucide-icons";

interface ListingDetailsPanelProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productTitle: string;
  productImage: string | null;
  productPrice: number;
  productSold: boolean;
  otherUserName: string;
}

export function ListingDetailsPanel({
  open,
  onClose,
  productId,
  productTitle,
  productImage,
  productPrice,
  productSold,
  otherUserName,
}: Readonly<ListingDetailsPanelProps>) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      previouslyFocusedElementRef.current = activeElement;
    }

    // Focus the first focusable child so the focus trap works immediately
    // (focusing the container itself would let Shift+Tab escape the panel)
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (firstFocusable) {
      firstFocusable.focus();
    } else {
      panelRef.current?.focus();
    }

    return () => {
      previouslyFocusedElementRef.current?.focus();
      previouslyFocusedElementRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      // Focus trap: keep Tab cycling within the panel
      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        const active = document.activeElement;
        // Treat the panel container itself as being "before first",
        // so Shift+Tab from container wraps to last element.
        const atFirst = active === first || active === panelRef.current;
        const atLast = active === last;

        if (event.shiftKey && atFirst) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && atLast) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  const formattedPrice = useMemo(() => `£${productPrice.toFixed(2)}`, [productPrice]);

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- keyboard close handled via Escape listener above */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.42)",
          zIndex: 1040,
          opacity: open ? 1 : 0,
          transition: "opacity 220ms ease",
          pointerEvents: open ? "auto" : "none",
          cursor: "pointer",
        }}
        onClick={onClose}
        role="button"
        aria-label="Close panel"
        tabIndex={-1}
      />

      <View
        ref={panelRef}
        role="dialog"
        aria-modal={true}
        aria-labelledby="listing-details-panel-title"
        tabIndex={-1}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100dvh",
          width: "min(420px, 100vw)",
          zIndex: 1050,
          boxShadow: "-14px 0 42px rgba(0, 0, 0, 0.18)",
          borderLeft: "1px solid rgba(0, 0, 0, 0.08)",
          overflowY: "auto",
          transform: open ? "translateX(0)" : "translateX(100%)",
          opacity: open ? 1 : 0.98,
          transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease",
          willChange: "transform, opacity",
          pointerEvents: open ? "auto" : "none",
        }}
        backgroundColor="$surface"
      >
        <Column padding="$lg" gap="$lg" minHeight="100%">
          <Row alignItems="center" justifyContent="space-between">
            <Text id="listing-details-panel-title" size="$6" weight="bold" color="$text">
              Listing Details
            </Text>
            <Button chromeless size="$3" onPress={onClose}>
              Close
            </Button>
          </Row>

          <Column gap="$md">
            {productImage ? (
              <Image
                source={{ uri: productImage }}
                alt={productTitle}
                width="100%"
                height={220}
                borderRadius="$lg"
              />
            ) : (
              <Column
                width="100%"
                height={220}
                borderRadius="$lg"
                alignItems="center"
                justifyContent="center"
                backgroundColor="$backgroundHover"
                gap="$sm"
              >
                <Package size={26} color="$textSecondary" />
                <Text size="$3" color="$textSecondary">
                  No product image
                </Text>
              </Column>
            )}

            <Column gap="$xs">
              <Text size="$6" weight="bold" color="$text">
                {productTitle}
              </Text>
              <Text size="$3" color="$textSecondary">
                Shared in conversation with {otherUserName}
              </Text>
            </Column>

            <Row alignItems="center" justifyContent="space-between">
              <Text size="$7" weight="bold" color="$primary">
                {formattedPrice}
              </Text>
              {productSold ? (
                <Badge variant="warning" size="sm">
                  Sold
                </Badge>
              ) : (
                <Badge variant="success" size="sm">
                  Available
                </Badge>
              )}
            </Row>

            <Text size="$3" color="$textSecondary">
              Use this quick panel to confirm item details before continuing your conversation.
            </Text>
          </Column>

          <Row gap="$sm" marginTop="auto">
            <Button
              size="$4"
              butterVariant="primary"
              flex={1}
              onPress={() => {
                onClose();
                router.push(`/products/${productId}`);
              }}
            >
              <Row alignItems="center" gap="$xs">
                <Text color="$textInverse" weight="semibold">
                  Open Listing
                </Text>
                <ExternalLink size={14} color="$textInverse" />
              </Row>
            </Button>
            <Button size="$4" backgroundColor="$cloudMist" color="$text" onPress={onClose}>
              Back
            </Button>
          </Row>
        </Column>
      </View>
    </>
  );
}
