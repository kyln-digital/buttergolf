/**
 * ConversationListItem Component
 *
 * An animated conversation preview card for inbox/message list views.
 * Shows product thumbnail, other user, last message preview, timestamp, and unread badge.
 *
 * @example
 * ```tsx
 * <ConversationListItem
 *   productImage="https://example.com/product.jpg"
 *   productTitle="TaylorMade Driver"
 *   otherUserName="Josh"
 *   lastMessage="Is this still available?"
 *   timestamp="2 min ago"
 *   unreadCount={3}
 *   onPress={() => router.push(`/messages/${orderId}`)}
 * />
 * ```
 */

import { styled, View, Image } from "tamagui";
import { Text } from "./Text";
import { Row, Column } from "./Layout";
import { Card } from "./Card";
import { Package, ChevronRight } from "@tamagui/lucide-icons";

const ListItemCard = styled(Card, {
  name: "ConversationListItem",

  variant: "outlined",
  padding: "$md",
  cursor: "pointer",

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — animation in styled() base works at runtime; TS types for styled config don't include it
  animation: "fast",

  hoverStyle: {
    borderColor: "$primary",
    backgroundColor: "$backgroundHover",
  },

  pressStyle: {
    scale: 0.98,
    opacity: 0.95,
  },
});

const UnreadBadge = styled(View, {
  name: "UnreadBadge",

  backgroundColor: "$primary",
  borderRadius: "$full",
  minWidth: 22,
  height: 22,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: "$xs",
});

const ProductThumbnail = styled(Image, {
  name: "ConversationProductThumbnail",
  width: 52,
  height: 52,
  borderRadius: "$md",
});

interface ConversationListItemProps {
  /** Product image URL */
  productImage?: string | null;
  /** Product title */
  productTitle: string;
  /** Other user's display name */
  otherUserName: string;
  /** Last message preview text */
  lastMessage?: string | null;
  /** Formatted timestamp of last message */
  timestamp: string;
  /** Number of unread messages */
  unreadCount?: number;
  /** Press handler */
  onPress?: () => void;
}

export function ConversationListItem({
  productImage,
  productTitle,
  otherUserName,
  lastMessage,
  timestamp,
  unreadCount = 0,
  onPress,
}: Readonly<ConversationListItemProps>) {
  return (
    <ListItemCard
      onPress={onPress}
      animation="medium"
      enterStyle={{ opacity: 0, y: 10 }}
      opacity={1}
      y={0}
    >
      <Row gap="$md" alignItems="center">
        {/* Product Image */}
        {productImage ? (
          <ProductThumbnail source={{ uri: productImage }} alt={productTitle} />
        ) : (
          <Column
            width={52}
            height={52}
            borderRadius="$md"
            backgroundColor="$backgroundHover"
            alignItems="center"
            justifyContent="center"
          >
            <Package size={22} color="$textSecondary" />
          </Column>
        )}

        {/* Conversation Details */}
        <Column flex={1} gap="$xs">
          <Row justifyContent="space-between" alignItems="center">
            <Text weight={unreadCount > 0 ? "semibold" : "normal"} numberOfLines={1} flex={1}>
              {otherUserName}
            </Text>
            <Text size="$2" color="$textTertiary">
              {timestamp}
            </Text>
          </Row>

          <Text size="$3" color="$textSecondary" numberOfLines={1}>
            {productTitle}
          </Text>

          {lastMessage && (
            <Text
              size="$4"
              color={unreadCount > 0 ? "$text" : "$textSecondary"}
              weight={unreadCount > 0 ? "semibold" : "normal"}
              numberOfLines={1}
            >
              {lastMessage}
            </Text>
          )}
        </Column>

        {/* Right section: unread badge or chevron */}
        {unreadCount > 0 ? (
          <UnreadBadge>
            <Text size="$2" color="$textInverse" weight="bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Text>
          </UnreadBadge>
        ) : (
          <ChevronRight size={18} color="$textTertiary" />
        )}
      </Row>
    </ListItemCard>
  );
}

export type { ConversationListItemProps };
