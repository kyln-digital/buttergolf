// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Ensure Metro can resolve & watch workspace packages
config.watchFolders = [monorepoRoot];

// Singleton packages that must resolve to single instance
// These are hoisted to monorepo root via .npmrc public-hoist-pattern
const singletonPackages = [
  'react',
  'react-native',
  'react-dom',
  '@tamagui/core',
  '@tamagui/web',
  'tamagui',
];

// Build extraNodeModules to force resolution from monorepo root
const extraNodeModules = {};
singletonPackages.forEach((pkg) => {
  try {
    const pkgPath = path.dirname(
      require.resolve(`${pkg}/package.json`, { paths: [monorepoRoot] })
    );
    extraNodeModules[pkg] = pkgPath;
  } catch {
    // Package not found, skip
  }
});

// Configure SVG support with react-native-svg-transformer
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...config.resolver,
  extraNodeModules,
  // Prefer the app's node_modules, then fall back to the monorepo root.
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(monorepoRoot, 'node_modules'),
  ],
  // Prevent Metro from trying to resolve nested node_modules inside packages.
  // This helps avoid duplicate module instances (esp. tamagui/@tamagui/*).
  disableHierarchicalLookup: true,
  assetExts: config.resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...config.resolver.sourceExts, 'svg'],
  // Block web-only testing packages from being bundled
  blockList: [
    /.*\/node_modules\/jsdom\/.*/,
    /.*\/node_modules\/\.pnpm\/jsdom@.*/,
    /.*\/node_modules\/happy-dom\/.*/,
    /.*\/node_modules\/\.pnpm\/happy-dom@.*/,
    /.*\/node_modules\/vitest\/.*/,
    /.*\/node_modules\/\.pnpm\/vitest@.*/,
    /.*\/node_modules\/@vitest\/.*/,
    /.*\/node_modules\/\.pnpm\/@vitest.*/,
    /.*\/node_modules\/@testing-library\/react\/.*/,
    /.*\/node_modules\/@testing-library\/jest-dom\/.*/,
  ],
};

module.exports = config;
