"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Column, Row, Text, Button, Badge, Card } from "@buttergolf/ui";
import { Eye, Heart, Tag, Edit3, Trash2, Zap } from "@tamagui/lucide-icons";
import { PromotionPurchaseSheet } from "./PromotionPurchaseSheet";

export interface SellerProductImage {
  id: string;
  url: string;
  sortOrder: number;
}

export interface SellerProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  brandId: string | null;
  brandName: string | null;
  model: string | null;
  categoryId: string;
  categoryName: string;
  imageUrl: string;
  isSold: boolean;
  isDraft: boolean;
  views: number;
  favourites: number;
  createdAt: string;
  updatedAt: string;
  images: SellerProductImage[];
  offersCount: number;
  pendingOffersCount: number;
}

interface SellerProductCardProps {
  product: SellerProduct;
  onEdit: (product: SellerProduct) => void;
  onDelete: (productId: string) => void;
  onMarkSold: (productId: string) => void;
}

const CONDITION_LABELS: Record<string, string> = {
  NEW: "New",
  LIKE_NEW: "Like New",
  EXCELLENT: "Excellent",
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Poor",
};

/**
 * SellerProductCard Component
 *
 * Displays a seller's product with stats and management actions
 */
export function SellerProductCard({
  product,
  onEdit,
  onDelete,
  onMarkSold,
}: SellerProductCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPromotionSheet, setShowPromotionSheet] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this listing? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(product.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkSold = async () => {
    if (
      !confirm(
        product.isSold ? "Mark this listing as available again?" : "Mark this listing as sold?"
      )
    ) {
      return;
    }

    setIsUpdating(true);
    try {
      await onMarkSold(product.id);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card
      variant="elevated"
      padding="$0"
      overflow="hidden"
      opacity={product.isSold ? 0.7 : product.isDraft ? 0.85 : 1}
    >
      <Column gap="$0">
        {/* Image with status overlay */}
        <div style={{ position: "relative", width: "100%", aspectRatio: "1" }}>
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            style={{ objectFit: "cover" }}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <Button
            chromeless
            size="$3"
            position="absolute"
            top={12}
            right={12}
            width={32}
            height={32}
            minWidth={32}
            padding={0}
            borderRadius="$full"
            backgroundColor="$overlayDark50"
            hoverStyle={{ backgroundColor: "$error" }}
            pressStyle={{ backgroundColor: "$errorDark" }}
            onPress={handleDelete}
            disabled={isDeleting || isUpdating}
            aria-label="Delete listing"
          >
            <Trash2 size={14} color="$textInverse" />
          </Button>
          {product.isSold && (
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 52,
              }}
            >
              <Badge variant="error" size="md">
                SOLD
              </Badge>
            </div>
          )}
          {product.isDraft && !product.isSold && (
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 52,
              }}
            >
              <Badge variant="info" size="md">
                DRAFT
              </Badge>
            </div>
          )}
          {!product.isSold && product.pendingOffersCount > 0 && (
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 52,
              }}
            >
              <Badge variant="warning" size="md">
                {product.pendingOffersCount} Offer
                {product.pendingOffersCount > 1 ? "s" : ""}
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <Column gap="$md" padding="$md">
          {/* Title & Price */}
          <Column gap="$xs">
            <Link
              href={`/products/${product.id}`}
              style={{ textDecoration: "none" }}
              target="_blank"
            >
              <Text
                size="$5"
                weight="semibold"
                color="$text"
                numberOfLines={2}
                hoverStyle={{ color: "$primary" }}
              >
                {product.title}
              </Text>
            </Link>
            <Row gap="$sm" alignItems="center">
              <Text size="$6" weight="bold" color="$primary">
                £{product.price.toFixed(2)}
              </Text>
              <Text size="$3" color="$textSecondary">
                {CONDITION_LABELS[product.condition] || product.condition}
              </Text>
            </Row>
          </Column>

          {/* Stats */}
          <Row gap="$lg" alignItems="center" flexWrap="wrap">
            <Row gap="$xs" alignItems="center">
              <Eye size={16} color="$slateSmoke" />
              <Text size="$3" color="$textSecondary">
                {product.views}
              </Text>
            </Row>
            <Row gap="$xs" alignItems="center">
              <Heart size={16} color="$slateSmoke" />
              <Text size="$3" color="$textSecondary">
                {product.favourites}
              </Text>
            </Row>
            {product.offersCount > 0 && (
              <Row gap="$xs" alignItems="center">
                <Tag size={16} color="$slateSmoke" />
                <Text size="$3" color="$textSecondary">
                  {product.offersCount} offer
                  {product.offersCount > 1 ? "s" : ""}
                </Text>
              </Row>
            )}
          </Row>

          {/* Category & Date */}
          <Row gap="$sm" alignItems="center" flexWrap="wrap">
            <Badge variant="neutral" size="sm">
              {product.categoryName}
            </Badge>
            <Text size="$2" color="$textSecondary">
              Listed {new Date(product.createdAt).toLocaleDateString()}
            </Text>
          </Row>

          {/* Actions */}
          <Row gap="$sm" marginTop="$sm" flexWrap="wrap">
            {/* Boost Button - Only show for active (non-draft) listings */}
            {!product.isSold && !product.isDraft && (
              <Button
                butterVariant="secondary"
                size="$4"
                flex={1}
                onPress={() => setShowPromotionSheet(true)}
                disabled={isDeleting || isUpdating}
              >
                <Row gap="$xs" alignItems="center">
                  <Zap size={14} color="$text" />
                  <Text color="$text" weight="semibold">
                    Boost
                  </Text>
                </Row>
              </Button>
            )}
            {product.isDraft ? (
              <Link
                href={`/sell?draftId=${product.id}`}
                style={{ flex: 1, textDecoration: "none" }}
              >
                <Button butterVariant="primary" size="$4" width="100%" disabled={isDeleting}>
                  <Row gap="$xs" alignItems="center">
                    <Edit3 size={14} color="$textInverse" />
                    <Text color="$textInverse" weight="semibold">
                      Continue Editing
                    </Text>
                  </Row>
                </Button>
              </Link>
            ) : (
              <>
                <Button
                  butterVariant="secondary"
                  size="$4"
                  flex={1}
                  onPress={() => onEdit(product)}
                  disabled={isDeleting || isUpdating}
                >
                  <Row gap="$xs" alignItems="center">
                    <Edit3 size={14} color="$text" />
                    <Text color="$text" weight="semibold">
                      Edit
                    </Text>
                  </Row>
                </Button>
                <Button
                  butterVariant={product.isSold ? "secondary" : "primary"}
                  size="$4"
                  flex={1}
                  onPress={handleMarkSold}
                  disabled={isDeleting || isUpdating}
                >
                  {isUpdating ? "..." : product.isSold ? "Relist" : "Mark Sold"}
                </Button>
              </>
            )}
          </Row>
        </Column>
      </Column>

      {/* Promotion Purchase Sheet */}
      {showPromotionSheet && (
        <PromotionPurchaseSheet
          productId={product.id}
          productTitle={product.title}
          onClose={() => setShowPromotionSheet(false)}
          onSuccess={() => {
            setShowPromotionSheet(false);
            // Optionally refresh the page or update local state
            window.location.reload();
          }}
        />
      )}
    </Card>
  );
}
