/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  Theme as NavigationTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { brandColors, LISTING_PRICE_LIMITS } from "@buttergolf/constants";
import {
  Provider,
  RoundsScreen,
  ProductDetailScreen,
  SellScreen,
  FavouritesScreen,
  MessagesScreen,
  MessageThreadScreen,
  routes,
  SignInScreen,
  SignUpScreen,
  VerifyEmailScreen,
  ForgotPasswordScreen,
  ResetPasswordScreen,
  TwoFactorScreen,
  AccountScreen,
  ProfileEditScreen,
  AddressesScreen,
  NotificationSettingsScreen,
  HelpSupportScreen,
} from "@buttergolf/app";
import { OrdersScreen, OrderDetailScreen } from "@buttergolf/app/src/features/orders";
import type { SellerRating } from "@buttergolf/app/src/features/orders";
import {
  SellerDashboardScreen,
  SellerSalesScreen,
  SellerListingsScreen,
} from "@buttergolf/app/src/features/seller";
import type {
  ProductCardData,
  Product,
  Category,
  Brand,
  Model,
  SellFormData,
  ImageData,
} from "@buttergolf/app";
import { OnboardingScreen } from "@buttergolf/app/src/features/onboarding";
import { HomeScreen } from "@buttergolf/app/src/features/home";
import { CategoryListScreen } from "@buttergolf/app/src/features/categories";
import { useMobileFavourites } from "@buttergolf/app/src/hooks";
import { MobileCheckoutSheet } from "./components";
import { SellerStatusProvider, useSellerStatusContext } from "./context";
import RNEventSource from "react-native-sse";
import {
  View as RNView,
  Text as RNText,
  Pressable as RNPressable,
  Alert,
  Platform,
  useColorScheme,
} from "react-native";
import {
  ClerkProvider,
  ClerkLoaded,
  SignedIn,
  SignedOut,
  useAuth,
  useUser,
} from "@clerk/clerk-expo";
import { addBreadcrumb } from "./lib/breadcrumbs";
import {
  DEFAULT_STRIPE_MERCHANT_IDENTIFIER,
  SafeStripeProvider,
  isStripeAvailable,
} from "./lib/stripe-safe";
import {
  deferredFetch,
  deferredGet,
  deferredDelete,
  deferredPost,
  deferredSecureStoreGet,
  deferredSecureStoreSet,
} from "./lib/apiClient";
import {
  registerForPushNotificationsAsync,
  registerPushTokenWithBackend,
  setupNotificationHandlers,
} from "./lib/notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PortalProvider } from "@tamagui/portal";
import { Button, Text } from "@buttergolf/ui";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useFonts } from "expo-font";
import * as ImagePicker from "expo-image-picker";
import {
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
  Urbanist_800ExtraBold,
  Urbanist_900Black,
} from "@expo-google-fonts/urbanist";
import * as SplashScreen from "expo-splash-screen";

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

// Local types matching what screen components expect
// (These are duplicated from screen components to avoid circular deps)

interface Message {
  id: string;
  orderId: string;
  senderId: string;
  senderName: string;
  senderImage: string | null;
  content: string;
  createdAt: string;
  isRead: boolean;
  senderRole?: "buyer" | "seller";
  isOwnMessage?: boolean;
}

// Define navigation param types
type RootStackParamList = {
  ProductDetail: { id?: string };
  Category: { slug?: string };
  [key: string]: undefined | Record<string, string | undefined>;
};

type RouteParams<T extends keyof RootStackParamList> = {
  params?: RootStackParamList[T];
};

const Stack = createNativeStackNavigator();

// Solito linking configuration - connects Solito routes to React Navigation
const linking = {
  prefixes: ["buttergolf://", "https://buttergolf.com", "exp://"],
  config: {
    screens: {
      Home: {
        path: routes.home,
        exact: true,
      },
      Rounds: {
        path: routes.rounds.slice(1), // Remove leading '/' for React Navigation
        exact: true,
      },
      Products: {
        path: "products", // 'products' for product listing (maps to Home)
      },
      ProductDetail: {
        path: "products/:id", // 'products/:id' for dynamic routing
      },
      Category: {
        path: "category/:slug", // 'category/:slug' for category pages
      },
      Favourites: {
        path: routes.favourites.slice(1), // 'favourites'
      },
      Messages: {
        path: routes.messages.slice(1), // 'messages'
      },
      MessageThread: {
        path: "messages/:conversationId",
      },
      Sell: {
        path: routes.sell.slice(1), // 'sell'
      },
      SignIn: {
        path: routes.signIn.slice(1), // 'sign-in'
      },
      SignUp: {
        path: routes.signUp.slice(1), // 'sign-up'
      },
      VerifyEmail: {
        path: routes.verifyEmail.slice(1), // 'verify-email'
      },
      ForgotPassword: {
        path: routes.forgotPassword.slice(1), // 'forgot-password'
      },
      ResetPassword: {
        path: routes.resetPassword.slice(1), // 'reset-password'
      },
      Account: {
        path: routes.account.slice(1), // 'account'
      },
      ProfileEdit: {
        path: "account/profile",
      },
      Orders: {
        path: "account/orders",
      },
      OrderDetail: {
        path: "account/orders/:orderId",
      },
      Addresses: {
        path: "account/addresses",
      },
      NotificationSettings: {
        path: "account/notifications",
      },
      HelpSupport: {
        path: "account/help",
      },
      SellerDashboard: {
        path: "seller/dashboard",
      },
      SellerSales: {
        path: "seller/sales",
      },
      SellerListings: {
        path: "seller/listings",
      },
    },
  },
};

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <Button size="$2" chromeless onPress={() => signOut()} paddingHorizontal="$3">
      <Text>Sign Out</Text>
    </Button>
  );
}

const _HeaderRightComponent = () => <SignOutButton />;

// Function to fetch products from API
async function fetchProducts(): Promise<ProductCardData[]> {
  try {
    // Get API URL from environment variable
    // In production, this should be set to your deployed domain (e.g., "https://buttergolf.com")
    // In development:
    //   - iOS Simulator: use "http://localhost:3000"
    //   - Android Emulator: use "http://10.0.2.2:3000"
    //   - Physical Device: use "http://YOUR_COMPUTER_IP:3000"
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;

    if (!apiUrl) {
      throw new Error(
        "EXPO_PUBLIC_API_URL environment variable is not set. " +
          "Please create apps/mobile/.env file with: EXPO_PUBLIC_API_URL=http://localhost:3000"
      );
    }

    console.info("Fetching products from:", apiUrl);
    const response = await fetch(`${apiUrl}/api/products/recent`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return [];
  }
}

// Function to fetch products by category
async function fetchProductsByCategory(categorySlug: string): Promise<ProductCardData[]> {
  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;

    if (!apiUrl) {
      throw new Error(
        "EXPO_PUBLIC_API_URL environment variable is not set. " +
          "Please create apps/mobile/.env file with: EXPO_PUBLIC_API_URL=http://localhost:3000"
      );
    }

    console.info("Fetching products for category:", categorySlug, "from:", apiUrl);
    // Use /api/listings endpoint which properly:
    // - Supports category slug filtering
    // - Returns ProductCardData format
    // - Includes seller rating info
    const response = await fetch(`${apiUrl}/api/listings?category=${categorySlug}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // /api/listings returns { products, total, page, limit, totalPages }
    return data.products || [];
  } catch (error) {
    console.error("Failed to fetch category products:", error);
    return [];
  }
}

// Function to fetch a single product by ID
async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;

    if (!apiUrl) {
      throw new Error(
        "EXPO_PUBLIC_API_URL environment variable is not set. " +
          "Please create apps/mobile/.env file with: EXPO_PUBLIC_API_URL=http://localhost:3000"
      );
    }

    console.info("Fetching product:", id, "from:", apiUrl);
    const response = await fetch(`${apiUrl}/api/products/${id}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch product ${id}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch product:", error);
    return null;
  }
}

// Function to fetch categories for sell flow
async function fetchCategories(): Promise<Category[]> {
  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) return [];

    const response = await fetch(`${apiUrl}/api/categories`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return [];
  }
}

