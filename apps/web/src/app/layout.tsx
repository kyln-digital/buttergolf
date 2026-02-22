import type { Metadata, Viewport } from "next";
export const dynamic = "force-dynamic";
import "./globals.css";
import { NextTamaguiProvider } from "./NextTamaguiProvider";
import { Urbanist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";

// Load Tamagui CSS in production (compiled output)
if (process.env.NODE_ENV === "production") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("../../public/tamagui.css");
}
import { ButterHeader } from "./_components/header/ButterHeader";
// TODO: Uncomment when App Store / Play Store IDs are available and the app is publicly published.
// The AppPromoBanner renders broken on iOS unless a valid apple-itunes-app meta app-id is set.
// import { AppPromoBanner } from "./_components/AppPromoBanner";
import { ConditionalLayout } from "./_components/ConditionalLayout";
import { MobileInterstitial } from "./_components/MobileInterstitial";
import { CartProvider } from "../context/CartContext";
import { ErrorBoundary } from "../components/ErrorBoundary";

/** Routes excluded from header, banners, and mobile interstitial */
const EXCLUDED_CHROME_ROUTES = [
  "/coming-soon",
  "/mobile-onboarding",
  "/sign-in",
  "/sign-in/*",
  "/sign-up",
  "/sign-up/*",
];

// Urbanist font configuration for Pure Butter brand
// Supports weights 100-900 with italic variants
const urbanist = Urbanist({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-urbanist",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#E25F2F", // Pure Butter orange
};

export const metadata: Metadata = {
  title: "ButterGolf",
  description: "P2P Marketplace for Golf Equipment",
  manifest: "/site.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ButterGolf",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "ButterGolf",
    title: "ButterGolf - P2P Golf Equipment Marketplace",
    description: "Buy and sell golf equipment with fellow golfers",
  },
  other: {
    // TODO: Re-enable apple-itunes-app meta tag once the app has a real App Store ID.
    // Smart App Banners only work for publicly listed App Store apps — NOT TestFlight.
    // Setting a placeholder app-id causes a broken/invisible banner in iOS Safari.
    // "apple-itunes-app": "app-id=YOUR_APP_STORE_ID",
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={urbanist.className}>
        <NextTamaguiProvider>
          <CartProvider>
            {/* Mobile interstitial — dismissible overlay directing to desktop or native app */}
            <ConditionalLayout excludeRoutes={EXCLUDED_CHROME_ROUTES}>
              <MobileInterstitial />
            </ConditionalLayout>
            <ConditionalLayout excludeRoutes={EXCLUDED_CHROME_ROUTES}>
              <ErrorBoundary
                name="ButterHeader"
                fallback={<div style={{ height: 72, backgroundColor: "#f5f5f5" }} />}
              >
                <ButterHeader />
              </ErrorBoundary>
              {/* TODO: Restore <AppPromoBanner /> once App Store / Play Store IDs are confirmed and app is publicly published. */}
            </ConditionalLayout>
            {/* Main content wrapper */}
            <main className="bg-white">{children}</main>
          </CartProvider>
        </NextTamaguiProvider>
        <Analytics />
        {/* Tidio chat - excluded from mobile-onboarding WebView */}
        <ConditionalLayout excludeRoutes={["/mobile-onboarding"]}>
          <Script
            src="//code.tidio.co/ba25ralqm9iybtdmfwzusfi6xuyd2qag.js"
            strategy="afterInteractive"
          />
        </ConditionalLayout>
      </body>
    </html>
  );
}

// Note: Solito navigation works automatically with Next.js App Router
// The Link component from 'solito/link' wraps Next.js Link for cross-platform compatibility
