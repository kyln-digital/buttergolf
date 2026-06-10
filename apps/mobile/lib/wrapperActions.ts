/**
 * Shared action hooks used by several App.tsx screen wrappers.
 *
 * These were previously duplicated across wrappers (MOB-7):
 * - Stripe Connect onboarding (AccountScreenWrapper + SellerDashboardScreenWrapper)
 * - Shipping-label actions (OrderDetailScreenWrapper + SellerSalesScreenWrapper)
 *
 * Behaviour is intentionally identical to the original inline implementations;
 * this is a pure de-duplication.
 */
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { deferredGet, deferredPost } from "./apiClient";

type GetTokenFn = () => Promise<string | null>;

interface SelectedProduct {
  id: string;
  title: string;
  price: number;
  sellerId: string;
}

interface FetchedProduct {
  id: string;
  title: string;
  price: number;
  user?: { id?: string } | null;
}

/**
 * Encapsulates the Buy-Now / Make-Offer / checkout-success flow shared by the
 * Favourites and Product Detail wrappers. Returns the checkout sheet state and
 * the handlers each wrapper wires onto its screen + MobileCheckoutSheet.
 *
 * `fetchProduct` is injected so this hook stays decoupled from App.tsx's API
 * helpers.
 */
export function useCheckoutFlow(
  apiUrl: string,
  getToken: GetTokenFn,
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void },
  fetchProduct: (id: string) => Promise<FetchedProduct | null>
) {
  const [checkoutSheetOpen, setCheckoutSheetOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null);

  // Memoized token getter for the checkout sheet.
  const getTokenCallback = useCallback(async () => getToken(), [getToken]);

  const handleBuyNow = useCallback(
    (productId: string) => {
      fetchProduct(productId)
        .then((product) => {
          if (product) {
            setSelectedProduct({
              id: product.id,
              title: product.title,
              price: product.price,
              sellerId: product.user?.id || "",
            });
            setCheckoutSheetOpen(true);
          }
        })
        .catch((error) => {
          console.error("Failed to fetch product for Buy Now:", error);
          Alert.alert(
            "Unable to load product",
            "Something went wrong while loading this product. Please try again."
          );
        });
    },
    [fetchProduct]
  );

  const handleMakeOffer = useCallback(
    async (productId: string, offerAmount: number) => {
      try {
        const data = await deferredPost<{ conversationId: string }>(
          `${apiUrl}/api/conversations`,
          { productId },
          { getToken }
        );

        // Submit the offer before navigating
        await deferredPost(
          `${apiUrl}/api/conversations/${data.conversationId}/offer`,
          { amount: offerAmount },
          { getToken }
        );

        navigation.navigate("MessageThread", {
          conversationId: data.conversationId,
          productTitle: "Product",
          userRole: "buyer",
        });
      } catch (error) {
        console.error("Failed to create conversation for Make Offer:", error);
        Alert.alert("Unable to make offer", "Something went wrong. Please try again.");
      }
    },
    [apiUrl, getToken, navigation]
  );

  const handleCheckoutSuccess = useCallback(() => {
    setCheckoutSheetOpen(false);
    setSelectedProduct(null);
    Alert.alert(
      "Payment Successful!",
      "Your order has been placed. You can track it in your messages.",
      [
        {
          text: "View Messages",
          onPress: () => navigation.navigate("Messages"),
        },
        { text: "OK" },
      ]
    );
  }, [navigation]);

  return {
    checkoutSheetOpen,
    setCheckoutSheetOpen,
    selectedProduct,
    getTokenCallback,
    handleBuyNow,
    handleMakeOffer,
    handleCheckoutSuccess,
  };
}

/**
 * Returns a handler that opens the Stripe Connect onboarding web flow and
 * refreshes seller status on success. Shared by the Account and Seller
 * Dashboard wrappers.
 */
export function useStripeOnboarding(
  apiUrl: string,
  getToken: GetTokenFn,
  refreshSellerStatus: (force?: boolean) => Promise<unknown>
) {
  return useCallback(async () => {
    if (!apiUrl) {
      Alert.alert("Configuration Error", "API URL is not configured.");
      return;
    }

    try {
      const session = await deferredPost<{ token: string }>(
        `${apiUrl}/api/stripe/connect/mobile-session`,
        {},
        { getToken }
      );

      if (!session?.token) {
        throw new Error("Failed to create onboarding session");
      }

      const onboardingUrl = `${apiUrl}/mobile-onboarding?token=${encodeURIComponent(
        session.token
      )}&apiUrl=${encodeURIComponent(apiUrl)}`;
      const WebBrowser = await import("expo-web-browser");
      const result = await WebBrowser.openAuthSessionAsync(
        onboardingUrl,
        "buttergolf://seller/onboarding/complete"
      );

      if (result.type === "success") {
        await refreshSellerStatus(true);
      }
    } catch (err) {
      Alert.alert(
        "Unable to start payout setup",
        err instanceof Error ? err.message : "Please try again."
      );
    }
  }, [apiUrl, getToken, refreshSellerStatus]);
}

/**
 * Returns the shipping-label action trio (generate, download, mark shipped)
 * shared by the Order Detail and Seller Sales wrappers.
 */
export function useLabelActions(apiUrl: string, getToken: GetTokenFn) {
  const generateLabel = useCallback(
    async (orderId: string) => {
      return deferredPost<{ labelUrl: string }>(
        `${apiUrl}/api/orders/${orderId}/shipping-label`,
        {},
        { getToken }
      );
    },
    [getToken, apiUrl]
  );

  const downloadLabel = useCallback(
    async (orderId: string) => {
      const order = await deferredGet<{ shippingLabel?: { labelUrl: string } }>(
        `${apiUrl}/api/orders/${orderId}`,
        { getToken }
      );
      if (order?.shippingLabel?.labelUrl) {
        const { Linking } = await import("react-native");
        void Linking.openURL(order.shippingLabel.labelUrl);
      }
    },
    [getToken, apiUrl]
  );

  const markShipped = useCallback(
    async (orderId: string, trackingNumber: string, carrier: string) => {
      await deferredPost(
        `${apiUrl}/api/orders/${orderId}/ship`,
        { trackingNumber, carrier },
        { getToken }
      );
    },
    [getToken, apiUrl]
  );

  return { generateLabel, downloadLabel, markShipped };
}
