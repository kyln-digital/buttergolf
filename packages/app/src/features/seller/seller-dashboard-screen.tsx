"use client";

import React from "react";
import { Column, Row, Text, Button, Heading, ScrollView, Spinner, View } from "@buttergolf/ui";
import {
  ArrowLeft,
  Package,
  DollarSign,
  TrendingUp,
  Clock,
  ChevronRight,
  Plus,
  ShoppingBag,
  Settings,
  CreditCard,
  Star,
} from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SellerStats {
  totalSales: number;
  totalEarnings: number;
  pendingPayouts: number;
  activeListings: number;
  soldItems: number;
  pendingOrders: number;
  averageRating: number;
  totalRatings: number;
}

export interface SellerDashboardScreenProps {
  /** Seller statistics */
  stats?: SellerStats | null;
  /** Whether data is loading */
  loading?: boolean;
  /** Error message if any */
  error?: string | null;
  /** Navigate to list a new item */
  onListItem: () => void;
  /** Navigate to manage sales */
  onViewSales: () => void;
  /** Navigate to manage listings */
  onViewListings: () => void;
  /** Navigate to Stripe Connect payments */
  onViewPayments: () => void;
  /** Navigate to Stripe Connect payouts */
  onViewPayouts: () => void;
  /** Navigate to seller settings */
  onViewSettings: () => void;
  /** Navigate back */
  onBack: () => void;
  /** Reload data */
  onRefresh?: () => void;
}

type StatColorToken = "$primary" | "$success" | "$warning" | "$secondary" | "$error" | "$text";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: StatColorToken;
  onPress?: () => void;
}

function StatCard({ label, value, icon, color = "$primary", onPress }: StatCardProps) {
  const content = (
    <Column
      backgroundColor="$surface"
      borderRadius="$lg"
      borderWidth={1}
      borderColor="$border"
      padding="$4"
      flex={1}
      minWidth={150}
    >
      <Row alignItems="center" gap="$2" marginBottom="$2">
        {icon}
        <Text size="$3" color="$textSecondary">
          {label}
        </Text>
      </Row>
      <Text size="$7" fontWeight="700" color={color}>
        {value}
      </Text>
    </Column>
  );

  if (onPress) {
    return (
      <Button unstyled flex={1} minWidth={150} pressStyle={{ opacity: 0.8 }} onPress={onPress}>
        {content}
      </Button>
    );
  }

  return content;
}

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}

function QuickAction({ icon, label, onPress }: QuickActionProps) {
  return (
    <Button
      unstyled
      backgroundColor="$surface"
      borderRadius="$lg"
      borderWidth={1}
      borderColor="$border"
      padding="$4"
      pressStyle={{ backgroundColor: "$backgroundPress", scale: 0.98 }}
      onPress={onPress}
    >
      <Row alignItems="center" gap="$3">
        <View
          width={44}
          height={44}
          borderRadius="$full"
          backgroundColor="$primaryLight"
          alignItems="center"
          justifyContent="center"
        >
          {icon}
        </View>
        <Text size="$4" fontWeight="500" flex={1}>
          {label}
        </Text>
        <ChevronRight size={20} color="$textMuted" />
      </Row>
    </Button>
  );
}

