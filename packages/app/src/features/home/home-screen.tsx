"use client";

import React, { useEffect, useState } from "react";
import {
  Column,
  Row,
  ScrollView,
  Text,
  Image,
  BuySellToggle,
  type BuySellMode,
} from "@buttergolf/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProductCardData } from "../../types/product";
import { Hero } from "../../components/Hero";
import { images } from "@buttergolf/assets";
import { MobileSearchBar, MobileBottomNav } from "../../components/mobile";

interface HomeScreenProps {
  products?: ProductCardData[];
  onFetchProducts?: () => Promise<ProductCardData[]>;
  onSellPress?: () => void;
  onLoginPress?: () => void;
  onAccountPress?: () => void;
  onWishlistPress?: () => void;
  onMessagesPress?: () => void;
  /** Callback when a category is pressed */
  onCategoryPress?: (slug: string) => void;
  isAuthenticated?: boolean;
  /** Hide the buying/selling toggle (mobile uses bottom nav for selling) */
  hideBuySellToggle?: boolean;
}

export function HomeScreen({
  products: initialProducts = [],
  onFetchProducts,
  onSellPress,
  onLoginPress,
  onAccountPress,
  onWishlistPress,
  onMessagesPress,
  onCategoryPress,
  isAuthenticated = false,
  hideBuySellToggle = false,
}: Readonly<HomeScreenProps>) {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<ProductCardData[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [buySellMode, setBuySellMode] = useState<BuySellMode>("buying");

  // Category press handlers - use callback prop
  const handleWoodsPress = () => onCategoryPress?.("woods");
  const handleIronsPress = () => onCategoryPress?.("irons");
  const handleWedgesPress = () => onCategoryPress?.("wedges");
  const handlePuttersPress = () => onCategoryPress?.("putters");

  useEffect(() => {
    if (onFetchProducts && products.length === 0 && !loading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
      onFetchProducts()
        .then((fetchedProducts) => {
          console.info(`Fetched ${fetchedProducts.length} products`);
          if (fetchedProducts.length > 0) {
            console.info("First product image URL:", fetchedProducts[0]?.imageUrl);
          }
          setProducts(fetchedProducts);
        })
        .catch((error) => {
          console.error("Failed to fetch products:", error);
        })
        .finally(() => setLoading(false));
    }
  }, [onFetchProducts, products.length, loading]);

  return (
    <Column flex={1} backgroundColor="$background">
      {/* Sticky Search Bar - Fixed at top, extends into safe area */}
      <Column position="absolute" top={0} left={0} right={0} zIndex={100}>
        <Column
          backgroundColor="$chromeBackground"
          borderBottomLeftRadius="$2xl"
          borderBottomRightRadius="$2xl"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 12,
          }}
        >
          <MobileSearchBar
            placeholder="What are you looking for?"
            onSearch={(query: string) => console.info("Search query:", query)}
          />
        </Column>
      </Column>

      {/* Scrollable Content */}
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 80, // Account for sticky search bar height
          paddingBottom: insets.bottom + 80, // Account for bottom nav
        }}
      >
        {/* Hero Section - Scrolls under the search bar */}
        <Hero
          heading={{
            line1: "Butter",
            line2: "up your",
            line3: "game",
          }}
          backgroundImage={images.hero.background}
          heroImage={images.hero.club}
          showHeroImage={true}
          minHeight={240}
          maxHeight={300}
        />

        {/* Buying/Selling Toggle Buttons - Hidden on mobile where selling is via bottom nav */}
        {!hideBuySellToggle && (
          <Row paddingHorizontal="$4" paddingVertical="$4">
            <BuySellToggle activeMode={buySellMode} onModeChange={setBuySellMode} />
          </Row>
        )}

        {/* Shop by Category Section */}
        <Column paddingHorizontal="$4" paddingTop="$4" paddingBottom="$6" gap="$3">
          <Text size="$8" fontWeight="700" color="$text" textAlign="center">
            Shop by category
          </Text>
          <Text size="$5" fontWeight="400" color="$textSecondary" textAlign="center">
            Find exactly what you need - faster.
          </Text>
        </Column>

        {/* Category Cards Grid */}
        <Column paddingHorizontal="$4" gap="$4">
          {/* First row: Woods & Irons */}
          <Row gap="$4">
            {/* Woods card */}
            <Column
              flex={1}
              height={180}
              backgroundColor="$vanillaCream"
              borderRadius="$2xl"
              overflow="hidden"
              pressStyle={{ opacity: 0.9, scale: 0.98 }}
              onPress={handleWoodsPress}
              role="button"
              aria-label="Browse woods category"
            >
              <Image
                src={images.clubs.club1}
                width="100%"
                height="100%"
                objectFit="cover"
                position="absolute"
                alt="Woods category"
              />
              <Column
                flex={1}
                padding="$4"
                justifyContent="flex-end"
                backgroundColor="rgba(0, 0, 0, 0.3)"
              >
                <Text size="$8" fontWeight="700" color="$vanillaCream">
                  Woods
                </Text>
              </Column>
            </Column>

            {/* Irons card */}
            <Column
              flex={1}
              height={180}
              backgroundColor="$secondary"
              borderRadius="$2xl"
              overflow="hidden"
              pressStyle={{ opacity: 0.9, scale: 0.98 }}
              onPress={handleIronsPress}
              role="button"
              aria-label="Browse irons category"
            >
              <Image
                src={images.clubs.club3}
                width="100%"
                height="100%"
                objectFit="cover"
                position="absolute"
                alt="Irons category"
              />
              <Column
                flex={1}
                padding="$4"
                justifyContent="flex-end"
                backgroundColor="rgba(0, 0, 0, 0.3)"
              >
                <Text size="$8" fontWeight="700" color="$vanillaCream">
                  Irons
                </Text>
              </Column>
            </Column>
          </Row>

          {/* Second row: Wedges & Putters */}
          <Row gap="$4">
            {/* Wedges card */}
            <Column
              flex={1}
              height={180}
              backgroundColor="$vanillaCream"
              borderRadius="$2xl"
              overflow="hidden"
              pressStyle={{ opacity: 0.9, scale: 0.98 }}
              onPress={handleWedgesPress}
              role="button"
              aria-label="Browse wedges category"
            >
              <Image
                src={images.clubs.club4}
                width="100%"
                height="100%"
                objectFit="cover"
                position="absolute"
                alt="Wedges category"
              />
              <Column
                flex={1}
                padding="$4"
                justifyContent="flex-end"
                backgroundColor="rgba(0, 0, 0, 0.3)"
              >
                <Text size="$8" fontWeight="700" color="$vanillaCream">
                  Wedges
                </Text>
              </Column>
            </Column>

            {/* Putters card */}
            <Column
              flex={1}
              height={180}
              backgroundColor="$secondary"
              borderRadius="$2xl"
              overflow="hidden"
              pressStyle={{ opacity: 0.9, scale: 0.98 }}
              onPress={handlePuttersPress}
              role="button"
              aria-label="Browse putters category"
            >
              <Image
                src={images.clubs.club5}
                width="100%"
                height="100%"
                objectFit="cover"
                position="absolute"
                alt="Putters category"
              />
              <Column
                flex={1}
                padding="$4"
                justifyContent="flex-end"
                backgroundColor="rgba(0, 0, 0, 0.3)"
              >
                <Text size="$8" fontWeight="700" color="$vanillaCream">
                  Putters
                </Text>
              </Column>
            </Column>
          </Row>
        </Column>
      </ScrollView>

      {/* Bottom Navigation - Fixed at bottom, extends into safe area */}
      <Column position="absolute" bottom={0} left={0} right={0} zIndex={100}>
        <MobileBottomNav
          activeTab="home"
          isAuthenticated={isAuthenticated}
          onHomePress={() => {}}
          onWishlistPress={onWishlistPress}
          onSellPress={onSellPress}
          onMessagesPress={onMessagesPress}
          onLoginPress={onLoginPress}
          onAccountPress={onAccountPress}
        />
      </Column>
    </Column>
  );
}
