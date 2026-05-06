import { group, sleep } from "k6";
import { getHtml, getJson, expectJsonArray, expectJsonObject } from "../lib/http.js";
import { randomItem } from "../lib/random.js";

const SEARCH_TERMS = ["driver", "putter", "titleist", "taylormade", "bag", "wedge"];
const SORTS = ["newest", "price-asc", "price-desc", "popular"];
const CONDITIONS = ["NEW", "LIKE_NEW", "EXCELLENT", "GOOD"];

export function runPublicBrowse(data) {
  const config = data.config;
  const category = data.category;
  const brand = data.brand;
  const product = randomItem(data.products, data.product);
  const searchTerm = randomItem(SEARCH_TERMS, "driver");
  const sort = randomItem(SORTS, "newest");
  const condition = randomItem(CONDITIONS, "EXCELLENT");

  group("public pages", () => {
    getHtml(config, "/", { route: "/", routeGroup: "public", expectedStatuses: [200] });
    getHtml(config, "/listings", {
      route: "/listings",
      routeGroup: "public",
      expectedStatuses: [200],
    });

    if (category?.slug) {
      getHtml(config, `/category/${category.slug}`, {
        route: "/category/[slug]",
        routeGroup: "public",
        expectedStatuses: [200, 404],
      });
    }

    if (product?.id) {
      getHtml(config, `/products/${product.id}`, {
        route: "/products/[id]",
        routeGroup: "public",
        expectedStatuses: [200, 404],
      });
    }

    getHtml(config, "/privacy-policy", {
      route: "/privacy-policy",
      routeGroup: "public",
      expectedStatuses: [200],
    });
    getHtml(config, "/terms-of-service", {
      route: "/terms-of-service",
      routeGroup: "public",
      expectedStatuses: [200],
    });
    getHtml(config, "/help-centre", {
      route: "/help-centre",
      routeGroup: "public",
      expectedStatuses: [200, 404],
    });
  });

  group("public discovery APIs", () => {
    const categoriesResponse = getJson(config, "/api/categories", {
      route: "/api/categories",
      routeGroup: "public",
      expectedStatuses: [200],
    });
    expectJsonArray(categoriesResponse, "/api/categories");

    const brandsResponse = getJson(config, "/api/brands", {
      route: "/api/brands",
      routeGroup: "public",
      expectedStatuses: [200],
    });
    expectJsonArray(brandsResponse, "/api/brands");

    getJson(config, "/api/brands", {
      query: { query: searchTerm.slice(0, 3) },
      route: "/api/brands?query",
      routeGroup: "public",
      expectedStatuses: [200],
    });

    if (brand?.id) {
      getJson(config, "/api/models", {
        query: { brandId: brand.id, kind: "DRIVER", query: searchTerm },
        route: "/api/models",
        routeGroup: "public",
        expectedStatuses: [200],
      });
    }

    const listingsResponse = getJson(config, "/api/listings", {
      query: {
        page: 1 + Math.floor(Math.random() * 2),
        limit: 24,
        sort,
        q: searchTerm,
        condition,
        category: category?.slug,
        brand: brand?.id,
        minPrice: 25,
        maxPrice: 900,
      },
      route: "/api/listings:filtered",
      routeGroup: "public",
      expectedStatuses: [200],
    });
    expectJsonObject(listingsResponse, "/api/listings:filtered");

    const searchResponse = getJson(config, "/api/search", {
      query: { q: searchTerm, limit: 10 },
      route: "/api/search",
      routeGroup: "public",
      expectedStatuses: [200],
    });
    expectJsonObject(searchResponse, "/api/search");

    getJson(config, "/api/products/recent", {
      query: { limit: 12 },
      route: "/api/products/recent",
      routeGroup: "public",
      expectedStatuses: [200],
    });

    if (product?.id) {
      getJson(config, `/api/products/${product.id}`, {
        route: "/api/products/[id]",
        routeGroup: "public",
        expectedStatuses: [200, 404],
      });
      getJson(config, `/api/products/${product.id}/similar`, {
        route: "/api/products/[id]/similar",
        routeGroup: "public",
        expectedStatuses: [200, 404],
      });
    }
  });

  group("seo and redirects", () => {
    getHtml(config, "/buying", {
      route: "/buying",
      routeGroup: "public",
      expectedStatuses: [200, 307, 308],
    });
    getJson(config, "/server-sitemap.xml", {
      route: "/server-sitemap.xml",
      routeGroup: "public",
      accept: "application/xml,text/xml,*/*",
      expectedStatuses: [200, 404],
    });
  });

  sleep(Math.random() * 2 + 1);
}
