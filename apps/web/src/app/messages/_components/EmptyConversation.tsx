"use client";

import { Column, Text } from "@buttergolf/ui";
import { MessageSquare } from "@tamagui/lucide-icons";

export function EmptyConversation() {
  return (
    <Column
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$lg"
      padding="$xl"
      animation="medium"
      enterStyle={{ opacity: 0, y: 10 }}
      opacity={1}
      y={0}
    >
      <Column
        backgroundColor="$backgroundHover"
        borderRadius="$full"
        width={80}
        height={80}
        alignItems="center"
        justifyContent="center"
      >
        <MessageSquare size={36} color="$textSecondary" />
      </Column>
      <Text size="$6" fontWeight="600" color="$text">
        Select a conversation
      </Text>
      <Text size="$4" color="$textSecondary" textAlign="center" maxWidth={280}>
        Choose a conversation from the list to start messaging.
      </Text>
    </Column>
  );
}
