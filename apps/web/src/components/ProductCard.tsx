"use client";

import { ProductCard as SharedProductCard } from "@buttergolf/app";
import type { ProductCardData } from "@buttergolf/app";
import { useFavouriteToggle } from "@/hooks/useFavouriteToggle";
import { useLinkPress } from "@/hooks/useLinkPress";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Card, Text, View } from "@buttergolf/ui";

export interface ProductCardProps {
  readonly product: ProductCardData;
}

/**
 * Web ProductCard: the shared card rendered as a real link to the product
 * page, with favourites persisted through useFavouriteToggle.
 */
export function ProductCard({ product }: ProductCardProps) {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const linkPress = useLinkPress();
  const { isFavourited, toggleFavourite } = useFavouriteToggle(product.id);
  const [showAuthMessage, setShowAuthMessage] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const href = `/products/${product.id}`;

  // Never let a pending sign-in redirect fire after the card has gone away.
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const handleFavourite = async () => {
    // Require authentication
    if (!isSignedIn) {
      setShowAuthMessage(true);
      // Redirect to sign-in after 1 second (one timer at a time)
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = setTimeout(() => {
        redirectTimerRef.current = null;
        router.push(`/sign-in?redirect_url=${encodeURIComponent(globalThis.location.pathname)}`);
      }, 1000);
      return;
    }

    // Toggle favourite with optimistic update
    const result = await toggleFavourite();

    if (result && !result.success && result.error) {
      console.error("Failed to toggle favourite:", result.error);
    }
  };

  return (
    <>
      <SharedProductCard
        product={product}
        href={href}
        onPress={linkPress(href)}
        onFavourite={handleFavourite}
        isFavourited={isFavourited}
      />
      {showAuthMessage && (
        <View
          style={{
            position: "fixed",
            bottom: 24,
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
        </View>
      )}
    </>
  );
}
