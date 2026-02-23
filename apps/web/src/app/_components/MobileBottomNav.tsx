"use client";

import { usePathname, useRouter } from "next/navigation";
import { Row, Column, Text } from "@buttergolf/ui";
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
] as const;

/**
 * Mobile bottom tab navigation for web — mirrors the native app's MobileBottomNav.
 * Hidden on desktop (above $gtMd breakpoint).
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

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

  const activeTab = getActiveTab();

  return (
    <Column
      display="flex"
      $gtMd={{ display: "none" }}
      style={{ position: "fixed" }}
      bottom={0}
      left={0}
      right={0}
      backgroundColor="$background"
      borderTopWidth={1}
      borderTopColor="$border"
      paddingTop="$2"
      paddingBottom="$3"
      zIndex={50}
    >
      <Row alignItems="center" justifyContent="space-around" paddingHorizontal="$2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const IconComponent = tab.icon;
          return (
            <Column
              key={tab.key}
              gap="$1"
              alignItems="center"
              minWidth={56}
              paddingVertical="$1"
              paddingHorizontal="$1"
              cursor="pointer"
              onPress={() => router.push(tab.href)}
              role="link"
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <IconComponent size={22} color={isActive ? "$primary" : "$textSecondary"} />
              <Text
                size="$1"
                color={isActive ? "$primary" : "$textSecondary"}
                fontWeight={isActive ? "600" : "400"}
              >
                {tab.label}
              </Text>
            </Column>
          );
        })}
      </Row>
    </Column>
  );
}
