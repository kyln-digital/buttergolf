"use client";

import Image from "next/image";
import Link from "next/link";
import { Text, Row, Column } from "@buttergolf/ui";
import { SECTION_MAX_WIDTH } from "./Section";

const FOOTER_LINKS: { label: string; href: string }[][] = [
  [
    { label: "Home", href: "/" },
    { label: "Buying", href: "/listings" },
    { label: "Selling", href: "/sell" },
  ],
  [
    { label: "Blog", href: "/coming-soon" },
    { label: "Terms of Service", href: "/terms-of-service" },
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Help Centre", href: "/help-centre" },
  ],
];

function FooterLink({ label, href }: Readonly<{ label: string; href: string }>) {
  return (
    <Link href={href} className="footer-link">
      <Text
        size="$4"
        fontWeight="500"
        color="$vanillaCream"
        paddingVertical="$xs"
        hoverStyle={{ opacity: 0.8 }}
      >
        {label}
      </Text>
    </Link>
  );
}

export function FooterSection() {
  return (
    <Column
      tag="footer"
      position="relative"
      backgroundColor="$primary"
      paddingTop="$2xl"
      paddingBottom="$xl"
      overflow="hidden"
      $gtMd={{ paddingTop: "$3xl", paddingBottom: "$2xl" }}
    >
      {/* Background B mark */}
      <Column
        position="absolute"
        right={0}
        top={0}
        bottom={0}
        width="50%"
        zIndex={0}
        pointerEvents="none"
        aria-hidden
      >
        <Image
          src="/_assets/logo/b.svg"
          alt=""
          fill
          sizes="50vw"
          style={{ objectFit: "contain", objectPosition: "right center" }}
        />
      </Column>

      <Column
        position="relative"
        zIndex={1}
        width="100%"
        maxWidth={SECTION_MAX_WIDTH}
        marginHorizontal="auto"
        paddingHorizontal="$md"
        gap="$2xl"
        $gtMd={{ paddingHorizontal: "$xl" }}
      >
        {/* Logo + navigation */}
        <Column
          gap="$xl"
          $gtSm={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Link href="/" aria-label="ButterGolf home">
            <Image
              src="/_assets/logo/logo-cream-on-white.svg"
              alt="ButterGolf"
              width={200}
              height={80}
              style={{ width: 160, height: "auto" }}
            />
          </Link>

          <Row
            tag="nav"
            aria-label="Footer"
            gap="$2xl"
            $gtMd={{ gap: "$3xl" }}
            alignItems="flex-start"
          >
            {FOOTER_LINKS.map((column, index) => (
              <Column key={index} gap="$xs" alignItems="flex-start">
                {column.map((link) => (
                  <FooterLink key={link.href} {...link} />
                ))}
              </Column>
            ))}
          </Row>
        </Column>

        {/* Legal row */}
        <Row
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap="$md"
          paddingTop="$lg"
          borderTopWidth={1}
          borderTopColor="$overlayLight40"
        >
          <Text color="$vanillaCream" size="$3" opacity={0.85}>
            © {new Date().getFullYear()} Butter Golf. All rights reserved.
          </Text>

          <Row
            backgroundColor="$pureWhite"
            borderRadius="$full"
            paddingVertical="$sm"
            paddingHorizontal="$md"
            alignItems="center"
            gap="$sm"
          >
            <Text size="$3" fontWeight="600" color="$success">
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
