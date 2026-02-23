"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Column,
  Container,
  Spinner,
  Text,
  Row,
  Card,
  Heading,
  Image,
  Button,
} from "@buttergolf/ui";
import Link from "next/link";
import { Lock, Package, CheckCircle } from "@tamagui/lucide-icons";
import { StripeEmbeddedCheckout } from "./_components/StripeEmbeddedCheckout";
import { PageHero } from "../_components/marketplace/PageHero";
import { TrustSection } from "../_components/marketplace/TrustSection";
import { NewsletterSection } from "../_components/marketplace/NewsletterSection";
import { FooterSection } from "../_components/marketplace/FooterSection";

interface ProductInfo {
  id: string;
  title: string;
  price: number;
  imageUrl: string | null;
  condition: string;
  brand?: string;
}

function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("productId");
  const offerId = searchParams.get("offerId");

  const [loading, setLoading] = useState(!!productId);
  const [error, setError] = useState<string | null>(!productId ? "No product selected" : null);
  const [product, setProduct] = useState<ProductInfo | null>(null);

  useEffect(() => {
    if (!productId) {
      return;
    }

    // Fetch product information for display
    fetch(`/api/products/${productId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Product not found");
        }
        return res.json();
      })
      .then((productData) => {
        setProduct({
          id: productData.id,
          title: productData.title,
          price: productData.price,
          imageUrl: productData.images?.[0]?.url || null,
          condition: productData.condition,
          brand: productData.brand?.name,
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching product:", err);
        setError("Product not found");
        setLoading(false);
      });
  }, [productId]);

  if (loading) {
    return (
      <Container size="lg" paddingVertical="$2xl">
        <Column gap="$lg" alignItems="center" paddingVertical="$3xl">
          <Spinner size="lg" color="$primary" />
          <Text color="$textSecondary">Preparing checkout...</Text>
        </Column>
      </Container>
    );
  }

  if (error || !product) {
    return (
      <Container size="lg" paddingVertical="$2xl">
        <Column gap="$xl" alignItems="center" paddingVertical="$3xl">
          <Column
            backgroundColor="$errorLight"
            borderRadius="$full"
            padding="$lg"
            alignItems="center"
            justifyContent="center"
            width={80}
            height={80}
          >
            <Text size="$9" color="$error">
              !
            </Text>
          </Column>
          <Column gap="$sm" alignItems="center">
            <Heading level={3}>{error || "Unable to load checkout"}</Heading>
            <Text color="$textSecondary" textAlign="center">
              Please try again or contact support if the issue persists.
            </Text>
          </Column>
          <Link href="/" style={{ textDecoration: "none" }}>
            <Button butterVariant="primary" size="$5">
              Back to Shop
            </Button>
          </Link>
        </Column>
      </Container>
    );
  }

  return (
    <>
      {/* Page Hero */}
      <PageHero />

      {/* Main Content - Two Column Layout */}
      <Column backgroundColor="$background">
        <Container size="xl" paddingVertical="$2xl">
          <Row
            gap="$xl"
            width="100%"
            flexDirection="column-reverse"
            $gtMd={{ flexDirection: "row", alignItems: "flex-start" }}
            alignItems="stretch"
          >
            {/* Left Column - Stripe Embedded Checkout (wider on desktop) */}
            <Column
              flexBasis={0}
              flexGrow={3}
              flexShrink={1}
              minWidth={0}
              $gtMd={{ minWidth: 500 }}
            >
              <StripeEmbeddedCheckout
                productId={product.id}
                offerId={offerId}
                onError={(err) => setError(err)}
              />
            </Column>

            {/* Right Column - Product Summary (narrower on desktop) */}
            <Column
              flexBasis={0}
              flexGrow={1}
              flexShrink={1}
              minWidth={0}
              $gtMd={{ maxWidth: 350 }}
            >
              <Card variant="elevated" padding="$lg">
                <Column gap="$md">
                  <Heading level={4}>Order Summary</Heading>

                  {/* Product Preview */}
                  <Row gap="$md" alignItems="flex-start">
                    {product.imageUrl && (
                      <Image
                        source={{ uri: product.imageUrl }}
                        width={80}
                        height={80}
                        borderRadius="$md"
                        alt={product.title}
                      />
                    )}
                    <Column gap="$xs" flex={1}>
                      <Text size="$5" weight="semibold" numberOfLines={2}>
                        {product.title}
                      </Text>
                      {product.brand && (
                        <Text size="$3" color="$textSecondary">
                          {product.brand}
                        </Text>
                      )}
                      <Text size="$3" color="$textSecondary">
                        Condition: {product.condition.replace("_", " ")}
                      </Text>
                    </Column>
                  </Row>

                  {/* Price */}
                  <Row
                    justifyContent="space-between"
                    alignItems="center"
                    paddingTop="$md"
                    borderTopWidth={1}
                    borderTopColor="$border"
                  >
                    <Text color="$textSecondary">Subtotal</Text>
                    <Text weight="bold" size="$6" color="$primary">
                      £{product.price.toFixed(2)}
                    </Text>
                  </Row>

                  <Text size="$2" color="$textSecondary">
                    Shipping calculated at checkout
                  </Text>

                  {/* Trust Badges */}
                  <Column gap="$sm" paddingTop="$md" borderTopWidth={1} borderTopColor="$border">
                    <Row gap="$sm" alignItems="center">
                      <Lock size={16} color="$textSecondary" />
                      <Text size="$3" color="$textSecondary">
                        Secure checkout powered by Stripe
                      </Text>
                    </Row>
                    <Row gap="$sm" alignItems="center">
                      <Package size={16} color="$textSecondary" />
                      <Text size="$3" color="$textSecondary">
                        Tracked shipping included
                      </Text>
                    </Row>
                    <Row gap="$sm" alignItems="center">
                      <CheckCircle size={16} color="$textSecondary" />
                      <Text size="$3" color="$textSecondary">
                        Buyer protection guarantee
                      </Text>
                    </Row>
                  </Column>
                </Column>
              </Card>
            </Column>
          </Row>
        </Container>
      </Column>

      {/* Trust Section */}
      <TrustSection />

      {/* Newsletter */}
      <NewsletterSection />

      {/* Footer */}
      <FooterSection />
    </>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <Container size="lg" paddingVertical="$2xl">
          <Column gap="$lg" alignItems="center" paddingVertical="$3xl">
            <Spinner size="lg" color="$primary" />
          </Column>
        </Container>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}
