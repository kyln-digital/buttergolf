import { useState, useCallback, useRef } from "react";
import { Alert, StyleSheet, SafeAreaView, View, ActivityIndicator } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { useAuth } from "@clerk/clerk-expo";
import { useSellerStatusContext } from "../context";
import { SellerOnboardingScreen, SellScreen } from "@buttergolf/app";
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
 * WebView message types from the mobile-onboarding page
 */
interface WebViewMessage {
  type: "ready" | "initialized" | "step_change" | "exit" | "error";
  step?: string;
  success?: boolean;
  message?: string;
}

/**
 * Hides the Tidio chat widget, which shouldn't appear in the embedded WebView.
 *
 * NOTE: Viewport configuration is handled server-side in the mobile-onboarding
 * layout file (width: device-width, initialScale: 1, maximumScale: 1, userScalable: false),
 * so we don't need to manipulate it here.
 */
const INJECTED_JAVASCRIPT = `
  (function() {
    // Hide Tidio chat widget if it exists.
    // Returns true if a Tidio element or API was found and hide was attempted.
    var hideTidio = function() {
      var hidSomething = false;
      var tidioChat = document.getElementById('tidio-chat');
      if (tidioChat) {
        tidioChat.style.display = 'none';
        hidSomething = true;
      }
      // Also try to hide via Tidio API if available (with defensive type checking)
      if (
        typeof window !== 'undefined' &&
        typeof window.tidioChatApi !== 'undefined' &&
        window.tidioChatApi &&
        typeof window.tidioChatApi.hide === 'function'
      ) {
        try {
          window.tidioChatApi.hide();
          hidSomething = true;
        } catch (e) {
          // Ignore errors from Tidio API
        }
      }
      return hidSomething;
    };

    var observer = null;
    var observerTimeoutId = null;

    var stopObserver = function() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (observerTimeoutId !== null) {
        clearTimeout(observerTimeoutId);
        observerTimeoutId = null;
      }
    };

    var startObserver = function() {
      if (!document.body) {
        return;
      }
      if (observer) {
        return;
      }
      observer = new MutationObserver(function() {
        if (hideTidio()) {
          // Once we've successfully hidden Tidio, we no longer need to observe.
          stopObserver();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      // Safety timeout: ensure we always clean up the observer after a bounded time (10 seconds).
      observerTimeoutId = setTimeout(stopObserver, 10000);
    };

    // Run immediately to catch any already-loaded Tidio instance
    hideTidio();

    // Start observing once the DOM is ready so document.body exists.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startObserver);
    } else {
      startObserver();
    }

    // Also hide after delays in case Tidio loads slightly later
    setTimeout(hideTidio, 1000);
    setTimeout(hideTidio, 3000);
  })();
  true;
`;

