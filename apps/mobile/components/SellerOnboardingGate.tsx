import { useState, useCallback } from "react";
import { Alert, StyleSheet, SafeAreaView, View, ActivityIndicator } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useSellerStatus } from "@buttergolf/app/src/hooks";
import { SellerOnboardingScreen, SellScreen } from "@buttergolf/app";
import { StripeConnectWebView } from "./StripeConnectWebView";
import type { SellFormData, ImageData, Category, Brand, Model } from "@buttergolf/app";

// ButterGolf brand colors
const brandColors = {
  spicedClementine: "#F45314",
  vanillaCream: "#FFFAD2",
  ironstone: "#323232",
  pureWhite: "#FFFFFF",
  error: "#dc2626",
};

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
 * 2. If not ready to sell, shows the onboarding prompt screen
 * 3. Shows embedded Stripe Connect onboarding in a WebView
 * 4. Shows SellScreen when onboarding is complete
 *
 * Uses Stripe Connect.js embedded components via WebView for a native-like
 * onboarding experience within the app.
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
  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

  // Seller status hook
  const { status, isLoading, error, refresh } = useSellerStatus({
    apiUrl,
    getToken,
    isAuthenticated: true,
  });

  // Onboarding state
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [showWebView, setShowWebView] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Debug logging
  console.log("[SellerOnboardingGate] Render:", {
    apiUrl,
    isLoading,
    error,
    status,
    isReadyToSell: status?.isReadyToSell,
    showWebView,
  });

  /**
   * Start Stripe Connect onboarding via embedded WebView
   * This creates an AccountSession and shows the embedded component
   */
  const startOnboarding = useCallback(async () => {
    try {
      setOnboardingLoading(true);
      setOnboardingError(null);

      const token = await getToken();
      if (!token) {
        Alert.alert("Error", "Please sign in to become a seller.");
        setOnboardingLoading(false);
        return;
      }

      // First, ensure the user has a Connect account
      // This may create the account if it doesn't exist
      const accountResponse = await fetch(`${apiUrl}/api/stripe/connect/account`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!accountResponse.ok) {
        const errorData = await accountResponse.json();
        throw new Error(errorData.error || "Failed to create seller account");
      }

      // Now get an AccountSession for the embedded component
      const sessionResponse = await fetch(`${apiUrl}/api/stripe/connect/account-session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.error || "Failed to create onboarding session");
      }

      const { clientSecret: secret } = await sessionResponse.json();
      console.log("[SellerOnboardingGate] Got client secret, showing WebView");

      setClientSecret(secret);
      setShowWebView(true);
    } catch (err) {
      console.error("[SellerOnboardingGate] Onboarding error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to start seller onboarding";
      setOnboardingError(errorMessage);
      Alert.alert("Onboarding Error", errorMessage);
    } finally {
      setOnboardingLoading(false);
    }
  }, [apiUrl, getToken]);

  /**
   * Handle WebView onboarding completion
   */
  const handleOnboardingComplete = useCallback(() => {
    console.log("[SellerOnboardingGate] Onboarding complete, refreshing status");
    setShowWebView(false);
    setClientSecret(null);
    // Refresh seller status to check if onboarding completed
    refresh();
  }, [refresh]);

  /**
   * Handle WebView exit/cancel
   */
  const handleOnboardingExit = useCallback(() => {
    console.log("[SellerOnboardingGate] Onboarding exited by user");
    setShowWebView(false);
    setClientSecret(null);
    // Refresh status in case they partially completed
    refresh();
  }, [refresh]);

  /**
   * Handle WebView error
   */
  const handleOnboardingError = useCallback((error: string) => {
    console.error("[SellerOnboardingGate] Onboarding error:", error);
    setOnboardingError(error);
    setShowWebView(false);
    setClientSecret(null);
  }, []);

  // If showing the WebView onboarding
  if (showWebView && clientSecret && stripePublishableKey) {
    return (
      <StripeConnectWebView
        clientSecret={clientSecret}
        publishableKey={stripePublishableKey}
        onComplete={handleOnboardingComplete}
        onExit={handleOnboardingExit}
        onError={handleOnboardingError}
      />
    );
  }

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

  // Loading state while initializing onboarding
  if (onboardingLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={brandColors.spicedClementine} />
        </View>
      </SafeAreaView>
    );
  }

  // Show the onboarding prompt screen
  return (
    <SellerOnboardingScreen
      sellerStatus={status}
      isLoading={isLoading}
      error={error || onboardingError}
      onStartOnboarding={startOnboarding}
      onContinueOnboarding={startOnboarding}
      onCancel={() => navigation.goBack()}
      onRefresh={refresh}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.pureWhite,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
