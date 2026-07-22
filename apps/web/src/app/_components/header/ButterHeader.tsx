"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LazySignedIn,
  LazySignedOut,
  LazyUserButton,
  AuthButtonsSection,
} from "@/components/auth/LazyClerkComponents";
import {
  Row,
  Column,
  Text,
  CategorySelector,
  GlassmorphismCard,
  getGlassmorphismStyles,
  ThemeSwitcher,
  ThemeToggleButton,
  type Category,
  Button,
} from "@buttergolf/ui";
import { useThemeName } from "tamagui";
import { CATEGORIES } from "@buttergolf/constants";
import { MenuIcon } from "./icons";

// Build navigation from single source of truth
const NAV_CATEGORIES: Category[] = [
  { name: "Shop all", href: "/listings" },
  ...CATEGORIES.map((cat) => ({ name: cat.name, href: `/category/${cat.slug}` })),
];

export function ButterHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const themeName = useThemeName();
  const isDark = themeName?.startsWith("dark");

  // Poll for unread message count
  useEffect(() => {
    let active = true;
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/conversations/unread-count");
        if (res.ok && active) {
          const data = await res.json();
          setUnreadCount(data.count ?? 0);
        }
      } catch {
        // Silently ignore — user may not be signed in
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [pathname]);

  // Determine active category from pathname
  const getActiveCategory = (): string => {
    if (pathname?.startsWith("/category/")) {
      return pathname;
    }
    if (pathname === "/listings") {
      return "/listings";
    }
    return ""; // No category selected on other pages (e.g., home)
  };

  // Helper to check if a path is active
  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(path);
  };

  return (
    <>
      {/* Combined Header - Main + Category Nav */}
      <Column
        width="100%"
        backgroundColor="transparent"
        style={{ position: "sticky" } as React.CSSProperties}
        top={0}
        zIndex={999}
        suppressHydrationWarning
      >
        {/* Main Header Row */}
        <Row
          backgroundColor="$background"
          borderBottomWidth={1}
          borderBottomColor="$border"
          paddingHorizontal="$4"
          paddingVertical="$3"
          $md={{ paddingHorizontal: "$6", paddingVertical: "$4" }}
        >
          <Row
            width="100%"
            maxWidth={1440}
            marginHorizontal="auto"
            justifyContent="space-between"
            alignItems="center"
            gap="$4"
            $md={{ gap: "$6" }}
          >
            {/* Logo */}
            <Link href="/">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  textDecoration: "none",
                  flexShrink: 0,
                  cursor: "pointer",
                }}
              >
                <Image
                  src="/logo-orange-on-white.svg"
                  alt="ButterGolf"
                  width={192}
                  height={48}
                  priority
                  style={{
                    height: "48px",
                    width: "auto",
                  }}
                />
              </div>
            </Link>

            {/* Spacer to push navigation to the right */}
            <Row flex={1} display="none" $gtMd={{ display: "flex" }} />

            {/* Navigation - Desktop Only (Right-aligned) */}
            <Row display="none" $gtMd={{ display: "flex" }} gap="$6" alignItems="center">
              <Link href="/" style={{ textDecoration: "none" }}>
                <Row
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderRadius="$md"
                  cursor="pointer"
                  backgroundColor="transparent"
                  hoverStyle={{
                    backgroundColor: "$primarySubtle",
                  }}
                  style={{
                    transition: "all 200ms ease-out",
                  }}
                >
                  <Text size="$6" weight={isActive("/") ? "bold" : "normal"} color="$text">
                    Home
                  </Text>
                </Row>
              </Link>
              <Link href="/listings" style={{ textDecoration: "none" }}>
                <Row
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderRadius="$md"
                  cursor="pointer"
                  backgroundColor="transparent"
                  hoverStyle={{
                    backgroundColor: "$primarySubtle",
                  }}
                  style={{
                    transition: "all 200ms ease-out",
                  }}
                >
                  <Text size="$6" weight={isActive("/listings") ? "bold" : "normal"} color="$text">
                    Buying
                  </Text>
                </Row>
              </Link>
              <Link href="/sell" style={{ textDecoration: "none" }}>
                <Row
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderRadius="$md"
                  cursor="pointer"
                  backgroundColor="transparent"
                  hoverStyle={{
                    backgroundColor: "$primarySubtle",
                  }}
                  style={{
                    transition: "all 200ms ease-out",
                  }}
                >
                  <Text size="$6" weight={isActive("/sell") ? "bold" : "normal"} color="$text">
                    Selling
                  </Text>
                </Row>
              </Link>
            </Row>

            {/* Right Side: Auth Buttons - Desktop Only */}
            <Row
              display="none"
              $gtMd={{ display: "flex" }}
              gap="$3"
              alignItems="center"
              flexShrink={0}
            >
              {/* Theme Toggle */}
              <ThemeToggleButton />

              <AuthButtonsSection>
                <LazySignedOut>
                  <Button
                    butterVariant="primary"
                    size="$4"
                    borderRadius="$full"
                    onPress={() => router.push("/sign-in")}
                  >
                    Log-in
                  </Button>
                  <Button
                    butterVariant="secondary"
                    size="$4"
                    borderRadius="$full"
                    onPress={() => router.push("/sign-up")}
                  >
                    Sign-up
                  </Button>
                </LazySignedOut>

                <LazySignedIn>
                  <LazyUserButton size="default" />
                </LazySignedIn>
              </AuthButtonsSection>
            </Row>

            {/* Mobile Menu Toggle */}
            <Button
              chromeless
              circular
              size="$4"
              display="flex"
              $gtMd={{ display: "none" }}
              onPress={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
              color="$textInverse"
            >
              <MenuIcon />
            </Button>
          </Row>
        </Row>

        {/* Category Navigation Sub-header - Animated Selector with Glassmorphism (Desktop Only) */}
        <Row
          paddingHorizontal="$4"
          paddingVertical="$3"
          justifyContent="center"
          backgroundColor="transparent"
          display="none"
          $gtMd={{
            display: "flex",
            paddingHorizontal: "$6",
            paddingVertical: "$4",
          }}
        >
          <GlassmorphismCard
            intensity={isDark ? "dark" : "medium"}
            blur="medium"
            maxWidth={1280}
            width="100%"
            paddingHorizontal="$3"
            paddingTop="$3"
            paddingBottom="$4"
            alignItems="center"
            justifyContent="center"
            style={{
              overflow: "visible",
              ...getGlassmorphismStyles("medium"),
            }}
          >
            <CategorySelector
              categories={NAV_CATEGORIES}
              activeCategory={getActiveCategory()}
              onCategoryChange={(href) => router.push(href)}
            />
          </GlassmorphismCard>
        </Row>
      </Column>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <Column
          style={{ position: "fixed" }}
          top={72}
          left={0}
          right={0}
          bottom={0}
          backgroundColor="$background"
          zIndex={45}
          paddingHorizontal="$6"
          paddingVertical="$8"
          gap="$6"
          shadowColor="$shadowColor"
          shadowRadius={8}
          shadowOffset={{ width: 0, height: 2 }}
          shadowOpacity={0.15}
        >
          <Link
            href="/"
            style={{ textDecoration: "none" }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Text
              size="$7"
              weight={isActive("/") ? "bold" : "normal"}
              color={isActive("/") ? "$primary" : "$text"}
            >
              Home
            </Text>
          </Link>
          <Link
            href="/listings"
            style={{ textDecoration: "none" }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Text
              size="$7"
              weight={isActive("/listings") ? "bold" : "normal"}
              color={isActive("/listings") ? "$primary" : "$text"}
            >
              Buying
            </Text>
          </Link>
          <Link
            href="/sell"
            style={{ textDecoration: "none" }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Text
              size="$7"
              weight={isActive("/sell") ? "bold" : "normal"}
              color={isActive("/sell") ? "$primary" : "$text"}
            >
              Selling
            </Text>
          </Link>

          {/* Quick links - Favourites, Messages, Orders, Account */}
          <Link
            href="/favourites"
            style={{ textDecoration: "none" }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Text
              size="$7"
              weight={isActive("/favourites") ? "bold" : "normal"}
              color={isActive("/favourites") ? "$primary" : "$text"}
            >
              Wishlist
            </Text>
          </Link>
          <Link
            href="/messages"
            style={{ textDecoration: "none" }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Row alignItems="center" gap="$2">
              <Text
                size="$7"
                weight={isActive("/messages") ? "bold" : "normal"}
                color={isActive("/messages") ? "$primary" : "$text"}
              >
                Messages
              </Text>
              {unreadCount > 0 && (
                <Row
                  backgroundColor="$primary"
                  borderRadius="$full"
                  minWidth={22}
                  height={22}
                  alignItems="center"
                  justifyContent="center"
                  paddingHorizontal="$1"
                >
                  <Text size="$1" color="$textInverse" fontWeight="700">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </Row>
              )}
            </Row>
          </Link>
          <Link
            href="/orders"
            style={{ textDecoration: "none" }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Text
              size="$7"
              weight={isActive("/orders") ? "bold" : "normal"}
              color={isActive("/orders") ? "$primary" : "$text"}
            >
              Orders
            </Text>
          </Link>
          <Link
            href="/account"
            style={{ textDecoration: "none" }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Text
              size="$7"
              weight={isActive("/account") ? "bold" : "normal"}
              color={isActive("/account") ? "$primary" : "$text"}
            >
              Account
            </Text>
          </Link>

          {/* Visual Divider */}
          <Row height={1} backgroundColor="$border" marginVertical="$4" width="100%" />

          {/* Category Navigation - Mobile Only */}
          <Column gap="$4">
            <Text size="$5" weight="semibold" color="$textSecondary">
              Shop by Category
            </Text>
            {NAV_CATEGORIES.map((category) => (
              <Link
                key={category.href}
                href={category.href}
                style={{ textDecoration: "none" }}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Row minHeight={44} alignItems="center" paddingVertical="$2">
                  <Text
                    size="$6"
                    weight={isActive(category.href) ? "bold" : "normal"}
                    color={isActive(category.href) ? "$primary" : "$text"}
                  >
                    {category.name}
                  </Text>
                </Row>
              </Link>
            ))}
          </Column>

          {/* Theme Switcher - Mobile */}
          <Row height={1} backgroundColor="$border" marginVertical="$2" width="100%" />
          <Row alignItems="center" justifyContent="space-between" paddingVertical="$2">
            <Text size="$5" weight="semibold" color="$textSecondary">
              Theme
            </Text>
            <ThemeSwitcher showLabels />
          </Row>

          {/* Mobile Auth Buttons */}
          <Column gap="$3" marginTop="$6">
            <AuthButtonsSection
              placeholder={
                <Column gap="$3" width="100%">
                  <div
                    style={{
                      width: "100%",
                      height: 48,
                      borderRadius: 9999,
                      backgroundColor: "rgba(244, 83, 20, 0.3)",
                    }}
                  />
                  <div
                    style={{
                      width: "100%",
                      height: 48,
                      borderRadius: 9999,
                      backgroundColor: "rgba(237, 237, 237, 0.5)",
                    }}
                  />
                </Column>
              }
            >
              <LazySignedOut>
                <Button
                  butterVariant="primary"
                  size="$5"
                  width="100%"
                  borderRadius="$full"
                  onPress={() => {
                    router.push("/sign-in");
                    setMobileMenuOpen(false);
                  }}
                >
                  Log-in
                </Button>
                <Button
                  butterVariant="secondary"
                  size="$5"
                  width="100%"
                  borderRadius="$full"
                  onPress={() => {
                    router.push("/sign-up");
                    setMobileMenuOpen(false);
                  }}
                >
                  Sign-up
                </Button>
              </LazySignedOut>

              <LazySignedIn>
                <Row justifyContent="center" paddingVertical="$4">
                  <LazyUserButton size="large" />
                </Row>
              </LazySignedIn>
            </AuthButtonsSection>
          </Column>
        </Column>
      )}
    </>
  );
}