/**
 * SellerOnboardingGate - Wraps SellScreen and gates it behind seller onboarding.
 *
 * This component:
 * 1. Gets seller status from SellerStatusProvider context (fetched ONCE at app level)
 * 2. If not ready to sell, shows SellerOnboardingScreen (pre-onboarding prompt)
 * 3. When user taps "Get Started", opens WebView with embedded Stripe Connect
 * 4. WebView loads /mobile-onboarding page with Clerk token for auth
 * 5. Handles completion/exit messages from WebView
 * 6. Shows SellScreen when onboarding is complete
 *
 * IMPORTANT: This component MUST be rendered inside SellerStatusProvider.
 * The provider handles fetching seller status once on sign-in, preventing
 * the infinite API call loop that occurred with the old useSellerStatus hook.
 *
 * Uses WebView because @stripe/stripe-react-native does NOT support
 * Connect embedded components - only the web SDK does.
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

  // Use ref to always access the current getToken function
  // This prevents stale closure issues where useCallback captures an undefined getToken
  // during initial Clerk hydration, then keeps that stale reference
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken; // Update on every render (synchronous, no effect needed)

  // Get seller status from context (fetched once at app level by SellerStatusProvider)
  // This replaces the old useSellerStatus hook which caused infinite API calls
  // because each component mount created a new hook instance that fetched independently
  const { status, isLoading, error, refresh } = useSellerStatusContext();

  // WebView state
  const [showWebView, setShowWebView] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  /**
   * Start onboarding by obtaining a short-lived session token and preparing the WebView URL
   *
   * Security: We don't pass the Clerk token directly to the URL (would be exposed in logs/history).
   * Instead, we exchange it for a short-lived mobile session token via the backend.
   *
   * Uses getTokenRef.current to always access the latest getToken function,
   * avoiding stale closure issues during Clerk hydration.
   */
  const initializeOnboarding = useCallback(async () => {
    try {
      setWebViewLoading(true);
      setOnboardingError(null);

      // Access getToken via ref to always get the current function
      const currentGetToken = getTokenRef.current;

      // Defensive check: ensure getToken is available from Clerk
      if (typeof currentGetToken !== "function") {
        console.error("[SellerOnboardingGate] getToken is not a function:", typeof currentGetToken);
        Alert.alert(
          "Authentication Error",
          "Please close this screen and try again. If the problem persists, try signing out and back in."
        );
        setWebViewLoading(false);
        return;
      }

      const clerkToken = await currentGetToken();
      if (!clerkToken) {
        Alert.alert("Error", "Please sign in to become a seller.");
        setWebViewLoading(false);
        return;
      }

      // Exchange Clerk token for a short-lived mobile session token
      // This token is safer to pass via URL as it expires in 15 minutes
      const sessionResponse = await fetch(`${apiUrl}/api/stripe/connect/mobile-session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clerkToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.error || "Failed to create session");
      }

      const { token: mobileSessionToken } = await sessionResponse.json();

      // Build the WebView URL with the short-lived session token
      // The mobile-onboarding page will use this token to authenticate API calls
      const onboardingUrl = new URL("/mobile-onboarding", apiUrl);
      onboardingUrl.searchParams.set("token", mobileSessionToken);
      onboardingUrl.searchParams.set("apiUrl", apiUrl);

      console.info("[SellerOnboardingGate] Opening WebView with mobile session token");

      setWebViewUrl(onboardingUrl.toString());
      setShowWebView(true);
      setWebViewLoading(false);
    } catch (err) {
      console.error("[SellerOnboardingGate] Initialization error:", err);
      setOnboardingError(err instanceof Error ? err.message : "Failed to initialize onboarding");
      setWebViewLoading(false);
      Alert.alert(
        "Onboarding Error",
        err instanceof Error ? err.message : "Failed to start seller onboarding"
      );
    }
  }, [apiUrl]); // Note: getToken removed from deps since we use ref

  /**
   * Handle messages from the WebView
   */
  const handleWebViewMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const message: WebViewMessage = JSON.parse(event.nativeEvent.data);
        console.info("[SellerOnboardingGate] WebView message:", message);

        switch (message.type) {
          case "ready":
            console.info("[SellerOnboardingGate] WebView ready");
            break;

          case "initialized":
            console.info("[SellerOnboardingGate] Stripe Connect initialized");
            break;

          case "step_change":
            console.info("[SellerOnboardingGate] Step changed:", message.step);
            break;

          case "exit":
            console.info("[SellerOnboardingGate] Onboarding exited, success:", message.success);
            setShowWebView(false);
            setWebViewUrl(null);

            // Force refresh seller status (bypass throttle)
            await refresh(true);
            break;

          case "error":
            console.error("[SellerOnboardingGate] WebView error:", message.message);
            setOnboardingError(message.message || "An error occurred");
            // Don't auto-close - let user retry or cancel
            break;
        }
      } catch (err) {
        console.error("[SellerOnboardingGate] Failed to parse WebView message:", err);
      }
    },
    [refresh]
  );

  /**
   * Handle WebView close/cancel
   */
  const handleCloseWebView = useCallback(() => {
    setShowWebView(false);
    setWebViewUrl(null);
    // Refresh status in case user completed something
    refresh(true);
  }, [refresh]);

  // Debug logging (after all hooks, before conditional returns)
  console.info("[SellerOnboardingGate] Render:", {
    isLoading,
    error,
    status,
    isReadyToSell: status?.isReadyToSell,
    showWebView,
  });

  // Loading state while seller status is being fetched
  // Note: We no longer need to check isAuthLoaded because SellerStatusProvider
  // is placed inside <SignedIn>, guaranteeing auth is ready
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={brandColors.spicedClementine} />
        </View>
      </SafeAreaView>
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

  // Show WebView for Stripe Connect onboarding
  if (showWebView && webViewUrl) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Close button header */}
        <View style={styles.webViewHeader}>
          <View style={styles.headerLeft} />
          <View style={styles.headerCenter}>
            <View style={styles.headerTitleContainer}>{/* Loading handled by web page */}</View>
          </View>
          <View style={styles.headerRight}>
            {/* Close button - tap to cancel */}
            <View
              style={styles.closeButton}
              onTouchEnd={handleCloseWebView}
              accessibilityRole="button"
              accessibilityLabel="Close onboarding"
            >
              <View style={styles.closeButtonInner}>
                <View style={styles.closeX1} />
                <View style={styles.closeX2} />
              </View>
            </View>
          </View>
        </View>

        <WebView
          ref={webViewRef}
          source={{ uri: webViewUrl }}
          style={styles.webView}
          onMessage={handleWebViewMessage}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error("[SellerOnboardingGate] WebView error:", nativeEvent);
            setOnboardingError(nativeEvent.description || "Failed to load");
          }}
          // Inject JS to hide Tidio chat widget in the WebView
          // NOTE: INJECTED_JAVASCRIPT is a static constant defined in this file.
          // Do NOT interpolate user input or external data into injectedJavaScript, as it
          // executes directly inside the WebView and could introduce JS injection/XSS issues.
          injectedJavaScript={INJECTED_JAVASCRIPT}
          // Security settings
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
          // iOS specific
          allowsBackForwardNavigationGestures={false}
          // Android specific
          setSupportMultipleWindows={false}
          // Handle external links (open in system browser if needed)
          onShouldStartLoadWithRequest={(request) => {
            // Allow same-origin requests
            if (request.url.startsWith(apiUrl)) {
              return true;
            }
            // Allow Stripe domains for iframes
            if (request.url.includes("stripe.com") || request.url.includes("js.stripe.com")) {
              return true;
            }
            // Block other external links (or could open in system browser)
            console.log("[SellerOnboardingGate] Blocked external URL:", request.url);
            return false;
          }}
        />
      </SafeAreaView>
    );
  }

  // Loading state while initializing onboarding
  if (webViewLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={brandColors.spicedClementine} />
        </View>
      </SafeAreaView>
    );
  }

  // Show the onboarding prompt screen (pre-onboarding state)
  return (
    <SellerOnboardingScreen
      sellerStatus={status}
      isLoading={isLoading}
      error={error || onboardingError}
      onStartOnboarding={initializeOnboarding}
      onContinueOnboarding={initializeOnboarding}
      onCancel={() => navigation.goBack()}
      onRefresh={() => refresh(true)}
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
  webViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: brandColors.pureWhite,
    borderBottomWidth: 1,
    borderBottomColor: "#EDEDED",
  },
  headerLeft: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerSpinner: {
    marginLeft: 8,
  },
  headerRight: {
    width: 40,
    alignItems: "flex-end",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonInner: {
    width: 14,
    height: 14,
    position: "relative",
  },
  closeX1: {
    position: "absolute",
    width: 14,
    height: 2,
    backgroundColor: brandColors.ironstone,
    top: 6,
    transform: [{ rotate: "45deg" }],
  },
  closeX2: {
    position: "absolute",
    width: 14,
    height: 2,
    backgroundColor: brandColors.ironstone,
    top: 6,
    transform: [{ rotate: "-45deg" }],
  },
  webView: {
    flex: 1,
    backgroundColor: brandColors.pureWhite,
  },
});
