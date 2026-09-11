"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge, Column, Row, Text } from "@buttergolf/ui";
import {
  AlertTriangle,
  BookOpen,
  LayoutDashboard,
  Mail,
  Package,
  ScrollText,
  ShoppingBag,
  Users,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { href: "/admin/users", label: "Users", icon: <Users size={18} /> },
  { href: "/admin/orders", label: "Orders", icon: <ShoppingBag size={18} /> },
  { href: "/admin/issues", label: "Issues", icon: <AlertTriangle size={18} /> },
  { href: "/admin/listings", label: "Listings", icon: <Package size={18} /> },
  { href: "/admin/reference", label: "Reference data", icon: <BookOpen size={18} /> },
  { href: "/admin/marketing", label: "Marketing", icon: <Mail size={18} /> },
  { href: "/admin/audit", label: "Audit log", icon: <ScrollText size={18} /> },
];

interface AdminShellProps {
  viewer: { name: string; role: "SUPPORT" | "ADMIN" };
  children: React.ReactNode;
}

/**
 * Sidebar + content frame for every /admin page. Same shape as the seller
 * dashboard so staff who also sell find it familiar.
 */
export function AdminShell({ viewer, children }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <Row fullWidth minHeight="calc(100vh - 80px)" alignItems="stretch">
      <Column
        gap="$xs"
        padding="$md"
        backgroundColor="$surface"
        borderRightWidth={1}
        borderRightColor="$border"
        minWidth={220}
      >
        <Column paddingHorizontal="$md" paddingVertical="$sm" gap="$xs">
          <Text size="$2" color="$textSecondary" fontWeight="600">
            ADMIN PORTAL
          </Text>
          <Row gap="$xs" alignItems="center" flexWrap="wrap">
            <Text size="$4" color="$text" numberOfLines={1}>
              {viewer.name}
            </Text>
            <Badge variant={viewer.role === "ADMIN" ? "primary" : "info"} size="sm">
              {viewer.role}
            </Badge>
          </Row>
        </Column>

        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
              <Row
                gap="$sm"
                alignItems="center"
                paddingHorizontal="$md"
                paddingVertical="$sm"
                borderRadius="$md"
                backgroundColor={isActive ? "$primaryLight" : "transparent"}
                hoverStyle={{ backgroundColor: "$backgroundHover" }}
                cursor="pointer"
              >
                <Text color={isActive ? "$primary" : "$textSecondary"}>{item.icon}</Text>
                <Text
                  size="$4"
                  color={isActive ? "$primary" : "$text"}
                  fontWeight={isActive ? "600" : "400"}
                >
                  {item.label}
                </Text>
              </Row>
            </Link>
          );
        })}
      </Column>

      <Column flex={1} padding="$lg" backgroundColor="$background" gap="$lg" minWidth={0}>
        {children}
      </Column>
    </Row>
  );
}
