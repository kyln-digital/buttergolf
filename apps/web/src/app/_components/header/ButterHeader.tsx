"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, MessageCircle, Plus, Search } from "@tamagui/lucide-icons";
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
  ThemeSwitcher,
  type Category,
  Button,
} from "@buttergolf/ui";
import { CATEGORIES } from "@buttergolf/constants";
import { useLinkPress } from "@/hooks/useLinkPress";
import { AnimatedThemeToggle } from "./AnimatedThemeToggle";
import { HeaderSearch } from "./HeaderSearch";
import { MenuIcon, CloseIcon } from "./icons";

// Build navigation from single source of truth
const NAV_CATEGORIES: Category[] = [
  { name: "Shop all", href: "/listings" },
  ...CATEGORIES.map((cat) => ({ name: cat.name, href: `/category/${cat.slug}` })),
];

const MOBILE_LINKS = [
  { label: "Home", href: "/" },
  { label: "Buying", href: "/listings" },
  { label: "Selling", href: "/sell" },
  { label: "Wishlist", href: "/favourites" },
  { label: "Messages", href: "/messages" },
  { label: "Orders", href: "/orders" },
  { label: "Account", href: "/account" },
];

const HEADER_MAX_WIDTH = 1440;
const MOBILE_HEADER_HEIGHT = 64;

function UnreadBadge({ count }: Readonly<{ count: number }>) {
  if (count <= 0) return null;
  return (
    <Row
      position="absolute"
      top={2}
      right={2}
      minWidth={18}
      height={18}
      paddingHorizontal={4}
      borderRadius="$full"
      backgroundColor="$primary"
      borderWidth={2}
      borderColor="$background"
      alignItems="center"
      justifyContent="center"
      pointerEvents="none"
    >
      <Text size="$1" color="$textInverse" fontWeight="700">
        {count > 99 ? "99+" : count}
      </Text>
    </Row>
  );
}

