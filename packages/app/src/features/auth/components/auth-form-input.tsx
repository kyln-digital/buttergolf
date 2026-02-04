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
  secureTextEntry?: boolean;
  error?: string | null;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "numeric" | "decimal-pad" | "phone-pad";
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  textContentType?:
    | "emailAddress"
    | "password"
    | "newPassword"
    | "givenName"
    | "familyName"
    | "name"
    | "username"
    | "oneTimeCode"
    | "none";
  autoComplete?:
    | "email"
    | "password"
    | "password-new"
    | "name"
    | "name-given"
    | "name-family"
    | "username"
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
  secureTextEntry = false,
  error,
  autoCapitalize = "none",
  keyboardType = "default",
  editable = true,
  multiline = false,
  numberOfLines,
  textContentType,
  autoComplete,
}: Readonly<AuthFormInputProps>) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isPassword = secureTextEntry;
  const shouldShowPassword = isPassword && isPasswordVisible;

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
          secureTextEntry={isPassword && !shouldShowPassword}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          error={!!error}
          paddingRight={isPassword ? "$10" : "$4"}
          textContentType={textContentType}
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
            {shouldShowPassword ? (
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
