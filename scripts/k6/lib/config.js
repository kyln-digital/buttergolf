const DEFAULT_USERS = {
  buyer: {
    clerkId: "user_emma_clerk_id",
    firstName: "Emma",
    lastName: "Williams",
    email: "emma.williams@example.com",
  },
  seller: {
    clerkId: "user_sarah_clerk_id",
    firstName: "Sarah",
    lastName: "Johnson",
    email: "sarah.johnson@example.com",
  },
  secondBuyer: {
    clerkId: "user_mike_clerk_id",
    firstName: "Mike",
    lastName: "Chen",
    email: "mike.chen@example.com",
  },
};

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return value === "true" || value === "1" || value === "yes";
}

function env(name, fallback = "") {
  const value = __ENV[name];
  return value === undefined || value === null || value === "" ? fallback : value;
}

function userFromEnv(role, defaults) {
  const prefix = `K6_${role.toUpperCase()}`;
  return {
    clerkId: env(`${prefix}_CLERK_ID`, defaults.clerkId),
    firstName: env(`${prefix}_FIRST_NAME`, defaults.firstName),
    lastName: env(`${prefix}_LAST_NAME`, defaults.lastName),
    email: env(`${prefix}_EMAIL`, defaults.email),
    dbId: env(`${prefix}_DB_ID`, ""),
  };
}

function isProductionUrl(baseUrl) {
  return /(^https:\/\/)?(www\.)?buttergolf\.com\/?$/i.test(baseUrl);
}

function assertSafeWriteTarget(config) {
  const writesRequested =
    config.enableWrites || config.enableUploads || config.enableStripe || config.enableWebhooks;

  if (!writesRequested) return;

  if (isProductionUrl(config.baseUrl) && !config.allowProductionWrites) {
    throw new Error(
      "Refusing to run mutating k6 scenarios against production. Set K6_ALLOW_PRODUCTION_WRITES=true only for an explicitly approved run."
    );
  }
}

export function getConfig() {
  const baseUrl = trimTrailingSlash(env("K6_BASE_URL", "http://localhost:3000"));
  const mobileSessionSecret = env(
    "K6_MOBILE_SESSION_SECRET",
    env(
      "MOBILE_SESSION_SECRET",
      env("STRIPE_SECRET_KEY", "dev-secret-key-minimum-32-chars!").slice(0, 32)
    )
  );

  const config = {
    baseUrl,
    stage: env("K6_STAGE", env("K6_PROFILE", "smoke")),
    profile: env("K6_PROFILE", "smoke"),
    runId: env("K6_RUN_ID", `k6-${Date.now()}`),
    userAgent: env("K6_USER_AGENT", "ButterGolf k6 suite/1.0"),
    mobileSessionSecret,
    users: {
      buyer: userFromEnv("buyer", DEFAULT_USERS.buyer),
      seller: userFromEnv("seller", DEFAULT_USERS.seller),
      secondBuyer: userFromEnv("second_buyer", DEFAULT_USERS.secondBuyer),
    },
    enableWrites: parseBoolean(env("K6_ENABLE_WRITES"), false),
    enableUploads: parseBoolean(env("K6_ENABLE_UPLOADS"), false),
    enableStripe: parseBoolean(env("K6_ENABLE_STRIPE"), false),
    enableShipping: parseBoolean(env("K6_ENABLE_SHIPPING"), false),
    enableWebhooks: parseBoolean(env("K6_ENABLE_WEBHOOKS"), false),
    allowProductionWrites: parseBoolean(env("K6_ALLOW_PRODUCTION_WRITES"), false),
    stripeWebhookSecret: env("K6_STRIPE_WEBHOOK_SECRET", env("STRIPE_WEBHOOK_SECRET")),
    stripeConnectWebhookSecret: env(
      "K6_STRIPE_CONNECT_WEBHOOK_SECRET",
      env("STRIPE_CONNECT_WEBHOOK_SECRET", env("STRIPE_WEBHOOK_SECRET"))
    ),
    clerkWebhookSecret: env("K6_CLERK_WEBHOOK_SECRET", env("CLERK_WEBHOOK_SECRET")),
    shipengineWebhookSecret: env("K6_SHIPENGINE_WEBHOOK_SECRET", env("SHIPENGINE_WEBHOOK_SECRET")),
    fixedProductId: env("K6_PRODUCT_ID"),
    fixedConversationId: env("K6_CONVERSATION_ID"),
    fixedOrderId: env("K6_ORDER_ID"),
  };

  assertSafeWriteTarget(config);
  return config;
}

export function isEnabled(value) {
  return parseBoolean(value, false);
}
