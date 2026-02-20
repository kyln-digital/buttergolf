/**
 * Type declarations for react-native-otp-entry
 *
 * This package ships its own types but they may not resolve in the
 * shared packages/app workspace because the package is only installed
 * in the mobile app. This shim provides the subset we use.
 */
declare module "react-native-otp-entry" {
  import type { Ref } from "react";
  import type { TextStyle, ViewStyle } from "react-native";

  export interface OtpInputRef {
    clear: () => void;
    focus: () => void;
    setValue: (value: string) => void;
  }

  export interface OtpInputProps {
    numberOfDigits?: number;
    autoFocus?: boolean;
    focusColor?: string;
    onTextChange?: (text: string) => void;
    onFilled?: (text: string) => void;
    hideStick?: boolean;
    blurOnFilled?: boolean;
    disabled?: boolean;
    type?: "numeric" | "alphanumeric";
    secureTextEntry?: boolean;
    focusStickBlinkingDuration?: number;
    theme?: {
      containerStyle?: ViewStyle;
      pinCodeContainerStyle?: ViewStyle;
      pinCodeTextStyle?: TextStyle;
      focusStickStyle?: ViewStyle;
      focusedPinCodeContainerStyle?: ViewStyle;
      filledPinCodeContainerStyle?: ViewStyle;
      disabledPinCodeContainerStyle?: ViewStyle;
    };
    textInputProps?: Record<string, unknown>;
  }

  export const OtpInput: React.ForwardRefExoticComponent<
    OtpInputProps & React.RefAttributes<OtpInputRef>
  >;
}
