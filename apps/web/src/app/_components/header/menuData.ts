import { CATEGORIES } from "@buttergolf/db";

export interface MenuItem {
  title: string;
  path?: string;
  submenu?: MenuItem[];
}

// Define which categories should be featured at the top level
const TOP_LEVEL_CATEGORIES = new Set(["drivers", "irons", "wedges", "putters"]);

// Generate menu data dynamically from centralized categories
export const menuData: MenuItem[] = [
  {
    title: "Shop All",
    path: "/listings",
  },
  // Add top-level featured categories
  ...CATEGORIES.filter((cat) => TOP_LEVEL_CATEGORIES.has(cat.slug)).map((cat) => ({
    title: cat.name,
    path: `/category/${cat.slug}`,
  })),
  // Group remaining categories under "More Categories"
  {
    title: "More Categories",
    submenu: CATEGORIES.filter((cat) => !TOP_LEVEL_CATEGORIES.has(cat.slug)).map((cat) => ({
      title: cat.name,
      path: `/category/${cat.slug}`,
    })),
  },
];
