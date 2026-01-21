"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Column, Text, Spinner } from "@buttergolf/ui";

/**
 * /seller/onboarding/refresh
 * 
 * Web redirect page for Stripe Connect onboarding refresh/retry.
 * Stripe redirects here if the account link expired or user needs to retry,
 * then we redirect to the mobile app via deep link.
 */
export default function SellerOnboardingRefreshPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Build deep link with any query params Stripe passed
    const params = searchParams.toString();
    const deepLink = `buttergolf://seller/onboarding/refresh${params ? `?${params}` : ""}`;
    
    console.log("[SellerOnboardingRefresh] Redirecting to deep link:", deepLink);
    
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
            window.location.href = "buttergolf://seller/onboarding/refresh";
          }}
          style={{ textDecorationLine: "underline", cursor: "pointer" }}
        >
          tap here
        </Text>
      </Text>
    </Column>
  );
}
