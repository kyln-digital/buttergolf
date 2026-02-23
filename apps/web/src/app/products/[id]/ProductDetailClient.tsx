"use client";

import { useState, useEffect, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import { Column, Row, Container, Text, Button, Card, Image } from "@buttergolf/ui";
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
}

interface ProductDetailClientProps {
  product: Product;
}

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showMobileBar, setShowMobileBar] = useState(false);
  const [buyNowSheetOpen, setBuyNowSheetOpen] = useState(false);
  const router = useRouter();

  const selectedImage = product.images[selectedImageIndex];

  // Handle scroll for mobile bar
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 400;
      setShowMobileBar(scrolled);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleBuyNow = () => {
    if (product.isSold) return;
    setBuyNowSheetOpen(true);
  };

  const handleSubmitOffer = async (offerAmount: number) => {
    try {
      const response = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          amount: offerAmount,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Offer submission failed:", response.status, error);
        throw new Error(error.error || "Failed to submit offer");
      }

      const result = await response.json();
      console.log("Offer submitted successfully:", result);

      // Redirect to offer detail page
      router.push(`/offers/${result.id}`);
    } catch (error) {
      console.error("Error submitting offer:", error);
      throw error;
    }
  };

  const handleKeyboardNav = useCallback(
    (e: KeyboardEvent) => {
      if (!lightboxOpen) return;

      if (e.key === "ArrowLeft" && selectedImageIndex > 0) {
        setSelectedImageIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight" && selectedImageIndex < product.images.length - 1) {
        setSelectedImageIndex((prev) => Math.min(product.images.length - 1, prev + 1));
      } else if (e.key === "Escape") {
        setLightboxOpen(false);
      }
    },
    [lightboxOpen, product.images.length, selectedImageIndex]
  );

  useEffect(() => {
    globalThis.addEventListener?.("keydown", handleKeyboardNav);
    return () => globalThis.removeEventListener?.("keydown", handleKeyboardNav);
  }, [handleKeyboardNav]);

  return (
    <>
      <Container size="xl" padding="$md" backgroundColor="$background">
        <Column gap="$lg" paddingVertical="$lg">
          {/* Breadcrumb */}
          <Row gap="$sm" alignItems="center" flexWrap="wrap">
            <Link href="/" style={{ textDecoration: "none" }}>
              <Text size="$3" color="$textSecondary" hoverStyle={{ color: "$primary" }}>
                Listings
              </Text>
            </Link>
            <Text size="$3" color="$textSecondary">
              &gt;
            </Text>
            <Link href={`/category/${product.category.slug}`} style={{ textDecoration: "none" }}>
              <Text size="$3" color="$textSecondary" hoverStyle={{ color: "$primary" }}>
                {product.category.name}
              </Text>
            </Link>
            <Text size="$3" color="$textSecondary">
              &gt;
            </Text>
            <Text size="$3" color="$text" fontWeight="bold">
              {product.title}
            </Text>
          </Row>

          {/* Main Content Grid */}
          <Row
            gap="$xl"
            flexDirection="column"
            $gtMd={{ flexDirection: "row", alignItems: "flex-start" }}
            alignItems="stretch"
            width="100%"
          >
            {/* Left Column - Image Gallery */}
            <Column
              gap="$lg"
              flex={1}
              minWidth={0}
              width="100%"
              $gtMd={{
                width: "auto",
                maxWidth: "calc(100% - 420px - 32px)",
              }}
            >
              {/* Gallery: Main Image + Thumbnails */}
              <Column gap="$sm">
                {/* Main Image */}
                <Card
                  variant="outlined"
                  padding="$0"
                  overflow="hidden"
                  backgroundColor="$surface"
                  borderRadius="$xl"
                  cursor="pointer"
                  onPress={() => setLightboxOpen(true)}
                  position="relative"
                  width="100%"
                  height={400}
                  $gtSm={{ height: 500 }}
                  $gtMd={{ height: 650 }}
                >
                  <Image
                    source={{ uri: selectedImage.url }}
                    width="100%"
                    height="100%"
                    objectFit="contain"
                    alt={product.title}
                  />

                  {/* Image Counter */}
                  {product.images.length > 1 && (
                    <Row
                      position="absolute"
                      bottom={16}
                      right={16}
                      backgroundColor="$overlayDark50"
                      paddingVertical="$xs"
                      paddingHorizontal="$md"
                      borderRadius="$full"
                      zIndex={10}
                    >
                      <Text size="$4" fontWeight="500" color="$textInverse">
                        {selectedImageIndex + 1} / {product.images.length}
                      </Text>
                    </Row>
                  )}
                </Card>

                {/* Thumbnail Gallery - Horizontal strip below main image */}
                {product.images.length > 1 && (
                  <Row gap="$sm" flexWrap="wrap">
                    {product.images.map((img, index) => (
                      <Card
                        key={img.id}
                        variant="outlined"
                        padding="$0"
                        cursor="pointer"
                        onPress={() => setSelectedImageIndex(index)}
                        borderColor={index === selectedImageIndex ? "$primary" : "$border"}
                        borderWidth={index === selectedImageIndex ? 3 : 1}
                        backgroundColor="$surface"
                        hoverStyle={{
                          borderColor: "$primary",
                          transform: "scale(1.05)",
                        }}
                        animation="quick"
                        width={56}
                        height={56}
                        $gtSm={{ width: 64, height: 64 }}
                        overflow="hidden"
                        borderRadius="$lg"
                        position="relative"
                      >
                        <Image
                          source={{ uri: img.url }}
                          width="100%"
                          height="100%"
                          objectFit="cover"
                          alt={`${product.title} - Image ${index + 1}`}
                        />
                      </Card>
                    ))}
                  </Row>
                )}
              </Column>
            </Column>

            {/* Right Column - Product Information */}
            <ProductInformation
              product={product}
              onBuyNow={handleBuyNow}
              onSubmitOffer={handleSubmitOffer}
            />
          </Row>
        </Column>
      </Container>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <Column
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
          <Button
            chromeless
            aria-label="Close image gallery"
            onPress={() => setLightboxOpen(false)}
            position="absolute"
            inset={0}
            backgroundColor="transparent"
            cursor="pointer"
            padding={0}
          />

          {/* Close Button */}
          <Button
            chromeless
            onPress={(e) => {
              e.stopPropagation();
              setLightboxOpen(false);
            }}
            position="absolute"
            top={20}
            right={20}
            backgroundColor="$surface"
            borderRadius="$full"
            width={48}
            height={48}
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            zIndex={10000}
            padding={0}
          >
            <Text size="$8" fontWeight="bold" color="$text">
              ✕
            </Text>
          </Button>

          {/* Navigation Arrows */}
          {selectedImageIndex > 0 && (
            <Button
              chromeless
              onPress={(e) => {
                e.stopPropagation();
                setSelectedImageIndex(selectedImageIndex - 1);
              }}
              position="absolute"
              left={20}
              backgroundColor="$surface"
              borderRadius="$full"
              width={48}
              height={48}
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              zIndex={10000}
              padding={0}
            >
              <Text size="$8" fontWeight="bold" color="$text">
                ←
              </Text>
            </Button>
          )}

          {selectedImageIndex < product.images.length - 1 && (
            <Button
              chromeless
              onPress={(e) => {
                e.stopPropagation();
                setSelectedImageIndex(selectedImageIndex + 1);
              }}
              position="absolute"
              right={20}
              backgroundColor="$surface"
              borderRadius="$full"
              width={48}
              height={48}
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              zIndex={10000}
              padding={0}
            >
              <Text size="$8" fontWeight="bold" color="$text">
                →
              </Text>
            </Button>
          )}

          {/* Main Image */}
          <NextImage
            src={selectedImage.url}
            alt={product.title}
            width={1600}
            height={1200}
            sizes="90vw"
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              objectFit: "contain",
              position: "relative",
              zIndex: 1,
            }}
            onClick={(e) => e.stopPropagation()}
            priority
          />

          {/* Image Counter */}
          <Row
            position="absolute"
            bottom={30}
            left="50%"
            transform="translateX(-50%)"
            backgroundColor="$surface"
            paddingVertical="$sm"
            paddingHorizontal="$lg"
            borderRadius="$full"
            zIndex={1}
          >
            <Text size="$5" fontWeight="bold" color="$text">
              {selectedImageIndex + 1} / {product.images.length}
            </Text>
          </Row>
        </Column>
      )}

      {/* Mobile Sticky Bottom Bar */}
      {showMobileBar && (
        <Row
          style={{ position: "fixed" } as CSSProperties}
          bottom={0}
          left={0}
          right={0}
          backgroundColor="$surface"
          borderTopWidth={2}
          borderTopColor="$primary"
          padding="$md"
          zIndex={1000}
          shadowColor="$shadowColor"
          shadowOffset={{ width: 0, height: -4 }}
          shadowRadius={12}
          shadowOpacity={0.1}
          display="none"
          className="mobile-sticky-bar"
        >
          <Row gap="$md" alignItems="center" justifyContent="space-between" width="100%">
            <Column gap="$xs" flex={1}>
              <Text size="$2" color="$textMuted" numberOfLines={1}>
                {product.title}
              </Text>
              <Text size="$6" fontWeight="bold" color="$primary">
                £{product.price.toFixed(2)}
              </Text>
            </Column>
            <Button
              butterVariant="primary"
              size="$4"
              onPress={handleBuyNow}
              disabled={product.isSold}
            >
              {product.isSold ? "Sold" : "Buy Now"}
            </Button>
          </Row>
        </Row>
      )}

      {/* Responsive CSS */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media (min-width: 1024px) {
            .product-sidebar {
              position: sticky;
              top: 100px;
            }
          }

          @media (max-width: 1024px) {
            .mobile-sticky-bar {
              display: flex !important;
            }
          }
        `,
        }}
      />

      {/* Buy Now Sheet */}
      <BuyNowSheet product={product} isOpen={buyNowSheetOpen} onOpenChange={setBuyNowSheetOpen} />
    </>
  );
}
