"use client";

import { useEffect, useMemo } from "react";
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

  const formattedPrice = useMemo(() => `£${productPrice.toFixed(2)}`, [productPrice]);

  return (
    <>
      <View
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
        }}
        onPress={onClose}
      />

      <View
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
            <Text size="$6" weight="bold" color="$text">
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
