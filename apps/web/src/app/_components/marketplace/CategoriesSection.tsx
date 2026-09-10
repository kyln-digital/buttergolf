"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CATEGORIES } from "@buttergolf/constants";
import { Column, Row, Text } from "@buttergolf/ui";
import { SECTION_MAX_WIDTH, SectionHeader } from "./Section";

/** Card width: two-up on phones, capped on desktop. Shared by layout and the marquee maths. */
const CARD_WIDTH = "clamp(200px, 40vw, 280px)";
const CARD_GAP = 16;
const SECONDS_PER_CATEGORY = 4;
const MARQUEE_DURATION_SECONDS = CATEGORIES.length * SECONDS_PER_CATEGORY;
const MOBILE_MEDIA_QUERY = "(max-width: 768px)";

export function CategoriesSection() {
  const [isPaused, setIsPaused] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const prefersReducedMotion = useMemo(() => {
    if (globalThis.window === undefined) return false;
    return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Three copies so the marquee can loop without a visible seam.
  const duplicatedCategories = useMemo(() => [...CATEGORIES, ...CATEGORIES, ...CATEGORIES], []);

  useEffect(() => {
    setIsMounted(true); // eslint-disable-line react-hooks/set-state-in-effect -- Required for hydration
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const shouldAnimate = isMounted && !prefersReducedMotion && !isMobile;
  // The animation lives in classes (not an inline style) so the paused class
  // can override it: an inline `animation` shorthand resets play-state to
  // running and beats any class.
  const trackClassName = [
    "categories-track",
    shouldAnimate && "categories-track--animate",
    isPaused && "categories-track--paused",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Column
      tag="section"
      aria-label="Shop by category"
      width="100%"
      backgroundColor="$background"
      overflow="hidden"
      paddingVertical="$2xl"
      gap="$xl"
      $gtMd={{ paddingVertical: "$3xl", gap: "$2xl" }}
    >
      <Column
        width="100%"
        maxWidth={SECTION_MAX_WIDTH}
        marginHorizontal="auto"
        paddingHorizontal="$md"
        $gtMd={{ paddingHorizontal: "$xl" }}
      >
        <SectionHeader title="Shop by category" subtitle="Find exactly what you need - faster." />
      </Column>

      {/* Full-bleed track: auto-scrolls on desktop, swipes on mobile */}
      <Column
        className="categories-carousel"
        width="100%"
        paddingVertical="$xs"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        <Row className={trackClassName} gap={CARD_GAP} paddingHorizontal="$md">
          {(isMobile ? CATEGORIES : duplicatedCategories).map((category, index) => (
            <Link
              key={`${category.slug}-${index}`}
              href={`/category/${category.slug}`}
              className="category-card"
              style={{ width: CARD_WIDTH, flexShrink: 0 }}
            >
              <Column
                width="100%"
                aspectRatio={9 / 10}
                borderRadius="$lg"
                overflow="hidden"
                position="relative"
                backgroundColor="$backgroundHover"
              >
                <Image
                  src={category.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 40vw, 280px"
                  style={{ objectFit: "cover" }}
                />
                <Column
                  className="category-card__scrim"
                  position="absolute"
                  top={0}
                  right={0}
                  bottom={0}
                  left={0}
                />
                <Text
                  position="absolute"
                  bottom="$md"
                  left="$md"
                  size="$7"
                  fontWeight="600"
                  color="$vanillaCream"
                >
                  {category.name}
                </Text>
              </Column>
            </Link>
          ))}
        </Row>
      </Column>

      <style>{`
        @keyframes categories-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(calc(-1 * ${CATEGORIES.length} * (${CARD_WIDTH} + ${CARD_GAP}px))); }
        }

        .categories-carousel {
          overflow-x: hidden;
          overflow-y: visible;
        }
        .categories-track--animate {
          animation: categories-marquee ${MARQUEE_DURATION_SECONDS}s linear infinite;
          will-change: transform;
        }
        /* Declared after --animate so it wins the play-state on hover / focus. */
        .categories-track--paused {
          animation-play-state: paused;
        }

        .category-card {
          display: block;
          text-decoration: none;
          border-radius: 14px;
        }
        .category-card:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 3px;
        }

        /* Legibility scrim; hover lifts it a touch instead of moving the card */
        .category-card__scrim {
          background: linear-gradient(to top, rgba(0, 0, 0, 0.72) 0%, rgba(0, 0, 0, 0.28) 50%, rgba(0, 0, 0, 0) 100%);
          transition: opacity 200ms ease;
        }
        .category-card:hover .category-card__scrim {
          opacity: 0.8;
        }

        /* Mobile: manual swipe with snapping replaces the marquee */
        @media ${MOBILE_MEDIA_QUERY} {
          .categories-carousel {
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
          }
          .categories-carousel::-webkit-scrollbar {
            display: none;
          }
          .categories-track > a {
            scroll-snap-align: center;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .categories-track {
            animation: none !important;
          }
          .categories-carousel {
            overflow-x: auto;
            scroll-snap-type: x mandatory;
          }
          .categories-track > a {
            scroll-snap-align: start;
          }
        }
      `}</style>
    </Column>
  );
}
