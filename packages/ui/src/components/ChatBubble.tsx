/**
 * ChatBubble Component
 *
 * An animated chat message bubble for messaging interfaces.
 * Slides in from the side with a fade entrance using Tamagui's animation system.
 *
 * - Own messages: right-aligned, primary background, slide from right
 * - Other messages: left-aligned, surface background, slide from left
 * - Respects prefers-reduced-motion
 *
 * @example
 * ```tsx
 * <ChatBubble
 *   isOwnMessage={false}
 *   content="Hey, is this still available?"
 *   timestamp="2 min ago"
 *   avatarUrl="https://example.com/avatar.jpg"
 *   avatarName="Josh"
 * />
 * ```
 */

import { styled, View, Image } from "tamagui";
import { Text } from "./Text";
import { Row } from "./Layout";

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
  width: 32,
  height: 32,
  borderRadius: 16,
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
}

export function ChatBubble({
  isOwnMessage,
  content,
  timestamp,
  avatarUrl,
  avatarName,
  animated = true,
}: Readonly<ChatBubbleProps>) {
  return (
    <Row
      gap="$sm"
      alignItems="flex-end"
      flexDirection={isOwnMessage ? "row-reverse" : "row"}
      animation={animated ? "medium" : undefined}
      enterStyle={animated ? { opacity: 0, x: isOwnMessage ? 20 : -20 } : undefined}
      opacity={1}
      x={0}
    >
      {!isOwnMessage && avatarUrl ? (
        <Avatar
          source={{ uri: avatarUrl }}
          alt={avatarName ? `${avatarName}'s avatar` : "User avatar"}
        />
      ) : !isOwnMessage ? (
        <View width={32} height={32} borderRadius={16} backgroundColor="$backgroundPress" />
      ) : null}

      <BubbleContainer isOwnMessage={isOwnMessage}>
        <Text size="$4" color={isOwnMessage ? "$textInverse" : "$text"} whiteSpace="pre-wrap">
          {content}
        </Text>
        <Text size="$2" color={isOwnMessage ? "$primaryLight" : "$textTertiary"} marginTop="$xs">
          {timestamp}
        </Text>
      </BubbleContainer>
    </Row>
  );
}

export type { ChatBubbleProps };
