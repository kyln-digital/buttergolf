"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LazySignedIn, LazySignedOut, LazyUserButton } from "@/components/auth/LazyClerkComponents";
import { MessageSquare, Moon, Sun } from "lucide-react";
import {
  Row,
  Column,
  Text,
  AuthButton,
  CategorySelector,
  GlassmorphismCard,
  getGlassmorphismStyles,
  ThemeSwitcher,
  type Category,
  Button,
} from "@buttergolf/ui";
import { useTheme } from "@buttergolf/app/src/hooks/useTheme";
import { CATEGORIES } from "@buttergolf/db";
import { MenuIcon } from "./icons";

// Build navigation from single source of truth
const NAV_CATEGORIES: Category[] = [
  { name: "Shop all", href: "/listings" },
  ...CATEGORIES.map((cat) => ({ name: cat.name, href: `/category/${cat.slug}` })),
];

/**
 * Theme toggle button for header
 * Shows Moon in light mode (click to switch to dark)
 * Shows Sun in dark mode (click to switch to light)
 */
function ThemeToggleButton() {
  const { resolvedTheme, toggle } = useTheme();
  const isDark = resolvedTheme === "dark";
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Row
      tag="button"
      alignItems="center"
      justifyContent="center"
      padding="$2"
      minWidth={44}
      minHeight={44}
      borderRadius="$full"
      cursor="pointer"
      backgroundColor="transparent"
      borderWidth={0}
      hoverStyle={{
        backgroundColor: "$backgroundHover",
      }}
      onPress={toggle}
      aria-label={label}
      title={label}
    >
      <Icon size={20} color="currentColor" />
    </Row>
  );
}

export function ButterHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        style={{ position: "sticky" } as React.CSSProperties}
        top={0}
        zIndex={999}
        suppressHydrationWarning
      >
        {/* Main Header Row */}
        <Row
          backgroundColor="$surface"
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
              <div style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0, cursor: "pointer" }}>
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
            <Row
              display="none"
              $gtMd={{ display: "flex" }}
              gap="$6"
              alignItems="center"
            >
              <Link href="/" style={{ textDecoration: "none" }}>
                <Row
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderRadius="$md"
                  cursor="pointer"
                  backgroundColor="transparent"
                  hoverStyle={{
                    backgroundColor: "rgba(244, 83, 20, 0.1)",
                  }}
                  style={{
                    transition: "all 200ms ease-out",
                  }}
                >
                  <Text
                    size="$6"
                    weight={isActive("/") ? "bold" : "normal"}
                    color="$text"
                  >
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
                    backgroundColor: "rgba(244, 83, 20, 0.1)",
                  }}
                  style={{
                    transition: "all 200ms ease-out",
                  }}
                >
                  <Text
                    size="$6"
                    weight={isActive("/listings") ? "bold" : "normal"}
                    color="$text"
                  >
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
                    backgroundColor: "rgba(244, 83, 20, 0.1)",
                  }}
                  style={{
                    transition: "all 200ms ease-out",
                  }}
                >
                  <Text
                    size="$6"
                    weight={isActive("/sell") ? "bold" : "normal"}
                    color="$text"
                  >
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

              <LazySignedOut>
                <AuthButton
                  variant="login"
                  size="$4"
                  onPress={() => router.push('/sign-in')}
                >
                  Log-in
                </AuthButton>
                <AuthButton
                  variant="signup"
                  size="$4"
                  onPress={() => router.push('/sign-up')}
                >
                  Sign-up
                </AuthButton>
              </LazySignedOut>

              <LazySignedIn>
                <Link
                  href="/messages"
                  style={{ textDecoration: "none" }}
                  aria-label="Messages"
                  title="Messages"
                >
                  <Row
                    alignItems="center"
                    justifyContent="center"
                    padding="$2"
                    minWidth={44}
                    minHeight={44}
                    borderRadius="$full"
                    color={isActive("/messages") ? "$primary" : "$text"}
                    hoverStyle={{
                      backgroundColor: "$backgroundHover",
                    }}
                  >
                    <MessageSquare size={20} color="currentColor" />
                  </Row>
                </Link>

                <LazyUserButton size="default" />
              </LazySignedIn>
            </Row>

            {/* Mobile Menu Toggle */}
            <Row
              display="flex"
              $gtMd={{ display: "none" }}
              tag="button"
              cursor="pointer"
              hoverStyle={{ opacity: 0.8 }}
              padding="$2"
              minWidth={44}
              minHeight={44}
              alignItems="center"
              justifyContent="center"
              onPress={() => setMobileMenuOpen(!mobileMenuOpen)}
              backgroundColor="transparent"
              borderWidth={0}
              aria-label="Menu"
              color="$text"
            >
              <MenuIcon />
            </Row>
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
            paddingVertical: "$4" 
          }}
        >
          <GlassmorphismCard
            intensity="medium"
            blur="medium"
            maxWidth={1280}
            width="100%"
            paddingHorizontal="$3"
            paddingVertical="$3"
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
          backgroundColor="$surface"
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

          {/* Visual Divider */}
          <Row
            height={1}
            backgroundColor="$border"
            marginVertical="$4"
            width="100%"
          />

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
                <Row
                  minHeight={44}
                  alignItems="center"
                  paddingVertical="$2"
                >
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
          <Row
            height={1}
            backgroundColor="$border"
            marginVertical="$2"
            width="100%"
          />
          <Row alignItems="center" justifyContent="space-between" paddingVertical="$2">
            <Text size="$5" weight="semibold" color="$textSecondary">
              Theme
            </Text>
            <ThemeSwitcher showLabels />
          </Row>

          {/* Mobile Auth Buttons */}
          <Column gap="$3" marginTop="$6">
            <LazySignedOut>
              <AuthButton
                variant="login"
                size="$5"
                fullWidth
                onPress={() => {
                  router.push('/sign-in');
                  setMobileMenuOpen(false);
                }}
              >
                Log-in
              </AuthButton>
              <AuthButton
                variant="signup"
                size="$5"
                fullWidth
                onPress={() => {
                  router.push('/sign-up');
                  setMobileMenuOpen(false);
                }}
              >
                Sign-up
              </AuthButton>
            </LazySignedOut>

            <LazySignedIn>
              <Row justifyContent="center" paddingVertical="$4">
                <LazyUserButton size="large" />
              </Row>
            </LazySignedIn>
          </Column>
        </Column>
      )}
    </>
  );
}