export function SellerDashboardScreen({
  stats,
  loading = false,
  error = null,
  onListItem,
  onViewSales,
  onViewListings,
  onViewPayments,
  onViewPayouts,
  onViewSettings,
  onBack,
  onRefresh,
}: Readonly<SellerDashboardScreenProps>) {
  const insets = useSafeAreaInsets();

  // Loading state
  if (loading) {
    return (
      <Column
        flex={1}
        backgroundColor="$background"
        alignItems="center"
        justifyContent="center"
        paddingTop={insets.top}
      >
        <Spinner size="lg" color="$primary" />
        <Text color="$textSecondary" marginTop="$3">
          Loading dashboard...
        </Text>
      </Column>
    );
  }

  // Error state
  if (error) {
    return (
      <Column flex={1} backgroundColor="$background" paddingTop={insets.top}>
        <Row
          paddingHorizontal="$4"
          paddingVertical="$3"
          alignItems="center"
          gap="$3"
          borderBottomWidth={1}
          borderBottomColor="$border"
        >
          <Button
            chromeless
            circular
            size="$4"
            onPress={onBack}
            icon={<ArrowLeft size={24} color="$text" />}
          />
          <Heading level={4}>Seller Dashboard</Heading>
        </Row>
        <Column flex={1} alignItems="center" justifyContent="center" padding="$4">
          <Text color="$error" size="$5" textAlign="center" marginBottom="$4">
            {error}
          </Text>
          {onRefresh && (
            <Button butterVariant="primary" size="$4" onPress={onRefresh}>
              Try Again
            </Button>
          )}
        </Column>
      </Column>
    );
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount / 100);

  return (
    <Column flex={1} backgroundColor="$background" paddingTop={insets.top}>
      {/* Header */}
      <Row
        paddingHorizontal="$4"
        paddingVertical="$3"
        alignItems="center"
        gap="$3"
        borderBottomWidth={1}
        borderBottomColor="$border"
      >
        <Button
          chromeless
          circular
          size="$4"
          onPress={onBack}
          icon={<ArrowLeft size={24} color="$text" />}
        />
        <Heading level={4} flex={1}>
          Seller Dashboard
        </Heading>
        <Button
          chromeless
          circular
          size="$4"
          onPress={onViewSettings}
          icon={<Settings size={24} color="$text" />}
        />
      </Row>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 16,
        }}
      >
        {/* List New Item CTA */}
        <Button
          butterVariant="primary"
          size="$5"
          width="100%"
          onPress={onListItem}
          marginBottom="$4"
          icon={<Plus size={20} color="$textInverse" />}
        >
          List a New Item
        </Button>

        {/* Stats Grid */}
        <Row flexWrap="wrap" gap="$3" marginBottom="$6">
          <StatCard
            label="Total Sales"
            value={stats?.totalSales ?? 0}
            icon={<ShoppingBag size={18} color="$primary" />}
            onPress={onViewSales}
          />
          <StatCard
            label="Total Earnings"
            value={formatCurrency(stats?.totalEarnings ?? 0)}
            icon={<DollarSign size={18} color="$success" />}
            color="$success"
          />
          <StatCard
            label="Pending Payouts"
            value={formatCurrency(stats?.pendingPayouts ?? 0)}
            icon={<Clock size={18} color="$warning" />}
            color="$warning"
            onPress={onViewPayouts}
          />
          <StatCard
            label="Active Listings"
            value={stats?.activeListings ?? 0}
            icon={<Package size={18} color="$secondary" />}
            onPress={onViewListings}
          />
        </Row>

        {/* Rating Summary */}
        {stats && stats.totalRatings > 0 && (
          <Column
            backgroundColor="$surface"
            borderRadius="$lg"
            borderWidth={1}
            borderColor="$border"
            padding="$4"
            marginBottom="$6"
          >
            <Row alignItems="center" gap="$2" marginBottom="$2">
              <Star size={20} color="$warning" fill="$warning" />
              <Text size="$4" fontWeight="600">
                Seller Rating
              </Text>
            </Row>
            <Row alignItems="baseline" gap="$2">
              <Text size="$8" fontWeight="700" color="$text">
                {stats.averageRating.toFixed(1)}
              </Text>
              <Text size="$3" color="$textSecondary">
                / 5.0 ({stats.totalRatings} {stats.totalRatings === 1 ? "review" : "reviews"})
              </Text>
            </Row>
            <Row gap="$1" marginTop="$2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={16}
                  color={star <= Math.round(stats.averageRating) ? "$warning" : "$textMuted"}
                  fill={star <= Math.round(stats.averageRating) ? "$warning" : "transparent"}
                />
              ))}
            </Row>
          </Column>
        )}

        {/* Pending Orders Alert */}
        {stats && stats.pendingOrders > 0 && (
          <Button
            unstyled
            backgroundColor="$warningLight"
            borderRadius="$lg"
            borderWidth={1}
            borderColor="$warning"
            padding="$4"
            marginBottom="$4"
            pressStyle={{ opacity: 0.8 }}
            onPress={onViewSales}
          >
            <Row alignItems="center" gap="$3">
              <Clock size={24} color="$warning" />
              <Column flex={1}>
                <Text size="$4" fontWeight="600" color="$warning">
                  {stats.pendingOrders} Pending {stats.pendingOrders === 1 ? "Order" : "Orders"}
                </Text>
                <Text size="$3" color="$text">
                  Items awaiting shipment
                </Text>
              </Column>
              <ChevronRight size={20} color="$warning" />
            </Row>
          </Button>
        )}

        {/* Quick Actions */}
        <Column gap="$3" marginBottom="$4">
          <Text size="$3" color="$textSecondary" fontWeight="600" marginLeft="$2" marginBottom="$1">
            QUICK ACTIONS
          </Text>

          <QuickAction
            icon={<ShoppingBag size={22} color="$primary" />}
            label="Manage Sales"
            onPress={onViewSales}
          />

          <QuickAction
            icon={<Package size={22} color="$primary" />}
            label="My Listings"
            onPress={onViewListings}
          />

          <QuickAction
            icon={<CreditCard size={22} color="$primary" />}
            label="Payments & Payouts"
            onPress={onViewPayments}
          />
        </Column>

        {/* Performance Summary (optional future expansion) */}
        <Column
          backgroundColor="$gray100"
          borderRadius="$lg"
          padding="$4"
          alignItems="center"
          gap="$2"
        >
          <TrendingUp size={24} color="$textMuted" />
          <Text size="$3" color="$textSecondary" textAlign="center">
            Performance analytics coming soon
          </Text>
        </Column>
      </ScrollView>
    </Column>
  );
}
