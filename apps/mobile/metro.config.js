// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Monorepo root
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

// Singleton packages that must resolve to single instance
// These are hoisted to monorepo root via .npmrc public-hoist-pattern
const singletonPackages = [
  "react",
  "react-native",
  "react-dom",
  "@tamagui/core",
  "@tamagui/web",
  "tamagui",
];

// Build extraNodeModules to force resolution from monorepo root
const extraNodeModules = {};
singletonPackages.forEach((pkg) => {
  try {
    const pkgPath = path.dirname(require.resolve(`${pkg}/package.json`, { paths: [monorepoRoot] }));
    extraNodeModules[pkg] = pkgPath;
  } catch {
    // Package not found, skip
  }
});

// Configure SVG support with react-native-svg-transformer
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer"),
};

config.resolver = {
  ...config.resolver,
  extraNodeModules,
  assetExts: config.resolver.assetExts.filter((ext) => ext !== "svg"),
  sourceExts: [...config.resolver.sourceExts, "svg"],
  // Block web-only packages from being bundled (SharedArrayBuffer crashes Hermes)
  blockList: [
    /.*\/node_modules\/jsdom\/.*/,
    /.*\/node_modules\/\.pnpm\/jsdom@.*/,
    /.*\/node_modules\/happy-dom\/.*/,
    /.*\/node_modules\/\.pnpm\/happy-dom@.*/,
  ],
};

module.exports = config;
