import { NavigationContainer, DarkTheme, DefaultTheme, Theme as NavigationTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { brandColors } from "@buttergolf/constants";
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
} from "@buttergolf/app";
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
import {
  MobileCheckoutSheet,
  MakeOfferSheet,
  OffersListScreen,
  OfferDetailScreen,
  SellerOnboardingGate,
} from "./components";
import {
  View as RNView,
  Text as RNText,
  Pressable as RNPressable,
  Alert,
  Platform,
  useColorScheme,
} from "react-native";
import { ClerkProvider, SignedIn, SignedOut, useAuth, useUser } from "@clerk/clerk-expo";
import { StripeProvider } from "@stripe/stripe-react-native";
import * as SecureStore from "expo-secure-store";
import {
  registerForPushNotificationsAsync,
  registerPushTokenWithBackend,
  setupNotificationHandlers,
} from "./lib/notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Button, Text } from "@buttergolf/ui";
import { useState, useEffect, useCallback } from "react";
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

// Define navigation param types
type RootStackParamList = {
  ProductDetail: { id?: string };
  Category: { slug?: string };
  Offers: undefined;
  OfferDetail: { offerId?: string };
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
        path: "orders/:orderId/messages",
      },
      Offers: {
        path: "offers",
      },
      OfferDetail: {
        path: "offers/:offerId",
      },
      Sell: {
        path: routes.sell.slice(1), // 'sell'
      },
      // Seller onboarding deep link routes (handled by SellerOnboardingGate)
      SellerOnboardingComplete: {
        path: "seller/onboarding/complete",
      },
      SellerOnboardingRefresh: {
        path: "seller/onboarding/refresh",
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
    },
  },
};

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <Button
      size="$2"
      chromeless
      onPress={() => signOut()}
      paddingHorizontal="$3"
    >
      <Text>Sign Out</Text>
    </Button>
  );
}

