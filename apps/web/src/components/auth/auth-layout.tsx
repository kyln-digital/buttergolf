"use client";

import Image from "next/image";
import Link from "next/link";
import { Row, Column, Text } from "@buttergolf/ui";
import { InteractiveGridPattern } from "./interactive-grid";

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * AuthLayout provides a split-screen layout for authentication pages.
 * Left panel: ButterGolf branding with interactive grid pattern (hidden on mobile)
 * Right panel: Clerk authentication form
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <Row width="100vw" height="100vh" backgroundColor="$pureWhite">
      {/* Left Panel - Branding (hidden on mobile, visible on lg+) */}
      <Column
        flex={1}
        height="100%"
        padding="$xl"
        backgroundColor="$pureWhite"
        justifyContent="space-between"
        display="none"
        $gtLg={{
          display: "flex",
        }}
        style={{ position: "relative", overflow: "hidden" }}
      >
        {/* ButterGolf Logo */}
        <Row zIndex={20}>
          <Link href="/">
            <Image
              src="/logo-orange-on-white.svg"
              alt="ButterGolf"
              width={180}
              height={50}
              priority
            />
          </Link>
        </Row>

        {/* Interactive Grid Pattern */}
        <InteractiveGridPattern
          className="inset-x-0 inset-y-[0%] h-full skew-y-12"
          style={{
            maskImage: "radial-gradient(500px circle at center, white, transparent)",
            WebkitMaskImage: "radial-gradient(500px circle at center, white, transparent)",
          }}
        />

        {/* Tagline */}
        <Column zIndex={20} gap="$sm">
          <Text size="$6" color="$text">
            Your destination for premium pre-owned golf equipment. Buy and sell with fellow golfers
            in a trusted marketplace.
          </Text>
          <Text size="$4" color="$textSecondary">
            ButterGolf
          </Text>
        </Column>
      </Column>

      {/* Right Panel - Auth Form */}
      <Column
        flex={1}
        height="100%"
        alignItems="center"
        justifyContent="center"
        padding="$lg"
        backgroundColor="$pureWhite"
        $gtLg={{
          padding: "$xl",
          alignItems: "flex-start",
          paddingLeft: "$3xl",
        }}
      >
        <Column width="100%" maxWidth={400} alignItems="center" justifyContent="center" gap="$lg">
          {/* Mobile Logo (visible only on mobile) */}
          <Row
            marginBottom="$md"
            display="flex"
            $gtLg={{
              display: "none",
            }}
          >
            <Link href="/">
              <Image
                src="/logo-orange-on-white.svg"
                alt="ButterGolf"
                width={150}
                height={42}
                priority
              />
            </Link>
          </Row>

          {/* Clerk Form */}
          {children}

          {/* Terms & Privacy */}
          <Text size="$3" color="$textSecondary" textAlign="center" paddingHorizontal="$lg">
            By continuing, you agree to our{" "}
            <Link href="/terms" style={{ textDecoration: "underline" }}>
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" style={{ textDecoration: "underline" }}>
              Privacy Policy
            </Link>
            .
          </Text>
        </Column>
      </Column>
    </Row>
  );
}
