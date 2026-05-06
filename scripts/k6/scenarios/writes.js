import { check, group, sleep } from "k6";
import encoding from "k6/encoding";
import { authHeaders } from "../lib/auth.js";
import { deleteRequest, postJson, putJson, rawPost, safeJson } from "../lib/http.js";
import { money, uniqueSuffix } from "../lib/random.js";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

function requireWriteFlag(config) {
  if (!config.enableWrites) {
    console.warn("K6_ENABLE_WRITES is not true; skipping write flows.");
    return false;
  }
  return true;
}

function createProduct(config, data, sellerHeaders) {
  if (!data.category?.id || !data.brand?.id) {
    console.warn("Skipping product creation because category or brand fixture is missing.");
    return null;
  }

  const suffix = uniqueSuffix(config);
  const payload = {
    title: `k6 load test driver ${suffix}`,
    description:
      "Automated k6 staging listing. Safe to delete. Used for load testing marketplace write paths.",
    price: 129.99,
    brandId: data.brand.id,
    model: "Stealth 2",
    clubKind: "DRIVER",
    categoryId: data.category.id,
    images: ["https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800"],
    flex: "Regular",
    loft: "10.5",
    gripCondition: 8,
    headCondition: 8,
    shaftCondition: 8,
    length: 120,
    width: 16,
    height: 16,
    weight: 2,
    requestId: suffix,
    isDraft: false,
  };

  const response = postJson(config, "/api/products", payload, {
    route: "/api/products:create",
    routeGroup: "write",
    headers: sellerHeaders,
    expectedStatuses: [200, 201, 400, 401, 404, 500],
    timeout: "45s",
  });
  const product = safeJson(response, null);

  check(response, {
    "product create succeeded when writes are enabled": (result) =>
      [200, 201].includes(result.status),
  });

  return product && product.id ? product : null;
}

function createDraftProduct(config, data, sellerHeaders) {
  const payload = {
    title: `k6 draft ${uniqueSuffix(config)}`,
    price: 0,
    categoryId: data.category?.id,
    images: [],
    requestId: uniqueSuffix(config),
    isDraft: true,
  };

  postJson(config, "/api/products", payload, {
    route: "/api/products:create-draft",
    routeGroup: "write",
    headers: sellerHeaders,
    expectedStatuses: [200, 201, 400, 401, 404, 500],
    timeout: "45s",
  });
}

function exerciseFavourites(config, productId, buyerHeaders) {
  if (!productId) return;

  postJson(
    config,
    "/api/favourites",
    { productId },
    {
      route: "/api/favourites:add",
      routeGroup: "write",
      headers: buyerHeaders,
      expectedStatuses: [201, 409, 401, 404],
    }
  );

  deleteRequest(config, `/api/favourites/${productId}`, {
    route: "/api/favourites/[productId]:delete",
    routeGroup: "write",
    headers: buyerHeaders,
    expectedStatuses: [200, 401, 404],
  });
}

function exerciseAddresses(config, buyerHeaders) {
  const suffix = uniqueSuffix(config);
  const payload = {
    name: `K6 Buyer ${suffix}`,
    firstName: "K6",
    lastName: "Buyer",
    street1: "1 Load Test Lane",
    city: "London",
    state: "Greater London",
    zip: "SW1A 1AA",
    country: "GB",
    phone: "+447700900123",
    isDefault: false,
  };

  const response = postJson(config, "/api/addresses", payload, {
    route: "/api/addresses:create",
    routeGroup: "write",
    headers: buyerHeaders,
    expectedStatuses: [201, 400, 401, 404, 500],
  });
  const address = safeJson(response, null);

  if (address?.id) {
    putJson(
      config,
      `/api/addresses/${address.id}`,
      { ...payload, city: "Manchester" },
      {
        route: "/api/addresses/[id]:update",
        routeGroup: "write",
        headers: buyerHeaders,
        expectedStatuses: [200, 400, 401, 403, 404, 500],
      }
    );

    postJson(
      config,
      `/api/addresses/${address.id}/default`,
      {},
      {
        route: "/api/addresses/[id]/default",
        routeGroup: "write",
        headers: buyerHeaders,
        expectedStatuses: [200, 400, 401, 403, 404, 500],
      }
    );
  }
}

