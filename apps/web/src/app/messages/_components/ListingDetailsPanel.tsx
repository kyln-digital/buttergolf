"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Column, Row, Text, Image, Badge } from "@buttergolf/ui";
import { Package, ExternalLink } from "@tamagui/lucide-icons";
import { Sheet } from "@tamagui/sheet";

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
  const [position, setPosition] = useState(0);

  const formattedPrice = useMemo(() => `£${productPrice.toFixed(2)}`, [productPrice]);

  return (
    <Sheet
      forceRemoveScrollEnabled={open}
      modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      snapPoints={[80, 60]}
      snapPointsMode="percent"
      position={position}
      onPositionChange={setPosition}
      dismissOnSnapToBottom
      zIndex={1050}
      animation="medium"
    >
      <Sheet.Overlay
        animation="lazy"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
        backgroundColor="$overlayDark50"
      />

      <Sheet.Handle />

      <Sheet.Frame
        backgroundColor="$surface"
        borderTopLeftRadius="$xl"
        borderTopRightRadius="$xl"
        paddingBottom="$xl"
        elevation={10}
        style={{ boxShadow: "0 -8px 32px rgba(0,0,0,0.18)" }}
      >
        <Sheet.ScrollView>
          <Column
            padding="$lg"
            gap="$lg"
            width="100%"
            maxWidth={560}
            alignSelf="center"
            $gtMd={{ width: "70%", maxWidth: "70%" }}
            $gtLg={{ width: "60%", maxWidth: "60%" }}
          >
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

            <Row gap="$sm" marginTop="$md">
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
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}
