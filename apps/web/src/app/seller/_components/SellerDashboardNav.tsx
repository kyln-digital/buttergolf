"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Column, Text, Row } from "@buttergolf/ui";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  CreditCard,
  Wallet,
  FileText,
  Settings,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: "/seller",
    label: "Dashboard",
    icon: <LayoutDashboard size={20} />,
  },
  {
    href: "/seller/sales",
    label: "Sales",
    icon: <ShoppingBag size={20} />,
  },
  {
    href: "/seller/listings",
    label: "Listings",
    icon: <Package size={20} />,
  },
  {
    href: "/seller/payments",
    label: "Payments",
    icon: <CreditCard size={20} />,
  },
  {
    href: "/seller/payouts",
    label: "Payouts",
    icon: <Wallet size={20} />,
  },
  {
    href: "/seller/documents",
    label: "Documents",
    icon: <FileText size={20} />,
  },
  {
    href: "/seller/settings",
    label: "Settings",
    icon: <Settings size={20} />,
  },
];

/**
 * Seller Dashboard Navigation
 *
 * Sidebar navigation for the seller dashboard with links to:
 * - Dashboard (overview)
 * - Listings (product management)
 * - Payments (transactions, disputes via ConnectPayments)
 * - Payouts (balance, payouts via ConnectBalances/Payouts)
 * - Documents (tax documents via ConnectDocuments)
 * - Settings (account management via ConnectAccountManagement)
 */
export function SellerDashboardNav() {
  const pathname = usePathname();

  return (
    <Column
      gap="$xs"
      padding="$md"
      backgroundColor="$surface"
      borderRightWidth={1}
      borderRightColor="$border"
      minWidth={220}
      height="100%"
    >
      <Text
        size="$3"
        color="$textSecondary"
        fontWeight="600"
        paddingHorizontal="$sm"
        paddingVertical="$md"
      >
        SELLER DASHBOARD
      </Text>

      {navItems.map((item) => {
        // Check if this is the active route
        const isActive =
          item.href === "/seller" ? pathname === "/seller" : pathname?.startsWith(item.href);

        return (
          <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
            <Row
              gap="$sm"
              paddingHorizontal="$md"
              paddingVertical="$sm"
              borderRadius="$md"
              alignItems="center"
              backgroundColor={isActive ? "$primaryLight" : "transparent"}
              hoverStyle={{
                backgroundColor: isActive ? "$primaryLight" : "$cloudMist",
              }}
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
  );
}
