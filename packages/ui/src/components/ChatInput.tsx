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
import { Input } from "./Input";
import { TextArea } from "./TextArea";
import { Row, Column } from "./Layout";
import { Spinner } from "./Spinner";
import { Send, Tag, X } from "@tamagui/lucide-icons";

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
  noTextWrap: true,

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — animation in styled() base works at runtime; TS types for styled config don't include it
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
  /** Whether to show the offer toggle button */
  showOfferButton?: boolean;
  /** Whether offer mode is currently active */
  offerMode?: boolean;
  /** Called to toggle offer mode on/off */
  onToggleOfferMode?: () => void;
  /** Current offer amount (in pounds) */
  offerAmount?: string;
  /** Called when offer amount changes */
  onOfferAmountChange?: (amount: string) => void;
  /** Called when user sends an offer */
  onSendOffer?: (amount: number, message?: string) => void;
}

export function ChatInput({
  value,
  onChangeText,
  onSend,
  sending = false,
  maxLength = 2000,
  placeholder = "Type a message...",
  disabled = false,
  showOfferButton = false,
  offerMode = false,
  onToggleOfferMode,
  offerAmount = "",
  onOfferAmountChange,
  onSendOffer,
}: Readonly<ChatInputProps>) {
  const isOverLimit = value.length > maxLength;
  const showCounter = value.length > maxLength * 0.8;

  const parsedAmount = parseFloat(offerAmount);
  const validOffer = offerMode && !isNaN(parsedAmount) && parsedAmount > 0;

  const canSend = offerMode
    ? validOffer && !sending && !disabled
    : value.trim().length > 0 && !isOverLimit && !sending && !disabled;

  const canSendRef = useRef(canSend);
  // eslint-disable-next-line react-hooks/refs -- "latest ref" pattern: intentional sync during render to avoid stale closures in effects
  canSendRef.current = canSend;

  const handleSend = () => {
    if (offerMode && validOffer && onSendOffer) {
      onSendOffer(parsedAmount, value.trim() || undefined);
    } else if (!offerMode) {
      onSend();
    }
  };

  const onSendRef = useRef(handleSend);
  // eslint-disable-next-line react-hooks/refs -- "latest ref" pattern: intentional sync during render to avoid stale closures in effects
  onSendRef.current = handleSend;

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
      {offerMode && (
        <Row alignItems="center" gap="$sm" paddingBottom="$xs">
          <Row
            flex={1}
            alignItems="center"
            gap="$sm"
            backgroundColor="$primaryLight"
            borderRadius="$lg"
            paddingHorizontal="$md"
            paddingVertical="$sm"
          >
            <Text size="$6" fontWeight="700" color="$primary">
              £
            </Text>
            <Input
              value={offerAmount}
              onChangeText={(text) => {
                // Allow only numbers and one decimal point
                const sanitised = text.replace(/[^0-9.]/g, "").replace(/(\..*?)\./g, "$1");
                onOfferAmountChange?.(sanitised);
              }}
              placeholder="0.00"
              size="md"
              keyboardType="decimal-pad"
              flex={1}
              borderWidth={0}
              backgroundColor="transparent"
              paddingHorizontal={0}
            />
          </Row>
          <Button
            chromeless
            size="$3"
            onPress={onToggleOfferMode}
            aria-label="Cancel offer"
            padding="$xs"
          >
            <X size={18} color="$textSecondary" />
          </Button>
        </Row>
      )}

      <Row alignItems="flex-end" gap="$sm">
        {showOfferButton && !offerMode && (
          <Button
            chromeless
            size="$3"
            onPress={onToggleOfferMode}
            aria-label="Make an offer"
            padding="$xs"
            marginBottom={6}
          >
            <Tag size={22} color="$primary" />
          </Button>
        )}

        <Column flex={1} gap="$xs">
          <TextArea
            ref={textAreaRef}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={canSend ? handleSend : undefined}
            placeholder={offerMode ? "Add a message (optional)..." : placeholder}
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

        <SendButton
          onPress={handleSend}
          disabled={!canSend}
          aria-label={offerMode ? "Send offer" : "Send message"}
          backgroundColor={offerMode ? "$success" : "$primary"}
        >
          {sending ? (
            <Spinner size="sm" color="$textInverse" />
          ) : offerMode ? (
            <Tag size={20} color="$textInverse" />
          ) : (
            <Send size={20} color="$textInverse" />
          )}
        </SendButton>
      </Row>
    </InputContainer>
  );
}

export type { ChatInputProps };