export function ButterHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const linkPress = useLinkPress();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);

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

  // Elevate the header once the page scrolls beneath it
  useEffect(() => {
    const update = () => setIsScrolled(window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  // Close the mobile menu on navigation and lock body scroll while open
  useEffect(() => {
    setMobileMenuOpen(false); // eslint-disable-line react-hooks/set-state-in-effect -- close overlay on route change
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileMenuOpen]);

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

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <Column
        tag="header"
        width="100%"
        backgroundColor="$background"
        borderBottomWidth={1}
        borderBottomColor="$border"
        style={{ position: "sticky" } as React.CSSProperties}
        top={0}
        zIndex={999}
        shadowColor="$shadowColor"
        shadowOffset={{ width: 0, height: 6 }}
        shadowRadius={isScrolled ? 24 : 0}
        shadowOpacity={isScrolled ? 1 : 0}
        suppressHydrationWarning
      >
        {/* Main bar: logo · search · actions */}
        <Row width="100%" paddingHorizontal="$md" $gtMd={{ paddingHorizontal: "$xl" }}>
          <Row
            width="100%"
            maxWidth={HEADER_MAX_WIDTH}
            marginHorizontal="auto"
            alignItems="center"
            gap="$md"
            height={MOBILE_HEADER_HEIGHT}
            $gtMd={{ gap: "$lg", height: 76 }}
          >
            {/* Logo */}
            <Link
              href="/"
              aria-label="ButterGolf home"
              style={{ display: "flex", alignItems: "center", flexShrink: 0 }}
            >
              <Image
                src="/logo-orange-on-white.svg"
                alt="ButterGolf"
                width={192}
                height={48}
                priority
                style={{ height: 40, width: "auto" }}
              />
            </Link>

            {/* Search - desktop */}
            <Row flex={1} justifyContent="center" display="none" $gtMd={{ display: "flex" }}>
              <HeaderSearch />
            </Row>

            {/* Actions - desktop */}
            <Row
              display="none"
              $gtMd={{ display: "flex" }}
              alignItems="center"
              gap="$sm"
              flexShrink={0}
            >
              <AuthButtonsSection>
                <LazySignedOut>
                  <Button
                    butterVariant="ghost"
                    size="$4"
                    tag="a"
                    href="/sign-in"
                    onPress={linkPress("/sign-in")}
                  >
                    Log in
                  </Button>
                  <Button
                    butterVariant="secondary"
                    size="$4"
                    tag="a"
                    href="/sign-up"
                    onPress={linkPress("/sign-up")}
                  >
                    Sign up
                  </Button>
                </LazySignedOut>

                <LazySignedIn>
                  <Button
                    butterVariant="ghost"
                    circular
                    size={44}
                    aria-label="Wishlist"
                    tag="a"
                    href="/favourites"
                    onPress={linkPress("/favourites")}
                  >
                    <Heart size={20} color="$text" />
                  </Button>
                  <Button
                    butterVariant="ghost"
                    circular
                    size={44}
                    aria-label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : "Messages"}
                    tag="a"
                    href="/messages"
                    onPress={linkPress("/messages")}
                  >
                    <MessageCircle size={20} color="$text" />
                    <UnreadBadge count={unreadCount} />
                  </Button>
                </LazySignedIn>
              </AuthButtonsSection>

              <Button
                butterVariant="primary"
                size="$4"
                icon={Plus}
                tag="a"
                href="/sell"
                onPress={linkPress("/sell")}
              >
                Sell now
              </Button>

              <LazySignedIn>
                <LazyUserButton size="default" />
              </LazySignedIn>

              <AnimatedThemeToggle />
            </Row>

            {/* Actions - mobile */}
            <Row flex={1} $gtMd={{ display: "none" }} />
            <Row alignItems="center" gap="$xs" $gtMd={{ display: "none" }}>
              <Button
                butterVariant="ghost"
                circular
                size={44}
                aria-label="Search"
                onPress={() => setMobileMenuOpen(true)}
              >
                <Search size={22} color="$text" />
              </Button>
              <Button
                butterVariant="ghost"
                circular
                size={44}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
                onPress={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
              </Button>
            </Row>
          </Row>
        </Row>

        {/* Category bar - desktop */}
        <Row
          display="none"
          $gtMd={{ display: "flex" }}
          width="100%"
          paddingHorizontal="$xl"
          borderTopWidth={1}
          borderTopColor="$border"
        >
          <Row width="100%" maxWidth={HEADER_MAX_WIDTH} marginHorizontal="auto">
            <CategorySelector
              categories={NAV_CATEGORIES}
              activeCategory={getActiveCategory()}
              onCategoryChange={(href) => router.push(href)}
            />
          </Row>
        </Row>
      </Column>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <Column
          style={{ position: "fixed" } as React.CSSProperties}
          top={MOBILE_HEADER_HEIGHT}
          left={0}
          right={0}
          bottom={0}
          backgroundColor="$background"
          zIndex={998}
          paddingHorizontal="$lg"
          paddingTop="$md"
          paddingBottom="$2xl"
          gap="$lg"
          overflow="scroll"
          $gtMd={{ display: "none" }}
        >
          <HeaderSearch autoFocus onNavigate={() => setMobileMenuOpen(false)} />

          <Button
            butterVariant="primary"
            size="$5"
            icon={Plus}
            tag="a"
            href="/sell"
            onPress={linkPress("/sell", closeMobileMenu)}
          >
            Sell now
          </Button>

          <Column gap="$xs">
            {MOBILE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{ textDecoration: "none" }}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Row alignItems="center" justifyContent="space-between" minHeight={48}>
                  <Text
                    size="$7"
                    fontWeight={isActive(link.href) ? "700" : "500"}
                    color={isActive(link.href) ? "$primary" : "$text"}
                  >
                    {link.label}
                  </Text>
                  {link.href === "/messages" && unreadCount > 0 && (
                    <Row
                      backgroundColor="$primary"
                      borderRadius="$full"
                      minWidth={22}
                      height={22}
                      alignItems="center"
                      justifyContent="center"
                      paddingHorizontal="$xs"
                    >
                      <Text size="$1" color="$textInverse" fontWeight="700">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </Text>
                    </Row>
                  )}
                </Row>
              </Link>
            ))}
          </Column>

          <Row height={1} backgroundColor="$border" width="100%" />

          {/* Category Navigation - Mobile Only */}
          <Column gap="$xs">
            <Text size="$4" fontWeight="600" color="$textSecondary">
              Shop by category
            </Text>
            {NAV_CATEGORIES.map((category) => (
              <Link
                key={category.href}
                href={category.href}
                style={{ textDecoration: "none" }}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Row minHeight={44} alignItems="center">
                  <Text
                    size="$6"
                    fontWeight={isActive(category.href) ? "700" : "500"}
                    color={isActive(category.href) ? "$primary" : "$text"}
                  >
                    {category.name}
                  </Text>
                </Row>
              </Link>
            ))}
          </Column>

          <Row height={1} backgroundColor="$border" width="100%" />

          <Row alignItems="center" justifyContent="space-between">
            <Text size="$4" fontWeight="600" color="$textSecondary">
              Theme
            </Text>
            <ThemeSwitcher showLabels />
          </Row>

          {/* Mobile Auth */}
          <AuthButtonsSection
            placeholder={
              <Column gap="$sm" width="100%">
                <Row
                  width="100%"
                  height={48}
                  borderRadius="$full"
                  backgroundColor="$backgroundHover"
                />
                <Row
                  width="100%"
                  height={48}
                  borderRadius="$full"
                  backgroundColor="$backgroundHover"
                />
              </Column>
            }
          >
            <LazySignedOut>
              <Column gap="$sm" width="100%">
                <Button
                  butterVariant="secondary"
                  size="$5"
                  tag="a"
                  href="/sign-in"
                  onPress={linkPress("/sign-in", closeMobileMenu)}
                >
                  Log in
                </Button>
                <Button
                  butterVariant="ghost"
                  size="$5"
                  tag="a"
                  href="/sign-up"
                  onPress={linkPress("/sign-up", closeMobileMenu)}
                >
                  Create an account
                </Button>
              </Column>
            </LazySignedOut>

            <LazySignedIn>
              <Row justifyContent="center" paddingVertical="$md">
                <LazyUserButton size="large" />
              </Row>
            </LazySignedIn>
          </AuthButtonsSection>
        </Column>
      )}
    </>
  );
}
