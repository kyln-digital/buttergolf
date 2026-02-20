"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function AppPromoBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const trackEvent = (eventName: string, properties?: Record<string, string | boolean>) => {
    // TODO: Integrate with your analytics service
    console.log("Analytics Event:", eventName, properties);

    // Example: window.gtag?.('event', eventName, properties)
    // Example: window.analytics?.track(eventName, properties)
  };

  useEffect(() => {
    // Only show on mobile/tablet devices
    const ua = navigator.userAgent || "";
    const isTouch =
      typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    const isSmallScreen =
      typeof window !== "undefined" && window.matchMedia?.("(max-width: 1024px)").matches;
    const isMobileUA = /Android|iPhone|iPad|iPod|Mobile|Tablet|iOS/i.test(ua);
    const isMobileDevice = Boolean(isMobileUA || isTouch) && isSmallScreen;

    if (!isMobileDevice) {
      // Do not render or set up listeners on desktop
      return;
    }

    // Check if running in standalone mode (already installed)
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);

    setIsIOS(iOS);

    // Don't show banner if already dismissed or installed
    const dismissed = localStorage.getItem("app-banner-dismissed");
    const lastDismissed = dismissed ? parseInt(dismissed) : 0;
    const daysSinceDismiss = (Date.now() - lastDismissed) / (1000 * 60 * 60 * 24);

    if (standalone || (dismissed && daysSinceDismiss < 7)) {
      return;
    }

    // Track visit count for smart display
    const visitCount = parseInt(localStorage.getItem("visit-count") || "0");
    localStorage.setItem("visit-count", String(visitCount + 1));

    // Show banner after 30 seconds of engagement or on 2nd+ visit
    const timer = setTimeout(() => {
      if (visitCount >= 1 || document.hasFocus()) {
        setShowBanner(true);
        trackEvent("app_banner_shown");
      }
    }, 30000); // 30 seconds

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    trackEvent("app_banner_clicked", { platform: isIOS ? "ios" : "android" });

    if (deferredPrompt) {
      // Android/Chrome PWA install
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        trackEvent("install_converted", { platform: "android" });
        setShowBanner(false);
      } else {
        trackEvent("install_dismissed", { platform: "android" });
      }

      setDeferredPrompt(null);
    } else if (isIOS) {
      // iOS doesn't support programmatic install, show instructions
      // For now, just open App Store (placeholder)
      trackEvent("app_store_redirect", { platform: "ios" });
      // TODO: Replace with actual App Store URL
      // window.open('https://apps.apple.com/app/YOUR_APP_ID', '_blank')
    }
  };

  const handleDismiss = () => {
    trackEvent("app_banner_dismissed");
    localStorage.setItem("app-banner-dismissed", String(Date.now()));
    setShowBanner(false);
  };

  if (!showBanner || isStandalone) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: "white",
        borderTop: "1px solid #e5e7eb",
        padding: "12px 16px",
        boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          maxWidth: "600px",
          margin: "0 auto",
        }}
      >
        {/* App Icon */}
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "8px",
            backgroundColor: "#E25F2F", // Pure Butter orange
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            flexShrink: 0,
          }}
        >
          BG
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: "600", color: "#111827" }}>
            ButterGolf App
          </div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>Get the full experience</div>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleInstall}
          style={{
            backgroundColor: "#E25F2F", // Pure Butter orange
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "8px 16px",
            fontSize: "14px",
            fontWeight: "500",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {isIOS ? "View" : "Install"}
        </button>

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: "20px",
            color: "#6b7280",
          }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