// Function to search brands
async function searchBrands(query: string): Promise<Brand[]> {
  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl || !query) return [];

    const response = await fetch(`${apiUrl}/api/brands?query=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error("Failed to search brands:", error);
    return [];
  }
}

// Function to search models for a brand
async function searchModels(brandId: string, query: string): Promise<Model[]> {
  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl || !brandId) return [];

    const params = new URLSearchParams({ brandId });
    if (query) params.append("query", query);

    const response = await fetch(`${apiUrl}/api/models?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error("Failed to search models:", error);
    return [];
  }
}

// Function to submit a listing
async function submitListingToApi(
  data: SellFormData,
  token: string | null
): Promise<{ id: string }> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("API URL not configured");

  const parsedPrice = Number.parseFloat(data.price);
  if (
    Number.isNaN(parsedPrice) ||
    parsedPrice < LISTING_PRICE_LIMITS.MIN ||
    parsedPrice > LISTING_PRICE_LIMITS.MAX
  ) {
    throw new Error(
      `Price must be between GBP ${LISTING_PRICE_LIMITS.MIN} and GBP ${LISTING_PRICE_LIMITS.MAX}`
    );
  }

  // Generate a unique request ID for idempotency
  const requestId = `mobile-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const payload = {
    title: data.title,
    description: data.description,
    price: parsedPrice,
    categoryId: data.categoryId,
    brandId: data.brandId,
    modelId: data.modelId || undefined,
    model: data.modelName || undefined,
    images: data.images.map((img) => img.uri),
    // Golf-specific fields
    flex: data.flex || undefined,
    loft: data.loft || undefined,
    woodsSubcategory: data.woodsSubcategory || undefined,
    headCoverIncluded: data.headCoverIncluded,
    // Condition ratings (1-10 scale)
    gripCondition: data.gripCondition,
    headCondition: data.headCondition,
    shaftCondition: data.shaftCondition,
    // Idempotency key
    requestId,
  };

  // Debug: log the payload being sent
  console.info("[Submit Listing] Payload:", JSON.stringify(payload, null, 2));

  const response = await fetch(`${apiUrl}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[Submit Listing] Error response:", error);
    throw new Error(error || "Failed to create listing");
  }

  return await response.json();
}

// Legacy non-auth submit (kept for parity with existing call sites)

async function _submitListing(data: SellFormData): Promise<{ id: string }> {
  return submitListingToApi(data, null);
}

// Function to pick images from gallery
async function pickImages(): Promise<ImageData[]> {
  try {
    // Request permissions if not on web
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissions Required",
          "Please grant photo library permissions to add photos."
        );
        return [];
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      return result.assets.map((asset) => ({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      }));
    }

    return [];
  } catch (error) {
    console.error("Failed to pick images:", error);
    return [];
  }
}

// Function to take a photo with camera
async function takePhoto(): Promise<ImageData | null> {
  try {
    // Request permissions if not on web
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissions Required", "Please grant camera permissions to take photos.");
        return null;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      if (asset) {
        return {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Failed to take photo:", error);
    return null;
  }
}

/**
 * Upload an image to Cloudinary via the API with background removal for first image.
 * This function needs to be called within a component that has access to useAuth.
 */
async function uploadImageToCloudinary(
  image: ImageData,
  isFirstImage: boolean,
  getToken: () => Promise<string | null>
): Promise<string> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("API URL not configured");

  // Get the auth token for the request
  const token = await getToken();
  if (!token) throw new Error("Not authenticated");

  // Generate a unique filename
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const extension = image.uri.split(".").pop() || "jpg";
  const filename = `${timestamp}-${randomStr}.${extension}`;

  console.info("📤 Uploading image to Cloudinary:", {
    uri: image.uri.substring(0, 50) + "...",
    isFirstImage,
    filename,
  });

  // Read the image file as blob
  const response = await fetch(image.uri);
  const blob = await response.blob();

  // Determine content type
  const contentType = blob.type || "image/jpeg";

  console.info("Image blob:", {
    size: blob.size,
    sizeKB: Math.round(blob.size / 1024),
    type: contentType,
  });

  // Upload to the API endpoint
  const uploadUrl = `${apiUrl}/api/upload?filename=${encodeURIComponent(filename)}&isFirstImage=${isFirstImage}`;
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Authorization: `Bearer ${token}`,
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    const responseContentType = uploadResponse.headers.get("content-type") ?? "";
    const clerkAuthReason = uploadResponse.headers.get("x-clerk-auth-reason");
    const matchedPath = uploadResponse.headers.get("x-matched-path");

    let errorMessage = `Upload failed: ${uploadResponse.status}`;
    let errorBodyText: string | undefined;

    try {
      const errorData: unknown = await uploadResponse.json();
      if (errorData && typeof errorData === "object") {
        const possibleError =
          (errorData as { error?: unknown }).error ?? (errorData as { message?: unknown }).message;

        if (typeof possibleError === "string" && possibleError.trim().length > 0) {
          errorMessage = possibleError;
        } else {
          try {
            errorBodyText = JSON.stringify(errorData);
          } catch {
            // ignore JSON stringify errors
          }
        }
      }
    } catch {
      try {
        errorBodyText = await uploadResponse.text();
      } catch {
        // ignore secondary errors when reading response text
      }
    }

    if (errorBodyText) {
      console.error("Photo upload failed with non-JSON response", {
        uploadUrl,
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        responseContentType,
        clerkAuthReason,
        matchedPath,
        body: errorBodyText.slice(0, 1000),
      });

      const snippet = errorBodyText.trim().slice(0, 200);
      if (snippet.length > 0) {
        errorMessage = `${errorMessage} - ${snippet}`;
      }
    } else {
      console.error("Photo upload failed", {
        uploadUrl,
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        responseContentType,
        clerkAuthReason,
        matchedPath,
      });
    }

    const headerHint = clerkAuthReason ? ` (${clerkAuthReason})` : "";
    throw new Error(`${errorMessage}${headerHint}`);
  }

  const result = await uploadResponse.json();
  console.info("Upload success:", result.url);

  return result.url;
}

/**
 * Wrapper component for SellScreen that provides the image upload function
 * with access to Clerk authentication.
 *
 * Zero-friction selling: Users go straight to the listing form.
 * Seller payout setup is handled separately in Account Settings.
 * Funds are held until seller completes payout setup.
 */
function SellScreenWrapper({ navigation }: { navigation: any }) {
  const { getToken } = useAuth();

  // Memoize handlers to prevent re-render issues during navigation
  const handleUploadImage = useCallback(
    async (image: ImageData, isFirstImage: boolean): Promise<string> => {
      return uploadImageToCloudinary(image, isFirstImage, getToken);
    },
    [getToken]
  );

  const handleSubmitListing = useCallback(
    async (data: SellFormData): Promise<{ id: string }> => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return submitListingToApi(data, token);
    },
    [getToken]
  );

  return (
    <SellScreen
      isAuthenticated={true}
      onFetchCategories={fetchCategories}
      onSearchBrands={searchBrands}
      onSearchModels={searchModels}
      onUploadImage={handleUploadImage}
      onPickImages={pickImages}
      onTakePhoto={takePhoto}
      onSubmitListing={handleSubmitListing}
      onClose={() => navigation.goBack()}
      onSuccess={(productId) => {
        navigation.navigate("ProductDetail", { id: productId });
      }}
    />
  );
}

/**
 * Wrapper component for AccountScreen that provides Clerk user data
 * and sign-out functionality.
 */