function exerciseConversation(config, productId, buyerHeaders, sellerHeaders) {
  if (!productId) return null;

  const response = postJson(
    config,
    "/api/conversations",
    { productId },
    {
      route: "/api/conversations:create",
      routeGroup: "write",
      headers: buyerHeaders,
      expectedStatuses: [200, 400, 401, 404, 500],
    }
  );
  const payload = safeJson(response, null);
  const conversationId = payload?.conversationId;

  if (!conversationId) return null;

  postJson(
    config,
    `/api/conversations/${conversationId}/messages`,
    {
      content: `k6 message ${uniqueSuffix(config)}`,
    },
    {
      route: "/api/conversations/[id]/messages:create",
      routeGroup: "write",
      headers: buyerHeaders,
      expectedStatuses: [201, 200, 400, 401, 403, 404, 429, 500],
    }
  );

  const offerAmount = money(129.99 * 0.7);
  const offerResponse = postJson(
    config,
    `/api/conversations/${conversationId}/offer`,
    {
      amount: offerAmount,
    },
    {
      route: "/api/conversations/[id]/offer:create",
      routeGroup: "write",
      headers: buyerHeaders,
      expectedStatuses: [201, 400, 401, 403, 404, 409, 429, 500],
    }
  );

  if ([200, 201].includes(offerResponse.status)) {
    postJson(
      config,
      `/api/conversations/${conversationId}/offer/counter`,
      {
        amount: money(129.99 * 0.8),
        message: "k6 buyer counter path",
      },
      {
        route: "/api/conversations/[id]/offer/counter",
        routeGroup: "write",
        headers: buyerHeaders,
        expectedStatuses: [201, 400, 401, 403, 404, 429, 500],
      }
    );

    postJson(
      config,
      `/api/conversations/${conversationId}/offer/reject`,
      {},
      {
        route: "/api/conversations/[id]/offer/reject",
        routeGroup: "write",
        headers: sellerHeaders,
        expectedStatuses: [200, 400, 401, 403, 404, 500],
      }
    );
  }

  return conversationId;
}

function exerciseCheckoutAndShipping(config, productId, buyerHeaders) {
  if (!productId) return;

  if (config.enableShipping) {
    postJson(
      config,
      "/api/shipping/calculate",
      {
        productId,
        toAddress: {
          name: "K6 Buyer",
          street1: "1 Load Test Lane",
          city: "London",
          state: "Greater London",
          zip: "SW1A 1AA",
          country: "GB",
          phone: "+447700900123",
        },
      },
      {
        route: "/api/shipping/calculate:post",
        routeGroup: "write",
        expectedStatuses: [200, 400, 404, 500],
        timeout: "45s",
      }
    );
  }

  if (!config.enableStripe) return;

  postJson(
    config,
    "/api/checkout/create-payment-intent",
    {
      productId,
      shippingOptionId: "standard",
    },
    {
      route: "/api/checkout/create-payment-intent",
      routeGroup: "write",
      headers: buyerHeaders,
      expectedStatuses: [200, 400, 401, 404, 500],
      timeout: "45s",
    }
  );

  postJson(
    config,
    "/api/checkout/create-checkout-session",
    { productId },
    {
      route: "/api/checkout/create-checkout-session",
      routeGroup: "write",
      headers: buyerHeaders,
      expectedStatuses: [200, 400, 401, 404, 500],
      timeout: "45s",
    }
  );
}

function exerciseUpload(config, sellerHeaders) {
  if (!config.enableUploads) return;

  const imageBytes = encoding.b64decode(TINY_PNG_BASE64, "std", "b");
  rawPost(
    config,
    `/api/upload?filename=${encodeURIComponent(`k6-${uniqueSuffix(config)}.png`)}&isFirstImage=false`,
    imageBytes,
    {
      route: "/api/upload",
      routeGroup: "write",
      headers: {
        ...sellerHeaders,
        "Content-Type": "image/png",
      },
      expectedStatuses: [200, 400, 401, 500],
      timeout: "60s",
    }
  );
}

export function runWriteFlows(data) {
  const config = data.config;
  if (!requireWriteFlag(config)) return;

  const buyerHeaders = authHeaders(config, "buyer");
  const sellerHeaders = authHeaders(config, "seller");

  group("write flow setup", () => {
    createDraftProduct(config, data, sellerHeaders);
  });

  const createdProduct = group("product and marketplace writes", () => {
    const product = createProduct(config, data, sellerHeaders);
    const productId = product?.id || data.product?.id;

    exerciseFavourites(config, productId, buyerHeaders);
    exerciseAddresses(config, buyerHeaders);
    exerciseConversation(config, productId, buyerHeaders, sellerHeaders);
    exerciseCheckoutAndShipping(config, productId, buyerHeaders);
    exerciseUpload(config, sellerHeaders);

    return product;
  });

  if (!createdProduct) {
    console.warn(
      "Write flow did not create a product; downstream write coverage may have used setup fixtures only."
    );
  }

  sleep(Math.random() * 3 + 1);
}
