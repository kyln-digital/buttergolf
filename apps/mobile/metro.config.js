const { getDefaultConfig } = require('expo/metro-config');
const { FileStore } = require('metro-cache');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// #1 - Watch all files in the monorepo
config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), workspaceRoot]),
);

// #2 - Try resolving with project modules first, then workspace modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// #3 - Force Metro to resolve (sub)dependencies only from the `nodeModulesPaths`
config.resolver.disableHierarchicalLookup = false;

// #3.5 - Configure SVG support with react-native-svg-transformer
const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
  // Force singleton resolution to prevent "Invalid hook call" and "duplicate tamagui instances" errors
  extraNodeModules: {
    'webidl-conversions': path.resolve(workspaceRoot, 'node_modules/.pnpm/webidl-conversions@5.0.0/node_modules/webidl-conversions'),
  },
  // Intercept resolution to force singletons for React and Tamagui
  resolveRequest: (context, moduleName, platform) => {
    // Packages that must be singletons to avoid "Invalid hook call" / "duplicate instances"
    const singletons = [
      'react',
      'react-dom',
      'react-native',
      'tamagui',
      '@tamagui/core',
      '@tamagui/web',
      '@tamagui/constants',
      '@tamagui/helpers',
      '@tamagui/use-event',
      '@tamagui/use-force-update',
      '@tamagui/use-did-finish-ssr',
      '@tamagui/compose-refs',
      '@tamagui/is-equal-shallow',
    ];
    
    if (singletons.includes(moduleName)) {
      return {
        filePath: require.resolve(moduleName, { paths: [workspaceRoot] }),
        type: 'sourceFile',
      };
    }
    
    // Default resolution for everything else
    return context.resolveRequest(context, moduleName, platform);
  },
  // #3.1 - Block web-only testing packages from being bundled (they use SharedArrayBuffer which Hermes doesn't support)
  // IMPORTANT: Only block jsdom and webidl-conversions@8.x (the problematic version)
  blockList: [
    // jsdom itself (web-only testing library)
    /.*\/node_modules\/jsdom\/.*/,
    // Block the pnpm store path for jsdom and its problematic deps
    /.*\/node_modules\/\.pnpm\/jsdom@.*/,
    /.*\/node_modules\/\.pnpm\/webidl-conversions@8\..*/,
    // happy-dom (alternative to jsdom, also web-only)  
    /.*\/node_modules\/happy-dom\/.*/,
    /.*\/node_modules\/\.pnpm\/happy-dom@.*/,
    // Vitest and testing utilities (dev-only, not needed in app bundle)
    /.*\/node_modules\/vitest\/.*/,
    /.*\/node_modules\/\.pnpm\/vitest@.*/,
    /.*\/node_modules\/@vitest\/.*/,
    /.*\/node_modules\/\.pnpm\/@vitest.*/,
    /.*\/node_modules\/@testing-library\/react\/.*/,
    /.*\/node_modules\/@testing-library\/jest-dom\/.*/,
  ],
};

// #4 - Use turborepo to restore the cache when possible
config.cacheStores = [
  new FileStore({
    root: path.join(projectRoot, 'node_modules', '.cache', 'metro'),
  }),
];

module.exports = config;