function AccountScreenWrapper({ navigation }: { navigation: any }) {
  const { user } = useUser();
  const { signOut, getToken } = useAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  // Get seller status from context (already fetched at app level)
  const { status: sellerStatus, refresh: refreshSellerStatus } = useSellerStatusContext();

  // Fetch pending orders count
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  useEffect(() => {
    const fetchAccountData = async () => {
      // Skip API calls if no API URL configured
      if (!apiUrl) return;

      // Fetch orders count - fail silently if endpoint doesn't exist
      try {
        const ordersResponse = await deferredGet<{ orders: any[]; stats?: { active: number } }>(
          `${apiUrl}/api/orders?filter=active&limit=1`,
          { getToken }
        );
        // Only update if we got a valid response with expected shape
        if (ordersResponse && "orders" in ordersResponse) {
          setPendingOrdersCount(ordersResponse?.stats?.active || 0);
        }
      } catch (err) {
        // Endpoint may not exist yet - log for debugging and use default value
        // eslint-disable-next-line no-console
        console.log("Orders API not available:", err);
      }
    };

    void fetchAccountData();
  }, [getToken, apiUrl]);

  // Memoize handler to prevent re-render issues during navigation
  const handleSignOut = useCallback(async () => {
    await signOut();
    // After signOut, Clerk will automatically switch to SignedOut state
  }, [signOut]);

  const handleStartSellerOnboarding = useCallback(async () => {
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

      const onboardingUrl = `${apiUrl}/mobile-onboarding?token=${encodeURIComponent(session.token)}&apiUrl=${encodeURIComponent(apiUrl)}`;
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

  return (
    <AccountScreen
      user={
        user
          ? {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.primaryEmailAddress?.emailAddress,
              imageUrl: user.imageUrl,
            }
          : null
      }
      isSellerOnboarded={sellerStatus?.isReadyToSell ?? false}
      pendingOrdersCount={pendingOrdersCount}
      onSignOut={handleSignOut}
      onNavigateBack={() => navigation.goBack()}
      onEditProfile={() => navigation.navigate("ProfileEdit")}
      onViewOrders={() => navigation.navigate("Orders")}
      onViewFavourites={() => navigation.navigate("Favourites")}
      onViewSellerDashboard={() => navigation.navigate("SellerSales")}
      onStartSellerOnboarding={() => {
        void handleStartSellerOnboarding();
      }}
      onViewAddresses={() => navigation.navigate("Addresses")}
      onViewPayments={() => {
        // TODO: Implement payments WebView for Stripe Connect
        Alert.alert("Coming Soon", "Payment settings will be available soon.");
      }}
      onViewNotifications={() => navigation.navigate("NotificationSettings")}
      onViewHelp={() => navigation.navigate("HelpSupport")}
    />
  );
}

/**
 * Wrapper component for ProfileEditScreen with Clerk integration.
 */
function ProfileEditScreenWrapper({ navigation }: { navigation: any }) {
  const { user } = useUser();
  const { getToken } = useAuth();

  const handleUpdateProfile = useCallback(
    async (data: { firstName?: string; lastName?: string }) => {
      if (!user) throw new Error("Not authenticated");
      // Update via Clerk SDK - webhook syncs to database
      await user.update({
        firstName: data.firstName,
        lastName: data.lastName,
      });
    },
    [user]
  );

  const handlePickImage = useCallback(async () => {
    const images = await pickImages();
    return images[0] || null;
  }, []);

  const handleUpdateProfileImage = useCallback(
    async (image: { uri: string; width?: number; height?: number }) => {
      if (!user) throw new Error("Not authenticated");
      // Upload to Cloudinary then update Clerk profile
      const imageUrl = await uploadImageToCloudinary(image, false, getToken);
      await user.setProfileImage({ file: imageUrl });
      return imageUrl;
    },
    [user, getToken]
  );

  return (
    <ProfileEditScreen
      user={
        user
          ? {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.primaryEmailAddress?.emailAddress,
              imageUrl: user.imageUrl,
            }
          : null
      }
      onUpdateProfile={handleUpdateProfile}
      onPickImage={handlePickImage}
      onUpdateProfileImage={handleUpdateProfileImage}
      onBack={() => navigation.goBack()}
    />
  );
}

/**
 * Wrapper component for OrdersScreen with API integration.
 */
function OrdersScreenWrapper({ navigation }: { navigation: any }) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  const fetchOrders = useCallback(
    async (filter?: string) => {
      const params = new URLSearchParams();
      if (filter && filter !== "all") params.append("filter", filter);
      params.append("limit", "50");

      const data = await deferredGet<any>(`${apiUrl}/api/orders?${params.toString()}`, {
        getToken,
      });
      return data;
    },
    [getToken, apiUrl]
  );

  return (
    <OrdersScreen
      currentUserId={user?.id || ""}
      onFetchOrders={fetchOrders}
      onViewOrder={(orderId) => navigation.navigate("OrderDetail", { orderId })}
      onBack={() => navigation.goBack()}
      onBrowseProducts={() => navigation.navigate("Home")}
    />
  );
}

/**
 * Wrapper component for OrderDetailScreen with API integration.
 */
function OrderDetailScreenWrapper({ navigation, orderId }: { navigation: any; orderId: string }) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  const fetchOrder = useCallback(
    async (id: string) => {
      return deferredGet<any>(`${apiUrl}/api/orders/${id}`, { getToken });
    },
    [getToken, apiUrl]
  );

  const confirmReceipt = useCallback(
    async (id: string) => {
      await deferredPost(`${apiUrl}/api/orders/${id}/confirm-receipt`, {}, { getToken });
    },
    [getToken, apiUrl]
  );

  const submitRating = useCallback(
    async (id: string, rating: number, review?: string) => {
      return deferredPost<SellerRating>(
        `${apiUrl}/api/orders/${id}/rate`,
        { rating, review },
        { getToken }
      );
    },
    [getToken, apiUrl]
  );

  const generateLabel = useCallback(
    async (id: string) => {
      return deferredPost<{ labelUrl: string }>(
        `${apiUrl}/api/orders/${id}/shipping-label`,
        {},
        { getToken }
      );
    },
    [getToken, apiUrl]
  );

  const downloadLabel = useCallback(
    async (id: string) => {
      // Open label URL in browser
      const order = await deferredGet<{ shippingLabel?: { labelUrl: string } }>(
        `${apiUrl}/api/orders/${id}`,
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
    async (id: string, trackingNumber: string, carrier: string) => {
      await deferredPost(
        `${apiUrl}/api/orders/${id}/ship`,
        { trackingNumber, carrier },
        { getToken }
      );
    },
    [getToken, apiUrl]
  );

  return (
    <OrderDetailScreen
      orderId={orderId}
      currentUserId={user?.id || ""}
      onFetchOrder={fetchOrder}
      onConfirmReceipt={confirmReceipt}
      onSubmitRating={submitRating}
      onGenerateLabel={generateLabel}
      onDownloadLabel={downloadLabel}
      onMarkShipped={markShipped}
      onMessageSeller={(_: string) =>
        navigation.navigate("MessageThread", {
          orderId,
          userRole: "buyer",
        })
      }
      onMessageBuyer={(_: string) =>
        navigation.navigate("MessageThread", {
          orderId,
          userRole: "seller",
        })
      }
      onBack={() => navigation.goBack()}
    />
  );
}

/**
 * Wrapper component for AddressesScreen with API integration.
 */
function AddressesScreenWrapper({ navigation }: { navigation: any }) {
  const { getToken } = useAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  const fetchAddresses = useCallback(async () => {
    const data = await deferredGet<any[]>(`${apiUrl}/api/addresses`, { getToken });
    return data || [];
  }, [getToken, apiUrl]);

  const createAddress = useCallback(
    async (address: any) => {
      return deferredPost<any>(`${apiUrl}/api/addresses`, address, { getToken });
    },
    [getToken, apiUrl]
  );

  const updateAddress = useCallback(
    async (id: string, address: any) => {
      const response = await deferredFetch(`${apiUrl}/api/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(address),
        getToken,
      });
      return response.json();
    },
    [getToken, apiUrl]
  );

  const deleteAddress = useCallback(
    async (id: string) => {
      await deferredDelete(`${apiUrl}/api/addresses/${id}`, { getToken });
    },
    [getToken, apiUrl]
  );

  const setDefault = useCallback(
    async (id: string) => {
      await deferredPost(`${apiUrl}/api/addresses/${id}/default`, {}, { getToken });
    },
    [getToken, apiUrl]
  );

  return (
    <AddressesScreen
      onFetchAddresses={fetchAddresses}
      onCreateAddress={createAddress}
      onUpdateAddress={updateAddress}
      onDeleteAddress={deleteAddress}
      onSetDefault={setDefault}
      onBack={() => navigation.goBack()}
    />
  );
}

/**
 * Wrapper component for NotificationSettingsScreen.
 */
function NotificationSettingsScreenWrapper({ navigation }: { navigation: any }) {
  const { getToken } = useAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  const handleUpdateSettings = useCallback(
    async (settings: any) => {
      await deferredPost(`${apiUrl}/api/user/notifications`, settings, { getToken });
    },
    [getToken, apiUrl]
  );

  return (
    <NotificationSettingsScreen
      onUpdateSettings={handleUpdateSettings}
      onBack={() => navigation.goBack()}
    />
  );
}

/**
 * Wrapper component for HelpSupportScreen.
 */
function HelpSupportScreenWrapper({ navigation }: { navigation: any }) {
  return (
    <HelpSupportScreen supportEmail="support@buttergolf.com" onBack={() => navigation.goBack()} />
  );
}

/**
 * Wrapper component for SellerDashboardScreen with API integration.
 */
function SellerDashboardScreenWrapper({ navigation }: { navigation: any }) {
  const { getToken } = useAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";
  const { refresh: refreshSellerStatus } = useSellerStatusContext();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await deferredGet<any>(`${apiUrl}/api/seller/dashboard`, { getToken });
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch seller stats:", err);
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [getToken, apiUrl]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const handleOpenPayoutSetup = useCallback(async () => {
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

      const onboardingUrl = `${apiUrl}/mobile-onboarding?token=${encodeURIComponent(session.token)}&apiUrl=${encodeURIComponent(apiUrl)}`;
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

  return (
    <SellerDashboardScreen
      stats={stats}
      loading={loading}
      error={error}
      onListItem={() => navigation.navigate("Sell")}
      onViewSales={() => navigation.navigate("SellerSales")}
      onViewListings={() => navigation.navigate("SellerListings")}
      onViewPayments={() => {
        Alert.alert("Coming Soon", "Payment settings will be available soon.");
      }}
      onViewPayouts={() => {
        void handleOpenPayoutSetup();
      }}
      onViewSettings={() => navigation.navigate("Account")}
      onBack={() => navigation.goBack()}
      onRefresh={fetchStats}
    />
  );
}

/**
 * Wrapper component for SellerSalesScreen with API integration.
 */
function SellerSalesScreenWrapper({ navigation }: { navigation: any }) {
  const { getToken } = useAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  const fetchSales = useCallback(
    async (filter?: string) => {
      const params = new URLSearchParams();
      if (filter) params.append("filter", filter);
      return deferredGet<any>(`${apiUrl}/api/seller/sales?${params.toString()}`, { getToken });
    },
    [getToken, apiUrl]
  );

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

  return (
    <SellerSalesScreen
      onFetchSales={fetchSales}
      onGenerateLabel={generateLabel}
      onDownloadLabel={downloadLabel}
      onMarkShipped={markShipped}
      onViewOrder={(orderId) => navigation.navigate("OrderDetail", { orderId })}
      onMessageBuyer={(buyerId, orderId) =>
        navigation.navigate("MessageThread", {
          orderId,
          userRole: "seller",
        })
      }
      onBack={() => navigation.goBack()}
    />
  );
}

/**
 * Wrapper component for SellerListingsScreen with API integration.
 */
function SellerListingsScreenWrapper({ navigation }: { navigation: any }) {
  const { getToken } = useAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  const fetchListings = useCallback(
    async (filter?: string) => {
      const params = new URLSearchParams();
      if (filter) params.append("status", filter);
      return deferredGet<any>(`${apiUrl}/api/seller/listings?${params.toString()}`, { getToken });
    },
    [getToken, apiUrl]
  );

  const toggleStatus = useCallback(
    async (listingId: string, active: boolean) => {
      await deferredPost(`${apiUrl}/api/products/${listingId}/status`, { active }, { getToken });
    },
    [getToken, apiUrl]
  );

  const deleteListing = useCallback(
    async (listingId: string) => {
      await deferredDelete(`${apiUrl}/api/products/${listingId}`, { getToken });
    },
    [getToken, apiUrl]
  );

  return (
    <SellerListingsScreen
      onFetchListings={fetchListings}
      onCreateListing={() => navigation.navigate("Sell")}
      onEditListing={(listingId) => navigation.navigate("Sell", { editId: listingId })}
      onViewListing={(listingId) => navigation.navigate("ProductDetail", { id: listingId })}
      onToggleStatus={toggleStatus}
      onDeleteListing={deleteListing}
      onBack={() => navigation.goBack()}
    />
  );
}

/**
 * Wrapper component for CategoryListScreen that provides favourites
 * functionality with Clerk authentication.
 */
function CategoryListScreenWrapper({
  navigation,
  categorySlug,
  categoryName,
  isAuthenticated,
  onLoginPress,
}: {
  navigation: any;
  categorySlug: string;
  categoryName: string;
  isAuthenticated: boolean;
  onLoginPress?: () => void;
}) {
  const { getToken } = useAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  // Create a deferred fetch function that handles auth via deferredFetch
  // This prevents TurboModule race conditions during navigation
  const deferredFetchWithAuth = useCallback(
    (url: string, options?: RequestInit) => {
      // Extract signal and handle null -> undefined conversion for type compatibility
      const { signal, ...restOptions } = options || {};
      return deferredFetch(url, {
        ...restOptions,
        signal: signal ?? undefined,
        getToken,
      });
    },
    [getToken]
  );

  const { favourites, toggleFavourite } = useMobileFavourites({
    apiUrl,
    getToken,
    isAuthenticated,
    fetchFn: deferredFetchWithAuth,
  });

  return (
    <CategoryListScreen
      categorySlug={categorySlug}
      categoryName={categoryName}
      onFetchProducts={fetchProductsByCategory}
      onBack={() => navigation.goBack()}
      onSellPress={() => navigation.navigate("Sell")}
      isAuthenticated={isAuthenticated}
      onAccountPress={isAuthenticated ? () => navigation.navigate("Account") : undefined}
      onLoginPress={onLoginPress}
      favourites={favourites}
      onToggleFavourite={toggleFavourite}
      onHomePress={() => navigation.navigate("Home")}
      onWishlistPress={() => navigation.navigate("Favourites")}
      onMessagesPress={() => navigation.navigate("Messages")}
      onProductPress={(productId) => navigation.navigate("ProductDetail", { id: productId })}
    />
  );
}

/**
 * Wrapper component for FavouritesScreen that provides data fetching,
 * navigation handlers, and checkout/offer sheet functionality.
 */
function FavouritesScreenWrapper({
  navigation,
  isAuthenticated,
  onLoginPress,
}: {
  navigation: any;
  isAuthenticated: boolean;
  onLoginPress?: () => void;
}) {
  const { getToken } = useAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  // State for checkout sheet
  const [checkoutSheetOpen, setCheckoutSheetOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    title: string;
    price: number;
    sellerId: string;
  } | null>(null);

  // Memoize getToken callback for sheets
  const getTokenCallback = useCallback(async () => {
    return getToken();
  }, [getToken]);

  // Memoize fetch functions to prevent re-render issues during navigation
  // Uses deferredFetch to prevent TurboModule race conditions
  const fetchFavourites = useCallback(async () => {
    console.info("[FavouritesScreenWrapper] Fetching favourites");

    const url = `${apiUrl}/api/favourites?page=1&limit=100`;
    const response = await deferredFetch(url, { getToken });

    if (!response.ok) {
      throw new Error("Failed to fetch favourites");
    }

    return response.json();
  }, [getToken, apiUrl]);

  const removeFavourite = useCallback(
    async (productId: string) => {
      await deferredDelete(`${apiUrl}/api/favourites/${productId}`, { getToken });
    },
    [getToken, apiUrl]
  );

  // Handle Buy Now - fetch product and open checkout sheet
  const handleBuyNow = useCallback((productId: string) => {
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
  }, []);

  // Handle Make Offer - create conversation, post offer, and navigate to message thread
  const handleMakeOffer = useCallback(
    async (productId: string, _price: number, offerAmount: number) => {
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
    [getToken, apiUrl, navigation]
  );

  // Handle checkout success
  const handleCheckoutSuccess = useCallback(
    (_: string) => {
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
    },
    [navigation]
  );

  return (
    <>
      <FavouritesScreen
        isAuthenticated={isAuthenticated}
        onFetchFavourites={fetchFavourites}
        onRemoveFavourite={removeFavourite}
        onBack={() => navigation.goBack()}
        onViewProduct={(id) => navigation.navigate("ProductDetail", { id })}
        onBuyNow={handleBuyNow}
        onMakeOffer={handleMakeOffer}
        onBrowseListings={() => navigation.navigate("Home")}
        onHomePress={() => navigation.navigate("Home")}
        onSellPress={() => navigation.navigate("Sell")}
        onMessagesPress={() => navigation.navigate("Messages")}
        onLoginPress={onLoginPress}
        onAccountPress={() => navigation.navigate("Account")}
      />

      {/* Checkout Sheet */}
      {selectedProduct && (
        <MobileCheckoutSheet
          open={checkoutSheetOpen}
          onOpenChange={setCheckoutSheetOpen}
          productId={selectedProduct.id}
          productTitle={selectedProduct.title}
          productPrice={selectedProduct.price}
          sellerId={selectedProduct.sellerId}
          getToken={getTokenCallback}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </>
  );
}

/**
 * Wrapper component for MessagesScreen that provides navigation handlers.
 */
function MessagesScreenWrapper({
  navigation,
  isAuthenticated,
}: {
  navigation: any;
  isAuthenticated: boolean;
}) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  const fetchConversations = useCallback(
    async (page?: number) => {
      console.info("[MessagesScreenWrapper] Fetching conversations", {
        page,
        clerkUserId: user?.id,
      });

      const qs = page && page > 1 ? `?page=${page}` : "";
      const response = await deferredFetch(`${apiUrl}/api/conversations${qs}`, { getToken });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[MessagesScreenWrapper] API error:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`Failed to fetch conversations: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.info("[MessagesScreenWrapper] Conversations fetched", {
        count: Array.isArray(data?.conversations) ? data.conversations.length : 0,
        hasMore: Boolean(data?.hasMore),
        page: data?.page,
      });
      return data;
    },
    [getToken, apiUrl, user?.id]
  );

  return (
    <MessagesScreen
      isAuthenticated={isAuthenticated}
      onFetchConversations={fetchConversations}
      onConversationPress={(conversation) =>
        navigation.navigate("MessageThread", {
          conversationId: conversation.id,
          otherUserName: conversation.otherUserName,
          otherUserImage: conversation.otherUserImage,
          productTitle: conversation.productTitle,
          userRole: conversation.userRole,
          productSold: conversation.productSold,
          hasActiveOffer:
            !!conversation.activeOfferStatus &&
            (conversation.activeOfferStatus === "PENDING" ||
              conversation.activeOfferStatus === "COUNTERED"),
        })
      }
      onBrowseListings={() => navigation.navigate("Home")}
      onHomePress={() => navigation.navigate("Home")}
      onWishlistPress={() => navigation.navigate("Favourites")}
      onSellPress={() => navigation.navigate("Sell")}
      onMessagesPress={() => {}} // Already on messages
      onAccountPress={() => navigation.navigate("Account")}
    />
  );
}

/**
 * Wrapper component for MessageThreadScreen that provides navigation handlers.
 * Uses conversation-based APIs with offer support.
 */
function MessageThreadScreenWrapper({
  navigation,
  conversationId,
  otherUserName,
  otherUserImage,
  productTitle,
  userRole,
  productSold,
  hasActiveOffer,
}: {
  navigation: any;
  conversationId: string;
  otherUserName: string;
  otherUserImage: string | null;
  productTitle: string;
  userRole: "buyer" | "seller";
  productSold?: boolean;
  hasActiveOffer?: boolean;
}) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  const fetchMessages = useCallback(
    async (id: string, cursor?: string) => {
      const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const response = await deferredFetch(`${apiUrl}/api/conversations/${id}/messages${qs}`, {
        getToken,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }

      return response.json();
    },
    [getToken, apiUrl]
  );

  const sendMessage = useCallback(
    async (id: string, content: string) => {
      const data = await deferredPost<{ message: Message }>(
        `${apiUrl}/api/conversations/${id}/messages`,
        { content },
        { getToken }
      );
      return data.message;
    },
    [getToken, apiUrl]
  );

  const markAsRead = useCallback(
    async (id: string) => {
      await deferredFetch(`${apiUrl}/api/conversations/${id}/messages/mark-read`, {
        method: "POST",
        getToken,
      });
    },
    [getToken, apiUrl]
  );

  const handleMakeOffer = useCallback(
    async (amount: number, message?: string) => {
      await deferredPost(
        `${apiUrl}/api/conversations/${conversationId}/offer`,
        { amount, message },
        { getToken }
      );
    },
    [getToken, apiUrl, conversationId]
  );

  const handleCounterOffer = useCallback(
    async (amount: number, message?: string) => {
      await deferredPost(
        `${apiUrl}/api/conversations/${conversationId}/offer/counter`,
        { amount, message },
        { getToken }
      );
    },
    [getToken, apiUrl, conversationId]
  );

  const handleAcceptOffer = useCallback(async () => {
    await deferredPost(
      `${apiUrl}/api/conversations/${conversationId}/offer/accept`,
      {},
      { getToken }
    );
  }, [getToken, apiUrl, conversationId]);

  const handleRejectOffer = useCallback(async () => {
    await deferredPost(
      `${apiUrl}/api/conversations/${conversationId}/offer/reject`,
      {},
      { getToken }
    );
  }, [getToken, apiUrl, conversationId]);

  // Pre-fetch auth token so the SSE factory can use it synchronously.
  const [authToken, setAuthToken] = useState<string | null>(null);
  useEffect(() => {
    getToken().then((t) => setAuthToken(t));
  }, [getToken]);

  const createEventSource = useMemo(() => {
    if (!authToken) return undefined;
    return (url: string) => {
      const fullUrl = url.startsWith("http") ? url : `${apiUrl}${url}`;
      const es = new RNEventSource(fullUrl, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return es as unknown as import("@buttergolf/app").EventSourceLike;
    };
  }, [apiUrl, authToken]);

  return (
    <MessageThreadScreen
      orderId={conversationId}
      currentUserId={user?.id || ""}
      userRole={userRole}
      otherUserName={otherUserName}
      otherUserImage={otherUserImage}
      productTitle={productTitle}
      showOfferButton={userRole === "buyer" && !productSold && !hasActiveOffer}
      onFetchMessages={fetchMessages}
      onSendMessage={sendMessage}
      onMarkAsRead={markAsRead}
      onMakeOffer={handleMakeOffer}
      onCounterOffer={handleCounterOffer}
      onAcceptOffer={handleAcceptOffer}
      onRejectOffer={handleRejectOffer}
      onBack={() => navigation.goBack()}
      createEventSource={createEventSource}
    />
  );
}

/**
 * Wrapper component for HomeScreen that provides navigation handlers.
 */
function HomeScreenWrapper({
  navigation,
  isAuthenticated,
  onLoginPress,
}: {
  navigation: any;
  isAuthenticated: boolean;
  onLoginPress?: () => void;
}) {
  return (
    <HomeScreen
      onFetchProducts={fetchProducts}
      onSellPress={() => navigation.navigate("Sell")}
      isAuthenticated={isAuthenticated}
      onAccountPress={() => navigation.navigate("Account")}
      onWishlistPress={() => navigation.navigate("Favourites")}
      onMessagesPress={() => navigation.navigate("Messages")}
      onCategoryPress={(slug) => navigation.navigate("Category", { slug })}
      onLoginPress={onLoginPress}
      hideBuySellToggle={true}
    />
  );
}

/**
 * Wrapper component for ProductDetailScreen that provides checkout and offer sheet functionality.
 */
function ProductDetailScreenWrapper({
  navigation,
  productId,
  isAuthenticated,
}: {
  navigation: any;
  productId: string;
  isAuthenticated: boolean;
}) {
  const { getToken } = useAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  // State for checkout sheet
  const [checkoutSheetOpen, setCheckoutSheetOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    title: string;
    price: number;
    sellerId: string;
  } | null>(null);

  // Memoize getToken callback to avoid recreating every render
  const getTokenCallback = useCallback(async () => {
    return getToken();
  }, [getToken]);

  const handleBuyNow = useCallback((id: string, _: number) => {
    fetchProduct(id)
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
  }, []);

  const handleMakeOffer = useCallback(
    async (id: string, _price: number, offerAmount: number) => {
      try {
        const data = await deferredPost<{ conversationId: string }>(
          `${apiUrl}/api/conversations`,
          { productId: id },
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
    [getToken, apiUrl, navigation]
  );

  const handleCheckoutSuccess = useCallback(
    (_: string) => {
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
    },
    [navigation]
  );

  return (
    <>
      <ProductDetailScreen
        productId={productId}
        onFetchProduct={fetchProduct}
        onBack={() => navigation.goBack()}
        onBuyNow={handleBuyNow}
        onMakeOffer={handleMakeOffer}
        isAuthenticated={isAuthenticated}
      />

      {/* Checkout Sheet */}
      {selectedProduct && (
        <MobileCheckoutSheet
          open={checkoutSheetOpen}
          onOpenChange={setCheckoutSheetOpen}
          productId={selectedProduct.id}
          productTitle={selectedProduct.title}
          productPrice={selectedProduct.price}
          sellerId={selectedProduct.sellerId}
          getToken={getTokenCallback}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </>
  );
}

/**
 * Component that handles push token registration for authenticated users
 * Must be inside SignedIn to have access to useAuth hook
 */
function PushTokenRegistration() {
  const { getToken } = useAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  useEffect(() => {
    let mounted = true;
    const abortController = new AbortController();

    const registerPushToken = async () => {
      try {
        addBreadcrumb("turbomodule.notifications", "Starting push token registration");

        const authToken = await getToken();
        if (!authToken) {
          addBreadcrumb("turbomodule.notifications", "No auth token, skipping", {}, "warning");
          return;
        }

        // Check if we've been unmounted/cancelled
        if (!mounted || abortController.signal.aborted) {
          addBreadcrumb(
            "turbomodule.notifications",
            "Registration cancelled (unmount)",
            {},
            "debug"
          );
          return;
        }

        // Register for push notifications
        addBreadcrumb("turbomodule.notifications", "Calling registerForPushNotificationsAsync");
        const pushToken = await registerForPushNotificationsAsync(authToken);

        if (!pushToken || !mounted || abortController.signal.aborted) {
          addBreadcrumb("turbomodule.notifications", "No push token or cancelled", {
            hasPushToken: !!pushToken,
          });
          return;
        }

        // Register the push token with the backend
        addBreadcrumb("turbomodule.notifications", "Registering token with backend");
        await registerPushTokenWithBackend(pushToken, authToken, apiUrl);
        addBreadcrumb("turbomodule.notifications", "Push registration complete");
      } catch (error) {
        addBreadcrumb(
          "turbomodule.notifications",
          "Push registration failed",
          { error: String(error) },
          "error"
        );
        console.error("[PushToken] Error registering push token:", error);
      }
    };

    // All TurboModule-heavy operations (SecureStore, fetch) are now wrapped in
    // InteractionManager.runAfterInteractions() via deferredFetch and deferredSecureStore.
    // This ensures they wait for navigation animations to complete before executing,
    // preventing race conditions without needing an arbitrary timeout.
    registerPushToken();

    return () => {
      mounted = false;
      abortController.abort();
    };
  }, [getToken, apiUrl]);

  return null; // This component doesn't render anything
}

/**
 * Custom navigation theme that matches ButterGolf brand colors
 * Based on React Navigation's DefaultTheme/DarkTheme
 *
 * Uses shared brand colors from @buttergolf/constants for single source of truth.
 * @see packages/constants/src/brandColors.ts
 */
const LightNavigationTheme: NavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: brandColors.spicedClementine,
    background: brandColors.vanillaCream,
    card: brandColors.pureWhite,
    text: brandColors.ironstone,
    border: brandColors.cloudMist,
    notification: brandColors.spicedClementine,
  },
};

/**
 * Dark navigation theme
 * Uses shared brand colors from @buttergolf/constants.
 * background: #323232 (ironstone) - main app background
 * card: #545454 (slateSmoke) - elevated surfaces
 */
const DarkNavigationTheme: NavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: brandColors.spicedClementine,
    background: brandColors.ironstone,
    card: brandColors.slateSmoke,
    text: brandColors.pureWhite,
    border: brandColors.slateSmoke,
    notification: brandColors.spicedClementine,
  },
};

export default function App() {
  const FORCE_MINIMAL = false; // back to normal app rendering

  // Official Tamagui/Expo pattern: use React Native's useColorScheme()
  // This follows system preference automatically (app.json has userInterfaceStyle: "automatic")
  const colorScheme = useColorScheme();

  // Validate colorScheme and default to 'light' if null/undefined
  const validColorScheme = colorScheme === "dark" ? "dark" : "light";
  const navigationTheme = validColorScheme === "dark" ? DarkNavigationTheme : LightNavigationTheme;

  // Load Urbanist font weights for React Native using expo-google-fonts
  const [fontsLoaded] = useFonts({
    "Urbanist-Regular": Urbanist_400Regular,
    "Urbanist-Medium": Urbanist_500Medium,
    "Urbanist-SemiBold": Urbanist_600SemiBold,
    "Urbanist-Bold": Urbanist_700Bold,
    "Urbanist-ExtraBold": Urbanist_800ExtraBold,
    "Urbanist-Black": Urbanist_900Black,
  });

  useEffect(() => {
    async function hideSplash() {
      if (fontsLoaded) {
        // small timeout ensures logo renders at least one frame
        await new Promise((r) => setTimeout(r, 50));
        await SplashScreen.hideAsync();
      }
    }
    hideSplash();
  }, [fontsLoaded]);

  // Setup push notifications on app load
  useEffect(() => {
    // Setup notification handlers
    const unsubscribe = setupNotificationHandlers(
      (notification) => {
        console.info("[App] Notification received:", {
          title: notification.request.content.title,
        });
      },
      (response) => {
        // Handle notification tap - navigate to message thread
        const orderId = response.notification.request.content.data?.orderId;
        if (orderId) {
          console.info("[App] Navigating to message thread:", orderId);
          // Note: Navigation will be handled by deep linking
        }
      }
    );

    return unsubscribe;
  }, []);

  if (!fontsLoaded) return null;

  // Token cache using shared deferred SecureStore to prevent TurboModule race conditions
  // WHY: SecureStore calls race with react-native-svg unmounting during screen transitions,
  // causing SIGABRT in ObjCTurboModule::performVoidMethodInvocation
  // See: apps/mobile/lib/secureStore.ts for implementation details
  const tokenCache = {
    getToken: (key: string) => deferredSecureStoreGet(key),
    saveToken: (key: string, value: string) => deferredSecureStoreSet(key, value),
  };

  if (FORCE_MINIMAL) {
    return (
      <RNView
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fbfbf9",
        }}
      >
        <RNText style={{ fontSize: 20, marginBottom: 12 }}>Minimal RN screen</RNText>
        <RNPressable
          onPress={() => {}}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: "#13a063",
            borderRadius: 8,
          }}
        >
          <RNText style={{ color: "white", fontWeight: "600" }}>Tap</RNText>
        </RNPressable>
      </RNView>
    );
  }

  // Debug: Verify environment keys are loaded
  const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const stripeMerchantIdentifierEnv = process.env.EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER;
  const stripeMerchantIdentifierFromEnv = stripeMerchantIdentifierEnv?.trim() || "";
  const stripeMerchantIdentifier =
    stripeMerchantIdentifierFromEnv || DEFAULT_STRIPE_MERCHANT_IDENTIFIER;

  console.info("[Clerk] Publishable key:", clerkPublishableKey ? "LOADED" : "MISSING");
  console.info("[Stripe] Publishable key:", stripePublishableKey ? "LOADED" : "MISSING");
  if (stripeMerchantIdentifierFromEnv) {
    console.info(
      "[Stripe] Merchant identifier:",
      "LOADED_FROM_ENV (EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER)"
    );
  } else {
    console.info(
      "[Stripe] Merchant identifier:",
      `USING_DEFAULT (${DEFAULT_STRIPE_MERCHANT_IDENTIFIER}) - set EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER to override`
    );
  }
  console.info("[Stripe] Native module available:", isStripeAvailable ? "YES" : "NO (Expo Go)");

  // CRITICAL: If required keys are missing, show error screen
  // Stripe key is only required when the native module is available (dev builds)
  // iOS Apple Pay requires merchant identifier in StripeProvider initialization
  const requiresStripeIosMerchantIdentifier = Platform.OS === "ios" && isStripeAvailable;

  if (
    !clerkPublishableKey ||
    (isStripeAvailable && !stripePublishableKey) ||
    (requiresStripeIosMerchantIdentifier && !stripeMerchantIdentifier)
  ) {
    const missingKeys: string[] = [];
    if (!clerkPublishableKey) missingKeys.push("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
    if (isStripeAvailable && !stripePublishableKey)
      missingKeys.push("EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY");
    if (requiresStripeIosMerchantIdentifier && !stripeMerchantIdentifier)
      missingKeys.push("EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER");

    return (
      <SafeAreaProvider>
        <RNView
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fbfbf9",
            padding: 20,
          }}
        >
          <RNText style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16, color: "#dc2626" }}>
            Configuration Error
          </RNText>
          <RNText style={{ fontSize: 16, marginBottom: 12, textAlign: "center" }}>
            Missing required environment variables:
          </RNText>
          {missingKeys.map((key) => (
            <RNText
              key={key}
              style={{ fontSize: 14, fontFamily: "monospace", marginBottom: 4, color: "#ef4444" }}
            >
              • {key}
            </RNText>
          ))}
          <RNText style={{ fontSize: 14, marginTop: 16, textAlign: "center", color: "#666" }}>
            Please configure these in EAS secrets and rebuild the app.
          </RNText>
        </RNView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeStripeProvider
        publishableKey={stripePublishableKey || ""}
        merchantIdentifier={Platform.OS === "ios" ? stripeMerchantIdentifier : undefined}
      >
        <ClerkProvider tokenCache={tokenCache} publishableKey={clerkPublishableKey}>
          {/* Official Tamagui Expo pattern: use useColorScheme() for theme */}
          <PortalProvider shouldAddRootHost>
            <Provider defaultTheme={validColorScheme}>
              <ClerkLoaded>
                <SignedIn>
                  {/* SellerStatusProvider fetches seller status ONCE on sign-in and shares via context.
                This prevents the infinite API call loop that occurred when each screen
                had its own useSellerStatus hook instance. DO NOT remove this provider
                or revert to a hook-based approach - see context/SellerStatusContext.tsx */}
                  <SellerStatusProvider>
                    <PushTokenRegistration />
                    <NavigationContainer linking={linking} theme={navigationTheme}>
                      <Stack.Navigator screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="Home">
                          {({ navigation }: { navigation: any }) => (
                            <HomeScreenWrapper navigation={navigation} isAuthenticated={true} />
                          )}
                        </Stack.Screen>
                        {/* Products screen - intentionally reuses HomeScreenWrapper for deep linking support.
                            This allows /products URLs to be handled by the app while sharing the same
                            product listing UI as Home. In the future, this could have different filters
                            or UI treatments if needed. See also Home screen which displays the same. */}
                        <Stack.Screen name="Products">
                          {({ navigation }: { navigation: any }) => (
                            <HomeScreenWrapper navigation={navigation} isAuthenticated={true} />
                          )}
                        </Stack.Screen>
                        <Stack.Screen
                          name="Rounds"
                          component={RoundsScreen}
                          options={{ title: "Your Rounds" }}
                        />
                        <Stack.Screen
                          name="ProductDetail"
                          options={{ title: "Product Details", headerShown: false }}
                        >
                          {({
                            route,
                            navigation,
                          }: {
                            route: RouteParams<"ProductDetail">;
                            navigation: any;
                          }) => (
                            <ProductDetailScreenWrapper
                              navigation={navigation}
                              productId={route.params?.id || ""}
                              isAuthenticated={true}
                            />
                          )}
                        </Stack.Screen>
                        <Stack.Screen
                          name="Category"
                          options={({ route }: { route: RouteParams<"Category"> }) => {
                            const slug = route.params?.slug;
                            return {
                              title: slug
                                ? slug.charAt(0).toUpperCase() + slug.slice(1)
                                : "Category",
                              headerShown: false, // CategoryListScreen has its own header
                            };
                          }}
                        >
                          {({
                            route,
                            navigation,
                          }: {
                            route: RouteParams<"Category">;
                            navigation: any;
                          }) => {
                            const slug = route.params?.slug;
                            return (
                              <CategoryListScreenWrapper
                                navigation={navigation}
                                categorySlug={slug || ""}
                                categoryName={
                                  slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "Category"
                                }
                                isAuthenticated={true}
                              />
                            );
                          }}
                        </Stack.Screen>
                        <Stack.Screen name="Account" options={{ headerShown: false }}>
                          {({ navigation }: { navigation: any }) => (
                            <AccountScreenWrapper navigation={navigation} />
                          )}
                        </Stack.Screen>
                        <Stack.Screen name="ProfileEdit" options={{ headerShown: false }}>
                          {({ navigation }: { navigation: any }) => (
                            <ProfileEditScreenWrapper navigation={navigation} />
                          )}
                        </Stack.Screen>
                        <Stack.Screen name="Orders" options={{ headerShown: false }}>
                          {({ navigation }: { navigation: any }) => (
                            <OrdersScreenWrapper navigation={navigation} />
                          )}
                        </Stack.Screen>
                        <Stack.Screen name="OrderDetail" options={{ headerShown: false }}>
                          {({
                            route,
                            navigation,
                          }: {
                            route: { params?: { orderId?: string } };
                            navigation: any;
                          }) => (
                            <OrderDetailScreenWrapper
                              navigation={navigation}
                              orderId={route.params?.orderId || ""}
                            />
                          )}
                        </Stack.Screen>
                        <Stack.Screen name="Addresses" options={{ headerShown: false }}>
                          {({ navigation }: { navigation: any }) => (
                            <AddressesScreenWrapper navigation={navigation} />
                          )}
                        </Stack.Screen>
                        <Stack.Screen name="NotificationSettings" options={{ headerShown: false }}>
                          {({ navigation }: { navigation: any }) => (
                            <NotificationSettingsScreenWrapper navigation={navigation} />
                          )}
                        </Stack.Screen>
                        <Stack.Screen name="HelpSupport" options={{ headerShown: false }}>
                          {({ navigation }: { navigation: any }) => (
                            <HelpSupportScreenWrapper navigation={navigation} />
                          )}
                        </Stack.Screen>
                        <Stack.Screen name="SellerDashboard" options={{ headerShown: false }}>
                          {({ navigation }: { navigation: any }) => (
                            <SellerDashboardScreenWrapper navigation={navigation} />
                          )}
                        </Stack.Screen>
                        <Stack.Screen name="SellerSales" options={{ headerShown: false }}>
                          {({ navigation }: { navigation: any }) => (
                            <SellerSalesScreenWrapper navigation={navigation} />
                          )}
                        </Stack.Screen>
                        <Stack.Screen name="SellerListings" options={{ headerShown: false }}>
                          {({ navigation }: { navigation: any }) => (
                            <SellerListingsScreenWrapper navigation={navigation} />
                          )}
                        </Stack.Screen>
                        <Stack.Screen
                          name="Sell"
                          options={{
                            headerShown: false, // SellScreen has its own header
                            presentation: "modal",
                          }}
                        >
                          {({ navigation }: { navigation: any }) => (
                            <SellScreenWrapper navigation={navigation} />
                          )}
                        </Stack.Screen>
                        <Stack.Screen name="Favourites" options={{ headerShown: false }}>
                          {({ navigation }: { navigation: any }) => (
                            <FavouritesScreenWrapper
                              navigation={navigation}
                              isAuthenticated={true}
                            />
                          )}
                        </Stack.Screen>
                        <Stack.Screen name="Messages" options={{ headerShown: false }}>
                          {({ navigation }: { navigation: any }) => (
                            <MessagesScreenWrapper navigation={navigation} isAuthenticated={true} />
                          )}
                        </Stack.Screen>
                        <Stack.Screen name="MessageThread" options={{ headerShown: false }}>
                          {({
                            route,
                            navigation,
                          }: {
                            route: {
                              params?: {
                                conversationId?: string;
                                otherUserName?: string;
                                otherUserImage?: string | null;
                                productTitle?: string;
                                userRole?: "buyer" | "seller";
                                productSold?: boolean;
                                hasActiveOffer?: boolean;
                              };
                            };
                            navigation: any;
                          }) => (
                            <MessageThreadScreenWrapper
                              navigation={navigation}
                              conversationId={route.params?.conversationId || ""}
                              otherUserName={route.params?.otherUserName || "User"}
                              otherUserImage={route.params?.otherUserImage ?? null}
                              productTitle={route.params?.productTitle || ""}
                              userRole={route.params?.userRole || "buyer"}
                              productSold={route.params?.productSold}
                              hasActiveOffer={route.params?.hasActiveOffer}
                            />
                          )}
                        </Stack.Screen>
                      </Stack.Navigator>
                    </NavigationContainer>
                  </SellerStatusProvider>
                </SignedIn>
                <SignedOut>
                  {/* Render the designed onboarding screen (animations currently disabled for stability) */}
                  <NavigationContainer linking={linking} theme={navigationTheme}>
                    <OnboardingFlow />
                  </NavigationContainer>
                </SignedOut>
              </ClerkLoaded>
            </Provider>
          </PortalProvider>
        </ClerkProvider>
      </SafeStripeProvider>
    </SafeAreaProvider>
  );
}

