/**
 * ChatInput Component
 *
 * A full-width message input bar with integrated send button for chat interfaces.
 * Includes character counter near limit, Enter-to-send on web, and animated send button.
 *
 * @example
 * ```tsx
 * <ChatInput
 *   value={message}
 *   onChangeText={setMessage}
 *   onSend={handleSend}
 *   sending={isSending}
 *   maxLength={2000}
 * />
 * ```
 */

"use client";

import { useRef, useEffect } from "react";
import { Platform, type TextInput } from "react-native";
import { styled, View } from "tamagui";
import { Text } from "./Text";
import { Button } from "./Button";
import { TextArea } from "./TextArea";
import { Row, Column } from "./Layout";
import { Spinner } from "./Spinner";
import { Send } from "@tamagui/lucide-icons";

const InputContainer = styled(View, {
  name: "ChatInputContainer",

  gap: "$md",
  paddingHorizontal: "$md",
  paddingVertical: "$sm",
  borderTopWidth: 1,
  borderTopColor: "$border",
  backgroundColor: "$surface",
});

const SendButton = styled(Button, {
  name: "ChatSendButton",

  backgroundColor: "$primary",
  borderRadius: "$full",
  width: 44,
  height: 44,
  padding: 0,
  alignItems: "center",
  justifyContent: "center",

  animation: "quick",

  pressStyle: {
    scale: 0.9,
    opacity: 0.9,
  },

  disabledStyle: {
    opacity: 0.4,
  },
});

interface ChatInputProps {
  /** Current input value */
  value: string;
  /** Called when input text changes */
  onChangeText: (text: string) => void;
  /** Called when user sends a message */
  onSend: () => void;
  /** Whether a message is currently being sent */
  sending?: boolean;
  /** Maximum message length */
  maxLength?: number;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

export function ChatInput({
  value,
  onChangeText,
  onSend,
  sending = false,
  maxLength = 2000,
  placeholder = "Type a message...",
  disabled = false,
}: Readonly<ChatInputProps>) {
  const isOverLimit = value.length > maxLength;
  const showCounter = value.length > maxLength * 0.8;
  const canSend = value.trim().length > 0 && !isOverLimit && !sending && !disabled;
  const canSendRef = useRef(canSend);
  canSendRef.current = canSend;

  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;

  const textAreaRef = useRef<TextInput>(null);

  // Attach web-only keydown listener for Enter-to-send
  useEffect(() => {
    if (Platform.OS !== "web") return;
    // On web, the underlying element is an HTMLTextAreaElement
    const el = (textAreaRef.current as unknown as HTMLTextAreaElement) ?? null;
    if (!el) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (canSendRef.current) {
          onSendRef.current();
        }
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, []);

  return (
    <InputContainer>
      <Row alignItems="flex-end" gap="$sm">
        <Column flex={1} gap="$xs">
          <TextArea
            ref={textAreaRef}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={canSend ? onSend : undefined}
            placeholder={placeholder}
            size="md"
            rows={1}
            maxLength={maxLength + 100}
            error={isOverLimit}
            disabled={sending || disabled}
            borderRadius="$full"
            minHeight={44}
            focusStyle={{
              borderColor: "$primary",
              borderWidth: 2,
            }}
          />
          {showCounter && (
            <Row justifyContent="flex-end" paddingHorizontal="$sm">
              <Text size="$2" color={isOverLimit ? "$error" : "$textTertiary"}>
                {value.length}/{maxLength}
              </Text>
            </Row>
          )}
        </Column>

        <SendButton onPress={onSend} disabled={!canSend} aria-label="Send message">
          {sending ? (
            <Spinner size="sm" color="$textInverse" />
          ) : (
            <Send size={20} color="$textInverse" />
          )}
        </SendButton>
      </Row>
    </InputContainer>
  );
}

export type { ChatInputProps };
