/**
 * Centralized Category Definitions for ButterGolf
 *
 * This file serves as the single source of truth for all product categories
 * across the platform (web, mobile, database seeding, etc.)
 *
 * This package is Prisma-free and safe to import in React Native.
 *
 * When adding a new category:
 * 1. Add it to the CATEGORIES array below
 * 2. Run `pnpm db:seed` to update the database
 * 3. The category will automatically appear in dropdowns and filters
 */

export interface CategoryDefinition {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
}

/**
 * All product categories available on the platform.
 * These are used for:
 * - Database seeding (packages/db/prisma/seed.ts)
 * - Category dropdowns (sell page, filters, etc.)
 * - Navigation and routing
 * - Product categorization
 */
export const CATEGORIES: readonly CategoryDefinition[] = [
  {
    name: "Woods",
    slug: "woods",
    description: "Drivers, fairway woods, and hybrids",
    imageUrl: "/_assets/images/woods.webp",
    sortOrder: 1,
  },
  {
    name: "Irons",
    slug: "irons",
    description: "Iron sets and individual irons",
    imageUrl: "/_assets/images/irons.webp",
    sortOrder: 2,
  },
  {
    name: "Wedges",
    slug: "wedges",
    description: "Pitching, sand, lob, and gap wedges",
    imageUrl: "/_assets/images/wedges.webp",
    sortOrder: 3,
  },
  {
    name: "Putters",
    slug: "putters",
    description: "Putters of all styles",
    imageUrl: "/_assets/images/putters.webp",
    sortOrder: 4,
  },
  {
    name: "Bags",
    slug: "bags",
    description: "Golf bags and travel covers",
    imageUrl: "/_assets/images/bags.webp",
    sortOrder: 5,
  },
  {
    name: "Balls",
    slug: "balls",
    description: "Golf balls",
    imageUrl: "/_assets/images/balls.webp",
    sortOrder: 6,
  },
  {
    name: "Apparel",
    slug: "apparel",
    description: "Golf clothing and shoes",
    imageUrl: "/_assets/images/apparel.webp",
    sortOrder: 7,
  },
  {
    name: "Accessories",
    slug: "accessories",
    description: "Golf accessories, gloves, tees, and more",
    imageUrl: "/_assets/images/accessories.webp",
    sortOrder: 8,
  },
  {
    name: "Training Aids",
    slug: "training-aids",
    description: "Training aids and practice equipment",
    imageUrl: "/_assets/images/trainingaids.webp",
    sortOrder: 9,
  },
] as const;

/**
 * Get category by slug
 */
export function getCategoryBySlug(slug: string): CategoryDefinition | undefined {
  return CATEGORIES.find((cat) => cat.slug === slug);
}

/**
 * Get category by name (case-insensitive)
 */
export function getCategoryByName(name: string): CategoryDefinition | undefined {
  return CATEGORIES.find((cat) => cat.name.toLowerCase() === name.toLowerCase());
}

/**
 * Get all category slugs (useful for routing)
 */
export function getCategorySlugs(): string[] {
  return CATEGORIES.map((cat) => cat.slug);
}

/**
 * Get all category names
 */
export function getCategoryNames(): string[] {
  return CATEGORIES.map((cat) => cat.name);
}

/**
 * Validate if a slug is a valid category
 */
export function isValidCategorySlug(slug: string): boolean {
  return CATEGORIES.some((cat) => cat.slug === slug);
}
