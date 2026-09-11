/**
 * Shared action hooks used by several App.tsx screen wrappers.
 *
 * These were previously duplicated across wrappers (MOB-7):
 * - Stripe Connect verification fallback (Account + Seller Dashboard wrappers)
 * - Shipping-label actions (OrderDetailScreenWrapper + SellerSalesScreenWrapper)
 *
 * Payout setup itself is now native: usePayoutSetupActions backs the shared
 * PayoutSetupScreen, and the WebView only survives for the bits of verification
 * Stripe will not let us collect ourselves.
 */
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { PayoutSetupError } from "@buttergolf/app/src/features/payouts";
import type {
  BankAccountTokenInput,
  PayoutDetailsInput,
  PayoutStatus,
} from "@buttergolf/constants";
import { deferredFetch, deferredGet, deferredPost } from "./apiClient";
import { createBankAccountToken } from "./stripe-safe";

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
 * Returns a handler that opens Stripe's hosted verification step in a web
 * session and refreshes seller status on success.
 *
 * This is the *fallback* half of payout setup: name, date of birth, address,
 * phone and bank details are all collected natively by PayoutSetupScreen. Only
 * what Stripe insists on collecting itself — an ID document, proof of liveness
 * — still goes through the WebView, and /mobile-onboarding restricts the
 * embedded component to exactly those outstanding requirements.
 */
export function useStripeVerificationWebView(
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
        throw new Error("Failed to create verification session");
      }

      // `mode=verification` restricts Stripe's component to the identity
      // checks our native form can't collect. Without it the page runs the
      // full onboarding, which is what already-shipped binaries expect.
      const verificationUrl = `${apiUrl}/mobile-onboarding?token=${encodeURIComponent(
        session.token
      )}&apiUrl=${encodeURIComponent(apiUrl)}&mode=verification`;
      const WebBrowser = await import("expo-web-browser");
      const result = await WebBrowser.openAuthSessionAsync(
        verificationUrl,
        "buttergolf://seller/onboarding/complete"
      );

      if (result.type === "success") {
        await refreshSellerStatus(true);
      }
    } catch (err) {
      Alert.alert(
        "Unable to start verification",
        err instanceof Error ? err.message : "Please try again."
      );
    }
  }, [apiUrl, getToken, refreshSellerStatus]);
}

/** Shape of the error body the /api/stripe/connect/setup/* routes return. */
interface PayoutErrorBody {
  error?: unknown;
  errors?: unknown;
  param?: unknown;
}

function toFieldErrors(value: unknown): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * POST JSON and turn a non-2xx response into a PayoutSetupError.
 *
 * deferredPost can't be used here: it collapses the response body into an
 * Error message and drops the status, so the `errors` map that tells the form
 * which field Stripe rejected would be lost. deferredFetch keeps both while
 * still deferring the SecureStore token read past navigation animations.
 */
async function postPayoutJson<T>(
  url: string,
  body: unknown,
  getToken: GetTokenFn,
  fallbackMessage: string
): Promise<T> {
  const response = await deferredFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    getToken,
  });

  if (response.ok) return (await response.json()) as T;

  let payload: PayoutErrorBody = {};
  try {
    payload = (await response.json()) as PayoutErrorBody;
  } catch {
    // Non-JSON body (a proxy error page, say) — fall through to the fallback.
  }

  throw new PayoutSetupError(
    typeof payload.error === "string" && payload.error ? payload.error : fallbackMessage,
    {
      fieldErrors: toFieldErrors(payload.errors),
      param: typeof payload.param === "string" ? payload.param : null,
    }
  );
}

/**
 * The four adapters PayoutSetupScreen needs on mobile: read the payout status,
 * push the seller's details, tokenise their bank details on the device, and
 * hand the resulting token to the API.
 */
export function usePayoutSetupActions(apiUrl: string, getToken: GetTokenFn) {
  const fetchStatus = useCallback(
    () => deferredGet<PayoutStatus>(`${apiUrl}/api/stripe/connect/status`, { getToken }),
    [apiUrl, getToken]
  );

  const submitDetails = useCallback(
    (input: PayoutDetailsInput) =>
      postPayoutJson<PayoutStatus>(
        `${apiUrl}/api/stripe/connect/setup/details`,
        input,
        getToken,
        "We couldn't save your details. Please try again."
      ),
    [apiUrl, getToken]
  );

  const submitBankAccount = useCallback(
    (token: string) =>
      postPayoutJson<PayoutStatus>(
        `${apiUrl}/api/stripe/connect/setup/bank-account`,
        { token },
        getToken,
        "We couldn't save your bank details. Please try again."
      ),
    [apiUrl, getToken]
  );

  const tokeniseBankAccount = useCallback(async (input: BankAccountTokenInput) => {
    try {
      return await createBankAccountToken(input);
    } catch (err) {
      throw new PayoutSetupError(
        err instanceof Error && err.message
          ? err.message
          : "We couldn't check those bank details. Please try again."
      );
    }
  }, []);

  return {
    fetchStatus,
    submitDetails,
    submitBankAccount,
    createBankAccountToken: tokeniseBankAccount,
  };
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
