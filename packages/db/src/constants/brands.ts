/**
 * Golf Brands for ButterGolf Marketplace
 *
 * Top golf brands across all equipment categories
 */

export interface BrandDefinition {
  name: string;
  slug: string;
  logoUrl?: string;
  sortOrder: number;
}

export const BRANDS: BrandDefinition[] = [
  // Top Tier Brands (most popular)
  { name: "TaylorMade", slug: "taylormade", sortOrder: 1 },
  { name: "Callaway", slug: "callaway", sortOrder: 2 },
  { name: "Titleist", slug: "titleist", sortOrder: 3 },
  { name: "Ping", slug: "ping", sortOrder: 4 },
  { name: "Cobra", slug: "cobra", sortOrder: 5 },

  // Premium Brands
  { name: "Mizuno", slug: "mizuno", sortOrder: 6 },
  { name: "Srixon", slug: "srixon", sortOrder: 7 },
  { name: "Cleveland", slug: "cleveland", sortOrder: 8 },
  { name: "Wilson", slug: "wilson", sortOrder: 9 },
  { name: "Odyssey", slug: "odyssey", sortOrder: 10 },

  // Specialty Brands
  { name: "FootJoy", slug: "footjoy", sortOrder: 11 },
  { name: "Sun Mountain", slug: "sun-mountain", sortOrder: 12 },
  { name: "Scotty Cameron", slug: "scotty-cameron", sortOrder: 13 },
  { name: "L.A.B. Golf", slug: "lab-golf", sortOrder: 14 },
  { name: "PXG", slug: "pxg", sortOrder: 15 },
  { name: "Nike Golf", slug: "nike-golf", sortOrder: 16 },
  { name: "Adidas Golf", slug: "adidas-golf", sortOrder: 17 },
  { name: "Under Armour", slug: "under-armour", sortOrder: 18 },

  // Additional Quality Brands
  { name: "Bridgestone", slug: "bridgestone", sortOrder: 19 },
  { name: "Adams", slug: "adams", sortOrder: 20 },
  { name: "Tour Edge", slug: "tour-edge", sortOrder: 21 },
  { name: "Ben Hogan", slug: "ben-hogan", sortOrder: 22 },
  { name: "MacGregor", slug: "macgregor", sortOrder: 23 },
  { name: "Tommy Armour", slug: "tommy-armour", sortOrder: 24 },
  { name: "Lynx", slug: "lynx", sortOrder: 25 },
  { name: "Honma", slug: "honma", sortOrder: 26 },

  // Ball & Apparel Brands
  { name: "Vice", slug: "vice", sortOrder: 27 },
  { name: "Volvik", slug: "volvik", sortOrder: 28 },
  { name: "Maxfli", slug: "maxfli", sortOrder: 29 },
  { name: "Nike", slug: "nike", sortOrder: 30 },
  { name: "Adidas", slug: "adidas", sortOrder: 31 },

  // Budget/Value Brands
  { name: "Top Flite", slug: "top-flite", sortOrder: 32 },
  { name: "Wilson Staff", slug: "wilson-staff", sortOrder: 33 },
  { name: "Dunlop", slug: "dunlop", sortOrder: 34 },
];
