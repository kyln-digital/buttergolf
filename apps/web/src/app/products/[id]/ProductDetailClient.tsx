"use client";

import { useState, useEffect, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import { ChevronLeft, ChevronRight, X } from "@tamagui/lucide-icons";
import { Column, Row, Text, Button, Card, Image, View } from "@buttergolf/ui";
import { PRODUCT_IMAGE_ASPECT_RATIO } from "@buttergolf/constants";
import { SECTION_MAX_WIDTH } from "@/app/_components/marketplace/Section";
import { ProductInformation } from "./_components/ProductInformation";
import { BuyNowSheet } from "./_components/BuyNowSheet";

interface ProductImage {
  id: string;
  url: string;
  sortOrder: number;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  averageRating?: number | null;
  ratingCount?: number;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  brand: string | null;
  model: string | null;
  isSold: boolean;
  views: number;
  createdAt: string;
  images: ProductImage[];
  category: Category;
  user: User;
  /** Driver / Fairway Wood / Hybrid — set for listings in the Woods category. */
  woodsSubcategory: string | null;
  flex: string | null;
  loft: string | null;
  headCoverIncluded: boolean | null;
  /** Component condition ratings, 1 (Poor) to 10 (Like New). */
  gripCondition: number | null;
  headCondition: number | null;
  shaftCondition: number | null;
}

interface ProductDetailClientProps {
  product: Product;
}

const THUMB_SIZE = 64;

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showMobileBar, setShowMobileBar] = useState(false);
  const [buyNowSheetOpen, setBuyNowSheetOpen] = useState(false);
  const router = useRouter();

  const selectedImage = product.images[selectedImageIndex];
  const imageCount = product.images.length;

  // Handle scroll for mobile bar
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 400;
      setShowMobileBar(scrolled);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleBuyNow = () => {
    if (product.isSold) return;
    setBuyNowSheetOpen(true);
  };

  const handleSubmitOffer = async (offerAmount: number) => {
    try {
      // Create or get conversation for this product
      const convResponse = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });

      if (!convResponse.ok) {
        const error = await convResponse.json();
        throw new Error(error.error || "Failed to start conversation");
      }

      const { conversationId } = await convResponse.json();

      // Submit the offer through the conversation
      const offerResponse = await fetch(`/api/conversations/${conversationId}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: offerAmount }),
      });

      if (!offerResponse.ok) {
        const error = await offerResponse.json();
        throw new Error(error.error || "Failed to submit offer");
      }

      // Redirect to conversation
      router.push(`/messages/${conversationId}`);
    } catch (error) {
      console.error("Error submitting offer:", error);
      throw error;
    }
  };

  const showPrevious = useCallback(
    () => setSelectedImageIndex((prev) => Math.max(0, prev - 1)),
    []
  );
  const showNext = useCallback(
    () => setSelectedImageIndex((prev) => Math.min(imageCount - 1, prev + 1)),
    [imageCount]
  );

  const handleKeyboardNav = useCallback(
    (e: KeyboardEvent) => {
      if (!lightboxOpen) return;

      if (e.key === "ArrowLeft") {
        showPrevious();
      } else if (e.key === "ArrowRight") {
        showNext();
      } else if (e.key === "Escape") {
        setLightboxOpen(false);
      }
    },
    [lightboxOpen, showPrevious, showNext]
  );

  useEffect(() => {
    globalThis.addEventListener?.("keydown", handleKeyboardNav);
    return () => globalThis.removeEventListener?.("keydown", handleKeyboardNav);
  }, [handleKeyboardNav]);

  return (
    <>
      <Column
        width="100%"
        maxWidth={SECTION_MAX_WIDTH}
        marginHorizontal="auto"
        paddingHorizontal="$md"
        paddingTop="$md"
        paddingBottom="$2xl"
        gap="$lg"
        $gtMd={{ paddingHorizontal: "$xl", paddingTop: "$lg", paddingBottom: "$3xl" }}
      >
        {/* Breadcrumb */}
        <Row tag="nav" aria-label="Breadcrumb" gap="$xs" alignItems="center" flexWrap="wrap">
          <Link href="/listings">
            <Text size="$3" color="$textSecondary" hoverStyle={{ color: "$text" }}>
              Shop all
            </Text>
          </Link>
          <ChevronRight size={14} color="$textSecondary" />
          <Link href={`/category/${product.category.slug}`}>
            <Text size="$3" color="$textSecondary" hoverStyle={{ color: "$text" }}>
              {product.category.name}
            </Text>
          </Link>
          <ChevronRight size={14} color="$textSecondary" />
          <Text size="$3" color="$text" fontWeight="600" numberOfLines={1} aria-current="page">
            {product.title}
          </Text>
        </Row>

        {/* Gallery + information */}
        <Row
          gap="$xl"
          flexDirection="column"
          alignItems="stretch"
          width="100%"
          $gtMd={{ flexDirection: "row", alignItems: "flex-start", gap: "$2xl" }}
        >
          {/* Gallery */}
          <Column gap="$sm" flex={1} minWidth={0} width="100%" $gtMd={{ width: "auto" }}>
            {/* A real button so Enter / Space open the lightbox */}
            <Card
              tag="button"
              {...{ type: "button" }}
              variant="outlined"
              interactive
              padding={0}
              overflow="hidden"
              backgroundColor="$surface"
              borderRadius="$lg"
              position="relative"
              width="100%"
              aspectRatio={PRODUCT_IMAGE_ASPECT_RATIO}
              onPress={() => setLightboxOpen(true)}
              aria-label="Open image gallery"
              focusable
              focusVisibleStyle={{
                outlineColor: "$primary",
                outlineStyle: "solid",
                outlineWidth: 2,
                outlineOffset: 2,
              }}
            >
              <Image
                source={{ uri: selectedImage.url }}
                width="100%"
                height="100%"
                objectFit="contain"
                backgroundColor="$surface"
                alt={product.title}
              />

              {imageCount > 1 && (
                <Row
                  position="absolute"
                  bottom="$md"
                  right="$md"
                  backgroundColor="$overlayDark50"
                  paddingVertical="$xs"
                  paddingHorizontal="$sm"
                  borderRadius="$full"
                  zIndex={10}
                  pointerEvents="none"
                >
                  <Text size="$3" fontWeight="600" color="$textInverse">
                    {selectedImageIndex + 1} / {imageCount}
                  </Text>
                </Row>
              )}
            </Card>

            {imageCount > 1 && (
              <Row gap="$sm" flexWrap="wrap" role="tablist" aria-label="Product images">
                {product.images.map((img, index) => {
                  const isSelected = index === selectedImageIndex;
                  return (
                    <Card
                      key={img.id}
                      tag="button"
                      {...{ type: "button" }}
                      variant="outlined"
                      interactive
                      padding={0}
                      role="tab"
                      aria-selected={isSelected}
                      aria-label={`Image ${index + 1} of ${imageCount}`}
                      onPress={() => setSelectedImageIndex(index)}
                      borderColor={isSelected ? "$primary" : "$border"}
                      borderWidth={isSelected ? 2 : 1}
                      hoverStyle={{ borderColor: isSelected ? "$primary" : "$borderHover" }}
                      backgroundColor="$surface"
                      width={THUMB_SIZE}
                      height={THUMB_SIZE}
                      overflow="hidden"
                      borderRadius="$md"
                      focusable
                      focusVisibleStyle={{
                        outlineColor: "$primary",
                        outlineStyle: "solid",
                        outlineWidth: 2,
                        outlineOffset: 2,
                      }}
                    >
                      <Image
                        source={{ uri: img.url }}
                        width="100%"
                        height="100%"
                        objectFit="cover"
                        alt=""
                      />
                    </Card>
                  );
                })}
              </Row>
            )}
          </Column>

          {/* Information */}
          <ProductInformation
            product={product}
            onBuyNow={handleBuyNow}
            onSubmitOffer={handleSubmitOffer}
          />
        </Row>
      </Column>

      {/* Lightbox */}
      {lightboxOpen && (
        <Column
          role="dialog"
          aria-modal
          aria-label="Image gallery"
          style={{ position: "fixed" } as CSSProperties}
          top={0}
          left={0}
          right={0}
          bottom={0}
          backgroundColor="$overlayDark50"
          zIndex={9999}
          alignItems="center"
          justifyContent="center"
          padding="$lg"
        >
          {/* Click-away backdrop: not a control (the Close button is), so it
              takes no focus and has no name. */}
          <View
            aria-hidden
            position="absolute"
            inset={0}
            cursor="default"
            onPress={() => setLightboxOpen(false)}
          />

          <Button
            butterVariant="secondary"
            circular
            size="$5"
            aria-label="Close"
            onPress={() => setLightboxOpen(false)}
            position="absolute"
            top="$lg"
            right="$lg"
            zIndex={10000}
          >
            <X size={20} color="$text" />
          </Button>

          {selectedImageIndex > 0 && (
            <Button
              butterVariant="secondary"
              circular
              size="$5"
              aria-label="Previous image"
              onPress={showPrevious}
              position="absolute"
              left="$lg"
              zIndex={10000}
            >
              <ChevronLeft size={22} color="$text" />
            </Button>
          )}

          {selectedImageIndex < imageCount - 1 && (
            <Button
              butterVariant="secondary"
              circular
              size="$5"
              aria-label="Next image"
              onPress={showNext}
              position="absolute"
              right="$lg"
              zIndex={10000}
            >
              <ChevronRight size={22} color="$text" />
            </Button>
          )}

          <NextImage
            src={selectedImage.url}
            alt={product.title}
            width={1600}
            height={1200}
            sizes="90vw"
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              position: "relative",
              zIndex: 1,
            }}
            priority
          />

          {imageCount > 1 && (
            <Row
              position="absolute"
              bottom="$xl"
              left="50%"
              transform="translateX(-50%)"
              backgroundColor="$background"
              paddingVertical="$xs"
              paddingHorizontal="$md"
              borderRadius="$full"
              zIndex={1}
            >
              <Text size="$4" fontWeight="600" color="$text">
                {selectedImageIndex + 1} / {imageCount}
              </Text>
            </Row>
          )}
        </Column>
      )}

      {/* Mobile sticky buy bar */}
      {showMobileBar && (
        <Row
          className="mobile-sticky-bar"
          style={{ position: "fixed" } as CSSProperties}
          bottom={0}
          left={0}
          right={0}
          backgroundColor="$background"
          borderTopWidth={1}
          borderTopColor="$border"
          paddingHorizontal="$md"
          paddingVertical="$sm"
          zIndex={1000}
          display="none"
          alignItems="center"
          justifyContent="space-between"
          gap="$md"
        >
          <Column flex={1} minWidth={0}>
            <Text size="$3" color="$textSecondary" numberOfLines={1}>
              {product.title}
            </Text>
            <Text size="$6" fontWeight="700" color="$text">
              £{product.price.toFixed(2)}
            </Text>
          </Column>
          <Button
            butterVariant="primary"
            size="$4.5"
            onPress={handleBuyNow}
            disabled={product.isSold}
          >
            {product.isSold ? "Sold out" : "Buy now"}
          </Button>
        </Row>
      )}

      {/* Responsive CSS: the buy bar only exists below the desktop breakpoint */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media (max-width: 1020px) {
            .mobile-sticky-bar {
              display: flex !important;
            }
          }
        `,
        }}
      />

      <BuyNowSheet product={product} isOpen={buyNowSheetOpen} onOpenChange={setBuyNowSheetOpen} />
    </>
  );
}
