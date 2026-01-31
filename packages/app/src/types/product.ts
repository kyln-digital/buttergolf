export interface ProductImage {
  url: string;
  alt?: string;
}

export interface ProductUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
}

export interface ProductBrand {
  id: string;
  name: string;
}

export type ProductCondition = "NEW" | "LIKE_NEW" | "EXCELLENT" | "GOOD" | "FAIR" | "POOR";

export interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  condition: ProductCondition | null;
  model: string | null;
  images: ProductImage[];
  user: ProductUser;
  category: ProductCategory;
  brand: ProductBrand | null;
  // Golf-specific fields
  flex: string | null;
  loft: string | null;
  woodsSubcategory: string | null;
  headCoverIncluded: boolean | null;
  gripCondition: number | null;
  headCondition: number | null;
  shaftCondition: number | null;
  // Shipping dimensions
  length: number | null;
  width: number | null;
  height: number | null;
  weight: number | null;
  // Status
  isSold: boolean;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

export type PromotionType = "BUMP" | "PRO_SHOP_FEATURE";

export interface ProductCardData {
  id: string;
  title: string;
  price: number;
  condition: ProductCondition | null;
  imageUrl: string;
  category: string;
  seller: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    averageRating: number | null;
    ratingCount: number;
  };
  // Promotion fields
  activePromotion?: {
    type: PromotionType;
    expiresAt: Date;
  } | null;
}
