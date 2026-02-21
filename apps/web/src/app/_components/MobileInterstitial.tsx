"use client";

import { useEffect, useState } from "react";
import { AnimatedLogo } from "../coming-soon/_components/AnimatedLogo";

const FONT_STACK = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// TODO: Replace with actual App Store URL when app is publicly available
const APP_STORE_URL = "https://apps.apple.com/app/YOUR_APP_ID";

// TODO: Replace with actual Google Play URL when app is publicly available
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=YOUR_PACKAGE_NAME";

export function MobileInterstitial() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    const isSmallScreen = window.matchMedia("(max-width: 1024px)").matches;
    const isMobileUA = /Android|iPhone|iPad|iPod|Mobile|Tablet|iOS/i.test(ua);
    const isMobileDevice = (isMobileUA || isTouch) && isSmallScreen;

    // Don't show if running as installed PWA / native app WebView
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

    if (isMobileDevice && !isStandalone) {
      setIsMobile(true);
    }
  }, []);

  if (!isMobile) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#F45314", // Spiced Clementine - $primary
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        paddingBottom: "48px",
        boxSizing: "border-box",
        overflow: "auto",
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: "40px", width: "100%", maxWidth: "300px" }}>
        <AnimatedLogo />
      </div>

      {/* Heading */}
      <h1
        style={{
          fontFamily: FONT_STACK,
          fontSize: "clamp(26px, 7vw, 48px)",
          fontWeight: 700,
          color: "#FFFAD2", // Vanilla Cream
          textAlign: "center",
          margin: 0,
          marginBottom: "16px",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        Best experienced on desktop
      </h1>

      {/* Subtext */}
      <p
        style={{
          fontFamily: FONT_STACK,
          fontSize: "clamp(15px, 4vw, 20px)",
          fontWeight: 400,
          color: "rgba(255, 250, 210, 0.8)", // Vanilla Cream with opacity
          textAlign: "center",
          margin: 0,
          marginBottom: "40px",
          maxWidth: "360px",
          lineHeight: 1.5,
        }}
      >
        Visit buttergolf.com on a desktop browser, or download the app for the full experience.
      </p>

      {/* CTA Buttons */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          width: "100%",
          maxWidth: "300px",
        }}
      >
        {/* App Store button */}
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            width: "100%",
            backgroundColor: "#FFFAD2", // Vanilla Cream
            color: "#3E3B2C", // Burnt Olive
            fontFamily: FONT_STACK,
            fontSize: "16px",
            fontWeight: 600,
            textAlign: "center",
            textDecoration: "none",
            padding: "14px 24px",
            borderRadius: "9999px",
            letterSpacing: "-0.01em",
          }}
        >
          Download on the App Store
        </a>

        {/* Google Play button */}
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            width: "100%",
            backgroundColor: "transparent",
            color: "#FFFAD2", // Vanilla Cream
            fontFamily: FONT_STACK,
            fontSize: "16px",
            fontWeight: 600,
            textAlign: "center",
            textDecoration: "none",
            padding: "14px 24px",
            borderRadius: "9999px",
            border: "1.5px solid rgba(255, 250, 210, 0.5)",
            letterSpacing: "-0.01em",
          }}
        >
          Get it on Google Play
        </a>
      </div>

      {/* Desktop instruction */}
      <p
        style={{
          fontFamily: FONT_STACK,
          fontSize: "13px",
          fontWeight: 400,
          color: "rgba(255, 250, 210, 0.5)", // Muted Vanilla Cream
          textAlign: "center",
          margin: 0,
          marginTop: "32px",
          maxWidth: "280px",
          lineHeight: 1.5,
        }}
      >
        Or open this page on your desktop browser for the full marketplace experience.
      </p>
    </div>
  );
}
