"use client";

import React, { useState } from "react";
import { Column, Text, Input } from "@buttergolf/ui";
import { Eye, EyeOff } from "@tamagui/lucide-icons";
import { TouchableOpacity } from "react-native";

interface AuthFormInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** Input type (web-first). Use "password" for secure fields, "email" for email fields. */
  type?: "text" | "email" | "password" | "tel" | "number";
  error?: string | null;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  /** Input mode hint for virtual keyboards (web-first, maps to keyboardType on native). */
  inputMode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  autoComplete?:
    | "email"
    | "current-password"
    | "new-password"
    | "name"
    | "given-name"
    | "family-name"
    | "username"
    | "one-time-code"
    | "off";
}

/**
 * Reusable form input component with error display
 * and optional password visibility toggle
 */
export function AuthFormInput({
  label,
  value,
  onChangeText,
  placeholder,
  type = "text",
  error,
  autoCapitalize = "none",
  inputMode,
  editable = true,
  multiline = false,
  numberOfLines,
  autoComplete,
}: Readonly<AuthFormInputProps>) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isPassword = type === "password";
  const resolvedType = isPassword && isPasswordVisible ? "text" : type;

  return (
    <Column gap="$2">
      <Text size="$4" fontWeight="600" color="$text">
        {label}
      </Text>

      <Column position="relative">
        <Input
          size="md"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(84, 84, 84, 0.7)"
          type={resolvedType}
          autoCapitalize={autoCapitalize}
          inputMode={inputMode}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          error={!!error}
          paddingRight={isPassword ? "$10" : "$4"}
          autoComplete={autoComplete}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: [{ translateY: -12 }],
            }}
          >
            {isPasswordVisible ? (
              <Eye size={20} color="$textSecondary" />
            ) : (
              <EyeOff size={20} color="$textSecondary" />
            )}
          </TouchableOpacity>
        )}
      </Column>

      {error && (
        <Text size="$3" color="$error" marginTop="$1">
          {error}
        </Text>
      )}
    </Column>
  );
}
