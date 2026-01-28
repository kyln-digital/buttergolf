import type { Metadata } from "next";
import Link from "next/link";
import { AnimatedLogo } from "./_components/AnimatedLogo";
import { InstagramLink } from "./_components/InstagramLink";
import { WaitlistForm } from "./_components/WaitlistForm";

export const metadata: Metadata = {
  title: "Coming Soon | ButterGolf",
  description:
    "ButterGolf is launching soon. The smoothest way to buy and sell pre-loved golf equipment.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ComingSoonPage() {
  return (
    <main
      style={{
        // Use dvh (dynamic viewport height) for mobile browser compatibility
        // Falls back gracefully in older browsers
        minHeight: "100dvh",
        width: "100%",
        backgroundColor: "#F45314", // Spiced Clementine - $primary
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        paddingBottom: "48px", // Extra padding at bottom for safety
        boxSizing: "border-box",
        // Ensure background covers entire area
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "auto",
      }}
    >
      {/* Admin Sign In Button */}
      <Link
        href="/sign-in"
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: "14px",
          fontWeight: 500,
          color: "rgba(255, 250, 210, 0.6)", // Subtle Vanilla Cream
          textDecoration: "none",
          padding: "8px 16px",
          borderRadius: "8px",
          transition: "all 0.2s ease",
        }}
      >
        Sign In
      </Link>
      {/* Animated Logo */}
      <div style={{ marginBottom: "48px" }}>
        <AnimatedLogo />
      </div>

      {/* Coming Soon Text */}
      <h1
        style={{
          fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: "clamp(32px, 8vw, 64px)",
          fontWeight: 700,
          color: "#FFFAD2", // Vanilla Cream
          textAlign: "center",
          margin: 0,
          marginBottom: "16px",
          letterSpacing: "-0.02em",
        }}
      >
        Coming Soon
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: "clamp(16px, 4vw, 24px)",
          fontWeight: 400,
          color: "rgba(255, 250, 210, 0.85)", // Vanilla Cream with opacity
          textAlign: "center",
          margin: 0,
          maxWidth: "500px",
          lineHeight: 1.5,
        }}
      >
        The smoothest way to buy and sell pre-loved golf equipment.
      </p>

      {/* Waitlist Signup */}
      <WaitlistForm />

      {/* Instagram Link */}
      <InstagramLink />
    </main>
  );
}
