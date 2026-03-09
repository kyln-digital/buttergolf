/**
 * ConversationListItem Component
 *
 * A modern conversation preview row for inbox/message list views.
 * Follows WhatsApp/iMessage style: user avatar, product context,
 * last message preview, timestamp, unread badge, and offer status.
 *
 * @example
 * ```tsx
 * <ConversationListItem
 *   productImage="https://example.com/product.jpg"
 *   productTitle="TaylorMade Driver"
 *   otherUserName="Josh"
 *   otherUserImage="https://example.com/avatar.jpg"
 *   lastMessage="Is this still available?"
 *   timestamp="2 min ago"
 *   unreadCount={3}
 *   latestOfferStatus="PENDING"
 *   latestOfferAmount={120}
 *   onPress={() => router.push(`/messages/${id}`)}
 * />
 * ```
 */

import { styled, View, Image } from "tamagui";
import { Text } from "./Text";
import { Row, Column } from "./Layout";
import { User, Package } from "@tamagui/lucide-icons";

const ListItemRow = styled(View, {
  name: "ConversationListItem",

  paddingHorizontal: "$md",
  paddingVertical: "$md",
  cursor: "pointer",
  borderBottomWidth: 1,
  borderBottomColor: "$border",

  hoverStyle: {
    backgroundColor: "$backgroundHover",
  },

  pressStyle: {
    opacity: 0.7,
  },
});

const UnreadDot = styled(View, {
  name: "UnreadDot",

  backgroundColor: "$primary",
  borderRadius: "$full",
  minWidth: 20,
  height: 20,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: "$xs",
});

const AvatarImage = styled(Image, {
  name: "ConversationAvatar",
  width: 52,
  height: 52,
  borderRadius: 26,
});

const ProductThumb = styled(Image, {
  name: "ConversationProductThumb",
  width: 28,
  height: 28,
  borderRadius: "$sm",
  position: "absolute",
  bottom: -2,
  right: -2,
  borderWidth: 2,
  borderColor: "$background",
});

const OfferBadge = styled(View, {
  name: "OfferBadge",
  borderRadius: "$full",
  paddingHorizontal: "$sm",
  paddingVertical: 2,
});

interface ConversationListItemProps {
  /** Product image URL */
  productImage?: string | null;
  /** Product title */
  productTitle: string;
  /** Other user's display name */
  otherUserName: string;
  /** Other user's avatar URL */
  otherUserImage?: string | null;
  /** Last message preview text */
  lastMessage?: string | null;
  /** Formatted timestamp of last message */
  timestamp: string;
  /** Number of unread messages */
  unreadCount?: number;
  /** User's role in this conversation */
  userRole?: "buyer" | "seller";
  /** Latest offer status for inbox row */
  latestOfferStatus?: string | null;
  /** Latest offer amount for inbox row */
  latestOfferAmount?: number | null;
  /** Whether the product has been sold */
  productSold?: boolean;
  /** Press handler */
  onPress?: () => void;
}

function OfferStatusBadge({ status, amount }: { status: string; amount?: number | null }) {
  let label = "";
  let bg: "$warning" | "$info" | "$success";

  switch (status) {
    case "PENDING":
      bg = "$warning";
      label = `Offer £${amount?.toFixed(0) ?? ""}`;
      break;
    case "COUNTERED":
      bg = "$info";
      label = `Counter £${amount?.toFixed(0) ?? ""}`;
      break;
    case "ACCEPTED":
      bg = "$success";
      label = "Accepted";
      break;
    default:
      return null;
  }

  return (
    <OfferBadge backgroundColor={bg}>
      <Text size="$1" color="$textInverse" fontWeight="700">
        {label}
      </Text>
    </OfferBadge>
  );
}

export function ConversationListItem({
  productImage,
  productTitle,
  otherUserName,
  otherUserImage,
  lastMessage,
  timestamp,
  unreadCount = 0,
  userRole,
  latestOfferStatus,
  latestOfferAmount,
  productSold,
  onPress,
}: Readonly<ConversationListItemProps>) {
  const hasUnread = unreadCount > 0;

  return (
    <ListItemRow onPress={onPress}>
      <Row gap="$md" alignItems="center">
        {/* Avatar with optional product thumbnail overlay */}
        <View width={52} height={52}>
          {otherUserImage ? (
            <AvatarImage source={{ uri: otherUserImage }} alt={otherUserName} />
          ) : (
            <Column
              width={52}
              height={52}
              borderRadius={26}
              backgroundColor="$backgroundHover"
              alignItems="center"
              justifyContent="center"
            >
              <User size={24} color="$textSecondary" />
            </Column>
          )}
          {productImage ? (
            <ProductThumb source={{ uri: productImage }} alt={productTitle} />
          ) : (
            <Column
              width={28}
              height={28}
              borderRadius="$sm"
              backgroundColor="$surface"
              borderWidth={2}
              borderColor="$background"
              alignItems="center"
              justifyContent="center"
              position="absolute"
              bottom={-2}
              right={-2}
            >
              <Package size={14} color="$textTertiary" />
            </Column>
          )}
        </View>

        {/* Conversation Details */}
        <Column flex={1} gap={2}>
          {/* Row 1: Name + timestamp */}
          <Row justifyContent="space-between" alignItems="center">
            <Text
              size="$5"
              weight={hasUnread ? "bold" : "semibold"}
              numberOfLines={1}
              flex={1}
              color={hasUnread ? "$text" : "$text"}
            >
              {otherUserName}
            </Text>
            <Text
              size="$2"
              color={hasUnread ? "$primary" : "$textTertiary"}
              fontWeight={hasUnread ? "600" : "400"}
            >
              {timestamp}
            </Text>
          </Row>

          {/* Row 2: Product title + role */}
          <Row alignItems="center" gap="$xs">
            <Text size="$3" color="$textSecondary" numberOfLines={1} flex={1}>
              {productTitle}
              {productSold ? " · Sold" : ""}
            </Text>
            {userRole && (
              <Text size="$1" color="$textTertiary" textTransform="uppercase" fontWeight="600">
                {userRole}
              </Text>
            )}
          </Row>

          {/* Row 3: Last message + unread/offer badge */}
          <Row alignItems="center" gap="$sm">
            <Text
              size="$4"
              color={hasUnread ? "$text" : "$textSecondary"}
              weight={hasUnread ? "semibold" : "normal"}
              numberOfLines={1}
              flex={1}
            >
              {lastMessage || "No messages yet"}
            </Text>
            {latestOfferStatus && (
              <OfferStatusBadge status={latestOfferStatus} amount={latestOfferAmount} />
            )}
            {hasUnread && !latestOfferStatus && (
              <UnreadDot>
                <Text size="$1" color="$textInverse" weight="bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </UnreadDot>
            )}
          </Row>
        </Column>
      </Row>
    </ListItemRow>
  );
}

export type { ConversationListItemProps };
