"use client";

import Image from "next/image";
import Link from "next/link";
import { Text, Row, Column } from "@buttergolf/ui";

export function FooterSection() {
  return (
    <Column
      position="relative"
      backgroundColor="$primary"
      paddingTop="$3xl"
      paddingBottom="$2xl"
      overflow="hidden"
    >
      {/* Background B.svg pattern */}
      <Column
        position="absolute"
        right={0}
        top={0}
        bottom={0}
        width="50%"
        zIndex={0}
        pointerEvents="none"
      >
        <Image
          src="/_assets/logo/b.svg"
          alt=""
          fill
          sizes="50vw"
          style={{
            objectFit: "contain",
          }}
        />
      </Column>

      {/* Content Container */}
      <Column
        position="relative"
        zIndex={1}
        maxWidth={1280}
        marginHorizontal="auto"
        paddingHorizontal="$2xl"
        width="100%"
      >
        {/* Top Section: Logo + Navigation Links */}
        <Row
          justifyContent="space-between"
          alignItems="flex-start"
          marginBottom="$2xl"
          flexWrap="wrap"
          gap="$xl"
        >
          {/* Logo */}
          <Image
            src="/_assets/logo/logo-cream-on-white.svg"
            alt="ButterGolf"
            width={200}
            height={80}
            priority
            style={{
              height: "auto",
              width: "100%",
              maxWidth: "200px",
            }}
          />

          {/* Right Side - Navigation Links (Two Columns) */}
          <Row gap="$3xl" alignItems="flex-start" zIndex={1}>
            {/* Column 1 */}
            <Column gap="$xs" alignItems="flex-start">
              <Link href="/" style={{ textDecoration: "none" }}>
                <Text
                  color="$vanillaCream"
                  size="$4"
                  weight="bold"
                  cursor="pointer"
                  hoverStyle={{ opacity: 0.8 }}
                >
                  Home
                </Text>
              </Link>
              <Link href="/listings" style={{ textDecoration: "none" }}>
                <Text
                  color="$vanillaCream"
                  size="$4"
                  weight="bold"
                  cursor="pointer"
                  hoverStyle={{ opacity: 0.8 }}
                >
                  Buying
                </Text>
              </Link>
              <Link href="/sell" style={{ textDecoration: "none" }}>
                <Text
                  color="$vanillaCream"
                  size="$4"
                  weight="bold"
                  cursor="pointer"
                  hoverStyle={{ opacity: 0.8 }}
                >
                  Selling
                </Text>
              </Link>
            </Column>

            {/* Column 2 */}
            <Column gap="$xs" alignItems="flex-start">
              <Link href="/coming-soon" style={{ textDecoration: "none" }}>
                <Text
                  color="$vanillaCream"
                  size="$4"
                  cursor="pointer"
                  hoverStyle={{ opacity: 0.8 }}
                >
                  Blog
                </Text>
              </Link>
              <Link href="/terms-of-service" style={{ textDecoration: "none" }}>
                <Text
                  color="$vanillaCream"
                  size="$4"
                  cursor="pointer"
                  hoverStyle={{ opacity: 0.8 }}
                >
                  Terms of Service
                </Text>
              </Link>
              <Link href="/privacy-policy" style={{ textDecoration: "none" }}>
                <Text
                  color="$vanillaCream"
                  size="$4"
                  cursor="pointer"
                  hoverStyle={{ opacity: 0.8 }}
                >
                  Privacy Policy
                </Text>
              </Link>
              <Link href="/help-centre" style={{ textDecoration: "none" }}>
                <Text
                  color="$vanillaCream"
                  size="$4"
                  cursor="pointer"
                  hoverStyle={{ opacity: 0.8 }}
                >
                  Help Centre
                </Text>
              </Link>
            </Column>
          </Row>
        </Row>

        {/* Bottom Section: Copyright + TrustPilot */}
        <Row justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$md">
          {/* Copyright */}
          <Text color="$vanillaCream" size="$3" zIndex={1}>
            © 2025 Butter Golf. All rights reserved.
          </Text>

          {/* TrustPilot Badge */}
          <Row
            backgroundColor="$pureWhite"
            borderRadius="$md"
            paddingVertical="$md"
            paddingHorizontal="$lg"
            alignItems="center"
            gap="$sm"
          >
            <Text size="$4" weight="semibold" color="$success">
              ★ Trustpilot
            </Text>
            <Text size="$3" color="$textSecondary">
              TrustScore 4.5
            </Text>
          </Row>
        </Row>
      </Column>
    </Column>
  );
}
