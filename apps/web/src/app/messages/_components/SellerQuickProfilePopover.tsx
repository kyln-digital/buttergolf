"use client";

import type { ReactNode } from "react";
import {
  Button,
  Column,
  Row,
  Text,
  Popover,
  Image,
  PopoverAdapt,
  PopoverSheet,
  PopoverSheetOverlay,
  PopoverSheetFrame,
  PopoverSheetHandle,
  PopoverSheetScrollView,
  AdaptContents,
} from "@buttergolf/ui";
import { Star } from "@tamagui/lucide-icons";

interface SellerQuickProfilePopoverProps {
  sellerName: string;
  sellerImageUrl?: string | null;
  averageRating?: number | null;
  ratingCount?: number | null;
  userRole: "buyer" | "seller";
  trigger: ReactNode;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatRating(averageRating?: number | null): string {
  if (!averageRating || averageRating <= 0) {
    return "New seller";
  }

  return averageRating.toFixed(1);
}

export function SellerQuickProfilePopover({
  sellerName,
  sellerImageUrl,
  averageRating,
  ratingCount,
  userRole,
  trigger,
}: Readonly<SellerQuickProfilePopoverProps>) {
  const safeRatingCount = ratingCount ?? 0;

  return (
    <Popover placement="top" offset={12}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>

      <PopoverAdapt when="sm" platform="touch">
        <PopoverSheet modal snapPoints={[55]} dismissOnSnapToBottom>
          <PopoverSheetOverlay
            animation="lazy"
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
          <PopoverSheetFrame
            backgroundColor="$surface"
            borderTopLeftRadius="$xl"
            borderTopRightRadius="$xl"
          >
            <PopoverSheetHandle />
            <PopoverSheetScrollView>
              <Column padding="$md">
                <AdaptContents />
              </Column>
            </PopoverSheetScrollView>
          </PopoverSheetFrame>
        </PopoverSheet>
      </PopoverAdapt>

      <Popover.Content
        backgroundColor="$surface"
        borderRadius="$lg"
        padding="$4"
        borderWidth={1}
        borderColor="$border"
        elevate
        boxShadow="0px 12px 30px rgba(0, 0, 0, 0.16)"
      >
        <Popover.Arrow
          size="$2"
          offset={10}
          borderWidth={1}
          borderColor="$border"
          backgroundColor="$surface"
        />

        <Column gap="$3" width={280}>
          <Row gap="$md" alignItems="center">
            {sellerImageUrl ? (
              <Column
                width={48}
                height={48}
                borderRadius={24}
                overflow="hidden"
                backgroundColor="$backgroundHover"
              >
                <Image
                  source={{ uri: sellerImageUrl }}
                  alt={sellerName}
                  width="100%"
                  height="100%"
                />
              </Column>
            ) : (
              <Column
                width={48}
                height={48}
                borderRadius={24}
                alignItems="center"
                justifyContent="center"
                backgroundColor="$backgroundHover"
              >
                <Text size="$4" weight="bold" color="$textSecondary">
                  {getInitials(sellerName)}
                </Text>
              </Column>
            )}

            <Column flex={1} gap="$xs">
              <Text size="$5" weight="semibold" color="$text" numberOfLines={1}>
                {sellerName}
              </Text>
              <Text size="$2" color="$textSecondary" textTransform="uppercase" weight="semibold">
                {userRole === "buyer" ? "Seller" : "Buyer"}
              </Text>
            </Column>
          </Row>

          {userRole === "buyer" ? (
            <Row alignItems="center" gap="$xs">
              <Star size={14} color="$warning" />
              <Text size="$3" weight="semibold" color="$text">
                {formatRating(averageRating)}
              </Text>
              {safeRatingCount > 0 && (
                <Text size="$3" color="$textSecondary">
                  ({safeRatingCount} ratings)
                </Text>
              )}
            </Row>
          ) : null}

          <Text size="$3" color="$textSecondary">
            Quick profile card from your inbox. Open the listing from this thread for full product
            and offer context.
          </Text>

          <Popover.Close asChild>
            <Button
              size="$3"
              backgroundColor="$cloudMist"
              color="$text"
              borderRadius="$full"
              alignSelf="flex-start"
            >
              Close
            </Button>
          </Popover.Close>
        </Column>
      </Popover.Content>
    </Popover>
  );
}
