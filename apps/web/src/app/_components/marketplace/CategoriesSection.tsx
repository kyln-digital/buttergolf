"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { CATEGORIES } from "@buttergolf/db";
import Link from "next/link";
import Image from "next/image";
import { Column, Heading, Text } from "@buttergolf/ui";

export function CategoriesSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Check for reduced motion preference (memoized)
  const prefersReducedMotion = useMemo(() => {
    if (globalThis.window === undefined) return false;
    return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Duplicate categories for seamless infinite loop
  const duplicatedCategories = useMemo(() => {
    // Triple the categories for smoother infinite loop
    return [...CATEGORIES, ...CATEGORIES, ...CATEGORIES];
  }, []);

  useEffect(() => {
    setIsMounted(true); // eslint-disable-line react-hooks/set-state-in-effect -- Required for hydration
  }, []);

  // Calculate animation duration based on number of items
  const animationDuration = CATEGORIES.length * 4; // 4 seconds per category

  return (
    <Column width="100%" paddingVertical="$2xl" backgroundColor="$background" overflow="hidden">
      <Column maxWidth={1200} marginHorizontal="auto" paddingHorizontal="$md" marginBottom="$2xl">
        {/* Headings */}
        <Column gap="$sm" alignItems="center">
          <Heading level={2} size="$8" $gtMd={{ size: "$9" }} color="$text" textAlign="center">
            Shop by category
          </Heading>
          <Text size="$5" $gtMd={{ size: "$6" }} color="$textSecondary" textAlign="center">
            Find exactly what you need - faster.
          </Text>
        </Column>
      </Column>

      {/* Carousel Container - Full Width */}
      <section
        aria-label="Product categories carousel"
        style={{
          position: "relative",
          width: "100%",
          overflowX: "hidden",
          overflowY: "visible",
          WebkitOverflowScrolling: "touch",
          padding: "20px 0",
        }}
        className="categories-carousel-container"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        <div
          ref={trackRef}
          style={{
            display: "flex",
            gap: "16px",
            paddingLeft: "16px",
            paddingRight: "16px",
            willChange: "transform",
            // CSS animation for infinite scroll
            animation:
              isMounted && !prefersReducedMotion
                ? `scroll-infinite ${animationDuration}s linear infinite`
                : "none",
            animationPlayState: isPaused ? "paused" : "running",
          }}
          className="categories-track"
        >
          {duplicatedCategories.map((category, index) => (
            <Link
              key={`${category.slug}-${index}`}
              href={`/category/${category.slug}`}
              className="category-card"
              style={{
                position: "relative",
                width: "clamp(220px, 40vw, 296px)",
                aspectRatio: "9 / 10",
                borderRadius: "14px",
                flexShrink: 0,
                textDecoration: "none",
                boxShadow: "0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)",
                transition: "transform 0.3s ease, box-shadow 0.3s ease",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "14px",
                  overflow: "hidden",
                }}
              >
                <Image
                  src={category.imageUrl}
                  alt={category.name}
                  fill
                  sizes="(max-width: 768px) 280px, 296px"
                  style={{
                    objectFit: "cover",
                    borderRadius: "14px",
                  }}
                  priority={false}
                />

                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0) 100%)",
                    borderRadius: "14px",
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    bottom: "16px",
                    left: "16px",
                    fontFamily: "var(--font-urbanist)",
                    fontSize: "clamp(18px, 4vw, 24px)",
                    fontWeight: 600,
                    lineHeight: 1,
                    color: "#FFFAD2",
                    textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  }}
                >
                  {category.name}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CSS Keyframes for Infinite Scroll + Mobile Styles */}
      <style>{`
        @keyframes scroll-infinite {
          0% {
            transform: translateX(0);
          }
          100% {
            /* Move exactly one set of categories (card + gap) */
            transform: translateX(calc(-1 * ${CATEGORIES.length} * (clamp(220px, 40vw, 296px) + 16px)));
          }
        }

        @media (max-width: 768px) {
          .categories-carousel-container {
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .categories-carousel-container::-webkit-scrollbar {
            display: none;
          }

          .categories-track {
            animation: none !important;
          }

          .categories-track > a {
            scroll-snap-align: center;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .categories-track {
            animation: none !important;
          }

          .categories-carousel-container {
            overflow-x: auto;
            scroll-snap-type: x mandatory;
          }

          .categories-track > a {
            scroll-snap-align: start;
          }
        }

        .category-card:hover {
          transform: scale(1.05);
          box-shadow: 0 16px 32px rgba(0, 0, 0, 0.2), 0 4px 8px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </Column>
  );
}
