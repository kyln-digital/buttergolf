"use client";

import { useState, useEffect, useCallback } from "react";
import { Column, Row, Heading, Text, Button, Input, Card } from "@buttergolf/ui";
import { useTheme } from "tamagui";
import { LISTING_PRICE_LIMITS, getListingPriceBoundsMessage } from "@buttergolf/constants";
import { ImageUpload } from "@/components/ImageUpload";
import type { SellerProduct, SellerProductImage } from "./SellerProductCard";

export interface ProductSavePayload extends Omit<Partial<SellerProduct>, "images"> {
  images: { url: string; sortOrder: number }[];
  removedImageIds: string[];
}

interface EditProductModalProps {
  product: SellerProduct;
  onClose: () => void;
  onSave: (productId: string, updates: ProductSavePayload) => Promise<void>;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
}

const CONDITIONS = [
  { value: "NEW", label: "Brand New" },
  { value: "LIKE_NEW", label: "Like New" },
  { value: "EXCELLENT", label: "Excellent" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
];

/**
 * EditProductModal Component
 *
 * Inline modal for editing product details
 */
export function EditProductModal({ product, onClose, onSave }: EditProductModalProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  // Image state: current URLs for display, mapping URL→DB id for existing images, removed DB ids
  const [imageUrls, setImageUrls] = useState<string[]>(
    product.images.map((img: SellerProductImage) => img.url)
  );
  const [imageIdMap] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const img of product.images) {
      map.set(img.url, img.id);
    }
    return map;
  });
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);

  const handleImageUploadComplete = useCallback((url: string) => {
    setImageUrls((prev) => [...prev, url]);
  }, []);

  const handleRemoveImage = useCallback(
    (index: number) => {
      setImageUrls((prev) => {
        const url = prev[index];
        if (url) {
          const dbId = imageIdMap.get(url);
          if (dbId) {
            setRemovedImageIds((ids) => [...ids, dbId]);
          }
        }
        return prev.filter((_, i) => i !== index);
      });
    },
    [imageIdMap]
  );

  const handleReorderImages = useCallback((urls: string[]) => {
    setImageUrls(urls);
  }, []);

  const [formData, setFormData] = useState({
    title: product.title,
    description: product.description,
    price: product.price.toString(),
    condition: product.condition,
    brandId: product.brandId || "",
    model: product.model || "",
    categoryId: product.categoryId,
  });

  // Load categories and brands on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [categoriesRes, brandsRes] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/brands"),
        ]);

        if (!categoriesRes.ok) {
          throw new Error(`Failed to load categories: ${categoriesRes.status}`);
        }
        if (!brandsRes.ok) {
          throw new Error(`Failed to load brands: ${brandsRes.status}`);
        }

        const categoriesData = await categoriesRes.json();
        const brandsData = await brandsRes.json();

        if (!Array.isArray(categoriesData)) {
          throw new Error("Categories data is not an array");
        }
        if (!Array.isArray(brandsData)) {
          throw new Error("Brands data is not an array");
        }

        setCategories(categoriesData);
        setBrands(brandsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load categories or brands");
        setCategories([]);
        setBrands([]);
      }
    }
    void loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate required fields
    if (
      !formData.title ||
      !formData.description ||
      !formData.price ||
      !formData.categoryId ||
      !formData.brandId
    ) {
      setError("Please fill in all required fields");
      setLoading(false);
      return;
    }

    try {
      const parsedPrice = Number.parseFloat(formData.price);
      if (
        Number.isNaN(parsedPrice) ||
        parsedPrice < LISTING_PRICE_LIMITS.MIN ||
        parsedPrice > LISTING_PRICE_LIMITS.MAX
      ) {
        setError(getListingPriceBoundsMessage());
        setLoading(false);
        return;
      }

      if (imageUrls.length === 0) {
        setError("Please add at least one image");
        setLoading(false);
        return;
      }

      await onSave(product.id, {
        ...formData,
        price: parsedPrice,
        images: imageUrls.map((url, i) => ({ url, sortOrder: i })),
        removedImageIds,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <Card
        variant="elevated"
        padding="$0"
        maxWidth={600}
        width="100%"
        maxHeight="90vh"
        style={{ overflow: "auto" }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <Column gap="$0" width="100%">
            {/* Header */}
            <Column gap="$sm" padding="$lg" borderBottomWidth={1} borderBottomColor="$border">
              <Row alignItems="center" justifyContent="space-between">
                <Heading level={3}>Edit Listing</Heading>
                <Button size="$3" chromeless onPress={onClose}>
                  ✕
                </Button>
              </Row>
            </Column>

            {/* Form Fields */}
            <Column gap="$lg" padding="$lg">
              {/* Images */}
              <Column gap="$xs">
                <Text weight="medium">Photos *</Text>
                <ImageUpload
                  onUploadComplete={handleImageUploadComplete}
                  onRemoveImage={handleRemoveImage}
                  onReorderImages={handleReorderImages}
                  maxImages={5}
                  currentImages={imageUrls}
                />
              </Column>

              {/* Title */}
              <Column gap="$xs">
                <Text weight="medium">Title *</Text>
                <Input
                  value={formData.title}
                  onChangeText={(value) => setFormData({ ...formData, title: value })}
                  placeholder="e.g., TaylorMade Stealth 2 Driver"
                  size="$4"
                  required
                />
              </Column>

              {/* Description */}
              <Column gap="$xs">
                <Text weight="medium">Description *</Text>
                {/* eslint-disable-next-line react/forbid-elements */}
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the condition, any wear, included accessories..."
                  required
                  rows={4}
                  style={{
                    padding: "12px 18px",
                    fontSize: "15px",
                    borderRadius: "24px",
                    border: `1px solid ${theme.fieldBorder.val}`,
                    backgroundColor: theme.surface.val,
                    color: theme.text.val,
                    width: "100%",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </Column>

              {/* Price & Condition */}
              <Row gap="$md" flexWrap="wrap">
                <Column gap="$xs" flex={1} minWidth={200}>
                  <Text weight="medium">Price (£) *</Text>
                  <Input
                    value={formData.price}
                    onChangeText={(value) => setFormData({ ...formData, price: value })}
                    placeholder="0.00"
                    size="$4"
                    inputMode="decimal"
                    min={LISTING_PRICE_LIMITS.MIN}
                    max={LISTING_PRICE_LIMITS.MAX}
                    required
                  />
                  <Text size="$2" color="$textSecondary">
                    GBP {LISTING_PRICE_LIMITS.MIN} - GBP {LISTING_PRICE_LIMITS.MAX}
                  </Text>
                </Column>

                <Column gap="$xs" flex={1} minWidth={200}>
                  <Text weight="medium">Condition *</Text>
                  {/* eslint-disable-next-line react/forbid-elements */}
                  <select
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    style={{
                      height: 40,
                      paddingLeft: 16,
                      paddingRight: 40,
                      fontSize: 15,
                      fontFamily: "inherit",
                      fontWeight: 500,
                      borderRadius: 24,
                      border: "1px solid var(--color-ironstone)",
                      backgroundColor: "white",
                      color: "var(--color-ironstone)",
                      cursor: "pointer",
                      width: "100%",
                      outline: "none",
                      appearance: "none",
                      WebkitAppearance: "none",
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(theme.text.val)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 16px center",
                    }}
                  >
                    <option value="" disabled selected>
                      Select condition
                    </option>
                    {CONDITIONS.map((cond) => (
                      <option key={cond.value} value={cond.value}>
                        {cond.label}
                      </option>
                    ))}
                  </select>
                </Column>
              </Row>

              {/* Brand */}
              <Column gap="$xs">
                <Text weight="medium">Brand *</Text>
                {/* eslint-disable-next-line react/forbid-elements */}
                <select
                  value={formData.brandId}
                  onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                  style={{
                    height: 40,
                    paddingLeft: 16,
                    paddingRight: 40,
                    fontSize: 15,
                    fontFamily: "inherit",
                    fontWeight: 500,
                    borderRadius: 24,
                    border: `1px solid ${theme.fieldBorder.val}`,
                    backgroundColor: theme.surface.val,
                    color: theme.text.val,
                    cursor: "pointer",
                    width: "100%",
                    outline: "none",
                    appearance: "none",
                    WebkitAppearance: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(theme.text.val)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 16px center",
                  }}
                >
                  <option value="" disabled selected>
                    Select a brand
                  </option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </Column>

              {/* Model */}
              <Column gap="$xs">
                <Text weight="medium">Model</Text>
                <Input
                  value={formData.model}
                  onChangeText={(value) => setFormData({ ...formData, model: value })}
                  placeholder="e.g., Stealth 2, Apex 21"
                  size="$4"
                />
              </Column>

              {/* Category */}
              <Column gap="$xs">
                <Text weight="medium">Category *</Text>
                {/* eslint-disable-next-line react/forbid-elements */}
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  style={{
                    height: 40,
                    paddingLeft: 16,
                    paddingRight: 40,
                    fontSize: 15,
                    fontFamily: "inherit",
                    fontWeight: 500,
                    borderRadius: 24,
                    border: `1px solid ${theme.fieldBorder.val}`,
                    backgroundColor: theme.surface.val,
                    color: theme.text.val,
                    cursor: "pointer",
                    width: "100%",
                    outline: "none",
                    appearance: "none",
                    WebkitAppearance: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(theme.text.val)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 16px center",
                  }}
                >
                  <option value="" disabled selected>
                    Select a category
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Column>

              {/* Error Message */}
              {error && (
                <Card variant="filled" padding="$sm" backgroundColor="$errorLight">
                  <Text color="$error" size="$3">
                    {error}
                  </Text>
                </Card>
              )}
            </Column>

            {/* Footer Actions */}
            <Column gap="$sm" padding="$lg" borderTopWidth={1} borderTopColor="$border">
              <Row gap="$sm" justifyContent="flex-end">
                <Button size="$4" chromeless onPress={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button butterVariant="primary" size="$4" disabled={loading}>
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </Row>
            </Column>
          </Column>
        </form>
      </Card>
    </div>
  );
}
