"use client";

import { useEffect, useState, type PropsWithChildren, useMemo } from "react";
import { View } from "@buttergolf/ui";

interface AnimatedViewProps extends PropsWithChildren {
  /**
   * Delay before animation starts (in milliseconds)
   * Using vanilla JS for random delays instead of GSAP
   */
  readonly delay?: number;
  /**
   * Whether to disable animations (respects prefers-reduced-motion by default)
   */
  readonly disableAnimations?: boolean;
}

/**
 * Page-load fade-in animation using Tamagui's built-in animation system
 *
 * Use this for above-the-fold content that should animate on page load:
 * - Hero sections
 * - Category grids
 * - Any content that's immediately visible
 *
 * Replaces GSAP-based PageLoadAnimation with native Tamagui animations.
 *
 * Animation behavior:
 * - Fades in and slides up on mount (using enterStyle)
 * - Respects prefers-reduced-motion
 * - Uses spring-based animations from Tamagui config
 */
export function AnimatedView({
  children,
  delay = 0,
  disableAnimations = false,
}: Readonly<AnimatedViewProps>) {
  const [isVisible, setIsVisible] = useState(false);

  // Check for reduced motion preference at module level (no state update needed)
  const prefersReducedMotion = useMemo(() => {
    if (globalThis.window === undefined) return false;
    return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    // Apply delay using vanilla JS setTimeout
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  // Always render same structure - only animate opacity and y values
  // This prevents React from unmounting/remounting children during animation
  return (
    <View
      width="100%"
      opacity={isVisible ? 1 : 0}
      y={isVisible ? 0 : 30}
      transition={disableAnimations || prefersReducedMotion ? undefined : "lazy"}
    >
      {children}
    </View>
  );
}
