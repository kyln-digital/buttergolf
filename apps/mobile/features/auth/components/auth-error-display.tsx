"use client";

import React from "react";
import { Row, Column, Text } from "@buttergolf/ui";
import { AlertCircle, X } from "@tamagui/lucide-icons";
import { TouchableOpacity } from "react-native";

interface AuthErrorDisplayProps {
  error: string | null;
  onDismiss?: () => void;
  testID?: string;
}

/**
 * Displays authentication errors with consistent styling
 */
export function AuthErrorDisplay({ error, onDismiss, testID }: Readonly<AuthErrorDisplayProps>) {
  if (!error) return null;

  return (
    <Row
      backgroundColor="rgba(239, 68, 68, 0.1)" // Light red background
      borderColor="$error"
      borderWidth={1}
      borderRadius="$lg"
      padding="$3"
      gap="$3"
      alignItems="flex-start"
      testID={testID}
    >
      <AlertCircle size={20} color="$error" marginTop="$1" flexShrink={0} />

      <Column flex={1} gap="$1">
        <Text size="$4" fontWeight="600" color="$error">
          Error
        </Text>
        <Text size="$4" color="$error">
          {error}
        </Text>
      </Column>

      {onDismiss && (
        <TouchableOpacity onPress={onDismiss}>
          <X size={20} color="$error" />
        </TouchableOpacity>
      )}
    </Row>
  );
}
