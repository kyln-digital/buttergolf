import { getConfig } from "./config.js";
import { authHeaders } from "./auth.js";
import { getJson, safeJson } from "./http.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstProductFromListings(payload) {
  if (!payload || !Array.isArray(payload.products)) return null;
  return payload.products[0] || null;
}

function getFirstConversation(payload) {
  if (!payload || !Array.isArray(payload.conversations)) return null;
  return payload.conversations[0] || null;
}

function getFirstOrder(payload) {
  return Array.isArray(payload) ? payload[0] || null : null;
}

function getFirstSellerProduct(payload) {
  if (!payload || !Array.isArray(payload.products)) return null;
  return payload.products[0] || null;
}

function syncUser(config, role) {
  return getJson(config, "/api/users/seller-status", {
    route: `/api/users/seller-status:${role}`,
    routeGroup: "protected",
    headers: authHeaders(config, role),
    expectedStatuses: [200, 401, 404, 500],
  });
}

export function prepareFixtures() {
  const config = getConfig();

  console.info(`[k6] Preparing fixtures for ${config.profile} against ${config.baseUrl}`);

  const categoriesResponse = getJson(config, "/api/categories", {
    route: "/api/categories",
    routeGroup: "public",
    expectedStatuses: [200],
  });
  const categories = asArray(safeJson(categoriesResponse, []));
  const category =
    categories.find((entry) => entry.slug === "woods") ||
    categories.find((entry) => entry.slug === "irons") ||
    categories[0] ||
    null;

  const brandsResponse = getJson(config, "/api/brands", {
    route: "/api/brands",
    routeGroup: "public",
    expectedStatuses: [200],
  });
  const brands = asArray(safeJson(brandsResponse, []));
  const brand =
    brands.find((entry) => entry.slug === "taylormade") ||
    brands.find((entry) => entry.slug === "titleist") ||
    brands[0] ||
    null;

  const listingsResponse = getJson(config, "/api/listings", {
    query: { page: 1, limit: 12, sort: "newest" },
    route: "/api/listings:fixture",
    routeGroup: "public",
    expectedStatuses: [200],
  });
  const listings = safeJson(listingsResponse, {});
  const listingProducts = Array.isArray(listings.products) ? listings.products : [];
  const product = config.fixedProductId
    ? { id: config.fixedProductId }
    : firstProductFromListings(listings);

  const recentProductsResponse = getJson(config, "/api/products/recent", {
    query: { limit: 12 },
    route: "/api/products/recent:fixture",
    routeGroup: "public",
    expectedStatuses: [200],
  });
  const recentProducts = asArray(safeJson(recentProductsResponse, []));

  const modelsResponse = brand
    ? getJson(config, "/api/models", {
        query: { brandId: brand.id, kind: "DRIVER", query: "stealth" },
        route: "/api/models:fixture",
        routeGroup: "public",
        expectedStatuses: [200, 400],
      })
    : null;
  const models = modelsResponse ? asArray(safeJson(modelsResponse, [])) : [];

  syncUser(config, "buyer");
  syncUser(config, "seller");
  syncUser(config, "secondBuyer");

  const buyerHeaders = authHeaders(config, "buyer");
  const sellerHeaders = authHeaders(config, "seller");

  const conversationsResponse = getJson(config, "/api/conversations", {
    query: { page: 1, limit: 5 },
    route: "/api/conversations:fixture",
    routeGroup: "protected",
    headers: buyerHeaders,
    expectedStatuses: [200, 401, 404],
  });
  const conversationsPayload = safeJson(conversationsResponse, {});

  const ordersResponse = getJson(config, "/api/orders", {
    query: { role: "all" },
    route: "/api/orders:fixture",
    routeGroup: "protected",
    headers: buyerHeaders,
    expectedStatuses: [200, 401, 404],
  });
  const ordersPayload = safeJson(ordersResponse, []);

  const sellerListingsResponse = getJson(config, "/api/seller/listings", {
    query: { page: 1, limit: 5, status: "all" },
    route: "/api/seller/listings:fixture",
    routeGroup: "protected",
    headers: sellerHeaders,
    expectedStatuses: [200, 401, 404],
  });
  const sellerListingsPayload = safeJson(sellerListingsResponse, {});

  return {
    config,
    category,
    categories,
    brand,
    brands,
    models,
    product,
    products: listingProducts.length > 0 ? listingProducts : recentProducts,
    conversation: config.fixedConversationId
      ? { id: config.fixedConversationId }
      : getFirstConversation(conversationsPayload),
    order: config.fixedOrderId ? { id: config.fixedOrderId } : getFirstOrder(ordersPayload),
    sellerProduct: getFirstSellerProduct(sellerListingsPayload),
    setupDiagnostics: {
      categories: categories.length,
      brands: brands.length,
      products: listingProducts.length,
      recentProducts: recentProducts.length,
      conversations: Array.isArray(conversationsPayload.conversations)
        ? conversationsPayload.conversations.length
        : 0,
      orders: Array.isArray(ordersPayload) ? ordersPayload.length : 0,
      sellerProducts: Array.isArray(sellerListingsPayload.products)
        ? sellerListingsPayload.products.length
        : 0,
    },
  };
}
