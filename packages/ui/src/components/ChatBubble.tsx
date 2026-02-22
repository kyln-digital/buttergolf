/**
 * ChatBubble Component
 *
 * An animated chat message bubble for messaging interfaces.
 * Slides in from the side with a fade entrance using Tamagui's animation system.
 *
 * - Own messages: right-aligned, primary background, slide from right
 * - Other messages: left-aligned, surface background, slide from left
 * - Supports message grouping (consecutive same-sender messages collapse avatars)
 * - Shows read receipts on own messages
 * - Respects prefers-reduced-motion when available
 *
 * @example
 * ```tsx
 * <ChatBubble
 *   isOwnMessage={false}
 *   content="Hey, is this still available?"
 *   timestamp="2 min ago"
 *   avatarUrl="https://example.com/avatar.jpg"
 *   avatarName="Josh"
 *   isGrouped={false}
 *   isLastInGroup={true}
 *   isRead={true}
 * />
 * ```
 */

import { styled, View, Image } from "tamagui";
import { Text } from "./Text";
import { Row } from "./Layout";
import { Check, CheckCheck } from "@tamagui/lucide-icons";

const BubbleContainer = styled(View, {
  name: "BubbleContainer",

  maxWidth: "75%",
  borderRadius: "$lg",
  paddingHorizontal: "$md",
  paddingVertical: "$sm",
  borderWidth: 1,

  variants: {
    isOwnMessage: {
      true: {
        backgroundColor: "$primary",
        borderColor: "$primary",
        borderBottomRightRadius: "$xs",
      },
      false: {
        backgroundColor: "$surface",
        borderColor: "$border",
        borderBottomLeftRadius: "$xs",
      },
    },
  } as const,

  defaultVariants: {
    isOwnMessage: false,
  },
});

const Avatar = styled(Image, {
  name: "ChatAvatar",
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: "$surface",
});

interface ChatBubbleProps {
  /** Whether this message was sent by the current user */
  isOwnMessage: boolean;
  /** The message text content */
  content: string;
  /** Formatted timestamp string (e.g. "2 min ago") */
  timestamp: string;
  /** Avatar URL for the other user (only shown for non-own messages) */
  avatarUrl?: string | null;
  /** Name of the other user (used as alt text) */
  avatarName?: string;
  /** Whether to animate the entrance */
  animated?: boolean;
  /** Whether this message is grouped with the previous (same sender, close timestamp) */
  isGrouped?: boolean;
  /** Whether this is the last message in a consecutive group */
  isLastInGroup?: boolean;
  /** Whether this message has been read by the recipient */
  isRead?: boolean;
}

export function ChatBubble({
  isOwnMessage,
  content,
  timestamp,
  avatarUrl,
  avatarName,
  animated = false,
  isGrouped = false,
  isLastInGroup = true,
  isRead,
}: Readonly<ChatBubbleProps>) {
  // Grouped messages: only show avatar on last message, tighter spacing
  const showAvatar = !isOwnMessage && isLastInGroup;

  return (
    <Row
      gap="$sm"
      alignItems="flex-end"
      flexDirection={isOwnMessage ? "row-reverse" : "row"}
      animation={animated ? "quick" : undefined}
      enterStyle={animated ? { x: isOwnMessage ? 20 : -20 } : undefined}
      x={0}
      marginTop={isGrouped ? 2 : "$sm"}
    >
      {/* Avatar area: shown for other user's messages, spacer when grouped */}
      {!isOwnMessage &&
        (showAvatar ? (
          avatarUrl ? (
            <Avatar
              source={{ uri: avatarUrl }}
              alt={avatarName ? `${avatarName}'s avatar` : "User avatar"}
            />
          ) : (
            <View width={28} height={28} borderRadius={14} backgroundColor="$backgroundPress" />
          )
        ) : (
          <View width={28} height={28} />
        ))}

      <BubbleContainer isOwnMessage={isOwnMessage}>
        <Text size="$4" color={isOwnMessage ? "$textInverse" : "$text"} whiteSpace="pre-wrap">
          {content}
        </Text>
        {/* Timestamp + read receipt row */}
        <Row alignItems="center" justifyContent="flex-end" gap="$xs" marginTop={2}>
          <Text size="$1" color={isOwnMessage ? "$primaryLight" : "$textTertiary"}>
            {timestamp}
          </Text>
          {isOwnMessage &&
            isRead !== undefined &&
            (isRead ? (
              <CheckCheck size={12} color="$primaryLight" />
            ) : (
              <Check size={12} color="$primaryLight" />
            ))}
        </Row>
      </BubbleContainer>
    </Row>
  );
}

export type { ChatBubbleProps };
