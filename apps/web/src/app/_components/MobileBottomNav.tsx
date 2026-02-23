"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Column, Row, Text, useMedia } from "@buttergolf/ui";
import { Home, Heart, PlusCircle, MessageCircle, User } from "@tamagui/lucide-icons";

const TABS = [
  { key: "home", label: "Home", href: "/", icon: Home, matchPaths: ["/"] },
  {
    key: "wishlist",
    label: "Wishlist",
    href: "/favourites",
    icon: Heart,
    matchPaths: ["/favourites"],
  },
  { key: "sell", label: "Sell", href: "/sell", icon: PlusCircle, matchPaths: ["/sell"] },
  {
    key: "messages",
    label: "Messages",
    href: "/messages",
    icon: MessageCircle,
    matchPaths: ["/messages"],
  },
  {
    key: "account",
    label: "Account",
    href: "/account",
    icon: User,
    matchPaths: ["/account", "/orders", "/seller"],
  },
];

/**
 * Mobile bottom tab navigation for web — mirrors the native app's MobileBottomNav.
 * Hidden on desktop via useMedia() hook.
 *
 * Uses Next.js Link for client-side navigation with proper accessibility attributes
 * (aria-label, aria-current) on each tab.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const media = useMedia();

  const getActiveTab = () => {
    for (const tab of TABS) {
      if (tab.key === "home") {
        if (pathname === "/") return "home";
        continue;
      }
      if (tab.matchPaths.some((p) => pathname?.startsWith(p))) return tab.key;
    }
    return "";
  };

  // Hide on desktop
  if (media.gtMd) return null;

  const activeTab = getActiveTab();

  return (
    <nav
      aria-label="Mobile navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
      }}
    >
      <Column
        backgroundColor="$background"
        borderTopWidth={1}
        borderTopColor="$border"
        paddingTop="$2"
        paddingBottom="$3"
      >
        <Row alignItems="center" justifyContent="space-around" paddingHorizontal="$2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const IconComponent = tab.icon;
            return (
              <Column key={tab.key} alignItems="center" flex={1}>
                <Link
                  href={tab.href}
                  aria-label={tab.label}
                  aria-current={isActive ? "page" : undefined}
                  style={{ textDecoration: "none", display: "flex" }}
                >
                  <Column gap="$1" alignItems="center" paddingVertical="$1" paddingHorizontal="$1">
                    <IconComponent size={22} color={isActive ? "$primary" : "$textSecondary"} />
                    <Text
                      size="$1"
                      color={isActive ? "$primary" : "$textSecondary"}
                      fontWeight={isActive ? "600" : "400"}
                    >
                      {tab.label}
                    </Text>
                  </Column>
                </Link>
              </Column>
            );
          })}
        </Row>
      </Column>
    </nav>
  );
}
