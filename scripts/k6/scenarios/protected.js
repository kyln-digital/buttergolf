import { group, sleep } from "k6";
import { authHeaders } from "../lib/auth.js";
import { getHtml, getJson, expectJsonObject } from "../lib/http.js";

export function runProtectedReads(data) {
  const config = data.config;
  const buyerHeaders = authHeaders(config, "buyer");
  const sellerHeaders = authHeaders(config, "seller");
  const conversation = data.conversation;
  const order = data.order;
  const product = data.product;

  group("protected page shells", () => {
    getHtml(config, "/account", {
      route: "/account",
      routeGroup: "protected",
      headers: buyerHeaders,
      expectedStatuses: [200, 302, 307, 308],
    });
    getHtml(config, "/orders", {
      route: "/orders",
      routeGroup: "protected",
      headers: buyerHeaders,
      expectedStatuses: [200, 302, 307, 308],
    });
    getHtml(config, "/messages", {
      route: "/messages",
      routeGroup: "protected",
      headers: buyerHeaders,
      expectedStatuses: [200, 302, 307, 308],
    });
    getHtml(config, "/favourites", {
      route: "/favourites",
      routeGroup: "protected",
      headers: buyerHeaders,
      expectedStatuses: [200, 302, 307, 308],
    });
    getHtml(config, "/seller/listings", {
      route: "/seller/listings",
      routeGroup: "protected",
      headers: sellerHeaders,
      expectedStatuses: [200, 302, 307, 308],
    });
  });

  group("protected marketplace APIs", () => {
    const sellerStatusResponse = getJson(config, "/api/users/seller-status", {
      route: "/api/users/seller-status",
      routeGroup: "protected",
      headers: buyerHeaders,
      expectedStatuses: [200],
    });
    expectJsonObject(sellerStatusResponse, "/api/users/seller-status");

    getJson(config, "/api/orders", {
      query: { role: "all" },
      route: "/api/orders",
      routeGroup: "protected",
      headers: buyerHeaders,
      expectedStatuses: [200, 404],
    });

    getJson(config, "/api/conversations", {
      query: { page: 1, limit: 20 },
      route: "/api/conversations",
      routeGroup: "protected",
      headers: buyerHeaders,
      expectedStatuses: [200, 404],
    });

    getJson(config, "/api/conversations/unread-count", {
      route: "/api/conversations/unread-count",
      routeGroup: "protected",
      headers: buyerHeaders,
      expectedStatuses: [200, 404],
    });

    getJson(config, "/api/favourites", {
      query: { page: 1, limit: 24 },
      route: "/api/favourites",
      routeGroup: "protected",
      headers: buyerHeaders,
      expectedStatuses: [200, 404],
    });

    getJson(config, "/api/listings", {
      query: { favourites: "true", page: 1, limit: 24 },
      route: "/api/listings?favourites=true",
      routeGroup: "protected",
      headers: buyerHeaders,
      expectedStatuses: [200, 401],
    });

    getJson(config, "/api/addresses", {
      route: "/api/addresses",
      routeGroup: "protected",
      headers: buyerHeaders,
      expectedStatuses: [200, 404],
    });

    getJson(config, "/api/seller/listings", {
      query: { page: 1, limit: 12, status: "all", sort: "newest" },
      route: "/api/seller/listings",
      routeGroup: "protected",
      headers: sellerHeaders,
      expectedStatuses: [200, 404],
    });

    if (conversation?.id) {
      getJson(config, `/api/conversations/${conversation.id}/messages`, {
        query: { limit: 50 },
        route: "/api/conversations/[id]/messages",
        routeGroup: "protected",
        headers: buyerHeaders,
        expectedStatuses: [200, 403, 404],
      });
      getHtml(config, `/messages/${conversation.id}`, {
        route: "/messages/[conversationId]",
        routeGroup: "protected",
        headers: buyerHeaders,
        expectedStatuses: [200, 302, 307, 308, 404],
      });
    }

    if (order?.id) {
      getJson(config, `/api/orders/${order.id}`, {
        route: "/api/orders/[id]",
        routeGroup: "protected",
        headers: buyerHeaders,
        expectedStatuses: [200, 403, 404],
      });
      getHtml(config, `/orders/${order.id}`, {
        route: "/orders/[id]",
        routeGroup: "protected",
        headers: buyerHeaders,
        expectedStatuses: [200, 302, 307, 308, 404],
      });
    }

    if (product?.id) {
      getJson(config, "/api/shipping/calculate", {
        query: { productId: product.id, postcode: "SW1A1AA" },
        route: "/api/shipping/calculate:get",
        routeGroup: "protected",
        expectedStatuses: [200, 400, 404, 500],
      });
    }
  });

  sleep(Math.random() * 2 + 1);
}

export function runUnauthenticatedChecks(data) {
  const config = data.config;

  group("unauthenticated negative checks", () => {
    getJson(config, "/api/orders", {
      route: "/api/orders:unauthenticated",
      routeGroup: "protected",
      expectedStatuses: [401],
      redirects: 0,
    });
    getJson(config, "/api/conversations", {
      route: "/api/conversations:unauthenticated",
      routeGroup: "protected",
      expectedStatuses: [401],
      redirects: 0,
    });
    getJson(config, "/api/favourites", {
      route: "/api/favourites:unauthenticated",
      routeGroup: "protected",
      expectedStatuses: [401],
      redirects: 0,
    });
    getJson(config, "/api/listings", {
      query: { favourites: "true" },
      route: "/api/listings:favourites-unauthenticated",
      routeGroup: "protected",
      expectedStatuses: [401],
      redirects: 0,
    });
  });
}
