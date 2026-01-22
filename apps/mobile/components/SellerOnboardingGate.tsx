import { useState, useCallback, useEffect, useRef } from "react";
import { Alert, StyleSheet, SafeAreaView, View, ActivityIndicator } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useSellerStatus } from "@buttergolf/app/src/hooks";
import { SellerOnboardingScreen, SellScreen } from "@buttergolf/app";
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
  loadConnectAndInitialize,
  type StripeConnectInstance,
} from "@stripe/stripe-react-native";
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
 * 2. If not ready to sell, shows embedded Stripe Connect onboarding (native modal)
 * 3. Uses the same API endpoint as web for unified experience
 * 4. Shows SellScreen when onboarding is complete
 *
 * Uses Stripe React Native SDK's native Connect embedded components which
 * provide a seamless in-app onboarding experience with ButterGolf branding.
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
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

  // Seller status hook
  const { status, isLoading, error, refresh } = useSellerStatus({
    apiUrl,
    getToken,
    isAuthenticated: true,
  });

  // Stripe Connect instance state
  const [stripeConnectInstance, setStripeConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Track if we've reached the summary step (considered "complete enough")
  const hasReachedSummaryRef = useRef(false);

  // Debug logging
  console.log("[SellerOnboardingGate] Render:", {
    apiUrl,
    isLoading,
    error,
    status,
    isReadyToSell: status?.isReadyToSell,
    showOnboarding,
  });

  /**
   * Initialize Stripe Connect instance for embedded onboarding
   * Uses the same /api/stripe/connect/account endpoint as web
   */
  const initializeOnboarding = useCallback(async () => {
    if (!publishableKey) {
      setOnboardingError("Stripe publishable key not configured");
      return;
    }

    try {
      setOnboardingLoading(true);
      setOnboardingError(null);

      const token = await getToken();
      if (!token) {
        Alert.alert("Error", "Please sign in to become a seller.");
        setOnboardingLoading(false);
        return;
      }

      // Create the Connect instance with fetchClientSecret callback
      // This uses the same API endpoint as web for unified experience
      const instance = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: async () => {
          console.log("[SellerOnboardingGate] Fetching client secret...");
          const response = await fetch(`${apiUrl}/api/stripe/connect/account`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to initialize onboarding");
          }

          const { clientSecret } = await response.json();
          console.log("[SellerOnboardingGate] Client secret received");
          return clientSecret;
        },
        appearance: {
          variables: {
            colorPrimary: brandColors.spicedClementine,
            colorBackground: brandColors.pureWhite,
            colorText: brandColors.ironstone,
            colorDanger: brandColors.error,
          },
        },
      });

      setStripeConnectInstance(instance);
      setShowOnboarding(true);
      console.log("[SellerOnboardingGate] Connect instance initialized");
    } catch (err) {
      console.error("[SellerOnboardingGate] Initialization error:", err);
      setOnboardingError(
        err instanceof Error ? err.message : "Failed to initialize onboarding"
      );
      Alert.alert(
        "Onboarding Error",
        err instanceof Error ? err.message : "Failed to start seller onboarding"
      );
    } finally {
      setOnboardingLoading(false);
    }
  }, [apiUrl, getToken, publishableKey]);

  /**
   * Handle onboarding exit - refresh status and hide modal
   */
  const handleOnboardingExit = useCallback(async () => {
    console.log("[SellerOnboardingGate] Onboarding exited");
    setShowOnboarding(false);
    setStripeConnectInstance(null);
    hasReachedSummaryRef.current = false;
    
    // Refresh status to check if onboarding is complete
    await refresh();
  }, [refresh]);

  /**
   * Handle step changes during onboarding
   */
  const handleStepChange = useCallback((stepChange: { step: string }) => {
    console.log("[SellerOnboardingGate] Step changed:", stepChange.step);
    // Track when user reaches summary step
    if (stepChange.step === "summary" || stepChange.step.startsWith("summary_")) {
      hasReachedSummaryRef.current = true;
    }
  }, []);

  /**
   * Handle load errors from the embedded component
   */
  const handleLoadError = useCallback((err: { error: { message?: string } }) => {
    const errorMessage = err.error.message || "An error occurred during onboarding";
    console.error("[SellerOnboardingGate] Load error:", errorMessage);
    setOnboardingError(errorMessage);
    Alert.alert("Error", errorMessage);
  }, []);

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

  // If embedded onboarding is active, show it
  if (showOnboarding && stripeConnectInstance) {
    return (
      <SafeAreaView style={styles.container}>
        <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
          <ConnectAccountOnboarding
            title="Seller Account Setup"
            onExit={handleOnboardingExit}
            onStepChange={handleStepChange}
            onLoadError={handleLoadError}
            collectionOptions={{
              fields: "eventually_due",
              futureRequirements: "include",
            }}
          />
        </ConnectComponentsProvider>
      </SafeAreaView>
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

  // Otherwise, show the onboarding prompt screen (pre-onboarding state)
  return (
    <SellerOnboardingScreen
      sellerStatus={status}
      isLoading={isLoading}
      error={error || onboardingError}
      onStartOnboarding={initializeOnboarding}
      onContinueOnboarding={initializeOnboarding}
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
