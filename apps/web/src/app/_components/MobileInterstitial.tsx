"use client";

import { useEffect, useRef, useState } from "react";
import { Column, Text, Button } from "@buttergolf/ui";
import { AnimatedLogo } from "../coming-soon/_components/AnimatedLogo";

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? "";
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? "";

export function MobileInterstitial() {
  const [isMobile, setIsMobile] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingId = "mobile-interstitial-heading";

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }

    const ua = navigator.userAgent || "";
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    const isSmallScreen = window.matchMedia("(max-width: 1024px)").matches;
    const isMobileUA = /Android|iPhone|iPad|iPod|Mobile|Tablet|iOS/i.test(ua);
    const isMobileDevice = Boolean(isMobileUA || isTouch) && isSmallScreen;

    // Don't show if running as installed PWA / native app WebView
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

    if (isMobileDevice && !isStandalone) {
      setIsMobile(true);
    }
  }, []);

  // Focus trap: keep focus within the dialog
  useEffect(() => {
    if (!isMobile || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'a[href], button, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();
  }, [isMobile]);

  if (!isMobile) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        minHeight: "100dvh",
        width: "100%",
        overflow: "auto",
      }}
    >
      <Column
        backgroundColor="$primary"
        alignItems="center"
        justifyContent="center"
        padding="$lg"
        paddingBottom="$2xl"
        minHeight="100dvh"
        width="100%"
      >
        {/* Logo */}
        <Column marginBottom="$xl" width="100%" maxWidth={300}>
          <AnimatedLogo />
        </Column>

        {/* Heading */}
        <Text
          id={headingId}
          size="$11"
          fontWeight="700"
          color="$primaryLight"
          textAlign="center"
          marginBottom="$md"
          letterSpacing={-0.5}
        >
          Best experienced on desktop
        </Text>

        {/* Subtext */}
        <Text
          size="$6"
          fontWeight="400"
          color="$overlayLight60"
          textAlign="center"
          marginBottom="$xl"
          maxWidth={360}
        >
          Visit buttergolf.com on a desktop browser, or download the app for the full experience.
        </Text>

        {/* CTA Buttons */}
        <Column alignItems="center" gap="$sm" width="100%" maxWidth={300}>
          <Button
            tag="a"
            href={APP_STORE_URL || "#"}
            target="_blank"
            rel="noopener noreferrer"
            size="$5"
            backgroundColor="$primaryLight"
            color="$secondary"
            fontWeight="600"
            borderRadius="$full"
            width="100%"
            textAlign="center"
            hoverStyle={{ opacity: 0.9 }}
            pressStyle={{ opacity: 0.8 }}
            focusVisibleStyle={{
              outlineWidth: 2,
              outlineColor: "$primaryLight",
              outlineStyle: "solid",
              outlineOffset: 2,
            }}
          >
            Download on the App Store
          </Button>

          <Button
            tag="a"
            href={PLAY_STORE_URL || "#"}
            target="_blank"
            rel="noopener noreferrer"
            size="$5"
            backgroundColor="transparent"
            color="$primaryLight"
            fontWeight="600"
            borderRadius="$full"
            borderWidth={1.5}
            borderColor="$overlayLight30"
            width="100%"
            textAlign="center"
            hoverStyle={{ borderColor: "$overlayLight60" }}
            pressStyle={{ opacity: 0.8 }}
            focusVisibleStyle={{
              outlineWidth: 2,
              outlineColor: "$primaryLight",
              outlineStyle: "solid",
              outlineOffset: 2,
            }}
          >
            Get it on Google Play
          </Button>
        </Column>
      </Column>
    </div>
  );
}
