"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Column, Text, Spinner } from "@buttergolf/ui";

/**
 * /seller/onboarding/complete
 *
 * Web redirect page for Stripe Connect onboarding completion.
 * Stripe redirects here after onboarding, then we redirect to the mobile app via deep link.
 *
 * This page exists because Stripe requires HTTPS URLs for return_url/refresh_url,
 * but mobile apps need deep links to return to the app.
 */
export default function SellerOnboardingCompletePage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Build deep link with any query params Stripe passed
    const params = searchParams.toString();
    const deepLink = `buttergolf://seller/onboarding/complete${params ? `?${params}` : ""}`;

    console.info("[SellerOnboardingComplete] Redirecting to deep link:", deepLink);

    // Redirect to the mobile app
    window.location.href = deepLink;
  }, [searchParams]);

  return (
    <Column
      flex={1}
      alignItems="center"
      justifyContent="center"
      padding="$xl"
      gap="$lg"
      minHeight="100vh"
      backgroundColor="$background"
    >
      <Spinner size="lg" color="$primary" />
      <Text size="$6" color="$text" textAlign="center">
        Returning to the ButterGolf app...
      </Text>
      <Text size="$4" color="$textSecondary" textAlign="center">
        If the app doesn&apos;t open automatically,{" "}
        <Text
          size="$4"
          color="$primary"
          onPress={() => {
            window.location.href = "buttergolf://seller/onboarding/complete";
          }}
          style={{ textDecorationLine: "underline", cursor: "pointer" }}
        >
          tap here
        </Text>
      </Text>
    </Column>
  );
}