const HeaderRightComponent = () => <SignOutButton />;

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
          "Please create apps/mobile/.env file with: EXPO_PUBLIC_API_URL=http://localhost:3000",
      );
    }

    console.log("Fetching products from:", apiUrl);
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
async function fetchProductsByCategory(
  categorySlug: string,
): Promise<ProductCardData[]> {
  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;

    if (!apiUrl) {
      throw new Error(
        "EXPO_PUBLIC_API_URL environment variable is not set. " +
          "Please create apps/mobile/.env file with: EXPO_PUBLIC_API_URL=http://localhost:3000",
      );
    }

    console.log(
      "Fetching products for category:",
      categorySlug,
      "from:",
      apiUrl,
    );
    // Use /api/listings endpoint which properly:
    // - Supports category slug filtering
    // - Returns ProductCardData format
    // - Includes seller rating info
    const response = await fetch(
      `${apiUrl}/api/listings?category=${categorySlug}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

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
          "Please create apps/mobile/.env file with: EXPO_PUBLIC_API_URL=http://localhost:3000",
      );
    }

    console.log("Fetching product:", id, "from:", apiUrl);
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

    const response = await fetch(
      `${apiUrl}/api/brands?query=${encodeURIComponent(query)}`,
      {
        headers: { Accept: "application/json" },
      },
    );

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
  token: string | null,
): Promise<{ id: string }> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("API URL not configured");

  // Generate a unique request ID for idempotency
  const requestId = `mobile-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const payload = {
    title: data.title,
    description: data.description,
    price: parseFloat(data.price),
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
  console.log("[Submit Listing] Payload:", JSON.stringify(payload, null, 2));

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
async function submitListing(data: SellFormData): Promise<{ id: string }> {
  return submitListingToApi(data, null);
}

// Function to pick images from gallery
async function pickImages(): Promise<ImageData[]> {
  try {
    // Request permissions if not on web
    if (Platform.OS !== "web") {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissions Required",
          "Please grant photo library permissions to add photos.",
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
        Alert.alert(
          "Permissions Required",
          "Please grant camera permissions to take photos.",
        );
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
  getToken: () => Promise<string | null>,
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

  console.log("📤 Uploading image to Cloudinary:", {
    uri: image.uri.substring(0, 50) + "...",
    isFirstImage,
    filename,
  });

  // Read the image file as blob
  const response = await fetch(image.uri);
  const blob = await response.blob();

  // Determine content type
  const contentType = blob.type || "image/jpeg";

  console.log("📦 Image blob:", {
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
          (errorData as { error?: unknown }).error ??
          (errorData as { message?: unknown }).message;

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
  console.log("✅ Upload success:", result.url);

  return result.url;
}

/**
 * Wrapper component for SellScreen that provides the image upload function
 * with access to Clerk authentication and gates behind seller onboarding.
 *
 * This wrapper uses SellerOnboardingGate which:
 * 1. Checks seller status on mount
 * 2. Shows SellerOnboardingScreen if user hasn't completed Stripe Connect setup
 * 3. Opens Stripe hosted onboarding flow via expo-web-browser
 * 4. Shows SellScreen once user is ready to sell
 */
function SellScreenWrapper({
  navigation,
}: {
  navigation: any;
}) {
  const { getToken } = useAuth();

  // Memoize handlers to prevent re-render issues during navigation
  const handleUploadImage = useCallback(async (image: ImageData, isFirstImage: boolean): Promise<string> => {
    return uploadImageToCloudinary(image, isFirstImage, getToken);
  }, [getToken]);

  const handleSubmitListing = useCallback(async (data: SellFormData): Promise<{ id: string }> => {
    const token = await getToken();
    if (!token) throw new Error("Not authenticated");
    return submitListingToApi(data, token);
  }, [getToken]);

  return (
    <SellerOnboardingGate
      navigation={navigation}
      onUploadImage={handleUploadImage}
      onPickImages={pickImages}
      onTakePhoto={takePhoto}
      onSubmitListing={handleSubmitListing}
      onFetchCategories={fetchCategories}
      onSearchBrands={searchBrands}
      onSearchModels={searchModels}
    />
  );
}

/**
 * Wrapper component for AccountScreen that provides Clerk user data
 * and sign-out functionality.
 */
function AccountScreenWrapper({
  navigation,
}: {
  navigation: any;
}) {
  const { user } = useUser();
  const { signOut } = useAuth();

  // Memoize handler to prevent re-render issues during navigation
  const handleSignOut = useCallback(async () => {
    await signOut();
    // After signOut, Clerk will automatically switch to SignedOut state
  }, [signOut]);

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
      onSignOut={handleSignOut}
      onNavigateBack={() => navigation.goBack()}
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

  const { favourites, toggleFavourite } = useMobileFavourites({
    apiUrl,
    getToken,
    isAuthenticated,
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

  // State for checkout and offer sheets
  const [checkoutSheetOpen, setCheckoutSheetOpen] = useState(false);
  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
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
  const fetchFavourites = useCallback(async () => {
    const token = await getToken();
    
    // Debug: Log token retrieval
    console.log("[FavouritesScreenWrapper] Token retrieval:", {
      hasToken: !!token,
      tokenLength: token?.length,
      tokenPrefix: token?.substring(0, 20),
      apiUrl,
    });
    
    if (!token) {
      console.log("[FavouritesScreenWrapper] No token, returning empty");
      return { products: [], pagination: { page: 1, limit: 24, total: 0, totalPages: 0 } };
    }

    const url = `${apiUrl}/api/favourites?page=1&limit=100`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
    
    console.log("[FavouritesScreenWrapper] Making request:", {
      url,
      hasAuthHeader: !!headers.Authorization,
      authHeaderLength: headers.Authorization?.length,
    });
    
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error("Failed to fetch favourites");
    }

    return response.json();
  }, [getToken, apiUrl]);

  const removeFavourite = useCallback(async (productId: string) => {
    const token = await getToken();
    if (!token) throw new Error("Not authenticated");

    const response = await fetch(`${apiUrl}/api/favourites/${productId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to remove favourite");
    }
  }, [getToken, apiUrl]);

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
          "Something went wrong while loading this product. Please try again.",
        );
      });
  }, []);

  // Handle Make Offer - fetch product and open offer sheet
  const handleMakeOffer = useCallback((productId: string) => {
    fetchProduct(productId)
      .then((product) => {
        if (product) {
          setSelectedProduct({
            id: product.id,
            title: product.title,
            price: product.price,
            sellerId: product.user?.id || "",
          });
          setOfferSheetOpen(true);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch product for Make Offer:", error);
        Alert.alert(
          "Unable to load product",
          "Something went wrong while loading this product. Please try again.",
        );
      });
  }, []);

  // Handle checkout success
  const handleCheckoutSuccess = useCallback((paymentIntentId: string) => {
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

  // Handle offer success
  const handleOfferSuccess = useCallback((offer: { id: string }) => {
    setOfferSheetOpen(false);
    setSelectedProduct(null);
    Alert.alert(
      "Offer Sent!",
      "Your offer has been sent to the seller. You'll be notified when they respond.",
      [
        {
          text: "View Offer",
          onPress: () => navigation.navigate("OfferDetail", { offerId: offer.id }),
        },
        { text: "OK" },
      ]
    );
  }, [navigation]);

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
      
      {/* Make Offer Sheet */}
      {selectedProduct && (
        <MakeOfferSheet
          open={offerSheetOpen}
          onOpenChange={setOfferSheetOpen}
          productId={selectedProduct.id}
          productTitle={selectedProduct.title}
          productPrice={selectedProduct.price}
          getToken={getTokenCallback}
          onSuccess={handleOfferSuccess}
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
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  // Memoize fetchConversations to prevent re-renders from triggering useEffect loops
  // and to avoid race conditions with screen transitions
  const fetchConversations = useCallback(async () => {
    const token = await getToken();

    console.log("[MessagesScreenWrapper] Token retrieval:", {
      hasToken: !!token,
      apiUrl,
    });

    if (!token) {
      console.log("[MessagesScreenWrapper] No token, returning empty");
      return { conversations: [] };
    }

    const url = `${apiUrl}/api/messages`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    console.log("[MessagesScreenWrapper] Making request:", { url });

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[MessagesScreenWrapper] API error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Failed to fetch conversations: ${response.status} - ${errorText}`);
    }

    return response.json();
  }, [getToken, apiUrl]);

  return (
    <MessagesScreen
      isAuthenticated={isAuthenticated}
      onFetchConversations={fetchConversations}
      onConversationPress={(conversation) =>
        navigation.navigate("MessageThread", {
          orderId: conversation.orderId,
          otherUserName: conversation.otherUserName,
          otherUserImage: conversation.otherUserImage,
          productTitle: conversation.productTitle,
          userRole: conversation.userRole,
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
 */
function MessageThreadScreenWrapper({
  navigation,
  orderId,
  otherUserName,
  otherUserImage,
  productTitle,
  userRole,
}: {
  navigation: any;
  orderId: string;
  otherUserName: string;
  otherUserImage: string | null;
  productTitle: string;
  userRole: "buyer" | "seller";
}) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  // Memoize all fetch functions to prevent re-render issues during navigation
  const fetchMessages = useCallback(async (id: string) => {
    const token = await getToken();

    console.log("[MessageThreadScreenWrapper] Fetching messages:", { id });

    if (!token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${apiUrl}/api/orders/${id}/messages`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch messages");
    }

    return response.json();
  }, [getToken, apiUrl]);

  const sendMessage = useCallback(async (id: string, content: string) => {
    const token = await getToken();

    if (!token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${apiUrl}/api/orders/${id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to send message");
    }

    const data = await response.json();
    return data.message;
  }, [getToken, apiUrl]);

  const markAsRead = useCallback(async (id: string) => {
    const token = await getToken();

    if (!token) {
      throw new Error("Not authenticated");
    }

    await fetch(`${apiUrl}/api/orders/${id}/messages/mark-read`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }, [getToken, apiUrl]);

  return (
    <MessageThreadScreen
      orderId={orderId}
      currentUserId={user?.id || ""}
      userRole={userRole}
      otherUserName={otherUserName}
      otherUserImage={otherUserImage}
      productTitle={productTitle}
      onFetchMessages={fetchMessages}
      onSendMessage={sendMessage}
      onMarkAsRead={markAsRead}
      onBack={() => navigation.goBack()}
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
  
  // State for checkout and offer sheets
  const [checkoutSheetOpen, setCheckoutSheetOpen] = useState(false);
  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
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

  const handleBuyNow = useCallback((id: string, price: number) => {
    // Fetch product details and open checkout sheet
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
          "Something went wrong while loading this product. Please try again.",
        );
      });
  }, []);

  const handleMakeOffer = useCallback((id: string, price: number) => {
    // Fetch product details and open offer sheet
    fetchProduct(id)
      .then((product) => {
        if (product) {
          setSelectedProduct({
            id: product.id,
            title: product.title,
            price: product.price,
            sellerId: product.user?.id || "",
          });
          setOfferSheetOpen(true);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch product for Make Offer:", error);
        Alert.alert(
          "Unable to load product",
          "Something went wrong while loading this product. Please try again.",
        );
      });
  }, []);

  const handleCheckoutSuccess = useCallback((paymentIntentId: string) => {
    setCheckoutSheetOpen(false);
    setSelectedProduct(null);
    // Navigate to order confirmation or messages
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

  const handleOfferSuccess = useCallback((offer: { id: string }) => {
    setOfferSheetOpen(false);
    setSelectedProduct(null);
    // Navigate to offer detail
    Alert.alert(
      "Offer Sent!",
      "Your offer has been sent to the seller. You'll be notified when they respond.",
      [
        {
          text: "View Offer",
          onPress: () => navigation.navigate("OfferDetail", { offerId: offer.id }),
        },
        { text: "OK" },
      ]
    );
  }, [navigation]);

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
      
      {/* Make Offer Sheet */}
      {selectedProduct && (
        <MakeOfferSheet
          open={offerSheetOpen}
          onOpenChange={setOfferSheetOpen}
          productId={selectedProduct.id}
          productTitle={selectedProduct.title}
          productPrice={selectedProduct.price}
          getToken={getTokenCallback}
          onSuccess={handleOfferSuccess}
        />
      )}
    </>
  );
}

/**
 * Wrapper component for OffersListScreen that provides data fetching.
 */
function OffersListScreenWrapper({
  navigation,
}: {
  navigation: any;
}) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  const fetchOffers = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Not authenticated");

    const response = await fetch(`${apiUrl}/api/offers`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch offers");
    }

    const data = await response.json();
    return data || [];
  }, [getToken, apiUrl]);

  return (
    <OffersListScreen
      currentUserId={user?.id || ""}
      onFetchOffers={fetchOffers}
      onViewOffer={(offerId) => navigation.navigate("OfferDetail", { offerId })}
      onBack={() => navigation.goBack()}
      onBrowseListings={() => navigation.navigate("Home")}
    />
  );
}

/**
 * Wrapper component for OfferDetailScreen that provides data fetching and actions.
 */
function OfferDetailScreenWrapper({
  navigation,
  offerId,
}: {
  navigation: any;
  offerId: string;
}) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  const fetchOffer = useCallback(async (id: string) => {
    const token = await getToken();
    if (!token) throw new Error("Not authenticated");

    const response = await fetch(`${apiUrl}/api/offers/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch offer");
    }

    return response.json();
  }, [getToken, apiUrl]);

  const getTokenCallback = useCallback(async () => {
    return getToken();
  }, [getToken]);

  return (
    <OfferDetailScreen
      offerId={offerId}
      currentUserId={user?.id || ""}
      getToken={getTokenCallback}
      onFetchOffer={fetchOffer}
      onBack={() => navigation.goBack()}
      onOfferAccepted={() => {
        // When buyer's offer is accepted, they may want to proceed to checkout
        navigation.navigate("Messages");
      }}
      onOfferUpdated={() => {
        // Refresh offers list when returning
      }}
      onViewProduct={(productId) => navigation.navigate("ProductDetail", { id: productId })}
    />
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

    const registerPushToken = async () => {
      try {
        const authToken = await getToken();
        if (!authToken) {
          console.log("[PushToken] No auth token, skipping registration");
          return;
        }

        // Register for push notifications
        const pushToken = await registerForPushNotificationsAsync(authToken);

        if (!pushToken || !mounted) {
          return;
        }

        // Register the push token with the backend
        await registerPushTokenWithBackend(pushToken, authToken, apiUrl);
      } catch (error) {
        console.error("[PushToken] Error registering push token:", error);
      }
    };

    registerPushToken();

    return () => {
      mounted = false;
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
 */
const DarkNavigationTheme: NavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: brandColors.spicedClementine,
    background: brandColors.burntOlive,
    card: brandColors.burntOliveLight,
    text: brandColors.pureWhite,
    border: brandColors.darkBorder,
    notification: brandColors.spicedClementine,
  },
};

export default function App() {
  const FORCE_MINIMAL = false; // back to normal app rendering

  // Official Tamagui/Expo pattern: use React Native's useColorScheme()
  // This follows system preference automatically (app.json has userInterfaceStyle: "automatic")
  const colorScheme = useColorScheme();
  
  // Validate colorScheme and default to 'light' if null/undefined
  const validColorScheme = colorScheme === 'dark' ? 'dark' : 'light';
  const navigationTheme = validColorScheme === 'dark' ? DarkNavigationTheme : LightNavigationTheme;

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
        console.log("[App] Notification received:", {
          title: notification.request.content.title,
        });
      },
      (response) => {
        // Handle notification tap - navigate to message thread
        const orderId = response.notification.request.content.data?.orderId;
        if (orderId) {
          console.log("[App] Navigating to message thread:", orderId);
          // Note: Navigation will be handled by deep linking
        }
      }
    );

    return unsubscribe;
  }, []);

  if (!fontsLoaded) return null;

  const tokenCache = {
    async getToken(key: string) {
      try {
        return await SecureStore.getItemAsync(key);
      } catch {
        return null;
      }
    },
    async saveToken(key: string, value: string) {
      try {
        await SecureStore.setItemAsync(key, value);
      } catch {
        // ignore
      }
    },
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
        <RNText style={{ fontSize: 20, marginBottom: 12 }}>
          Minimal RN screen
        </RNText>
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

  // Debug: Verify Clerk publishable key is loaded
  const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  
  console.log(
    "[Clerk] Publishable key:",
    clerkPublishableKey ? "LOADED" : "MISSING",
  );
  console.log(
    "[Stripe] Publishable key:",
    stripePublishableKey ? "LOADED" : "MISSING",
  );

  // CRITICAL: If keys are missing, show error screen instead of crashing
  // This prevents native module initialization with empty/invalid keys
  if (!clerkPublishableKey || !stripePublishableKey) {
    const missingKeys = [];
    if (!clerkPublishableKey) missingKeys.push("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
    if (!stripePublishableKey) missingKeys.push("EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY");
    
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
            <RNText key={key} style={{ fontSize: 14, fontFamily: "monospace", marginBottom: 4, color: "#ef4444" }}>
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
      <StripeProvider publishableKey={stripePublishableKey}>
        <ClerkProvider
          tokenCache={tokenCache}
          publishableKey={clerkPublishableKey}
        >
        {/* Official Tamagui Expo pattern: use useColorScheme() for theme */}
        <Provider defaultTheme={validColorScheme}>
          <SignedIn>
            <PushTokenRegistration />
            <NavigationContainer linking={linking} theme={navigationTheme}>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Home">
                  {({ navigation }: { navigation: any }) => (
                    <HomeScreenWrapper
                      navigation={navigation}
                      isAuthenticated={true}
                    />
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
                  {({ route, navigation }: { route: RouteParams<"ProductDetail">; navigation: any }) => (
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
                          slug
                            ? slug.charAt(0).toUpperCase() + slug.slice(1)
                            : "Category"
                        }
                        isAuthenticated={true}
                      />
                    );
                  }}
                </Stack.Screen>
                <Stack.Screen
                  name="Account"
                  options={{ headerShown: false }}
                >
                  {({ navigation }: { navigation: any }) => (
                    <AccountScreenWrapper navigation={navigation} />
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
                <Stack.Screen
                  name="Favourites"
                  options={{ headerShown: false }}
                >
                  {({ navigation }: { navigation: any }) => (
                    <FavouritesScreenWrapper
                      navigation={navigation}
                      isAuthenticated={true}
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen
                  name="Messages"
                  options={{ headerShown: false }}
                >
                  {({ navigation }: { navigation: any }) => (
                    <MessagesScreenWrapper
                      navigation={navigation}
                      isAuthenticated={true}
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen
                  name="MessageThread"
                  options={{ headerShown: false }}
                >
                  {({
                    route,
                    navigation,
                  }: {
                    route: {
                      params?: {
                        orderId?: string;
                        otherUserName?: string;
                        otherUserImage?: string | null;
                        productTitle?: string;
                        userRole?: "buyer" | "seller";
                      };
                    };
                    navigation: any;
                  }) => (
                    <MessageThreadScreenWrapper
                      navigation={navigation}
                      orderId={route.params?.orderId || ""}
                      otherUserName={route.params?.otherUserName || "User"}
                      otherUserImage={route.params?.otherUserImage ?? null}
                      productTitle={route.params?.productTitle || "Order"}
                      userRole={route.params?.userRole || "buyer"}
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen
                  name="Offers"
                  options={{ headerShown: false }}
                >
                  {({ navigation }: { navigation: any }) => (
                    <OffersListScreenWrapper navigation={navigation} />
                  )}
                </Stack.Screen>
                <Stack.Screen
                  name="OfferDetail"
                  options={{ headerShown: false }}
                >
                  {({
                    route,
                    navigation,
                  }: {
                    route: { params?: { offerId?: string } };
                    navigation: any;
                  }) => (
                    <OfferDetailScreenWrapper
                      navigation={navigation}
                      offerId={route.params?.offerId || ""}
                    />
                  )}
                </Stack.Screen>
              </Stack.Navigator>
            </NavigationContainer>
          </SignedIn>
          <SignedOut>
            {/* Render the designed onboarding screen (animations currently disabled for stability) */}
            <NavigationContainer linking={linking} theme={navigationTheme}>
              <OnboardingFlow />
            </NavigationContainer>
          </SignedOut>
        </Provider>
      </ClerkProvider>
      </StripeProvider>
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
              hideBuySellToggle={true}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="Category"
          options={({ route }: { route: RouteParams<"Category"> }) => {
            const slug = (route.params as { slug?: string })?.slug;
            return {
              title: slug
                ? slug.charAt(0).toUpperCase() + slug.slice(1)
                : "Category",
              headerShown: false,
            };
          }}
        >
          {({ route, navigation }) => {
            const slug = (route.params as { slug?: string })?.slug;
            return (
              <CategoryListScreen
                categorySlug={slug || ""}
                categoryName={
                  slug
                    ? slug.charAt(0).toUpperCase() + slug.slice(1)
                    : "Category"
                }
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
