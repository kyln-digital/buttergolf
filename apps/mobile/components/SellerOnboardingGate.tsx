import { useState, useCallback, useEffect } from "react";
import { Alert, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@clerk/clerk-expo";
import { useSellerStatus } from "@buttergolf/app/src/hooks";
import { SellerOnboardingScreen, SellScreen } from "@buttergolf/app";
import type { SellFormData, ImageData, Category, Brand, Model } from "@buttergolf/app";

/**
 * Navigation interface for SellerOnboardingGate.
 * Defines the minimum navigation methods required.
 */
interface SellerOnboardingNavigation {
  /**
   * Navigate to a route by name. The params type is intentionally broad here,
   * as this component is navigation-library agnostic beyond needing `navigate`.
   */
  navigate: (routeName: string, params?: unknown) => void;
  /** Go back to the previous screen */
  goBack: () => void;
  /** Add a listener for navigation events */
  addListener: (event: string, callback: () => void) => () => void;
}

export interface SellerOnboardingGateProps {
  /** Navigation object from React Navigation */
  navigation: SellerOnboardingNavigation;
  /** Callback to upload an image to Cloudinary */
  onUploadImage: (image: ImageData, isFirstImage: boolean) => Promise<string>;
  /** Callback to pick images from gallery */
  onPickImages: () => Promise<ImageData[]>;
  /** Callback to take a photo with camera */
  onTakePhoto: () => Promise<ImageData | null>;
  /** Callback to submit a listing */
  onSubmitListing: (data: SellFormData) => Promise<{ id: string }>;
  /** Callback to fetch categories */
  onFetchCategories: () => Promise<Category[]>;
  /** Callback to search brands */
  onSearchBrands: (query: string) => Promise<Brand[]>;
  /** Callback to search models */
  onSearchModels: (brandId: string, query: string) => Promise<Model[]>;
}

/**
 * SellerOnboardingGate - Wraps SellScreen and gates it behind seller onboarding.
 *
 * This component:
 * 1. Checks the user's seller status on mount
 * 2. If not ready to sell, shows SellerOnboardingScreen
 * 3. Handles Stripe Connect onboarding via expo-web-browser
 * 4. Listens for deep link return from Stripe
 * 5. Refreshes status and shows SellScreen when ready
 *
 * Deep link URLs:
 * - buttergolf://seller/onboarding/complete - Success return
 * - buttergolf://seller/onboarding/refresh - User cancelled or needs retry
 */
export function SellerOnboardingGate({
  navigation,
  onUploadImage,
  onPickImages,
  onTakePhoto,
  onSubmitListing,
  onFetchCategories,
  onSearchBrands,
  onSearchModels,
}: SellerOnboardingGateProps) {
  const { getToken } = useAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  // Seller status hook
  const { status, isLoading, error, refresh } = useSellerStatus({
    apiUrl,
    getToken,
    isAuthenticated: true,
  });

  // Debug logging
  console.log("[SellerOnboardingGate] Render:", {
    apiUrl,
    isLoading,
    error,
    status,
    isReadyToSell: status?.isReadyToSell,
  });

  // Track if we're waiting for Stripe onboarding return
  const [awaitingReturn, setAwaitingReturn] = useState(false);

  /**
   * Start or continue Stripe onboarding via hosted flow
   */
  const startOnboarding = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Error", "Please sign in to become a seller.");
        return;
      }

      // Call the mobile onboarding API
      const response = await fetch(`${apiUrl}/api/stripe/connect/mobile-onboard`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start onboarding");
      }

      const { url } = await response.json();

      if (!url) {
        throw new Error("No onboarding URL received");
      }

      console.log("[SellerOnboardingGate] Opening Stripe onboarding:", url);
      setAwaitingReturn(true);

      // Open Stripe onboarding in browser
      // Using openAuthSessionAsync allows automatic return via deep link
      const result = await WebBrowser.openAuthSessionAsync(
        url,
        "buttergolf://seller/onboarding" // Base URL for return matching
      );

      console.log("[SellerOnboardingGate] WebBrowser result:", result);

      // Handle the result
      if (result.type === "success") {
        // User completed or returned from Stripe
        // Refresh status to check if onboarding is complete
        await refresh();
      } else if (result.type === "cancel") {
        // User manually closed the browser
        console.log("[SellerOnboardingGate] User cancelled onboarding");
        // Still refresh in case they completed before closing
        await refresh();
      }

      setAwaitingReturn(false);
    } catch (err) {
      console.error("[SellerOnboardingGate] Onboarding error:", err);
      setAwaitingReturn(false);
      Alert.alert(
        "Onboarding Error",
        err instanceof Error ? err.message : "Failed to start seller onboarding"
      );
    }
  }, [apiUrl, getToken, refresh]);

  /**
   * Handle deep link events while the screen is mounted
   * This catches the return from Stripe onboarding
   */
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      console.log("[SellerOnboardingGate] Deep link received:", url);

      // Use precise URL matching to avoid false positives
      const isOnboardingComplete =
        url === "buttergolf://seller/onboarding/complete" ||
        url.startsWith("buttergolf://seller/onboarding/complete?");
      const isOnboardingRefresh =
        url === "buttergolf://seller/onboarding/refresh" ||
        url.startsWith("buttergolf://seller/onboarding/refresh?");

      if (isOnboardingComplete) {
        console.log("[SellerOnboardingGate] Onboarding complete, refreshing status");
        refresh();
        setAwaitingReturn(false);
      } else if (isOnboardingRefresh) {
        console.log("[SellerOnboardingGate] Onboarding refresh requested");
        refresh();
        setAwaitingReturn(false);
      }
    };

    // Listen for deep links
    const subscription = Linking.addEventListener("url", handleDeepLink);

    // Also check if the app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refresh]);

  // Refresh status when screen comes into focus (user might have completed onboarding)
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (awaitingReturn) {
        console.log("[SellerOnboardingGate] Screen focused while awaiting, refreshing");
        refresh();
        setAwaitingReturn(false);
      }
    });

    return unsubscribe;
  }, [navigation, awaitingReturn, refresh]);

  // If user is ready to sell, show the SellScreen
  if (status?.isReadyToSell) {
    return (
      <SellScreen
        isAuthenticated={true}
        onFetchCategories={onFetchCategories}
        onSearchBrands={onSearchBrands}
        onSearchModels={onSearchModels}
        onUploadImage={onUploadImage}
        onPickImages={onPickImages}
        onTakePhoto={onTakePhoto}
        onSubmitListing={onSubmitListing}
        onClose={() => navigation.goBack()}
        onSuccess={(productId) => {
          navigation.navigate("ProductDetail", { id: productId });
        }}
      />
    );
  }

  // Otherwise, show the onboarding screen
  return (
    <SellerOnboardingScreen
      sellerStatus={status}
      isLoading={isLoading || awaitingReturn}
      error={error}
      onStartOnboarding={startOnboarding}
      onContinueOnboarding={startOnboarding}
      onCancel={() => navigation.goBack()}
      onRefresh={refresh}
    />
  );
}
