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
import { AppPromoBanner } from "./_components/AppPromoBanner";
import { ConditionalLayout } from "./_components/ConditionalLayout";
import { CartProvider } from "../context/CartContext";
import { FavouritesProvider } from "../providers/FavouritesProvider";
import { ErrorBoundary } from "../components/ErrorBoundary";

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
    "apple-itunes-app": "app-id=YOUR_APP_ID", // TODO: Replace with actual App Store ID when available
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
          <ErrorBoundary name="FavouritesProvider">
            <FavouritesProvider>
              <CartProvider>
                <ConditionalLayout
                  excludeRoutes={[
                    "/coming-soon",
                    "/sign-in",
                    "/sign-in/*",
                    "/sign-up",
                    "/sign-up/*",
                    "/mobile-onboarding",
                  ]}
                >
                  <ErrorBoundary
                    name="ButterHeader"
                    fallback={<div style={{ height: 72, backgroundColor: "#f5f5f5" }} />}
                  >
                    <ButterHeader />
                  </ErrorBoundary>
                  <AppPromoBanner />
                </ConditionalLayout>
                {/* Main content wrapper */}
                <main className="bg-white">{children}</main>
              </CartProvider>
            </FavouritesProvider>
          </ErrorBoundary>
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
