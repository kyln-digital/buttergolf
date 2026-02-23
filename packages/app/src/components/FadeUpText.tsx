"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Platform } from "react-native";
import { Text as TamaguiText } from "@buttergolf/ui";

interface FadeUpTextProps {
  readonly text: string;
  readonly delay?: number;
  readonly className?: string;
  readonly style?: CSSProperties;
  /** Accessibility label for screen readers (uses text if not provided) */
  readonly ariaLabel?: string;
}

/**
 * Web-only animated version of FadeUpText
 *
 * SSR-SAFE: Always renders the same initial state on server and client (hidden).
 * Animation is triggered via useEffect after hydration completes.
 */
function FadeUpTextWeb({ text, delay = 0, className, style, ariaLabel }: FadeUpTextProps) {
  // Start hidden - same on server and client to prevent hydration mismatch
  const [isVisible, setIsVisible] = useState(false);
  // Check for reduced motion AFTER mount to avoid SSR mismatch
  const [shouldAnimate, setShouldAnimate] = useState(true);

  useEffect(() => {
    // Check reduced motion preference on client only
    const prefersReducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isDesktop = globalThis.innerWidth >= 1024;

    // If user prefers reduced motion or on mobile, show immediately without animation
    if (prefersReducedMotion || !isDesktop) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShouldAnimate(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(true);
      return;
    }

    // Apply delay then show with animation
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [delay]);

  // Always render with the same structure - just toggle visibility via CSS
  // This prevents hydration mismatches by keeping DOM structure identical
  return (
    <div
      className={className}
      style={{
        ...style,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(20px)",
        transition: shouldAnimate ? "opacity 0.6s ease-out, transform 0.6s ease-out" : "none",
      }}
      aria-label={ariaLabel ?? text}
    >
      {text}
    </div>
  );
}

/**
 * Simple fade-up text animation for hero sections
 * Uses CSS transitions instead of GSAP for simplicity
 *
 * Desktop only - shows text immediately on mobile for performance
 *
 * Replaces the complex split-character GSAP animation with a simpler
 * fade-up animation using CSS transitions.
 *
 * Accessibility:
 * - Adds aria-label automatically for proper screen reader pronunciation
 */
export function FadeUpText(props: FadeUpTextProps) {
  // On native, just return static text - no web APIs used
  if (Platform.OS !== "web") {
    const fontWeightValue = (props.style?.fontWeight || "700") as
      | 100
      | 200
      | 300
      | 400
      | 500
      | 600
      | 700
      | 800
      | 900
      | "bold"
      | "normal";
    return (
      <TamaguiText
        fontSize={(props.style?.fontSize as number) || 32}
        fontWeight={fontWeightValue}
        color="$text"
      >
        {props.text}
      </TamaguiText>
    );
  }

  // On web, use the animated version
  return <FadeUpTextWeb {...props} />;
}
