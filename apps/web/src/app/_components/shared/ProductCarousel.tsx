"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useRouter } from "next/navigation";
import { Column, Row } from "@buttergolf/ui";
import { useTheme } from "tamagui";
import { ProductCard } from "@/components/ProductCard";
import type { ProductCardData } from "@buttergolf/app";

interface ProductCarouselProps {
  readonly products: ProductCardData[];
  readonly autoplay?: boolean;
  readonly autoplayDelay?: number;
}

export function ProductCarousel({
  products,
  autoplay = true,
  autoplayDelay = 5000,
}: ProductCarouselProps) {
  const router = useRouter();
  const theme = useTheme();
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  // Initialize Embla with optional Autoplay plugin
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { align: "start", loop: true, dragFree: false },
    autoplay ? [Autoplay({ delay: autoplayDelay, stopOnInteraction: false })] : []
  );

  // Scroll to specific index (for dot navigation)
  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  // Check if desktop for pagination dots
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  // Update selected index and scroll snaps when carousel changes
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    };

    const onInit = () => {
      setScrollSnaps(emblaApi.scrollSnapList());
    };

    onInit();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onInit);

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onInit);
    };
  }, [emblaApi]);

  return (
    <Column width="100%" alignItems="center" gap="$lg">
      {/* Carousel - extra padding inside to give shadows room */}
      <div
        ref={emblaRef}
        style={{
          overflow: "hidden",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "24px",
            paddingLeft: "32px",
            paddingRight: "32px",
            paddingTop: "40px",
            paddingBottom: "48px",
          }}
        >
          {products.map((product) => (
            <div
              key={product.id}
              style={{
                flex: "0 0 315px",
                width: "315px",
              }}
            >
              <ProductCard
                product={product}
                onPress={() => router.push(`/products/${product.id}`)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Pagination Dots (Desktop Only) */}
      <Row gap="$sm" justifyContent="center" display={isDesktop ? "flex" : "none"}>
        {scrollSnaps.map((_, index) => (
          // eslint-disable-next-line react/forbid-elements
          <button
            key={index}
            onClick={() => scrollTo(index)}
            style={{
              width: selectedIndex === index ? "48px" : "10px",
              height: "10px",
              borderRadius: "5px",
              border: "none",
              backgroundColor: theme.primary.val,
              opacity: selectedIndex === index ? 1 : 0.5,
              cursor: "pointer",
              transition: "all 0.3s ease",
              padding: 0,
            }}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </Row>
    </Column>
  );
}
