import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
  type ReactElement,
} from "react";
import { StripeProvider as NativeStripeProvider } from "@stripe/stripe-react-native";
import { addBreadcrumb } from "../lib/breadcrumbs";

interface StripeContextValue {
  /** Whether Stripe SDK has been initialized */
  isInitialized: boolean;
  /** Initialize Stripe SDK on-demand */
  initializeStripe: () => void;
  /** Whether Stripe keys are configured */
  isConfigured: boolean;
}

const StripeContext = createContext<StripeContextValue | null>(null);

interface LazyStripeProviderProps {
  children: ReactNode;
}

/**
 * LazyStripeProvider - Only initializes Stripe SDK when needed
 *
 * WHY THIS EXISTS:
 * The TestFlight crash (EXC_CRASH SIGABRT in ObjCTurboModule::performVoidMethodInvocation)
 * was caused by Stripe SDK initializing at app startup and racing with other TurboModules
 * (SecureStore, expo-notifications) during navigation.
 *
 * This lazy provider:
 * 1. Wraps children WITHOUT StripeProvider initially (no TurboModule init)
 * 2. Only mounts StripeProvider when checkout flow is accessed
 * 3. Prevents concurrent TurboModule initialization race conditions
 *
 * USAGE:
 * - Replace root <StripeProvider> with <LazyStripeProvider>
 * - In checkout components, call useStripeContext().initializeStripe() before useStripe()
 */
export function LazyStripeProvider({ children }: LazyStripeProviderProps): ReactElement {
  const [isInitialized, setIsInitialized] = useState(false);

  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const isConfigured = !!stripePublishableKey;

  const initializeStripe = useCallback(() => {
    if (!isInitialized && stripePublishableKey) {
      addBreadcrumb("turbomodule.stripe", "Initializing Stripe SDK (lazy)", {
        hasKey: true,
      });
      setIsInitialized(true);
    } else if (!stripePublishableKey) {
      addBreadcrumb(
        "turbomodule.stripe",
        "Cannot initialize - missing publishable key",
        {},
        "warning"
      );
    }
  }, [isInitialized, stripePublishableKey]);

  // Log when Stripe is actually mounted
  useEffect(() => {
    if (isInitialized) {
      addBreadcrumb("turbomodule.stripe", "StripeProvider mounted");
    }
  }, [isInitialized]);

  // If Stripe not yet needed, just render children without provider
  if (!isInitialized || !stripePublishableKey) {
    return (
      <StripeContext.Provider
        value={{ isInitialized: false, initializeStripe, isConfigured }}
      >
        <>{children}</>
      </StripeContext.Provider>
    );
  }

  // Wrap with actual StripeProvider when initialized
  return (
    <StripeContext.Provider
      value={{ isInitialized: true, initializeStripe, isConfigured }}
    >
      <NativeStripeProvider publishableKey={stripePublishableKey}>
        <>{children}</>
      </NativeStripeProvider>
    </StripeContext.Provider>
  );
}

/**
 * Hook to access Stripe initialization context
 *
 * @throws Error if used outside of LazyStripeProvider
 */
export function useStripeContext(): StripeContextValue {
  const context = useContext(StripeContext);
  if (!context) {
    throw new Error(
      "useStripeContext must be used within LazyStripeProvider. " +
        "Make sure LazyStripeProvider wraps your component tree in App.tsx."
    );
  }
  return context;
}
