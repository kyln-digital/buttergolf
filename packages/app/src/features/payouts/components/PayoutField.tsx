"use client";

import { Column, Input, Text, type InputProps } from "@buttergolf/ui";

export interface PayoutFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Message shown under the field; also switches the input to its error style. */
  error?: string;
  /** Adds "(optional)" next to the label. */
  optional?: boolean;
  disabled?: boolean;
  autoCapitalize?: InputProps["autoCapitalize"];
  autoComplete?: InputProps["autoComplete"];
  keyboardType?: InputProps["keyboardType"];
  inputMode?: InputProps["inputMode"];
  maxLength?: number;
  /** Helper copy shown under the field when there is no error. */
  hint?: string;
  flex?: number;
}

/**
 * A labelled text field for the payout forms: label, input, error or hint.
 * Kept local to the feature — the design system has no Field component yet.
 */
export function PayoutField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  optional = false,
  disabled = false,
  autoCapitalize,
  autoComplete,
  keyboardType,
  inputMode,
  maxLength,
  hint,
  flex,
}: Readonly<PayoutFieldProps>) {
  return (
    <Column gap="$xs" flex={flex} minWidth={0}>
      <Text size="$3" color="$textSecondary" fontWeight="500">
        {optional ? `${label} (optional)` : label}
      </Text>
      <Input
        size="lg"
        fullWidth
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={!disabled}
        error={error ? true : undefined}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        inputMode={inputMode}
        maxLength={maxLength}
        accessibilityLabel={label}
      />
      {error ? (
        <Text size="$2" color="$error">
          {error}
        </Text>
      ) : null}
      {!error && hint ? (
        <Text size="$2" color="$textMuted">
          {hint}
        </Text>
      ) : null}
    </Column>
  );
}
