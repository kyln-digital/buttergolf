"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "@tamagui/lucide-icons";
import { Button, Row } from "@buttergolf/ui";
import { useTheme } from "@buttergolf/app/src/hooks/useTheme";

const REVEAL_DURATION_MS = 450;
const ICON_SIZE = 20;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Light / dark toggle for the web header.
 *
 * The sun and moon morph into each other, and the new theme sweeps out from
 * the button as a radial reveal using the View Transitions API. Browsers
 * without the API (or users who prefer reduced motion) get a plain switch.
 */
export function AnimatedThemeToggle() {
  const { resolvedTheme, toggle, canToggle } = useTheme();
  const buttonRef = useRef<HTMLElement | null>(null);

  // Defer theme-dependent rendering until after hydration (SSR resolves "light").
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration pattern: single mount-only state update
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  const handleToggle = useCallback(() => {
    const button = buttonRef.current;

    if (
      !button ||
      typeof document === "undefined" ||
      typeof document.startViewTransition !== "function" ||
      prefersReducedMotion()
    ) {
      toggle();
      return;
    }

    const { top, left, width, height } = button.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const maxRadius = Math.hypot(Math.max(x, viewportWidth - x), Math.max(y, viewportHeight - y));

    const transition = document.startViewTransition(() => {
      flushSync(() => toggle());
      // Give the theme provider a frame to commit the root class before the
      // "new" snapshot is captured.
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });

    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRadius}px at ${x}px ${y}px)`],
          },
          {
            duration: REVEAL_DURATION_MS,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      })
      .catch(() => {
        // The transition was skipped (e.g. another one was already running); the
        // theme has still been toggled.
      });
  }, [toggle]);

  if (!canToggle) {
    return null;
  }

  return (
    <Button
      ref={(node) => {
        buttonRef.current = node as unknown as HTMLElement | null;
      }}
      butterVariant="ghost"
      circular
      size="$4"
      onPress={handleToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Row
        position="relative"
        width={ICON_SIZE}
        height={ICON_SIZE}
        alignItems="center"
        justifyContent="center"
      >
        <Row
          position="absolute"
          animation="medium"
          rotate={isDark ? "0deg" : "-90deg"}
          scale={isDark ? 1 : 0}
          opacity={isDark ? 1 : 0}
        >
          <Sun size={ICON_SIZE} color="$text" />
        </Row>
        <Row
          position="absolute"
          animation="medium"
          rotate={isDark ? "90deg" : "0deg"}
          scale={isDark ? 0 : 1}
          opacity={isDark ? 0 : 1}
        >
          <Moon size={ICON_SIZE} color="$text" />
        </Row>
      </Row>
    </Button>
  );
}
