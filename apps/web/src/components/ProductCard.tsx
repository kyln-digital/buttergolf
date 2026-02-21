"use client";

import { ProductCard as SharedProductCard } from "@buttergolf/app";
import type { ProductCardData } from "@buttergolf/app";
import { useFavouriteToggle } from "@/hooks/useFavouriteToggle";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, Text } from "@buttergolf/ui";

export interface ProductCardProps {
  readonly product: ProductCardData;
  readonly onPress?: () => void;
  readonly showHoverActions?: boolean;
}

/**
 * Web-specific ProductCard wrapper that adds favourite functionality
 * Uses useFavouriteToggle hook to persist favourites to database
 */
export function ProductCard({ product, onPress, showHoverActions = true }: ProductCardProps) {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const { isFavourited, toggleFavourite } = useFavouriteToggle(product.id);
  const [showAuthMessage, setShowAuthMessage] = useState(false);

  const handleFavourite = async () => {
    // Require authentication
    if (!isSignedIn) {
      setShowAuthMessage(true);
      // Redirect to sign-in after 1 second
      setTimeout(() => {
        router.push(`/sign-in?redirect_url=${encodeURIComponent(globalThis.location.pathname)}`);
      }, 1000);
      return;
    }

    // Toggle favourite with optimistic update
    const result = await toggleFavourite();

    if (result && !result.success && result.error) {
      // Show error toast (could be enhanced with a toast library)
      console.error("Failed to toggle favourite:", result.error);
    }
  };

  const handleQuickView = (productId: string) => {
    // Navigate to product page
    router.push(`/products/${productId}`);
  };

  return (
    <>
      <SharedProductCard
        product={product}
        onPress={onPress}
        onFavourite={handleFavourite}
        isFavourited={isFavourited}
        onQuickView={showHoverActions ? handleQuickView : undefined}
      />
      {showAuthMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
          }}
        >
          <Card variant="elevated" padding="$md" backgroundColor="$secondary" borderRadius="$md">
            <Text size="$4" color="$textInverse" fontWeight="500">
              Please sign in to add favourites
            </Text>
          </Card>
        </div>
      )}
    </>
  );
}