function OnboardingFlow() {
  const [flowState, setFlowState] = useState<
    | "onboarding"
    | "signIn"
    | "signUp"
    | "verifyEmail"
    | "forgotPassword"
    | "resetPassword"
    | "twoFactor"
    | "loggedOutHome"
  >("onboarding");
  const [resetPasswordEmail, setResetPasswordEmail] = useState<string>("");
  const [signUpEmail, setSignUpEmail] = useState<string>("");

  const Stack = createNativeStackNavigator();

  if (flowState === "loggedOutHome") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="LoggedOutHome">
          {({ navigation }: { navigation: any }) => (
            <HomeScreen
              onFetchProducts={fetchProducts}
              onSellPress={() => setFlowState("signIn")}
              isAuthenticated={false}
              onLoginPress={() => setFlowState("signIn")}
              onWishlistPress={() => setFlowState("signIn")}
              onCategoryPress={(slug) => navigation.navigate("Category", { slug })}
              hideBuySellToggle={true}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="Category"
          options={({ route }: { route: RouteParams<"Category"> }) => {
            const slug = (route.params as { slug?: string })?.slug;
            return {
              title: slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "Category",
              headerShown: false,
            };
          }}
        >
          {({ route, navigation }) => {
            const slug = (route.params as { slug?: string })?.slug;
            return (
              <CategoryListScreen
                categorySlug={slug || ""}
                categoryName={slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "Category"}
                onFetchProducts={fetchProductsByCategory}
                onBack={() => navigation.goBack()}
                onSellPress={() => setFlowState("signIn")}
                isAuthenticated={false}
                onLoginPress={() => setFlowState("signIn")}
                onHomePress={() => navigation.navigate("LoggedOutHome")}
                onWishlistPress={() => setFlowState("signIn")}
                onMessagesPress={() => setFlowState("signIn")}
              />
            );
          }}
        </Stack.Screen>
        <Stack.Screen
          name="Sell"
          options={{
            headerShown: false,
            presentation: "modal",
          }}
        >
          {({ navigation }: { navigation: any }) => (
            <SellScreen
              isAuthenticated={false}
              onRequireAuth={() => {
                // Close modal and navigate to sign in
                navigation.goBack();
                setFlowState("signIn");
              }}
              onPickImages={pickImages}
              onTakePhoto={takePhoto}
              onClose={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  if (flowState === "signIn") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="SignIn">
          {() => (
            <SignInScreen
              onSuccess={() => {
                // Auth successful, ClerkProvider handles session
              }}
              onNavigateToSignUp={() => setFlowState("signUp")}
              onNavigateToForgotPassword={() => setFlowState("forgotPassword")}
              onNavigateToTwoFactor={() => setFlowState("twoFactor")}
              onNavigateBack={() => setFlowState("onboarding")}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  if (flowState === "signUp") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="SignUp">
          {() => (
            <SignUpScreen
              onSuccess={(email) => {
                setSignUpEmail(email);
                setFlowState("verifyEmail");
              }}
              onNavigateToSignIn={() => setFlowState("signIn")}
              onNavigateBack={() => setFlowState("onboarding")}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  if (flowState === "twoFactor") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="TwoFactor">
          {() => (
            <TwoFactorScreen
              onSuccess={() => {
                // Auth successful, ClerkProvider handles session
              }}
              onNavigateBack={() => setFlowState("signIn")}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  if (flowState === "verifyEmail") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="VerifyEmail">
          {() => (
            <VerifyEmailScreen
              email={signUpEmail}
              onSuccess={() => {
                // Auth successful, ClerkProvider handles session
              }}
              onNavigateBack={() => setFlowState("signUp")}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  if (flowState === "forgotPassword") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ForgotPassword">
          {() => (
            <ForgotPasswordScreen
              onSuccess={(email) => {
                setResetPasswordEmail(email);
                setFlowState("resetPassword");
              }}
              onNavigateBack={() => setFlowState("signIn")}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  if (flowState === "resetPassword") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ResetPassword">
          {() => (
            <ResetPasswordScreen
              email={resetPasswordEmail}
              onSuccess={() => setFlowState("signIn")}
              onNavigateBack={() => setFlowState("forgotPassword")}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  // Default: Onboarding screen
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding">
        {() => (
          <OnboardingScreen
            onSkip={() => setFlowState("loggedOutHome")}
            onSignUp={() => setFlowState("signUp")}
            onSignIn={() => setFlowState("signIn")}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
