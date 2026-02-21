"use client";

import { useState, useEffect } from "react";
import { Column, Row, Heading, Text, Card, Spinner, Button } from "@buttergolf/ui";
import { Package, Eye, Heart, DollarSign, TrendingUp, AlertCircle } from "@tamagui/lucide-icons";
import Link from "next/link";

interface SellerStats {
  totalListings: number;
  activeListings: number;
  soldListings: number;
  totalViews: number;
  totalFavourites: number;
  pendingOffers: number;
}

/**
 * Seller Dashboard Overview
 *
 * Main landing page for the seller dashboard showing:
 * - Key stats (listings, views, favorites, pending offers)
 * - Quick action buttons
 * - Recent activity summary
 */
export default function SellerDashboardPage() {
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const response = await fetch("/api/seller/listings?limit=1");

        if (!response.ok) {
          throw new Error("Failed to fetch seller stats");
        }

        const data = await response.json();
        setStats(data.stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <Column fullWidth alignItems="center" justifyContent="center" minHeight={400}>
        <Spinner size="lg" color="$primary" />
        <Text color="$textSecondary" marginTop="$md">
          Loading dashboard...
        </Text>
      </Column>
    );
  }

  if (error) {
    return (
      <Column fullWidth alignItems="center" justifyContent="center" minHeight={400}>
        <AlertCircle size={48} color="$error" />
        <Text color="$error" marginTop="$md">
          {error}
        </Text>
      </Column>
    );
  }

  return (
    <Column gap="$xl" fullWidth>
      {/* Header */}
      <Row alignItems="center" justifyContent="space-between" fullWidth>
        <Column gap="$xs">
          <Heading level={1}>Seller Dashboard</Heading>
          <Text color="$textSecondary">Manage your listings, payments, and payouts</Text>
        </Column>
        <Link href="/sell">
          <Button butterVariant="primary" size="$4">
            + New Listing
          </Button>
        </Link>
      </Row>

      {/* Stats Grid */}
      <Row gap="$md" flexWrap="wrap" fullWidth>
        <StatCard
          title="Active Listings"
          value={stats?.activeListings ?? 0}
          icon={<Package size={24} color="$primary" />}
          href="/seller/listings"
        />
        <StatCard
          title="Total Views"
          value={stats?.totalViews ?? 0}
          icon={<Eye size={24} color="$info" />}
        />
        <StatCard
          title="Favorites"
          value={stats?.totalFavourites ?? 0}
          icon={<Heart size={24} color="$error" />}
        />
        <StatCard
          title="Pending Offers"
          value={stats?.pendingOffers ?? 0}
          icon={<DollarSign size={24} color="$success" />}
          href="/offers"
        />
      </Row>

      {/* Quick Actions */}
      <Column gap="$md">
        <Heading level={3}>Quick Actions</Heading>
        <Row gap="$md" flexWrap="wrap">
          <QuickActionCard
            title="View Payments"
            description="See your transaction history and manage disputes"
            href="/seller/payments"
            icon={<DollarSign size={24} />}
          />
          <QuickActionCard
            title="Manage Payouts"
            description="View your balance and payout schedule"
            href="/seller/payouts"
            icon={<TrendingUp size={24} />}
          />
          <QuickActionCard
            title="Account Settings"
            description="Update your bank account and business info"
            href="/seller/settings"
            icon={<Package size={24} />}
          />
        </Row>
      </Column>

      {/* Performance Summary */}
      <Card variant="elevated" padding="$lg">
        <Column gap="$md">
          <Heading level={3}>Performance Summary</Heading>
          <Row gap="$xl" flexWrap="wrap">
            <Column gap="$xs">
              <Text size="$3" color="$textSecondary">
                Total Listings
              </Text>
              <Text size="$7" fontWeight="bold">
                {stats?.totalListings ?? 0}
              </Text>
            </Column>
            <Column gap="$xs">
              <Text size="$3" color="$textSecondary">
                Sold Items
              </Text>
              <Text size="$7" fontWeight="bold" color="$success">
                {stats?.soldListings ?? 0}
              </Text>
            </Column>
            <Column gap="$xs">
              <Text size="$3" color="$textSecondary">
                Conversion Rate
              </Text>
              <Text size="$7" fontWeight="bold">
                {stats?.totalListings
                  ? `${((stats.soldListings / stats.totalListings) * 100).toFixed(1)}%`
                  : "0%"}
              </Text>
            </Column>
          </Row>
        </Column>
      </Card>
    </Column>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  href?: string;
}

function StatCard({ title, value, icon, href }: StatCardProps) {
  const content = (
    <Card
      variant="elevated"
      padding="$lg"
      flex={1}
      minWidth={200}
      hoverStyle={href ? { backgroundColor: "$cloudMist" } : undefined}
    >
      <Row alignItems="center" justifyContent="space-between">
        <Column gap="$xs">
          <Text size="$3" color="$textSecondary">
            {title}
          </Text>
          <Text size="$9" fontWeight="bold">
            {value.toLocaleString()}
          </Text>
        </Column>
        {icon}
      </Row>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} style={{ flex: 1, minWidth: 200, textDecoration: "none" }}>
        {content}
      </Link>
    );
  }

  return content;
}

interface QuickActionCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

function QuickActionCard({ title, description, href, icon }: QuickActionCardProps) {
  return (
    <Link href={href} style={{ flex: 1, minWidth: 250, textDecoration: "none" }}>
      <Card
        variant="outlined"
        padding="$md"
        hoverStyle={{ backgroundColor: "$cloudMist", borderColor: "$primary" }}
      >
        <Row gap="$md" alignItems="center">
          <Text color="$primary">{icon}</Text>
          <Column gap="$xs" flex={1}>
            <Text size="$4" fontWeight="600">
              {title}
            </Text>
            <Text size="$3" color="$textSecondary">
              {description}
            </Text>
          </Column>
        </Row>
      </Card>
    </Link>
  );
}
