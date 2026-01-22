import React, { useState, useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { TabNavigator } from "./TabNavigator";
import { HomeScreen } from "@buttergolf/app/src/features/home";
import { FavouritesScreen, MessagesScreen } from "@buttergolf/app";
import type { ProductCardData, Product } from "@buttergolf/app";
import { MobileCheckoutSheet, MakeOfferSheet } from "./index";

interface MainTabsProps {
  /** Navigation object from React Navigation */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigation: any;
  /** Initial tab key to show */
  initialTab?: "home" | "favourites" | "messages";
}

// Function to fetch products from API
async function fetchProducts(): Promise<ProductCardData[]> {
  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;

    if (!apiUrl) {
      throw new Error("EXPO_PUBLIC_API_URL environment variable is not set.");
    }

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

// Function to fetch a single product by ID
async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;

    if (!apiUrl) {
      throw new Error("EXPO_PUBLIC_API_URL environment variable is not set.");
    }

    const response = await fetch(`${apiUrl}/api/products/${id}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch product:", error);
    return null;
  }
}

/**
 * MainTabs component that wraps TabNavigator with screen content.
 * This replaces individual stack screens for Home, Favourites, and Messages
 * with a single swipeable tab view.
 */
export function MainTabs({ navigation, initialTab = "home" }: MainTabsProps) {
  const { getToken } = useAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  // State for checkout and offer sheets (shared across tabs)
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

  // Convert initialTab to index
  const initialIndex = useMemo(() => {
    switch (initialTab) {
      case "home":
        return 0;
      case "favourites":
        return 1;
      case "messages":
        return 2;
      default:
        return 0;
    }
  }, [initialTab]);

  // ============== Favourites Screen Data ==============
  const fetchFavourites = useCallback(async () => {
    const token = await getToken();

    if (!token) {
      return { products: [], pagination: { page: 1, limit: 24, total: 0, totalPages: 0 } };
    }

    const response = await fetch(`${apiUrl}/api/favourites?page=1&limit=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

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

  // ============== Messages Screen Data ==============
  const fetchConversations = useCallback(async () => {
    const token = await getToken();

    if (!token) {
      return { conversations: [] };
    }

    const response = await fetch(`${apiUrl}/api/messages`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch conversations");
    }

    return response.json();
  }, [getToken, apiUrl]);

  // ============== Shared Buy/Offer Handlers ==============
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
        Alert.alert("Unable to load product", "Please try again.");
      });
  }, []);

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
        Alert.alert("Unable to load product", "Please try again.");
      });
  }, []);

  const handleCheckoutSuccess = useCallback(() => {
    setCheckoutSheetOpen(false);
    setSelectedProduct(null);
    Alert.alert(
      "Payment Successful!",
      "Your order has been placed.",
      [{ text: "OK" }]
    );
  }, []);

  const handleOfferSuccess = useCallback((offer: { id: string }) => {
    setOfferSheetOpen(false);
    setSelectedProduct(null);
    Alert.alert(
      "Offer Sent!",
      "You'll be notified when the seller responds.",
      [
        {
          text: "View Offer",
          onPress: () => navigation.navigate("OfferDetail", { offerId: offer.id }),
        },
        { text: "OK" },
      ]
    );
  }, [navigation]);

  // ============== Render Functions for Tabs ==============
  const renderHome = useCallback(() => (
    <HomeScreen
      onFetchProducts={fetchProducts}
      onSellPress={() => navigation.navigate("Sell")}
      isAuthenticated={true}
      onAccountPress={() => navigation.navigate("Account")}
      onWishlistPress={() => {}} // Handled by TabNavigator swipe
      onMessagesPress={() => {}} // Handled by TabNavigator swipe
      onCategoryPress={(slug) => navigation.navigate("Category", { slug })}
      hideBuySellToggle={true}
      hideBottomNav={true} // Hide individual bottom nav - TabNavigator provides it
    />
  ), [navigation]);

  const renderFavourites = useCallback(() => (
    <FavouritesScreen
      isAuthenticated={true}
      onFetchFavourites={fetchFavourites}
      onRemoveFavourite={removeFavourite}
      onBack={() => {}} // No back in tabs - user swipes
      onViewProduct={(id) => navigation.navigate("ProductDetail", { id })}
      onBuyNow={handleBuyNow}
      onMakeOffer={handleMakeOffer}
      onBrowseListings={() => {}} // User swipes to Home
      onHomePress={() => {}} // Handled by TabNavigator
      onSellPress={() => navigation.navigate("Sell")}
      onMessagesPress={() => {}} // Handled by TabNavigator swipe
      onAccountPress={() => navigation.navigate("Account")}
      hideBottomNav={true} // Hide individual bottom nav - TabNavigator provides it
    />
  ), [navigation, fetchFavourites, removeFavourite, handleBuyNow, handleMakeOffer]);

  const renderMessages = useCallback(() => (
    <MessagesScreen
      isAuthenticated={true}
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
      onBrowseListings={() => {}} // User swipes to Home
      onHomePress={() => {}} // Handled by TabNavigator
      onWishlistPress={() => {}} // Handled by TabNavigator swipe
      onSellPress={() => navigation.navigate("Sell")}
      onMessagesPress={() => {}} // Already on messages
      onAccountPress={() => navigation.navigate("Account")}
      hideBottomNav={true} // Hide individual bottom nav - TabNavigator provides it
    />
  ), [navigation, fetchConversations]);

  return (
    <>
      <TabNavigator
        renderHome={renderHome}
        renderFavourites={renderFavourites}
        renderMessages={renderMessages}
        onSellPress={() => navigation.navigate("Sell")}
        onAccountPress={() => navigation.navigate("Account")}
        isAuthenticated={true}
        initialIndex={initialIndex}
        onTabChange={() => {
          // Analytics or state tracking if needed
        }}
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

export default MainTabs;
