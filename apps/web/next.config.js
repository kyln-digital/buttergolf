const { withTamagui } = require("@tamagui/next-plugin");
const { join, resolve } = require("node:path");
const { PrismaPlugin } = require("@prisma/nextjs-monorepo-workaround-plugin");

// Bundle analyzer for debugging bundle sizes
// Run with: ANALYZE=true pnpm build
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const boolVals = {
  true: true,
  false: false,
};

// Keep style extraction enabled in all environments unless explicitly disabled
// Set DISABLE_EXTRACTION=true to opt out (useful when debugging compiler output)
const disableExtraction = boolVals[process.env.DISABLE_EXTRACTION] ?? false;

const plugins = [
  withTamagui({
    config: "../../packages/config/src/tamagui.config.ts",
    components: ["tamagui", "@buttergolf/ui"],
    appDir: true,
    outputCSS: process.env.NODE_ENV === "production" ? "./public/tamagui.css" : null,
    logTimings: true,
    disableExtraction,
    // Disable debug attributes to prevent hydration warnings
    // These are only useful for deep debugging of Tamagui compiler output
    useReactNativeWebLite: false,
    disableDebugAttr: true,
    shouldExtract: (path) => {
      if (path.includes(join("packages", "app"))) {
        return true;
      }
    },
    excludeReactNativeWebExports: ["Switch", "ProgressBar", "Picker", "CheckBox", "Touchable"],
  }),
];

// Security headers (CSP removed - adds maintenance burden with minimal security benefit
// given we use 'unsafe-inline' and trusted third-parties like Clerk/Stripe)
const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
];

module.exports = () => {
  /** @type {import('next').NextConfig} */
  let config = {
    typescript: {
      // !! WARN !!
      // Temporarily disable type checking during build due to React 19 + Tamagui compatibility issues
      // This should be resolved when Tamagui updates its types for React 19
      ignoreBuildErrors: true,
    },
    // Explicitly trace Prisma binaries from custom monorepo location
    // Required for Vercel deployment with custom Prisma output path
    // Paths are relative to outputFileTracingRoot (monorepo root)
    outputFileTracingIncludes: {
      "/api/**": ["./packages/db/generated/client/**/*", "./packages/db/prisma/schema.prisma"],
      // Include for all server-side code
      "/**": ["./packages/db/generated/client/**/*"],
    },
    // Set tracing root to monorepo root for proper workspace resolution
    // (moved out of `experimental.outputFileTracingRoot` — Next.js expects this at top-level)
    outputFileTracingRoot: join(__dirname, "../../"),
    // Prevent Next.js from bundling Prisma Client (breaks native binaries)
    // Essential for monorepo setups with custom Prisma output paths
    serverExternalPackages: ["@buttergolf/db", "@prisma/client"],
    // Security and caching headers
    headers: async () => [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: [
          ...securityHeaders,
          // Disable caching in development
          ...(process.env.NODE_ENV === "development"
            ? [{ key: "Cache-Control", value: "no-store, must-revalidate" }]
            : []),
        ],
      },
    ],
    // Proxy Clerk Frontend API requests through our domain (production only)
    // Only active when NEXT_PUBLIC_CLERK_PROXY_URL is set — preview deployments
    // skip the proxy so clerk.buttergolf.com doesn't reject their redirect URLs.
    // See: https://clerk.com/docs/deployments/clerk-cname-proxy
    rewrites: async () =>
      process.env.NEXT_PUBLIC_CLERK_PROXY_URL
        ? [
            {
              source: "/__clerk/:path*",
              destination: "https://clerk.buttergolf.com/:path*",
            },
          ]
        : [],
    transpilePackages: [
      "@buttergolf/app",
      "@buttergolf/config",
      "@buttergolf/ui",
      "react-native-web",
      "react-native",
      "solito",
      "expo-linking",
      "expo-constants",
      "expo-modules-core",
      "tamagui",
      "@tamagui/core",
      "@tamagui/web",
      "@tamagui/animations-react-native",
      "@tamagui/animations-css",
      "@tamagui/card",
      "@tamagui/toast",
      "@tamagui/next-theme",
      "@tamagui/sheet",
      "@tamagui/portal",
      "@tamagui/polyfill-dev",
      "@tamagui/form",
    ],
    experimental: {
      scrollRestoration: true,
      // Allow Server Actions to work with dev tunnels and port forwarding
      serverActions: {
        allowedOrigins: ["localhost:3000", "ttdr3bz5-3000.uks1.devtunnels.ms"],
      },
    },
    // Allow dev server access from local network devices (mobile testing, etc.)
    allowedDevOrigins: [
      "192.168.1.41:3000", // Add your local network IP
    ],
    images: {
      remotePatterns: [
        {
          protocol: "https",
          hostname: "res.cloudinary.com",
        },
        {
          protocol: "https",
          hostname: "images.unsplash.com",
        },
      ],
    },
    webpack: (webpackConfig, { isServer }) => {
      // Add PrismaPlugin to copy Prisma binaries into serverless bundle
      // Required for monorepo deployments on Vercel with custom Prisma output path
      if (isServer) {
        webpackConfig.plugins = [...webpackConfig.plugins, new PrismaPlugin()];
      }

      // Map React Native to React Native Web for web builds
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        "react-native$": "react-native-web",
        // Enforce a single instance of 'tamagui' at runtime to avoid
        // "Haven't called createTamagui yet" errors caused by duplicate module instances
        tamagui: require.resolve("tamagui"),
        // Enforce single instance of @tamagui/core to prevent "Missing theme" errors
        // when @tamagui/form or other packages try to create their own context
        "@tamagui/core": require.resolve("@tamagui/core"),
        "@tamagui/web": require.resolve("@tamagui/web"),
        // Explicit alias for @tamagui/polyfill-dev to fix webpack resolution in pnpm monorepo
        "@tamagui/polyfill-dev": require.resolve("@tamagui/polyfill-dev"),
        // Enforce single instance of config to prevent "Missing theme" errors from duplicate modules
        "@buttergolf/config": resolve(__dirname, "../../packages/config/src/tamagui.config.ts"),
      };

      // Add .web.ts/.web.tsx extensions for platform-specific files (React Native pattern)
      // This enables hooks like useTheme to have web-specific implementations
      webpackConfig.resolve.extensions = [
        ".web.tsx",
        ".web.ts",
        ".web.js",
        ...webpackConfig.resolve.extensions,
      ];

      return webpackConfig;
    },
  };

  for (const plugin of plugins) {
    config = {
      ...config,
      ...plugin(config),
    };
  }

  // Apply bundle analyzer last (wrap the entire config)
  return withBundleAnalyzer(config);
};

// Injected content via Sentry wizard below

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(module.exports, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "rwxt",
  project: "buttergolf",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
