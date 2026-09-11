"use client";

import React, { useCallback, useState } from "react";
import Svg, { Path } from "react-native-svg";
import { brandColors } from "@buttergolf/config";
import { Button, Column, Row, Spinner, Text, View, useTheme } from "@buttergolf/ui";
import { isClerkAPIResponseError, useSSO } from "@clerk/clerk-expo";

type SocialStrategy = "oauth_apple" | "oauth_google";

const PROVIDERS: ReadonlyArray<{ strategy: SocialStrategy; label: string }> = [
  { strategy: "oauth_apple", label: "Continue with Apple" },
  { strategy: "oauth_google", label: "Continue with Google" },
];

const LOGO_SIZE = 20;

/** Both sign-in and sign-up show this, so the fallback stays neutral. */
function getSsoErrorMessage(err: unknown): string {
  if (isClerkAPIResponseError(err)) {
    const first = err.errors[0];
    const message = first?.longMessage || first?.message;
    if (message) return message;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

/** Apple's logo in a single colour, as its guidelines require it to match the label. */
function AppleLogo({ color }: Readonly<{ color: string }>) {
  return (
    <Svg width={LOGO_SIZE} height={LOGO_SIZE} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </Svg>
  );
}

/** Google's "G". Its brand guidelines fix these four colours, so they don't follow the theme. */
function GoogleLogo() {
  return (
    <Svg width={LOGO_SIZE} height={LOGO_SIZE} viewBox="0 0 48 48">
      <Path
        fill={brandColors.googleRed}
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill={brandColors.googleBlue}
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill={brandColors.googleYellow}
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill={brandColors.googleGreen}
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

interface SocialButtonProps {
  strategy: SocialStrategy;
  label: string;
  isPending: boolean;
  disabled: boolean;
  logoColor: string;
  onPress: (strategy: SocialStrategy) => void;
}

function SocialButton({
  strategy,
  label,
  isPending,
  disabled,
  logoColor,
  onPress,
}: Readonly<SocialButtonProps>) {
  const handlePress = useCallback(() => onPress(strategy), [onPress, strategy]);
  const logo = strategy === "oauth_apple" ? <AppleLogo color={logoColor} /> : <GoogleLogo />;

  return (
    <Button
      size="$5"
      borderRadius="$full"
      backgroundColor="$background"
      borderColor="$border"
      borderWidth={1}
      color="$text"
      fontWeight="600"
      icon={isPending ? <Spinner size="sm" color="$text" /> : logo}
      onPress={handlePress}
      disabled={disabled}
      opacity={disabled && !isPending ? 0.6 : 1}
    >
      {label}
    </Button>
  );
}

interface SocialAuthButtonsProps {
  /** Called once the new session is active */
  onSuccess?: () => void;
  /** Receives a user-facing message for the host screen's error banner */
  onError?: (message: string) => void;
  /** Called when the account has two-factor auth, so the host can collect the code */
  onNeedsSecondFactor?: () => void;
  /** Disables the buttons while the host's own form is submitting */
  disabled?: boolean;
}

/**
 * "Continue with Apple / Google" buttons plus the divider above the email form.
 *
 * Runs Clerk's browser-based SSO flow, which returns to buttergolf://sso-callback.
 * That URL must stay on the Clerk production instance's mobile SSO redirect allowlist.
 */
export function SocialAuthButtons({
  onSuccess,
  onError,
  onNeedsSecondFactor,
  disabled = false,
}: Readonly<SocialAuthButtonsProps>) {
  const { startSSOFlow } = useSSO();
  const theme = useTheme();
  const logoColor = theme.text?.val ?? brandColors.ironstone;
  const [pending, setPending] = useState<SocialStrategy | null>(null);

  const handlePress = useCallback(
    async (strategy: SocialStrategy) => {
      setPending(strategy);
      try {
        const { createdSessionId, setActive, signIn, signUp } = await startSSOFlow({ strategy });

        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          onSuccess?.();
        } else if (signIn?.status === "needs_second_factor") {
          onNeedsSecondFactor?.();
        } else if (signUp?.status === "missing_requirements") {
          onError?.("We couldn't finish creating your account that way. Please use email instead.");
        }
        // Anything else means the user closed the browser sheet: nothing to report.
      } catch (err) {
        console.error("[SocialAuth] SSO failed:", err);
        onError?.(getSsoErrorMessage(err));
      } finally {
        setPending(null);
      }
    },
    [startSSOFlow, onSuccess, onError, onNeedsSecondFactor]
  );

  return (
    <Column gap="$md">
      <Column gap="$sm">
        {PROVIDERS.map(({ strategy, label }) => (
          <SocialButton
            key={strategy}
            strategy={strategy}
            label={label}
            isPending={pending === strategy}
            disabled={disabled || pending !== null}
            logoColor={logoColor}
            onPress={handlePress}
          />
        ))}
      </Column>

      <Row alignItems="center" gap="$sm">
        <View flex={1} height={1} backgroundColor="$border" />
        <Text size="$3" color="$textSecondary">
          or use your email
        </Text>
        <View flex={1} height={1} backgroundColor="$border" />
      </Row>
    </Column>
  );
}
